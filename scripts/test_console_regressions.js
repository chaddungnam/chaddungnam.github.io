#!/usr/bin/env node
"use strict";

async function main() {
const assert = (await import("node:assert/strict")).default;
const fs = (await import("node:fs")).default;
const path = (await import("node:path")).default;
const vm = (await import("node:vm")).default;

const root = path.resolve(path.dirname(process.argv[1]), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function rulesFor(robots, userAgent) {
  const groups = robots.trim().split(/\n\s*\n/);
  const group = groups.find((entry) => entry.split("\n").some((line) => line.trim() === `User-agent: ${userAgent}`));
  return group ? group.split("\n").map((line) => line.trim()) : [];
}

for (const page of ["console/index.html", "analytics/index.html"]) {
  assert.match(read(page), /<meta\s+name="robots"\s+content="noindex, nofollow, noarchive">/i, `${page} must opt out of search indexing`);
}

const consoleHtml = read("console/index.html");
const analyticsSource = read("console/analytics.js");
const consoleStyles = read("console/styles.css");
assert.match(consoleHtml, /<a\s+id="skipLink"[^>]+href="#loginPanel"/i, "the initial skip link must target the visible login panel");
assert.match(consoleHtml, /id="kpiActiveLabel"/, "the active-player KPI must expose a range-aware label");
assert.match(consoleHtml, /id="dailyTrendEyebrow"/, "the daily trend heading must follow the selected range");
assert.match(analyticsSource, /setText\("kpiActive", formatNumber\(summary\.installs\)\)/, "the active-player KPI must count unique installs across the selected range");
assert.match(analyticsSource, /activePlayers: Number\(summary\.installs \?\? 0\)/, "AI advice must use the selected-range active player count");
assert.doesNotMatch(analyticsSource, /summary\.activeInstallsToday/, "selected-range analytics must not silently fall back to today's count");
assert.match(consoleHtml, /<form\s+id="challengeForm"[^>]+aria-describedby="challengeMessage"/i, "the challenge must expose its live result message");
assert.match(consoleHtml, /data-route="analytics-exclusions"/, "the console must expose an analytics exclusion route");
assert.match(read("console/analytics-exclusions.js"), /analytics_exclusions\.list/, "the exclusion route must use the secured admin action");
assert.ok(consoleHtml.indexOf('<script src="ui-state.js"></script>') < consoleHtml.search(/<script src="app\.js(?:\?[^\"]+)?" defer><\/script>/), "the UI state helper must load before the console app");
assert.match(consoleHtml, /id="diagnosticsIssueSignals"/, "the gameplay diagnostics issue-signal panel must exist");
assert.match(consoleHtml, /id="tutorialStagesTable"/, "the gameplay diagnostics tutorial funnel table must exist");
assert.match(consoleHtml, /id="growthChoiceLevelTable"/, "the gameplay diagnostics level-choice table must exist");
assert.match(consoleHtml, /id="mechakuchaSummary"/, "the gameplay diagnostics Mechakucha panel must exist");
assert.match(consoleHtml, /id="gameOverChart"/, "the gameplay diagnostics game-over canvas must exist");
assert.match(consoleHtml, /id="gameOverDailyTable"/, "the gameplay diagnostics daily game-over table must exist");
assert.match(consoleHtml, /id="gameOverBucketTable"/, "the gameplay diagnostics level-bucket table must exist");
assert.match(consoleHtml, /analytics\.js\?v=20260826-2/, "the Console must cache-bust the updated diagnostics renderer");
assert.match(consoleHtml, /styles\.css\?v=20260826-1/, "the Console must cache-bust diagnostics responsive styles");
assert.match(analyticsSource, /renderDiagnostics\(\)/, "the analytics renderer must render diagnostics from the dashboard response");
assert.match(analyticsSource, /diagnostics\.gameOver/, "game-over rows must render from diagnostics.gameOver");
assert.match(analyticsSource, /diagnostics\.growthChoices/, "legacy growth choices must render from diagnostics.growthChoices");
assert.match(analyticsSource, /1\.1\.0 데이터 수집 대기/, "empty tutorial and Mechakucha panels must use the exact collection-waiting text");
assert.doesNotMatch(analyticsSource, /Chart\.js|new Chart\(/, "diagnostics charts must reuse Canvas without a chart dependency");
assert.match(analyticsSource, /function diagnosticsSignalLabel/, "diagnostics issue signals must map internal event keys to operator-facing labels");
assert.match(analyticsSource, /튜토리얼 미완료/, "diagnostics issue labels must not expose raw event identifiers");
assert.match(analyticsSource, /renderGameOverChart\(\(state\.payload\?\.diagnostics\?\.gameOver\?\.byDay \?\? \[\]\)\.slice\(-state\.rangeDays\)\)/, "the game-over Canvas must redraw the selected range when the viewport changes");
assert.match(analyticsSource, /canvas\.parentElement\?\.clientWidth/, "the game-over Canvas bitmap must use its stable container width");
assert.match(analyticsSource, /canvas\.style\.width = "100%"/, "the game-over Canvas CSS width must not grow with its high-DPI bitmap");
assert.match(analyticsSource, /tutorialStageLabel\(row\.stage, row\.stageIndex\)/, "tutorial dropoff rows must show an operator-facing stage name");
assert.doesNotMatch(analyticsSource, /stageIndex[^\n]*\+\s*1/, "tutorial enum stage indexes must not be shifted by one");
assert.match(consoleStyles, /#growthChoiceStatus\s*\{[^}]*white-space:\s*nowrap/s, "the growth choice total must stay readable on narrow screens");

const playersSource = read("console/players.js");
assert.match(playersSource, /icon_jakwon_tongue[\s\S]*yakwon 프로필/, "the admin inventory list must expose the retired yakwon profile item");
assert.match(playersSource, /skin_jakwon[\s\S]*yakwon 구슬/, "the admin inventory list must expose the retired yakwon marble item");
assert.match(playersSource, /const grantCatalog = catalog\.concat\(ADMIN_GRANT_ITEMS\.filter/, "admin-only grant items must not leak into the active store/mail catalog");

const robots = read("robots.txt");
for (const agent of ["Google-adstxt", "Mediapartners-Google", "Googlebot", "*"]) {
  const rules = rulesFor(robots, agent);
  assert.ok(rules.includes("Disallow: /console/"), `${agent} must not crawl the private console`);
  assert.ok(rules.includes("Disallow: /analytics/"), `${agent} must not crawl the legacy analytics redirect`);
}

const uiStatePath = path.join(root, "console", "ui-state.js");
assert.ok(fs.existsSync(uiStatePath), "console UI request state helper must exist");
const uiContext = { window: {} };
vm.runInNewContext(fs.readFileSync(uiStatePath, "utf8"), uiContext, { filename: "console/ui-state.js" });
const ui = uiContext.window.ConsoleUiState;

function fakeElement({ disabled = false, controls = [] } = {}) {
  const attributes = new Map();
  return {
    disabled,
    textContent: "",
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
    querySelectorAll() { return controls; },
  };
}

const enabledButton = fakeElement();
const alreadyDisabledButton = fakeElement({ disabled: true });
const requestForm = fakeElement({ controls: [enabledButton, alreadyDisabledButton] });
const finishRequest = ui.beginRequest(requestForm);
assert.equal(typeof finishRequest, "function");
assert.equal(requestForm.getAttribute("aria-busy"), "true");
assert.equal(enabledButton.disabled, true);
assert.equal(alreadyDisabledButton.disabled, true);
assert.equal(ui.beginRequest(requestForm), null, "a request already in flight must not start twice");
finishRequest();
assert.equal(requestForm.getAttribute("aria-busy"), "false");
assert.equal(enabledButton.disabled, false);
assert.equal(alreadyDisabledButton.disabled, true, "request cleanup must preserve an existing disabled guard");

const message = fakeElement();
ui.setMessage(message, "확인 중...");
assert.equal(message.textContent, "확인 중...");
assert.equal(message.getAttribute("role"), "status");
assert.equal(message.getAttribute("aria-live"), "polite");
ui.setMessage(message, "답이 맞지 않습니다.", true);
assert.equal(message.getAttribute("role"), "alert");
assert.equal(message.getAttribute("aria-live"), "assertive");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const authStorage = memoryStorage();
let googleCredentialCallback;
let authFetchRequest;
let authReply = { adminTicket: "ticket", expiresIn: 1800, email: "admin@example.com" };
const authWindow = {
  sessionStorage: authStorage,
  ConsoleModel: {
    decodeJwtPayload(token) {
      try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); }
      catch (_error) { return null; }
    },
  },
  google: { accounts: { id: {
    initialize(options) { googleCredentialCallback = options.callback; },
    renderButton() {},
  } } },
  dispatchEvent() {},
  setTimeout,
};
const authContext = {
  Buffer,
  CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  Date,
  document: { getElementById: () => ({}) },
  fetch: async (_url, request) => {
    authFetchRequest = request;
    return { ok: true, status: 200, json: async () => authReply };
  },
  setTimeout,
  window: authWindow,
};
vm.runInNewContext(read("console/auth.js"), authContext, { filename: "console/auth.js" });
await authWindow.ConsoleAuth.initialize({ clientId: "client", publishableKey: "public", authUrl: "https://example.test/admin-auth" });
const jwtPayload = Buffer.from(JSON.stringify({ email: "admin@example.com", exp: 9999999999 })).toString("base64url");
googleCredentialCallback({ credential: `header.${jwtPayload}.signature` });
assert.equal(authWindow.ConsoleAuth.snapshot().signedIn, true);
const unlocked = await authWindow.ConsoleAuth.unlock("answer");
assert.equal(unlocked.unlocked, true);
assert.deepEqual(JSON.parse(authFetchRequest.body), { answer: "answer" });
assert.equal(authWindow.ConsoleAuth.headers()["X-Admin-Session"], "ticket");
authReply = { adminTicket: "", expiresIn: 0, email: "admin@example.com" };
await assert.rejects(() => authWindow.ConsoleAuth.unlock("answer"), /admin_auth_failed/);

let apiResponse;
let logoutCalls = 0;
let challengeCalls = 0;
const apiWindow = {
  ConsoleAuth: {
    headers: () => ({ Authorization: "Bearer token", "X-Admin-Session": "ticket" }),
    logout: () => { logoutCalls += 1; },
    requireChallenge: () => { challengeCalls += 1; },
  },
};
vm.runInNewContext(read("console/api.js"), {
  fetch: async () => apiResponse,
  window: apiWindow,
}, { filename: "console/api.js" });
apiWindow.ConsoleAPI.initialize({ functionBaseUrl: "https://example.test/functions/v1/" });
apiResponse = { ok: false, status: 403, json: async () => ({ error: "admin_session_required" }) };
await assert.rejects(() => apiWindow.ConsoleAPI.post("admin-console", { action: "operations.get" }), (error) => error.message === "admin_session_required" && error.status === 403);
assert.equal(challengeCalls, 1);
apiResponse = { ok: false, status: 401, json: async () => ({ error: "invalid_google_identity" }) };
await assert.rejects(() => apiWindow.ConsoleAPI.post("admin-console", {}), /invalid_google_identity/);
assert.equal(logoutCalls, 1);
await assert.rejects(() => apiWindow.ConsoleAPI.post("not-allowed", {}), /invalid_console_endpoint/);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function appElement() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    innerHTML: "",
    style: {},
    textContent: "",
    value: "",
    focusCount: 0,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type) {
      const event = { currentTarget: this, preventDefault() {} };
      return Promise.all((listeners.get(type) || []).map((listener) => listener(event)));
    },
    focus() { this.focusCount += 1; },
    getAttribute(name) { return attributes.get(name) || null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

function runApp({ initialize, unlock, logout = () => {} }) {
  const ids = [
    "loginPanel", "challengePanel", "projectPicker", "consoleApp", "userEmail", "challengeEmail",
    "challengeAnswer", "challengeMessage", "loginMessage", "challengeForm", "projectQuirkyBall",
    "projectK", "changeProjectButton", "challengeLogout", "pickerLogout", "logoutButton", "skipLink",
    "confirmDialog", "confirmTitle", "confirmBody",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, appElement()]));
  const submitButton = appElement();
  elements.challengeForm.querySelectorAll = () => [submitButton];
  elements.challengeForm.querySelector = () => submitButton;
  const windowListeners = new Map();
  const window = {
    ConsoleUiState: ui,
    ConsoleAPI: { initialize() {} },
    ConsoleAuth: {
      initialize,
      unlock,
      snapshot: () => ({ signedIn: false, unlocked: false, email: "" }),
      isUnlocked: () => false,
      logout,
    },
    ConsoleModel: { routeFromHash: () => ({ page: "analytics" }) },
    ConsoleAnalytics: { mount() {} },
    ConsolePlayers: { mountList() {}, mountDetail() {} },
    ConsoleOperations: { mount() {} },
    ConsolePurchases: { mount() {} },
    ConsoleCs: { mount() {} },
    ConsoleAudit: { mount() {} },
    GmailAPI: { initialize() {} },
    location: { hash: "" },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
  };
  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = appElement();
      return elements[id];
    },
    querySelectorAll() { return []; },
  };
  const bootPromise = vm.runInNewContext(read("console/app.js"), { console, document, window }, { filename: "console/app.js" });
  return { bootPromise, elements, submitButton, window };
}

const loginGate = deferred();
const loginHarness = runApp({ initialize: () => loginGate.promise, unlock: async () => ({}) });
await Promise.resolve();
assert.equal(loginHarness.elements.loginPanel.getAttribute("aria-busy"), "true");
assert.equal(loginHarness.elements.loginMessage.textContent, "Google 로그인 버튼을 불러오는 중입니다.");
assert.equal(loginHarness.elements.loginMessage.getAttribute("role"), "status");
loginGate.reject(new Error("google_identity_script_timeout"));
await loginHarness.bootPromise;
assert.equal(loginHarness.elements.loginPanel.getAttribute("aria-busy"), "false");
assert.equal(loginHarness.elements.loginMessage.getAttribute("role"), "alert");
assert.match(loginHarness.elements.loginMessage.textContent, /Google 로그인 버튼/);
assert.equal(loginHarness.elements.skipLink.href, "#loginPanel");

const confirmationHarness = runApp({ initialize: async () => ({ signedIn: false }), unlock: async () => ({}) });
await confirmationHarness.bootPromise;
const confirmationDialog = confirmationHarness.elements.confirmDialog;
confirmationDialog.showModal = () => {};
confirmationDialog.returnValue = "confirm";
const escapedConfirmation = confirmationHarness.window.ConsoleApp.confirmChange("변경 확인", "계속하시겠습니까?");
await confirmationDialog.emit("close");
assert.equal(await escapedConfirmation, false, "opening a confirmation must clear a previous approval before Escape closes the dialog");

const challengeGate = deferred();
let unlockCalls = 0;
const challengeHarness = runApp({
  initialize: async () => ({ signedIn: true, unlocked: false, email: "admin@example.com" }),
  unlock: () => { unlockCalls += 1; return challengeGate.promise; },
});
await challengeHarness.bootPromise;
assert.equal(challengeHarness.elements.skipLink.href, "#challengePanel");
const focusBeforeRequest = challengeHarness.elements.challengeAnswer.focusCount;
challengeHarness.elements.challengeAnswer.value = "wrong";
const firstSubmit = challengeHarness.elements.challengeForm.emit("submit");
await Promise.resolve();
assert.equal(challengeHarness.elements.challengeForm.getAttribute("aria-busy"), "true");
assert.equal(challengeHarness.submitButton.disabled, true);
assert.equal(challengeHarness.elements.challengeMessage.textContent, "확인 중...");
const secondSubmit = challengeHarness.elements.challengeForm.emit("submit");
assert.equal(unlockCalls, 1, "a repeated challenge submit must not start another request");
challengeGate.reject(new Error("challenge_invalid"));
await Promise.all([firstSubmit, secondSubmit]);
assert.equal(challengeHarness.elements.challengeForm.getAttribute("aria-busy"), "false");
assert.equal(challengeHarness.submitButton.disabled, false);
assert.equal(challengeHarness.elements.challengeMessage.textContent, "답이 맞지 않습니다.");
assert.equal(challengeHarness.elements.challengeMessage.getAttribute("role"), "alert");
assert.equal(challengeHarness.elements.challengeAnswer.focusCount, focusBeforeRequest + 1);

let expiredLogoutCalls = 0;
const expiredHarness = runApp({
  initialize: async () => ({ signedIn: true, unlocked: false, email: "admin@example.com" }),
  unlock: async () => { throw new Error("invalid_google_identity"); },
  logout: () => { expiredLogoutCalls += 1; },
});
await expiredHarness.bootPromise;
expiredHarness.elements.challengeAnswer.value = "answer";
await expiredHarness.elements.challengeForm.emit("submit");
assert.equal(expiredLogoutCalls, 1, "an expired Google identity must return to login instead of leaving a dead challenge form");
assert.equal(expiredHarness.elements.loginMessage.getAttribute("role"), "alert");
assert.match(expiredHarness.elements.loginMessage.textContent, /다시 로그인/);

function formField(value = "") {
  return Object.assign(appElement(), { value, checked: false, setCustomValidity() {} });
}

function operationForm(elements) {
  const form = appElement();
  const button = appElement();
  form.elements = elements;
  form.reportValidity = () => true;
  form.reset = () => {};
  form.querySelector = () => button;
  form.querySelectorAll = () => [button];
  return { form, button };
}

class FakeFormData {
  constructor(form) { this.form = form; }
  *[Symbol.iterator]() {
    for (const [name, field] of Object.entries(this.form.elements)) yield [name, field.value];
  }
}

const reward = operationForm({
  templateKey: formField("general"),
  kind: formField("gems"),
  rewardValue: formField("10"),
  expiresAt: formField("2026-08-10T12:00"),
  reason: formField("launch"),
});
const minVersion = operationForm({ minVersion: formField("1.2.3"), minVersionCode: formField("42"), reason: formField("release") });
const qaAccess = operationForm({ userId: formField("user-1"), shopControlsEnabled: formField(""), reason: formField("qa") });
const operationElements = {
  rewardMailForm: reward.form,
  minVersionForm: minVersion.form,
  qaAccessForm: qaAccess.form,
  rewardTemplatePreview: appElement(),
  rewardValueLabel: Object.assign(appElement(), { firstChild: { textContent: "" } }),
  operationsMessage: appElement(),
  operationsSummary: appElement(),
  operationsHistory: appElement(),
};
let mutationGate = deferred();
const mutationPayloads = [];
let confirmationCalls = 0;
const operationWindow = {
  ConsoleUiState: ui,
  ConsoleApp: { confirmChange: async () => { confirmationCalls += 1; return true; } },
  ConsoleAPI: {
    post(_name, payload) {
      if (payload.action === "operations.get") return Promise.resolve({ config: { min_version: "1.2.3", min_version_code: 42 }, catalog: [], notices: [], reward_mail_broadcasts: [] });
      mutationPayloads.push(payload);
      return mutationGate.promise;
    },
  },
  CsIntelligence: { rewardTemplate: (key) => ({ key, titleKey: `mail_${key}_title`, bodyKey: `mail_${key}_body` }) },
  setTimeout,
};
const operationContext = {
  console,
  crypto: { randomUUID: (() => { let next = 0; return () => `request-${++next}`; })() },
  document: { getElementById: (id) => operationElements[id] },
  FormData: FakeFormData,
  window: operationWindow,
};
vm.runInNewContext(read("console/operations.js"), operationContext, { filename: "console/operations.js" });
operationWindow.ConsoleOperations.mount();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.match(operationElements.operationsSummary.innerHTML, /공통 호환 코드/, "minimum-version summary must identify the shared compatibility code");
minVersion.form.emit("submit");
minVersion.form.emit("submit");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(confirmationCalls, 1, "a repeated operations submit must not open another confirmation");
assert.equal(mutationPayloads.length, 1, "a repeated operations submit must not start another mutation");
assert.equal(minVersion.form.getAttribute("aria-busy"), "true");
assert.equal(minVersion.button.disabled, true);
const firstRequestId = mutationPayloads[0].requestId;
mutationGate.reject(Object.assign(new Error("temporary_failure"), { status: 500 }));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(minVersion.form.getAttribute("aria-busy"), "false");
assert.equal(minVersion.button.disabled, false);
assert.equal(operationElements.operationsMessage.getAttribute("role"), "alert");
mutationGate = deferred();
minVersion.form.emit("submit");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(mutationPayloads[1].requestId, firstRequestId, `a retry after a server error must keep the idempotency request ID: ${JSON.stringify(mutationPayloads)}`);
mutationGate.resolve({ ok: true });
await new Promise((resolve) => setTimeout(resolve, 0));

console.log("console regressions: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
