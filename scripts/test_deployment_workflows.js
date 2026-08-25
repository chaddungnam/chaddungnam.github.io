#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "sync-blog.yml"), "utf8");
const youtubeWorkflowPath = path.join(__dirname, "..", ".github", "workflows", "sync-youtube.yml");
assert.ok(fs.existsSync(youtubeWorkflowPath), "sync-youtube.yml must exist");
const youtubeWorkflow = fs.readFileSync(youtubeWorkflowPath, "utf8");
const workflows = ["sync-blog.yml", "sync-youtube.yml", "public-site-security.yml", "site-browser-qa.yml"]
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
assert.ok(workflow.indexOf("name: Publish Korean posts") < workflow.indexOf("name: Translate changed posts"), "Korean posts must publish before translation can fail");
assert.ok(workflow.indexOf("name: Trigger GitHub Pages build (Korean posts)") < workflow.indexOf("name: Translate changed posts"), "Korean updates need their own Pages build trigger");
assert.equal(workflow.split("\n").filter((line) => line.includes("GEMINI_API_KEY")).length, 1, "Gemini key must be scoped to the translator step");
assert.equal(workflow.match(/node scripts\/indexnow-payload\.mjs/g)?.length, 2, "each blog publish phase must build an IndexNow payload");
assert.equal(workflow.match(/https:\/\/api\.indexnow\.org\/indexnow/g)?.length, 2, "each blog publish phase must notify IndexNow");
assert.equal(workflow.match(/--retry 3 --retry-all-errors/g)?.length, 2, "IndexNow notifications must retry transient network failures");
assert.equal(workflow.match(/pages\/builds\/latest/g)?.length, 2, "IndexNow must wait for each Pages deployment to finish");
assert.equal(workflow.match(/continue-on-error:\s*true/g)?.length, 2, "IndexNow failures must not block blog publishing");
assert.match(workflows, /node scripts\/test_indexnow_payload\.mjs/, "CI must exercise the IndexNow payload contract");
assert.doesNotMatch(workflow, /argostranslate|argos-translate/);
assert.equal(youtubeWorkflow.match(/https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UCVeNEKtmPXkSUuTslQKUKbw/g)?.length, 1, "YouTube feed must be fetched once per run");
assert.match(youtubeWorkflow, /node scripts\/youtube-sync\.mjs/);
assert.match(youtubeWorkflow, /assets\/youtube-feed\.json/);
assert.match(youtubeWorkflow, /cron:\s*"[^\"]*\/4/);
for (const check of [
  "node scripts/test_blog_sync.mjs",
  "python scripts/test_translate_blog.py",
  "python scripts/test_blog_translation_regressions.py",
  "node scripts/test_blog_mirror.js",
  "npm run test:blog-security",
]) assert.match(workflow, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

console.log("deployment workflows: PASS");
