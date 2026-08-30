const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtimePath = path.join(root, "assets/studio-home.js");

assert.ok(fs.existsSync(runtimePath), "assets/studio-home.js must exist");
const { QUIRKY_RULES, shotAngles, shrinkRadius } = require(runtimePath);

assert.deepEqual(QUIRKY_RULES, {
  totalTurns: 5.25,
  eventSeconds: 2.4,
  shotsPerSecond: 18,
  pairInterval: 0.11,
  shrinkMin: 0.84,
  shrinkMax: 0.95,
  maxBounces: 2,
});
assert.deepEqual(shotAngles(0, 0), [0, Math.PI]);
assert.equal(shrinkRadius(100, 0), 84);
assert.equal(shrinkRadius(100, 1), 95);

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
}

console.log("studio home contract: PASS");
