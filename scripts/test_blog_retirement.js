#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const retired = /(?:blog\.houseduck\.in|houseduck\.tistory\.com|(?:\.\.\/|\/)?blog\/(?:kr|en|de|ja)|assets\/blog-feed\.json)/i;
const pages = ["", "about/", "quirky-ball/", "project-k/"]
  .flatMap((prefix) => ["index.html", "index_en.html", "index_de.html", "index_ja.html"].map((file) => prefix + file));

for (const file of [...pages, "assets/brand-site.js", "llms.txt", "server.json"]) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), retired, `${file} must not send visitors or requests to the retired blog`);
}
for (const file of ["assets/blog-feed.json", "assets/blog-translations.json", "sitemap-blog.xml", ".github/workflows/sync-blog.yml"]) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must not republish retired posts`);
}
for (const dir of ["blog", "story"]) {
  if (fs.existsSync(path.join(root, dir))) {
    assert.equal(fs.readdirSync(path.join(root, dir), { recursive: true }).some((file) => file.endsWith(".html")), false, `${dir} must not serve retired content or redirects`);
  }
}
for (const file of pages.slice(0, 4)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /youtube\.com\/@houseduck_in/);
  assert.match(html, /data-youtube-feed/);
  assert.match(html, /community-stats\.js/);
  assert.match(html, /studio-music\.js/);
  assert.match(html, /data-live-version/);
}
for (const file of ["privacy/ko.html", "terms/ko.html", "support/index.html", "impressum/index.html"]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} must retain its existing route`);
}
console.log("Blog retirement: PASS");
