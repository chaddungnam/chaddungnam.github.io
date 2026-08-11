#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "houseduck-indexnow-"));
const keyFile = path.join(temp, "indexnow-key.txt");
const key = "0123456789abcdef0123456789abcdef";
await writeFile(keyFile, `${key}\n`);

const changedFiles = [
  "assets/blog-feed.json",
  "blog/kr/index.html",
  "blog/en/dev.note/index.html",
  "blog/ja/개발-기록/index.html",
  "blog/en/dev.note/asset.png",
  "console/index.html",
].join("\0") + "\0";

const result = spawnSync(
  process.execPath,
  [path.join(root, "scripts/indexnow-payload.mjs"), "--key-file", keyFile],
  { cwd: root, input: changedFiles, encoding: "utf8" },
);

assert.equal(result.status, 0, result.stderr);
assert.deepEqual(JSON.parse(result.stdout), {
  host: "houseduck.in",
  key,
  keyLocation: "https://houseduck.in/indexnow-key.txt",
  urlList: [
    "https://houseduck.in/",
    "https://houseduck.in/blog/en/dev.note/",
    "https://houseduck.in/blog/ja/%EA%B0%9C%EB%B0%9C-%EA%B8%B0%EB%A1%9D/",
    "https://houseduck.in/blog/kr/",
  ],
});

const unrelated = spawnSync(
  process.execPath,
  [path.join(root, "scripts/indexnow-payload.mjs"), "--key-file", keyFile],
  { cwd: root, input: "assets/blog-translations.json\0", encoding: "utf8" },
);
assert.equal(unrelated.status, 0, unrelated.stderr);
assert.equal(unrelated.stdout, "");

console.log("indexnow payload: PASS");
