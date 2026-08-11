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
  return { theme: documentElement.dataset.theme, cookieWrites };
}

for (const file of ["assets/brand-site.js", "assets/blog-mirror.js", "tistory-skin/images/script.js"]) {
  assert.equal(themeRun(file, "").theme, "dark", `${file} must default to dark mode`);
  assert.equal(themeRun(file, "light").theme, "light", `${file} must preserve an explicit light preference`);
  assert.equal(themeRun(file, "dark", "house_duck_theme=light").theme, "light", `${file} must prefer the shared parent-domain cookie`);
  assert.match(themeRun(file, "light").cookieWrites.join("\n"), /house_duck_theme=light;[^\n]*Domain=houseduck\.in/, `${file} must migrate the theme to a shared cookie`);
}

console.log("default theme behavior: PASS");
