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

test("the project picker has no Comrade card; 10key Survival opens on the overview with its thirteen pages", async ({ page }) => {
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
  await expect(page.locator("#tenkeyNav a")).toHaveCount(13);
  await expect(page.locator("#hexaworldNav")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("overview: the itch.io web filter shows its own visits and runs, the return rate by itch account, never the game server's people", async ({ page }) => {
  const errors = await open(page);
  const today = page.locator("#tenkeyGlanceToday .tk-glance-card");
  const week = page.locator("#tenkeyGlanceWeek .tk-glance-card");
  await expect(today).toHaveCount(5);
  await expect(page.locator('[data-tk-platform="web_itch"]')).toHaveText("웹(itch)");
  await page.locator('[data-tk-platform="web_itch"]').click();
  await expect.poll(async () => (await calls(page, "overview.web")).length).toBeGreaterThan(1);
  await expect(page.locator('[data-tk-platform="web_itch"]')).toHaveAttribute("aria-pressed", "true");
  const want = await page.evaluate(() => window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: { platform: "web_itch" } })
    .then((r) => [r.data.active.d1, r.data.active.d7, r.data.runs.d1]));
  // people = the web pings only (the game server's accounts are app players, 31 / 260 in the fixture would win the max)
  await expect(today.nth(0).locator(".tk-glance-value")).toHaveText(`${want[0]}명`);
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText(`${want[1]}명`);
  await expect(today.nth(2).locator(".tk-glance-value")).toHaveText(`${want[2]}판`);
  // 2026-11-12: the anonymous itch id cannot be followed, so the rate is counted over the itch ACCOUNTS the game server saw
  await expect(week.nth(3).locator(".tk-glance-value")).toHaveText("33.3%");
  await expect(week.nth(3)).toContainText("새 계정");
  await expect(page.locator("#tenkeyOverviewNotice")).toBeVisible();
  await expect(page.locator("#tenkeyOverviewNotice")).toContainText("방문 수");
  await page.locator("#tenkeyOverviewMore summary").click();
  await expect(page.locator("#tenkeyOverviewMoreCharts")).toContainText("웹 · itch.io");
  await shot(page, "overview_web_itch");
  await page.locator('[data-tk-platform=""]').click();
  await expect(page.locator("#tenkeyOverviewNotice")).toBeHidden();
  expect(errors).toEqual([]);
});

test("overview: today and 7-day numbers first in plain words, one chart, the rest folded; period and platform switches", async ({ page }) => {
  // Without the web numbers (and the pre-registration counts) the overview keeps its four-card layout; the split view has its own test.
  const NO_SPLIT = "\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn===\"tenkey-console-stats\")throw Object.assign(new Error(\"blocked\"),{status:503});return real(pj,fn,b);};})();";
  const errors = await open(page, "", NO_SPLIT);
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
  // 최근 7일 앱 DAU: each day's people (the larger of the ping and the game server) over the players that existed by then.
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
  await expect(page.locator("#tenkeyOverviewCharts h3")).toHaveText("날마다 한눈에");
  expect(await dauSeen()).toEqual(await dauWant());
  await expect(page.locator("#tenkeyOverviewCharts .ov-wait")).toHaveCount(0);
  await shot(page, "overview_no_ping");
  expect(errors).toEqual([]);
});

test("players: [버그유저] label only on an account whose day-cap hit does not fit its play time (owner 11-02)", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(7);
  await expect(page.locator("#tenkeyPlayersTable tr", { hasText: "[버그유저]" })).toHaveCount(1);
  await expect(page.locator("#tenkeyPlayersTable tr", { hasText: "[버그유저]" })).toContainText("의심스러운덕");
  await shot(page, "players_bug_user");
  await page.locator("#tenkeyPlayersTable tr", { hasText: "의심스러운덕" }).locator("a.player-identity-link").click();
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("[버그유저]");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("하루 부품 상한 도달");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("말이 안 됨");
  await shot(page, "player_detail_bug_user");
  expect(errors).toEqual([]);
});

test("players: search, open one, ban with a reason through the confirm dialog", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(7);
  await expect(page.locator("#tenkeyPlayerTotal")).toHaveText("7명");
  const platforms = await page.locator('#tenkeyPlayersTable td[data-label="플랫폼"]').allTextContents();
  expect(platforms).toEqual(["Android", "iOS", "웹 · CrazyGames", "Android", "모름", "Windows", "Mac"]);
  await shot(page, "players");
  await page.locator("#tenkeyPlayerSearch").fill("딸깍");
  await page.locator("#tenkeyPlayerSearchForm button[type=submit]").click();
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(1);
  await page.locator("#tenkeyPlayersTable a.player-identity-link").click();
  await expect(page.locator("#pageTitle")).toHaveText("플레이어 상세");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("젬 장부");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("보드별 최고 기록");
  await expect(page.locator("#tenkeyPlayerDetail")).toContainText("Android · 1.0.0 (2)");
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
  await expect(page.locator('#tenkeyConfigForm [name="minVersionCode"]')).toHaveValue("1");
  await expect(page.locator('#tenkeyConfigForm [name="latestVersionCode"], #tenkeyConfigForm [name="storeUrlIos"], #tenkeyConfigForm [name="storeUrlAndroid"]')).toHaveCount(0);
  await expect(page.locator("#tenkeyLinkIos")).toHaveText("TestFlight 공개 링크");
  await expect(page.locator("#tenkeyLinkIos")).toHaveAttribute("href", "https://testflight.apple.com/join/RqNJg7Dp");
  await expect(page.locator("#tenkeyBuildsAndroid tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyBuildsAndroid .tk-gate.is-blocked")).toHaveCount(0);
  await page.locator('#tenkeyConfigForm [name="minVersionCode"]').fill("3");
  await expect(page.locator("#tenkeyBuildsAndroid tr").nth(1)).toContainText("막힘 · 업데이트 창");
  await shot(page, "config");
  await page.locator('#tenkeyConfigForm [name="reason"]').fill("빌드 3 배포");
  await page.locator("#tenkeyConfigForm button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("막히는 빌드: Android 빌드 2 (판 한 사람 8)");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyConfigMessage")).toContainText("저장했습니다");
  expect((await calls(page, "config.set")).at(-1).params.config).toEqual({ min_version_code: 3, latest_version_code: 3, min_build_ios: 0, latest_build_ios: 0 });
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
  await expect(page.locator("#tenkeyBalanceCards tr")).toHaveCount(5);
  await expect(page.locator("#tenkeyBalanceCards tr").first()).toContainText("레이저");
  await expect(page.locator("#tenkeyBalanceCards")).toContainText("DRIFT 카드");
  await expect(page.locator("#tenkeyBalanceMobs tr")).toHaveCount(2);  // a mob nobody met is left out
  await expect(page.locator("#tenkeyBalanceMobs")).toContainText("휠 마우스");
  await expect(page.locator("#tenkeyBalanceDaily tr")).toHaveCount(7);
  await expect(page.locator("#tenkeyBalanceBuild option")).toHaveCount(3);
  await expect(card("fever")).toHaveText("10%");  // 24 of 240 runs took the GOLDEN FEVER card
  await expect(page.locator("#tenkeyBalanceKnobPanel")).toBeHidden();  // no server-side balance values yet
  await expect(page.locator("#tenkeyBalanceEmpty")).toBeHidden();
  await shot(page, "balance");
  await page.locator("#tenkeyBalanceDays").selectOption("30");
  await page.locator("#tenkeyBalanceBuild").selectOption("5");
  await page.locator("#tenkeyBalanceMode").selectOption("classic");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1).params).toEqual({ days: 30, build: 5, mode: "classic" });  // the device filter stays out of the call while it reads 전체
  await expect(page.locator("#tenkeyBalanceBuild")).toHaveValue("5");
  await page.evaluate(() => { window.__mockBalanceEmpty = true; });
  await page.locator("#tenkeyBalanceDays").selectOption("1");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceEmpty")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceEmpty")).toContainText("다음 스토어 빌드부터");
  await expect(page.locator("#tenkeyBalanceEmpty")).toContainText("웹 체험판");
  await expect(page.locator("#tenkeyBalanceBody")).toBeHidden();
  await expect(card("runs")).toHaveText("0");
  expect(errors).toEqual([]);
});

test("밸런스 page: DRIFT runs from the web demo are no longer hidden (owner 11-12); the device list says where they were played; the device filter goes to the server", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#tenkeyBalancePlatforms tr")).toHaveCount(3);
  await expect(page.locator("#tenkeyBalancePlatforms")).toContainText("웹 체험판 (itch)");
  const web = page.locator("#tenkeyBalancePlatforms tr", { hasText: "웹 체험판" });
  await expect(web.locator('td[data-label="DRIFT까지 간 판"]')).toHaveText("8 · 11.4%");
  const app = page.locator("#tenkeyBalancePlatforms tr", { hasText: "Android" });
  await expect(app.locator('td[data-label="DRIFT까지 간 판"]')).toHaveText("0 · 0%");
  await expect(page.locator("#tenkeyBalanceModes")).toHaveText("노멀 모드 240판 · 하드모드 판 없음");
  await page.locator("#tenkeyBalancePlatform").selectOption("web");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1).params).toEqual({ days: 7, platform: "web" });
  await page.locator("#tenkeyBalancePlatform").selectOption("app");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1).params).toEqual({ days: 7, platform: "app" });
  await shot(page, "balance_where", "#tenkeyBalanceWhere");
  expect(errors).toEqual([]);
});

test("밸런스 page: the causes of an end are named, NUM LOCK / mouse crises and the three chance cards are listed from the run timeline", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#tenkeyBalanceCrises")).toContainText("NUM LOCK 철창");
  await expect(page.locator("#tenkeyBalanceCrises li").first()).toContainText("91.7%");  // 55 of 60 timelines
  await expect(page.locator("#tenkeyBalanceTraceNote")).toContainText("60판");
  const row = (k) => page.locator("#tenkeyBalanceChance tr", { hasText: k });
  await expect(row("골든 피버").locator('td[data-label="성공 비율"]')).toHaveText("45%");
  await expect(row("DRIFT").locator('td[data-label="성공 횟수"]')).toHaveText("7");
  await expect(row("골든 피버").locator('td[data-label="고를 때 평균 레벨"]')).toHaveText("Lv 6");
  await expect(page.locator("#tenkeyBalanceFormTime")).toContainText("골든 피버 7.5초");
  await shot(page, "balance_trace", "#tenkeyBalanceTrace");
  expect(errors).toEqual([]);
});

test("밸런스 page: level times and the DRIFT / robot time say \"앱 다음 빌드부터\" until a build sends them, then fill in", async ({ page }) => {
  let errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#tenkeyBalanceReachNote")).toContainText("앱 다음 빌드부터");
  await expect(page.locator("#tenkeyBalanceReachRows")).toContainText("이 기간에 기록이 없습니다");
  await page.evaluate(() => { window.__mockReach = true; });
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceReachNote")).toContainText("DRIFT 평균 1분 30초");
  await expect(page.locator("#tenkeyBalanceReachRows tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyBalanceReachRows")).toContainText("Lv 5");
  expect(errors).toEqual([]);
});

test("밸런스 page: hard mode says \"하드모드 판 없음\" when there is none, shows boss fights and the meter when there are runs, and says when the meter is not sent yet", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#tenkeyBalanceHardEmpty")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceHardEmpty")).toContainText("하드모드 판 없음");
  await expect(page.locator("#tenkeyBalanceHardBody")).toBeHidden();
  await page.evaluate(() => { window.__mockHard = true; });
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceHardBody")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceModes")).toHaveText("노멀 모드 230판 · 하드 모드 10판");
  await expect(page.locator("#tenkeyBalanceBosses tr")).toHaveCount(3);
  const boss = page.locator("#tenkeyBalanceBosses tr", { hasText: "Lv 10 보스" });
  await expect(boss.locator('td[data-label="이긴 비율"]')).toHaveText("33.3%");
  await expect(boss.locator('td[data-label="한 번에 걸린 시간"]')).toHaveText("1분 20초");
  await expect(page.locator("#tenkeyBalanceLostBat")).toContainText("시간 소모");
  await expect(page.locator("#tenkeyBalanceLostDur")).toContainText("키보드 내려치기");
  await expect(page.locator("#tenkeyBalanceRefillDur")).toContainText("수리 키트");
  await expect(page.locator("#tenkeyBalanceDealt")).toContainText("레이저");
  await expect(page.locator("#tenkeyBalanceClamp")).toContainText("4번 중 3번 스스로 빠져나옴");
  await shot(page, "balance_hard", "#tenkeyBalanceHard");
  await page.evaluate(() => { window.__mockHardNoMeter = true; });
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceLostBat")).toContainText("앱 다음 빌드부터");
  expect(errors).toEqual([]);
});

test("밸런스 page: an older server answer without the new lists leaves the new panels out instead of breaking", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockBalanceV1 = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  await expect(page.locator("#tenkeyBalanceWhere")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceHard")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceTrace")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceReach")).toBeHidden();
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


test("overview: 전체 counts players by account (itch + app), keeps anonymous itch web visits apart and shows pre-registrations by day and language", async ({ page }) => {
  const errors = await open(page);
  const today = page.locator("#tenkeyGlanceToday .tk-glance-card");
  const week = page.locator("#tenkeyGlanceWeek .tk-glance-card");
  await expect(today).toHaveCount(5);
  await expect(week).toHaveCount(5);
  await expect(today.nth(0).locator(".tk-glance-label")).toHaveText("플레이어 (DAU)");
  await expect(today.nth(1).locator(".tk-glance-label")).toHaveText("웹 방문 (itch)");
  await expect(today.nth(3).locator(".tk-glance-label")).toHaveText("사전예약");
  const want = await page.evaluate(async () => {
    const all = (await window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: {} })).data;
    const web = (await window.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "overview.web", params: { days: 90 } })).data;
    const pre = (await window.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "prereg.get", params: { days: 90 } })).data;
    return { app: all.server.seen.d1, visits: web.active.d1, pre: pre.d1, total: pre.total };
  });
  await expect(today.nth(0).locator(".tk-glance-value")).toHaveText(`${want.app}명`);
  await expect(today.nth(1).locator(".tk-glance-value")).toHaveText(`${want.visits}회`);
  await expect(today.nth(3).locator(".tk-glance-value")).toHaveText(`${want.pre}명`);
  await expect(today.nth(3)).toContainText(`총 ${want.total}명`);
  await expect(page.locator("#tenkeyDauTitle")).toHaveText("최근 7일 DAU");
  await expect(page.locator("#tenkeyOverviewCharts .ov-card")).toHaveCount(3);
  await expect(page.locator("#tenkeyOverviewCharts")).toContainText("플레이어 (DAU) 플랫폼별");
  await expect(page.locator("#tenkeyOverviewCharts .ov-line")).toHaveCount(3);
  await expect(page.locator("#tenkeyOverviewCharts .tk-prereg-card")).toContainText("총 사전예약");
  await expect(page.locator("#tenkeyOverviewCharts .tk-prereg-card .ov-legend")).toContainText("중국어(번체)"); // zh page since 11-04 (owner 11-05)
  await expect(page.locator("#tenkeyOverviewCharts .tk-prereg-card .overview-drill-body")).toContainText("중국어(번체)");
  // 1일 / 3일 / 7일: each window exactly (today included) against the N days before; next-day return split itch / app.
  await expect(page.locator('[data-tk-compare="d1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 1일");
  await expect(week.nth(0).locator(".tk-glance-label")).toHaveText("플레이어 (1일)");
  await expect(week.nth(0)).toContainText("앞 1일보다 1명 많음");
  await expect(week.nth(4).locator(".tk-glance-value")).toHaveText("40%");
  await expect(week.nth(4)).toContainText("itch 33.3% (1/3) · 앱 50% (1/2)");
  await page.locator('[data-tk-compare="d3"]').click();
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 3일");
  await expect(week.nth(0)).toContainText("앞 3일보다 3명 많음");
  await expect(week.nth(4)).toContainText("itch 33.3% (3/9)");
  await page.locator('[data-tk-compare="w"]').click();
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 7일");
  await expect(week.nth(0)).toContainText("앞 7일보다 7명 많음");
  await page.locator('[data-tk-compare="d1"]').click();
  await shot(page, "overview_split");
  expect(errors).toEqual([]);
});

test("제보 page: the players' 1:1 inquiry texts with their reply email, newest first; the YouTube link form; 재방문 opens its own page", async ({ page }) => {
  const MOCK = "\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn===\"tenkey-console-stats\"&&b.action===\"reports.list\"){window.__reportCalls=(window.__reportCalls||[]).concat([b.params]);return {ok:true,data:b.params.days===1?{total:0,rows:[]}:{total:2,rows:[{receipt:\"a1b2c3d4\",submitted_at:\"2026-11-05T11:00:00Z\",body:\"<b>보스</b>에서 멈춤\\n두 줄\",meta:{version:\"1.0.3\",build:\"41\",platform:\"android\",device:\"SM-S918B\",locale:\"ko\"},email:\"fan+tk@example.com\",status:\"open\",player_id:\"11111111-1111-4111-8111-111111111111\",display_name:\"딸깍왕\",public_id:\"TK7Q2\"},{receipt:\"ffff0000\",submitted_at:\"2026-11-04T09:00:00Z\",body:\"text\",meta:{locale:\"ja\"},status:\"open\",player_id:null}]}};}return real(pj,fn,b);};})();";
  const errors = await open(page, "#/tenkey-reports", MOCK);
  await expect(page.locator("#tenkeyReportsView")).toBeVisible();
  await expect(page.locator("#pageTitle")).toHaveText("1대1 문의");
  const rows = page.locator("#tenkeyReportTable tr");
  await expect(rows).toHaveCount(2);
  await expect(page.locator("#tenkeyReportTotal")).toHaveText("2건");
  await expect(rows.nth(0)).toContainText("<b>보스</b>에서 멈춤");
  await expect(rows.nth(0).locator("b")).toHaveCount(0);
  await expect(rows.nth(0)).toContainText("v1.0.3 · 빌드 41");
  await expect(rows.nth(0)).toContainText("Android · SM-S918B");
  await expect(rows.nth(0)).toContainText("a1b2c3d4");
  await expect(rows.nth(0).locator('a[href="#/tenkey-players/11111111-1111-4111-8111-111111111111"]')).toHaveText("딸깍왕");
  await expect(rows.nth(0).locator('a[href="mailto:fan+tk@example.com"]')).toHaveText("fan+tk@example.com");
  await expect(rows.nth(0).locator("[data-copy-email]")).toHaveText("복사");
  await expect(rows.nth(1)).toContainText("없음 (이전 빌드)");
  await expect(rows.nth(1)).toContainText("일본어");
  await expect(rows.nth(1)).toContainText("플레이어 기록 없음");
  await page.locator("#tenkeyReportDays").selectOption("1");
  await expect(page.locator("#tenkeyReportTable")).toContainText("최근 1일 동안 들어온 제보가 없습니다.");
  expect(await page.evaluate(() => window.__reportCalls.map((p) => p.days))).toEqual([7, 1]);
  await shot(page, "reports");
  await page.evaluate(() => { window.location.hash = "#/tenkey-retention"; });
  await expect(page.locator('[data-route="tenkey-retention"]')).toBeVisible();
  await expect(page.locator("#pageTitle")).toHaveText("재방문");
  expect(errors).toEqual([]);
});

test("제보 page: the YouTube link form shows the current value, refuses a non-YouTube link, saves a Short with a reason, and '' resets", async ({ page }) => {
  const MOCK = "\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn===\"tenkey-console-stats\"&&b.action===\"reports.list\")return {ok:true,data:{total:0,rows:[]}};return real(pj,fn,b);};})();";
  const errors = await open(page, "#/tenkey-reports", MOCK);
  const form = page.locator("#tenkeyCommunityForm");
  await expect(form).toBeVisible();
  await expect(page.locator("#tenkeyCommunityCurrent")).toHaveText("https://www.youtube.com/@Sergeant_Houseduck");
  await expect(page.locator("#tenkeyCommunityNote")).toContainText("기본값");
  await form.locator("[name=url]").fill("https://evil.example/watch?v=1");
  await form.locator("[name=reason]").fill("test");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#tenkeyCommunityFormMessage")).toContainText("유튜브 주소");
  expect(await page.evaluate(() => window.__mockCalls.filter((c) => c.action === "community.set").length)).toBe(0);
  await form.locator("[name=url]").fill("https://www.youtube.com/shorts/abc123");
  await form.locator("[name=reason]").fill("출시 쇼츠");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("https://www.youtube.com/shorts/abc123");
  await expect(page.locator("#confirmDialog")).toContainText("출시 쇼츠");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyCommunityCurrent")).toHaveText("https://www.youtube.com/shorts/abc123");
  const saved = await page.evaluate(() => window.__mockCalls.filter((c) => c.action === "community.set"));
  expect(saved.length).toBe(1);
  expect(saved[0].params).toEqual({ url: "https://www.youtube.com/shorts/abc123", reason: "출시 쇼츠" });
  expect(saved[0].request_id).toMatch(/^[0-9a-f-]{36}$/);
  await form.locator("[name=url]").fill("");
  await form.locator("[name=reason]").fill("기본으로");
  await form.locator("button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyCommunityNote")).toContainText("기본값");
  await shot(page, "reports_youtube");
  expect(errors).toEqual([]);
});

test("the 13-page menu scrolls when the window is short: desktop sidebar up and down, phone bar sideways; log out stays visible", async ({ page }) => {
  const phone = test.info().project.name.startsWith("mobile");
  if (!phone) await page.setViewportSize({ width: 1280, height: 620 });
  const errors = await open(page);
  const nav = page.locator("#tenkeyNav");
  const last = page.locator('#tenkeyNav a[data-page="tenkey-audit"]');
  const size = await nav.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth }));
  if (phone) {
    expect(size.sw).toBeGreaterThan(size.cw);
    const box = await nav.boundingBox();
    expect(box.height).toBeLessThan(80);
  } else {
    expect(size.sh).toBeGreaterThan(size.ch);
    await expect(page.locator("#logoutButton")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1 || getComputedStyle(document.querySelector(".console-sidebar")).position === "sticky")).toBe(true);
  }
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await shot(page, "nav-scrolled");
  await last.click();
  await expect(page.locator("#pageTitle")).toHaveText("감사 기록");
  expect(errors).toEqual([]);
});

// con-audit 2026-11-12: the shapes below are what the live server answers (admin_retention_v2 / admin_players_list_v2 /
// admin_player_data_v2, drafts 20261112190000). The old page showed "아직 기록된 첫 행동이 없습니다" and an empty churn list
// because the app-sent tables are empty until the privacy-gated collection is switched on.
const stub = (fn) => `\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn==="tenkey-admin"){const r=(${fn})(b);if(r!==undefined)return {ok:true,data:r};}return real(pj,fn,b);};})();`;

test("재방문 page: first actions and resting accounts come from the server's own records; steps only the app can report say so", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action==="retention.accounts")return {ok:true,days:30,today:"2026-11-12",rows:[]};
    if(b.action!=="retention.get")return undefined;
    const step=(milestone,players,extra)=>({milestone,players,rate:players==null?null:players/100,drop_from_previous:null,pending:players==null,...extra});
    return {ok:true,days:30,build:null,source:"server",client_on:false,client_rows:0,cohorts:[{first_day:"2026-11-10",build:null,platform:"web_itch",store_country:null,players:100,d1:20,d1_rate:0.2,d3:10,d3_rate:0.1,d7:null,d7_rate:null,d14:0,d14_rate:null,d30:0,d30_rate:null}],
      funnel:[step("game_opened",100),step("name_set",100,{drop_from_previous:0}),step("first_run_started",null),step("first_run_ended",72,{drop_from_previous:28}),step("run_2",40,{drop_from_previous:32}),step("level_5",12),step("first_robot",3),step("ranking_entry",8),step("tab_shop",null)],
      churn_3:[{player_id:"a1111111-1111-4111-8111-111111111111",last_seen_at:"2026-11-05T10:00:00+00:00",last_day:"2026-11-05",current_streak:3,last_screen:null,last_run_level:6,last_run_cause:"battery",runs_7d:4,sessions_7d:3,active_days:3,crashes_30d:null,hitches_30d:null,first_day_minutes:null}],
      churn_7:[],churn_3_total:287,churn_7_total:250};
  }`);
  const errors = await open(page, "#/tenkey-retention", MOCK);
  const funnel = page.locator("#tenkeyRetentionFunnel");
  await expect(funnel).toContainText("서버가 이미 가진 기록");
  await expect(funnel).not.toContainText("아직 기록된 첫 행동이 없습니다");
  await expect(funnel.locator(".tk-funnel-row")).toHaveCount(9);
  await expect(funnel.locator(".tk-funnel-row").nth(3)).toContainText("72명");
  await expect(funnel.locator(".tk-funnel-row").nth(3)).toContainText("첫 판 종료");
  await expect(funnel.locator(".tk-funnel-row").nth(6)).toContainText("첫 로봇 변신");
  await expect(funnel.locator(".tk-funnel-row.is-pending")).toHaveCount(2);
  await expect(funnel.locator(".tk-funnel-row.is-pending").first()).toContainText("앱이 보내야 알 수 있음");
  const churn = page.locator("#tenkeyRetentionChurn");
  await expect(churn.locator("tbody tr")).toHaveCount(1);
  await expect(churn).toContainText("전체 287명");
  await expect(churn).toContainText("앱 수집이 켜진 뒤부터");
  await expect(churn.locator("tbody tr")).toContainText("Lv 6");
  await expect(page.locator("#tenkeyRetentionCohorts")).toContainText("미기록");
  await page.locator('[data-retention-churn-days="7"]').click();
  await expect(churn).toContainText("7일 넘은 계정이 없습니다");
  await shot(page, "retention_audit");
  expect(errors).toEqual([]);
});

test("플레이어 page: platform says where it was read from, 모름 only when unknown, and the age band has three plain states", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action!=="players.list")return undefined;
    const row=(id,name,platform,platform_source,age_state,age_band,provider="supabase")=>({id,name,nickname:name,provider,platform,platform_source,age_state,age_band,created_at:"2026-11-01T09:00:00+00:00",last_seen_at:"2026-11-11T09:00:00+00:00",best_score:100,best_level:6,banned:false,runs_stored:1,store_country:"",god_mode:false});
    return {ok:true,total:5,rows:[
      row("a1111111-1111-4111-8111-111111111111","앱18","android","run","given",18),
      row("b2222222-2222-4222-8222-222222222222","앱미등록","ios","login","unregistered",null),
      row("c3333333-3333-4333-8333-333333333333","웹손님","web_itch","run","not_asked",null),
      row("d4444444-4444-4444-8444-444444444444","포털","web_crazygames","login","not_asked",null,"crazygames"),
      row("e5555555-5555-4555-8555-555555555555","모름씨","unknown","none","unknown",null)]};
  }`);
  const errors = await open(page, "#/tenkey-players", MOCK);
  const rows = page.locator("#tenkeyPlayersTable tr");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).locator('td[data-label="플랫폼"]')).toContainText("Android");
  await expect(rows.nth(0).locator('td[data-label="플랫폼"]')).toContainText("판 기록 기준");
  await expect(rows.nth(0).locator('td[data-label="나이대"]')).toHaveText("18세 이상");
  await expect(rows.nth(1).locator('td[data-label="나이대"]')).toContainText("미등록");
  await expect(rows.nth(1).locator('td[data-label="나이대"]')).toContainText("앱이 상점에서 묻는데 답이 없음");
  await expect(rows.nth(2).locator('td[data-label="플랫폼"]')).toContainText("웹 · itch.io");
  await expect(rows.nth(2).locator('td[data-label="나이대"]')).toContainText("수집 안 함");
  await expect(rows.nth(3).locator('td[data-label="나이대"]')).toContainText("웹은 나이를 묻지 않음");
  await expect(rows.nth(4).locator('td[data-label="플랫폼"]')).toContainText("모름");
  await expect(rows.nth(4).locator('td[data-label="플랫폼"]')).toContainText("판·로그인 기록이 없어 알 수 없음");
  await expect(rows.nth(4).locator('td[data-label="나이대"]')).toContainText("플랫폼을 몰라 구분 못 함");
  await expect(page.locator("#tenkeyPlayerPlatform option[value=unknown]")).toHaveText("모름");
  await shot(page, "players_platform_age");
  expect(errors).toEqual([]);
});

test("플레이어 상세: first actions from the server list, platform with its source, age state", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action!=="players.facts")return undefined;
    return {ok:true,platform:{value:"web_itch",source:"run"},age_state:"not_asked",client_info:null,balance_runs:[],
      retention:{source:"server",first_day:"2026-11-01",last_seen_at:"2026-11-10T08:00:00+00:00",current_streak:2,active_days:3,
        milestones:[{id:"game_opened",reached_at:"2026-11-01T09:00:00+00:00"},{id:"first_run_ended",reached_at:"2026-11-01T09:20:00+00:00"},{id:"level_5",reached_at:"2026-11-02T09:20:00+00:00"}]}};
  }`);
  const errors = await open(page, "#/tenkey-players/a1111111-1111-4111-8111-111111111111", MOCK);
  const detail = page.locator("#tenkeyPlayerDetail");
  await expect(detail).toContainText("서버가 가진 기록");
  await expect(detail).toContainText("Lv 5 도달");
  await expect(detail).toContainText("첫 판 종료");
  await expect(detail).not.toContainText("아직 기록된 첫 행동이 없습니다");
  await expect(detail).toContainText("접속한 날 수");
  await expect(detail).toContainText("웹 · itch.io (판 기록 기준)");
  await expect(detail).toContainText("수집 안 함 · 웹은 나이를 묻지 않음");
  expect(errors).toEqual([]);
});
