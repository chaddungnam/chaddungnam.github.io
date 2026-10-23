#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const studio = fs.readFileSync(path.join(root, "assets", "studio-home.css"), "utf8");
const fonts = fs.readFileSync(path.join(root, "assets", "site-fonts.css"), "utf8");
const brand = fs.readFileSync(path.join(root, "assets", "brand-site.css"), "utf8");
const legal = fs.readFileSync(path.join(root, "assets", "legal-site.css"), "utf8");
const hexaworld1984 = fs.readFileSync(path.join(root, "assets", "hexaworld1984-site.css"), "utf8");
const quirky = fs.readFileSync(path.join(root, "assets", "quirky-ball-site.css"), "utf8");
const home = fs.readFileSync(path.join(root, "assets", "home.css"), "utf8");
const homeDesk = fs.readFileSync(path.join(root, "assets", "home-desk.css"), "utf8");

assert.match(studio, /background:\s*var\(--studio-tone,\s*#f5f4ef\)/);
// Keep the approved studio palette explicit instead of reverting the refreshed design.
assert.match(studio, /--studio-blue:\s*#335cff/i);
assert.doesNotMatch(studio, /html\[data-theme="dark"\]/);
assert.doesNotMatch(studio, /#0d1525|#131f33|#132342/i);
// assets/studio-home.css now serves quirky-ball/ only: its phone, card and release-grid rules keep that page's proportions.
assert.match(studio, /\.release-grid\s*\{[^}]*grid-template-columns:/s);
assert.match(studio, /\.hero-phone \.iphone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*20/s);
assert.match(studio, /\.project-card\s*\{[^}]*overflow:\s*visible/s);
assert.match(studio, /\.project-phone \.iphone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*20/s);
assert.match(studio, /\.project-phone \.phone-home-indicator\s*\{[^}]*height:\s*4px/s);
assert.match(studio, /\.youtube-grid\s*\{[^}]*repeat\(3,/s);
assert.match(studio, /\.project-phone img\s*\{[^}]*object-fit:\s*contain/s);
// The House Duck home (2026-10-23) has its own sheets. The retired home rules (.studio-hero-tenkey, .project-zone-tenkey,
// .home-farewell, .mechanic-stage canvas) are no longer pinned; these are their counterparts.
assert.doesNotMatch(home + homeDesk, /html\[data-theme="dark"\]|#0d1525|#131f33|#132342/i, "the home keeps its approved night/paper palette without a dark theme switch");
assert.match(home, /--hd-crt:\s*#2a4fc4/i, "the home keeps the CRT blue accent");
assert.match(home, /\.hd-phone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*18/s, "10key Survival: 9:16 footage keeps a phone shell with a slightly shorter ratio");
assert.match(home, /\.hd-phone-video\s*\{[^}]*object-fit:\s*contain/s, "10key Survival footage is letterboxed so the HUD is never cropped");
assert.match(home, /\.hd-lab-grid\s*\{[^}]*repeat\(3,/s, "three equal video cards");
assert.match(home, /\.hd-tenkey\s*\{[^}]*background:/s, "the 10key section paints its own tone");
assert.match(home, /\.hd-farewell\s*\{[^}]*background:\s*var\(--hd-night\)/s, "the quiet Comrade farewell is styled as the night bookend");
assert.match(home, /\.hd-quirky-track\s*\{[^}]*grid-template-columns:/s, "the Quirky Ball stack sits in a two-column track");
assert.ok(Number(homeDesk.match(/\.hd-hero\s*\{[^}]*?\bheight:\s*(\d+)vh/s)?.[1]) >= 150, "the desk hero is a scroll track");
assert.match(homeDesk, /\.hd-desk-canvas\s*\{[^}]*image-rendering:\s*pixelated/s, "the pixel desk is never smoothed");
assert.match(fonts, /font-family:\s*"Montserrat"/);
for (const file of ["Montserrat-Variable.woff2", "DoHyeon-Regular.woff2", "Chilgok_Kaj-subset.woff2"]) {
  assert.ok(fs.statSync(path.join(root, "assets", "fonts", file)).size < 300_000, `${file} must stay web-sized`);
  assert.match(fonts, new RegExp(file.replace(".", "\\.")));
}

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

assert.match(legal, /--legal-cream:\s*#f5f4ef/);
assert.match(legal, /--legal-paper:\s*#fff/);
assert.doesNotMatch(legal, /html\[data-theme="dark"\]/);
assert.match(legal, /\.legal-header-inner\s*\{[^}]*min-height:\s*64px/s);
assert.match(legal, /\.legal-brand > span:last-child\s*\{[^}]*width:\s*132px/s);
assert.match(legal, /\.legal-duck-mark\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s);
assert.match(legal, /\.legal-hero h1,[\s\S]*?font-size:\s*clamp\(2rem,\s*4vw,\s*3\.3rem\)/s);
assert.match(legal, /\.legal-paper\s*\{[^}]*padding:\s*clamp\(24px,\s*4vw,\s*40px\)/s);

assert.match(hexaworld1984, /--hex-void:\s*#e7e9f0/);
assert.match(hexaworld1984, /\.hexaworld1984-hero\s*\{[^}]*min-height:\s*auto[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
assert.match(hexaworld1984, /\.hexaworld1984-title\s*\{[^}]*font-size:\s*clamp\(2\.5rem,\s*4vw,\s*3\.3rem\)[^}]*word-break:\s*keep-all/s);
assert.match(hexaworld1984, /\.hexaworld1984-section\s*\{[^}]*padding-block:\s*clamp\(48px,\s*6vw,\s*72px\)/s);
// Quirky Ball 2.0 reuses the home visual system: no own palette, no dark theme, no extra animation.
assert.doesNotMatch(quirky, /html\[data-theme="dark"\]/);
assert.doesNotMatch(quirky, /#[0-9a-fA-F]{3,8}\b/, "Quirky Ball page colors come from the studio tokens");
assert.doesNotMatch(quirky, /@keyframes|animation:/, "Quirky Ball page adds no motion beyond the home page");
assert.match(studio, /body:is\(\[data-page="studio"\], \[data-page="quirky-ball"\]\)\s*\{/, "home chrome applies to the Quirky Ball page");
for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /class="hd-hero"/);
  assert.match(html, /data-desk /);
  assert.match(html, /<body data-page="studio" data-hd-theme="night">/);
  assert.doesNotMatch(html, /data-studio-hero|studio-hero-tenkey/, "the old studio hero is gone");
  assert.doesNotMatch(html, /data-quirky-mechanic|assets\/red-quirky\.svg/, "the 10key Survival page does not carry the Quirky hero stage or mascot");
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3);
  assert.equal((html.match(/data-project="/g) || []).length, 1, "Quirky Ball is the only project zone; 10key Survival is the data-tenkey section");
  assert.equal((html.match(/ data-tenkey[ >]/g) || []).length, 1);
  assert.doesNotMatch(html, /history-section|journal-section/);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
  assert.equal((html.match(/data-game-preview/g) || []).length, 0, "the Quirky Ball loop plays on the desk CRT; no project video preview is left");
  assert.equal((html.match(/data-hero-gameplay/g) || []).length, 1, "the 10key section plays the 10key Survival loop");
  assert.equal((html.match(/data-shot /g) || []).length, 10, "ten Quirky Ball store screens in the stack");
}

for (const file of ["about/index.html", "about/index_en.html", "about/index_de.html", "about/index_ja.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(html, /id="history"/);
  assert.doesNotMatch(html, /AI를 사용하지만|We use AI|Wir nutzen KI|AIを使いながらも/);
}

console.log("compact visual system: PASS");
