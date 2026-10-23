const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

// 10key Survival pages of the console, walked through with the synthetic stand-in API (tests/fixtures/console_tenkey_api.js).
// TENKEY_SHOTS=<dir> also writes a full-page capture of each page there.
const SHOTS = process.env.TENKEY_SHOTS || "";
// The dev static server (python http.server) sometimes resets one of the ~30 script requests of a cold page load, which only
// shows as a missing project picker; a retry is the fix for that test-infrastructure flake, not for the console.
test.describe.configure({ retries: 2 });
const API = fs.readFileSync(path.join(__dirname, "fixtures/console_tenkey_api.js"), "utf8");
const AUTH = `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({}),renderGoogleButton:()=>{}};`;

async function open(page, hash = "") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: AUTH }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: API }));
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

const calls = (page, action) => page.evaluate((a) => window.__mockCalls.filter((c) => c.action === a), action);

test("the project picker has no Comrade card; 10key Survival opens on the overview with its eight pages", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: AUTH }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: API }));
  await page.goto("/console/");
  await expect(page.locator("#projectPicker .project-card")).toHaveCount(2);
  await expect(page.locator("#projectPicker")).not.toContainText("Comrade");
  await expect(page.locator("#projectPicker")).not.toContainText("동무와 멋진신세계");
  await shot(page, "picker");
  await page.locator("#projectTenkey").click();
  await expect(page.locator("#currentProject")).toHaveText("10key Survival");
  await expect(page).toHaveURL(/#\/tenkey-overview$/);
  await expect(page.locator("#tenkeyNav a")).toHaveCount(8);
  await expect(page.locator("#hexaworldNav")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("overview: six tiles, six charts, period and platform switches", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#pageTitle")).toHaveText("한눈 요약");
  await expect(page.locator("#tenkeyOverviewKpis .ov-kpi")).toHaveCount(6);
  await expect(page.locator("#tenkeyOverviewCharts .ov-card")).toHaveCount(6);
  await expect(page.locator("#tenkeyOverviewKpis .ov-kpi").first()).toContainText("접속자 (DAU)");
  await expect(page.locator("#tenkeyOverviewSummary li").first()).toContainText("오늘 접속");
  await expect(page.locator("#tenkeyOverviewStatus")).toContainText("베를린 2026-10-23");
  await shot(page, "overview");
  await page.locator('[data-tk-period="30"]').click();
  await expect(page.locator('[data-tk-period="30"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-tk-platform="android"]').click();
  await expect.poll(async () => (await calls(page, "overview.get")).at(-1)?.params.platform).toBe("android");
  await page.locator("#tenkeyOverviewDetails summary").click();
  await expect(page.locator("#tenkeyOverviewServer")).toContainText("공용 DB 전체");
  await page.locator("#tenkeyOverviewCharts .ov-hit").first().hover();
  await expect(page.locator("#tenkeyTip")).toBeVisible();
  expect(errors).toEqual([]);
});

test("players: search, open one, ban with a reason through the confirm dialog", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(5);
  await expect(page.locator("#tenkeyPlayerTotal")).toHaveText("5명");
  await shot(page, "players");
  await page.locator("#tenkeyPlayerSearch").fill("딸깍");
  await page.locator("#tenkeyPlayerSearchForm button[type=submit]").click();
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(1);
  await page.locator("#tenkeyPlayersTable a.player-identity-link").click();
  await expect(page.locator("#pageTitle")).toHaveText("플레이어 상세");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("젬 장부");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("보드별 최고 기록");
  await shot(page, "player_detail");
  await page.locator("#tenkeyBanForm [name=reason]").fill("점수 조작 의심");
  await page.locator("#tenkeyBanForm button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toBeVisible();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("정지 풀기");
  const ban = (await calls(page, "players.ban"))[0];
  expect(ban.params).toMatchObject({ banned: true, reason: "점수 조작 의심" });
  expect(ban.request_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(errors).toEqual([]);
});

test("crashes: groups, a group narrows the list, one report shows its trail and Godot log", async ({ page }) => {
  const errors = await open(page, "#/tenkey-crashes");
  await expect(page.locator("#tenkeyCrashGroups tr")).toHaveCount(3);
  await expect(page.locator("#tenkeyCrashTable tr")).toHaveCount(3);
  await expect(page.locator("#tenkeyCrashSummary")).toContainText("발생 횟수");
  await shot(page, "crashes");
  await page.locator('#tenkeyCrashGroups tr[data-tk-group^="handle_crash"]').click();
  await expect(page.locator("#tenkeyCrashTable tr")).toHaveCount(1);
  await page.locator("#tenkeyCrashTable tr").first().click();
  await expect(page.locator("#tenkeyCrashDetail")).toBeVisible();
  await expect(page.locator("#tenkeyCrashDetail .tk-log")).toContainText("Program crashed with signal 11");
  await expect(page.locator("#tenkeyCrashDetail .tk-trail li")).toHaveCount(6);
  await shot(page, "crash_detail", "#tenkeyCrashDetail");
  await page.locator("#tenkeyCrashBy").selectOption("kind");
  await page.locator("#tenkeyCrashFilterForm button[type=submit]").click();
  await expect(page.locator("#tenkeyCrashGroupsTitle")).toHaveText("종류별 묶음");
  expect((await calls(page, "crashes.groups")).at(-1).params.by).toBe("kind");
  expect(errors).toEqual([]);
});

test("notices: schedule one with both languages, preview, end and delete with a reason", async ({ page }) => {
  const errors = await open(page, "#/tenkey-notices");
  await expect(page.locator("#tenkeyNoticesListing .audit-item")).toHaveCount(4);
  await expect(page.locator("#tenkeyNoticesListing")).toContainText("영어 없음");
  const form = page.locator("#tenkeyNoticeForm");
  await form.locator("[name=titleKo]").fill("새 키캡 이벤트");
  await form.locator("[name=bodyKo]").fill("이번 주말 2배 이벤트\n놓치지 마세요");
  await form.locator("[name=titleEn]").fill("New keycap event");
  await form.locator("[name=bodyEn]").fill("Double rewards this weekend");
  await form.locator("[name=startsAt]").fill("2026-12-01T10:00");
  await form.locator("[name=endsAt]").fill("2026-12-03T10:00");
  await form.locator("[name=reason]").fill("주말 이벤트 예약");
  await expect(page.locator("#tenkeyNoticePreviewKo")).toContainText("새 키캡 이벤트");
  await expect(page.locator("#tenkeyNoticePreviewEn")).toContainText("New keycap event");
  await expect(form.locator('[data-counter="titleKo"]')).toHaveText("8 / 80자");
  await shot(page, "notices");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("예약");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyNoticesListing .audit-item")).toHaveCount(5);
  const save = (await calls(page, "notices.save"))[0];
  expect(save.params.notice).toMatchObject({ title_ko: "새 키캡 이벤트", title_en: "New keycap event", starts_at: "2026-12-01T01:00:00.000Z", ends_at: "2026-12-03T01:00:00.000Z" });
  expect(save.request_id).toMatch(/^[0-9a-f-]{36}$/);
  await page.locator('[data-end-notice="3"]').click();
  await page.locator("#tenkeyReasonInput").fill("업데이트 안내 끝");
  await page.locator("#tenkeyReasonDialog button[value=confirm]").click();
  await expect.poll(async () => (await calls(page, "notices.end")).length).toBe(1);
  expect((await calls(page, "notices.end"))[0].params).toMatchObject({ id: 3, reason: "업데이트 안내 끝" });
  await page.locator('[data-delete-notice="1"]').click();
  await page.locator("#tenkeyReasonDialog button[value=cancel]").click();
  expect((await calls(page, "notices.delete")).length).toBe(0);
  await page.locator('[data-edit-notice="2"]').click();
  await expect(form.locator("[name=noticeId]")).toHaveValue("2");
  await expect(page.locator("#tenkeyNoticePreviewEn")).toHaveClass(/is-fallback/);
  expect(errors).toEqual([]);
});

test("purchases, ranking and audit pages render from the server shapes", async ({ page }) => {
  const errors = await open(page, "#/tenkey-purchases");
  await expect(page.locator("#tenkeyPurchasesTable tr")).toHaveCount(4);
  await expect(page.locator('#tenkeyPurchaseSummary [data-tk-summary="refundRate"]')).toHaveText("33.3%");
  await expect(page.locator("#tenkeyGemFacts")).toContainText("리바이브 패스 보유");
  await shot(page, "purchases");
  await page.evaluate(() => { window.location.hash = "#/tenkey-ranking"; });
  await expect(page.locator("#tenkeyBoardTable tr")).toHaveCount(13);
  await expect(page.locator("#tenkeyBoardTable tr.is-dim")).toHaveCount(1);
  await expect(page.locator("#tenkeyFlaggedTable tr")).toHaveCount(2);
  await shot(page, "ranking");
  await page.locator("#tenkeyBoardSelect").selectOption("all");
  await page.locator("#tenkeyBoardForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "ranking.board")).at(-1).params.board).toBe("all");
  await page.evaluate(() => { window.location.hash = "#/tenkey-audit"; });
  await expect(page.locator("#tenkeyAuditList .audit-item")).toHaveCount(3);
  await expect(page.locator("#tenkeyAuditList")).toContainText("플레이어 정지 / 해제");
  await shot(page, "audit");
  await page.evaluate(() => { window.location.hash = "#/tenkey-config"; });
  await expect(page.locator('#tenkeyConfigForm [name="latestVersionCode"]')).toHaveValue("2");
  await shot(page, "config");
  expect(errors).toEqual([]);
});

test("a server error is shown in Korean without breaking the page", async ({ page }) => {
  await open(page, "#/tenkey-crashes");
  await page.evaluate(() => { window.__mockFailures["crashes.groups"] = "rpc_failed"; });
  await page.locator("#tenkeyCrashFilterForm button[type=submit]").click();
  await expect(page.locator("#tenkeyCrashMessage")).toContainText("서버가 요청을 거부했습니다");
});
