#!/usr/bin/env node

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoDir = path.join(__dirname, "..");
const brandScript = fs.readFileSync(path.join(repoDir, "assets", "brand-site.js"), "utf8");

const productPages = [
  "quirky-ball/index.html",
  "quirky-ball/index_en.html",
  "quirky-ball/index_de.html",
  "quirky-ball/index_ja.html",
  "project-k/index.html",
  "project-k/index_en.html",
  "project-k/index_de.html",
  "project-k/index_ja.html",
];
const nonKoreanMarketingPages = [
  "index_en.html",
  "index_de.html",
  "index_ja.html",
  "quirky-ball/index_en.html",
  "quirky-ball/index_de.html",
  "quirky-ball/index_ja.html",
  "project-k/index_en.html",
  "project-k/index_de.html",
  "project-k/index_ja.html",
];

function read(file) {
  return fs.readFileSync(path.join(repoDir, file), "utf8");
}

function cssDeclarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule must exist`);
  return Object.fromEntries(match[1].split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf(":");
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
  }));
}

function makeElement({ dataset = {}, attributes = {}, hidden = false } = {}) {
  const listeners = new Map();
  const classes = new Set();
  const element = {
    dataset: { ...dataset },
    attributes: { ...attributes },
    hidden,
    focused: false,
    tabIndex: attributes.tabindex === undefined ? 0 : Number(attributes.tabindex),
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "tabindex") this.tabIndex = Number(value);
    },
    getAttribute(name) { return this.attributes[name] || null; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener.call(this, event);
    },
    focus() { this.focused = true; },
    querySelectorAll() { return []; },
  };
  return element;
}

function runBrandSite({ locale = "en", menuButton, nav } = {}) {
  const root = makeElement({ dataset: { locale } });
  const metaTheme = { content: "" };
  const documentListeners = new Map();
  const document = {
    documentElement: root,
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') return metaTheme;
      if (selector === "[data-post-feed]") return null;
      if (selector === "[data-site-nav]") return nav || null;
      if (selector === "[data-menu-button]") return menuButton || null;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of documentListeners.get(type) || []) listener(event);
    },
  };
  const storage = new Map();
  const window = {
    document,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
    location: { search: "", replace() {} },
    addEventListener() {},
    innerWidth: 390,
  };

  vm.runInNewContext(brandScript, {
    URL,
    URLSearchParams,
    console,
    document,
    module: { exports: {} },
    navigator: { languages: [`${locale}-${locale.toUpperCase()}`], language: locale },
    window,
  });
  document.dispatch("DOMContentLoaded");
  return { document, root, metaTheme };
}

test("product navigation stays on the localized House Duck Blog route and returns to #games", () => {
  for (const file of productPages) {
    const html = read(file);
    const locale = file.match(/index_(en|de|ja)\.html$/)?.[1];
    const blogHref = locale ? `../blog/${locale}/` : "https://blog.houseduck.in/";
    assert.doesNotMatch(html, /https:\/\/houseduck\.tistory\.com\//, `${file} must not use the retired Blog host`);
    assert.ok(html.includes(`href="${blogHref}"`), `${file} must link to its localized Blog route`);
  }
  for (const file of productPages.filter((file) => file.startsWith("project-k/"))) {
    const html = read(file);
    assert.match(html, /#games/, `${file} must return directly to the game previews`);
    assert.doesNotMatch(html, /#projects/, `${file} must not target the retired catalog`);
  }
});

test("home leads with the studio slogan, YouTube, and exactly two game previews", () => {
  for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
    const html = read(file);
    assert.match(html, /data-studio-hero/);
    assert.match(html, /Made in Germany/);
    assert.match(html, /from South Korea/);
    assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} YouTube cards`);
    assert.equal((html.match(/data-project="/g) || []).length, 2, `${file} projects`);
    assert.equal((html.match(/data-game-preview/g) || []).length, 2, `${file} game previews`);
    assert.doesNotMatch(html, /European Restroom Map|project-compact-grid|PROJECT_CATALOG|history-section|journal-section/);
  }

  const brandCss = read("assets/brand-site.css");
  assert.doesNotMatch(brandCss, /\.js-ready\s+\.reveal\s*\{[^}]*opacity:\s*0/s, "JavaScript must not hide authored content");
});

test("home footer exposes the business inquiry address", () => {
  for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
    const html = read(file);
    assert.match(html, /href="mailto:business@houseduck\.in"/);
    assert.ok(html.includes("business@houseduck.in"), `${file} must show the business address`);
  }
});

test("brand controls keep localized mobile-menu labels", () => {
  const labels = {
    ko: { open: "메뉴 열기", close: "메뉴 닫기" },
    en: { open: "Open menu", close: "Close menu" },
    de: { open: "Menü öffnen", close: "Menü schließen" },
    ja: { open: "メニューを開く", close: "メニューを閉じる" },
  };

  for (const [locale, copy] of Object.entries(labels)) {
    const menuButton = makeElement({ attributes: { "aria-expanded": "false", "aria-label": copy.open } });
    const nav = makeElement();
    const runtime = runBrandSite({ locale, menuButton, nav });

    menuButton.dispatch("click");
    assert.equal(menuButton.getAttribute("aria-label"), copy.close, `${locale} open-menu label`);
    runtime.document.dispatch("keydown", { key: "Escape" });
    assert.equal(menuButton.getAttribute("aria-label"), copy.open, `${locale} closed-menu label`);
    assert.equal(menuButton.focused, true, `${locale} Escape returns focus to the menu button`);
  }
});

test("Support offers a direct English section to EN, DE, and JA readers", () => {
  const support = read("support/index.html");
  assert.match(support, /href="#korean"/, "Support language navigation needs a Korean target");
  assert.match(support, /href="#english"/, "Support language navigation needs an English target");
  assert.match(support, /id="korean"[^>]*lang="ko"/, "Support needs a Korean-language section");
  assert.match(support, /id="english"[^>]*lang="en"/, "Support needs an English-language section");
  assert.match(support, /Contact email/i, "English support must expose the contact route");
  assert.match(support, /Delete (?:my|your) account/i, "English support must explain account deletion");

  for (const file of nonKoreanMarketingPages) {
    const html = read(file);
    assert.match(html, /href="(?:\.\.\/)?support\/#english"/, `${file} must route non-Korean readers to English support`);
    assert.doesNotMatch(html, /href="(?:\.\.\/)?support\/"/, `${file} must not drop non-Korean readers on Korean-only support`);
  }
});

test("the common Terms route asks readers to choose a project", () => {
  const localized = [
    ["terms/ko.html", /프로젝트를 선택하세요/, /href="\.\.\/quirky-ball\/terms\/ko\.html"/],
    ["terms/en.html", /Choose a project/, /href="\.\.\/quirky-ball\/terms\/en\.html"/],
    ["terms/de.html", /Projekt auswählen/, /href="\.\.\/quirky-ball\/terms\/de\.html"/],
    ["terms/ja.html", /プロジェクトを選択/, /href="\.\.\/quirky-ball\/terms\/ja\.html"/],
  ];
  for (const [file, heading, projectLink] of localized) {
    const html = read(file);
    assert.match(html, heading, `${file} needs a localized project choice`);
    assert.match(html, projectLink, `${file} needs the Quirky Ball terms choice`);
    assert.doesNotMatch(html, /http-equiv="refresh"/i, `${file} must not skip project choice`);
  }
  assert.match(read("index.html"), /href="terms\/ko\.html"[^>]*>이용약관<\/a>/, "House Duck footer must use the project selector");
  assert.doesNotMatch(read("index.html"), />Quirky Ball 이용약관</, "House Duck footer must not expose one game's terms");
});

test("public UI CSS preserves contrast, brand visibility, and mobile readability", () => {
  const brandCss = read("assets/brand-site.css");
  const studioCss = read("assets/studio-home.css");
  const brandMark = cssDeclarations(brandCss, ".brand-lockup");
  const duckMark = cssDeclarations(brandCss, ".brand-lockup .brand-duck-image");
  const wordmark = cssDeclarations(brandCss, ".brand-lockup .brand-wordmark-image");

  assert.equal(brandMark.display, "inline-flex", "public headers must show the complete brand lockup");
  assert.ok(parseFloat(duckMark.width) >= 34, "the duck mark must remain legible");
  assert.equal(wordmark.width, "132px", "the House Duck wordmark must remain visible beside the duck");
  assert.equal(cssDeclarations(studioCss, ".project-card").overflow, "visible", "phone tops must not be clipped by project cards");
  assert.match(studioCss, /^\.project-media\s*\{[^}]*overflow:\s*visible/m, "phone tops must not be clipped by media stages");
});

test("pre-launch terms describe the effective date and business status as pending", () => {
  const expectations = [
    ["quirky-ball/terms/ko.html", /시행 예정일:\s*2026년 8월 24일/, /영업하는 개인사업자/],
    ["quirky-ball/terms/en.html", /Scheduled effective date:\s*August 24, 2026/i, /sole proprietor/i],
    ["quirky-ball/terms/de.html", /Voraussichtliches Inkrafttreten:\s*24\. August 2026/i, /Einzelunternehmer/i],
    ["quirky-ball/terms/ja.html", /施行予定日:\s*2026年8月24日/, /個人事業主/],
  ];
  for (const [file, pendingDate, settledBusiness] of expectations) {
    const html = read(file);
    assert.match(html, pendingDate, `${file} must label the future date as scheduled`);
    assert.doesNotMatch(html, settledBusiness, `${file} must not present unconfirmed business status as settled`);
  }
});
