// Owner 2026-11-25 adconsole102. Old code fails: tenkey-ads route / mount do not exist.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const model = require("../console/model.js");
const tick = () => new Promise(setImmediate);
const plain = (x) => JSON.parse(JSON.stringify(x));

function fixture(stats) {
  const nodes = new Map(), calls = [], blobs = [], links = [];
  function byId(id) {
    if (!nodes.has(id)) nodes.set(id, { dataset: {}, value: "", textContent: "", innerHTML: "", disabled: false,
      events: {}, addEventListener(name, fn) { this.events[name] = fn; }, reportValidity: () => true });
    return nodes.get(id);
  }
  byId("tenkeyAdsDays").value = "30";
  const T = { fmt: { esc: (x) => String(x).replaceAll("<", "&lt;").replaceAll('"', "&quot;"), num: (x) => String(x) },
    stats: async (...args) => { calls.push(plain(args)); return stats(...args); },
    setMessage: (id, message) => { byId(id).textContent = message; },
    report: (id, error) => { byId(id).textContent = `오류: ${error.message}`; },
  };
  const context = { window: { ConsoleTenkey: T }, Date, Blob, document: { getElementById: byId,
    createElement: () => { const link = { click() { links.push(this.download); }, remove() {} }; return link; },
    body: { appendChild() {} } }, URL: { createObjectURL(blob) { blobs.push(blob); return "blob:test"; }, revokeObjectURL() {} },
    setTimeout: (fn) => fn() };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../console/tenkey-ads.js"), "utf8"), context);
  const submit = async (id, submitter) => { await byId(id).events.submit({ preventDefault() {}, submitter }); await tick(); };
  return { T, byId, calls, blobs, links, submit };
}

test("ad route is recognized rather than falling back to analytics", () => {
  assert.equal(model.routeFromHash("#/tenkey-ads").page, "tenkey-ads");
});
test("summary groups campaign/platform, escapes campaign text, requests 7/30/90 days, wires once", async () => {
  const f = fixture(async () => [{ utm_campaign: '<img src=x onerror="bad">', platform: "android", rows: 8, buyers: 5, with_gclid: 3 },
    { utm_campaign: "(none)", platform: "ios", rows: 2, buyers: 1, with_gclid: 0 }]);
  f.T.mountAds(); await tick();
  assert.deepEqual(f.calls[0], ["ads.summary", { days: 30 }]);
  assert.match(f.byId("tenkeyAdsTable").innerHTML, /&lt;img/);
  assert.doesNotMatch(f.byId("tenkeyAdsTable").innerHTML, /<img/);
  assert.match(f.byId("tenkeyAdsTable").innerHTML, />8<.*>5<.*>3</s);
  assert.match(f.byId("tenkeyAdsTable").innerHTML, /iOS/);
  for (const days of [7, 90]) { f.byId("tenkeyAdsDays").value = String(days); await f.submit("tenkeyAdsForm");
    assert.deepEqual(f.calls.at(-1), ["ads.summary", { days }]); }
});
test("the latest period wins when an older request finishes late; failure clears old rows", async () => {
  let resolveOld;
  const f = fixture(() => new Promise((resolve) => { resolveOld = resolve; }));
  f.T.mountAds(); await tick();
  f.T.stats = async () => [];
  await f.submit("tenkeyAdsForm");
  resolveOld([{ utm_campaign: "stale", platform: "android", rows: 999, buyers: 999, with_gclid: 999 }]); await tick();
  assert.doesNotMatch(f.byId("tenkeyAdsTable").innerHTML, /stale|999/);
  f.T.stats = async () => { throw new Error("down"); };
  await f.submit("tenkeyAdsForm");
  assert.match(f.byId("tenkeyAdsMessage").textContent, /오류/);
  assert.doesNotMatch(f.byId("tenkeyAdsTable").innerHTML, /999/);
});
test("download sends the chosen UTC day, creates UTF-8 CSV, reports braid omission, and restores on failure", async () => {
  const f = fixture(async (action) => action === "ads.summary" ? [] : { csv: "header\r\n", rows: 1, omitted: 2 });
  f.T.mountAds(); await tick();
  f.byId("tenkeyAdsSince").value = "2026-11-24";
  await f.submit("tenkeyAdsUploadForm", { value: "legacy" });
  assert.deepEqual(f.calls.at(-1), ["ads.upload", { since: "2026-11-24T00:00:00Z", format: "legacy" }]);
  assert.equal(await f.blobs[0].text(), "header\r\n");
  assert.match(f.blobs[0].type, /text\/csv/);
  assert.match(f.links[0], /2026-11-24.*legacy.*\.csv$/);
  assert.match(f.byId("tenkeyAdsUploadMessage").textContent, /2/);
  f.T.stats = async () => { throw new Error("down"); };
  await f.submit("tenkeyAdsUploadForm", { value: "data_manager" });
  assert.equal(f.blobs.length, 1);
  assert.equal(f.byId("tenkeyAdsDownload").disabled, false);
  assert.equal(f.byId("tenkeyAdsLegacy").disabled, false);
});
