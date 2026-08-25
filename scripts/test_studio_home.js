const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtimePath = path.join(root, "assets/studio-home.js");

assert.ok(fs.existsSync(runtimePath), "assets/studio-home.js must exist");
const { QUIRKY_RULES, shotAngles, shrinkRadius } = require(runtimePath);

assert.deepEqual(QUIRKY_RULES, {
  totalTurns: 4.5,
  eventSeconds: 2.25,
  shotsPerSecond: 8,
  pairInterval: 0.25,
  shrinkMin: 0.82,
  shrinkMax: 0.94,
  maxBounces: 1,
});
assert.deepEqual(shotAngles(0, 0), [0, Math.PI]);
assert.equal(shrinkRadius(100, 0), 82);
assert.equal(shrinkRadius(100, 1), 94);

const svg = read("assets/red-quirky.svg");
assert.match(svg, /viewBox="0 0 240 260"/);
assert.match(svg, /data-part="left-foot"/);
assert.match(svg, /data-part="right-foot"/);
assert.match(svg, /data-part="face"/);

const expectedCopy = {
  "index.html": ["Made in Germany", "from South Korea", "기술과 속도의 강국 한국에서 온 인재가 품질의 나라 독일에서 소프트웨어를 만듭니다.", "출시 예정 미정"],
  "index_en.html": ["Made in Germany", "from South Korea", "Release date TBD"],
  "index_de.html": ["Made in Germany", "from South Korea", "Veröffentlichungstermin offen"],
  "index_ja.html": ["Made in Germany", "from South Korea", "発売時期未定"],
};

for (const [file, copy] of Object.entries(expectedCopy)) {
  const html = read(file);
  for (const text of copy) assert.ok(html.includes(text), `${file} must include ${text}`);
  assert.equal((html.match(/data-youtube-card/g) || []).length, 3, `${file} needs three equal video cards`);
  assert.equal((html.match(/data-project="/g) || []).length, 2, `${file} needs exactly two projects`);
  assert.doesNotMatch(html, /history-section|journal-section|작게 만들더라도 오래 기억되는 게임/);
}

console.log("studio home contract: PASS");
