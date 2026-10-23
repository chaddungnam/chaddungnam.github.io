#!/usr/bin/env node
"use strict";
// 10KEY force-update page of the console: form validation, the tenkey-admin calls (with the request-id
// reuse rule), Korean error messages, and the three-game project switch in app.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const model = require("../console/model.js");
const tick = () => new Promise(setImmediate);
const plain = (value) => JSON.parse(JSON.stringify(value));   // values built inside the vm context have another Object.prototype
const source = (name) => fs.readFileSync(path.join(__dirname, "../console", name), "utf8");

function node(extra = {}) {
  const attrs = {};
  return {
    hidden: false, disabled: false, textContent: "", value: "", style: {}, dataset: {}, events: {},
    addEventListener(type, callback) { this.events[type] = callback; },
    setAttribute(key, value) { attrs[key] = String(value); }, getAttribute(key) { return attrs[key] ?? null; },
    removeAttribute(key) { delete attrs[key]; },
    querySelectorAll() { return []; }, focus() {}, matches() { return false; },
    ...extra,
  };
}

const FIELDS = ["minVersionCode", "latestVersionCode", "minBuildIos", "latestBuildIos", "storeUrlAndroid", "storeUrlIos", "reason"];
const GOOD = {
  minVersionCode: "2", latestVersionCode: "3", minBuildIos: "1", latestBuildIos: "2",
  storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival",
  storeUrlIos: "https://apps.apple.com/app/id1", reason: "첫 강제 업데이트",
};
const SERVER_CONFIG = {
  min_version_code: 0, latest_version_code: 1, min_build_ios: 0, latest_build_ios: 0,
  store_url_android: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival", store_url_ios: "",
  updated_at: "2026-10-22T09:00:00Z",
};

function pageFixture(post, confirm = async () => true) {
  const elements = new Map();
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const form = byId("tenkeyConfigForm");
  form.elements = Object.fromEntries(FIELDS.map((name) => [name, { value: "" }]));
  form.reportValidity = () => true;
  const calls = [];
  const confirmations = [];
  const window = {
    ConsoleAPI: { postProject: async (...args) => { calls.push(args); return post(...args); } },
    ConsoleApp: { confirmChange: async (title, body) => { confirmations.push({ title, body }); return confirm(title, body); } },
    ConsoleAuth: { renderGoogleButton() {} },
  };
  const context = {
    window, crypto,
    document: { getElementById: byId, createElement: () => node({ insertAdjacentElement() {} }) },
    FormData: class { constructor(f) { this.form = f; } *[Symbol.iterator]() { for (const [key, field] of Object.entries(this.form.elements)) yield [key, field.value]; } },
  };
  vm.runInNewContext(source("ui-state.js"), context);
  vm.runInNewContext(source("tenkey.js"), context);
  const fill = (values) => FIELDS.forEach((name) => { form.elements[name].value = values[name] ?? ""; });
  const submit = async () => { await form.events.submit({ preventDefault() {}, currentTarget: form }); await tick(); };
  return { window, byId, form, calls, confirmations, fill, submit };
}

test("validation: integers >= 0, min <= latest per platform, https links, iOS link, reason", () => {
  const { window } = pageFixture(async () => ({}));
  const check = (patch) => window.ConsoleTenkey.validate({ ...GOOD, ...patch });
  assert.deepEqual(plain(check({}).config), {
    min_version_code: 2, latest_version_code: 3, min_build_ios: 1, latest_build_ios: 2,
    store_url_android: GOOD.storeUrlAndroid, store_url_ios: GOOD.storeUrlIos,
  });
  assert.equal(check({}).reason, "첫 강제 업데이트");
  for (const bad of ["", "-1", "1.5", "abc", "1e3", " "]) assert.equal(check({ minVersionCode: bad }).error, "invalid_number", `bad number ${JSON.stringify(bad)}`);
  assert.equal(check({ minVersionCode: "4" }).error, "min_above_latest_android");
  assert.equal(check({ minBuildIos: "3" }).error, "min_above_latest_ios");
  assert.equal(check({ storeUrlAndroid: "http://play.google.com/x" }).error, "invalid_store_url");
  assert.equal(check({ storeUrlIos: "apps.apple.com/app/id1" }).error, "invalid_store_url");
  assert.equal(check({ storeUrlIos: "" }).error, "ios_store_url_required");
  assert.equal(check({ minBuildIos: "0", latestBuildIos: "0", storeUrlIos: "" }).config.store_url_ios, "", "iOS off needs no iOS link");
  assert.equal(check({ storeUrlAndroid: "" }).config.store_url_android, "", "Android link may stay empty");
  assert.equal(check({ minVersionCode: "0", latestVersionCode: "0" }).config.latest_version_code, 0, "0 means off");
  assert.equal(check({ reason: "   " }).error, "reason_required");
});

test("opening the page reads config.get through the House Duck project client (tenkey-admin) and fills the form", async () => {
  const { window, byId, form, calls } = pageFixture(async () => ({ ok: true, data: SERVER_CONFIG }));
  window.ConsoleTenkey.mountConfig(); await tick();
  assert.deepEqual(plain(calls[0]), ["houseduck", "tenkey-admin", { action: "config.get", params: {} }]);
  assert.equal(form.elements.latestVersionCode.value, 1);
  assert.equal(form.elements.minBuildIos.value, 0);
  assert.equal(form.elements.storeUrlAndroid.value, SERVER_CONFIG.store_url_android);
  assert.match(byId("tenkeyConfigMessage").textContent, /현재 값/);
});

test("a server without the 10KEY actions shows the Korean not-deployed message", async () => {
  const { window, byId } = pageFixture(async () => { throw Object.assign(new Error("unknown_action"), { status: 400 }); });
  window.ConsoleTenkey.mountConfig(); await tick();
  assert.equal(byId("tenkeyConfigMessage").textContent, "서버에 10KEY 기능이 아직 배포되지 않았습니다.");
});

test("saving confirms the numbers and links, then sends config.set with a request_id", async () => {
  const { window, byId, form, calls, confirmations, fill, submit } = pageFixture(async (_, __, body) =>
    body.action === "config.get" ? { ok: true, data: SERVER_CONFIG } : { ok: true, data: { ok: true, config: body.params.config } });
  window.ConsoleTenkey.mountConfig(); await tick();
  fill(GOOD); await submit();
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0].title, "10KEY 앱 설정 변경");
  assert.equal(confirmations[0].body, [
    "Android 최소 2 · 최신 3", "iOS 최소 빌드 1 · 최신 2",
    `Google Play 링크: ${GOOD.storeUrlAndroid}`, `App Store 링크: ${GOOD.storeUrlIos}`, "변경 이유: 첫 강제 업데이트",
  ].join("\n"));
  const [project, fn, body] = calls.at(-1);
  assert.deepEqual([project, fn, body.action], ["houseduck", "tenkey-admin", "config.set"]);
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(plain(body.params), { config: plain(window.ConsoleTenkey.validate(GOOD).config), reason: "첫 강제 업데이트" });
  assert.equal(form.elements.reason.value, "", "the reason is cleared so the next change needs its own");
  assert.equal(form.elements.minVersionCode.value, 2);
  assert.equal(byId("tenkeyConfigMessage").textContent, "10KEY 앱 설정을 저장했습니다.");
});

test("cancelling the confirmation and invalid input send nothing", async () => {
  const { window, byId, calls, fill, submit } = pageFixture(async () => ({ ok: true, data: SERVER_CONFIG }), async () => false);
  window.ConsoleTenkey.mountConfig(); await tick();
  const before = calls.length;
  fill(GOOD); await submit();
  assert.equal(calls.length, before, "cancel");
  fill({ ...GOOD, minBuildIos: "5" }); await submit();
  assert.equal(calls.length, before, "invalid");
  assert.equal(byId("tenkeyConfigFormMessage").textContent, "iOS 최소 빌드 번호는 최신 빌드 번호보다 클 수 없습니다.");
});

test("server error codes map to Korean text; a retry of the same payload reuses its request_id", async () => {
  const outcomes = [new Error("network down"), { ok: true, data: { ok: false, error: "ios_store_url_required" } }, { ok: true, data: { ok: true } }, { ok: true, data: { ok: true } }];
  const { window, byId, calls, fill, submit } = pageFixture(async (_, __, body) => {
    if (body.action === "config.get") return { ok: true, data: SERVER_CONFIG };
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  window.ConsoleTenkey.mountConfig(); await tick();
  const writes = () => calls.filter(([, , body]) => body.action === "config.set").map(([, , body]) => body.request_id);
  fill(GOOD); await submit();
  assert.match(byId("tenkeyConfigFormMessage").textContent, /network down/);
  fill(GOOD); await submit();
  assert.equal(byId("tenkeyConfigFormMessage").textContent, "iOS 번호를 0보다 크게 하려면 App Store 링크가 필요합니다.");
  assert.equal(writes()[1], writes()[0], "same payload retried after a failure keeps its request_id");
  fill({ ...GOOD, latestVersionCode: "9" }); await submit();
  assert.notEqual(writes()[2], writes()[0], "a changed payload gets a new request_id");
});

function appFixture() {
  const elements = new Map();
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const pages = ["analytics", "tenkey-overview", "tenkey-players", "tenkey-player", "tenkey-config"];
  const links = pages.filter((page) => page !== "tenkey-player").map((page) => node({ dataset: { page } }));
  const views = pages.map((route) => node({ dataset: { route }, hidden: true }));
  const selectors = [];
  const mounted = [];
  const window = {
    ConsoleUiState: { setMessage() {}, beginRequest: () => () => {} },
    ConsoleAPI: { initialize() {}, initializeProject() {} },
    ConsoleAuth: { initialize: async () => ({ signedIn: true, unlocked: true, email: "a@b.c" }), snapshot: () => ({}), isUnlocked: () => true, logout() {} },
    ConsoleModel: model,
    ConsoleAnalytics: { mount() { mounted.push("qb"); } },
    ConsoleLab: undefined,
    ConsoleTenkey: {
      mountConfig() { mounted.push("config"); }, mountOverview() { mounted.push("overview"); },
      mountPlayers() { mounted.push("players"); }, mountPlayer(id) { mounted.push(`player:${id}`); },
    },
    GmailAPI: { initialize() {} },
    location: { hash: "" },
    addEventListener() {},
  };
  const document = {
    getElementById: byId,
    querySelectorAll(selector) {
      selectors.push(selector);
      if (selector === ".route-view") return views;
      return selector.includes("#tenkeyNav a") ? links : [];
    },
  };
  const boot = vm.runInNewContext(source("app.js"), { console, document, window }, { filename: "console/app.js" });
  return { boot, byId, links, views, selectors, mounted, window };
}

test("the project picker has Quirky Ball and 10key Survival only; 10key opens on the overview with its own menu", async () => {
  const { boot, byId, links, views, selectors, mounted, window } = appFixture();
  await boot;
  byId("projectTenkey").events.click();
  assert.equal(byId("currentProject").textContent, "10key Survival");
  assert.deepEqual([byId("consoleNav").hidden, byId("tenkeyNav").hidden], [true, false]);
  assert.equal(window.location.hash, "#/tenkey-overview");
  assert.deepEqual(views.map((view) => view.hidden), [true, false, true, true, true]);
  assert.equal(links[1].getAttribute("aria-current"), "page");
  assert.deepEqual(mounted, ["overview"]);
  assert.match(selectors.at(-1), /#consoleNav a, #tenkeyNav a$/);
  assert.equal(byId("pageTitle").textContent, "한눈 요약");

  window.location.hash = "#/tenkey-config";
  byId("projectTenkey").events.click();
  assert.equal(window.location.hash, "#/tenkey-config", "a route the game owns is kept");
  assert.equal(byId("pageTitle").textContent, "앱 설정 / 강제 업데이트");

  window.location.hash = "#/tenkey-players/a1111111-1111-4111-8111-111111111111";
  byId("projectTenkey").events.click();
  assert.equal(byId("pageTitle").textContent, "플레이어 상세");
  assert.equal(links[2].getAttribute("aria-current"), "page", "a player detail keeps the player list highlighted");
  assert.equal(mounted.at(-1), "player:a1111111-1111-4111-8111-111111111111");

  window.location.hash = "#/tenkey-config";
  byId("projectQuirkyBall").events.click();
  assert.equal(byId("currentProject").textContent, "Quirky Ball");
  assert.deepEqual([byId("consoleNav").hidden, byId("tenkeyNav").hidden], [false, true]);
  assert.equal(window.location.hash, "#/analytics", "another game's route falls back to the landing page");
});

test("Comrade is gone from the console: no picker card, no pages, no script, no project client", () => {
  const html = source("index.html");
  assert.ok(!/hexaworld|comrade|동무와/i.test(html), "index.html names no Comrade");
  assert.ok(!/hexaworld|comrade/i.test(source("app.js")), "app.js names no Comrade");
  assert.ok(!fs.existsSync(path.join(__dirname, "../console/hexaworld.js")));
  for (const page of ["hexaworld-overview", "hexaworld-notices", "hexaworld-config"]) {
    assert.equal(model.routeFromHash(`#/${page}`).page, "analytics", `${page} is not a route any more`);
  }
});

test("every 10KEY page is a known console route; a player id after tenkey-players opens the detail", () => {
  for (const page of ["overview", "players", "crashes", "notices", "purchases", "ranking", "config", "audit"]) {
    assert.equal(model.routeFromHash(`#/tenkey-${page}`).page, `tenkey-${page}`);
    assert.equal(model.routeFromHash(`#/tenkey-${page}?x=1`).page, `tenkey-${page}`);
  }
  assert.deepEqual(plain(model.routeFromHash("#/tenkey-players/abc-1")), { page: "tenkey-player", userId: "abc-1" });
  assert.equal(model.routeFromHash("#/tenkey-players/%E0%A4%A").page, "tenkey-players", "a broken escape falls back to the list");
});

test("tenkey-config is a known console route", () => {
  assert.equal(model.routeFromHash("#/tenkey-config").page, "tenkey-config");
  assert.equal(model.routeFromHash("#/tenkey-config?x=1").page, "tenkey-config");
});
