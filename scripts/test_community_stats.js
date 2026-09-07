#!/usr/bin/env node

const assert = require("node:assert/strict");
const community = require("../assets/community-stats.js");

function valid(overrides = {}) {
  return {
    total_score: "9007199254740993",
    record_count: 12,
    as_of: "2026-09-07T09:15:55.410Z",
    window_days: 28,
    all_time: false,
    ...overrides,
  };
}

function node() {
  return {
    textContent: "",
    hidden: false,
    dataset: {},
    style: { setProperty(name, value) { this[name] = value; } },
    classList: { add() {}, remove() {} },
    handlers: {},
    attributes: {},
    children: [],
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
  };
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve));
  await Promise.resolve();
}

async function runInit(fetchResponses) {
  const section = node();
  const total = node();
  const count = node();
  const status = node();
  const retry = node();
  section.querySelector = selector => ({
    "[data-community-total]": total,
    "[data-community-count]": count,
    "[data-community-status]": status,
    "[data-community-retry]": retry,
  }[selector]);
  const events = {};
  const document = {
    documentElement: { lang: "en", dataset: {} },
    querySelector: selector => selector === "[data-community-stats]" ? section : null,
    createElement: () => node(),
  };
  const original = {
    document: global.document,
    window: global.window,
    fetch: global.fetch,
    matchMedia: global.matchMedia,
    addEventListener: global.addEventListener,
  };
  const requests = [];
  global.document = document;
  global.window = {};
  global.matchMedia = () => ({ matches: true, addEventListener() {} });
  global.addEventListener = (type, handler) => { events[type] = handler; };
  global.fetch = (url, options) => {
    requests.push({ url, options });
    return Promise.resolve(fetchResponses.shift());
  };
  const cleanup = () => {
    global.document = original.document;
    global.window = original.window;
    global.fetch = original.fetch;
    global.matchMedia = original.matchMedia;
    global.addEventListener = original.addEventListener;
  };
  try {
    community.init();
    await flush();
    return { section, total, count, status, retry, events, requests, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

assert.deepEqual(community.validateStats(valid()), {
  total_score: "9007199254740993",
  record_count: 12,
  as_of: "2026-09-07T09:15:55.410Z",
});
assert.deepEqual(community.validateStats(valid({ total_score: "0", record_count: 0 })).record_count, 0);
for (const data of [
  valid({ window_days: 7 }),
  valid({ all_time: true }),
  valid({ total_score: "01" }),
  valid({ total_score: "9".repeat(31) }),
  valid({ record_count: Number.MAX_SAFE_INTEGER + 1 }),
  valid({ record_count: -1 }),
  valid({ as_of: "not-a-date" }),
]) assert.throws(() => community.validateStats(data), /Invalid community totals/);

const plans = community.digitPlan("12345", "en-US").filter(plan => plan.steps !== undefined);
assert.deepEqual(plans.map(plan => plan.char), ["1", "2", "3", "4", "5"]);
assert.equal(plans.at(-1).delay, 0);
assert.equal(plans.at(-2).delay, 65);
assert.equal(plans.at(-1).duration, 1050);

(async () => {
  const success = await runInit([{ ok: true, json: async () => valid({ total_score: "12345", record_count: 7 }) }]);
  assert.equal(success.requests.length, 1);
  assert.equal(success.requests[0].options.cache, "no-store");
  assert.equal(success.requests[0].options.credentials, "omit");
  assert.equal(success.total.dataset.value, "12345");
  assert.equal(success.count.dataset.value, "7");
  assert.equal(success.section.dataset.statsState, "ready");
  assert.equal(success.status.hidden, true);
  success.cleanup();

  const retry = await runInit([
    { ok: false, json: async () => ({}) },
    { ok: true, json: async () => valid({ total_score: "42", record_count: 1 }) },
  ]);
  assert.equal(retry.section.dataset.statsState, "error");
  assert.equal(retry.retry.hidden, false);
  retry.retry.handlers.click();
  await flush();
  assert.equal(retry.requests.length, 2);
  assert.equal(retry.section.dataset.statsState, "ready");
  assert.equal(retry.total.dataset.value, "42");
  retry.cleanup();

  const persisted = await runInit([
    { ok: true, json: async () => valid({ total_score: "1", record_count: 1 }) },
    { ok: true, json: async () => valid({ total_score: "2", record_count: 2 }) },
  ]);
  persisted.events.pageshow({ persisted: true });
  await flush();
  assert.equal(persisted.requests.length, 2);
  assert.equal(persisted.total.dataset.value, "2");
  assert.equal(persisted.count.dataset.value, "2");
  persisted.cleanup();

  console.log("Community stats contract: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
