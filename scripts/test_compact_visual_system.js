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
assert.match(studio, /\.manifesto-hero\s*\{[^}]*grid-template-columns:/s);
assert.match(studio, /\.manifesto-bubble::after\s*\{[^}]*content:\s*""/s);
assert.doesNotMatch(studio, /\.device-stage::before\s*\{/);
assert.match(studio, /\.history-number\s*\{/);
assert.match(studio, /@keyframes studio-bubble-breathe/);
assert.doesNotMatch(studio, /studio-bubble-float/);
assert.match(studio, /\.manifesto-action\s*\{/);
assert.match(studio, /\.iphone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*19\.5/s);
assert.match(studio, /\.phone-home-indicator\s*\{[^}]*height:\s*4px/s);
assert.match(studio, /\.post-preview-copy h3\s*\{[^}]*-webkit-line-clamp:\s*2/s);
assert.match(studio, /\.post-preview-copy p\s*\{[^}]*-webkit-line-clamp:\s*3/s);
assert.doesNotMatch(studio, /\.post-preview-card\s*\{[^}]*animation:/s);
assert.match(studio, /\.post-preview-card:hover \.post-preview-image,[\s\S]*?scale\(1\.04\)/);
assert.match(skin, /\.post-card:hover \.card-image,[\s\S]*?scale\(1\.04\)/);
assert.match(mirror, /\.mirror-grid article:hover img,[\s\S]*?scale\(1\.04\)/);
assert.doesNotMatch(mirror, /animation-timeline:\s*view\(\)/);

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
assert.match(brand, /\.brand-lockup\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*10px/s);
assert.match(brand, /\.brand-lockup \.brand-wordmark-image\s*\{[^}]*width:\s*132px/s);
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
assert.match(projectK, /\.project-k-hero\s*\{[^}]*min-height:\s*auto[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(projectK, /\.project-k-title\s*\{[^}]*font-size:\s*clamp\(2\.65rem,\s*4vw,\s*3\.45rem\)[^}]*word-break:\s*keep-all/s);
assert.match(projectK, /\.project-k-section\s*\{[^}]*padding-block:\s*clamp\(52px,\s*7vw,\s*88px\)/s);
assert.match(projectK, /\.project-k-loop-card\s*\{[^}]*min-height:\s*220px/s);
for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /class="manifesto-bubble/);
  assert.match(html, /class="manifesto-mark"[^>]*>HD</);
  assert.match(html, /class="manifesto-action"/);
  assert.match(html, /class="quirky-sticker"/);
  assert.match(html, /class="studio-section history-section"[^>]*id="history"/);
  assert.match(html, /class="history-number"[^>]*>02</);
  assert.equal((html.match(/class="history-event"/g) || []).length, 4, `${file} should embed the complete history timeline`);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
  assert.equal((html.match(/data-game-preview/g) || []).length, 2);
}

for (const file of ["about/index.html", "about/index_en.html", "about/index_de.html", "about/index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /id="history"/);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
}

console.log("compact visual system: PASS");
