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

test("article headings build a nested table of contents", () => {
  const headings = [
    { id: "", tagName: "H2", textContent: "첫 번째 결정" },
    { id: "", tagName: "H3", textContent: "- 검증 과정" },
    { id: "", tagName: "H3", textContent: "– 배포 확인" },
    { id: "", tagName: "H2", textContent: "두 번째 결정" },
    { id: "", tagName: "H3", textContent: "회귀 테스트" },
  ];
  function makeNode(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      className: "",
      attributes: {},
      children: [],
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
    };
  }
  const list = makeNode("ol");
  const toc = { hidden: true, querySelector() { return list; } };
  const document = {
    documentElement: { dataset: {} },
    body: { id: "tt-body-page" },
    createElement: makeNode,
    querySelector(selector) {
      if (selector === "[data-article-toc]") return toc;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".article-body h2, .article-body h3") return headings;
      return [];
    },
    addEventListener() {},
  };

  let observerCallback;
  const observedHeadings = [];
  class IntersectionObserver {
    constructor(callback) { observerCallback = callback; }
    observe(heading) { observedHeadings.push(heading); }
  }

  vm.runInNewContext(script, {
    URLSearchParams,
    document,
    localStorage: { getItem: () => "", setItem() {} },
    location: { hostname: "localhost", pathname: "/entry/test", replace() {}, search: "" },
    navigator: { language: "ko", languages: ["ko"], userAgent: "" },
    window: { IntersectionObserver },
  });

  assert.equal(toc.hidden, false);
  assert.deepEqual(headings.map(({ id }) => id), [
    "article-section-1",
    "article-section-2",
    "article-section-3",
    "article-section-4",
    "article-section-5",
  ]);
  assert.deepEqual(list.children.map((item) => ({
    text: item.children[0].textContent,
    href: item.children[0].href,
    children: (item.children[1]?.children || []).map((child) => ({
      text: child.children[0].textContent,
      href: child.children[0].href,
    })),
  })), [
    {
      text: "첫 번째 결정",
      href: "#article-section-1",
      children: [
        { text: "검증 과정", href: "#article-section-2" },
        { text: "배포 확인", href: "#article-section-3" },
      ],
    },
    {
      text: "두 번째 결정",
      href: "#article-section-4",
      children: [
        { text: "회귀 테스트", href: "#article-section-5" },
      ],
    },
  ]);
  assert.deepEqual(observedHeadings, headings);
  observerCallback([{ target: headings[1], isIntersecting: true }]);
  const allLinks = list.children.flatMap((item) => [item.children[0], ...(item.children[1]?.children || []).map((child) => child.children[0])]);
  assert.deepEqual(allLinks.map((link) => link.attributes["aria-current"] || ""), ["", "location", "", "", ""]);
  observerCallback([{ target: headings[3], isIntersecting: true }]);
  assert.deepEqual(allLinks.map((link) => link.attributes["aria-current"] || ""), ["", "", "", "location", ""]);
});

test("article media stays readable under Tistory's display-table rule", () => {
  const media = declarations(".article-body figure, .article-body .imageblock, .article-body .imagegridblock");
  assert.equal(media.display, "block !important");
  assert.equal(media.width, "100% !important");
  assert.equal(media.margin, "2.2em 0 !important");
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
  assert.equal(media.style.display, "block");
  assert.equal(media.style.width, "100%");
  assert.equal(media.style.margin, "2.2em 0");
  assert.equal(media.style.transform, "none");
});

test("empty image alt text is recovered from Tistory metadata", () => {
  const image = {
    alt: "",
    dataset: {},
    style: {},
    getAttribute(name) {
      return { alt: this.alt, width: "420", height: "934" }[name] ?? null;
    },
    setAttribute(name, value) { if (name === "alt") this.alt = value; },
    closest() {
      return {
        dataset: { alt: "차기작 프로토타입" },
        querySelector() { return null; },
      };
    },
  };
  const document = {
    documentElement: { dataset: {} },
    body: { id: "tt-body-index" },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector.includes(".article-body img")) return [image];
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

  assert.equal(image.alt, "차기작 프로토타입");
  assert.equal(image.style.width, "min(100%, 420px)");
  assert.equal(image.style.aspectRatio, "420 / 934");
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
  assert.equal((html.match(/href="\/tag"/g) || []).length, 1);
  assert.equal((html.match(/href="\/rss"/g) || []).length, 1);
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

test("pagination keeps Tistory's nested number spans visually transparent", () => {
  assert.equal(declarations(".page-number > span").display, "contents");
  const selected = declarations(".page-number:has(.selected), .page-number.selected");
  assert.equal(selected.color, "var(--paper)");
  assert.equal(selected.background, "var(--navy)");
});

test("safe interactive skin controls keep a 44px minimum target", () => {
  const selectors = [
    ".category-dock-panel a",
    ".search-box",
    ".search-box button",
    ".category-tree a",
    ".article-breadcrumb",
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
  assert.equal(declarations(".article-header h1")["font-size"], "clamp(1.85rem, 3.2vw, 2.8rem)");
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.article-header h1\s*\{[^}]*font-size:\s*clamp\(1\.7rem,\s*7vw,\s*2\.25rem\)/);
});
