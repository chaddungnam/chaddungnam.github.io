"use strict";
// Owner 2026-11-24: one common console panel for five links. Old reports code renders no five-row panel.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const tick = () => new Promise(setImmediate);
const plain = (v) => JSON.parse(JSON.stringify(v));
const IDS = ["youtube", "instagram", "x", "threads", "community"];
const formId = (id) => id === "community" ? "tenkeyCommunityForm" : `tenkeyOutside_${id}`;
const currentId = (id) => id === "community" ? "tenkeyCommunityCurrent" : `${formId(id)}Current`;

test("five rows read config, validate per host, save/reset one id, preserve unsaved siblings, and surface failures", async () => {
  const nodes = new Map(), calls = [];
  let fail = false;
  function node(id) {
    if (!nodes.has(id)) {
      const buttons = [{ disabled: true }, { disabled: true }];
      nodes.set(id, { textContent: "", innerHTML: "", value: "", events: {}, dataset: {},
        elements: { url: { value: "" }, reason: { value: "", reportValidity() { return false; } } },
        addEventListener(type, fn) { this.events[type] = fn; }, querySelectorAll() { return buttons; },
        closest() { return this; },
      });
    }
    return nodes.get(id);
  }
  IDS.forEach((id) => { node(formId(id)).dataset.outsideLink = id; });
  const window = {
    ConsoleApp: { confirmChange: async () => true },
    ConsoleUiState: { beginRequest: () => () => {} },
    ConsoleAPI: { postProject: async () => ({ data: { total: 0, rows: [] } }) },
    ConsoleTenkey: {
      fmt: { esc: String, num: String, time: String, platformName: String }, fillKeep() {},
      setMessage(id, message) { node(id).textContent = message; },
      report(id, error) { node(id).textContent = error.message; },
      call: async (action, params) => {
        calls.push({ action, params: plain(params) });
        if (fail) throw new Error("offline");
        if (action === "config.get") return { data: { community_url: "https://youtu.be/legacy", outside_links: { x: "https://twitter.com/current" } } };
        return { data: { ok: true, links: { [params.id]: params.url } } };
      },
    },
  };
  const reports = path.join(__dirname, "../console/tenkey-reports.js");
  const source = process.env.SNSLINKS_TEST_OLD === "1"
    ? require("node:child_process").execFileSync("git", ["-C", path.join(__dirname, ".."), "show", "origin/main:console/tenkey-reports.js"], { encoding: "utf8" })
    : fs.readFileSync(reports, "utf8");
  vm.runInNewContext(source, { window, document: { getElementById: node }, setTimeout });
  window.ConsoleTenkey.mountReports(); await tick();
  assert.equal((node("tenkeyOutsideLinks").innerHTML.match(/data-outside-link=/g) || []).length, 5, "panel must render five link rows");
  assert.equal(node(currentId("x")).textContent, "https://twitter.com/current");
  assert.equal(node(currentId("community")).textContent, "https://youtu.be/legacy");
  const submit = async (id, url, reset = false) => {
    const form = node(formId(id)); form.elements.url.value = url; form.elements.reason.value = "주소 변경";
    await node("tenkeyOutsideLinks").events.submit({ preventDefault() {}, target: form, submitter: { value: reset ? "reset" : "save" } });
  };
  const valid = { youtube: "https://youtu.be/new", instagram: "https://instagram.com/new/", x: "https://x.com/new",
    threads: "https://threads.net/@new", community: "https://m.youtube.com/watch?v=new" };
  for (const id of IDS) {
    for (const bad of ["http://x.com/new", "https://evil.example/new", "https://x.com@evil.example/new", "https://x.com:443/new", "junk", "https://x.com/a\\b"]) {
      const before = calls.length;
      await submit(id, bad);
      assert.equal(calls.length, before, `${id}: invalid URL must not write`);
    }
    node(formId("instagram")).elements.url.value = "https://instagram.com/unsaved/";
    await submit(id, valid[id]);
    assert.deepEqual(calls.at(-1), { action: "links.set", params: { id, url: valid[id], reason: "주소 변경" } });
    assert.equal(node(currentId(id)).href, valid[id]);
    if (id !== "instagram") assert.equal(node(formId("instagram")).elements.url.value, "https://instagram.com/unsaved/");
    await submit(id, "invalid-ignored-on-reset", true);
    assert.equal(calls.at(-1).params.url, "");
    assert.match(node(currentId(id)).href, /^https:\/\//);
  }
  fail = true;
  await submit("x", "https://x.com/failure");
  assert.equal(node(`${formId("x")}Message`).textContent, "offline");
  assert.notEqual(node(currentId("x")).href, "https://x.com/failure");
});
