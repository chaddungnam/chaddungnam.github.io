#!/usr/bin/env node
// Owner 2026-10-19: legal documents became English (main version) + Korean. Owner 2026-10-20: German is back on every
// legal page that had it (GDPR: German players get the German text). Japanese legal URLs stay alive as redirect stubs to
// the matching English page, because the live Quirky Ball app opens them. 10KEY Terms exist in English and Korean only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(repoDir, file), "utf8");

const dropped = {
  "privacy/ja.html": "/privacy/en.html",
  "terms/ja.html": "/terms/en.html",
  "quirky-ball/privacy/ja.html": "/privacy/en.html",
  "quirky-ball/terms/ja.html": "/quirky-ball/terms/en.html",
  "quirky-ball/privacy/delete_ja.html": "/quirky-ball/privacy/delete_en.html",
  "quirky-ball/web/privacy/ja.html": "/quirky-ball/web/privacy/en.html",
  "quirky-ball/web/terms/ja.html": "/quirky-ball/web/terms/en.html",
};

// Document families with a German version: [folder/prefix] -> ko, en, de pages.
const families = ["privacy/", "terms/", "quirky-ball/terms/", "quirky-ball/privacy/delete_", "quirky-ball/web/privacy/", "quirky-ball/web/terms/"];
const tenkeyDocuments = ["10key/terms/en.html", "10key/terms/ko.html"];

// [page, Korean target, English target, German target or null]
const choosers = [
  ["privacy/index.html", "ko.html", "en.html", "de.html"],
  ["terms/index.html", "ko.html", "en.html", "de.html"],
  ["quirky-ball/terms/index.html", "ko.html", "en.html", "de.html"],
  ["quirky-ball/privacy/index.html", "/privacy/ko.html", "/privacy/en.html", "/privacy/de.html"],
  ["quirky-ball/privacy/delete.html", "delete_ko.html", "delete_en.html", "delete_de.html"],
  ["quirky-ball/web/privacy/index.html", "ko.html", "en.html", "de.html"],
  ["quirky-ball/web/terms/index.html", "ko.html", "en.html", "de.html"],
  ["10key/terms/index.html", "ko.html", "en.html", null],
  ["10key/privacy/index.html", "/privacy/ko.html#section-13", "/privacy/en.html#section-13", "/privacy/de.html#section-13"],
];

test("ja legal URLs are only redirect stubs to the English page", () => {
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

test("German legal documents are full documents again", () => {
  for (const family of families) {
    const html = read(`${family}de.html`);
    assert.match(html, /<html lang="de"/, `${family}de.html: German page`);
    assert.doesNotMatch(html, /http-equiv="refresh"/, `${family}de.html: not a redirect`);
    if (family !== "terms/") assert.ok(html.includes("data-legal-content"), `${family}de.html: document body`);
  }
  assert.ok(read("quirky-ball/privacy/de.html").includes('content="0;url=/privacy/de.html"'), "legacy Quirky Ball de privacy URL opens the German shared policy");
});

test("legal documents switch between Korean, English and German, never Japanese", () => {
  for (const family of families) {
    const base = family.endsWith("/") ? "" : path.basename(family);
    for (const locale of ["ko", "en", "de"]) {
      const file = `${family}${locale}.html`;
      const html = read(file);
      for (const other of ["ko", "en", "de"]) assert.ok(html.includes(`href="${base}${other}.html"`), `${file}: links ${other}`);
      assert.doesNotMatch(html, /href="(?:delete_)?ja\.html"/, `${file}: no ja language link`);
      assert.doesNotMatch(html, />(?:JA|日本語)</, `${file}: no ja switch label`);
    }
  }
  for (const file of tenkeyDocuments) {
    const html = read(file);
    assert.doesNotMatch(html, /href="(?:de|ja)\.html"/, `${file}: no de/ja language link`);
    assert.doesNotMatch(html, />(?:DE|JA|Deutsch|日本語)</, `${file}: no de/ja switch label`);
    const other = file.endsWith("ko.html") ? "en.html" : "ko.html";
    assert.ok(html.includes(`href="${other}"`), `${file}: keeps the en/ko switch`);
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

test("legal index pages send ko and de browsers to their language and everyone else to English", () => {
  for (const [file, ko, en, de] of choosers) {
    const html = read(file);
    const german = de || en;
    assert.ok(html.includes(`<noscript><meta http-equiv="refresh" content="0;url=${en}"></noscript>`), `${file}: no-JS falls back to English`);
    assert.ok(html.includes(`href="${en}"`), `${file}: plain English link`);
    if (de) assert.ok(html.includes(`href="${de}"`), `${file}: plain German link`);
    else assert.doesNotMatch(html, /href="de\.html"|"de"/, `${file}: no German choice`);
    assert.doesNotMatch(html, /href="(?:delete_)?ja\.html"|"ja"/, `${file}: no ja choice`);
    assert.equal(runChooser(file, ["ko-KR", "ko", "en-US"]), ko, `${file}: Korean browser`);
    assert.equal(runChooser(file, ["ko"]), ko, `${file}: plain ko`);
    assert.equal(runChooser(file, ["de-DE", "ko-KR", "en"]), de || ko, `${file}: German first`);
    assert.equal(runChooser(file, ["de-DE"]), german, `${file}: German browser`);
    assert.equal(runChooser(file, ["de_AT", "en"]), german, `${file}: Austrian German`);
    assert.equal(runChooser(file, ["en-US", "de-DE", "ko-KR"]), en, `${file}: English first`);
    assert.equal(runChooser(file, ["ja-JP"]), en, `${file}: Japanese browser gets English`);
    assert.equal(runChooser(file, ["ja-JP", "de-DE"]), german, `${file}: Japanese then German`);
    assert.equal(runChooser(file, ["kok-IN"]), en, `${file}: Konkani is not Korean`);
    assert.equal(runChooser(file, ["dev"]), en, `${file}: dev is not German`);
    assert.equal(runChooser(file, []), en, `${file}: unknown language gets English`);
  }
  for (const file of ["privacy/index.html", "quirky-ball/terms/index.html", "quirky-ball/privacy/delete.html", "10key/terms/index.html"]) {
    assert.equal(runChooser(file, ["de-DE"], "?stay=1"), null, `${file}: ?stay=1 keeps the list`);
  }
});

test("sitemap lists the German legal documents and no ja redirect", () => {
  const sitemap = read("sitemap.xml");
  for (const file of Object.keys(dropped)) {
    assert.ok(!sitemap.includes(`https://houseduck.in/${file}<`), `sitemap must not list ${file}`);
  }
  for (const file of ["privacy/en.html", "privacy/ko.html", "privacy/de.html", "quirky-ball/terms/en.html", "quirky-ball/terms/ko.html",
    "quirky-ball/terms/de.html", "quirky-ball/web/terms/de.html", "quirky-ball/web/privacy/de.html", "10key/terms/en.html", "10key/terms/ko.html"]) {
    assert.ok(sitemap.includes(`<loc>https://houseduck.in/${file}</loc>`), `sitemap must list ${file}`);
  }
});
