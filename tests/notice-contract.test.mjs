import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../quirky-ball/notices/v1.json", import.meta.url), "utf8"));

test("notice has one localized source and twelve fallbacks", () => {
  assert.equal(manifest.active, true);
  assert.deepEqual(Object.keys(manifest.locales).sort(), [
    "ar", "de", "en", "es", "fr", "id", "it", "ja", "ko", "ur", "zh_CN", "zh_TW",
  ]);
  assert.equal(manifest.cta.url, "https://houseduck.in/quirky-ball/notices/");
  assert.ok(manifest.supported_compatibility_codes.includes(41));
  for (const locale of Object.values(manifest.locales)) {
    assert.ok(locale.title && locale.body && locale.published_at && locale.cta_label);
  }
});

test("notice page reads the active console notice instead of a static copy", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /functions\/v1\/public-notice/);
  assert.match(html, /id="notice-list"/);
  assert.match(html, /notice-card/);
  assert.match(html, /sort\(\(a, b\).*created_at/s);
  assert.match(html, /id="notice-detail"/);
  assert.match(html, /has\("embed"\)/);
  assert.match(html, /get\("notice"\)/);
  assert.match(html, /String\(notice\.id\).*selectedNoticeId/s);
  assert.match(html, /body\.embedded \.kicker, body\.embedded h1/);
  assert.doesNotMatch(html, /Quirky Ball 1\.1\.1 업데이트/);
});
