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

const expectedHeroLabels = {
  "index.html": "10key Survival 실제 플레이 영상",
  "index_en.html": "Real 10key Survival gameplay",
  "index_de.html": "Echtes 10key-Survival-Gameplay",
  "index_ja.html": "10key Survivalの実際のプレイ映像",
};

const expectedDescriptions = {
  "index.html": "딸깍 서바이벌(10key Survival)과 Quirky Ball을",
  "index_en.html": "10key Survival and Quirky Ball",
  "index_de.html": "10key Survival und Quirky Ball",
  "index_ja.html": "10key SurvivalとQuirky Ball",
};

// 10key Survival home media (copied from the game repo, sized for the web).
const tenkeyMedia = { "assets/media/tenkey-gameplay.mp4": 2_500_000, "assets/media/tenkey-gameplay.webm": 2_500_000, "assets/media/tenkey-gameplay-poster.webp": 150_000, "assets/media/tenkey-zone-ko.webp": 150_000, "assets/media/tenkey-zone-en.webp": 150_000, "assets/media/tenkey-og.jpg": 300_000 };
for (const [asset, limit] of Object.entries(tenkeyMedia)) {
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

for (const asset of ["assets/house-duck-logo-96.webp", "assets/house-duck-wordmark-360.webp"]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  assert.ok(fs.statSync(path.join(root, asset)).size < 10_000, `${asset} must stay below 10KB`);
}

for (const [file, copy] of Object.entries(expectedCopy)) {
  const html = read(file);
  for (const text of copy) assert.ok(html.includes(text), `${file} must include ${text}`);
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} needs three equal video cards`);
  assert.equal((html.match(/data-project="/g) || []).length, 2, `${file} needs exactly two projects (10key Survival, Quirky Ball)`);
  assert.doesNotMatch(html, /data-project="hexaworld1984"|hexaworld1984\//, `${file} must not show or link the dropped Comrade project`);
  assert.doesNotMatch(html, /data-quirky-mechanic|data-quirky-canvas|data-playable-phone|<iframe\b|scroll-quirky|hero-quirky|red-quirky\.svg/, `${file} hero must not show Quirky Ball anymore`);
  assert.match(html, /<h1 id="studio-title">(?:10key Survival|딸깍 서바이벌 <span class="release-title-alt" lang="en">10key Survival<\/span>)<\/h1>/, `${file} hero title is the game`);
  assert.ok(html.match(/name="description" content="([^"]*)"/)[1].includes(expectedDescriptions[file]), `${file} description names 10key Survival and Quirky Ball`);
  assert.doesNotMatch(html.match(/<head>[\s\S]*<\/head>/)[0], /Comrade|동무|Genosse/, `${file} head must not mention the dropped Comrade project`);
  assert.ok(html.includes('property="og:image" content="https://houseduck.in/assets/media/tenkey-og.jpg"'), `${file} social image is the 10key Survival key art`);
  assert.ok(html.includes("assets/media/tenkey-gameplay.mp4") && html.includes("assets/media/tenkey-gameplay.webm") && html.includes("assets/media/tenkey-gameplay-poster.webp"), `${file} hero plays the 10key Survival loop`);
  const unreleased = html.match(/<section class="studio-hero[\s\S]*?<\/section>/)[0] + html.match(/<div class="project-zone project-zone-tenkey"[\s\S]*?<div class="project-zone project-zone-quirky"/)[0];
  assert.doesNotMatch(unreleased, /play\.google\.com|apps\.apple\.com/, `${file} 10key Survival has no store link before release`);
  assert.match(html, /<section class="studio-hero studio-hero-tenkey"/, `${file} hero is the 10key Survival hero`);
  assert.ok(html.indexOf('class="project-zone project-zone-tenkey"') < html.indexOf('class="project-zone project-zone-quirky"'), `${file} 10key Survival zone comes before Quirky Ball`);
  assert.ok(html.indexOf("data-community-stats") > html.indexOf('class="project-zone project-zone-quirky"'), `${file} community stats follow the Quirky Ball zone`);
  assert.match(html, /class="project-stores"><div class="release-actions"><a class="google-play-badge"/, `${file} Quirky Ball keeps its store badges inside its zone`);
  assert.doesNotMatch(html.match(/<section class="studio-hero[\s\S]*?<\/section>/)[0], /google-play-badge|app-store-badge/, `${file} hero must not show store badges for an unreleased game`);
  const eyebrows = [...html.matchAll(/<p class="eyebrow">(\d\d) [\/·]/g)].map((match) => Number(match[1]));
  assert.deepEqual(eyebrows, [1, 2, 3, 4, 5], `${file} numbered eyebrows read in page order`);
  assert.deepEqual([...html.matchAll(/class="section-rail"[\s\S]*?<\/nav>/g)].map((m) => [...m[0].matchAll(/href="(#[^"]+)"/g)].map((x) => x[1]))[0], ["#studio", "#games", "#research", "#lab-notes"], `${file} section rail follows page order`);
  for (const text of ["#studio", "#games", "#research", "#lab-notes", "#player-support"]) assert.ok(html.includes(`id="${text.slice(1)}"`), `${file} needs ${text}`);
  assert.equal((html.match(/class="home-farewell"/g) || []).length, 1, `${file} needs one quiet Comrade farewell`);
  assert.ok(html.indexOf('class="home-farewell"') > html.indexOf('id="player-support"') && html.indexOf('class="home-farewell"') < html.indexOf("</main>"), `${file} farewell is the last block before the footer`);
  assert.doesNotMatch(html.match(/<section class="home-farewell"[\s\S]*?<\/section>/)[0], /<a\b|개발 중|In development|In Entwicklung|開発中/, `${file} farewell has no link and no development status`);
  assert.doesNotMatch(html, /<section class="project-zone/, `${file} project articles must not be wrapped in redundant sections`);
  assert.equal((html.match(/data-motion-toggle/g) || []).length, 1, `${file} needs one automatic-motion control`);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.doesNotMatch(html, /history-section|journal-section|작게 만들더라도 오래 기억되는 게임/);
  assert.ok(html.includes('rel="preload" href="/assets/fonts/Montserrat-Variable.woff2" as="font" type="font/woff2" crossorigin'), `${file} must preload the hero font`);
  assert.match(html, /<script src="assets\/brand-site\.js(?:\?[^\"]+)?" defer><\/script>/, `${file} must not render-block on shared JavaScript`);
  assert.equal((html.match(/house-duck-logo-96\.webp/g) || []).length, 2, `${file} needs optimized header and footer duck images`);
  assert.equal((html.match(/house-duck-wordmark-360\.webp/g) || []).length, 2, `${file} needs optimized header and footer wordmarks`);
  assert.equal((html.match(/quirky-ball\/v2\/loop\.mp4"/g) || []).length, 1, `${file} Quirky Ball zone must use the 2.0 loop`);
  assert.equal((html.match(/quirky-ball\/v2\/loop-poster\.webp"/g) || []).length, 1, `${file} Quirky Ball zone must use the 2.0 loop poster`);
  assert.ok(html.includes(expectedHeroLabels[file]), `${file} must include its localized hero label`);
  assert.doesNotMatch(html, /<button class="motion-toggle"[^>]+aria-label=/, `${file} motion control must use its visible label`);
  assert.doesNotMatch(html, /<p class="hero-loop"[^>]+aria-label=/, `${file} action keywords must use their visible text`);
  const [title, description, imageAlt] = expectedOpenGraph[file];
  assert.ok(html.includes(`property="og:title" content="${title}"`), `${file} needs a localized Open Graph title`);
  assert.ok(html.includes(`property="og:description" content="${description}"`), `${file} needs a localized Open Graph description`);
  assert.ok(html.includes(`property="og:image:alt" content="${imageAlt}"`), `${file} needs localized social-image alt text`);
}

assert.match(read("assets/studio-home.css"), /\.project-phone img\s*\{[^}]*object-fit:\s*contain/s, "hexaworld1984 development capture must letterbox instead of cropping");
assert.match(read("assets/studio-home.js"), /context\.setTransform\(1, 0, 0, 1, 0, 0\);\s*context\.clearRect\(0, 0, canvas\.width, canvas\.height\);/, "each frame must clear the full backing canvas before restoring its logical scale");

console.log("studio home contract: PASS");
