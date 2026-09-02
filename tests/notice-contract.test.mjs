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

test("embedded notice list is compact white and lets the browser translate the Korean source", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /body\.embedded\s*\{[^}]*background:\s*#fff/s);
  assert.match(html, /body\.embedded \.notice-card\s*\{[^}]*padding:\s*10px 12px/s);
  assert.match(html, /body\.embedded \.notice-card p\s*\{[^}]*-webkit-line-clamp:\s*1/s);
  assert.match(html, /translate\.google\.com\/translate_a\/element\.js/);
  assert.match(html, /googtrans/);
  assert.match(html, /pageLanguage:\s*"ko"/);
  assert.doesNotMatch(html, /\$\{endpoint\}\?lang=/);
  assert.match(html, /id="notice-loading"/);
  assert.match(html, /class="notice-spinner"/);
  assert.match(html, /loadNotices\(language\)/);
  assert.match(html, /body\.embedded\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(html, /scrollbar-color:\s*#d85832\s+#f5e8dc/);
  assert.match(html, /::-webkit-scrollbar-thumb/);
  assert.match(html, /body\.embedded #notice-list\s*\{[^}]*align-content:\s*start[^}]*grid-auto-rows:\s*max-content/s);
});

test("notice loading is English with a one-two-three dot loop and locale fallback data", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /id="notice-loading-text">Loading<\/span>/);
  assert.match(html, /repeat\(loadingDots\)/);
  assert.match(html, /v1\.json/);
  assert.match(html, /localizeKnownNotice/);
});
