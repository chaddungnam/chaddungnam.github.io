#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const snapshotDir = join(__dirname, "..", "play", "quirky-ball");
const expectedHashes = {
  "YTGameSDK.js": "1c107b3876282f37a5331b8e46b744fcb1d6017ea8944c56e4826209201d4a11",
  "index.apple-touch-icon.png": "7c8f89e26faff90c5e7b6b4da73d5d5244b860f802a7ae85945c7904f1acf138",
  "index.audio.position.worklet.js": "be33985bc7160d6bf9646f259cd86b259cd67b02ccb297ee5c44f8ac84327bc8",
  "index.audio.worklet.js": "5b476a9c9ce642c0ee4256436d1bc31d9c38f868aca0f9a8e2a57c18d2dec2a3",
  "index.html": "d7ca552289ae7f144b1d3cca2064c4a79edd45b10940f34b5f3ca125682656e0",
  "index.icon.png": "fa378acf6c37f33d4071db74fb39cd1873fd33681d8a0f4980512db055e48ddf",
  "index.js": "05f22332236b9c234eb18d1833e57a17d0802ab6e65333de4a8317bed68202c6",
  "index.pck.zip": "8ac3f166aa95fe5ac6613a370798b8cf23fc916531a6bf4049b1b3de3379d170",
  "index.png": "f30ee1ca60eba998b83b87f2947f76865011345a6a410a7e395ad41ddc4d80b4",
  "index.wasm.zip": "d8e9008dfb8235eb0ba5f40e438428faffd4ba5ee950d2a4a0e3e8ad3e42a609",
};

assert.ok(existsSync(snapshotDir), "play/quirky-ball snapshot directory must exist");
assert.deepEqual(readdirSync(snapshotDir).sort(), Object.keys(expectedHashes).sort());
for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
  const actualHash = createHash("sha256").update(readFileSync(join(snapshotDir, filename))).digest("hex");
  assert.equal(actualHash, expectedHash, `${filename} must match the verified source snapshot`);
}

console.log("quirky ball playable snapshot: PASS");
