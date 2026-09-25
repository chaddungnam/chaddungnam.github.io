#!/usr/bin/env node
"use strict";

// Unit-level coverage for assets/notice-links.js's link parser: glued-text linkification,
// &/&amp;/% handling in hrefs, and the embed-mode target=_self handoff for YouTube links.
// The DOM-integrated behavior (thumbnails, real clicks, real page load) stays covered by
// tests/notice-link-preview.spec.js; this file exercises the parser fast, without a browser.

async function main() {
const assert = (await import("node:assert/strict")).default;
const fs = (await import("node:fs")).default;
const path = (await import("node:path")).default;
const vm = (await import("node:vm")).default;

const root = path.resolve(path.dirname(process.argv[1]), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

// Minimal DOM shim: only what notice-links.js actually calls (createElement/createTextNode,
// append, dataset, className, setAttribute/addEventListener, and a one-level querySelectorAll
// used by appendPreviews' dedupe scan).
function makeDocument(search) {
  function createElement(tag) {
    const el = {
      tag,
      className: "",
      textContent: "",
      hidden: false,
      dataset: {},
      childNodes: [],
      attrs: {},
      listeners: {},
      ownerDocument: doc,
      classList: { add(name) { el.className = `${el.className} ${name}`.trim(); } },
      setAttribute(name, value) { el.attrs[name] = String(value); },
      getAttribute(name) { return el.attrs[name]; },
      addEventListener(type, fn) { (el.listeners[type] ||= []).push(fn); },
      append(...nodes) { el.childNodes.push(...nodes); },
      closest() { return null; },
      querySelectorAll(selector) {
        if (selector !== ".notice-link-preview") return [];
        return el.childNodes.filter((node) => node?.className?.split(" ").includes("notice-link-preview"));
      },
      replaceWith() {},
    };
    return el;
  }
  const doc = { defaultView: { location: { search } }, createElement, createTextNode: (text) => ({ nodeType: 3, textContent: text }) };
  return doc;
}

const sandbox = { URL, URLSearchParams, window: {} };
vm.createContext(sandbox);
vm.runInContext(read("assets/notice-links.js"), sandbox, { filename: "assets/notice-links.js" });
const NL = sandbox.window.NoticeLinks;

function renderResult(text, search = "") {
  const doc = makeDocument(search);
  const container = doc.createElement("div");
  NL.render(text, container);
  const linkEls = container.childNodes.filter((node) => node.className === "notice-inline-link");
  const previewEls = container.childNodes.filter((node) => node.className?.split(" ").includes("notice-link-preview"));
  const reconstructed = container.childNodes
    .filter((node) => node.nodeType === 3 || node.className === "notice-inline-link")
    .map((node) => node.textContent).join("");
  return { container, linkEls, previewEls, reconstructed };
}

// ── glued text (no space at all) must still linkify, per the "영상:https://…" report.
{
  const text = "영상:https://youtu.be/dQw4w9WgXcQ 확인해보세요";
  const { linkEls, previewEls, reconstructed } = renderResult(text);
  assert.equal(linkEls.length, 1, "glued Korean-colon URL must be linkified");
  assert.equal(linkEls[0].href, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(previewEls.length, 1);
  assert.equal(reconstructed, text, "visible text must be preserved exactly (offset math must stay correct)");
}

// ── a disguised scheme prefix must still be rejected even though colons are now allowed boundaries.
{
  const text = "javascript:alert(1) javascript:https://attacker.invalid vbscript:https://attacker.invalid data:https://attacker.invalid";
  const { linkEls } = renderResult(text);
  assert.equal(linkEls.length, 0, "https:// glued after javascript:/vbscript:/data: must never linkify");
}

// ── a URL glued to a word/URL character (no boundary at all) stays plain text.
{
  const { linkEls } = renderResult("xhttps://example.com and https://example.com");
  assert.equal(linkEls.length, 1, "only the real URL gets linkified");
  assert.equal(linkEls[0].href, "https://example.com/");
}

// ── the notices page also runs inside the iOS app's WebView, and Quirky Ball ships with
// min_ios_version 15.0: a regex lookbehind (WebKit 16.4+) or Object.hasOwn (WebKit 15.4+) here
// would throw and take the whole file down, silently disabling every notice link again.
{
  const source = read("assets/notice-links.js");
  assert.ok(!/\(\?<[=!]/.test(source), "notice-links.js must not use regex lookbehind (iOS 15 WKWebView)");
  assert.ok(!/Object\.hasOwn\b/.test(source), "notice-links.js must not use Object.hasOwn (iOS < 15.4)");
}

// ── &amp; (a leaked HTML entity) must decode to a real & exactly once — no double-escaping.
{
  const { linkEls } = renderResult("https://example.com/a?x=1&amp;y=2");
  assert.equal(linkEls.length, 1);
  assert.equal(linkEls[0].href, "https://example.com/a?x=1&y=2");
}

// ── plain & and % in an ordinary query string must keep working (not regressed by the entity fix).
{
  const { linkEls } = renderResult("https://example.com/a?x=1&y=2%20z");
  assert.equal(linkEls.length, 1);
  assert.equal(linkEls[0].href, "https://example.com/a?x=1&y=2%20z");
}

// ── embedded app mode: YouTube anchors use target=_self (native WebView handoff); others stay _blank.
{
  const text = "https://youtu.be/dQw4w9WgXcQ and https://example.com/safe";
  const embedded = renderResult(text, "?embed=1");
  const plain = renderResult(text, "");

  const ytInlineEmbedded = embedded.linkEls.find((link) => link.href.includes("youtu.be"));
  const otherInlineEmbedded = embedded.linkEls.find((link) => link.href.includes("example.com"));
  assert.equal(ytInlineEmbedded.target, "_self", "YouTube inline link must use target=_self in embed mode");
  assert.equal(otherInlineEmbedded.target, "_blank", "non-YouTube inline link must stay target=_blank even in embed mode");

  const ytInlinePlain = plain.linkEls.find((link) => link.href.includes("youtu.be"));
  assert.equal(ytInlinePlain.target, "_blank", "YouTube link must stay target=_blank outside embed mode");

  const ytPreview = embedded.previewEls.find((preview) => preview.dataset.noticeLinkKey?.startsWith("youtube:"));
  const poster = ytPreview.childNodes.find((node) => node.className === "notice-link-poster");
  const destination = ytPreview.childNodes.find((node) => node.className === "notice-link-destination");
  assert.equal(poster.target, "_self");
  assert.equal(destination.target, "_self");

  const otherPreview = embedded.previewEls.find((preview) => !preview.dataset.noticeLinkKey?.startsWith("youtube:"));
  const otherDestination = otherPreview.childNodes.find((node) => node.className === "notice-link-destination");
  assert.equal(otherDestination.target, "_blank", "non-YouTube preview destination stays target=_blank in embed mode");
}

// ── existing security rejections (credentials, localhost, IP literal, port, control-char percent)
// must still hold after the boundary/entity changes.
{
  const text = [
    "https://youtube.com@attacker.invalid",
    "https://localhost/a",
    "https://127.0.0.1/a",
    "https://youtube.com:444/watch?v=dQw4w9WgXcQ",
    "https://example.com/%0aevil",
  ].join("\n");
  const { linkEls } = renderResult(text);
  assert.equal(linkEls.length, 0, "credential/localhost/IP/port/control-char URLs must stay rejected");
}

// ── isYouTubeUrl (console link-checker helper): watch, youtu.be, shorts, live, embed, playlist,
// /@channel and music.youtube must all be recognized; non-YouTube and non-https must not.
{
  const yes = [
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtube.com/watch?v=x&amp;t=5",
  ];
  for (const url of yes) assert.equal(NL.isYouTubeUrl(url), true, `${url} must be detected as YouTube`);
  assert.equal(NL.isYouTubeUrl("https://example.com"), false);
  assert.equal(NL.isYouTubeUrl("http://youtube.com/watch?v=dQw4w9WgXcQ"), false, "isYouTubeUrl must require https");
  assert.equal(NL.isYouTubeUrl("not a url"), false);
  assert.equal(NL.isYouTubeUrl(""), false);
}

console.log("notice-links parser: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
