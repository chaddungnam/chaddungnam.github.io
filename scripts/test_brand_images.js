#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoDir = path.resolve(__dirname, "..");
const cssFiles = ["assets/brand-site.css", "assets/studio-home.css", "assets/quirky-ball-site.css"];
for (const file of cssFiles) {
  if (!fs.existsSync(path.join(repoDir, file))) fail(`${file} is missing`);
}
const css = cssFiles
  .map((file) => fs.readFileSync(path.join(repoDir, file), "utf8"))
  .join("\n");
const quirkyCss = fs.readFileSync(path.join(repoDir, "assets/quirky-ball-site.css"), "utf8");
const pages = [
  { file: "quirky-ball/index.html", expected: 4, prefix: "latest/" },
  { file: "quirky-ball/index_en.html", expected: 4, prefix: "latest/" },
  { file: "quirky-ball/index_de.html", expected: 4, prefix: "latest/" },
  { file: "quirky-ball/index_ja.html", expected: 4, prefix: "latest/" },
];

function fail(message) {
  throw new Error(`brand image contract failed: ${message}`);
}

function pngSize(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  if (header.length < 24 || header.toString("ascii", 1, 4) !== "PNG") {
    fail(`${path.relative(repoDir, filePath)} is not a readable PNG`);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]+)"`));
  return match ? match[1] : "";
}

const wordmarkPath = path.join(repoDir, "assets", "house-duck-wordmark.png");
const skinWordmarkPath = path.join(repoDir, "tistory-skin", "images", "house-duck-wordmark.png");
assertWordmark();

function assertWordmark() {
  const size = pngSize(wordmarkPath);
  if (size.width !== 1694 || size.height !== 394) fail(`House Duck wordmark must stay 1694x394, found ${size.width}x${size.height}`);
  if (!fs.readFileSync(wordmarkPath).equals(fs.readFileSync(skinWordmarkPath))) fail("site and Tistory must use the same wordmark PNG");
  if (!fs.existsSync(path.join(repoDir, "assets", "fonts", "Montserrat-Variable.ttf"))) fail("Montserrat source font is missing");
}

for (const page of pages) {
  const pagePath = path.join(repoDir, page.file);
  const html = fs.readFileSync(pagePath, "utf8");
  const tags = html.match(/<img\b[^>]*\bdata-quirky-capture\b[^>]*>/g) || [];

  if (tags.length !== page.expected) {
    fail(`${page.file} must render ${page.expected} official store assets, found ${tags.length}`);
  }

  const sources = new Set();
  for (const tag of tags) {
    const src = attribute(tag, "src");
    const width = Number(attribute(tag, "width"));
    const height = Number(attribute(tag, "height"));
    if (!src.startsWith(page.prefix)) fail(`${page.file} uses a stale capture: ${src}`);

    const imagePath = path.resolve(path.dirname(pagePath), src);
    if (!fs.existsSync(imagePath)) fail(`${page.file} references missing image: ${src}`);

    const natural = pngSize(imagePath);
    if (width !== natural.width || height !== natural.height) {
      fail(`${page.file} declares ${width}x${height} for ${src}, expected ${natural.width}x${natural.height}`);
    }
    sources.add(src);
  }

  if (page.file.startsWith("quirky-ball/") && sources.size !== page.expected) {
    fail(`${page.file} must show ${page.expected} distinct current-build captures`);
  }

  if (/data-store-asset|store\/(?:01-core|02-chain|03-joker|04-breakthrough|05-bomb|06-hard|07-fever|08-ranking)\.png/.test(html)) fail(`${page.file} still references legacy store captures`);
}

for (const selector of [".game-logo"]) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!rule || !/height:\s*auto\s*;/.test(rule[1]) || !/object-fit:\s*contain\s*;/.test(rule[1])) {
    fail(`${selector} must preserve the source ratio with height:auto and object-fit:contain`);
  }
}

const shotRule = quirkyCss.match(/\.shot img\s*\{([^}]*)\}/);
if (!shotRule || !/height:\s*100%\s*;/.test(shotRule[1]) || !/object-fit:\s*cover\s*;/.test(shotRule[1])) {
  fail(".shot img must fill the iPhone display with object-fit:cover");
}

console.log("brand image contract: PASS");
