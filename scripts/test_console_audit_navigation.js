#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const model = require("../console/model.js");
const tick = () => new Promise(setImmediate);
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";

function fixture(script, post) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: "", textContent: "", value: "", style: {}, events: {},
      elements: { kind: { addEventListener() {} } },
      addEventListener(type, callback) { this.events[type] = callback; },
      querySelectorAll() { return []; }, closest() { return null; },
    });
    return elements.get(id);
  };
  const window = { ConsoleModel: model, location: { hash: `#/audit?userId=${userA}` }, ConsoleAPI: { post } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../console", script), "utf8"), {
    window, document: { getElementById: element }, URLSearchParams,
  });
  return { window, element };
}

test("audit account navigation resets page and removing filter restores all accounts", async () => {
  const calls = [];
  const { window, element } = fixture("audit.js", async (_, payload) => {
    calls.push(payload); return { rows: [], total: 100 };
  });
  window.ConsoleAudit.mount(); await tick();
  element("auditNext").events.click(); await tick();
  assert.equal(calls.at(-1).page, 2);
  window.location.hash = `#/audit?userId=${userB}`;
  window.ConsoleAudit.mount(); await tick();
  assert.equal(calls.at(-1).userId, userB);
  assert.equal(calls.at(-1).page, 1);
  window.location.hash = "#/audit";
  window.ConsoleAudit.mount(); await tick();
  assert.equal(calls.at(-1).userId, undefined);
  assert.equal(element("auditUserId").value, "");
});

test("late previous-account audit response cannot overwrite current-account results", async () => {
  const pending = [];
  const { window, element } = fixture("audit.js", () => new Promise((resolve) => pending.push(resolve)));
  window.ConsoleAudit.mount();
  window.location.hash = `#/audit?userId=${userB}`;
  window.ConsoleAudit.mount();
  pending[1]({ total: 1, rows: [{ success: true, reason: "current account", action_type: "reward_mail" }] });
  await tick();
  pending[0]({ total: 1, rows: [{ success: false, reason: "previous account", action_type: "reward_mail" }] });
  await tick();
  assert.match(element("auditList").innerHTML, /current account/);
  assert.doesNotMatch(element("auditList").innerHTML, /previous account/);
});

test("player detail shows audit outcomes safely and links to that player's complete audit", async () => {
  const { window, element } = fixture("players.js", async (_, payload) => {
    if (payload.action === "analytics_exclusions.list") return [];
    assert.equal(payload.action, "players.get");
    return { player: {}, audit: [
      { success: true, action_type: "reward_mail", reason: "completed" },
      { success: false, action_type: "reward_mail", error_code: "<img src=x>", reason: "failed" },
      { success: false, action_type: "reward_mail", error_code: null },
    ] };
  });
  await window.ConsolePlayers.mountDetail(userA);
  const html = element("playerDetail").innerHTML;
  assert.match(html, /audit-status[^>]*>성공</);
  assert.match(html, /실패 · &lt;img src=x&gt;/);
  assert.match(html, /실패 · 사유 미기록/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.ok(html.includes(`href="#/audit?userId=${userA}"`));
});
