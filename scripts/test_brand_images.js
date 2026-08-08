#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoDir = path.resolve(__dirname, "..");
const css = ["assets/brand-site.css", "assets/studio-home.css"]
  .map((file) => fs.readFileSync(path.join(repoDir, file), "utf8"))
  .join("\n");
const pages = [
  { file: "index.html", expected: 4, prefix: "quirky-ball/store/" },
  { file: "index_en.html", expected: 4, prefix: "quirky-ball/store/" },
  { file: "quirky-ball/index.html", expected: 9, prefix: "store/" },
  { file: "quirky-ball/index_en.html", expected: 9, prefix: "store/" },
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

for (const page of pages) {
  const pagePath = path.join(repoDir, page.file);
  const html = fs.readFileSync(pagePath, "utf8");
  const tags = html.match(/<img\b[^>]*\bdata-store-asset\b[^>]*>/g) || [];

  if (tags.length !== page.expected) {
    fail(`${page.file} must render ${page.expected} official store assets, found ${tags.length}`);
  }

  const sources = new Set();
  for (const tag of tags) {
    const src = attribute(tag, "src");
    const width = Number(attribute(tag, "width"));
    const height = Number(attribute(tag, "height"));
    if (!src.startsWith(page.prefix)) fail(`${page.file} uses a non-store image: ${src}`);

    const imagePath = path.resolve(path.dirname(pagePath), src);
    if (!fs.existsSync(imagePath)) fail(`${page.file} references missing image: ${src}`);

    const natural = pngSize(imagePath);
    if (width !== natural.width || height !== natural.height) {
      fail(`${page.file} declares ${width}x${height} for ${src}, expected ${natural.width}x${natural.height}`);
    }
    sources.add(src);
  }

  if (page.file.startsWith("quirky-ball/") && sources.size !== page.expected) {
    fail(`${page.file} must show ${page.expected} distinct store assets`);
  }

  if (/src="(?:01_home|02_gameplay|03_hard_mode|04_joker_quip|05_bomb_roulette|06_shop|07_ranking|08_missions)\.png"/.test(html)) {
    fail(`${page.file} still references legacy gallery images`);
  }
}

for (const selector of [".hero-showcase img", ".featured-game-visual img", ".game-logo", ".game-visual img", ".shot img", ".project-phone", ".project-visual-k img"]) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!rule || !/height:\s*auto\s*;/.test(rule[1]) || !/object-fit:\s*contain\s*;/.test(rule[1])) {
    fail(`${selector} must preserve the source ratio with height:auto and object-fit:contain`);
  }
}

console.log("brand image contract: PASS");
