import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseRss, syncFromXml } from "./blog-sync.mjs";

// Regression: RSS content became active HTML on houseduck.in.
// Found by House Duck full-site QA on 2026-08-09.
const hostileRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><item>
  <title><![CDATA[안전한 제작 기록]]></title>
  <link>https://houseduck.tistory.com/entry/security-probe</link>
  <pubDate>Sun, 09 Aug 2026 08:00:00 +0000</pubDate>
  <description><![CDATA[
    <p onclick=alert(1)>본문 <strong>House Duck</strong></p>
    <a href=javascript:alert(1)>unsafe</a>
    <a href="&#x6a;avascript:alert(2)">encoded</a>
    <img src="https://blog.kakaocdn.net/safe.png" onerror="alert(3)">
    <figure data-ke-type="video"><iframe src="https://www.youtube.com/embed/62oI3qFF7-U" width="333" height="720" allowfullscreen title="Quirky Ball video"></iframe></figure>
    <figure data-ke-type="video"><iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk" width="560" height="315" title="Build log"></iframe></figure>
    <figure data-ke-type="opengraph" data-og-image="https://example.com/preview.png"><a href="https://example.com/build-note">
      <div class="og-image" style="background-image:url(javascript:alert(5))"></div>
      <div class="og-text"><p class="og-title">House Duck</p><p class="og-desc">Build note</p><p class="og-host">houseduck.in</p></div>
    </a></figure>
    <iframe src="https://evil.example/frame"></iframe>
    <iframe src="http://www.youtube.com/embed/httpBlocked1"></iframe>
    <iframe src="//www.youtube.com/embed/protocolBlocked1"></iframe>
    <iframe src="https://www.youtube.com/watch?v=watchBlocked1"></iframe>
    <iframe src="https://www.youtube.com/embed/no"></iframe>
    <object data="https://evil.example/object">object payload</object>
    <embed src="https://evil.example/embed">
    <form action="https://evil.example/collect"><input name="secret"></form>
    <svg><script>alert(4)</script></svg>
  ]]></description>
</item></channel></rss>`;

const [post] = parseRss(hostileRss);
assert.ok(post, "valid RSS item should still be rendered");
assert.match(post.bodyHtml, /<p>본문 <strong>House Duck<\/strong><\/p>/);
assert.match(post.bodyHtml, /<img[^>]+src="https:\/\/blog\.kakaocdn\.net\/safe\.png"[^>]+alt=""/);
assert.match(post.bodyHtml, /<iframe[^>]+src="https:\/\/www\.youtube\.com\/embed\/62oI3qFF7-U"[^>]+class="video-portrait"/);
assert.match(post.bodyHtml, /<iframe[^>]+src="https:\/\/www\.youtube-nocookie\.com\/embed\/abcdefghijk"[^>]+class="video-landscape"/);
assert.match(post.bodyHtml, /data-ke-type="opengraph"[^>]+data-og-image="https:\/\/example\.com\/preview\.png"/);
assert.match(post.bodyHtml, /<a href="https:\/\/example\.com\/build-note">/);
assert.match(post.bodyHtml, /<div class="og-image"><\/div>/);
for (const className of ["og-text", "og-title", "og-desc", "og-host"]) {
  assert.match(post.bodyHtml, new RegExp(`class="${className}"`));
}
assert.doesNotMatch(post.bodyHtml, /background-image|javascript\s*:/i);
assert.doesNotMatch(post.bodyHtml, /evil\.example|httpBlocked|protocolBlocked|watchBlocked|\/embed\/no\b|<script|<style|<object|<embed|<form|<input|<svg/i);
assert.doesNotMatch(post.bodyHtml, /\son[a-z]+\s*=|javascript\s*:/i);

const outputRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-security-"));
try {
  await syncFromXml(hostileRss, { outRoot: outputRoot });
  const koreanIndex = await readFile(path.join(outputRoot, "blog", "kr", "index.html"), "utf8");
  assert.match(koreanIndex, /class="skip-link" href="#blog-content"/);
  assert.match(koreanIndex, /<main[^>]+id="blog-content"/);
  assert.match(koreanIndex, /aria-label="색상 테마 전환"/);
  const koreanPost = await readFile(path.join(outputRoot, "blog", "kr", "security-probe", "index.html"), "utf8");
  assert.match(koreanPost, /<iframe[^>]+62oI3qFF7-U[^>]+class="video-portrait"/);
  assert.match(koreanPost, /<iframe[^>]+abcdefghijk[^>]+class="video-landscape"/);
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

console.log("blog security regressions: PASS");
