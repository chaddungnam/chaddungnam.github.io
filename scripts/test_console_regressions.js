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
assert.match(consoleHtml, /analytics\.js\?v=20260905-5/, "cache must refresh corrected account metrics");
assert.match(consoleHtml, /id="analyticsCoverageMessage"/, "telemetry coverage must be prominent");
assert.doesNotMatch(analyticsSource, /10초 미만 즉시 이탈 제외|종료 \(10초 이상\)/, "all explicit exits belong in the lifecycle sample");
const modelSource = read("console/model.js");
const pulseSource = read("analytics/pulse-model.js");
const consoleStyles = read("console/styles.css");
assert.match(consoleHtml, /<a\s+id="skipLink"[^>]+href="#loginPanel"/i, "the initial skip link must target the visible login panel");
assert.match(consoleHtml, /id="kpiActiveLabel"/, "the active-player KPI must expose a range-aware label");
assert.match(consoleHtml, /id="dailyTrendEyebrow"/, "the daily trend heading must follow the selected range");
assert.match(analyticsSource, /setText\("kpiActive", formatNumber\(activeAccounts\)\)/, "the active-account KPI must count selected-range account activity");
assert.match(analyticsSource, /ConsoleAPI\.post\("analytics-dashboard-v2"/, "the Console must load account visits through the secured analytics wrapper");
assert.match(read("console/api.js"), /"analytics-dashboard-v2"/, "the secured Console API allowlist must permit the analytics wrapper");
assert.match(consoleHtml, /api\.js\?v=20260829-1/, "the Console must cache-bust the updated API allowlist");
assert.match(analyticsSource, /activePlayers: Number\(summary\.installs \?\? 0\)/, "AI advice must use the selected-range active player count");
assert.doesNotMatch(analyticsSource, /summary\.activeInstallsToday/, "selected-range analytics must not silently fall back to today's count");
assert.match(consoleHtml, /<form\s+id="challengeForm"[^>]+aria-describedby="challengeMessage"/i, "the challenge must expose its live result message");
assert.match(consoleHtml, /data-route="analytics-exclusions"/, "the console must expose an analytics exclusion route");
assert.match(consoleHtml, /id="referralConfigForm"/, "operations must expose the referral kill switch");
assert.match(consoleHtml, /id="referralMetrics"/, "operations must expose referral health metrics");
assert.match(read("console/operations.js"), /action: "referrals\.config\.update"/, "the referral switch must use the secured admin action");
assert.match(read("console/operations.js"), /action: "referrals\.get"/, "referral metrics must use the secured read action");
assert.match(read("console/analytics-exclusions.js"), /analytics_exclusions\.list/, "the exclusion route must use the secured admin action");
assert.ok(consoleHtml.search(/<script src="ui-state\.js(?:\?[^\"]+)?"><\/script>/) < consoleHtml.search(/<script src="app\.js(?:\?[^\"]+)?" defer><\/script>/), "the UI state helper must load before the console app");
assert.match(consoleHtml, /id="diagnosticsIssueSignals"/, "the gameplay diagnostics issue-signal panel must exist");
assert.match(consoleHtml, /id="tutorialStagesTable"/, "the gameplay diagnostics tutorial funnel table must exist");
assert.match(consoleHtml, /id="growthChoiceLevelTable"/, "the gameplay diagnostics level-choice table must exist");
assert.match(consoleHtml, /id="mechakuchaSummary"/, "the gameplay diagnostics Mechakucha panel must exist");
assert.match(consoleHtml, /id="gameOverChart"/, "the gameplay diagnostics game-over canvas must exist");
assert.match(consoleHtml, /id="gameOverDailyTable"/, "the gameplay diagnostics daily game-over table must exist");
assert.match(consoleHtml, /id="gameOverBucketTable"/, "the gameplay diagnostics level-bucket table must exist");
assert.match(consoleHtml, /id="gameRunStatusTable"/, "the Console must expose privacy-safe per-game terminal status rows");
assert.match(analyticsSource, /renderGameRunSummary\(\)/, "the Console must render game terminal and checkpoint summaries");
assert.match(analyticsSource, /gameRunSummary/, "the Console must consume the dashboard game-run summary response");
assert.match(analyticsSource, /unknown_stale/, "the Console must distinguish unknown stale runs from explicit exits");
assert.match(consoleHtml, /analytics\.js\?v=20260905-5/, "the Console must cache-bust the balance signal update");
assert.match(consoleHtml, /id="balanceTerminalTable"/, "the Console must expose privacy-safe balance terminal outcomes");
assert.match(consoleHtml, /id="balancePressureSummary"/, "the Console must expose checkpoint board pressure");
assert.match(consoleHtml, /id="balanceChoiceTable"/, "the Console must expose growth-choice outcomes");
assert.match(analyticsSource, /renderBalanceSummary\(\)/, "the Console must render balance telemetry");
assert.match(analyticsSource, /balanceSummary/, "the Console must consume the dashboard balance summary response");
assert.match(consoleHtml, /id="coreLoopSummary"/, "the Console must expose completed-run core-loop quality metrics");
assert.match(consoleHtml, /id="executiveTitle"[^>]*>지금 알아야 할 5가지</, "analytics must begin with a plain-language executive snapshot");
for (const id of ["execPlayers", "execCompleted", "execPlayTime", "execExit", "execReturn"]) {
  assert.match(consoleHtml, new RegExp(`id="${id}"`), `executive summary must expose ${id}`);
}
assert.match(analyticsSource, /renderExecutiveSummary\(pulseModel\)/, "the executive snapshot must refresh with every analytics payload");
for (const id of ["customRangeForm", "customRangeStart", "customRangeEnd", "execCompletionDonut", "execRetentionDonut", "execExitDonut", "versionTrendSelect", "versionTrendChart", "versionUpdateHistory"]) {
  assert.match(consoleHtml, new RegExp(`id="${id}"`), `analytics visualization must expose ${id}`);
}
assert.match(analyticsSource, /\.\.\.rangePayload/, "custom date ranges must be sent as an additive API contract");
assert.match(analyticsSource, /normalizeCustomAnalyticsRange/, "calendar dates must be validated before loading analytics");
assert.match(analyticsSource, /renderExecutiveVisuals\(pulseModel\)/, "donut charts must refresh with every analytics payload");
assert.match(analyticsSource, /state\.payload\?\.versionMonitor/, "version adoption must render from the secured dashboard response");
assert.match(analyticsSource, /gate\?\.effectiveDay[\s\S]*row\.day >= gate\.effectiveDay/, "version trend must begin at the matching forced-update audit date");
assert.match(consoleStyles, /\.executive-overview\s*\{[\s\S]*linear-gradient\([^}]*#ffffff/, "the executive snapshot must use a light surface");
assert.match(consoleStyles, /grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/, "mobile navigation must fit all seven console routes");
assert.match(consoleHtml, /pulse-model\.js\?v=20260831-1/, "the Console must cache-bust conservative return scoring");
assert.match(consoleHtml, /data-range="1" data-range-offset="1"[^>]*>어제</, "the Console must offer a distinct yesterday range");
assert.match(consoleHtml, /class="range-button active" data-range="3"[^>]*>최근 3일</, "the Console must default to the three-day range");
assert.match(analyticsSource, /rangeDays:\s*3,/, "the analytics state must default to three days without a URL override");
assert.match(consoleHtml, /data-range="5"[^>]*>최근 5일</, "the Console must offer a five-day range");
assert.match(analyticsSource, /panel\.hidden = verifiedStops === 0/, "normal growth-choice ad flow must not create a priority card");
assert.match(analyticsSource, /결과가 확인된 판 중 명시적 중간 종료 비율/, "marketing exit-rate copy must match the observed-game denominator");
assert.match(analyticsSource, /결과 확인 3판 이상 헤비 2인분/, "marketing review must count a verified heavy player as two people");
assert.match(consoleHtml, /헤비 —설치\(2인분\)/, "the Pulse facts must disclose the light/heavy weighting");
assert.doesNotMatch(analyticsSource, /성숙 일별 코호트/, "marketing review must not expose an opaque mature-cohort gate");
assert.match(consoleHtml, /이벤트별 고유 설치 수/, "event funnels must use the requested people terminology");
assert.match(pulseSource, /MIN_DAILY_ACTIVE_PEOPLE = 5/, "Pulse must start judging at five daily active people");
assert.match(pulseSource, /MIN_RETENTION_COMPARISON_PEOPLE = 20/, "Pulse must require a meaningful return comparison sample");
assert.match(pulseSource, /dailyRows\.reduce[\s\S]*\/ dailyRows\.length/, "multi-day Pulse must use average daily active people");
assert.match(pulseSource, /const enoughSamples = dailyActivePeople >= MIN_DAILY_ACTIVE_PEOPLE/, "heavy-player weighting must not inflate statistical sample confidence");
assert.match(analyticsSource, /MIN_RETENTION_COMPARISON_PEOPLE/, "the return explanation must disclose its minimum comparison sample");
assert.match(pulseSource, /confidence: isEstimate \? "estimate" : "standard"/, "small samples must still produce an explicitly low-confidence estimate");
assert.match(pulseSource, /periodReturn = payload\.periodReturn/, "Pulse return scoring must follow the selected range");
assert.match(consoleHtml, /선택 기간과 바로 이전 같은 기간 비교/, "the return card must explain its selected-range comparison");
assert.match(analyticsSource, /periodReturn\.previousPlayers/, "the return explanation must show the previous-window denominator");
assert.match(analyticsSource, /총 활동 계정은/, "the overall judgment must start with all selected-range active accounts");
assert.match(analyticsSource, /knownNumber\(state\.payload\?\.accountActivity\?\.accountsWithCompletedGame\)/, "completion KPI must use authenticated account totals");
assert.doesNotMatch(analyticsSource, /const cohortText =/, "the overall judgment must not lead with new-player cohorts");
assert.match(consoleHtml, /id="priorityInsightPanel"[^>]+hidden/, "the growth-choice priority card must start hidden");
assert.match(analyticsSource, /buttonRows\.filter\(\(row\) => row\.legacy\)/, "legacy interactions must remain visible at the bottom after current buttons");
assert.match(consoleHtml, /model\.js\?v=20260904-1/, "the Console must cache-bust catalog labels and mail summaries");
assert.match(consoleHtml, /같은 버튼에서 5초 이상 걸린 행동이 5회 이상일 때만 표시/, "button hesitation must disclose both the duration and sample gates");
assert.match(analyticsSource, /formatNumber\(row\.users\)\}<\/b>명/, "button hesitation must use the requested people terminology");
assert.match(analyticsSource, /Math\.max\(5, Math\.round\(value \* 10\)/, "hesitation formatting must preserve the five-second lower bound");
assert.match(analyticsSource, /Number\(row\.exits \|\| 0\) > 0/, "screen drop-off cards must hide screens with no exits");
assert.match(modelSource, /한 명에게 몰린 신호/, "single-person hesitation guidance must use the requested terminology");
assert.match(modelSource, /문의 지원 페이지로 이동 \(외부 브라우저\)/, "the old settings popup path must be identified as the support-page handoff");
assert.match(analyticsSource, /row\.count \?\? row\.selected/, "choice distributions must use the dashboard count instead of rendering every choice as zero");
assert.match(consoleHtml, /auth\.js\?v=20260829-1/, "the Console must cache-bust the 72-hour session client");
assert.match(consoleHtml, /기간 내 계정 활동 신호/, "the period account panel must describe evidence rather than claim exact presence");
assert.match(consoleHtml, /정확한 새 실행 방문, 로그인, 앱 RPC, 계정 동기화, 홈 진입과 게임 완료/, "the period account panel must explain every supported activity signal");
assert.match(consoleHtml, /id="accountActivitySummary"/, "the Console must expose exact account visits and account retention");
assert.match(consoleHtml, /백그라운드 복귀 같은 session_start만으로는 세지 않습니다/, "the account visit definition must exclude session-only resumes");
assert.match(analyticsSource, /source === "app_visit"[\s\S]*새 실행 방문/, "fresh process visits must remain a distinct activity source");
assert.match(analyticsSource, /zeroCompletedGameAccounts/, "zero-completion visiting accounts must be visible");
assert.match(analyticsSource, /source === "app_activity"[\s\S]*앱 서버 접속/, "existing builds must show server-confirmed app activity");
assert.match(analyticsSource, /source === "account_sync"[\s\S]*계정 동기화/, "historical account synchronization must remain a distinct signal");
assert.match(analyticsSource, /source === "signed_in"[\s\S]*홈 도달 여부 미확인/, "sign-in evidence must not be mislabeled as a home visit");
assert.match(analyticsSource, /Number\(row\.gamesPlayed\) === 0 \? "signed_in"/, "zero-completion accounts must render as signed-in activity");
assert.match(analyticsSource, /latestActivityAt \|\| row\.latestPlayedAt/, "period accounts must render their latest available activity timestamp");
assert.match(analyticsSource, /state\.payload = null;[\s\S]*선택한 기간의 계정 목록을 불러오지 못했습니다/, "a failed period request must clear stale player rows");
assert.match(consoleHtml, /styles\.css\?v=20260905-2/, "the Console must cache-bust the long-form notice editor layout");
assert.match(consoleStyles, /한 계정 한 줄로 압축/, "period account activity must use compact rows rather than oversized cards");
assert.match(consoleHtml, /id="priorityInsightPanel"/, "the analytics overview must surface priority drop-off insights near the top");
assert.match(consoleHtml, /id="growthChoicesTable" class="distribution-list"/, "choice distributions must render as responsive cards instead of a wide table");
assert.match(consoleHtml, /정확 계측 지원 빌드 대기/, "account visit coverage must disclose instrumentation readiness");
assert.match(analyticsSource, /String\(row\.screen \|\| ""\)\.toLowerCase\(\) !== "home"/, "ordinary home exits must be hidden from screen drop-off cards");
assert.match(analyticsSource, /명시적인 앱 종료가 선택보다 먼저 기록된/, "the priority insight must only call an explicit app quit a stop");
assert.match(analyticsSource, /명시적인 앱 종료가 선택보다 먼저 기록된/, "the priority insight must only show explicit app quits");
assert.doesNotMatch(analyticsSource, /성장 선택 광고 흐름 정상/, "normal ad flow must not consume a priority card");
assert.match(analyticsSource, /renderPriorityInsights/, "the dashboard must render the verified ad-to-choice flow as a priority insight");
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
assert.match(playersSource, /id=\"playerNoteForm\"/, "player detail must expose the tracking note editor");
assert.match(playersSource, /action: \"players\.note\.set\"/, "tracking notes must use the secured admin action");
assert.match(consoleHtml, /id=\"playerTrackedOnly\"/, "the player list must support tracked-only monitoring");
assert.match(analyticsSource, /ConsoleModel\.playerIdentityMarkup/, "analytics player names must deep-link to player detail");
assert.match(read("console/purchases.js"), /ConsoleModel\.playerIdentityMarkup/, "purchase player identities must deep-link to player detail");
assert.match(read("console/audit.js"), /ConsoleModel\.playerIdentityMarkup/, "audit player identities must deep-link to player detail");
assert.match(consoleStyles, /\.player-note-badge/, "global player note badges must have shared styling");

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
const legacyAuthStorage = memoryStorage();
const adminSessionPayload = Buffer.from(JSON.stringify({ sub: "google-1", email: "admin@example.com", iat: 1, exp: 9999999999 })).toString("base64url");
const adminSessionTicket = `${adminSessionPayload}.signature`;
let googleCredentialCallback;
let authFetchRequest;
let authReply = { adminTicket: adminSessionTicket, expiresIn: 259200, email: "admin@example.com" };
const authWindow = {
  localStorage: authStorage,
  sessionStorage: legacyAuthStorage,
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
assert.equal(authWindow.ConsoleAuth.headers()["X-Admin-Session"], adminSessionTicket);
assert.equal(authStorage.getItem("house_duck_console_admin_ticket"), adminSessionTicket, "the 72-hour session must persist across browser restarts");
assert.equal(legacyAuthStorage.getItem("house_duck_console_admin_ticket"), null, "the old tab-only session storage must be cleared");
authReply = { adminTicket: "", expiresIn: 0, email: "admin@example.com" };
await assert.rejects(() => authWindow.ConsoleAuth.unlock("answer"), /admin_auth_failed/);

const expiredGooglePayload = Buffer.from(JSON.stringify({ email: "admin@example.com", exp: 1 })).toString("base64url");
authStorage.setItem("house_duck_console_google_id_token", `header.${expiredGooglePayload}.signature`);
const reloadWindow = {
  localStorage: authStorage,
  sessionStorage: memoryStorage(),
  ConsoleModel: authWindow.ConsoleModel,
  google: { accounts: { id: { initialize() {}, renderButton() {} } } },
  dispatchEvent() {},
  setTimeout,
};
vm.runInNewContext(read("console/auth.js"), {
  Buffer,
  CustomEvent: authContext.CustomEvent,
  Date,
  document: { getElementById: () => ({}) },
  fetch: authContext.fetch,
  setTimeout,
  window: reloadWindow,
}, { filename: "console/auth.js" });
const reloadedAuth = await reloadWindow.ConsoleAuth.initialize({ clientId: "client", publishableKey: "public", authUrl: "https://example.test/admin-auth" });
assert.equal(reloadedAuth.unlocked, true, "an expired Google ID token must not end a valid 72-hour admin session");
assert.equal(reloadedAuth.email, "admin@example.com");
assert.equal(reloadWindow.ConsoleAuth.headers().Authorization, undefined, "expired Google credentials must not be sent to admin APIs");
reloadWindow.ConsoleAuth.logout();
assert.equal(authStorage.getItem("house_duck_console_admin_ticket"), null, "explicit logout must still clear the persistent session");

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
const referralConfig = operationForm({ enabled: formField(""), reason: formField("launch") });
referralConfig.form.elements.enabled.checked = true;
const qaAccess = operationForm({ userId: formField("user-1"), shopControlsEnabled: formField(""), reason: formField("qa") });
const announcement = operationForm({ announcementId: formField(""), body: formField("notice"), startsAt: formField("2026-08-10T12:00"), endsAt: formField(""), reason: formField("ops") });
const operationElements = {
  rewardMailForm: reward.form,
  minVersionForm: minVersion.form,
  referralConfigForm: referralConfig.form,
  qaAccessForm: qaAccess.form,
  announcementForm: announcement.form,
  announcementReset: appElement(),
  rewardTemplatePreview: appElement(),
  rewardValueLabel: Object.assign(appElement(), { firstChild: { textContent: "" } }),
  operationsMessage: appElement(),
  operationsSummary: appElement(),
  operationsHistory: appElement(),
  referralMetrics: appElement(),
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
      if (payload.action === "referrals.get") return Promise.resolve({ enabled: true, codes_issued: 2, accepted_total: 1, accepted_today_utc: 1, tier_3_total: 0 });
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
