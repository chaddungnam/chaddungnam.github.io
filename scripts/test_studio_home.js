const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtimePath = path.join(root, "assets/studio-home.js");

assert.ok(fs.existsSync(runtimePath), "assets/studio-home.js must exist");
const { QUIRKY_RULES, duePairCount, nextFrameTime, shotAngles, shrinkRadius } = require(runtimePath);

assert.deepEqual(QUIRKY_RULES, {
  totalTurns: 4.5,
  eventSeconds: 1.5 / 1.3,
  shotsPerSecond: 8,
  pairInterval: 0.25,
  shrinkMin: 0.82,
  shrinkMax: 0.94,
  maxBounces: 1,
});
assert.deepEqual(shotAngles(0, 0), [0, Math.PI]);
assert.equal(shrinkRadius(100, 0), 82);
assert.equal(shrinkRadius(100, 1), 94);
assert.equal(QUIRKY_RULES.shotsPerSecond * QUIRKY_RULES.pairInterval, 2, "each interval must fire one opposing pair");
let nextPairAt = QUIRKY_RULES.pairInterval * 1000;
let simulatedShots = 0;
for (let frame = 0; frame <= 300; frame += 1) {
  const now = frame * 10_000 / 300;
  const due = duePairCount(now, nextPairAt, QUIRKY_RULES.pairInterval * 1000);
  simulatedShots += due * 2;
  nextPairAt += due * QUIRKY_RULES.pairInterval * 1000;
}
assert.equal(simulatedShots, 80, "ten seconds of steady 30fps time must fire exactly 80 shots");
for (const refreshRate of [60, 90, 120]) {
  let previousFrameAt = 0;
  let simulatedFrames = 0;
  for (let refresh = 1; refresh <= refreshRate * 10; refresh += 1) {
    const next = nextFrameTime(refresh * 1000 / refreshRate, previousFrameAt, 1000 / 30);
    if (next === null) continue;
    previousFrameAt = next;
    simulatedFrames += 1;
  }
  assert.equal(simulatedFrames, 300, `ten seconds at ${refreshRate}Hz must retain a steady 30fps draw clock`);
}
for (const asset of ["quirky-ball/v2/loop.mp4", "quirky-ball/v2/loop.webm", "quirky-ball/v2/loop-poster.webp"]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `home 2.0 gameplay loop asset ${asset} must exist`);
}

const svg = read("assets/red-quirky.svg");
assert.match(svg, /<svg[^>]*width="240"[^>]*height="260"/, "Quirky must keep its 240×260 natural size");
assert.match(svg, /viewBox="0 0 240 260"/);
assert.doesNotMatch(svg, /(?:left|right)-(?:foot|leg)|\b(?:foot|feet|leg|legs)\b/i, "Quirky must not have appendages");
assert.doesNotMatch(svg, /(?:linear|radial)Gradient|url\(#/i, "Quirky shell must use the flat in-game color");
assert.doesNotMatch(svg, /(?:tooth|teeth|grin)/i, "Quirky must use the in-game smirk, not a toothy grin");
assert.match(svg, /data-part="body" d="M120 30 207 80v100l-87 50-87-50V80Z" fill="#EF3F38" stroke="#101827" stroke-width="5\.5" stroke-opacity="\.92"/, "Quirky needs the in-game red hex shell and 92%-alpha navy ink outline");
assert.match(svg, /data-part="shell-highlight" d="M33 80 120 30 207 80" fill="none" stroke="#FFEAE6" stroke-opacity="\.72" stroke-width="3\.5"/, "Quirky needs the source-equivalent upper-edge pink highlight");
assert.match(svg, /data-part="left-eye" cx="88" cy="118" r="17" fill="#FCFDFE" stroke="#101827" stroke-width="2\.4"/, "Quirky needs the left white eye");
assert.match(svg, /data-part="right-eye" cx="152" cy="118" r="17" fill="#FCFDFE" stroke="#101827" stroke-width="2\.4"/, "Quirky needs the right white eye");
assert.match(svg, /data-part="left-pupil" cx="85" cy="111" r="8" fill="#101827"/, "Quirky needs the raised outward left pupil");
assert.match(svg, /data-part="right-pupil" cx="155" cy="111" r="8" fill="#101827"/, "Quirky needs the raised outward right pupil");
assert.match(svg, /data-part="left-brow" d="M108 98 65 81" fill="none" stroke="#101827" stroke-width="11"/, "Quirky needs the angled left brow");
assert.match(svg, /data-part="right-brow" d="M132 98 175 81" fill="none" stroke="#101827" stroke-width="11"/, "Quirky needs the angled right brow");
assert.match(svg, /data-part="smirk" d="M90 166Q123 180 150 150" fill="none" stroke="#101827" stroke-width="7\.5"/, "Quirky needs the asymmetric smirk");
assert.match(svg, /data-part="smirk-curl" d="M150 150l10-10" fill="none" stroke="#101827" stroke-width="7\.5"/, "Quirky smirk needs its raised curl");

// ---------------------------------------------------------------------------------------------
// The House Duck home (rebuilt 2026-10-23): night desk hero -> 10key Survival -> Quirky Ball ->
// Comrade farewell -> lab notes -> player support. assets/studio-home.* now only serve quirky-ball/.
// ---------------------------------------------------------------------------------------------
function webpSize(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `${file} must be a WebP`);
  assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", `${file} must be a WebP`);
  const chunk = data.subarray(12, 16).toString("ascii");
  if (chunk === "VP8 ") return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") { const bits = data.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  throw new Error(`${file}: unsupported WebP chunk ${chunk}`);
}
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sectionOf = (html, id) => (html.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[\\s\\S]*?</section>`)) || [""])[0];

const homeLocales = {
  "index.html": { lang: "ko", tenkeyHref: "10key/", more: "자세히 보기", self: "./?lang=ko", about: "about/", support: "support/", videoLabel: "딸깍 서바이벌 실제 플레이", tenkeyTitle: '딸깍 서바이벌<span class="hd-title-alt" lang="en">10key Survival</span>', farewellName: "동무와 멋진신세계", smallFirst: false, qbGroup: "Quirky Ball 실제 플레이 영상", qbVideo: "Quirky Ball 2.0 실제 플레이", comradeGroup: "동무와 멋진신세계 실제 플레이 영상", comradeVideo: "동무와 멋진신세계 실제 플레이" },
  "index_en.html": { lang: "en", tenkeyHref: "10key/index_en.html", more: "Learn more", self: "index_en.html?lang=en", about: "about/index_en.html?lang=en", support: "support/#english", videoLabel: "10key Survival gameplay", tenkeyTitle: "10key Survival", farewellName: "Comrade and the Brave New World", smallFirst: true, qbGroup: "Quirky Ball gameplay video", qbVideo: "Quirky Ball 2.0 gameplay", comradeGroup: "Comrade and the Brave New World gameplay video", comradeVideo: "Comrade and the Brave New World gameplay" },
  "index_de.html": { lang: "de", tenkeyHref: "10key/index_en.html", more: "Mehr erfahren", self: "index_de.html?lang=de", about: "about/index_de.html?lang=de", support: "support/#german", videoLabel: "10key Survival Gameplay", tenkeyTitle: "10key Survival", farewellName: "Genosse und die schöne neue Welt", smallFirst: true, qbGroup: "Quirky Ball Gameplay-Video", qbVideo: "Quirky Ball 2.0 Gameplay", comradeGroup: "Genosse und die schöne neue Welt – Gameplay-Video", comradeVideo: "Genosse und die schöne neue Welt – Gameplay" },
  "index_ja.html": { lang: "ja", tenkeyHref: "10key/index_en.html", more: "詳しく見る", self: "index_ja.html?lang=ja", about: "about/index_ja.html?lang=ja", support: "support/#japanese", videoLabel: "10key Survivalのプレイ", tenkeyTitle: "10key Survival", farewellName: "Comrade and the Brave New World", smallFirst: false, qbGroup: "Quirky Ballのプレイ映像", qbVideo: "Quirky Ball 2.0のプレイ", comradeGroup: "Comrade and the Brave New Worldのプレイ映像", comradeVideo: "Comrade and the Brave New Worldのプレイ" },
};
// The Quirky Ball logo is cut into these pieces (assets/media/home/qb-logo/<piece>.webp); home.js lands them one by one.
const QB_PIECES = ["q", "u", "i", "r", "k", "y", "b", "a", "l1", "l2", "dot", "hex", "ball"];

// Home media: the desk scene layers drawn on the hero canvas, the 10key loop and the social image.
const homeMedia = {
  "assets/media/tenkey-gameplay.mp4": 2_500_000,
  "assets/media/tenkey-gameplay.webm": 2_500_000,
  "assets/media/tenkey-gameplay-poster.webp": 150_000,
  "assets/media/tenkey-og.jpg": 300_000,
  "assets/media/comrade-gameplay-poster.jpg": 100_000,
  "assets/media/comrade-gameplay.mp4": 3_500_000,
  "assets/media/home/desk-landscape.png": 100_000,
  "assets/media/home/desk-portrait.png": 100_000,
  "assets/media/home/duck-landscape.png": 50_000,
  "assets/media/home/duck-portrait.png": 50_000,
  "assets/media/home/duck-blink-landscape.png": 10_000,
  "assets/media/home/duck-blink-portrait.png": 10_000,
  "assets/media/home/desk-landscape.json": 10_000,
  "assets/media/home/desk-portrait.json": 10_000,
};
for (const [asset, limit] of Object.entries(homeMedia)) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  assert.ok(fs.statSync(path.join(root, asset)).size <= limit, `${asset} must stay web-sized (<= ${limit} bytes)`);
}
const ogImage = fs.readFileSync(path.join(root, "assets/media/tenkey-og.jpg"));
let jpegSize;
for (let offset = 2; offset < ogImage.length;) {
  const marker = ogImage[offset + 1];
  if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) { jpegSize = { height: ogImage.readUInt16BE(offset + 5), width: ogImage.readUInt16BE(offset + 7) }; break; }
  offset += 2 + ogImage.readUInt16BE(offset + 2);
}
assert.deepEqual(jpegSize, { width: 1200, height: 630 }, "the 10key Survival social image must be 1200x630");

for (const orientation of ["landscape", "portrait"]) {
  // home-desk.js draws desk-<orientation>.png and pastes the duck layers at the coordinates written in the JSON.
  const meta = JSON.parse(read(`assets/media/home/desk-${orientation}.json`));
  const png = fs.readFileSync(path.join(root, `assets/media/home/desk-${orientation}.png`));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", `desk-${orientation}.png must be a PNG`);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], meta.size, `desk-${orientation}.json size must match the PNG, or the CRT screen lands off the monitor`);
  assert.equal(meta.screen.quad.length, 4, `desk-${orientation} CRT screen is a quad`);
  for (const [x, y] of meta.screen.quad) assert.ok(x >= 0 && y >= 0 && x <= meta.size[0] && y <= meta.size[1], `desk-${orientation} CRT corner (${x},${y}) lies inside the picture`);
  for (const layer of [meta.duck, meta.blink]) {
    assert.ok(fs.existsSync(path.join(root, "assets/media/home", layer.file)), `desk-${orientation} layer ${layer.file} must exist`);
    assert.ok(layer.x + layer.w <= meta.size[0] && layer.y + layer.h <= meta.size[1], `desk-${orientation} layer ${layer.file} stays inside the picture`);
  }
  assert.ok(meta.focal.x >= 0 && meta.focal.x <= 1 && meta.focal.y >= 0 && meta.focal.y <= 1, `desk-${orientation} focal point is a 0..1 fraction`);
}

for (const asset of ["assets/house-duck-logo-96.webp", "assets/house-duck-wordmark-360.webp"]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  assert.ok(fs.statSync(path.join(root, asset)).size < 10_000, `${asset} must stay below 10KB`);
}

// ---------- assets/home.js: pure helpers behind the page sections ----------
const home = require(path.join(root, "assets/home.js"));
assert.deepEqual(Object.keys(home).sort(), ["EASE", "applyLiveVersion", "bayerThreshold", "init", "renderYouTube"], "home.js public surface");
{
  // The lab-notes ASCII dissolve reveals cells in Bayer order with a gentle left-to-right sweep.
  const block = (x0, cols) => {
    const values = [];
    for (let y = 0; y < 8; y += 1) for (let x = x0; x < x0 + 8; x += 1) values.push(home.bayerThreshold(x, y, cols));
    return values;
  };
  const left = block(0, 64);
  const right = block(56, 64);
  for (const value of [...left, ...right]) assert.ok(value >= 0 && value < 1, "thresholds stay in [0,1)");
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean(right) > mean(left) + .1, "the reveal sweeps from left to right");
  assert.ok(Math.min(...left) < .1 && Math.max(...left) > .7, "one 8x8 block spreads over the whole dither range");
  assert.equal(home.bayerThreshold(0, 0, 1), 0, "a one-column strip starts at zero without dividing by zero");

  // The live version only accepts dotted numbers, so a bad response can never inject text into the page.
  const nodes = [{ textContent: "2.0.0" }, { textContent: "2.0.0" }];
  globalThis.document = { querySelectorAll: () => nodes };
  for (const bad of ["", "2", "v2.0.0", "2.0.0-beta", "<b>1.0</b>", "1.2.3.4.5", undefined]) {
    home.applyLiveVersion(bad);
    assert.deepEqual(nodes.map((node) => node.textContent), ["2.0.0", "2.0.0"], `version ${JSON.stringify(bad)} is ignored`);
  }
  home.applyLiveVersion("1.2.3");
  assert.deepEqual(nodes.map((node) => node.textContent), ["1.2.3", "1.2.3"], "every [data-live-version] shows the console version");

  // The synced feed replaces the three static cards only when it delivers exactly three valid videos.
  const element = (tag) => ({ tag, dataset: {}, children: [], className: "", append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; this.replaced = true; } });
  const feed = element("div");
  globalThis.document = {
    querySelector: (selector) => selector === "[data-youtube-feed]" ? feed : null,
    querySelectorAll: () => [],
    createElement: element,
    createDocumentFragment: () => element("fragment"),
  };
  const video = (videoId, title) => ({ videoId, title });
  home.renderYouTube([video("bOUGPw5Iih4", "one"), video("l_t2G09Zye4", "two")]);
  assert.equal(feed.replaced, undefined, "fewer than three videos keep the static fallback");
  home.renderYouTube([video("bOUGPw5Iih4", "one"), video("l_t2G09Zye4", "two"), video("short", "three")]);
  assert.equal(feed.replaced, undefined, "an invalid video id keeps the static fallback");
  home.renderYouTube([video("bOUGPw5Iih4", "one"), video("l_t2G09Zye4", "two"), video("uHgzc85Fb2k", "  three  "), video("aaaaaaaaaaa", "four")]);
  assert.equal(feed.replaced, true, "three valid videos replace the static cards");
  assert.deepEqual(feed.children[0].children.map((card) => card.href), ["bOUGPw5Iih4", "l_t2G09Zye4", "uHgzc85Fb2k"].map((id) => `https://www.youtube.com/watch?v=${id}`), "cards link to the first three videos");
  assert.equal(feed.children[0].children[2].children[1].children[0].textContent, "three", "titles are inserted as trimmed text");
  delete globalThis.document;
}

// ---------- the four home pages ----------
const expectedCopy = {
  "index.html": ["https://apps.apple.com/app/id6797996754", "딸깍 서바이벌", "출시 준비 중", "다른 장르의 게임에서 만나요", "동무와 멋진신세계", "화려한 모험, 그리고 ASMR", "사전예약하기", "itch.io에서 미리 플레이해보기"],
  "index_en.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "Coming soon", "See you in a game of another genre", "Comrade and the Brave New World", "A dazzling adventure, and ASMR", "Pre-register", "Play the free preview on itch.io"],
  "index_de.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "Bald verfügbar", "Wir sehen uns in einem Spiel eines anderen Genres", "Genosse und die schöne neue Welt", "Ein funkelndes Abenteuer – und ASMR", "Vorregistrieren", "Kostenlose Vorschau auf itch.io spielen"],
  "index_ja.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "近日配信予定", "別のジャンルのゲームでまた会いましょう", "Comrade and the Brave New World", "華やかな冒険、そしてASMR", "事前登録する", "itch.ioで無料体験版をプレイ"],
};

const expectedOpenGraph = {
  "index.html": ["House Duck — 독일의 1인 인디 게임 스튜디오", "신작 딸깍 서바이벌(10key Survival)은 iOS·Android 출시 준비 중이에요. 지금 사전예약하고 itch.io에서 무료 미리보기를 플레이해 보세요. Quirky Ball은 iOS와 Android에서 만나보세요.", "딸깍 서바이벌(10key Survival) 대표 이미지. 3D 키보드 위의 텐키와 마우스"],
  "index_en.html": ["House Duck — Independent Game Studio", "10key Survival is coming to iOS and Android: pre-register now, or play the free preview on itch.io. Quirky Ball is out on iOS and Android.", "10key Survival key art: a living numpad and a mouse on a 3D keyboard"],
  "index_de.html": ["House Duck — Unabhängiges Spielestudio in Deutschland", "10key Survival kommt für iOS und Android: jetzt vorregistrieren oder die kostenlose Vorschau auf itch.io spielen. Quirky Ball gibt es auf iOS und Android.", "Key Art von 10key Survival: ein lebendiger Ziffernblock und eine Maus auf einer 3D-Tastatur"],
  "index_ja.html": ["House Duck — ドイツのインディーゲームスタジオ", "10key SurvivalはiOS・Androidで配信予定。今すぐ事前登録、またはitch.ioで無料体験版をプレイ。Quirky BallはiOSとAndroidで遊べます。", "10key Survivalのキーアート：3Dキーボードの上の生きたテンキとマウス"],
};

const expectedDescriptions = {
  "index.html": "딸깍 서바이벌(10key Survival)과 Quirky Ball을",
  "index_en.html": "10key Survival and Quirky Ball",
  "index_de.html": "10key Survival und Quirky Ball",
  "index_ja.html": "10key SurvivalとQuirky Ball",
};

const homeAssetVersions = { css: new Set(), js: new Set() };
for (const [file, copy] of Object.entries(expectedCopy)) {
  const html = read(file);
  const l = homeLocales[file];
  for (const text of copy) assert.ok(html.includes(text), `${file} must include ${text}`);

  // --- section order: hero, 10key Survival first, Quirky Ball (with its community block), the Comrade farewell right under it, lab notes, support ---
  const hero = sectionOf(html, "studio");
  const tenkey = sectionOf(html, "games");
  const quirky = sectionOf(html, "quirky");
  const lab = sectionOf(html, "lab-notes");
  const support = sectionOf(html, "player-support");
  const farewell = sectionOf(html, "comrade");
  for (const [name, block] of Object.entries({ hero, tenkey, quirky, lab, support, farewell })) assert.ok(block, `${file} needs its ${name} section`);
  const positions = ['id="studio"', 'id="games"', 'id="quirky"', 'id="comrade"', 'id="lab-notes"', 'id="player-support"', "</main>", "<footer"].map((token) => html.indexOf(token));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), `${file} sections read hero, 10key Survival, Quirky Ball, Comrade farewell, lab notes, support, footer`);
  assert.equal((html.match(/class="hd-farewell home-farewell"/g) || []).length, 1, `${file} needs one quiet Comrade farewell`);
  assert.equal(html.slice(html.indexOf(quirky) + quirky.length, html.indexOf(farewell)).trim(), "", `${file} the Comrade farewell sits directly after Quirky Ball, not at the end of the page`);
  assert.equal(html.slice(html.indexOf(farewell) + farewell.length, html.indexOf(lab)).trim(), "", `${file} lab notes follow the Comrade farewell`);

  // --- hero: the pixel desk scene, no overlay copy, the h1 is for search and screen readers ---
  assert.match(hero, /^<section class="hd-hero" id="studio" data-theme="night" aria-labelledby="studio-title">/, `${file} night hero`);
  assert.match(hero, /<div class="hd-desk" data-desk data-desk-tenkey="assets\/media\/tenkey-gameplay\.mp4" data-desk-quirky="quirky-ball\/v2\/loop\.mp4">/, `${file} desk plays the 10key Survival loop and the Quirky Ball 2.0 loop on its CRT`);
  assert.match(hero, /<a class="hd-desk-screen-link" href="#games" aria-label="[^"]+"><\/a>/, `${file} the CRT screen links down to 10key Survival`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file} needs exactly one h1`);
  assert.match(hero, /<h1 class="hd-visually-hidden" id="studio-title">House Duck<\/h1>/, `${file} h1 names the studio`);
  assert.equal(hero.replace(/<[^>]*>/g, "").trim(), "House Duck", `${file} the desk scene carries no overlay copy`);
  assert.doesNotMatch(hero, /Quirky|google-play|apps\.apple|<video|<img|<button/, `${file} hero is the scene only`);

  // --- 10key Survival (owner 10-28: the itch.io page's look; a paid app, so the big gold key is the pre-registration and the
  //     itch.io browser build is the outlined free preview under it; no store links yet) ---
  const lang = l.lang;
  assert.match(tenkey, /^<section class="hd-tenkey" id="games" data-theme="night" data-tenkey aria-labelledby="tenkey-title">/, `${file} 10key Survival section`);
  assert.ok(tenkey.includes(`<h2 class="hd-title" id="tenkey-title">${l.tenkeyTitle}</h2>`), `${file} section title is the game`);
  assert.ok(tenkey.includes(`hd-chip hd-chip-status">${copy[2]}<`), `${file} status chip says ${copy[2]}`);
  assert.ok(tenkey.includes(`<p class="hd-tk-pitch">${copy[5]}</p>`), `${file} the store subtitle is the pitch`);
  const odds = lang === "ko" ? "10key/odds/" : "10key/odds/#en";
  assert.deepEqual([...tenkey.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]), [
    `<a class="hd-keycap-cta hd-tk-prereg" href="${l.tenkeyHref}#prereg" data-pressable>`,
    '<a class="hd-tk-preview" href="https://houseduck.itch.io/10key-survival">',
    `<a class="hd-arrow-link hd-tk-more" href="${l.tenkeyHref}">`,
    `<a href="${odds}">`,
  ], `${file} the big pre-registration key (the form on the 10key page: Korean page in ko, the English page in en/de/ja), the itch.io preview, the 10key page and the odds`);
  assert.ok(tenkey.includes(`<span class="hd-keycap-face">${copy[6]}</span>`), `${file} the gold key is labelled ${copy[6]}`);
  assert.ok(tenkey.includes(`<span class="hd-tk-play-icon" aria-hidden="true"></span>${copy[7]}</a>`), `${file} the itch.io link is labelled ${copy[7]}`);
  assert.ok(tenkey.includes(`">${l.more}</a>`), `${file} the 10key page link is labelled ${l.more}`);
  assert.equal((tenkey.match(/<p class="hd-tk-note">[^<]+<\/p>/g) || []).length, 2, `${file} a short note under each button`);
  assert.match(tenkey, /<p class="hd-tk-fine">[^<]*8[.,]333[^<]*<a /, `${file} states the module odds as text`);
  assert.equal((tenkey.match(/<video\b/g) || []).length, 1, `${file} one gameplay loop`);
  const video = tenkey.match(/<video\b[^>]*>/)[0];
  for (const attribute of ["data-hero-gameplay", " autoplay", " muted", " loop", " playsinline", 'preload="none"', 'poster="assets/media/tenkey-gameplay-poster.webp"', `aria-label="${l.videoLabel}"`]) assert.ok(video.includes(attribute), `${file} gameplay video needs ${attribute.trim()}`);
  assert.ok(tenkey.includes('<source src="assets/media/tenkey-gameplay.mp4" type="video/mp4"><source src="assets/media/tenkey-gameplay.webm" type="video/webm">'), `${file} gameplay video has mp4 and webm sources`);
  assert.match(tenkey, /<figcaption class="hd-micro">[^<]+<\/figcaption>/, `${file} captions the footage`);
  assert.ok(tenkey.includes('<source media="(max-width: 600px)" srcset="assets/media/tenkey-itch/cover.webp" width="630" height="500"><img src="assets/media/tenkey-itch/banner.webp" width="960" height="300"'), `${file} itch.io banner (cover on phones)`);
  assert.deepEqual([...tenkey.matchAll(/src="assets\/media\/tenkey-itch\/(desc-[a-z]+)\.webp"[^>]*loading="lazy"/g)].map((match) => match[1]), ["desc-dig", "desc-survive", "desc-evolve"], `${file} the three itch.io description images, lazy`);
  assert.deepEqual([...tenkey.matchAll(/src="assets\/media\/tenkey-itch\/shot-([a-z]+)-([a-z]+)\.webp"[^>]*loading="lazy"/g)].map((match) => `${match[1]}-${match[2]}`),
    ["dig", "mouse", "levelup", "numlock", "fever"].map((shot) => `${shot}-${lang}`), `${file} five store screenshots in its own language, lazy`);
  for (const ref of tenkey.matchAll(/(?:src|srcset)="(assets\/media\/tenkey-itch\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, ref[1])), `${file}: ${ref[1]} must exist`);
  assert.doesNotMatch(tenkey, /data-keyfield|data-glass|data-key-hint|hd-phone/, `${file} the keycap toy and the phone mock-up are gone`);
  assert.doesNotMatch(hero + tenkey, /play\.google\.com|apps\.apple\.com|google-play-badge|app-store-badge/, `${file} 10key Survival has no store link before release`);
  assert.doesNotMatch(tenkey, /Quirky/, `${file} the 10key Survival section does not mention Quirky Ball`);

  // --- Quirky Ball: the only released game; its own logo cut into letters, matching store buttons, keycap link, real play loop, community block ---
  assert.match(quirky, /^<section class="hd-quirky" id="quirky" data-theme="paper" aria-labelledby="quirky-title" data-project="quirky-ball">/, `${file} Quirky Ball section`);
  assert.equal((html.match(/data-project="/g) || []).length, 1, `${file} only Quirky Ball is a data-project zone`);
  assert.doesNotMatch(html, /data-project="(?:hexaworld1984|tenkey-survival)"|hexaworld1984\//, `${file} must not show or link the dropped Comrade project`);
  assert.ok(html.indexOf('id="games"') < html.indexOf('id="quirky"'), `${file} 10key Survival comes before Quirky Ball`);
  assert.match(quirky, /<span data-live-version>2\.0\.0<\/span>/, `${file} shows the 2.0.0 fallback until the console version arrives`);
  assert.equal((html.match(/data-live-version/g) || []).length, 1, `${file} one live version hook`);

  // the title is the game's logo: a hidden text name for search and screen readers, and 13 decorative letter pieces animated in by home.js
  const qbTitle = (quirky.match(/<h2 class="hd-qb-title" id="quirky-title">[\s\S]*?<\/h2>/) || [""])[0];
  assert.ok(qbTitle, `${file} Quirky Ball title is an h2.hd-qb-title#quirky-title`);
  assert.match(qbTitle, /^<h2 class="hd-qb-title" id="quirky-title"><span class="hd-visually-hidden">Quirky Ball<\/span><span class="hd-qb-logo" data-qb-logo aria-hidden="true">/, `${file} logo title keeps a visually hidden "Quirky Ball" and an aria-hidden logo`);
  const pieces = [...qbTitle.matchAll(/<img class="hd-qb-piece" data-piece="(\w+)" src="(assets\/media\/home\/qb-logo\/(\w+)\.webp)" alt="" style="--l:([\d.]+)%;--t:([\d.]+)%;--w:([\d.]+)%;--i:(\d+)">/g)];
  assert.deepEqual(pieces.map((piece) => piece[1]), QB_PIECES, `${file} logo is cut into ${QB_PIECES.join(", ")}`);
  assert.equal((qbTitle.match(/<img\b/g) || []).length, QB_PIECES.length, `${file} the logo holds only its letter pieces`);
  for (const piece of pieces) {
    assert.equal(piece[3], piece[1], `${file} piece ${piece[1]} points at its own file`);
    assert.ok(fs.existsSync(path.join(root, piece[2])), `${file}: ${piece[2]} must exist`);
    assert.ok(fs.statSync(path.join(root, piece[2])).size <= 20_000, `${piece[2]} must stay a small letter sprite`);
    assert.ok(Number(piece[4]) >= 0 && Number(piece[5]) >= 0 && Number(piece[4]) + Number(piece[6]) <= 100.5, `${file} piece ${piece[1]} sits inside the logo box`);
  }
  assert.ok(new Set(pieces.map((piece) => piece[2])).size === QB_PIECES.length, `${file} every piece is its own image`);
  assert.doesNotMatch(quirky, /hd-shot|data-stack|data-shot|hd-stack|data-caption|01 \/ 10/, `${file} the ten-screenshot 3D stack, its captions and counter are gone`);
  assert.doesNotMatch(quirky, /quirky-ball\/v2\/shot-/, `${file} Quirky Ball section shows no store screenshots`);
  assert.doesNotMatch(quirky, /hd-arrow-link|↗/, `${file} Quirky Ball section no longer uses the arrow link`);

  // store buttons: two matching HTML buttons set in the site's type (no Google Play <img> artwork any more)
  const storeButtons = [...quirky.matchAll(/<a class="store-button (google-play|app-store)-badge" href="([^"]+)" aria-label="([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.deepEqual(storeButtons.map((button) => button[1]), ["google-play", "app-store"], `${file} Google Play then App Store button`);
  assert.equal((quirky.match(/class="store-button /g) || []).length, 2, `${file} exactly the two store buttons`);
  assert.equal((quirky.match(/class="(?:google-play|app-store)-badge"/g) || []).length, 0, `${file} no unmatched legacy badge anchors`);
  assert.deepEqual(storeButtons.map((button) => button[2]), ["https://play.google.com/store/apps/details?id=com.quirkyball.app", "https://apps.apple.com/app/id6797996754"], `${file} stores link to the released Android and iOS apps`);
  for (const [index, name] of ["Google Play", "App Store"].entries()) {
    const [, , , label, inner] = storeButtons[index];
    assert.ok(label.trim() && label.includes(name), `${file} ${name} button has a localized accessible name that includes ${name}`);
    assert.match(inner, /^<svg class="store-icon(?: app-store-icon)?" viewBox="[^"]+" aria-hidden="true">[\s\S]*<\/svg><span class="store-copy">(?:<strong>[^<]+<\/strong><small>[^<]+<\/small>|<small>[^<]+<\/small><strong>[^<]+<\/strong>)<\/span>$/, `${file} ${name} button is an inline icon plus a store-copy label`);
    assert.equal((inner.match(/<strong>([^<]+)<\/strong>/) || [])[1], name, `${file} ${name} button names the store in <strong>`);
    assert.ok(inner.indexOf("<small>") < inner.indexOf("<strong>") === l.smallFirst, `${file} ${name} button puts its small line ${l.smallFirst ? "first" : "second"}`);
    assert.doesNotMatch(inner, /<img\b/, `${file} ${name} button draws no bitmap badge`);
  }
  assert.match(quirky, /<p class="store-disclosure">[^<]+<\/p>/, `${file} discloses ads and purchases`);

  // yellow keycap CTA to the game page, labelled like the 10key one
  assert.ok(quirky.includes(`<a class="hd-keycap-cta" href="quirky-ball/?lang=${l.lang}" data-pressable><span class="hd-keycap-face">${l.more}</span></a>`), `${file} keycap link opens the Quirky Ball page in its own language, labelled ${l.more}`);
  assert.equal((quirky.match(/<a class="hd-keycap-cta"/g) || []).length, 1, `${file} one keycap CTA in the Quirky Ball section`);

  // phone with the real 2.0 play loop
  assert.equal((quirky.match(/<video\b/g) || []).length, 1, `${file} one play loop in the Quirky Ball phone`);
  assert.match(quirky, /<figure class="hd-phone-figure hd-qb-phone">/, `${file} Quirky Ball phone figure`);
  assert.ok(quirky.includes(`role="group" aria-label="${l.qbGroup}"`), `${file} Quirky Ball phone is a labelled group`);
  const qbVideo = quirky.match(/<video\b[^>]*>/)[0];
  for (const attribute of ["data-hero-gameplay", " autoplay", " muted", " loop", " playsinline", 'preload="none"', 'poster="quirky-ball/v2/loop-poster.webp"', `aria-label="${l.qbVideo}"`]) assert.ok(qbVideo.includes(attribute), `${file} Quirky Ball video needs ${attribute.trim()}`);
  assert.ok(quirky.includes('<source src="quirky-ball/v2/loop.mp4" type="video/mp4"><source src="quirky-ball/v2/loop.webm" type="video/webm">'), `${file} Quirky Ball video has mp4 and webm sources`);
  assert.equal((quirky.match(/class="hd-phone-button /g) || []).length, 3, `${file} Quirky Ball phone shows its three side buttons`);

  assert.equal((html.match(/data-community-stats/g) || []).length, 1, `${file} one community stats block`);
  assert.ok(quirky.includes('<div class="hd-research" data-community-stats aria-busy="true">'), `${file} Quirky community stats live inside the Quirky Ball section`);
  assert.doesNotMatch(html, /<section class="community-section"|data-game-preview/, `${file} the old community band and project video preview are gone`);

  // --- lab notes: three equal YouTube cards with the channel link ---
  assert.match(lab, /^<section class="hd-lab" id="lab-notes" data-theme="paper" aria-labelledby="lab-title">/, `${file} lab notes section`);
  assert.ok(lab.includes('<a class="hd-arrow-link" href="https://www.youtube.com/@houseduck_in">'), `${file} links the YouTube channel`);
  assert.ok(lab.includes('<div class="hd-lab-grid" data-youtube-feed>'), `${file} feed container`);
  const cards = [...lab.matchAll(/<a class="youtube-card" data-youtube-card href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"><span class="hd-thumb"><img src="https:\/\/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\/hqdefault\.jpg" width="480" height="360" alt="" loading="lazy"><\/span><span><strong>([^<]+)<\/strong><\/span><\/a>/g)];
  assert.equal(cards.length, 3, `${file} needs three equal video cards`);
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} no other video cards`);
  for (const card of cards) assert.equal(card[1], card[2], `${file} card thumbnail matches its video`);
  assert.doesNotMatch(lab, /<small>/, `${file} cards carry no meta line`);

  // --- support: language-specific routes ---
  assert.ok(support.includes(`<a class="hd-btn hd-btn-primary" href="${l.support}" data-pressable>`), `${file} support button opens the right language section`);
  assert.deepEqual([...support.matchAll(/<nav class="hd-topics"[\s\S]*?<\/nav>/g)].map((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]))[0], [`support/#${l.lang}-purchase`, `support/#${l.lang}-bug`, `support/#${l.lang}-progress`, `quirky-ball/privacy/delete_${l.lang}.html`, `privacy/${l.lang}.html`], `${file} support topics`);

  // --- farewell: the dropped game, right under Quirky Ball: its old play loop in a phone, one line, no link, no status ---
  assert.match(farewell, /^<section class="hd-farewell home-farewell" id="comrade" data-theme="night" aria-labelledby="comrade-title">/, `${file} night farewell section`);
  assert.ok(farewell.includes(`<p class="farewell-name hd-farewell-name">${l.farewellName}</p>`), `${file} farewell names the game`);
  assert.ok(farewell.includes(`<h2 class="farewell-line hd-farewell-line" id="comrade-title">${copy[3]}</h2>`), `${file} farewell line is the section heading`);
  assert.ok(farewell.indexOf("farewell-name") < farewell.indexOf("farewell-line"), `${file} the game name comes before the line`);
  assert.doesNotMatch(farewell, /<a\b|개발 중|In development|In Entwicklung|開発中/, `${file} farewell has no link and no development status`);
  assert.match(farewell, /<figure class="hd-phone-figure hd-farewell-phone">/, `${file} farewell phone figure`);
  assert.ok(farewell.includes(`role="group" aria-label="${l.comradeGroup}"`), `${file} farewell phone is a labelled group`);
  assert.equal((farewell.match(/<video\b/g) || []).length, 1, `${file} one old play loop in the farewell phone`);
  const comradeVideo = farewell.match(/<video\b[^>]*>/)[0];
  for (const attribute of ["data-hero-gameplay", " autoplay", " muted", " loop", " playsinline", 'preload="none"', 'poster="assets/media/comrade-gameplay-poster.jpg"', `aria-label="${l.comradeVideo}"`]) assert.ok(comradeVideo.includes(attribute), `${file} farewell video needs ${attribute.trim()}`);
  assert.ok(farewell.includes('<source src="assets/media/comrade-gameplay.mp4" type="video/mp4"></video>'), `${file} farewell video plays the Comrade mp4`);
  assert.equal((farewell.match(/class="hd-phone-button /g) || []).length, 3, `${file} farewell phone shows its three side buttons`);
  assert.doesNotMatch(html, /hd-ghost|data-ghost|hd-ghost-canvas/, `${file} the ASCII ghost is gone`);
  assert.doesNotMatch(html.match(/<head>[\s\S]*<\/head>/)[0], /Comrade|동무|Genosse/, `${file} head must not mention the dropped Comrade project`);
  assert.doesNotMatch(html.replace(/<head>[\s\S]*<\/head>/, "").replace(farewell, ""), /comrade|동무|genosse/i, `${file} Comrade appears only in the farewell`);
  assert.equal((html.match(/comrade-gameplay\.mp4/g) || []).length, 1, `${file} Comrade footage plays only in the farewell phone`);

  // --- retired home features stay retired ---
  assert.doesNotMatch(html, /data-studio-hero|data-release-chamber|class="section-rail"|hero-background-word|data-motion-toggle|data-game-cursor|class="release-(?:copy|visual|heading|lede|button|readout|version)|class="project-(?:zone|card|phone|media|copy)|data-scroll-quirky/, `${file} old hero, rail, motion toggle and project zones stay removed`);
  assert.doesNotMatch(html, /data-quirky-mechanic|data-quirky-canvas|data-playable-phone|<iframe\b|scroll-quirky|hero-quirky|red-quirky\.svg/, `${file} hero must not show a Quirky Ball playable demo`);
  assert.doesNotMatch(html, /class="(?:hero-hook|studio-signature)"|intro-collage|SMALL IDEAS|REAL THINGS/, `${file} removed hero copy stays removed`);
  assert.doesNotMatch(html, /history-section|journal-section|작게 만들더라도 오래 기억되는 게임|European Restroom Map|project-k\/|\bproject k\b/i, `${file} keeps only the approved sections`);

  // --- navigation and in-page anchors ---
  assert.match(html, /<nav class="site-nav" id="site-navigation"[^>]*data-site-nav>.*<a href="#games">[^<]+<\/a><a href="#studio">[^<]+<\/a>/, `${file} header jumps to the games and the studio`);
  assert.ok(html.includes(`href="${l.about}"`), `${file} About link`);
  assert.ok(html.includes(`class="brand-lockup" href="${l.self}"`), `${file} logo returns to the same language home`);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`), `${file} in-page link #${anchor} needs a target`);
  assert.deepEqual([...html.matchAll(/data-lang-link="(\w+)"/g)].map((match) => match[1]), ["ko", "en", "de", "ja"], `${file} language picker`);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1, `${file} marks its own language`);
  assert.match(html.match(new RegExp(`<a [^>]*data-lang-link="${l.lang}"[^>]*>`))[0], /aria-current="page"/, `${file} marks ${l.lang} as current`);
  assert.deepEqual([...html.matchAll(/hreflang="(\w[\w-]*)" href="(https:\/\/houseduck\.in\/[^"]*)"/g)].map((match) => match[1]), ["ko", "en", "de", "ja", "x-default"], `${file} hreflang set`);

  // --- head: description, social card, fonts, scripts and styles ---
  assert.ok(html.match(/name="description" content="([^"]*)"/)[1].includes(expectedDescriptions[file]), `${file} description names 10key Survival and Quirky Ball`);
  assert.ok(html.includes('property="og:image" content="https://houseduck.in/assets/media/tenkey-og.jpg"'), `${file} social image is the 10key Survival key art`);
  assert.ok(html.includes('rel="preload" href="/assets/fonts/Montserrat-Variable.woff2" as="font" type="font/woff2" crossorigin'), `${file} must preload the hero font`);
  assert.match(html, /<script src="assets\/brand-site\.js(?:\?[^\"]+)?" defer><\/script>/, `${file} must not render-block on shared JavaScript`);
  const css = [...html.matchAll(/<link rel="stylesheet" href="assets\/(home|home-desk)\.css\?v=([\w.-]+)">/g)].map((match) => `${match[1]}@${match[2]}`);
  const js = [...html.matchAll(/<script src="assets\/(home|home-desk)\.js\?v=([\w.-]+)" defer><\/script>/g)].map((match) => `${match[1]}@${match[2]}`);
  assert.deepEqual(css.map((entry) => entry.split("@")[0]), ["home", "home-desk"], `${file} loads home.css then home-desk.css with a cache-busting version`);
  assert.deepEqual(js.map((entry) => entry.split("@")[0]), ["home", "home-desk"], `${file} loads home.js and home-desk.js deferred with a cache-busting version`);
  css.forEach((entry) => homeAssetVersions.css.add(entry));
  js.forEach((entry) => homeAssetVersions.js.add(entry));
  assert.doesNotMatch(html, /studio-home\.(?:css|js)/, `${file} no longer loads the studio-home assets (only quirky-ball/ does)`);
  assert.match(html, /community-stats\.js\?v=\d+" defer/, `${file} loads the community stats script`);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.equal((html.match(/house-duck-logo-96\.webp/g) || []).length, 2, `${file} needs optimized header and footer duck images`);
  assert.equal((html.match(/house-duck-wordmark-360\.webp/g) || []).length, 2, `${file} needs optimized header and footer wordmarks`);
  assert.equal((html.match(/quirky-ball\/v2\/loop\.mp4"/g) || []).length, 2, `${file} Quirky Ball 2.0 loop is wired twice: on the desk CRT and in the Quirky Ball phone`);
  const [title, description, imageAlt] = expectedOpenGraph[file];
  assert.ok(html.includes(`property="og:title" content="${title}"`), `${file} needs a localized Open Graph title`);
  assert.ok(html.includes(`property="og:description" content="${description}"`), `${file} needs a localized Open Graph description`);
  assert.ok(html.includes(`property="og:image:alt" content="${imageAlt}"`), `${file} needs localized social-image alt text`);

  // every local file the page points at must exist
  for (const [, ref] of html.matchAll(/(?:src|href)="((?!https?:|mailto:|#|\/\/)[^"?#]+\.(?:css|js|webp|png|jpg|svg|mp4|webm|woff2|json))(?:\?[^"]*)?"/g)) {
    assert.ok(fs.existsSync(path.join(root, ref.replace(/^\//, ""))), `${file}: ${ref} must exist`);
  }
}
for (const [kind, versions] of Object.entries(homeAssetVersions)) assert.equal(versions.size, 2, `the four home pages share one version per ${kind} file`);

// ---------- styles and scripts: the home sections and the studio-home files that quirky-ball/ still uses ----------
const homeCss = read("assets/home.css");
const deskCss = read("assets/home-desk.css");
const homeJs = read("assets/home.js");
const deskJs = read("assets/home-desk.js");
assert.match(homeCss, /\.hd-phone-shell\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*18/s, "9:16 footage sits in a slightly shorter phone so the HUD is not cropped");
assert.match(homeCss, /\.hd-phone-video\s*\{[^}]*object-fit:\s*contain/s, "10key footage letterboxes instead of cropping");
assert.match(homeCss, /\.hd-lab-grid\s*\{[^}]*repeat\(3,/s, "lab notes are three equal columns");
assert.match(homeCss, /\.hd-qb-logo\s*\{[^}]*aspect-ratio:\s*861\s*\/\s*551/s, "the Quirky Ball logo box keeps the proportions of the full logo the pieces were cut from");
assert.match(homeCss, /\.hd-qb-piece\s*\{[^}]*position:\s*absolute;[^}]*top:\s*var\(--t\);[^}]*left:\s*var\(--l\);[^}]*width:\s*var\(--w\)/s, "each logo piece sits at its own --l/--t/--w inside the logo box");
assert.match(homeCss, /\.hd-qb-logo\.is-in \.hd-qb-piece\s*\{[^}]*animation:\s*hd-qb-drop[^}]*calc\(var\(--i\) \* \d+ms\)/s, "once in view, the letters drop in one by one by their --i order");
assert.match(homeCss, /body\[data-hd-motion="full"\] \.hd-qb-logo:not\(\.is-in\) \.hd-qb-piece\s*\{\s*opacity:\s*0/, "letters stay hidden until the logo scrolls into view (full motion only)");
assert.match(homeCss, /\.store-button\s*\{[^}]*height:\s*54px[^}]*\}/s, "both store buttons share one height");
assert.match(homeCss, /\.store-copy strong\s*\{[^}]*font-size:\s*16px/s, "store buttons set the store name in the site's own type");
assert.match(homeCss, /\.hd-qb-phone \.hd-phone\s*\{[^}]*width:/s, "the Quirky Ball phone has its own size");
assert.doesNotMatch(homeCss, /\.hd-shot\b|\.hd-stack\b|\.hd-quirky-track|\.hd-ghost\b|google-play-badge img/, "the screenshot stack, the ASCII ghost and the Google Play bitmap badge have no styles left");
assert.match(homeCss, /\.hd-farewell\s*\{[^}]*background:\s*var\(--hd-night\)/s, "the farewell closes the page in the night tone");
assert.match(homeCss, /\.hd-farewell-phone \.hd-phone\s*\{[^}]*width:/s, "the farewell phone has its own size");
// Header: the dark House Duck bar by default; clear only while the bar is over the duck scene (data-hd-over-hero).
assert.match(homeCss, /body\[data-page="studio"\]\s*\{[^}]*--bar-bg:\s*rgba\(17,\s*20,\s*25,\s*\.97\)/s, "the studio header bar is dark by default");
assert.match(homeCss, /body\[data-page="studio"\]\[data-hd-over-hero\]\s*\{[^}]*--bar-bg:\s*transparent/s, "the bar turns transparent only over the hero");
assert.doesNotMatch(homeCss, /body\[data-page="studio"\]\[data-hd-theme="paper"\]\s*\{/, "the bar no longer turns paper over light sections");
assert.match(homeCss, /\.site-nav > a\s*\{[^}]*letter-spacing:\s*\.13em;[^}]*text-transform:\s*uppercase/s, "nav items are uppercase and tracked");
assert.match(homeCss, /\.site-nav \.nav-youtube::before\s*\{[^}]*display:\s*inline-block[^}]*border-radius:\s*50%[^}]*background:\s*var\(--hd-key-red\)/s, "the YouTube nav item keeps its red dot");
assert.ok(Number(deskCss.match(/\.hd-hero\s*\{[^}]*?\bheight:\s*(\d+)vh/s)?.[1]) >= 150, "the hero is a tall scroll track for the zoom into the CRT");
assert.match(deskCss, /\.hd-hero-sticky\s*\{[^}]*position:\s*sticky/s, "the desk stays pinned while the visitor scrolls through the track");
assert.match(deskCss, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.hd-hero\s*\{\s*height:\s*100vh/, "reduced motion turns the hero into one still screen");
assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hd-qb-piece\s*\{[^}]*animation:\s*none !important;[^}]*opacity:\s*1 !important/, "reduced motion shows the Quirky Ball logo letters in place");
assert.match(homeJs, /function reducedMotion\(\)[\s\S]*prefers-reduced-motion: reduce/, "home.js reads the reduced-motion setting");
assert.match(homeJs, /document\.body\.dataset\.hdMotion = reduced \? "reduce" : "full"/, "home.js exposes the motion mode on <body>");
assert.match(homeJs, /function setupQbLogo\(reduced\)[\s\S]*querySelector\("\[data-qb-logo\]"\)[\s\S]*classList\.add\("is-in"\)/, "home.js lands the Quirky Ball logo pieces by adding .is-in");
assert.match(homeJs, /if \(reduced \|\| !\("IntersectionObserver" in window\)\) \{ logo\.classList\.add\("is-in"\); return; \}/, "reduced motion (or no observer) shows the logo at once");
assert.match(homeJs, /function setupHeaderTheme\(\)[\s\S]*document\.body\.dataset\.hdTheme = theme[\s\S]*document\.body\.toggleAttribute\("data-hd-over-hero", overHero\)/, "home.js sets data-hd-theme per section and toggles data-hd-over-hero");
assert.match(homeJs, /overHero = !!hero && !hero\.classList\.contains\("is-entered"\) && hero\.getBoundingClientRect\(\)\.bottom > y/, "the bar is clear only while it is over the hero and the hero has not been entered");
assert.match(homeJs, /function setupHeroGlide\(reduced\)[\s\S]*addEventListener\("wheel"[\s\S]*addEventListener\("touchmove"[\s\S]*addEventListener\("keydown"[\s\S]*a\[href\^="#"\]/, "home.js glides the hero hand-off on wheel, swipe, key and in-page link");
assert.match(homeJs, /Math\.min\(2400, Math\.max\(1100, /, "the hero glide lasts about 1.1 to 2.4 seconds");
assert.match(homeJs, /setupHeroGlide\(reduced\);[\s\S]*setupQbLogo\(reduced\);/, "init wires the hero glide and the Quirky Ball logo");
assert.doesNotMatch(homeJs, /setupStack|setupGhost|data-stack|data-ghost/, "the screenshot stack and the ASCII ghost are gone from home.js");
assert.match(deskJs, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/, "home-desk.js reads the reduced-motion setting");
assert.match(deskJs, /if \(reduceMotion\.matches\) return 0;/, "reduced motion freezes the zoom at the desk");
assert.match(read("assets/home-desk.css"), /\.hd-visually-hidden\s*\{[^}]*clip-path:\s*inset\(50%\)/s, "the hero h1 stays available to screen readers");

// The 10key keypad toy builds its <img> sources from a prefix, key families, crack states and legends: every one must exist and stay small.
const keyMedia = homeJs.match(/const KEY_MEDIA = "([^"]+)";/);
if (keyMedia) {
  const families = [...new Set([...homeJs.matchAll(/\bfam: "(\w+)"/g)].map((match) => match[1]))];
  const legends = [...new Set([...homeJs.matchAll(/\blegend: "(\w+)"/g)].map((match) => match[1]))];
  const states = (homeJs.match(/const KEY_STATES = \[([^\]]+)\]/)?.[1] || "").match(/"(\w+)"/g)?.map((state) => state.replaceAll('"', "")) || [];
  assert.ok(families.length >= 4 && legends.length >= 17 && states.length >= 5, "the keypad toy lists its families, legends and crack states");
  const files = [
    ...families.flatMap((family) => states.map((state) => `${keyMedia[1]}key-${family}_${state}.webp`)),
    ...legends.map((legend) => `${keyMedia[1]}legend-${legend}.webp`),
    ...[1, 2, 3, 4].map((shard) => `${keyMedia[1]}key-shard_${shard}.webp`),
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is requested by the keypad toy and must exist`);
    assert.ok(fs.statSync(path.join(root, file)).size <= 40_000, `${file} must stay a small sprite`);
  }
}

// quirky-ball/ still loads these two; the Quirky mechanic, store-badge and phone rules stay covered there.
assert.match(read("assets/studio-home.css"), /\.project-phone img\s*\{[^}]*object-fit:\s*contain/s, "hexaworld1984 development capture must letterbox instead of cropping");
assert.match(read("assets/studio-home.js"), /context\.setTransform\(1, 0, 0, 1, 0, 0\);\s*context\.clearRect\(0, 0, canvas\.width, canvas\.height\);/, "each frame must clear the full backing canvas before restoring its logical scale");

console.log("studio home contract: PASS");
