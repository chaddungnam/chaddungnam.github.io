#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "assets", "brand-site.js"), "utf8");

function run({ locale, languages = ["en-US"], query = "", saved = "" }) {
  let replacement = "";
  const values = new Map(saved ? [["house_duck_site_language", saved]] : []);
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };

  vm.runInNewContext(script, {
    URLSearchParams,
    navigator: { languages, language: languages[0] || "en-US" },
    document: {
      documentElement: { dataset: { locale } },
      addEventListener() {}
    },
    window: {
      localStorage,
      location: {
        search: query,
        replace(target) { replacement = target; }
      }
    }
  });

  return { replacement, saved: values.get("house_duck_site_language") || "" };
}

assert.equal(run({ locale: "ko", languages: ["de-DE"] }).replacement, "index_de.html");
assert.equal(run({ locale: "ko", languages: ["fr-FR", "ja-JP"] }).replacement, "index_ja.html");
assert.equal(run({ locale: "ko", languages: ["fr-FR"] }).replacement, "index_en.html");
assert.equal(run({ locale: "en", saved: "de", languages: ["ko-KR"] }).replacement, "index_de.html");
assert.equal(run({ locale: "de", query: "?lang=ja", saved: "de" }).replacement, "index_ja.html");
assert.equal(run({ locale: "ja", query: "?lang=ja" }).replacement, "");
assert.equal(run({ locale: "ja", query: "?lang=ja" }).saved, "ja");
assert.equal(run({ locale: "ko", languages: ["ko-KR"] }).replacement, "");

console.log("brand language routing: PASS");
