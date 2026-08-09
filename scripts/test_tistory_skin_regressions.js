#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const skinDir = path.join(root, "tistory-skin");
const html = fs.readFileSync(path.join(skinDir, "skin.html"), "utf8");
const css = fs.readFileSync(path.join(skinDir, "style.css"), "utf8");
const script = fs.readFileSync(path.join(skinDir, "images/script.js"), "utf8");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarations(selector) {
  const match = css.match(new RegExp(`(?:^|})\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return Object.fromEntries(
    match[1]
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf(":");
        return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
      })
  );
}

function minHeight(selector) {
  const value = declarations(selector)["min-height"] || "";
  const match = value.match(/^(\d+(?:\.\d+)?)px/);
  assert.ok(match, `${selector} needs a pixel min-height`);
  return Number(match[1]);
}

test("hidden translation controls stay out of layout", () => {
  assert.equal(declarations(".translation-locales[hidden], .translation-locales a[hidden]").display, "none");
});

test("article media stays readable under Tistory's display-table rule", () => {
  const media = declarations(".article-body figure, .article-body .imageblock, .article-body .imagegridblock");
  assert.equal(media.margin, "2.4em auto");
  assert.equal(media.transform, "none");
  assert.notEqual(media.margin, "2.4em 50%");
});

test("article language controls expose every available translation", () => {
  const links = ["en", "de", "ja"].map((locale) => ({
    dataset: { blogLocale: locale },
    hidden: true,
    href: "#",
  }));
  const localeSwitcher = { hidden: true };
  const document = {
    documentElement: { dataset: {} },
    body: { id: "tt-body-page" },
    querySelector(selector) {
      if (selector === "[data-translation-links]") return localeSwitcher;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-blog-locale]") return links;
      return [];
    },
    addEventListener() {},
  };
  const replacements = [];

  vm.runInNewContext(script, {
    URLSearchParams,
    document,
    localStorage: { getItem: () => "", setItem() {} },
    location: {
      hostname: "blog.houseduck.in",
      pathname: "/entry/first.post",
      replace(value) { replacements.push(value); },
      search: "",
    },
    navigator: { language: "ko", languages: ["ko"], userAgent: "" },
    window: { HOUSE_DUCK_BLOG_LOCALES: { posts: { "first-post": {
      kr: "https://houseduck.in/blog/kr/first-post/",
      en: "https://houseduck.in/blog/en/first-post/",
      de: "https://houseduck.in/blog/de/first-post/",
      ja: "https://houseduck.in/blog/ja/first-post/",
    } } } },
  });

  assert.equal(localeSwitcher.hidden, false);
  assert.deepEqual(links.map(({ href, hidden }) => ({ href, hidden })), [
    { href: "https://houseduck.in/blog/en/first-post/", hidden: false },
    { href: "https://houseduck.in/blog/de/first-post/", hidden: false },
    { href: "https://houseduck.in/blog/ja/first-post/", hidden: false },
  ]);
  assert.deepEqual(replacements, []);
});

test("the live legacy skin receives the media fix and all locale links", () => {
  const links = [{ dataset: {}, hidden: true, href: "#", textContent: "기기 언어 번역본 보기" }];
  const media = { style: {} };
  const note = { append(link) { links.push(link); } };
  const document = {
    documentElement: { dataset: {} },
    body: { id: "tt-body-page" },
    createElement() { return { dataset: {}, hidden: true, href: "#", textContent: "" }; },
    querySelector(selector) {
      if (selector === "[data-translation-link]") return links[0];
      if (selector === ".translation-note span") return note;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-blog-locale]") return links;
      if (selector.includes(".article-body figure")) return [media];
      return [];
    },
    addEventListener() {},
  };

  vm.runInNewContext(script, {
    URLSearchParams,
    document,
    localStorage: { getItem: () => "", setItem() {} },
    location: { hostname: "blog.houseduck.in", pathname: "/entry/first-post", replace() {}, search: "" },
    navigator: { language: "ko", languages: ["ko"], userAgent: "" },
    window: { HOUSE_DUCK_BLOG_LOCALES: { posts: { "first-post": {
      en: "https://houseduck.in/blog/en/first-post/",
      de: "https://houseduck.in/blog/de/first-post/",
      ja: "https://houseduck.in/blog/ja/first-post/",
    } } } },
  });

  assert.deepEqual(links.map(({ dataset, href, hidden, textContent }) => ({ dataset, href, hidden, textContent })), [
    { dataset: { blogLocale: "en" }, href: "https://houseduck.in/blog/en/first-post/", hidden: false, textContent: "English" },
    { dataset: { blogLocale: "de" }, href: "https://houseduck.in/blog/de/first-post/", hidden: false, textContent: "Deutsch" },
    { dataset: { blogLocale: "ja" }, href: "https://houseduck.in/blog/ja/first-post/", hidden: false, textContent: "日本語" },
  ]);
  assert.equal(media.style.margin, "2.4em auto");
  assert.equal(media.style.transform, "none");
});

test("the script leaves Tistory's native empty state as the only fallback", () => {
  const stream = {
    innerHTML: "",
    querySelector() {
      return null;
    },
  };
  const document = {
    documentElement: { dataset: {} },
    body: { id: "tt-body-index" },
    querySelector(selector) {
      if (selector === "#tt-body-index #post-stream") return stream;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };

  vm.runInNewContext(script, {
    URLSearchParams,
    document,
    localStorage: { getItem: () => "", setItem() {} },
    location: { hostname: "localhost", pathname: "/", replace() {}, search: "" },
    navigator: { language: "ko", languages: ["ko"], userAgent: "" },
    window: {},
  });

  assert.equal(stream.innerHTML, "");
  assert.equal((html.match(/class="empty-state shell"/g) || []).length, 1);
});

test("tag and RSS navigation stay on the active custom domain", () => {
  assert.doesNotMatch(html, /\[##_taglog_link_##\]|\[##_rss_url_##\]/);
  assert.equal((html.match(/href="\/tag"/g) || []).length, 3);
  assert.equal((html.match(/href="\/rss"/g) || []).length, 2);
});

test("a singleton post card spans the grid and remains centered", () => {
  const rule = declarations(".post-card:only-child");
  assert.equal(rule["grid-column"], "1 / -1");
  assert.equal(rule.width, "min(100%, 760px)");
  assert.equal(rule["justify-self"], "center");
});

test("pagination disappears when neither direction has another page", () => {
  assert.equal(
    declarations(".pagination:has(.no-more-prev):has(.no-more-next)").display,
    "none"
  );
});

test("safe interactive skin controls keep a 44px minimum target", () => {
  const selectors = [
    ".category-menu-panel a",
    ".search-box",
    ".search-box button",
    ".category-tree a",
    ".article-index-link",
    ".article-category",
    ".owner-tools a, .owner-tools button",
    ".translation-locales a, .translation-locales span",
    ".article-tags a",
    ".tt_box_namecard .tt_btn_subscribe",
    ".tt-comment-cont .tt-btn_register",
  ];

  for (const selector of selectors) {
    assert.ok(minHeight(selector) >= 44, `${selector} is shorter than 44px`);
  }
});

test("theme, reduced-motion, and responsive contracts remain present", () => {
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("article titles stay readable instead of dominating the page", () => {
  assert.equal(declarations(".article-header h1")["font-size"], "clamp(2.1rem, 4vw, 3.6rem)");
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.article-header h1\s*\{[^}]*font-size:\s*clamp\(1\.9rem,\s*8vw,\s*2\.6rem\)/);
});
