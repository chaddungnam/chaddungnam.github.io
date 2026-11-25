const { test, expect } = require("@playwright/test");
// The stand-in API (core + one module per page, tests/fixtures/tenkey/), the signed-in auth stub, open(), shot() and calls().
const { API, AUTH, open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key Survival pages of the console, walked through with the synthetic stand-in API. The 밸런스, 이슈함, 데이터 보관 and 성능 pages
// have their own specs (console-tenkey-<page>.spec.js). TENKEY_SHOTS=<dir> also writes a full-page capture of each page there.
// The dev static server (python http.server) sometimes resets one of the ~30 script requests of a cold page load, which only
// shows as a missing project picker; a retry is the fix for that test-infrastructure flake, not for the console.
test.describe.configure({ retries: 2 });

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

test("the project picker has no Comrade card; 10key Survival opens on the overview with its eighteen pages", async ({ page }) => {
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
  await expect(page.locator("#tenkeyNav a")).toHaveCount(18);  // + 경제 흐름 (2026-11-25)
  await expect(page.locator("#hexaworldNav")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// The route pattern is built from model.js's page list (11-17): a page missing from it used to fall back to the overview when the
// project was picked with its link open (감시 did, until this test).
test("every 10KEY page opens straight from its link when the project is picked, the new 감시 / 이슈함 / 데이터 보관 / 성능 included", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: AUTH }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: API }));
  for (const [hash, title] of [["#/tenkey-watch", "감시"], ["#/tenkey-issues", "이슈함"], ["#/tenkey-keep", "데이터 보관"], ["#/tenkey-perf", "성능"]]) {
    await page.goto("about:blank");  // a hash-only goto would stay in the same document, past the project picker
    await page.goto(`/console/${hash}`);
    await page.locator("#projectTenkey").click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.locator("#pageTitle")).toHaveText(title);
    await expect(page.locator(`#tenkeyNav a[data-page="${hash.slice(2)}"]`)).toHaveAttribute("aria-current", "page");
  }
  expect(errors).toEqual([]);
});

test("overview (owner 2026-11-24 evening): no web filter and no web DAU; the web card shows today's signed-in players per portal (itch.io, Nekoland, GamePix)", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#tenkeyGlanceToday .tk-glance-card")).toHaveCount(4);
  await expect(page.locator('[data-tk-platform="web_itch"]')).toHaveCount(0);
  await expect(page.locator("[data-tk-platform]")).toHaveCount(3);
  const web = page.locator("#tenkeyOverviewCharts .tk-web-card");
  await expect(web.locator("h3")).toHaveText("웹 · 오늘 들어온 사람");
  await expect(web.locator(".tk-web-tile dt")).toHaveText(["itch.io", "Nekoland", "GamePix"]);
  const want = await page.evaluate(() => window.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "dau.get", params: { days: 90 } }).then((r) => r.data.days.slice(-2)));
  await expect(web.locator(".tk-web-tile").nth(0).locator("strong")).toHaveText(String(want[1].web_itch));
  await expect(web.locator(".tk-web-tile").nth(0)).toContainText(`페이지 열림 ${want[1].visits_itch}회 · 어제 ${want[0].web_itch}명`);
  await expect(web.locator(".tk-web-tile").nth(2)).not.toContainText("페이지 열림");  // GamePix sends no ping
  await expect(web).not.toContainText("%");
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
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(6);  // the app list: the CrazyGames player is on the web list (11-24)
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

test("players: rank guard marks + 랭킹 허용 releases the hold (owner 11-22)", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  const row = page.locator("#tenkeyPlayersTable tr", { hasText: "KeyMaster" });
  await expect(row).toContainText("젬 이상");
  await expect(row).toContainText("매크로 의심");
  await expect(page.locator("#tenkeyPlayersTable tr", { hasText: "매크로 의심" })).toHaveCount(1);
  await row.locator("a.player-identity-link").click();
  const guard = page.locator("#tenkeyPassForm");
  await expect(guard).toContainText("젬 이상 기록 때문에 랭킹에 오르지 않습니다");
  await expect(guard).toContainText("한 번에 젬 500개");
  await expect(guard).toContainText("간격이 똑같은 비율 91%");
  await shot(page, "player_rank_hold", "#tenkeyPassForm");
  await guard.locator("[name=reason]").fill("젬 기록 확인, 정상");
  await guard.locator("button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyPassForm")).toContainText("지금 걸린 랭킹 보류는 없습니다");
  await expect(page.locator("#tenkeyPassForm button")).toHaveCount(0);
  await expect(page.locator("#tenkeyPassForm")).toContainText("풀어 줌");
  expect((await calls(page, "players.ban"))[0].params).toMatchObject({ banned: false, reason: "젬 기록 확인, 정상" });
  expect(errors).toEqual([]);
});

test("players: search, open one, ban with a reason through the confirm dialog", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  await expect(page.locator("#tenkeyPlayersTable tr")).toHaveCount(6);
  await expect(page.locator("#tenkeyPlayerTotal")).toHaveText("6명");
  const platforms = await page.locator('#tenkeyPlayersTable td[data-label="플랫폼"]').allTextContents();
  expect(platforms).toEqual(["Android", "iOS", "Android", "모름", "Windows", "Mac"]);  // the web demo players have their own list (11-24)
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

test("crashes page (owner 2026-11-24, client work): build health per app build, newest marked, problems per 100 devices", async ({ page }) => {
  const errors = await open(page, "#/tenkey-crashes");
  const rows = page.locator("#tenkeyBuildHealthTable tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Android 빌드 23");
  await expect(rows.nth(0)).toContainText("최신");
  await expect(rows.nth(0).locator('td[data-label="100대당 문제"]')).toHaveText("0");
  await expect(rows.nth(1).locator('td[data-label="100대당 문제"] .tk-badge')).toHaveAttribute("data-tone", "risk");
  await expect(rows.nth(1).locator('td[data-label="100대당 문제"]')).toHaveText("66.7");
  await expect(rows.nth(1)).not.toContainText("최신");
  await expect(page.locator("#tenkeyBuildHealthTotal")).toHaveText("3개 빌드");
  expect(errors).toEqual([]);
});

test("overview (owner 2026-11-24): store ratings and reviews, the unanswered one links to the store to answer", async ({ page }) => {
  const errors = await open(page);
  const card = page.locator("#tenkeyOverviewCharts .tk-reviews-card");
  await expect(card.locator("h3")).toHaveText("스토어 평점 · 리뷰");
  await expect(card).toContainText("4.38 · 16개 (어제보다 +2)");
  await expect(card).toContainText("대한민국 4.5 (12)");
  const countries = card.locator(".tk-country-table tbody tr");
  await expect(countries.first()).toContainText("대한민국");
  await expect(countries.first().locator('td[data-label="App Store 평점"]')).toContainText("★ 4.50");
  await expect(countries.first().locator('td[data-label="App Store 평점"]')).toContainText("+2");
  await expect(card.locator(".tk-country-table")).toContainText("한국어 (언어)");
  await expect(card.locator(".tk-review")).toHaveCount(2);
  await expect(card.locator(".tk-review").first()).toContainText("튜토리얼이 너무 빨라요");
  await expect(card.locator(".tk-review").first().locator("a.tk-badge")).toHaveAttribute("href", /appstoreconnect\.apple\.com/);
  await expect(card.locator(".tk-review").nth(1)).toContainText("답함");
  await expect(card).toContainText("답 안 한 리뷰");
  expect(errors).toEqual([]);
});

test("구매·젬 (owner 2026-11-24 night): country store, amount, expected net per purchase; totals by day / week / month", async ({ page }) => {
  const errors = await open(page, "#/tenkey-purchases");
  const first = page.locator("#tenkeyPurchasesTable tr").first();
  await expect(first.locator('td[data-label="스토어 · 나라"]')).toContainText("대한민국");
  await expect(first.locator('td[data-label="결제 금액"]')).toContainText("4,400 KRW");
  await expect(first.locator('td[data-label="예상 순수익"]')).toContainText("€2.31");
  await expect(first.locator('td[data-label="예상 순수익"]')).toContainText("스토어 값");
  await expect(page.locator("#tenkeyPurchasesTable tr").nth(1).locator('td[data-label="예상 순수익"]')).toContainText("예상 (부가세 10%, 수수료 15%)");
  await expect(page.locator("#tenkeyMoneyTable tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyMoneyTable tr").first().locator('td[data-label="순수익 합계"]')).toHaveText("€10.91");
  await expect(page.locator("#tenkeyMoneyFacts")).toContainText("오늘 순수익");
  await page.locator('[data-tk-money-unit="week"]').click();
  await expect.poll(async () => (await calls(page, "money.get")).at(-1)?.params.unit).toBe("week");
  await expect(page.locator("#tenkeyMoneyFacts")).toContainText("이번 주 순수익");
  await expect(page.locator("#tenkeyMoneyFacts")).toContainText("지난주 순수익");
  expect(errors).toEqual([]);
});

test("경제 흐름 (owner 2026-11-24 night): gems / scrap / parts in and out per day and reason, balances", async ({ page }) => {
  const errors = await open(page, "#/tenkey-economy");
  await expect(page.locator("#pageTitle")).toHaveText("경제 흐름");
  await expect(page.locator("#tenkeyEconSummary article").first()).toContainText("800");
  await expect(page.locator("#tenkeyEconSummary")).toContainText("+400");
  await expect(page.locator("#tenkeyEconSummary")).toContainText("스크랩 순증");
  await expect(page.locator("#tenkeyEconChart .tk-econ-col")).toHaveCount(2);
  await expect(page.locator("#tenkeyEconReasons")).toContainText("스토어 구매");
  await expect(page.locator("#tenkeyEconReasons")).toContainText("부활");
  await expect(page.locator("#tenkeyEconBalances")).toContainText("평균 140");
  await page.locator('[data-tk-econ-days="30"]').click();
  await expect.poll(async () => (await calls(page, "economy.get")).at(-1)?.params.days).toBe(30);
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

test("a server error is shown in Korean without breaking the page", async ({ page }) => {
  await open(page, "#/tenkey-crashes");
  await page.evaluate(() => { window.__mockFailures["crashes.groups"] = "rpc_failed"; });
  await page.locator("#tenkeyCrashFilterForm button[type=submit]").click();
  await expect(page.locator("#tenkeyCrashMessage")).toContainText("서버가 요청을 거부했습니다");
});


test("overview (owner 2026-11-24 launch): the default view counts DAU on the mobile app (Android + iOS), shows itch only as a reference chart and no pre-registration", async ({ page }) => {
  const errors = await open(page);
  const today = page.locator("#tenkeyGlanceToday .tk-glance-card");
  const week = page.locator("#tenkeyGlanceWeek .tk-glance-card");
  await expect(page.locator('[data-tk-platform=""]')).toHaveText("모바일");
  await expect(today).toHaveCount(4);
  await expect(week).toHaveCount(4);
  await expect(today.nth(0).locator(".tk-glance-label")).toHaveText("모바일 DAU");
  await expect(today.nth(1).locator(".tk-glance-label")).toHaveText("새로 설치 (앱)");
  await expect(today.nth(2).locator(".tk-glance-label")).toHaveText("플레이 (앱)");
  const want = await page.evaluate(async () => {
    const all = (await window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "overview.get", params: {} })).data;
    const web = (await window.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "overview.web", params: { days: 90 } })).data;
    const dau = (await window.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "dau.get", params: { days: 90 } })).data;
    const a = all.series.at(-1), w = web.series.find((r) => r.day === a.day) || {};
    return { days: dau.days.slice(-7), installs: Math.max(0, a.new_installs - (w.new_installs || 0)), runs: Math.max(0, a.runs - (w.runs || 0)) };
  });
  const last = want.days.at(-1);
  await expect(today.nth(0).locator(".tk-glance-value")).toHaveText(`${last.mobile}명`);
  await expect(today.nth(0)).toContainText(`출시 후 ${last.mobile_launch} · 테스터 ${last.mobile_tester}`);
  await expect(today.nth(1).locator(".tk-glance-value")).toHaveText(`${want.installs}명`);
  await expect(today.nth(2).locator(".tk-glance-value")).toHaveText(`${want.runs}판`);
  // 최근 7일 DAU (owner 11-24 afternoon): store players only. Before the launch day "출시 전" with the testers; from it, the
  // launch cohort that played over the launch cohort so far (testers never in the base).
  await expect(page.locator("#tenkeyDauTitle")).toHaveText("최근 7일 DAU");
  await expect(page.locator("#tenkeyDauTitle + small")).toContainText("테스터 계정은 빼고");
  const cells = await page.locator("#tenkeyDauWeek .tk-dau-day").evaluateAll((els) => els.map((c) => `${c.querySelector("strong").textContent}|${c.querySelector("span").textContent}`));
  expect(cells).toEqual(want.days.map((d) => (d.players_launch > 0
    ? `${Math.round(d.mobile_launch / d.players_launch * 100)}%|${d.mobile_launch} / ${d.players_launch}명`
    : `출시 전|테스터 ${d.mobile_tester}명`)));
  expect(cells.filter((c) => c.startsWith("출시 전")).length).toBe(4);
  // charts: mobile (DAU + app installs), Android · iOS, itch reference; nothing about pre-registration on the page
  await expect(page.locator("#tenkeyOverviewCharts > .ov-card")).toHaveCount(5);  // + 스토어 평점 · 리뷰
  // 앱 판매 (스토어 보고서): a paid download is a sale the game server never sees; each store says if it is connected
  const store = page.locator("#tenkeyOverviewCharts .tk-store-card");
  await expect(store.locator("h3")).toContainText("앱 판매 (스토어 보고서 + 예상");
  // owner 2026-11-25: 확정 = the store reports only; 예상 = settled days' sales + new nicknames on the days not settled yet.
  // Play: settled 5..3 days back (2 sold), 2 days back pending (3 sold so far, 4 new Android) -> 4, yesterday 1 new -> 1: 7
  const g = store.locator('[data-store="google"]');
  await expect(g.locator(".tk-store-est")).toHaveText("7건");
  await expect(g).toContainText("확정 5건 · ");
  await expect(g).toContainText("까지 보고서");
  await expect(g).toContainText("보고서 대기 · 그동안 새 Android 유저 5명");
  await expect(g).toContainText("출시 후 새 Android 유저 7명 (닉네임 기준)");
  // App Store: no key, nothing settled: the estimate is the new iOS nicknames (1 + 2 + 3)
  const a = store.locator('[data-store="apple"]');
  await expect(a.locator(".tk-store-est")).toHaveText("6건");
  await expect(a).toContainText("App Store Connect API 키");
  await expect(store.locator('[data-store="all"] .tk-store-est')).toHaveText("13건");
  await expect(store.locator('[data-store="all"]')).toContainText("확정 5건 · 새 유저 13명");
  await expect(store).toContainText("예상 (보고서 대기)");
  await expect(store.locator(".ov-col")).toHaveCount(7);
  await expect(week.nth(2).locator(".tk-glance-label")).toHaveText("인앱 결제");
  await expect(today.nth(1)).toContainText("판매 수 아님");
  await expect(page.locator("#tenkeyOverviewCharts")).toContainText("모바일 DAU Android · iOS");
  await expect(page.locator("#tenkeyOverviewCharts .tk-web-card")).toContainText("참고용");
  await expect(page.locator("#tenkeyOverviewCharts .ov-line")).toHaveCount(2);
  await expect(page.locator("#tenkeyOverview")).not.toContainText("사전예약");
  expect((await calls(page, "prereg.get")).length).toBe(0);
  // 1일 / 3일 / 7일: unique mobile accounts in exactly that window against the N days before; next-day return on mobile accounts.
  await expect(page.locator('[data-tk-compare="d1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 1일");
  await expect(week.nth(0).locator(".tk-glance-label")).toHaveText("모바일 플레이어 (1일)");
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText(`${last.mobile}명`);
  await expect(week.nth(0)).toContainText("앞 1일과 같음");
  await expect(week.nth(3).locator(".tk-glance-value")).toHaveText("50%");
  await expect(week.nth(3)).toContainText("모바일 1/2명");
  await page.locator('[data-tk-compare="d3"]').click();
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 3일");
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText(`${last.u3_mobile}명`);
  await expect(week.nth(0)).toContainText("앞 3일보다 3명 많음");
  await expect(week.nth(3)).toContainText("모바일 3/6명");
  await page.locator('[data-tk-compare="w"]').click();
  await expect(page.locator("#tenkeyGlanceWeekTitle")).toHaveText("최근 7일");
  await expect(week.nth(0).locator(".tk-glance-value")).toHaveText(`${last.u7_mobile}명`);
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

// Owner 2026-11-24: five links in one panel; CONTACT's YouTube row now uses links.set with id=community.
test("제보 page: the common links panel saves a CONTACT Short with a reason and resets it", async ({ page }) => {
  const MOCK = "\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn===\"tenkey-console-stats\"&&b.action===\"reports.list\")return {ok:true,data:{total:0,rows:[]}};return real(pj,fn,b);};})();";
  const errors = await open(page, "#/tenkey-reports", MOCK);
  const form = page.locator("#tenkeyCommunityForm");
  await expect(form).toBeVisible();
  await expect(page.locator("[data-outside-link]")).toHaveCount(5);
  await expect(page.locator("#tenkeyCommunityCurrent")).toHaveText("https://www.youtube.com/@Sergeant_Houseduck");
  await expect(page.locator("#tenkeyCommunityNote")).toContainText("기본값");
  await form.locator("[name=url]").fill("https://evil.example/watch?v=1");
  await form.locator("[name=reason]").fill("test");
  await form.locator('button[value="save"]').click();
  await expect(page.locator("#tenkeyCommunityFormMessage")).toContainText("허용된 https 주소");
  expect(await page.evaluate(() => window.__mockCalls.filter((c) => c.action === "links.set").length)).toBe(0);
  await form.locator("[name=url]").fill("https://www.youtube.com/shorts/abc123");
  await form.locator("[name=reason]").fill("출시 쇼츠");
  await form.locator('button[value="save"]').click();
  await expect(page.locator("#confirmDialog")).toContainText("https://www.youtube.com/shorts/abc123");
  await expect(page.locator("#confirmDialog")).toContainText("출시 쇼츠");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyCommunityCurrent")).toHaveText("https://www.youtube.com/shorts/abc123");
  const saved = await page.evaluate(() => window.__mockCalls.filter((c) => c.action === "links.set"));
  expect(saved.length).toBe(1);
  expect(saved[0].params).toEqual({ id: "community", url: "https://www.youtube.com/shorts/abc123", reason: "출시 쇼츠" });
  expect(saved[0].request_id).toMatch(/^[0-9a-f-]{36}$/);
  await form.locator("[name=url]").fill("");
  await form.locator("[name=reason]").fill("기본으로");
  await form.locator('button[value="reset"]').click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyCommunityNote")).toContainText("기본값");
  await shot(page, "reports_youtube");
  expect(errors).toEqual([]);
});

test("the long 10KEY menu scrolls when the window is short: desktop sidebar up and down, phone bar sideways; log out stays visible", async ({ page }) => {
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
// tenkey-console-stats too: the player list reads from there since 2026-11-24 (players.list, admin_players_list_v3)
const stub = (fn) => `\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn==="tenkey-admin"||(fn==="tenkey-console-stats"&&b&&b.action==="players.list")){const r=(${fn})(b);if(r!==undefined)return {ok:true,data:r};}return real(pj,fn,b);};})();`;

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

test("플레이어 page (owner 2026-11-24): app players first, the web demo players as their own list; both open the same player page", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players");
  const rows = page.locator("#tenkeyPlayersTable tr");
  await expect(page.locator('[data-tk-plist="app"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyPlayerListTitle")).toHaveText("앱 플레이어");
  await expect.poll(async () => (await calls(page, "players.list")).at(-1)?.params.platform).toBe("app");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator('#tenkeyPlayersTable td[data-label="플랫폼"]', { hasText: "웹" })).toHaveCount(0);
  await expect(page.locator("#tenkeyPlayerPlatform option[value=web]")).toHaveCount(0);
  await page.locator('[data-tk-plist="web"]').click();
  await expect.poll(async () => (await calls(page, "players.list")).at(-1)?.params.platform).toBe("web");
  await expect(page.locator("#tenkeyPlayerListTitle")).toHaveText("웹 데모 플레이어");
  await expect(page.locator("#tenkeyPlayerListNote")).toContainText("데모 플레이어");
  await expect(page.locator("#tenkeyPlayerPlatformField")).toBeHidden();
  await expect(rows.first().locator('td[data-label="플랫폼"]')).toContainText("웹");
  await page.locator('[data-tk-plist="app"]').click();
  await expect(page.locator("#tenkeyPlayerPlatformField")).toBeVisible();
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
