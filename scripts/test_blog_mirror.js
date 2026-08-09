#!/usr/bin/env node

const assert = require("node:assert/strict");
const mirror = require("../assets/blog-mirror.js");

assert.equal(mirror.resolveTheme("light"), "light");
assert.equal(mirror.resolveTheme("dark"), "dark");
assert.equal(mirror.resolveTheme("invalid"), "dark");

console.log("blog mirror behavior: PASS");
