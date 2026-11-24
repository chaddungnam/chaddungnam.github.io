// Run with the client checkout path. Hand table must match client clamps AND actual code defaults before landing.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const client = process.argv[2];
if (!client) throw Error("Pass the 10KEY client checkout path");
const site = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(p, "utf8");
const tunes = vm.runInNewContext("(" + read(path.join(site, "console/tenkey-balance.js")).match(/const TUNES = (\{[\s\S]*?\n  \});/)[1] + ")");
const ranges = vm.runInNewContext("(" + read(path.join(client, "scripts/data/balance_tune_data.gd")).match(/const RANGES := (\{[\s\S]*?\n\})/)[1] + ")");
assert.deepEqual(Object.keys(tunes).sort(), Object.keys(ranges).sort());
for (const [name, row] of Object.entries(tunes)) assert.equal(JSON.stringify(row.slice(2)), JSON.stringify(ranges[name]), name + " bounds differ");
const sql = path.join(client, "qa_output/handoff/balknob1124/hx_wt/supabase/migrations/20261124230000_tenkey_balance_tune.sql");
if (fs.existsSync(sql)) {
  const server = JSON.parse(read(sql).match(/bounds constant jsonb := '(\{[\s\S]*?\})';/)[1]);
  assert.equal(JSON.stringify(Object.keys(server).sort()), JSON.stringify(Object.keys(ranges).sort()));
  for (const [name, row] of Object.entries(server)) assert.equal(JSON.stringify(row), JSON.stringify(ranges[name]), name + " SQL bounds differ");
}
console.log("PASS: all console + SQL bounds match client table");
const pressure = read(path.join(client, "scripts/data/level_pressure.gd"));
const atClear = vm.runInNewContext("(" + pressure.match(/const AT_CLEAR := (\{[\s\S]*?\n\})/)[1] + ")");
const files = cp.execFileSync("rg", ["-l", "-F", "LevelPressure.tune(", path.join(client, "scripts")], {encoding:"utf8"}).trim().split("\n");
const found = {...atClear, from: Number(pressure.match(/const FROM_LV := (\d+)/)[1])};
function constant(file, token) {
  if (/^[0-9.]+$/.test(token)) return Number(token);
  if (token.includes(".")) {
    const [cls, name] = token.split(".");
    const target = cp.execFileSync("rg", ["-l", "^class_name " + cls + "$", path.join(client, "scripts")], {encoding:"utf8"}).trim();
    return constant(target, name);
  }
  const m = read(file).match(new RegExp("const " + token + "\\s*:?=\\s*([0-9.]+)"));
  return m ? Number(m[1]) : undefined;
}
for (const file of files) {
  for (const m of read(file).matchAll(/LevelPressure\.tune\("([^"]+)",\s*([\w.]+)\)/g)) {
    if (m[1] in tunes) found[m[1]] = constant(file, m[2]);
  }
}
const gaps = [];
for (const [name, row] of Object.entries(tunes)) if (found[name] !== row[1]) gaps.push(name + ": code=" + found[name] + ", console=" + row[1]);
if (gaps.length) { console.error("NOT READY: merge driftxp1124 / reconcile actual defaults:\n" + gaps.join("\n")); process.exitCode = 1; }
else console.log("PASS: all console defaults match actual client callers");
