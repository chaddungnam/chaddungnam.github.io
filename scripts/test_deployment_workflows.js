#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "sync-blog.yml"), "utf8");
const workflows = ["sync-blog.yml", "public-site-security.yml", "site-browser-qa.yml"]
  .map((name) => fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", name), "utf8"))
  .join("\n");

assert.doesNotMatch(workflows, /actions\/checkout@(?!v5)|actions\/setup-node@(?!v6)|actions\/setup-python@(?!v6)/);

assert.match(workflow, /permissions:\s*\n\s+contents:\s*write\s*\n\s+pages:\s*write/);
assert.match(workflow, /name:\s*Trigger GitHub Pages build/);
assert.match(workflow, /for delay in 0 10 20/);
assert.match(workflow, /gh api --method POST "repos\/\$GITHUB_REPOSITORY\/pages\/builds"/);
assert.doesNotMatch(workflow, /steps\.publish\.outputs\.changed/);
assert.equal(workflow.match(/https:\/\/houseduck\.tistory\.com\/rss/g)?.length, 1, "RSS must be fetched once per run");
assert.equal(workflow.match(/--rss \.tmp\/rss\.xml/g)?.length, 2, "source and render must use the same RSS snapshot");
assert.equal(workflow.split("\n").filter((line) => line.includes("GEMINI_API_KEY")).length, 1, "Gemini key must be scoped to the translator step");
assert.doesNotMatch(workflow, /argostranslate|argos-translate/);
for (const check of [
  "node scripts/test_blog_sync.mjs",
  "python scripts/test_translate_blog.py",
  "python scripts/test_blog_translation_regressions.py",
  "node scripts/test_blog_mirror.js",
  "npm run test:blog-security",
]) assert.match(workflow, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

console.log("deployment workflows: PASS");
