#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const snapshotDir = join(__dirname, "..", "play", "quirky-ball");
const siteWrapper = join(__dirname, "..", "play", "quirky-ball-site", "index.html");
const thirdPartyLicenses = join(__dirname, "..", "play", "THIRD_PARTY_LICENSES.txt");
const expectedHashes = {
  "YTGameSDK.js": "1c107b3876282f37a5331b8e46b744fcb1d6017ea8944c56e4826209201d4a11",
  "index.apple-touch-icon.png": "7c8f89e26faff90c5e7b6b4da73d5d5244b860f802a7ae85945c7904f1acf138",
  "index.audio.position.worklet.js": "be33985bc7160d6bf9646f259cd86b259cd67b02ccb297ee5c44f8ac84327bc8",
  "index.audio.worklet.js": "5b476a9c9ce642c0ee4256436d1bc31d9c38f868aca0f9a8e2a57c18d2dec2a3",
  "index.html": "3f6c14e1cb1ecd7e94f103be13fdd2ae96a7cfbc74d04d884f209183c060096e",
  "index.icon.png": "fa378acf6c37f33d4071db74fb39cd1873fd33681d8a0f4980512db055e48ddf",
  "index.js": "05f22332236b9c234eb18d1833e57a17d0802ab6e65333de4a8317bed68202c6",
  "index.pck.zip": "59af7ef41c8a1e12401556b8960d8b8ef50d7ac7d95675058cd773381015f5a2",
  "index.png": "f30ee1ca60eba998b83b87f2947f76865011345a6a410a7e395ad41ddc4d80b4",
  "index.wasm.zip": "1340875de37bf8cfe9c070c1fea13a50e9e8f19af3e7137a3d6fdea9711e01b9",
};

const homeContracts = {
  "index.html": ["지금 플레이", "게임 불러오는 중…", "플레이 준비 완료", "게임을 불러오지 못했습니다", "종료", "다시 시도"],
  "index_en.html": ["Play now", "Loading game…", "Ready to play", "Could not load game", "Exit", "Retry"],
  "index_de.html": ["Jetzt spielen", "Spiel wird geladen…", "Spiel bereit", "Spiel konnte nicht geladen werden", "Beenden", "Erneut versuchen"],
  "index_ja.html": ["今すぐプレイ", "ゲームを読み込み中…", "プレイ準備完了", "ゲームを読み込めませんでした", "終了", "再試行"],
};

assert.ok(existsSync(snapshotDir), "play/quirky-ball snapshot directory must exist");
assert.deepEqual(readdirSync(snapshotDir).sort(), Object.keys(expectedHashes).sort());
for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
  const actualHash = createHash("sha256").update(readFileSync(join(snapshotDir, filename))).digest("hex");
  assert.equal(actualHash, expectedHash, `${filename} must match the verified source snapshot`);
}

assert.ok(existsSync(thirdPartyLicenses), "playable third-party license notice must exist");
const licenseText = readFileSync(thirdPartyLicenses, "utf8");
assert.match(licenseText, /Google web-game-samples/, "notice must attribute Google web-game-samples");
assert.match(licenseText, /github\.com\/google\/web-game-samples/, "notice must identify the upstream project");
assert.match(licenseText, /Modifications by House Duck:/, "notice must identify House Duck modifications");
assert.match(licenseText, /Apache License\s+Version 2\.0, January 2004/, "notice must include the Apache 2.0 heading");
assert.match(licenseText, /4\. Redistribution\./, "notice must include Apache 2.0 redistribution terms");
assert.match(licenseText, /END OF TERMS AND CONDITIONS/, "notice must include the end of the Apache 2.0 terms");
assert.match(licenseText, /Godot Engine contributors/, "notice must attribute the Godot Engine");
assert.match(licenseText, /Permission is hereby granted, free of charge/, "notice must include the Godot MIT grant");

assert.ok(existsSync(siteWrapper), "site-only playable wrapper must exist");
const wrapperHtml = readFileSync(siteWrapper, "utf8");
assert.match(wrapperHtml, /<link rel="license" href="\.\.\/THIRD_PARTY_LICENSES\.txt">/, "site wrapper must expose the third-party license notice");
assert.doesNotMatch(wrapperHtml, /youtube\.com\/game_api/, "site wrapper must not load the YouTube host SDK");
for (const asset of ["YTGameSDK.js", "index.js", "index.png"]) {
  assert.ok(wrapperHtml.includes(`../quirky-ball/${asset}`), `site wrapper must reuse ${asset} from the immutable snapshot`);
}
assert.match(wrapperHtml, /"executable":"\.\.\/quirky-ball\/index"/, "site wrapper must load the immutable PCK and WASM base path");

for (const [filename, labels] of Object.entries(homeContracts)) {
  const html = readFileSync(join(__dirname, "..", filename), "utf8");
  assert.equal((html.match(/data-playable-phone(?:[\s=>])/g) || []).length, 1, `${filename} must have one playable phone`);
  assert.match(html, /data-playable-src="play\/quirky-ball-site\/index\.html"/, `${filename} must reference the site wrapper`);
  assert.doesNotMatch(html, /<iframe\b/i, `${filename} must not load the playable before PLAY`);
  for (const label of labels) assert.ok(html.includes(label), `${filename} must include ${label}`);
}

console.log("quirky ball playable snapshot: PASS");
