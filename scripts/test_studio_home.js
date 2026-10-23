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
// lab notes -> player support -> Comrade farewell. assets/studio-home.* now only serve quirky-ball/.
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
  "index.html": { lang: "ko", self: "./?lang=ko", about: "about/", support: "support/", videoGroup: "딸깍 서바이벌 실제 플레이 영상", videoLabel: "딸깍 서바이벌 실제 플레이", tenkeyTitle: '딸깍 서바이벌<span class="hd-title-alt" lang="en">10key Survival</span>', farewellName: "동무와 멋진신세계" },
  "index_en.html": { lang: "en", self: "index_en.html?lang=en", about: "about/index_en.html?lang=en", support: "support/#english", videoGroup: "10key Survival gameplay video", videoLabel: "10key Survival gameplay", tenkeyTitle: "10key Survival", farewellName: "Comrade and the Brave New World" },
  "index_de.html": { lang: "de", self: "index_de.html?lang=de", about: "about/index_de.html?lang=de", support: "support/#german", videoGroup: "10key Survival Gameplay-Video", videoLabel: "10key Survival Gameplay", tenkeyTitle: "10key Survival", farewellName: "Genosse und die schöne neue Welt" },
  "index_ja.html": { lang: "ja", self: "index_ja.html?lang=ja", about: "about/index_ja.html?lang=ja", support: "support/#japanese", videoGroup: "10key Survivalのプレイ映像", videoLabel: "10key Survivalのプレイ", tenkeyTitle: "10key Survival", farewellName: "Comrade and the Brave New World" },
};

// Home media: the desk scene layers drawn on the hero canvas, the 10key loop and the social image.
const homeMedia = {
  "assets/media/tenkey-gameplay.mp4": 2_500_000,
  "assets/media/tenkey-gameplay.webm": 2_500_000,
  "assets/media/tenkey-gameplay-poster.webp": 150_000,
  "assets/media/tenkey-og.jpg": 300_000,
  "assets/media/comrade-gameplay-poster.jpg": 100_000,
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
  "index.html": ["https://apps.apple.com/app/id6797996754", "딸깍 서바이벌", "출시 준비 중", "다른 장르의 게임에서 만나요", "동무와 멋진신세계"],
  "index_en.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "Coming soon", "See you in a game of another genre", "Comrade and the Brave New World"],
  "index_de.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "Bald verfügbar", "Wir sehen uns in einem Spiel eines anderen Genres", "Genosse und die schöne neue Welt"],
  "index_ja.html": ["https://apps.apple.com/app/id6797996754", "10key Survival", "近日配信予定", "別のジャンルのゲームでまた会いましょう", "Comrade and the Brave New World"],
};

const expectedOpenGraph = {
  "index.html": ["House Duck — 독일의 1인 인디 게임 스튜디오", "신작 딸깍 서바이벌(10key Survival)은 출시 준비 중이에요. Quirky Ball은 지금 iOS와 Android에서 만나보세요.", "딸깍 서바이벌(10key Survival) 대표 이미지. 3D 키보드 위의 텐키와 마우스"],
  "index_en.html": ["House Duck — Independent Game Studio", "10key Survival is coming soon. Quirky Ball is out now on iOS and Android.", "10key Survival key art: a living numpad and a mouse on a 3D keyboard"],
  "index_de.html": ["House Duck — Unabhängiges Spielestudio in Deutschland", "10key Survival erscheint bald. Quirky Ball gibt es jetzt auf iOS und Android.", "Key Art von 10key Survival: ein lebendiger Ziffernblock und eine Maus auf einer 3D-Tastatur"],
  "index_ja.html": ["House Duck — ドイツのインディーゲームスタジオ", "10key Survivalは近日配信予定。Quirky Ballは今すぐiOSとAndroidで遊べます。", "10key Survivalのキーアート：3Dキーボードの上の生きたテンキとマウス"],
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

  // --- section order: hero, 10key Survival first, Quirky Ball (with its community block), lab notes, support, farewell ---
  const hero = sectionOf(html, "studio");
  const tenkey = sectionOf(html, "games");
  const quirky = sectionOf(html, "quirky");
  const lab = sectionOf(html, "lab-notes");
  const support = sectionOf(html, "player-support");
  const farewell = (html.match(/<section class="hd-farewell home-farewell"[\s\S]*?<\/section>/) || [""])[0];
  for (const [name, block] of Object.entries({ hero, tenkey, quirky, lab, support, farewell })) assert.ok(block, `${file} needs its ${name} section`);
  const positions = ['id="studio"', 'id="games"', 'id="quirky"', 'id="lab-notes"', 'id="player-support"', 'class="hd-farewell home-farewell"', "</main>"].map((token) => html.indexOf(token));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), `${file} sections read hero, 10key Survival, Quirky Ball, lab notes, support, farewell`);
  assert.equal((html.match(/class="hd-farewell home-farewell"/g) || []).length, 1, `${file} needs one quiet Comrade farewell`);
  assert.ok(html.indexOf('class="hd-farewell home-farewell"') < html.indexOf("</main>") && html.indexOf("</main>") < html.indexOf("<footer"), `${file} farewell is the last block before the footer`);

  // --- hero: the pixel desk scene, no overlay copy, the h1 is for search and screen readers ---
  assert.match(hero, /^<section class="hd-hero" id="studio" data-theme="night" aria-labelledby="studio-title">/, `${file} night hero`);
  assert.match(hero, /<div class="hd-desk" data-desk data-desk-tenkey="assets\/media\/tenkey-gameplay\.mp4" data-desk-quirky="quirky-ball\/v2\/loop\.mp4">/, `${file} desk plays the 10key Survival loop and the Quirky Ball 2.0 loop on its CRT`);
  assert.match(hero, /<a class="hd-desk-screen-link" href="#games" aria-label="[^"]+"><\/a>/, `${file} the CRT screen links down to 10key Survival`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file} needs exactly one h1`);
  assert.match(hero, /<h1 class="hd-visually-hidden" id="studio-title">House Duck<\/h1>/, `${file} h1 names the studio`);
  assert.equal(hero.replace(/<[^>]*>/g, "").trim(), "House Duck", `${file} the desk scene carries no overlay copy`);
  assert.doesNotMatch(hero, /Quirky|google-play|apps\.apple|<video|<img|<button/, `${file} hero is the scene only`);

  // --- 10key Survival (first game, unreleased: no store links) ---
  assert.match(tenkey, /^<section class="hd-tenkey" id="games" data-theme="paper" data-tenkey aria-labelledby="tenkey-title">/, `${file} 10key Survival section`);
  assert.ok(tenkey.includes(`<h2 class="hd-title" id="tenkey-title">${l.tenkeyTitle}</h2>`), `${file} section title is the game`);
  assert.match(tenkey, /<span class="hd-chip hd-chip-status">[^<]+<\/span>/, `${file} shows a release status chip`);
  assert.ok(tenkey.includes(`hd-chip hd-chip-status">${copy[2]}<`), `${file} status chip says ${copy[2]}`);
  assert.deepEqual([...tenkey.matchAll(/<li class="hd-chip">([^<]+)<\/li>/g)].map((match) => match[1]).slice(0, 2), ["iOS", "Android"], `${file} names both platforms`);
  assert.deepEqual([...tenkey.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]), ['<a class="hd-keycap-cta" href="10key/" data-pressable>'], `${file} one pressable keycap link to the 10key page`);
  assert.match(tenkey, /<p class="hd-disclosure">[^<]+<\/p>/, `${file} discloses the paid model`);
  assert.equal((tenkey.match(/<video\b/g) || []).length, 1, `${file} one gameplay loop in the 10key phone`);
  const video = tenkey.match(/<video\b[^>]*>/)[0];
  for (const attribute of ["data-hero-gameplay", " autoplay", " muted", " loop", " playsinline", 'preload="none"', 'poster="assets/media/tenkey-gameplay-poster.webp"', `aria-label="${l.videoLabel}"`]) assert.ok(video.includes(attribute), `${file} gameplay video needs ${attribute.trim()}`);
  assert.ok(tenkey.includes('<source src="assets/media/tenkey-gameplay.mp4" type="video/mp4"><source src="assets/media/tenkey-gameplay.webm" type="video/webm">'), `${file} gameplay video has mp4 and webm sources`);
  assert.ok(tenkey.includes(`role="group" aria-label="${l.videoGroup}"`), `${file} phone is a labelled group`);
  assert.match(tenkey, /<figcaption class="hd-micro">[^<]+<\/figcaption>/, `${file} says the footage comes from a pre-release build`);
  assert.equal((tenkey.match(/class="hd-phone-button /g) || []).length, 3, `${file} phone shows its three side buttons`);
  assert.match(tenkey, /data-key-hint aria-hidden="true">[^<]+<\/p>/, `${file} hints that the keycaps can be pressed`);
  assert.doesNotMatch(hero + tenkey, /play\.google\.com|apps\.apple\.com|google-play-badge|app-store-badge/, `${file} 10key Survival has no store link before release`);
  assert.doesNotMatch(tenkey, /Quirky/, `${file} the 10key Survival section does not mention Quirky Ball`);

  // --- Quirky Ball: the only released game, store badges, live version, ten real screens, community block ---
  assert.match(quirky, /^<section class="hd-quirky" id="quirky" data-theme="paper" aria-labelledby="quirky-title" data-project="quirky-ball">/, `${file} Quirky Ball section`);
  assert.equal((html.match(/data-project="/g) || []).length, 1, `${file} only Quirky Ball is a data-project zone`);
  assert.doesNotMatch(html, /data-project="(?:hexaworld1984|tenkey-survival)"|hexaworld1984\//, `${file} must not show or link the dropped Comrade project`);
  assert.ok(html.indexOf('id="games"') < html.indexOf('id="quirky"'), `${file} 10key Survival comes before Quirky Ball`);
  assert.match(quirky, /<h2 class="hd-title" id="quirky-title">Quirky Ball<\/h2>/, `${file} Quirky Ball title`);
  assert.match(quirky, /<span data-live-version>2\.0\.0<\/span>/, `${file} shows the 2.0.0 fallback until the console version arrives`);
  assert.equal((html.match(/data-live-version/g) || []).length, 1, `${file} one live version hook`);
  assert.match(quirky, new RegExp(`<a class="google-play-badge" href="https://play\\.google\\.com/store/apps/details\\?id=com\\.quirkyball\\.app"><img src="assets/store-badges/google-play-${l.lang}-light\\.svg" width="182" height="54" alt="[^"]+">`), `${file} localized Google Play badge`);
  assert.ok(fs.existsSync(path.join(root, `assets/store-badges/google-play-${l.lang}-light.svg`)), `${file} badge image exists`);
  assert.match(quirky, /<a class="app-store-badge" href="https:\/\/apps\.apple\.com\/app\/id6797996754"/, `${file} App Store links to the released iOS app`);
  assert.equal((quirky.match(/class="(?:google-play|app-store)-badge"/g) || []).length, 2, `${file} exactly the two store badges`);
  assert.match(quirky, /<p class="store-disclosure">[^<]+<\/p>/, `${file} discloses ads and purchases`);
  assert.ok(quirky.includes(`<a class="hd-arrow-link" href="quirky-ball/?lang=${l.lang}">`), `${file} links the Quirky Ball page in its own language`);
  const shots = [...quirky.matchAll(/<figure class="hd-shot" role="listitem" data-shot data-caption="([^"]+)"><img src="(quirky-ball\/v2\/shot-(\d\d)-600\.webp)" width="600" height="1298" alt="([^"]+)" loading="(eager|lazy)" decoding="async"><\/figure>/g)];
  assert.deepEqual(shots.map((shot) => shot[3]), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"], `${file} stack shows the ten 2.0 store screens in order`);
  assert.deepEqual(shots.map((shot) => shot[5]), ["eager", ...Array(9).fill("lazy")], `${file} only the first screen loads eagerly`);
  assert.equal(new Set(shots.map((shot) => shot[1])).size, 10, `${file} every screen has its own caption`);
  for (const shot of shots) {
    assert.ok(fs.existsSync(path.join(root, shot[2])), `${file}: ${shot[2]} must exist`);
    assert.deepEqual(webpSize(path.join(root, shot[2])), { width: 600, height: 1298 }, `${file}: ${shot[2]} must match its declared 600x1298 so the stack keeps its proportions`);
    assert.ok(fs.statSync(path.join(root, shot[2])).size <= 120_000, `${shot[2]} must stay a compressed display-size WebP`);
    assert.ok(shot[4].includes(shot[1]), `${file}: alt text of ${shot[2]} names its caption`);
  }
  assert.match(quirky, /data-stack-list role="list" aria-label="[^"]+"/, `${file} stack is a labelled list`);
  assert.deepEqual([...quirky.matchAll(/data-stack-index>([^<]+)</g)].map((match) => match[1]), ["01 / 10", "01 / 10"], `${file} counter starts at 01 / 10`);
  assert.deepEqual([...quirky.matchAll(/data-stack-caption>([^<]+)</g)].map((match) => match[1]), [shots[0][1], shots[0][1]], `${file} caption starts with the first screen`);
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

  // --- farewell: quiet, no link, no status, Comrade nowhere else on the page ---
  assert.ok(farewell.includes(`<p class="farewell-name hd-farewell-name">${l.farewellName}</p>`), `${file} farewell names the game`);
  assert.ok(farewell.includes(`<p class="farewell-line hd-farewell-line">${copy[3]}</p>`), `${file} farewell line`);
  assert.doesNotMatch(farewell, /<a\b|개발 중|In development|In Entwicklung|開発中/, `${file} farewell has no link and no development status`);
  assert.match(farewell, /<div class="hd-ghost" data-ghost data-ghost-src="assets\/media\/comrade-gameplay-poster\.jpg"><canvas class="hd-ghost-canvas" aria-hidden="true"><\/canvas><img class="hd-ghost-fallback" src="assets\/media\/comrade-gameplay-poster\.jpg" width="640" height="1402" alt="" loading="lazy" decoding="async"><\/div>/, `${file} ASCII ghost of the poster with a plain image fallback`);
  assert.doesNotMatch(html.match(/<head>[\s\S]*<\/head>/)[0], /Comrade|동무|Genosse/, `${file} head must not mention the dropped Comrade project`);
  assert.doesNotMatch(html.replace(/<head>[\s\S]*<\/head>/, "").replace(farewell, ""), /comrade|동무|genosse/i, `${file} Comrade appears only in the farewell`);
  assert.doesNotMatch(html, /comrade-gameplay\.mp4/, `${file} must not play Comrade footage`);

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
  assert.equal((html.match(/quirky-ball\/v2\/loop\.mp4"/g) || []).length, 1, `${file} Quirky Ball 2.0 loop is wired once (on the desk CRT)`);
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
assert.match(homeCss, /\.hd-shot img\s*\{[^}]*object-fit:\s*cover/s, "store screens fill their frame");
assert.match(homeCss, /\.hd-farewell\s*\{[^}]*background:\s*var\(--hd-night\)/s, "the farewell closes the page in the night tone");
assert.match(homeCss, /\.hd-ghost\s*\{[^}]*aspect-ratio:\s*640\s*\/\s*1402/s, "the ghost keeps the poster proportions");
assert.match(homeCss, /body\[data-page="studio"\]\[data-hd-theme="paper"\]/, "the header pill has a paper variant");
assert.ok(Number(deskCss.match(/\.hd-hero\s*\{[^}]*?\bheight:\s*(\d+)vh/s)?.[1]) >= 150, "the hero is a tall scroll track for the zoom into the CRT");
assert.match(deskCss, /\.hd-hero-sticky\s*\{[^}]*position:\s*sticky/s, "the desk stays pinned while the visitor scrolls through the track");
assert.match(deskCss, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.hd-hero\s*\{\s*height:\s*100vh/, "reduced motion turns the hero into one still screen");
assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hd-shot\s*\{[^}]*transform:\s*none !important/, "reduced motion lays the Quirky Ball screens flat");
assert.match(homeJs, /function reducedMotion\(\)[\s\S]*prefers-reduced-motion: reduce/, "home.js reads the reduced-motion setting");
assert.match(homeJs, /document\.body\.dataset\.hdMotion = reduced \? "reduce" : "full"/, "home.js exposes the motion mode on <body>");
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
