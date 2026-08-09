#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");
const projectPages = [
  ["project-k/index.html", "ko"],
  ["project-k/index_en.html", "en"],
  ["project-k/index_de.html", "de"],
  ["project-k/index_ja.html", "ja"]
];
const marketingPages = [
  ["index.html", "ko"],
  ["index_en.html", "en"],
  ["index_de.html", "de"],
  ["index_ja.html", "ja"],
  ["quirky-ball/index.html", "ko"],
  ["quirky-ball/index_en.html", "en"],
  ["quirky-ball/index_de.html", "de"],
  ["quirky-ball/index_ja.html", "ja"],
  ...projectPages
];
const legacyStoryPages = [
  ["story/index.html", "ko"],
  ["story/index_en.html", "en"],
  ["story/index_de.html", "de"],
  ["story/index_ja.html", "ja"]
];

function read(file) {
  const filePath = path.join(repoDir, file);
  assert.ok(fs.existsSync(filePath), `${file} must exist`);
  return fs.readFileSync(filePath, "utf8");
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`));
  return match ? match[1] : "";
}

function pngSize(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

for (const [file, locale] of projectPages) {
  const html = read(file);
  const publicText = html.replace(/<[^>]*>/g, " ");
  assert.match(html, new RegExp(`data-locale="${locale}"`), `${file} locale`);
  assert.match(html, /data-page="project-k"/, `${file} page marker`);
  assert.match(html, /class="language-picker"/, `${file} language picker`);
  assert.match(publicText, /2026[\s\S]{0,80}2027/, `${file} release window`);
  assert.doesNotMatch(publicText, /세로형/, `${file} public copy`);

  const imageTags = (html.match(/<img\b[^>]*data-project-k-asset[^>]*>/g) || []);
  assert.ok(imageTags.length >= 4, `${file} should show at least four real client captures`);
  for (const tag of imageTags) {
    const source = attribute(tag, "src");
    const imagePath = path.resolve(path.dirname(path.join(repoDir, file)), source);
    assert.ok(fs.existsSync(imagePath), `${file}: missing ${source}`);
    assert.deepEqual(pngSize(imagePath), { width: 720, height: 1280 }, `${source} intrinsic size`);
    assert.equal(attribute(tag, "width"), "720", `${source} declared width`);
    assert.equal(attribute(tag, "height"), "1280", `${source} declared height`);
  }
}

for (const [file, locale] of marketingPages) {
  const html = read(file);
  assert.match(html, new RegExp(`data-locale="${locale}"`), `${file} locale`);
  assert.equal((html.match(/data-lang-link=/g) || []).length, 4, `${file} language options`);
  for (const language of ["ko", "en", "de", "ja"]) {
    assert.match(html, new RegExp(`hreflang="${language}"`), `${file} ${language} alternate`);
  }

  const imageTags = html.match(/<img\b[^>]*>/g) || [];
  for (const tag of imageTags) {
    const source = attribute(tag, "src");
    if (!source || /^(?:https?:)?\/\//.test(source)) continue;
    const imagePath = path.resolve(path.dirname(path.join(repoDir, file)), source.split("?")[0]);
    assert.ok(fs.existsSync(imagePath), `${file}: missing ${source}`);
    if (path.extname(imagePath).toLowerCase() !== ".png") continue;
    const natural = pngSize(imagePath);
    const width = Number(attribute(tag, "width"));
    const height = Number(attribute(tag, "height"));
    assert.ok(width > 0 && height > 0, `${file}: ${source} needs declared dimensions`);
    assert.ok(Math.abs(width / height - natural.width / natural.height) < 0.001, `${file}: ${source} declared ratio`);
  }
}

for (const [file] of marketingPages) {
  const html = read(file);
  const blogUrl = /^index(?:_[a-z]{2})?\.html$/.test(file)
    ? "https://blog.houseduck.in/"
    : "https://houseduck.tistory.com/";
  assert.ok(html.includes(`href="${blogUrl}"`), `${file} Blog link`);
  assert.doesNotMatch(html, /href="[^"]*story\//, `${file} must not link to the founder story`);
  assert.doesNotMatch(html, new RegExp(`href="${blogUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*target="_blank"`), `${file} Blog link stays in the same tab`);
}

for (const [file] of marketingPages.filter(([name]) => /^index(?:_[a-z]{2})?\.html$/.test(name))) {
  const html = read(file);
  const publicText = html.replace(/<[^>]*>/g, " ");
  assert.match(html, /href="[^"]*quirky-ball\//, `${file} Quirky Ball link`);
  assert.match(html, /href="[^"]*project-k\//, `${file} Project K link`);
  assert.match(html, /European Restroom Map/, `${file} non-game project`);
  assert.match(html, /assets\/house-duck-logo\.png/, `${file} House Duck PNG logo`);
  assert.match(html, /assets\/house-duck-wordmark\.png/, `${file} House Duck PNG wordmark`);
  assert.match(html, /data-theme-toggle/, `${file} light and dark mode control`);
  assert.match(html, /data-post-tab="latest"/, `${file} latest-post tab`);
  assert.match(html, /data-post-tab="popular"/, `${file} popular-post tab`);
  assert.match(html, /data-post-feed/, `${file} synchronized post feed`);
  assert.match(html, /class="post-preview-image/, `${file} post preview image`);
  assert.match(html, /class="studio-status-panel/, `${file} practical current-status panel`);
  assert.match(html, /class="project-compact-grid/, `${file} compact project grid`);
  assert.match(html, /href="https:\/\/blog\.houseduck\.in\/"/, `${file} custom-domain Blog link`);
  assert.match(html, /<nav class="site-nav"[\s\S]*?>Blog<\/a>/, `${file} primary navigation calls the journal Blog`);
  assert.match(publicText, /02 · Blog/, `${file} Blog section label`);
  assert.doesNotMatch(html, /class="intro-collage|SMALL IDEAS|REAL THINGS/, `${file} must not use the oversized collage hero`);
  assert.doesNotMatch(publicText, /Kronberg|Germany|Deutschland|독일|ドイツ/i, `${file} should not foreground the founder's location`);
}

for (const [file, locale] of legacyStoryPages) {
  const html = read(file);
  assert.match(html, new RegExp(`lang="${locale}"`), `${file} locale`);
  assert.match(html, /data-page="blog-redirect"/, `${file} redirect marker`);
  assert.match(html, /http-equiv="refresh" content="0; url=https:\/\/houseduck\.tistory\.com\/"/, `${file} redirect metadata`);
  assert.match(html, /rel="canonical" href="https:\/\/houseduck\.tistory\.com\/"/, `${file} canonical Blog URL`);
  assert.match(html, /href="https:\/\/houseduck\.tistory\.com\/"/, `${file} accessible continue link`);
  assert.doesNotMatch(html, /story-timeline|story-quote|1998|industrial design|산업디자인|Industriedesign|インダストリアル/, `${file} founder profile removed`);
}

assert.doesNotMatch(read("sitemap.xml"), /https:\/\/houseduck\.in\/story\//, "sitemap must not publish founder-story URLs");

const studioCss = read("assets/studio-home.css");
assert.match(studioCss, /@keyframes studio-grid-shift/, "studio background should have restrained motion");
assert.match(studioCss, /@keyframes studio-status-pulse/, "live build status should visibly breathe");
assert.match(studioCss, /\.post-preview-link/, "synchronized post cards should be fully clickable");
assert.match(studioCss, /prefers-reduced-motion:\s*reduce[\s\S]*animation/, "studio motion must respect reduced-motion settings");

console.log("brand catalog contract: PASS");
