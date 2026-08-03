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

console.log("brand catalog contract: PASS");
