// Balance dial contract (owner 11-25: one server table for the dials, the console shows the applied values).
// The server table tenkey_private.balance_tune_bounds (rows inserted by the hexaworld 1984 migrations, later files win) must equal
// the client's clamp table scripts/data/balance_tune_data.gd RANGES (names, min, max, integer); the console must read that table
// (config.get "balance_bounds") and keep no copy of its own; each server default must equal the constant at every client call
// site (LevelPressure.tune / BalanceKnobs.tune / LevelPressure.AT_CLEAR / FROM_LV). Read-only, no network.
// Usage: node tests/balance-tune-contract.cjs <10key checkout> [<hexaworld 1984>/supabase/migrations]
// Exit 1 on any difference. On the console before 11-25 it fails at "console keeps its own TUNES copy".
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const cp = require("node:child_process");
const client = process.argv[2];
if (!client) throw Error("Pass the 10KEY client checkout path");
const migrations = process.argv[3] || "/Users/junheechoi/projects/houseduck/hexaworld 1984/supabase/migrations";
const site = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(p, "utf8");
const fails = [];
const notes = [];

// 1. The server table, as the migrations leave it.
const server = {};
for (const file of fs.readdirSync(migrations).filter((f) => /_tenkey_.*\.sql$/.test(f)).sort()) {
  const sql = read(path.join(migrations, file));
  for (const block of sql.matchAll(/insert into tenkey_private\.balance_tune_bounds\b[\s\S]*?\n(?:on conflict|;)/g)) {
    for (const m of block[0].matchAll(/\('(\w+)', (-?[\d.]+), (-?[\d.]+), (true|false), (-?[\d.]+), '((?:[^']|'')*)', '([^']*)', (-?\d+), '((?:[^']|'')*)'\)/g)) {
      server[m[1]] = { min: Number(m[2]), max: Number(m[3]), int: m[4] === "true", def: Number(m[5]), label: m[6], group: m[7], file };
    }
  }
  for (const m of sql.matchAll(/delete from tenkey_private\.balance_tune_bounds where name (?:= '(\w+)'|in \(([^)]*)\))/g)) {
    for (const name of m[1] ? [m[1]] : m[2].match(/\w+/g) || []) delete server[name];
  }
}
if (!Object.keys(server).length) fails.push("no balance_tune_bounds rows in " + migrations);

// 2. The client's clamp table.
const ranges = vm.runInNewContext("(" + read(path.join(client, "scripts/data/balance_tune_data.gd")).match(/const RANGES := (\{[\s\S]*?\n\})/)[1] + ")");
for (const name of Object.keys(server)) if (!(name in ranges)) fails.push(name + ": on the server, missing in balance_tune_data.gd RANGES (the client drops it)");
for (const name of Object.keys(ranges)) if (!(name in server)) fails.push(name + ": in RANGES, missing on the server (the console cannot set it)");
for (const [name, row] of Object.entries(ranges)) {
  const s = server[name];
  if (s && (s.min !== row[0] || s.max !== row[1] || s.int !== Boolean(row[2]))) {
    fails.push(name + ": server [" + s.min + ", " + s.max + (s.int ? ", int" : "") + "] != client [" + row.join(", ") + "]");
  }
}

// 3. The console reads the server table and keeps no copy; its test stand-in rows equal the server rows.
const page = read(path.join(site, "console/tenkey-balance.js"));
if (/const TUNES\s*=/.test(page)) fails.push("console keeps its own TUNES copy (console/tenkey-balance.js)");
if (!page.includes("balance_bounds")) fails.push("console does not read config.get balance_bounds");
const fixture = read(path.join(site, "tests/fixtures/console_tenkey_api.js")).match(/config\.balance_bounds = (\[[\s\S]*?\n  \]);/);
for (const r of fixture ? vm.runInNewContext("(" + fixture[1] + ")") : []) {
  const s = server[r.name];
  if (!s || s.min !== r.min || s.max !== r.max || s.int !== r.int || s.def !== r.default || s.label !== r.label || s.group !== r.group) {
    fails.push(r.name + ": console test stand-in row differs from the server row");
  }
}

// 4. Server defaults = the constant at every client call site.
const pressure = read(path.join(client, "scripts/data/level_pressure.gd"));
const atClear = vm.runInNewContext("(" + pressure.match(/const AT_CLEAR := (\{[\s\S]*?\n\})/)[1] + ")");
const sites = {};
const add = (name, value, where) => (sites[name] ||= []).push({ value, where });
for (const [k, v] of Object.entries(atClear)) add(k, v, "level_pressure.gd AT_CLEAR");
add("from", Number(pressure.match(/const FROM_LV := (\d+)/)[1]), "level_pressure.gd FROM_LV");
const rg = (args) => { try { return cp.execFileSync("rg", args, { encoding: "utf8" }).trim(); } catch { return ""; } };
function constant(file, token) {
  if (/^-?[0-9.]+$/.test(token)) return Number(token);
  if (token.includes(".")) {
    const [cls, name] = token.split(".");
    const target = rg(["-l", "^class_name " + cls + "$", path.join(client, "scripts")]).split("\n")[0];
    return target ? constant(target, name) : undefined;
  }
  const m = read(file).match(new RegExp("^const " + token + "\\b[^=\\n]*=\\s*(-?[0-9.]+)", "m"));
  return m ? Number(m[1]) : undefined;
}
for (const file of rg(["-l", "(LevelPressure|BalanceKnobs)\\.tune\\(", path.join(client, "scripts")]).split("\n").filter(Boolean)) {
  for (const m of read(file).matchAll(/(?:LevelPressure|BalanceKnobs)\.tune\("([^"]+)",\s*([\w.]+)\)/g)) {
    add(m[1], constant(file, m[2]), path.relative(client, file) + " " + m[2]);
  }
}
for (const [name, s] of Object.entries(server)) {
  const found = sites[name] || [];
  if (!found.length) {
    if (rg(["-l", "-F", '"' + name + '"', path.join(client, "scripts")])) notes.push(name + ": read through a computed call, check its default by hand (server " + s.def + ")");
    else fails.push(name + ": no client call site reads it (server default " + s.def + ")");
  }
  for (const f of found) {
    if (f.value === undefined) notes.push(name + ": " + f.where + " is not a plain constant, check by hand (server " + s.def + ")");
    else if (f.value !== s.def) fails.push(name + ": server default " + s.def + " != code " + f.value + " (" + f.where + ")");
  }
}

for (const n of notes) console.log("NOTE: " + n);
if (fails.length) {
  console.error("FAIL balance-tune-contract (" + fails.length + "):\n" + fails.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS balance-tune-contract: " + Object.keys(server).length + " server rows = client RANGES, console reads the table, defaults = call sites");
}
