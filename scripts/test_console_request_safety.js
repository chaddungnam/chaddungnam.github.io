"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const path = require("node:path");
const model = require("../console/model.js");
const purchaseModel = require("../console/purchases-model.js");
const tick = () => new Promise(setImmediate);
const source = (name) => fs.readFileSync(path.join(__dirname, "../console", name), "utf8");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const player = (userId, nickname = userId) => ({ player: { user_id: userId, nickname, state_version: 3, gems: 50, stamina: 5, stamina_max: 5, breakthrough_tickets: 0, speed_boost_tickets: 0 }, operations: { mutations_enabled: true }, catalog: [], audit: [] });

function fixture(script, post) {
  const elements = new Map();
  function node(id) {
    if (elements.has(id)) return elements.get(id);
    const value = { id, isConnected: true, innerHTML: "", textContent: "", value: "", style: {}, dataset: {}, events: {}, children: [], attrs: {}, disabled: false,
      elements: { kind: { addEventListener() {} } },
      addEventListener(type, callback) { this.events[type] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; }, getAttribute(key) { return this.attrs[key] ?? null; },
      removeAttribute(key) { delete this.attrs[key]; }, closest() { return null; },
      querySelectorAll(selector) { if (id === "liveopsForms" && selector === "form") return [node("mockLiveopsForm")]; if (id === "liveopsForms" && selector === "fieldset") return [node("mockLiveopsFieldset")]; return selector === "[data-thread-id]" ? [...this.innerHTML.matchAll(/data-thread-id="([^"]+)"/g)].map((match) => { const button = node(`thread-${match[1]}`); button.dataset.threadId = match[1]; return button; }) : []; }, querySelector(selector) { return node(`${id}:${selector}`); },
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
      insertRow() { const row = node(`${id}:row:${this.children.length}`); this.children.push(row); return row; },
      insertCell() { const cell = node(`${id}:cell:${this.children.length}`); this.children.push(cell); return cell; },
      reportValidity() { return true; }, focus() {}, scrollIntoView() {}, reset() {},
    };
    elements.set(id, value); return value;
  }
  const window = { ConsoleModel: model, ConsolePurchasesModel: purchaseModel, ConsoleAPI: { post: async (...args) => post(...args) }, ConsoleApp: { confirmChange: async () => true }, matchMedia: () => ({ matches: false }),
    location: { hash: "#/players/a" }, history: { replaceState(_, __, hash) { window.location.hash = hash; } } };
  const context = { window, document: { getElementById: node, querySelector: node, createElement: node, querySelectorAll: () => [] }, URLSearchParams, crypto,
    FormData: class { constructor(form) { this.form = form; } *[Symbol.iterator]() { for (const [key, field] of Object.entries(this.form.elements)) yield [key, field.value]; } },
  };
  vm.runInNewContext(source("ui-state.js"), context);
  if (script === "lab.js") { node("rankingForm").elements.day = {}; node("labAnalyticsForm").elements.rangeDays = { value: "28" }; }
  vm.runInNewContext(source(script), context);
  return { window, node, context };
}

test("late player reads never replace the selected account, including after navigation", async () => {
  const reads = [];
  const { window, node } = fixture("players.js", (_, p) => p.action === "analytics_exclusions.list" ? [] : (reads.push(deferred()), reads.at(-1).promise));
  const a = window.ConsolePlayers.mountDetail("a");
  assert.equal(node("playerDetail").inert, true);
  window.location.hash = "#/players/b";
  const b = window.ConsolePlayers.mountDetail("b");
  reads[1].resolve(player("b", "CURRENT")); await b;
  reads[0].resolve(player("a", "STALE")); await a;
  assert.match(node("playerDetail").innerHTML, /CURRENT/);
  assert.doesNotMatch(node("playerDetail").innerHTML, /STALE/);
  assert.equal(node("playerDetail").inert, false);
  const c = window.ConsolePlayers.mountDetail("c");
  window.location.hash = "#/operations";
  reads[2].reject(new Error("late failure")); await c;
  assert.match(node("playerDetail").innerHTML, /CURRENT/);
});

test("search during loading fetches the new filter and discards old results", async () => {
  const reads = [];
  const { window, node } = fixture("players.js", (_, p) => p.action === "analytics_exclusions.list" ? [] : (reads.push({ ...deferred(), payload: p }), reads.at(-1).promise));
  window.location.hash = "#/players";
  window.ConsolePlayers.mountList();
  node("playerSearch").value = "NEW";
  node("playerSearchForm").events.submit({ preventDefault() {} });
  assert.equal(reads.length, 2);
  assert.equal(reads[1].payload.query, "NEW");
  reads[1].resolve({ total: 1, rows: [{ user_id: "b", nickname: "NEW", best_level: -1 }] }); await tick();
  reads[0].resolve({ total: 1, rows: [{ user_id: "a", nickname: "OLD" }] }); await tick();
  assert.match(node("playersTable").innerHTML, /NEW/);
  assert.doesNotMatch(node("playersTable").innerHTML, /OLD|Lv.-1/);
});

test("player writes lock before confirmation, reuse uncertain request IDs, and keep the receipt", async () => {
  const writes = [], gate = deferred();
  let attempts = 0;
  const { window, node } = fixture("players.js", async (_, p) => {
    if (p.action === "analytics_exclusions.list") return [];
    if (p.action === "players.get") return player("a");
    writes.push(p);
    if (++attempts === 1) throw new TypeError("network lost");
    return { ok: true };
  });
  await window.ConsolePlayers.mountDetail("a");
  const form = node("economyForm");
  form.elements = Object.fromEntries(Object.entries({ ...player("a").player, gems: 80, reason: "CS correction" }).map(([key, value]) => [key, { value }]));
  window.ConsoleApp.confirmChange = () => gate.promise;
  const event = { currentTarget: form, preventDefault() {} };
  const first = form.events.submit(event);
  await form.events.submit(event);
  assert.equal(writes.length, 0);
  gate.resolve(true); await first;
  assert.equal(writes.length, 1);
  assert.match(node("playerMessage").textContent, /network lost/);
  await form.events.submit(event);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].requestId, writes[1].requestId);
  assert.match(node("playerMessage").textContent, /재화 변경을 저장/);
  assert.equal(node("playerDetail").getAttribute("aria-busy"), "false");
});

test("purchase filters cannot silently stay on an earlier request", async () => {
  const reads = [];
  const { window, node } = fixture("purchases.js", (_, p) => (reads.push({ ...deferred(), payload: p }), reads.at(-1).promise));
  window.ConsolePurchases.mount();
  node("purchaseQuery").value = "new account";
  node("purchaseFilterForm").events.submit({ preventDefault() {} });
  assert.equal(reads.length, 2);
  assert.equal(reads[1].payload.query, "new account");
  reads[1].resolve({ summary: {}, total: 2, purchases: [] }); await tick();
  reads[0].resolve({ summary: {}, total: 9, purchases: [] }); await tick();
  assert.equal(node("purchaseTotal").textContent, "2건");
});

test("invalid JSON is never reported as a successful write; API requests have a deadline", async () => {
  let options;
  const window = { ConsoleAuth: { headers: () => ({}), logout() {}, requireChallenge() {} } };
  vm.runInNewContext(source("api.js"), { window, AbortSignal, fetch: async (_, o) => { options = o; return { ok: true, status: 200, json: async () => { throw Error(); } }; } });
  window.ConsoleAPI.initialize({ functionBaseUrl: "https://example.test" });
  await assert.rejects(window.ConsoleAPI.post("admin-console", { action: "players.mutate" }), /console_invalid_response/);
  assert.ok(options.signal instanceof AbortSignal);
});


test("liveops confirms preview, cancels without writing and retries an uncertain write with the same ID", async () => {
  const calls = []; let failWrite = true, allow = false;
  const { window, node } = fixture("liveops.js", async (_, p) => {
    calls.push(p);
    if (p.action === "liveops.get") return {config:{}};
    if (p.action === "liveops.preview") return {targets:12,already_received:2,reagent_per_account:"200",total_reagent:"2400"};
    if (failWrite) throw new Error("timeout");
    return {ok:true,grant:{inserted:12}};
  });
  const form=node("mockLiveopsForm");form.dataset.kind="mail";
  form.elements={reason:{value:"mock check"},eventKey:{value:"mock_event"},reagent:{value:"200"},expiresInDays:{value:"7"}};
  let confirmations=0;
  window.ConsoleApp.confirmChange=async (_,text)=>{confirmations++;assert.match(text,/2400시약/);return allow;};
  await window.ConsoleLiveops.mount();
  const submit=()=>form.events.submit({preventDefault(){}});
  submit();await tick();assert.equal(calls.filter(p=>p.action==="liveops.update").length,0);
  allow=true;submit();submit();await tick();
  assert.equal(calls.filter(p=>p.action==="liveops.update").length,1);
  failWrite=false;submit();await tick();
  const writes=calls.filter(p=>p.action==="liveops.update");assert.equal(writes.length,2);assert.equal(writes[0].requestId,writes[1].requestId);
  assert.equal(confirmations,3);assert.match(node("liveopsMessage").textContent,/실제 발송 12건/);
  assert.equal(node("mockLiveopsFieldset").disabled,false);
});

test("liveops read failure locks writes and turning off does not need a preview or valid event dates", async () => {
  const calls=[];let fails=true;
  const {window,node}=fixture("liveops.js",async(_,p)=>{calls.push(p);if(fails)throw new Error("unavailable");return p.action==="liveops.get" ? {config:{}} : {ok:true};});
  const form=node("mockLiveopsForm");form.dataset.kind="exp";form.elements={reason:{value:"stop mock"}};
  form.reportValidity=()=>false;
  await window.ConsoleLiveops.mount();assert.equal(node("mockLiveopsFieldset").disabled,true);
  fails=false;await window.ConsoleLiveops.mount();
  node("mockLiveopsForm:[data-disable]").events.click();await tick();
  assert.equal(calls.filter(p=>p.action==="liveops.preview").length,0);
  const write=calls.find(p=>p.action==="liveops.update");assert.equal(write.enabled,false);assert.equal(Object.keys(write.config).length,0);
});

test("lab reads discard stale responses, preserve zero and escape server text", async () => {
  const reads=[];
  const {window,node}=fixture("lab.js",(_,p)=>{const read=deferred();reads.push(read);return read.promise;});
  const a=window.ConsoleLab.loadPlayer("a"),b=window.ConsoleLab.loadPlayer("b");
  reads[1].resolve({profile:{reagent:"0",vip_tier:0,hex_stats:{}},facts:{labCompletedRuns:0},events:[{event_type:"<img src=x onerror=alert(1)>"}]});await b;
  const html=node("labPlayer").innerHTML;assert.match(html,/>0</);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
  reads[0].resolve({profile:{reagent:"999"}});await a;assert.equal(node("labPlayer").innerHTML,html);
  const c=window.ConsoleLab.loadPlayer("c");reads[2].reject(new Error("missing RPC"));await c;
  assert.match(node("labPlayer").innerHTML,/서버 적용 상태/);assert.doesNotMatch(node("labPlayer").innerHTML,/프로필이 없습니다/);
});
