#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const youtubeWorkflowPath = path.join(root, ".github", "workflows", "sync-youtube.yml");
assert.ok(fs.existsSync(youtubeWorkflowPath), "sync-youtube.yml must exist");
const youtubeWorkflow = fs.readFileSync(youtubeWorkflowPath, "utf8");
const workflows = ["sync-youtube.yml", "public-site-security.yml", "site-browser-qa.yml"]
  .map((name) => fs.readFileSync(path.join(root, ".github", "workflows", name), "utf8"))
  .join("\n");
const workflowDir = path.join(root, ".github", "workflows");
for (const name of fs.readdirSync(workflowDir).filter((entry) => /\.ya?ml$/.test(entry))) {
  const source = fs.readFileSync(path.join(workflowDir, name), "utf8");
  for (const match of source.matchAll(/\b(?:node|python3?|bash)\s+(scripts\/[A-Za-z0-9_./-]+\.(?:m?js|py|sh))\b/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `${name} references missing ${match[1]}`);
  }
}

assert.doesNotMatch(workflows, /actions\/checkout@(?!v5)|actions\/setup-node@(?!v6)|actions\/setup-python@(?!v6)/);
assert.equal(youtubeWorkflow.match(/https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UCVeNEKtmPXkSUuTslQKUKbw/g)?.length, 1, "YouTube feed must be fetched once per run");
assert.match(youtubeWorkflow, /node scripts\/youtube-sync\.mjs/);
assert.match(youtubeWorkflow, /assets\/youtube-feed\.json/);
assert.match(youtubeWorkflow, /cron:\s*"[^"]*\/4/);

console.log("deployment workflows: PASS");
