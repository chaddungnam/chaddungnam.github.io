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
  "hexaworld1984/index_ko.html",
  "hexaworld1984/index_en.html",
  "hexaworld1984/index_de.html",
  "hexaworld1984/index_ja.html",
];
const englishSupportPages = [
  "index_en.html",
  "index_ja.html",
  "about/index_en.html",
  "about/index_ja.html",
  "quirky-ball/index_en.html",
  "quirky-ball/index_ja.html",
  "quirky-ball/terms/en.html",
  "hexaworld1984/index_en.html",
  "hexaworld1984/index_ja.html",
];
const germanSupportPages = [
  "index_de.html",
  "about/index_de.html",
  "quirky-ball/index_de.html",
  "quirky-ball/terms/de.html",
  "hexaworld1984/index_de.html",
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

test("product navigation keeps the remaining game and support routes", () => {
  for (const file of productPages) {
    const html = read(file);
    assert.doesNotMatch(html, /blog\.houseduck\.in|blog\/(?:en|de|ja)?\/?|houseduck\.tistory\.com/, file + " must not expose retired blog routes");
    assert.match(html, /href="[^"]*(?:index(?:_(?:en|de|ja))?\.html\?lang=|support\/)/, file + " must retain a first-party route");
  }
  for (const file of productPages.filter((file) => file.startsWith("hexaworld1984/"))) {
    const html = read(file);
    assert.match(html, /#games/, file + " must return directly to the game previews");
    assert.doesNotMatch(html, /#projects/, file + " must not target the retired catalog");
  }
});

test("home leads with 10key Survival, then Quirky Ball with its store buttons, the Comrade farewell, and YouTube", () => {
  for (const file of ["index.html", "index_en.html", "index_de.html", "index_ja.html"]) {
    const html = read(file);
    const hero = html.match(/<section class="hd-hero"[\s\S]*?<\/section>/)[0];
    const tenkey = html.match(/<section class="hd-tenkey"[\s\S]*?<\/section>/)[0];
    const quirky = html.match(/<section class="hd-quirky"[\s\S]*?<\/section>/)[0];
    const farewell = html.match(/<section class="hd-farewell home-farewell"[\s\S]*?<\/section>/)[0];
    assert.match(hero, /data-desk /, `${file} hero is the pixel desk`);
    assert.doesNotMatch(html, /data-studio-hero|class="section-rail"|class="(?:hero-hook|studio-signature)"/);
    assert.match(hero, /id="studio-title"/, `${file} hero title`);
    assert.doesNotMatch(hero, /Quirky|google-play-badge|app-store-badge|data-playable/, `${file} hero is the desk scene only, without Quirky Ball text or store badges`);
    assert.doesNotMatch(tenkey, /Quirky|google-play-badge|app-store-badge|data-playable/, `${file} 10key Survival section has no Quirky Ball and no store badges before its release`);
    assert.match(quirky, /<a class="store-button google-play-badge" href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.quirkyball\.app"/, `${file} Quirky Ball section keeps the Google Play button`);
    assert.match(quirky, /<a class="store-button app-store-badge" href="https:\/\/apps\.apple\.com\/app\/id6797996754"/, `${file} Quirky Ball section keeps the App Store button`);
    assert.doesNotMatch(quirky, /<img[^>]*store-badges|google-play-[a-z]{2}-light/, `${file} the Google Play button is HTML, not the official bitmap artwork`);
    assert.match(quirky, /class="hd-keycap-cta" href="quirky-ball\/\?lang=(?:ko|en|de|ja)" data-pressable/, `${file} Quirky Ball links its page with the yellow keycap`);
    assert.doesNotMatch(quirky, /hd-shot|data-stack/, `${file} Quirky Ball no longer shows the screenshot stack`);
    assert.equal((quirky.match(/class="hd-qb-piece"/g) || []).length, 13, `${file} Quirky Ball title is its logo cut into thirteen pieces`);
    assert.ok(html.indexOf('class="hd-tenkey"') < html.indexOf('class="hd-quirky"'), `${file} 10key Survival comes first`);
    assert.ok(html.indexOf(quirky) + quirky.length < html.indexOf(farewell) && html.indexOf(farewell) < html.indexOf('id="lab-notes"'), `${file} the Comrade farewell follows Quirky Ball, before the lab notes`);
    assert.doesNotMatch(farewell, /<a\b|google-play|apps\.apple/, `${file} the Comrade farewell has no link or store button`);
    assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} YouTube cards`);
    assert.equal((html.match(/data-project="/g) || []).length, 1, `${file} one project zone (Quirky Ball); 10key Survival is the data-tenkey section`);
    assert.equal((html.match(/data-game-preview/g) || []).length, 0, `${file} no project video preview (the Quirky Ball loop plays on the desk CRT)`);
    assert.equal((html.match(/data-hero-gameplay/g) || []).length, 3, `${file} gameplay loops (10key Survival, Quirky Ball, Comrade farewell)`);
    assert.equal((html.match(/data-hexaworld-preview/g) || []).length, 0, `${file} must not preview the dropped Comrade project`);
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

test("Support offers Korean, English, and German sections with localized routes", () => {
  const support = read("support/index.html");
  assert.match(support, /href="#korean"/, "Support language navigation needs a Korean target");
  assert.match(support, /href="#english"/, "Support language navigation needs an English target");
  assert.match(support, /href="#german"/, "Support language navigation needs a German target");
  assert.match(support, /id="korean"[^>]*lang="ko"/, "Support needs a Korean-language section");
  assert.match(support, /id="english"[^>]*lang="en"/, "Support needs an English-language section");
  assert.match(support, /id="german"[^>]*lang="de"/, "Support needs a German-language section");
  assert.match(support, /Contact email/i, "English support must expose the contact route");
  assert.match(support, /Delete (?:my|your) account/i, "English support must explain account deletion");
  assert.match(support, /Kontakt-E-Mail/i, "German support must expose the contact route");
  assert.match(support, /Konto und Daten löschen/i, "German support must explain account deletion");

  for (const file of englishSupportPages) {
    const html = read(file);
    assert.match(html, /href="(?:\.\.\/|\/)?support\/#english"/, `${file} must route readers to English support`);
    assert.doesNotMatch(html, /href="(?:\.\.\/|\/)?support\/"/, `${file} must not drop readers on the default section`);
  }
  for (const file of germanSupportPages) {
    const html = read(file);
    assert.match(html, /href="(?:\.\.\/|\/)?support\/#german"/, `${file} must route readers to German support`);
    assert.doesNotMatch(html, /href="(?:\.\.\/|\/)?support\/"/, `${file} must not drop readers on the default section`);
  }
});

test("the common Terms route asks readers to choose a project", () => {
  const localized = [
    ["terms/ko.html", /프로젝트를 선택하세요/, /href="\.\.\/quirky-ball\/terms\/ko\.html"/],
    ["terms/en.html", /Choose a project/, /href="\.\.\/quirky-ball\/terms\/en\.html"/],
    ["terms/de.html", /Projekt auswählen/, /href="\.\.\/quirky-ball\/terms\/de\.html"/],
  ];
  for (const [file, heading, projectLink] of localized) {
    const html = read(file);
    assert.match(html, heading, `${file} needs a localized project choice`);
    assert.match(html, projectLink, `${file} needs the Quirky Ball terms choice`);
    // 10KEY Terms exist in English and Korean only; the German selector links the English terms.
    const tenkeyLang = file.slice(6, 8) === "de" ? "en" : file.slice(6, 8);
    assert.ok(html.includes(`href="../10key/terms/${tenkeyLang}.html"`), `${file} needs the 10KEY terms choice`);
    assert.doesNotMatch(html, /http-equiv="refresh"/i, `${file} must not skip project choice`);
  }
  assert.match(read("terms/de.html"), /10key Survival<small>[^<]*auf Englisch/, "German selector says the 10key Survival terms are in English");
  // Japanese legal URLs redirect to English (owner 2026-10-19; German is back since 2026-10-20).
  for (const file of ["terms/ja.html"]) {
    assert.match(read(file), /http-equiv="refresh" content="0;url=\/terms\/en\.html"/, `${file} must redirect to the English selector`);
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

  // The House Duck home draws its own header pill; the lockup must stay as legible as on the other pages.
  const homeCss = read("assets/home.css");
  const homeDuck = cssDeclarations(homeCss, 'body[data-page="studio"] .brand-lockup .brand-duck-image');
  const homeWordmark = cssDeclarations(homeCss, 'body[data-page="studio"] .brand-lockup .brand-wordmark-image');
  assert.ok(parseFloat(homeDuck.width) >= 30, "the home duck mark must remain legible");
  assert.ok(parseFloat(homeWordmark.width) >= 100, "the home wordmark must remain visible beside the duck");
  assert.notEqual(homeWordmark.display, "none", "the home wordmark must not be hidden");
  // The home header may be restyled again; whichever rule wins must keep a comfortable tap height.
  const headerHeights = [...homeCss.matchAll(/body\[data-page="studio"\] \.header-inner\s*\{[^}]*?min-height:\s*(\d+)px/g)].map((match) => Number(match[1]));
  assert.ok(headerHeights.length > 0 && headerHeights.at(-1) >= 48, "the home header keeps a comfortable tap height");
});

test("terms show the effective date and avoid unconfirmed business status", () => {
  const expectations = [
    ["quirky-ball/terms/ko.html", /시행일:\s*2026년 10월 5일/, /영업하는 개인사업자/],
    ["quirky-ball/terms/en.html", /Effective date:\s*October 5, 2026/i, /sole proprietor/i],
    ["quirky-ball/terms/de.html", /Inkrafttreten:\s*5\. Oktober 2026/i, /Einzelunternehmer/i],
    // 10key Survival terms v1.1 (2026-10-20: guest accounts and in-app purchases on Android / iOS).
    ["10key/terms/ko.html", /시행일:\s*2026년 10월 20일/, /영업하는 개인사업자/],
    ["10key/terms/en.html", /Effective date:\s*October 20, 2026/i, /sole proprietor/i],
  ];
  for (const [file, effectiveDate, settledBusiness] of expectations) {
    const html = read(file);
    assert.match(html, effectiveDate, `${file} must show the current effective date`);
    assert.doesNotMatch(html, settledBusiness, `${file} must not present unconfirmed business status as settled`);
  }
});
