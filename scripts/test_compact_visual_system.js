#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const studio = fs.readFileSync(path.join(root, "assets", "studio-home.css"), "utf8");
const skin = fs.readFileSync(path.join(root, "tistory-skin", "style.css"), "utf8");
const mirror = fs.readFileSync(path.join(root, "assets", "blog-mirror.css"), "utf8");
const fonts = fs.readFileSync(path.join(root, "assets", "site-fonts.css"), "utf8");
const brand = fs.readFileSync(path.join(root, "assets", "brand-site.css"), "utf8");
const legal = fs.readFileSync(path.join(root, "assets", "legal-site.css"), "utf8");
const projectK = fs.readFileSync(path.join(root, "assets", "project-k-site.css"), "utf8");

assert.match(studio, /--studio-bg:\s*#111315/);
assert.match(studio, /--studio-surface:\s*#1b1d20/);
assert.match(studio, /html\[data-theme="light"\][\s\S]*--studio-bg:\s*#f8f9fa/);
assert.doesNotMatch(studio, /#0d1525|#131f33|#132342/i);
assert.match(studio, /\.studio-intro\s*\{[^}]*align-items:\s*center[^}]*padding-block:\s*clamp\(34px,\s*4vw,\s*52px\)/s);
assert.match(studio, /\.studio-intro h1\s*\{[^}]*font-size:\s*clamp\(2\.1rem,\s*3\.4vw,\s*3rem\)/s);
assert.match(studio, /\.studio-section\s*\{[^}]*padding-block:\s*clamp\(44px,\s*5vw,\s*64px\)/s);
assert.match(studio, /\.project-media\s*\{[^}]*min-height:\s*190px/s);
assert.match(studio, /\.post-preview-copy h3\s*\{[^}]*-webkit-line-clamp:\s*2/s);
assert.match(studio, /\.post-preview-copy p\s*\{[^}]*-webkit-line-clamp:\s*3/s);

for (const css of [skin, mirror]) {
  assert.match(css, /#111315/);
  assert.match(css, /#f8f9fa/);
  assert.doesNotMatch(css, /ui-serif|Georgia|Noto Serif KR/);
}

assert.match(mirror, /\.mirror-header\s*\{[^}]*min-height:\s*64px/s);
assert.match(mirror, /\.mirror-brand img:first-child\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(mirror, /\.mirror-brand img:last-child\s*\{[^}]*width:\s*132px/s);

assert.match(fonts, /font-family:\s*"Montserrat"/);

assert.match(brand, /--cream:\s*#f8f9fa/);
assert.match(brand, /--navy:\s*#202124/);
assert.match(brand, /--section-space:\s*clamp\(52px,\s*6vw,\s*80px\)/);
assert.match(brand, /\.header-inner\s*\{[^}]*min-height:\s*64px/s);
assert.match(brand, /\.brand-lockup > span:not\(\.duck-mark\)\s*\{[^}]*width:\s*132px/s);
assert.match(brand, /\.duck-mark\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(brand, /\.game-hero\s*\{[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(brand, /\.game-title\s*\{[^}]*font-size:\s*clamp\(2\.75rem,\s*5\.2vw,\s*4\.4rem\)/s);
assert.match(brand, /\.feature-card\s*\{[^}]*min-height:\s*280px/s);
assert.match(brand, /\.closing-card h2\s*\{[^}]*font-size:\s*clamp\(1\.85rem,\s*3\.6vw,\s*3rem\)/s);

assert.match(legal, /--legal-cream:\s*#111315/);
assert.match(legal, /--legal-paper:\s*#1b1d20/);
assert.match(legal, /html\[data-theme="light"\][\s\S]*--legal-cream:\s*#f8f9fa/);
assert.match(legal, /\.legal-header-inner\s*\{[^}]*min-height:\s*64px/s);
assert.match(legal, /\.legal-brand > span:last-child\s*\{[^}]*width:\s*132px/s);
assert.match(legal, /\.legal-duck-mark\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(legal, /\.legal-hero h1,[\s\S]*?font-size:\s*clamp\(2rem,\s*4vw,\s*3rem\)/s);
assert.match(legal, /\.legal-paper\s*\{[^}]*padding:\s*clamp\(24px,\s*4vw,\s*40px\)/s);

assert.match(projectK, /--k-void:\s*#111315/);
assert.match(projectK, /\.project-k-header \.brand-duck-image\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(projectK, /\.project-k-header \.brand-wordmark-image\s*\{[^}]*width:\s*132px/s);
assert.match(projectK, /\.project-k-hero\s*\{[^}]*min-height:\s*auto[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(projectK, /\.project-k-title\s*\{[^}]*font-size:\s*clamp\(2\.8rem,\s*5\.3vw,\s*4\.75rem\)/s);
assert.match(projectK, /\.project-k-section\s*\{[^}]*padding-block:\s*clamp\(52px,\s*7vw,\s*88px\)/s);
assert.match(projectK, /\.project-k-loop-card\s*\{[^}]*min-height:\s*220px/s);
for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /class="brand-wordmark-image"[^>]*house-duck-wordmark\.png/);
}

console.log("compact visual system: PASS");
