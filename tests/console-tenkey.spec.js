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
  await page.route("https://translate.googleapis.com/**", (route) => route.abort());
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

// Google's keyless web translation as the console's browser sees it: "[lang] line" for every text line. how(lang) = "ok",
// "fail" (no answer) or "flat" (the lines run together, which the console must refuse).
async function fakeGoogle(page, how) {
  await page.route("https://translate.googleapis.com/**", (route) => {
    const form = new URLSearchParams(route.request().postData() || "");
    const lang = String(form.get("tl")).replace("-", "_");
    const q = String(form.get("q"));
    const mode = how(lang);
    if (mode === "fail") return route.abort();
    const out = mode === "flat" ? q.replace(/\n+/g, " ") : q.split("\n").map((line) => (line.trim() ? `[${lang}] ${line}` : line)).join("\n");
    return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([[[out, q, null, null, 1]], null, "ko"]) });
  });
}

test("the project picker has no Comrade card; 10key Survival opens on the overview with its nine pages", async ({ page }) => {
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
  await expect(page.locator("#tenkeyNav a")).toHaveCount(9);
  await expect(page.locator("#hexaworldNav")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("overview: today and 7-day numbers first in plain words, one chart, the rest folded; period and platform switches", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#pageTitle")).toHaveText("한눈 요약");
  const today = page.locator("#tenkeyGlanceToday .tk-glance-card");
  const week = page.locator("#tenkeyGlanceWeek .tk-glance-card");
  await expect(today).toHaveCount(4);
  await expect(week).toHaveCount(4);
  // The fixture: today 132 (yesterday 122), installs 8 (14), plays 721 (731), 9 crashes; 7 days 420 vs 310 before.
  await expect(today.nth(0)).toContainText("앱을 연 사람");
  await expect(today.nth(0).locator(".tk-glance-value")).toHaveText("132명");
  await expect(today.nth(0)).toContainText("어제 하루 122명");
  await expect(today.nth(1).locator(".tk-glance-value")).toHaveText("8명");
  await expect(today.nth(2).locator(".tk-glance-value")).toHaveText("721판");
  await expect(today.nth(3)).toHaveAttribute("data-tone", "risk");
  await expect(today.nth(3).locator("a.tk-glance-note")).toHaveAttribute("href", "#/tenkey-crashes");
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText("420명");
  await expect(week.nth(0)).toContainText("▲ 그 전 7일보다 110명 많음");
  await expect(week.nth(3).locator(".tk-glance-value")).toHaveText("42.7%");
  await expect(week.nth(3)).toContainText("설치한 96명 중 41명");
  // 7-day purchases come from the daily series (the last 7 days against the 7 before them).
  const buys = await page.evaluate(() => window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: {} })
    .then((r) => [r.data.series.slice(-7), r.data.series.slice(-14, -7)].map((rows) => rows.reduce((n, row) => n + row.purchases, 0))));
  await expect(week.nth(2).locator(".tk-glance-value")).toHaveText(`${buys[0]}건`);
  await expect(page.locator("#tenkeyOverviewCharts .ov-card")).toHaveCount(1);
  // 최근 7일 DAU: each day's people (the larger of the ping and the game server) over the players that existed by then.
  const dauCells = page.locator("#tenkeyDauWeek .tk-dau-day");
  await expect(dauCells).toHaveCount(7);
  const dauWant = () => page.evaluate(() => window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: {} }).then((r) => {
    const srv = new Map(r.data.server.days.map((d) => [d.day, d]));
    return r.data.series.slice(-7).map((row) => {
      const d = srv.get(row.day);
      const people = Math.max(row.dau, d.active);
      return `${Math.round(Math.min(people, d.players) / d.players * 100)}%|${people} / ${d.players}명`;
    });
  }));
  const dauSeen = () => dauCells.evaluateAll((cells) => cells.map((c) => `${c.querySelector("strong").textContent}|${c.querySelector("span").textContent}`));
  expect(await dauSeen()).toEqual(await dauWant());
  await expect(dauCells.last()).toHaveClass(/is-today/);
  await expect(dauCells.last().locator("small")).toHaveText("오늘");
  await expect(page.locator("#tenkeyOverviewMore")).not.toHaveAttribute("open", "");
  await expect(page.locator("#tenkeyOverviewNotice")).toBeHidden();
  await expect(page.locator("#tenkeyOverviewStatus")).toContainText("베를린 2026-10-23");
  await shot(page, "overview");
  await page.locator('[data-tk-period="30"]').click();
  await expect(page.locator('[data-tk-period="30"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyOverviewCharts .ov-hit")).toHaveCount(30);
  await page.locator("#tenkeyOverviewMore summary").click();
  await expect(page.locator("#tenkeyOverviewMoreCharts .ov-card")).toHaveCount(5);
  await expect(page.locator("#tenkeyOverviewMoreCharts")).toContainText("새로 설치 (30일)");
  await expect(page.locator("#tenkeyOverviewMoreCharts")).toContainText("30일 동안 앱을 연 사람");
  await page.locator('[data-tk-platform="android"]').click();
  await expect.poll(async () => (await calls(page, "overview.get")).at(-1)?.params.platform).toBe("android");
  await expect(today.nth(3)).toContainText("플랫폼 구분 없음");
  await page.locator("#tenkeyOverviewDetails summary").click();
  await expect(page.locator("#tenkeyOverviewServer")).toContainText("공용 DB 전체");
  await page.locator("#tenkeyOverviewCharts .ov-hit").first().hover();
  await expect(page.locator("#tenkeyTip")).toBeVisible();

  // The closed-test build sends no ping: the game server's own counts stand in, never a row of zeros.
  await page.evaluate(() => { window.__mockNoPing = true; });
  await page.locator("#tenkeyOverviewRefresh").click();
  await expect(page.locator("#tenkeyOverviewNotice")).toBeVisible();
  await expect(page.locator("#tenkeyOverviewNotice")).toContainText("게임 서버 기록");
  await expect(today.nth(0).locator(".tk-glance-value")).toHaveText("31명");
  await expect(today.nth(0)).toContainText("어제 하루 27명");
  await expect(today.nth(1).locator(".tk-glance-label")).toHaveText("새 플레이어");
  await expect(today.nth(2).locator(".tk-glance-label")).toHaveText("기록을 올린 사람");
  await expect(today.nth(2).locator(".tk-glance-value")).toHaveText("24명");
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText("260명");
  await expect(week.nth(0)).toContainText("▲ 그 전 7일보다 60명 많음");
  await expect(week.nth(3)).toContainText("새 빌드부터 셈");
  const fresh = await page.evaluate(() => window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: {} })
    .then((r) => [r.data.series.at(-1).new_accounts, r.data.series.slice(-7).reduce((n, row) => n + row.new_accounts, 0)]));
  await expect(today.nth(1).locator(".tk-glance-value")).toHaveText(`${fresh[0]}명`);
  await expect(week.nth(1).locator(".tk-glance-value")).toHaveText(`${fresh[1]}명`);
  await expect(page.locator("#tenkeyOverviewCharts h3")).toHaveText("날마다 앱을 연 사람");
  expect(await dauSeen()).toEqual(await dauWant());
  await expect(page.locator("#tenkeyOverviewCharts .ov-wait")).toHaveCount(0);
  await shot(page, "overview_no_ping");
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

test("notices: Korean only, the seven other languages translated in the browser (the server when that fails) and correctable, then end and delete with a reason", async ({ page }) => {
  const errors = await open(page, "#/tenkey-notices");
  let google = () => "ok";
  await fakeGoogle(page, (lang) => google(lang));
  await expect(page.locator("#tenkeyNoticesListing .audit-item")).toHaveCount(4);
  await expect(page.locator('[data-notice-id="4"]')).toContainText("8개 언어");
  await expect(page.locator('[data-notice-id="3"]')).toContainText("2개 언어");
  await expect(page.locator('[data-notice-id="2"]')).toContainText("한국어만");
  const form = page.locator("#tenkeyNoticeForm");
  await expect(form.locator("[name=titleEn], [name=bodyEn]")).toHaveCount(0);
  await form.locator("[name=titleKo]").fill("새 키캡 이벤트");
  await form.locator("[name=bodyKo]").fill("이번 주말 2배 이벤트\n놓치지 마세요");
  await form.locator("[name=startsAt]").fill("2026-12-01T10:00");
  await form.locator("[name=endsAt]").fill("2026-12-03T10:00");
  await form.locator("[name=reason]").fill("주말 이벤트 예약");
  const cards = page.locator("#tenkeyNoticePreviews .tenkey-notice-card");
  await expect(cards.first()).toContainText("새 키캡 이벤트");
  await expect(page.locator("#tenkeyNoticeTrStatus")).toContainText("발행할 때 자동 번역");
  await expect(form.locator('[data-counter="titleKo"]')).toHaveText("8 / 80자");

  await page.locator("#tenkeyNoticeTranslate").click();
  await expect(cards).toHaveCount(8);
  await expect(page.locator('#tenkeyNoticePreviews [lang="ja"]')).toContainText("[ja] 새 키캡 이벤트");
  await expect(page.locator('#tenkeyNoticePreviews [lang="zh-TW"]')).toContainText("[zh_TW] 놓치지 마세요");
  await expect(page.locator("#tenkeyNoticeTrStatus")).toContainText("8개 언어 준비 완료");
  await page.locator('[data-tr-toggle="en"]').click();
  await page.locator('[data-tr-lang="en"][data-tr-field="title"]').fill("New keycap event");
  await page.locator('[data-tr-toggle="en"]').click();
  await expect(page.locator('#tenkeyNoticePreviews [lang="en"]')).toContainText("직접 고침");
  await expect(page.locator('#tenkeyNoticePreviews [lang="en"] strong')).toHaveText("New keycap event");
  await shot(page, "notices");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("예약");
  await expect(page.locator("#confirmDialog")).toContainText("직접 고친 것 1개");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyNoticesListing .audit-item")).toHaveCount(5);
  const save = (await calls(page, "notices.save"))[0];
  expect(save.params.notice).toMatchObject({ title_ko: "새 키캡 이벤트", body_ko: "이번 주말 2배 이벤트\n놓치지 마세요", starts_at: "2026-12-01T01:00:00.000Z", ends_at: "2026-12-03T01:00:00.000Z" });
  expect(save.params.notice.title_en).toBeUndefined();
  expect(Object.keys(save.params.notice.translations).sort()).toEqual(["de", "en", "es", "fr", "ja", "pt", "zh_TW"]);
  expect(save.params.notice.translations.en).toEqual({ title: "New keycap event", body: "[en] 이번 주말 2배 이벤트\n[en] 놓치지 마세요" });
  expect(save.request_id).toMatch(/^[0-9a-f-]{36}$/);
  expect((await calls(page, "notices.translate")).length).toBe(0);
  await expect(page.locator('[data-notice-id="5"]')).toContainText("8개 언어");

  // Publishing straight away translates first; a Korean change after a preview makes the translations old.
  await form.locator("[name=titleKo]").fill("바로 발행");
  await form.locator("[name=bodyKo]").fill("미리보기 없이");
  await form.locator("[name=reason]").fill("바로");
  await form.locator("button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect.poll(async () => (await calls(page, "notices.save")).length).toBe(2);
  expect((await calls(page, "notices.save"))[1].params.notice.translations.fr).toEqual({ title: "[fr] 바로 발행", body: "[fr] 미리보기 없이" });
  await form.locator("[name=titleKo]").fill("예전 제목");
  await form.locator("[name=bodyKo]").fill("본문");
  await page.locator("#tenkeyNoticeTranslate").click();
  await expect(cards).toHaveCount(8);
  await form.locator("[name=titleKo]").fill("새 제목");
  await expect(page.locator("#tenkeyNoticeTrStatus")).toContainText("한국어가 바뀌어");
  await expect(page.locator("#tenkeyNoticePreviews .is-old")).toHaveCount(7);
  await expect(page.locator("[data-tr-toggle]")).toHaveCount(0);

  // A language the browser cannot get comes from the server; the browser's other six stay.
  google = (lang) => (lang === "ja" ? "flat" : "ok");
  await page.evaluate(() => { window.__mockTranslate = (title, body) => Object.fromEntries(["en", "ja", "de", "zh_TW", "fr", "es", "pt"].map((l) => [l, { title: `srv ${title}`, body: `srv ${body}` }])); });
  await page.locator("#tenkeyNoticeTranslate").click();
  await expect(page.locator('#tenkeyNoticePreviews [lang="ja"] strong')).toHaveText("srv 새 제목");
  await expect(page.locator('#tenkeyNoticePreviews [lang="en"] strong')).toHaveText("[en] 새 제목");
  expect((await calls(page, "notices.translate")).length).toBe(1);
  await page.evaluate(() => { delete window.__mockTranslate; });

  // The browser and the server both failing saves nothing and says so in Korean.
  google = () => "fail";
  await form.locator("[name=titleKo]").fill("둘 다 실패");
  await page.evaluate(() => { window.__mockFailures["notices.translate"] = "notice_translation_unavailable"; });
  await form.locator("[name=reason]").fill("실패 확인");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#tenkeyNoticeFormMessage")).toContainText("자동 번역 서버가 응답하지 않았습니다");
  expect((await calls(page, "notices.save")).length).toBe(2);
  await page.evaluate(() => { delete window.__mockFailures["notices.translate"]; });

  await page.locator('[data-end-notice="3"]').click();
  await page.locator("#tenkeyReasonInput").fill("업데이트 안내 끝");
  await page.locator("#tenkeyReasonDialog button[value=confirm]").click();
  await expect.poll(async () => (await calls(page, "notices.end")).length).toBe(1);
  expect((await calls(page, "notices.end"))[0].params).toMatchObject({ id: 3, reason: "업데이트 안내 끝" });
  await page.locator('[data-delete-notice="1"]').click();
  await page.locator("#tenkeyReasonDialog button[value=cancel]").click();
  expect((await calls(page, "notices.delete")).length).toBe(0);
  // An old notice (English only) shows what it has; the rest is filled on publish.
  await page.locator('[data-edit-notice="3"]').click();
  await expect(form.locator("[name=noticeId]")).toHaveValue("3");
  await expect(page.locator('#tenkeyNoticePreviews [lang="en"]')).toContainText("Update 1.0.0");
  await expect(page.locator("#tenkeyNoticePreviews .is-waiting")).toContainText("일본어");
  await expect(page.locator("#tenkeyNoticeTrStatus")).toContainText("2개 언어 준비");
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
  await expect(page.locator("#tenkeyFlaggedTable")).toHaveCount(0);  // no suspicious-runs panel since 2026-10-24
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

test("밸런스 page: where and why runs end, evolution, cards and mobs in the game's words; filters go to the server; an empty week says why", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#pageTitle")).toHaveText("밸런스");
  const card = (k) => page.locator(`#tenkeyBalanceSummary [data-tk-summary="${k}"]`);
  await expect(card("runs")).toHaveText("240");
  await expect(card("time")).toHaveText("4분 12초");
  await expect(card("drift")).toHaveText("35%");
  await expect(card("revive")).toHaveText("18 / 40");
  await expect(page.locator("#tenkeyBalanceLevels li")).toHaveCount(5);
  await expect(page.locator("#tenkeyBalanceLevels")).toContainText("Lv 11–15");
  await expect(page.locator("#tenkeyBalanceCauses")).toContainText("마우스 포획");
  await expect(page.locator("#tenkeyBalanceCauses")).toContainText("평균 Lv 21.4");
  await expect(page.locator("#tenkeyBalanceForms")).toContainText("텐키 그대로");
  await expect(page.locator("#tenkeyBalanceCards tr")).toHaveCount(4);
  await expect(page.locator("#tenkeyBalanceCards tr").first()).toContainText("레이저");
  await expect(page.locator("#tenkeyBalanceCards")).toContainText("DRIFT 카드");
  await expect(page.locator("#tenkeyBalanceMobs tr")).toHaveCount(2);  // a mob nobody met is left out
  await expect(page.locator("#tenkeyBalanceMobs")).toContainText("휠 마우스");
  await expect(page.locator("#tenkeyBalanceDaily tr")).toHaveCount(7);
  await expect(page.locator("#tenkeyBalanceBuild option")).toHaveCount(3);
  await expect(page.locator("#tenkeyBalanceKnobPanel")).toBeHidden();  // no server-side balance values yet
  await expect(page.locator("#tenkeyBalanceEmpty")).toBeHidden();
  await shot(page, "balance");
  await page.locator("#tenkeyBalanceDays").selectOption("30");
  await page.locator("#tenkeyBalanceBuild").selectOption("5");
  await page.locator("#tenkeyBalanceMode").selectOption("classic");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1).params).toEqual({ days: 30, build: 5, mode: "classic" });
  await expect(page.locator("#tenkeyBalanceBuild")).toHaveValue("5");
  await page.evaluate(() => { window.__mockBalanceEmpty = true; });
  await page.locator("#tenkeyBalanceDays").selectOption("1");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceEmpty")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceEmpty")).toContainText("다음 스토어 빌드부터");
  await expect(page.locator("#tenkeyBalanceBody")).toBeHidden();
  await expect(card("runs")).toHaveText("0");
  expect(errors).toEqual([]);
});

test("밸런스 page: the four server balance values load, save with a reason through the confirm dialog, bump the version; out of range is refused", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  const form = page.locator("#tenkeyKnobForm");
  await expect(form.locator('[name="xp_scale"]')).toHaveValue("1.00");
  await expect(page.locator("#tenkeyKnobVersion")).toContainText("아직 바꾼 적 없음");
  await form.locator('[name="xp_scale"]').fill("1.2");
  await form.locator('[name="mouse_pace"]').fill("0.9");
  await form.locator('[name="reason"]').fill("first runs end too early");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("경험치 배율 1.20");
  await expect(page.locator("#confirmDialog")).toContainText("마우스 속도 0.90");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyKnobMessage")).toContainText("조정값 1번으로 저장했습니다");
  await expect(page.locator("#tenkeyKnobVersion")).toContainText("지금 조정값 1번");
  const sent = (await calls(page, "knobs.set")).at(-1);
  expect(sent.params).toEqual({ knobs: { xp_scale: 1.2, mouse_pace: 0.9, battery_drain_scale: 1, robot_power_scale: 1 }, reason: "first runs end too early" });
  expect(sent.request_id).toMatch(/^[0-9a-f-]{36}$/);
  await page.locator("#tenkeyKnobDefaults").click();
  await expect(form.locator('[name="xp_scale"]')).toHaveValue("1.00");
  await form.locator('[name="robot_power_scale"]').fill("1.5");
  await form.locator('[name="reason"]').fill("too strong");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toBeHidden();
  expect((await calls(page, "knobs.set")).length).toBe(1);
  await shot(page, "balance_knobs", "#tenkeyKnobForm");
  await page.evaluate(() => { window.location.hash = "#/tenkey-audit"; });
  await expect(page.locator("#tenkeyAuditList")).toContainText("밸런스 조정값 변경");
  expect(errors).toEqual([]);
});

test("a server error is shown in Korean without breaking the page", async ({ page }) => {
  await open(page, "#/tenkey-crashes");
  await page.evaluate(() => { window.__mockFailures["crashes.groups"] = "rpc_failed"; });
  await page.locator("#tenkeyCrashFilterForm button[type=submit]").click();
  await expect(page.locator("#tenkeyCrashMessage")).toContainText("서버가 요청을 거부했습니다");
});
