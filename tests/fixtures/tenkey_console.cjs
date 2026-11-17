// The 10key Survival console specs' shared setup: the synthetic stand-in API (tests/fixtures/console_tenkey_api.js, the core, plus
// one module per page in tests/fixtures/tenkey/), a signed-in console auth stub, the page opener, captures and the call log.
// Local synthetic data only. TENKEY_SHOTS=<dir> writes a capture of each shot() there.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("@playwright/test");

const MODULES = ["crashes", "balance", "keep", "issues", "perf"];
const API = [fs.readFileSync(path.join(__dirname, "console_tenkey_api.js"), "utf8"),
  ...MODULES.map((m) => fs.readFileSync(path.join(__dirname, "tenkey", `${m}.js`), "utf8"))].join("\n");
const AUTH = `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({}),renderGoogleButton:()=>{}};`;
const SHOTS = process.env.TENKEY_SHOTS || "";

// Opens the console signed in, picks 10key Survival and goes to `hash`; `extra` is script run after the stand-in API. Returns the
// page errors seen so far (a test ends with expect(errors).toEqual([])).
async function open(page, hash = "", extra = "") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("https://translate.googleapis.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: AUTH }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: API + extra }));
  await page.goto("/console/");
  await page.locator("#projectTenkey").click();
  if (hash) await page.evaluate((h) => { window.location.hash = h; }, hash);
  return errors;
}

async function shot(page, name, selector) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const project = test.info().project.name.startsWith("mobile") ? "phone" : "desktop";
  const file = path.join(SHOTS, `${project}_${name}.png`);
  if (selector) await page.locator(selector).screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: true });
}

// Every call the page made for `action` ({project, fn, action, params, request_id?}), oldest first.
const calls = (page, action) => page.evaluate((a) => window.__mockCalls.filter((c) => c.action === a), action);

module.exports = { API, AUTH, open, shot, calls };
