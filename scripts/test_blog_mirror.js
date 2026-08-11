#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mirror = require("../assets/blog-mirror.js");

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

const bodyImage = {
  alt: "",
  dataset: {},
  getAttribute(name) { return name === "alt" ? this.alt : null; },
  setAttribute(name, value) { if (name === "alt") this.alt = value; },
  closest() { return { dataset: { alt: "Prototype screen" }, querySelector() { return null; } }; },
};
mirror.recoverImageAltText({ querySelectorAll() { return [bodyImage]; } });
assert.equal(bodyImage.alt, "Prototype screen");

const css = fs.readFileSync(path.join(__dirname, "..", "assets", "blog-mirror.css"), "utf8");
const koreanIndex = fs.readFileSync(path.join(__dirname, "..", "blog", "kr", "index.html"), "utf8");
assert.match(koreanIndex, /class="manifesto-hero mirror-manifesto"/);
assert.match(koreanIndex, /<html lang="ko" data-theme="light"/);
assert.doesNotMatch(koreanIndex, /data-theme-toggle/);
assert.match(koreanIndex, /House Duck(?:'|&#39;)s Blog,/);
assert.match(koreanIndex, /메인 페이지 보러가기/);
assert.match(koreanIndex, /data-preview-type/);
assert.match(koreanIndex, /href="\/terms\/ko\.html">이용약관<\/a>/);
assert.equal((koreanIndex.match(/data-game-preview/g) || []).length, 2);
assert.match(koreanIndex, /만드는 과정을/);
assert.match(css, /\.mirror-post-header h1\s*\{[^}]*font-size:\s*clamp\(1\.85rem,\s*3\.2vw,\s*2\.8rem\)/s);
assert.match(css, /\.mirror-body\s*\{[^}]*font-family:\s*-apple-system[^}]*font-size:\s*clamp\(1rem,\s*1\.1vw,\s*1\.075rem\)/s);
assert.match(css, /\.mirror-body figure[^{}]*\{[^}]*display:\s*block[^}]*width:\s*100%[^}]*margin:\s*2\.2em 0/s);
assert.match(css, /\[data-og-image=""\][^{}]*> a\s*\{[^}]*grid-template-columns:\s*1fr/s);

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
