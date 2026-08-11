#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://houseduck.in";
const keyFileFlag = process.argv.indexOf("--key-file");
const keyFile = keyFileFlag >= 0 ? process.argv[keyFileFlag + 1] : path.resolve("indexnow-key.txt");
const key = (await readFile(keyFile, "utf8")).trim();
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error("Invalid IndexNow key");

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const files = Buffer.concat(chunks).toString("utf8").split("\0").filter(Boolean);
const urls = new Set(files.includes("assets/blog-feed.json") ? [`${origin}/`] : []);

for (const file of files) {
  const match = /^blog\/(kr|en|de|ja)\/(?:index\.html|([^/]+)\/index\.html)$/.exec(file);
  if (!match) continue;
  urls.add(match[2]
    ? `${origin}/blog/${match[1]}/${encodeURIComponent(match[2])}/`
    : `${origin}/blog/${match[1]}/`);
}

const urlList = [...urls].sort();
if (urlList.length) process.stdout.write(`${JSON.stringify({
  host: "houseduck.in",
  key,
  keyLocation: `${origin}/indexnow-key.txt`,
  urlList,
})}\n`);
