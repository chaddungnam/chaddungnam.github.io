// Tag logic of the 10key console watch (owner 2026-11-15) on fixtures: node --test tests/tenkey-watch-tags.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../console/tenkey-watch.js", import.meta.url), "utf8");
const win = { ConsoleTenkey: { fmt: { esc: (v) => String(v), num: String, time: String, duration: String, platformName: String } } };
new Function("window", "document", src)(win, {});
const { tagList, tagsMarkup } = win.ConsoleTenkey.watch;
const keys = (i) => tagList(i).map((t) => t.key);

test("each tag appears for its own state only", () => {
  assert.deepEqual(keys({}), []);
  assert.deepEqual(keys(null), []);
  assert.deepEqual(keys({ review_mode: true, review_granted: true }), ["review"]);
  assert.deepEqual(keys({ review_granted: true }), ["review_off"]);
  assert.deepEqual(keys({ god_mode: true }), ["god"]);
  assert.deepEqual(keys({ rank_normal: 3 }), ["top_normal"]);
  assert.deepEqual(keys({ rank_hard: 1 }), ["top_hard"]);
  assert.deepEqual(keys({ review_mode: true, god_mode: true, rank_normal: 1, rank_hard: 2 }), ["review", "god", "top_normal", "top_hard"]);
});
test("labels a stranger reads, with the rank in the hover text", () => {
  const t = tagList({ rank_normal: 4, god_mode: true });
  assert.equal(t[0].label, "[무적]");
  assert.equal(t[1].label, "[TOP10 일반]");
  assert.match(t[1].title, /4위/);
  assert.match(tagsMarkup({ review_mode: true }), /data-tone="review"/);
});
