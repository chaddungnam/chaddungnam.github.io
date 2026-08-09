#!/usr/bin/env node

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoDir = path.join(__dirname, "..");
const brandScript = fs.readFileSync(path.join(repoDir, "assets", "brand-site.js"), "utf8");

const homePages = ["index.html", "index_en.html", "index_de.html", "index_ja.html"];
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

function htmlTag(html, tagName, attributeName, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}="${escaped}"[^>]*>`, "i"));
  assert.ok(match, `${tagName}[${attributeName}="${value}"] must exist`);
  return match[0];
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function hasBooleanAttribute(tag, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|>|=)`, "i").test(tag);
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

function runBrandSite({ locale = "en", themeButton, menuButton, nav, tabs = [], panels = [] } = {}) {
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
    querySelectorAll(selector) {
      if (selector === "[data-theme-toggle]") return themeButton ? [themeButton] : [];
      if (selector === "[data-post-tab]") return tabs;
      if (selector === "[data-post-panel]") return panels;
      return [];
    },
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

test("product navigation stays on the House Duck Blog domain and returns to #projects", () => {
  for (const file of productPages) {
    const html = read(file);
    assert.doesNotMatch(html, /https:\/\/houseduck\.tistory\.com\//, `${file} must not use the retired Blog host`);
    assert.match(html, /href="https:\/\/blog\.houseduck\.in\/"/, `${file} must link to the custom Blog domain`);
  }
  for (const file of productPages.filter((file) => file.startsWith("project-k/"))) {
    const html = read(file);
    assert.doesNotMatch(html, /#games/, `${file} must not target the missing #games anchor`);
    assert.match(html, /#projects/, `${file} must return directly to the project catalog`);
  }
});

test("home Blog tabs expose complete ARIA relationships while Popular stays unavailable", () => {
  for (const file of homePages) {
    const html = read(file);
    const latestTab = htmlTag(html, "button", "data-post-tab", "latest");
    const popularTab = htmlTag(html, "button", "data-post-tab", "popular");
    const latestPanel = htmlTag(html, "div", "data-post-panel", "latest");
    const popularPanel = htmlTag(html, "div", "data-post-panel", "popular");

    assert.equal(attribute(latestTab, "id"), "post-tab-latest", `${file} latest tab id`);
    assert.equal(attribute(latestTab, "aria-controls"), "post-panel-latest", `${file} latest tab controls`);
    assert.equal(attribute(latestTab, "tabindex"), "0", `${file} latest tab keyboard entry`);
    assert.equal(attribute(popularTab, "id"), "post-tab-popular", `${file} popular tab id`);
    assert.equal(attribute(popularTab, "aria-controls"), "post-panel-popular", `${file} popular tab controls`);
    assert.equal(attribute(popularTab, "tabindex"), "-1", `${file} unavailable tab stays out of keyboard order`);
    assert.ok(hasBooleanAttribute(popularTab, "hidden"), `${file} Popular must remain hidden until useful`);
    assert.equal(attribute(latestPanel, "id"), "post-panel-latest", `${file} latest panel id`);
    assert.equal(attribute(latestPanel, "aria-labelledby"), "post-tab-latest", `${file} latest panel label`);
    assert.equal(attribute(latestPanel, "tabindex"), "0", `${file} latest panel keyboard entry`);
    assert.equal(attribute(popularPanel, "id"), "post-panel-popular", `${file} popular panel id`);
    assert.equal(attribute(popularPanel, "aria-labelledby"), "post-tab-popular", `${file} popular panel label`);
    assert.equal(attribute(popularPanel, "tabindex"), "0", `${file} popular panel keyboard entry when enabled`);
    assert.ok(hasBooleanAttribute(popularPanel, "hidden"), `${file} Popular panel remains unavailable`);
  }
});

test("brand controls keep localized theme and mobile-menu labels", () => {
  const labels = {
    ko: { open: "메뉴 열기", close: "메뉴 닫기", light: "라이트 모드로 전환", dark: "다크 모드로 전환" },
    en: { open: "Open menu", close: "Close menu", light: "Switch to light mode", dark: "Switch to dark mode" },
    de: { open: "Menü öffnen", close: "Menü schließen", light: "Zum hellen Modus wechseln", dark: "Zum dunklen Modus wechseln" },
    ja: { open: "メニューを開く", close: "メニューを閉じる", light: "ライトモードに切り替え", dark: "ダークモードに切り替え" },
  };

  for (const [locale, copy] of Object.entries(labels)) {
    const themeButton = makeElement();
    const menuButton = makeElement({ attributes: { "aria-expanded": "false", "aria-label": copy.open } });
    const nav = makeElement();
    const runtime = runBrandSite({ locale, themeButton, menuButton, nav });

    assert.equal(themeButton.getAttribute("aria-label"), copy.light, `${locale} initial theme label`);
    themeButton.dispatch("click");
    assert.equal(themeButton.getAttribute("aria-label"), copy.dark, `${locale} toggled theme label`);

    menuButton.dispatch("click");
    assert.equal(menuButton.getAttribute("aria-label"), copy.close, `${locale} open-menu label`);
    runtime.document.dispatch("keydown", { key: "Escape" });
    assert.equal(menuButton.getAttribute("aria-label"), copy.open, `${locale} closed-menu label`);
    assert.equal(menuButton.focused, true, `${locale} Escape returns focus to the menu button`);
  }
});

test("home tabs support arrows plus Home and End with automatic activation", () => {
  const tabs = ["latest", "popular", "archive"].map((name, index) => makeElement({
    dataset: { postTab: name },
    attributes: { "aria-selected": String(index === 0), tabindex: String(index === 0 ? 0 : -1) },
  }));
  const panels = ["latest", "popular", "archive"].map((name, index) => makeElement({
    dataset: { postPanel: name },
    hidden: index !== 0,
  }));
  runBrandSite({ locale: "en", tabs, panels });

  let prevented = false;
  tabs[0].dispatch("keydown", { key: "ArrowRight", preventDefault() { prevented = true; } });
  assert.equal(prevented, true, "ArrowRight prevents page scrolling");
  assert.equal(tabs[1].focused, true, "ArrowRight focuses the next tab");
  assert.equal(tabs[1].getAttribute("aria-selected"), "true", "ArrowRight activates the next tab");
  assert.equal(panels[1].hidden, false, "ArrowRight reveals the linked panel");

  tabs[1].dispatch("keydown", { key: "End", preventDefault() {} });
  assert.equal(tabs[2].getAttribute("aria-selected"), "true", "End activates the final tab");
  tabs[2].dispatch("keydown", { key: "Home", preventDefault() {} });
  assert.equal(tabs[0].getAttribute("aria-selected"), "true", "Home activates the first tab");
  tabs[0].dispatch("keydown", { key: "ArrowLeft", preventDefault() {} });
  assert.equal(tabs[2].getAttribute("aria-selected"), "true", "ArrowLeft wraps to the final tab");
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

test("the common Terms route delegates to the branded Quirky Ball terms shell", () => {
  const html = read("terms/index.html");
  assert.match(html, /http-equiv="refresh" content="0;url=\.\.\/quirky-ball\/terms\/"/i);
  assert.match(html, /rel="canonical" href="https:\/\/houseduck\.in\/quirky-ball\/terms\/"/i);
  assert.match(html, /href="\.\.\/quirky-ball\/terms\/"/i, "redirect needs an accessible fallback link");
  assert.doesNotMatch(html, /<style>/i, "common Terms must not retain a separate one-off visual shell");
});

test("public UI CSS preserves contrast, brand visibility, and mobile readability", () => {
  const brandCss = read("assets/brand-site.css");
  const projectKCss = read("assets/project-k-site.css");
  const journalLink = cssDeclarations(brandCss, 'body[data-page="studio"] .journal-toolbar .text-link');
  const projectWordmark = cssDeclarations(projectKCss, ".project-k-header .brand-wordmark-image");
  const themeToggle = cssDeclarations(brandCss, 'body[data-page="studio"] .theme-toggle');
  const postTab = cssDeclarations(brandCss, 'body[data-page="studio"] .post-tab');
  const projectCopy = cssDeclarations(brandCss, 'body[data-page="studio"] .project-copy p');
  const projectLink = cssDeclarations(brandCss, 'body[data-page="studio"] .project-copy .text-link');
  const postCopy = cssDeclarations(brandCss, 'body[data-page="studio"] .post-preview-copy p');

  assert.equal(journalLink.color, "var(--studio-ink)", "Blog CTA must follow the active theme ink color");
  assert.equal(projectWordmark.filter, "brightness(0) invert(1)", "Project K needs a light wordmark on its dark header");
  assert.ok(parseFloat(themeToggle.height) >= 44, "theme control needs a 44px touch target");
  assert.ok(parseFloat(postTab["min-height"]) >= 44, "post tabs need a 44px touch target");
  assert.ok(parseFloat(projectCopy["font-size"]) >= 0.9375, "project descriptions need readable mobile type");
  assert.ok(parseFloat(projectLink["font-size"]) >= 0.875, "project links need readable mobile type");
  assert.ok(parseFloat(postCopy["font-size"]) >= 0.9, "Blog summaries need readable mobile type");

  for (const file of ["project-k/index.html", "project-k/index_en.html", "project-k/index_de.html", "project-k/index_ja.html"]) {
    const html = read(file);
    assert.match(html, /assets\/house-duck-logo\.png/, `${file} needs the real duck PNG`);
    assert.match(html, /assets\/house-duck-wordmark\.png/, `${file} needs the PNG wordmark`);
    assert.doesNotMatch(html, /class="duck-mark"/, `${file} must not use the placeholder logo`);
  }
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
