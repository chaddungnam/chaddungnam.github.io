#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "assets", "studio-music.js");
const cssPath = path.join(root, "assets", "studio-music.css");
const source = fs.readFileSync(scriptPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const music = require(scriptPath);

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.textContent = "";
    this.innerHTML = "";
  }
  append(...nodes) { for (const node of nodes) { if (node && typeof node === "object") node.parent = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { this.removed = true; this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener)); }
  dispatch(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener.call(this, { target: this, ...event }); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "src") { this.src = String(value); this.srcAssignments = (this.srcAssignments || 0) + 1; } }
  removeAttribute(name) { delete this.attributes[name]; if (name === "src") this.src = ""; }
  getAttribute(name) { return this.attributes[name] || null; }
  focus() { this.focused = true; }
}

class FakeDocument {
  constructor() { this.documentElement = { lang: "en" }; this.body = new FakeNode("body"); this.head = new FakeNode("head"); this.hidden = false; this.listeners = new Map(); this.audioCount = 0; }
  createElement(tag) { const node = new FakeNode(tag); node.parent = null; if (tag === "audio") { this.audioCount += 1; node.volume = 1; node.playCalls = 0; node.pauseCalls = 0; node.paused = true; node.ended = false; node.play = () => { node.playCalls += 1; node.paused = false; node.ended = false; return node.playPromise || Promise.resolve(); }; node.pause = () => { node.pauseCalls += 1; node.paused = true; }; node.load = () => { node.loadCalls = (node.loadCalls || 0) + 1; }; } return node; }
  createTextNode(text) { return { textContent: text }; }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener)); }
}

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) { const result = find(child, predicate); if (result) return result; }
  return undefined;
}

function byClass(node, className) { return find(node, (item) => String(item.className || "").split(/\s+/).includes(className)); }

function createFakeWindow(document) {
  const listeners = new Map();
  return {
    document,
    location: { origin: "https://houseduck.in" },
    setTimeout,
    clearTimeout,
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
    removeEventListener(type, listener) { listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener)); },
    listeners,
  };
}

(async () => {
  assert.ok(Array.isArray(music.TRACKS), "native player exports the playlist tracks");
  assert.equal(music.TRACKS.length, 19);
  assert.deepEqual(music.TRACKS.slice(0, 3).map((track) => track.role), ["home_1", "home_2", "outgame_sub"]);
  assert.equal(music.TRACKS.at(-1).src, "assets/music/vip.mp3");
  assert.equal(music.PLAYLIST_URL, "https://www.youtube.com/playlist?list=PLK7jSNsuc6Po");
  assert.doesNotMatch(source, /youtube-nocookie|iframe_api|<iframe|new YT|YT\.Player/i);
  assert.match(source, /new Audio|createElement\(["']audio["']\)/);
  assert.match(source, /currentTime\s*=\s*0/);
  assert.match(source, /houseduck:playable/);
  assert.doesNotMatch(source, /visibilitychange/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)\s+and\s+\(hover:\s*hover\)\s+and\s+\(pointer:\s*fine\)/);
  assert.match(css, /z-index:\s*60/);
  assert.match(source, /data-icon="stop"/);

  const fakeDocument = new FakeDocument();
  const fakeWindow = createFakeWindow(fakeDocument);
  const widget = music.createWidget(fakeDocument, fakeWindow);
  const rootNode = fakeDocument.body.children.at(-1);
  const panel = byClass(rootNode, "studio-music-panel");
  const expand = byClass(rootNode, "studio-music-expand");
  const launcher = byClass(rootNode, "studio-music-launcher");
  const launcherPlay = byClass(rootNode, "studio-music-launcher-play");
  assert.ok(launcher);
  assert.equal(fakeDocument.audioCount, 1, "widget exposes one native audio element");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Play");
  const audioNode = find(rootNode, (item) => item.tagName === "audio");
  assert.equal(audioNode.preload, "none");
  assert.equal(audioNode.getAttribute("src"), null, "audio has no source before Play");

  expand.dispatch("click");
  assert.equal(panel.hidden, false, "expand opens without contacting audio");
  rootNode.dispatch("keydown", { key: "Escape" });
  assert.equal(panel.hidden, true, "Escape closes the panel");
  expand.dispatch("click");
  assert.equal(fakeDocument.audioCount, 1);

  let rejectPlay;
  audioNode.playPromise = new Promise((_resolve, reject) => { rejectPlay = reject; });
  launcherPlay.dispatch("click");
  assert.equal(fakeDocument.audioCount, 1, "Play reuses the native audio element");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Stop", "launcher becomes Stop immediately");
  assert.match(launcherPlay.innerHTML, /data-icon="stop"/);
  assert.equal(audioNode.src, "assets/music/home_1.mp3");

  launcherPlay.dispatch("click");
  assert.equal(audioNode.pauseCalls, 1, "Stop pauses the native audio");
  assert.equal(audioNode.currentTime, 0, "Stop resets playback to zero");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Play");
  rejectPlay(new Error("late play rejection"));
  await Promise.resolve();
  assert.doesNotMatch(byClass(rootNode, "studio-music-status").textContent, /error|failed/i, "late rejection after Stop is ignored");

  const select = byClass(rootNode, "studio-music-track-select");
  const next = byClass(rootNode, "studio-music-next");
  const previous = byClass(rootNode, "studio-music-previous");
  const play = byClass(rootNode, "studio-music-panel-play");
  const stop = byClass(rootNode, "studio-music-stop");
  const loop = byClass(rootNode, "studio-music-loop");
  const shuffle = byClass(rootNode, "studio-music-shuffle");
  const volume = byClass(rootNode, "studio-music-volume");
  const retry = byClass(rootNode, "studio-music-retry");
  select.value = "18";
  select.dispatch("change");
  assert.equal(select.value, "18");
  next.dispatch("click");
  previous.dispatch("click");
  loop.checked = true;
  loop.dispatch("change");
  shuffle.checked = true;
  shuffle.dispatch("change");
  volume.value = "0.4";
  volume.dispatch("input");
  assert.equal(audioNode.volume, 0.4, "volume slider controls native audio");
  assert.equal(loop.checked, true);
  assert.equal(shuffle.checked, true);
  audioNode.playPromise = undefined;
  play.dispatch("click");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Stop");
  audioNode.dispatch("play");
  audioNode.currentTime = 12;
  play.dispatch("click");
  assert.equal(audioNode.currentTime, 12, "Pause preserves the current position");
  play.dispatch("click");
  assert.equal(audioNode.currentTime, 12, "Resume does not restart the track");
  audioNode.dispatch("play");
  const previousPlayCalls = audioNode.playCalls;
  audioNode.ended = true;
  audioNode.paused = true;
  audioNode.dispatch("pause");
  audioNode.dispatch("ended");
  assert.equal(audioNode.playCalls > previousPlayCalls, true, "natural completion advances after pause-before-ended");
  assert.notEqual(audioNode.src, "assets/music/vip.mp3", "shuffle repeat does not immediately repeat the same track");
  audioNode.ended = false;
  audioNode.paused = false;
  audioNode.dispatch("error");
  const failedSourceAssignments = audioNode.srcAssignments;
  retry.dispatch("click");
  assert.equal(audioNode.srcAssignments > failedSourceAssignments, true, "retry reloads a failed source");
  stop.dispatch("click");
  assert.equal(audioNode.currentTime, 0);
  const stoppedPlayCalls = audioNode.playCalls;
  audioNode.dispatch("ended");
  audioNode.dispatch("error");
  assert.equal(audioNode.playCalls, stoppedPlayCalls, "late ended/error after Stop cannot restart or flip state");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Play");

  fakeWindow.dispatch = (type, event = {}) => { for (const listener of fakeWindow.listeners.get(type) || []) listener(event); };
  fakeWindow.dispatch("houseduck:playable", { detail: { active: true } });
  assert.equal(audioNode.pauseCalls >= 2, true, "active playable pauses music");
  assert.equal(launcherPlay.getAttribute("aria-label"), "Play", "playable pause never auto-resumes");
  assert.equal(fakeDocument.listeners.has("visibilitychange"), false, "background visibility does not pause BGM");
  widget.destroy();

  const mobileDocument = new FakeDocument();
  const mobileWindow = createFakeWindow(mobileDocument);
  const previousGlobals = { document: global.document, window: global.window, matchMedia: global.matchMedia };
  const query = { matches: false, listeners: [], addEventListener(_type, listener) { this.listeners.push(listener); }, removeEventListener() {} };
  global.document = mobileDocument;
  global.window = mobileWindow;
  global.matchMedia = () => query;
  const stopResponsive = music.init();
  assert.equal(mobileDocument.body.children.length, 0, "mobile starts with no widget");
  query.matches = true;
  query.listeners.forEach((listener) => listener());
  assert.equal(mobileDocument.body.children.length, 1, "desktop transition mounts widget");
  const mobileRoot = mobileDocument.body.children[0];
  byClass(mobileRoot, "studio-music-launcher-play").dispatch("click");
  const mobileAudio = find(mobileRoot, (item) => item.tagName === "audio");
  query.matches = false;
  query.listeners.forEach((listener) => listener());
  assert.equal(mobileDocument.body.children.length, 0, "mobile transition removes widget");
  assert.equal(mobileAudio.pauseCalls, 1, "mobile transition stops audio");
  assert.equal(mobileAudio.currentTime, 0);
  assert.equal(mobileAudio.src, "", "mobile teardown unloads audio");
  stopResponsive();
  Object.assign(global, previousGlobals);

  console.log("Studio native music contract: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
