#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function initialTheme(file, storedTheme) {
  const documentElement = { dataset: { locale: "ko" }, classList: { add() {} } };
  const values = new Map();
  if (storedTheme) values.set("house_duck_theme", storedTheme);
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const document = {
    documentElement,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const matchMedia = () => ({ matches: false });
  const window = {
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
  return documentElement.dataset.theme;
}

for (const file of ["assets/brand-site.js", "tistory-skin/images/script.js"]) {
  assert.equal(initialTheme(file, ""), "dark", `${file} must default to dark mode`);
  assert.equal(initialTheme(file, "light"), "light", `${file} must preserve an explicit light preference`);
}

console.log("default theme behavior: PASS");
