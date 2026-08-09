#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mirror = require("../assets/blog-mirror.js");

assert.equal(mirror.resolveTheme("light"), "light");
assert.equal(mirror.resolveTheme("dark"), "dark");
assert.equal(mirror.resolveTheme("invalid"), "dark");

let previewImage;
const imageSlot = { tagName: "DIV", replaceWith(node) { previewImage = node; } };
const card = { dataset: { ogImage: "https://example.com/preview.png" }, querySelector() { return imageSlot; } };
mirror.hydrateOpenGraphImages({
  querySelectorAll() { return [card]; },
  createElement() { return {}; },
});
assert.deepEqual(previewImage, {
  alt: "",
  className: "og-image",
  loading: "lazy",
  src: "https://example.com/preview.png",
});

const css = fs.readFileSync(path.join(__dirname, "..", "assets", "blog-mirror.css"), "utf8");
assert.match(css, /\.mirror-post-header h1\s*\{[^}]*font-size:\s*clamp\(2\.1rem,\s*4vw,\s*3\.6rem\)/s);

for (const locale of ["en", "de", "ja"]) {
  const localeRoot = path.join(__dirname, "..", "blog", locale);
  for (const entry of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = fs.readFileSync(path.join(localeRoot, entry.name, "index.html"), "utf8");
    const source = fs.readFileSync(path.join(__dirname, "..", "blog", "kr", entry.name, "index.html"), "utf8");
    assert.doesNotMatch(page, /[가-힣]/u, `${locale} article must not contain Korean fallback text`);
    for (const tag of ["p", "h2", "h3", "figure", "iframe", "img"]) {
      assert.equal(
        page.match(new RegExp(`<${tag}\\b`, "g"))?.length ?? 0,
        source.match(new RegExp(`<${tag}\\b`, "g"))?.length ?? 0,
        `${locale} article must preserve every ${tag} block`,
      );
    }
  }
}

console.log("blog mirror behavior: PASS");
