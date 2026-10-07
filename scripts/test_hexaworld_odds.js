const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function summingTables(html) {
  return [...html.matchAll(/<table data-odds-sum="100">([\s\S]*?)<\/table>/g)].map((match) => {
    const rows = [...match[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    const percents = [];
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
      const last = cells.at(-1) || "";
      const found = last.match(/^(\d+(?:\.\d+)?)%$/);
      if (found) percents.push(Number(found[1]));
    }
    return percents;
  });
}

for (const file of ["hexaworld1984/odds/ko.html", "hexaworld1984/odds/en.html"]) {
  const html = read(file);
  const tables = summingTables(html);
  assert.equal(tables.length, 7, `${file} must publish seven tables that add to 100%`);
  for (const percents of tables) {
    const sum = Math.round(percents.reduce((total, value) => total + value, 0) * 100) / 100;
    assert.equal(sum, 100, `${file} table ${percents.join("+")} sums to ${sum}`);
  }
  for (const token of ["62.0%", "28.0%", "8.5%", "1.5%", "10.33%", "7.00%", "2.83%", "0.75%", "73.34%", "23.33%", "3.33%", "93.6%", "100%"]) {
    assert.match(html, new RegExp(token.replace(".", "\\.")), `${file} missing ${token}`);
  }
  assert.match(html, /50/, `${file} must state the 50-open pity`);
  assert.match(html, /2\.828535/, `${file} must state the unrounded pity-inclusive rate`);
  assert.match(html, /data-odds-independent/, `${file} must keep separate-roll tables out of the 100% total`);
}

assert.match(read("hexaworld1984/index.html"), /href="odds\/"/, "the game hub must link to odds");
assert.match(read("hexaworld1984/index_ko.html"), /href="odds\/ko\.html"/, "the Korean game page footer must link to odds");
assert.match(read("hexaworld1984/index_en.html"), /href="odds\/en\.html"/, "the English game page footer must link to odds");
assert.match(read("hexaworld1984/privacy/ko.html"), /href="\.\.\/odds\/ko\.html"/, "Korean privacy must link to odds next to the other game documents");
assert.match(read("hexaworld1984/terms/en.html"), /href="\.\.\/odds\/en\.html"/, "English terms must link to odds next to the other game documents");
assert.match(read("sitemap.xml"), /hexaworld1984\/odds\/ko\.html/, "sitemap must list the Korean odds page");
assert.match(read("sitemap.xml"), /hexaworld1984\/odds\/en\.html/, "sitemap must list the English odds page");

console.log("hexaworld odds: PASS");
