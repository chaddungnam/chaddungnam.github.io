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

test("embedded notice list is compact, balanced, and renders two preview lines", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /body\.embedded\s*\{[^}]*background:\s*#fff/s);
  assert.match(html, /body\.embedded main\s*\{[^}]*padding:\s*8px/s);
  assert.match(html, /body\.embedded #notice-list, body\.embedded #notice-detail\s*\{[^}]*overflow-y:\s*auto[^}]*scrollbar-width:\s*none/s);
  assert.doesNotMatch(html, /scrollbar-gutter:\s*stable/);
  assert.match(html, /body\.embedded #notice-list\s*\{[^}]*padding:\s*0 4px/s);
  assert.match(html, /body\.embedded #notice-detail\s*\{[^}]*padding:\s*4px 4px 12px/s);
  assert.match(html, /body\.embedded \.notice-card\s*\{[^}]*padding:\s*10px 12px/s);
  assert.match(html, /body\.embedded \.notice-card p\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  assert.doesNotMatch(html, /translate\.google\.com\/translate_a\/element\.js/);
  assert.doesNotMatch(html, /google\.translate\.TranslateElement/);
  assert.doesNotMatch(html, /applyGooglePageTranslation/);
  assert.match(html, /noticeEndpoint\.searchParams\.set\("lang"/);
  assert.doesNotMatch(html, /localizeKnownNotice/);
  assert.match(html, /id="notice-loading"/);
  assert.match(html, /class="notice-spinner"/);
  assert.match(html, /loadNotices\(language\)/);
  assert.match(html, /body\.embedded\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(html, /body\.embedded #notice-list::-webkit-scrollbar, body\.embedded #notice-detail::-webkit-scrollbar\s*\{[^}]*display:\s*none[^}]*width:\s*0/s);
  assert.doesNotMatch(html, /::-webkit-scrollbar-thumb/);
  assert.match(html, /body\.embedded #notice-list\s*\{[^}]*align-content:\s*start[^}]*grid-auto-rows:\s*max-content/s);
});

test("notice loading is English with a one-two-three dot loop", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /id="notice-loading-text">Loading<\/span>/);
  assert.match(html, /repeat\(loadingDots\)/);
  assert.doesNotMatch(html, /v1\.json/);
  assert.doesNotMatch(html, /googleTranslateElementInit/);
});

test("notice chrome labels follow the selected locale", async () => {
  const html = await readFile(new URL("../quirky-ball/notices/index.html", import.meta.url), "utf8");
  assert.match(html, /noticeLabels/);
  assert.match(html, /noticeLabels\[nextLanguage\]/);
  assert.match(html, /labels\.back/);
});
