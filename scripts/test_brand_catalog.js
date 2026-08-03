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
  ...projectPages,
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

const storyFacts = {
  ko: [/1998/, /산업디자인/, /3년/, /한국/, /독일/, /House Duck/i],
  en: [/1998/, /industrial design/i, /(?:three|3) years/i, /Korea/i, /Germany/i, /House Duck/i],
  de: [/1998/, /Industriedesign/i, /(?:drei|3) Jahre/i, /Korea/i, /Deutschland/i, /House Duck/i],
  ja: [/1998/, /(?:インダストリアル|工業)デザイン/, /3年間/, /韓国/, /ドイツ/, /House Duck/i]
};

for (const [file, locale] of marketingPages.filter(([name]) => name.startsWith("story/"))) {
  const text = read(file).replace(/<[^>]*>/g, " ");
  for (const fact of storyFacts[locale]) assert.match(text, fact, `${file} founder fact ${fact}`);
}

for (const [file] of marketingPages.filter(([name]) => /^index(?:_[a-z]{2})?\.html$/.test(name))) {
  const html = read(file);
  assert.match(html, /href="[^"]*quirky-ball\//, `${file} Quirky Ball link`);
  assert.match(html, /href="[^"]*project-k\//, `${file} Project K link`);
  assert.match(html, /href="[^"]*story\//, `${file} founder story link`);
}

console.log("brand catalog contract: PASS");
