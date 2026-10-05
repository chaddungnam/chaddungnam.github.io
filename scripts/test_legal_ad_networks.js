#!/usr/bin/env node
// Owner 2026-10-05: AppLovin/MAX was rejected; Google AdMob is the only ad network in the shipped build.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(repoDir, file), "utf8");

test("legal pages name Google AdMob and no rejected or absent ad network", () => {
  for (const locale of ["ko", "en", "de", "ja"]) {
    for (const file of [`privacy/${locale}.html`, `quirky-ball/terms/${locale}.html`]) {
      const html = read(file);
      const withoutHistory = html.slice(0, html.lastIndexOf('id="section-'));
      assert.match(html, /Google AdMob/, `${file}: AdMob must be disclosed`);
      assert.doesNotMatch(withoutHistory, /AppLovin|ironSource|Unity Ads|Vungle|Liftoff|Pangle|Mintegral|Meta Audience/i, `${file}: only AdMob may be described as an ad network`);
      assert.doesNotMatch(html, /legal\.applovin\.com/, `${file}: no AppLovin policy links`);
    }
  }
});
