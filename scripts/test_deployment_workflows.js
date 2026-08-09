#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "sync-blog.yml"), "utf8");

assert.match(workflow, /permissions:\s*\n\s+contents:\s*write\s*\n\s+pages:\s*write/);
assert.match(workflow, /name:\s*Trigger GitHub Pages build/);
assert.match(workflow, /for delay in 0 10 20/);
assert.match(workflow, /gh api --method POST "repos\/\$GITHUB_REPOSITORY\/pages\/builds"/);
assert.doesNotMatch(workflow, /steps\.publish\.outputs\.changed/);

console.log("deployment workflows: PASS");
