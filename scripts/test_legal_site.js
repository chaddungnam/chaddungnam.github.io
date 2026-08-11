const assert = require("node:assert/strict");
const path = require("node:path");

let legalSite;
try {
  legalSite = require(path.join(__dirname, "..", "assets", "legal-site.js"));
} catch (error) {
  console.error(`FAIL: shared legal navigation is unavailable (${error.code || error.message})`);
  process.exit(1);
}

const entries = legalSite.buildTocEntries([
  { id: "overview", text: "  1.   Overview  " },
  { id: "", text: "Missing target" },
  { id: "contact", text: "11. Contact" },
]);

assert.deepEqual(entries, [
  { id: "overview", text: "1. Overview" },
  { id: "contact", text: "11. Contact" },
]);

console.log("legal navigation model: PASS");
