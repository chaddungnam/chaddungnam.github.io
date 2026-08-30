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
assert.equal(
  crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "assets/media/quirky-ball-gameplay.mp4"))).digest("hex"),
  "719e199362e3ba0b9eefbc163071927e3969a6193d71fd2800aea0679d77da15",
  "home gameplay must remain the approved Quirky Ball 1.1.0 capture",
);

const svg = read("assets/red-quirky.svg");
assert.match(svg, /viewBox="0 0 240 260"/);
assert.match(svg, /data-part="left-foot"/);
assert.match(svg, /data-part="right-foot"/);
assert.match(svg, /data-part="face"/);

const expectedCopy = {
  "index.html": ["Are you ready?", "Houseduck.in", "기술과 속도의 강국 한국에서 온 인재가 품질의 나라 독일에서 소프트웨어를 만듭니다.", "출시 예정 미정"],
  "index_en.html": ["Are you ready?", "Houseduck.in", "Release date TBD"],
  "index_de.html": ["Are you ready?", "Houseduck.in", "Veröffentlichungstermin offen"],
  "index_ja.html": ["Are you ready?", "Houseduck.in", "発売時期未定"],
};

const expectedOpenGraph = {
  "index.html": ["House Duck — 독일의 1인 인디 게임 스튜디오", "준비됐나요? House Duck의 릴리스 랩에서 Quirky Ball 1.1.0을 만나보세요.", "House Duck 릴리스 랩의 Quirky Ball 1.1.0 실제 플레이"],
  "index_en.html": ["House Duck — Independent Game Studio", "Are you ready? Quirky Ball 1.1.0 in the House Duck release lab.", "Quirky Ball 1.1.0 gameplay in the House Duck release lab"],
  "index_de.html": ["House Duck — Unabhängiges Spielestudio in Deutschland", "Bereit? Quirky Ball 1.1.0 im Release-Labor von House Duck.", "Quirky Ball 1.1.0 Gameplay im Release-Labor von House Duck"],
  "index_ja.html": ["House Duck — ドイツのインディーゲームスタジオ", "準備はいい？House DuckのリリースラボでQuirky Ball 1.1.0を紹介します。", "House Duckのリリースラボで動くQuirky Ball 1.1.0"],
};

for (const [file, copy] of Object.entries(expectedCopy)) {
  const html = read(file);
  for (const text of copy) assert.ok(html.includes(text), `${file} must include ${text}`);
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} needs three equal video cards`);
  assert.equal((html.match(/data-project="/g) || []).length, 2, `${file} needs exactly two projects`);
  assert.equal((html.match(/data-motion-toggle/g) || []).length, 1, `${file} needs one automatic-motion control`);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.doesNotMatch(html, /history-section|journal-section|작게 만들더라도 오래 기억되는 게임/);
  const [title, description, imageAlt] = expectedOpenGraph[file];
  assert.ok(html.includes(`property="og:title" content="${title}"`), `${file} needs a localized Open Graph title`);
  assert.ok(html.includes(`property="og:description" content="${description}"`), `${file} needs a localized Open Graph description`);
  assert.ok(html.includes(`property="og:image:alt" content="${imageAlt}"`), `${file} needs localized social-image alt text`);
}

console.log("studio home contract: PASS");
