#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function themeRun(file, storedTheme, sharedCookie = "") {
  const documentElement = { dataset: { locale: "ko" }, classList: { add() {} } };
  const values = new Map();
  const cookieWrites = [];
  if (storedTheme) values.set("house_duck_theme", storedTheme);
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const document = {
    documentElement,
    body: { id: "" },
    readyState: "complete",
    get cookie() { return sharedCookie; },
    set cookie(value) { cookieWrites.push(String(value)); },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const matchMedia = () => ({ matches: false });
  const window = {
    document,
    localStorage,
    location: { search: "?lang=ko", replace() {} },
    matchMedia,
    addEventListener() {},
  };
  const context = vm.createContext({
    URLSearchParams,
    console,
    document,
    localStorage,
    matchMedia,
    navigator: { languages: ["ko"], language: "ko" },
    window,
  });

  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return { theme: documentElement.dataset.theme, cookieWrites, storedTheme: values.get("house_duck_theme") };
}

for (const file of ["assets/brand-site.js", "assets/blog-mirror.js", "assets/legal-site.js", "tistory-skin/images/script.js"]) {
  assert.equal(themeRun(file, "").theme, "light", `${file} must default to light`);
  const staleDark = themeRun(file, "dark", "house_duck_theme=dark");
  assert.equal(staleDark.theme, "light", `${file} must ignore stale dark preferences`);
  assert.equal(staleDark.storedTheme, "dark", `${file} must not rewrite unrelated stored preferences`);
  assert.deepEqual(staleDark.cookieWrites, [], `${file} must not persist a removed theme control`);
}

console.log("default theme behavior: PASS");
