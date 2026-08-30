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
const quirky = fs.readFileSync(path.join(root, "assets", "quirky-ball-site.css"), "utf8");

assert.match(studio, /background:\s*var\(--studio-tone,\s*#f5f4ef\)/);
assert.match(studio, /--studio-blue:\s*#2665ee/);
assert.doesNotMatch(studio, /html\[data-theme="dark"\]/);
assert.doesNotMatch(studio, /#0d1525|#131f33|#132342/i);
assert.match(studio, /\.release-grid\s*\{[^}]*grid-template-columns:/s);
assert.match(studio, /\.hero-phone \.iphone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*20/s);
assert.match(studio, /\.mechanic-stage canvas\s*\{/);
assert.match(studio, /\.project-card\s*\{[^}]*overflow:\s*visible/s);
assert.match(studio, /\.project-phone \.iphone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*20/s);
assert.match(studio, /\.project-phone \.phone-home-indicator\s*\{[^}]*height:\s*4px/s);
assert.match(studio, /\.youtube-grid\s*\{[^}]*repeat\(3,/s);
assert.match(studio, /\.project-k-title,[\s\S]*?font-family:\s*Gungsuh/s);
assert.match(skin, /\.post-card:hover \.card-image,[\s\S]*?scale\(1\.04\)/);
assert.match(mirror, /\.mirror-grid article:hover img,[\s\S]*?scale\(1\.04\)/);
assert.doesNotMatch(mirror, /animation-timeline:\s*view\(\)/);

for (const css of [skin, mirror]) {
  assert.match(css, /color-scheme:\s*light/);
  assert.doesNotMatch(css, /html\[data-theme="dark"\]/);
  assert.doesNotMatch(css, /ui-serif|Georgia|Noto Serif KR/);
}

assert.match(mirror, /\.mirror-header\s*\{[^}]*min-height:\s*60px/s);
assert.match(mirror, /\.mirror-brand img:first-child\s*\{[^}]*width:\s*32px[^}]*height:\s*32px/s);
assert.match(mirror, /\.mirror-brand img:last-child\s*\{[^}]*width:\s*124px/s);

assert.match(fonts, /font-family:\s*"Montserrat"/);

assert.match(brand, /--cream:\s*#f8f9fa/);
assert.match(brand, /--navy:\s*#202124/);
assert.match(brand, /--section-space:\s*clamp\(52px,\s*6vw,\s*80px\)/);
assert.match(brand, /\.header-inner\s*\{[^}]*min-height:\s*64px/s);
assert.match(brand, /\.brand-lockup\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*10px/s);
assert.match(brand, /\.brand-lockup \.brand-wordmark-image\s*\{[^}]*width:\s*132px/s);
assert.match(brand, /\.game-hero\s*\{[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(brand, /\.game-title\s*\{[^}]*font-size:\s*clamp\(2\.75rem,\s*5\.2vw,\s*4\.4rem\)/s);
assert.match(brand, /\.feature-card\s*\{[^}]*min-height:\s*280px/s);
assert.match(brand, /\.closing-card h2\s*\{[^}]*font-size:\s*clamp\(1\.85rem,\s*3\.6vw,\s*3rem\)/s);

assert.match(legal, /--legal-cream:\s*#f8f5ec/);
assert.match(legal, /--legal-paper:\s*#fff/);
assert.doesNotMatch(legal, /html\[data-theme="dark"\]/);
assert.match(legal, /\.legal-header-inner\s*\{[^}]*min-height:\s*64px/s);
assert.match(legal, /\.legal-brand > span:last-child\s*\{[^}]*width:\s*132px/s);
assert.match(legal, /\.legal-duck-mark\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(legal, /\.legal-hero h1,[\s\S]*?font-size:\s*clamp\(2rem,\s*4vw,\s*3rem\)/s);
assert.match(legal, /\.legal-paper\s*\{[^}]*padding:\s*clamp\(24px,\s*4vw,\s*40px\)/s);

assert.match(projectK, /--k-void:\s*#f8f5ec/);
assert.match(projectK, /\.project-k-hero\s*\{[^}]*min-height:\s*auto[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(projectK, /\.project-k-title\s*\{[^}]*font-size:\s*clamp\(2\.65rem,\s*4vw,\s*3\.45rem\)[^}]*word-break:\s*keep-all/s);
assert.match(projectK, /\.project-k-section\s*\{[^}]*padding-block:\s*clamp\(52px,\s*7vw,\s*88px\)/s);
assert.match(projectK, /\.project-k-loop-card\s*\{[^}]*min-height:\s*220px/s);
assert.match(quirky, /--qb-bg:\s*#f8f9fa/);
assert.doesNotMatch(quirky, /html\[data-theme="dark"\]/);
assert.match(quirky, /\.hero-device\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*19\.5/s);
assert.match(quirky, /\.marble-rain\s*\{[^}]*pointer-events:\s*none/s);
assert.match(quirky, /\.shot:nth-child\(2\)[\s\S]*rotateY/s);
assert.match(quirky, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.marble-rain[\s\S]*display:\s*none/s);
for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /data-studio-hero/);
  assert.match(html, /data-quirky-mechanic/);
  assert.match(html, /assets\/red-quirky\.svg/);
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3);
  assert.equal((html.match(/data-project="/g) || []).length, 2);
  assert.doesNotMatch(html, /history-section|journal-section/);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
  assert.equal((html.match(/data-game-preview/g) || []).length, 2);
}

for (const file of ["about/index.html", "about/index_en.html", "about/index_de.html", "about/index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /id="history"/);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
}

console.log("compact visual system: PASS");
