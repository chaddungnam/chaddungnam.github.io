#!/usr/bin/env node
// Owner 2026-10-19: legal documents are English (main version) + Korean only. German and Japanese legal URLs
// stay alive as redirect stubs to the matching English page, because the live Quirky Ball app opens them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(repoDir, file), "utf8");

const dropped = {
  "privacy/de.html": "/privacy/en.html",
  "privacy/ja.html": "/privacy/en.html",
  "terms/de.html": "/terms/en.html",
  "terms/ja.html": "/terms/en.html",
  "quirky-ball/privacy/de.html": "/privacy/en.html",
  "quirky-ball/privacy/ja.html": "/privacy/en.html",
  "quirky-ball/terms/de.html": "/quirky-ball/terms/en.html",
  "quirky-ball/terms/ja.html": "/quirky-ball/terms/en.html",
  "quirky-ball/privacy/delete_de.html": "/quirky-ball/privacy/delete_en.html",
  "quirky-ball/privacy/delete_ja.html": "/quirky-ball/privacy/delete_en.html",
  "quirky-ball/web/privacy/de.html": "/quirky-ball/web/privacy/en.html",
  "quirky-ball/web/privacy/ja.html": "/quirky-ball/web/privacy/en.html",
  "quirky-ball/web/terms/de.html": "/quirky-ball/web/terms/en.html",
  "quirky-ball/web/terms/ja.html": "/quirky-ball/web/terms/en.html",
};

const documents = [
  "privacy/en.html", "privacy/ko.html", "terms/en.html", "terms/ko.html",
  "quirky-ball/terms/en.html", "quirky-ball/terms/ko.html",
  "quirky-ball/privacy/delete_en.html", "quirky-ball/privacy/delete_ko.html",
  "quirky-ball/web/privacy/en.html", "quirky-ball/web/privacy/ko.html",
  "quirky-ball/web/terms/en.html", "quirky-ball/web/terms/ko.html",
  "10key/terms/en.html", "10key/terms/ko.html",
];

// [page, Korean target, English target]
const choosers = [
  ["privacy/index.html", "ko.html", "en.html"],
  ["terms/index.html", "ko.html", "en.html"],
  ["quirky-ball/terms/index.html", "ko.html", "en.html"],
  ["quirky-ball/privacy/index.html", "/privacy/ko.html", "/privacy/en.html"],
  ["quirky-ball/privacy/delete.html", "delete_ko.html", "delete_en.html"],
  ["quirky-ball/web/privacy/index.html", "ko.html", "en.html"],
  ["quirky-ball/web/terms/index.html", "ko.html", "en.html"],
  ["10key/terms/index.html", "ko.html", "en.html"],
  ["10key/privacy/index.html", "/privacy/ko.html#section-13", "/privacy/en.html#section-13"],
];

test("de/ja legal URLs are only redirect stubs to the English page", () => {
  for (const [file, target] of Object.entries(dropped)) {
    const html = read(file);
    assert.ok(html.includes(`http-equiv="refresh" content="0;url=${target}"`), `${file}: meta refresh to ${target}`);
    assert.ok(html.includes(`rel="canonical" href="https://houseduck.in${target}"`), `${file}: canonical ${target}`);
    assert.ok(html.includes(`href="${target}"`), `${file}: plain continue link`);
    assert.ok(html.length < 1200, `${file}: must stay a tiny stub`);
    assert.doesNotMatch(html, /data-legal-content|문서 본문 시작|<h2/, `${file}: no document content`);
    assert.ok(fs.existsSync(path.join(repoDir, target.replace(/^\//, ""))), `${file}: target ${target} exists`);
  }
});

test("en/ko legal documents only switch between English and Korean", () => {
  for (const file of documents) {
    const html = read(file);
    assert.doesNotMatch(html, /href="(?:delete_)?(?:de|ja)\.html"/, `${file}: no de/ja language link`);
    assert.doesNotMatch(html, />(?:DE|JA|Deutsch|日本語)</, `${file}: no de/ja switch label`);
    const other = /(?:^|\/)(?:delete_)?ko\.html$/.test(file) ? file.replace(/ko\.html$/, "en.html") : file.replace(/en\.html$/, "ko.html");
    assert.ok(html.includes(`href="${path.basename(other)}"`), `${file}: keeps the en/ko switch`);
  }
});

function runChooser(file, languages, search = "") {
  const html = read(file);
  const script = html.match(/<script>\n(\/\/ 언어 자동 이동[\s\S]*?)<\/script>/);
  assert.ok(script, `${file}: language chooser script`);
  let target = null;
  const sandbox = {
    navigator: { languages, language: languages[0] },
    location: { search, replace(url) { target = url; } },
  };
  vm.runInNewContext(script[1], sandbox);
  return target;
}

test("legal index pages send Korean browsers to ko and everyone else to English", () => {
  for (const [file, ko, en] of choosers) {
    const html = read(file);
    assert.ok(html.includes(`<noscript><meta http-equiv="refresh" content="0;url=${en}"></noscript>`), `${file}: no-JS falls back to English`);
    assert.ok(html.includes(`href="${en}"`), `${file}: plain English link`);
    assert.doesNotMatch(html, /href="(?:delete_)?(?:de|ja)\.html"|"de"|"ja"/, `${file}: no de/ja choice`);
    assert.equal(runChooser(file, ["ko-KR", "ko", "en-US"]), ko, `${file}: Korean browser`);
    assert.equal(runChooser(file, ["ko"]), ko, `${file}: plain ko`);
    assert.equal(runChooser(file, ["de-DE", "ko-KR", "en"]), ko, `${file}: Korean before English`);
    assert.equal(runChooser(file, ["en-US", "ko-KR"]), en, `${file}: English first`);
    assert.equal(runChooser(file, ["de-DE"]), en, `${file}: German browser gets English`);
    assert.equal(runChooser(file, ["ja-JP"]), en, `${file}: Japanese browser gets English`);
    assert.equal(runChooser(file, ["kok-IN"]), en, `${file}: Konkani is not Korean`);
    assert.equal(runChooser(file, []), en, `${file}: unknown language gets English`);
  }
  for (const file of ["privacy/index.html", "quirky-ball/terms/index.html", "10key/terms/index.html"]) {
    assert.equal(runChooser(file, ["ko-KR"], "?stay=1"), null, `${file}: ?stay=1 keeps the list`);
  }
});

test("sitemap lists no de/ja legal URL and no redirect", () => {
  const sitemap = read("sitemap.xml");
  for (const file of Object.keys(dropped)) {
    assert.ok(!sitemap.includes(`https://houseduck.in/${file}<`), `sitemap must not list ${file}`);
  }
  for (const file of ["privacy/en.html", "privacy/ko.html", "quirky-ball/terms/en.html", "quirky-ball/terms/ko.html", "10key/terms/en.html", "10key/terms/ko.html"]) {
    assert.ok(sitemap.includes(`<loc>https://houseduck.in/${file}</loc>`), `sitemap must list ${file}`);
  }
});
