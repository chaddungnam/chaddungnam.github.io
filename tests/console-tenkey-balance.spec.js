const { test, expect } = require("@playwright/test");
// The shared stand-in API (balance: tests/fixtures/tenkey/balance.js), auth stub, open(), shot() and calls().
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console 밸런스 page: the run records (run_stats) and run timelines (run_trace) the apps and the itch demo send, read through
// tenkey-console-stats "balance.v4" (owner 2026-11-17: "클라이언트에 밸런스 기록, 어느 숫자를 바꿔야 하는지 보이게") with the older
// tenkey-admin "balance.get" as the fallback. TENKEY_SHOTS=<dir> writes captures of the panels.
test.describe.configure({ retries: 2 });

test("밸런스 page: where and why runs end, evolution, cards and mobs in the game's words; filters go to the server; an empty week says why", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  await expect(page.locator("#pageTitle")).toHaveText("밸런스");
  await expect(page.locator("#tenkeyBalancePlatform")).toHaveValue("app");
  await expect.poll(async () => (await calls(page, "balance.v4")).at(0)?.params).toEqual({ days: 7, platform: "app" });
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
  await expect.poll(async () => (await calls(page, "balance.v4")).at(-1).params).toEqual({ days: 30, build: 5, mode: "classic", platform: "app" });  // 기기 starts on 앱 (TK-482)
  expect(await calls(page, "balance.get")).toEqual([]);  // v4 echoed the build and mode, so the older read is never asked
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
  // 앱 (the default): the web demo's runs are counted apart, in one line under the device table.
  await expect(page.locator("#tenkeyBalanceWebApart")).toContainText("웹 체험판 70판은 따로 셉니다");
  await page.locator("#tenkeyBalancePlatform").selectOption("web");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.v4")).at(-1).params).toEqual({ days: 7, platform: "web" });
  await expect(page.locator("#tenkeyBalanceWebApart")).toHaveText("");
  await page.locator("#tenkeyBalancePlatform").selectOption("");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.v4")).at(-1).params).toEqual({ days: 7 });  // 전체 = no device filter in the call
  await page.locator("#tenkeyBalancePlatform").selectOption("app");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.v4")).at(-1).params).toEqual({ days: 7, platform: "app" });
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
  await expect(page.locator("#tenkeyBalanceReachRows .tk-look")).toHaveCount(0);
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
  await expect(page.locator("#tenkeyBalanceLostDur")).toContainText("키보드 / 스페이스바 내려치기");
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
  const errors = await open(page, "#/tenkey-balance", "window.__mockBalanceV1 = true; window.__mockNoV4 = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  await expect(page.locator("#tenkeyBalanceWhere")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceHard")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceTrace")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceReach")).toBeHidden();
  for (const id of ["Acct", "Bands", "OffersPanel", "CountersPanel"]) await expect(page.locator(`#tenkeyBalance${id}`)).toBeHidden();
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

// Owner 11-25: "콘솔에도 반영수치 보여줄 수 있도록". The dials come from the server table (config.get "balance_bounds"), grouped,
// each with the value the apps get now; the old page fails here (its own hard-coded list, no "적용 중").
test("밸런스 page: the detailed dials come from the server table, show the applied value, range and builds; a save lists only what changes", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  const panel = page.locator("#tenkeyTunePanel");
  await expect(panel.locator("summary")).toContainText("8개 · 서버 값 0개");
  await panel.locator("summary").click();
  await expect(panel).toContainText("1.0.0(빌드 22·23)은 위 전역 배율 4개만");
  for (const g of ["DRIFT", "로봇", "압박", "기판", "오버클럭", "강화 비용", "보상"]) await expect(panel.locator("h3.tk-tune-group", { hasText: g })).toHaveCount(1);
  await expect(panel.locator("h3.tk-tune-group", { hasText: "강화 비용" })).toContainText("하드모드 포함");
  // gemecon1125's quest rewards (lead 11-25 follow-up 1e): paid by the server; the run-gem dials of its next round have a slot.
  await expect(panel.locator("h3.tk-tune-group", { hasText: "보상" })).toContainText("퀘스트 보상 = 서버 지급액");
  await expect(panel.locator('[data-tune-applied="q_w_bonus"]')).toContainText("적용 중 기본값 100 · 범위 30~150 (정수)");
  await expect(panel.locator('[data-tune-slot="보상"]')).toContainText("판당 젬 상한 · 하드 해금 뒤 판당 젬 상한 · 최고 기록 젬 · 하루 판 젬 상한 · 일일 무료 젬");
  await expect(panel.locator("[data-tune-slot]")).toHaveCount(1);
  await expect(panel.locator("h3.tk-tune-group", { hasText: "기판" })).toContainText("노멀 판만 · 판 시작 때 고정");
  await expect(panel.locator('[data-tune-applied="numlock_gap"]')).toContainText("적용 중 기본값 8 · 범위 6~16 (정수)");
  await expect(panel.locator('[data-tune-applied="upg_cost_x"]')).toContainText("범위 0.5~2 (0.01 단위)");
  await expect(panel.locator('[data-tune-applied="drift_power_x"]')).toContainText("적용 중 기본값 1.2 · 범위 1.1~1.35");
  await expect(panel.locator('[data-tune-applied="robot_bite_deep"]')).toContainText("범위 0~2 (정수)");
  const form = page.locator("#tenkeyKnobForm");
  await form.locator('[name="tune_drift_power_x"]').fill("1.3");
  await form.locator('[name="tune_ovc_band_1"]').fill("0.9");
  await form.locator('[name="reason"]').fill("drift too slow");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("드리프트 직진 힘 기본값 1.2 → 1.3");
  await expect(page.locator("#confirmDialog")).toContainText("오버클럭 빈도 배율 Lv 2-6 기본값 0.8 → 0.9");
  await expect(page.locator("#confirmDialog")).not.toContainText("Lv 30 내구도 소모 배율");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyKnobMessage")).toContainText("조정값 1번으로 저장했습니다");
  expect((await calls(page, "knobs.set")).at(-1).params.knobs.tune).toEqual({ drift_power_x: 1.3, ovc_band_1: 0.9 });
  await expect(panel.locator("summary")).toContainText("서버 값 2개");
  await expect(panel.locator('[data-tune-applied="drift_power_x"]')).toContainText("적용 중 1.3 (서버 값) · 기본값 1.2");
  await expect(panel.locator('[data-tune-applied="wear"]')).toContainText("적용 중 기본값 1.8");
  await shot(page, "balance_dials", "#tenkeyKnobForm");
  await form.locator('[name="tune_robot_bite_deep"]').fill("1.5");
  await form.locator('[name="reason"]').fill("bite");
  await form.locator("button[type=submit]").click();
  await expect(form.locator('[name="tune_robot_bite_deep"]:invalid')).toHaveCount(1);  // the table's step 1 / range: the browser refuses
  await expect(page.locator("#confirmDialog")).toBeHidden();
  expect((await calls(page, "knobs.set")).length).toBe(1);
  expect(errors).toEqual([]);
});

test("밸런스 page: a server without the dial table hides the dials and a save sends the four values only", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockNoBounds=true;");
  await expect(page.locator("#tenkeyTunePanel summary")).toContainText("서버 표 없음");
  const form = page.locator("#tenkeyKnobForm");
  await expect(form.locator('[name^="tune_"]')).toHaveCount(0);
  await form.locator('[name="xp_scale"]').fill("1.1");
  await form.locator('[name="reason"]').fill("older server");
  await form.locator("button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyKnobMessage")).toContainText("조정값 1번으로 저장했습니다");
  expect((await calls(page, "knobs.set")).at(-1).params.knobs).toEqual({ xp_scale: 1.1, mouse_pace: 1, battery_drain_scale: 1, robot_power_scale: 1 });
  expect(errors).toEqual([]);
});

test("밸런스 page (v4): account growth, level bands, offered vs picked cards, idle time and the run counters; \"여기 보기\" only where the reading guide says", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  const acct = page.locator("#tenkeyBalanceAcctRows tr");
  await expect(acct).toHaveCount(4);
  await expect(acct.nth(0)).toContainText("모름 (강화 정도를 보내기 전 빌드)");
  await expect(acct.nth(1)).toContainText("강화 안 한 계정 (강화 합 0)");
  await expect(acct.nth(3)).toContainText("모두 강화한 계정 (강화 합 160)");
  await expect(acct.nth(2).locator('td[data-label="평균 끝 레벨"]')).toHaveText("Lv 19");
  await expect(page.locator("#tenkeyBalanceAcct")).not.toContainText("undefined");
  await expect(page.locator("#tenkeyBalanceBandRows tr")).toHaveCount(5);
  await expect(page.locator("#tenkeyBalanceBandRows tr").last()).toContainText("Lv 30 이상");
  await expect(page.locator("#tenkeyBalanceBandRows tr").first().locator('td[data-label="받은 피해 (판당)"]')).toHaveText("31%");
  await expect(page.locator("#tenkeyBalanceBandRows tr").first()).toContainText("Lv 1–6");
  await expect(page.locator("#tenkeyBalanceBandRows tr").first().locator('td[data-label="머문 시간 (평균)"]')).toHaveText("1분 35초");
  const offer = (card) => page.locator("#tenkeyBalanceOffers tr", { hasText: card });
  await expect(page.locator("#tenkeyBalanceOffers tr").first()).toContainText("레이저");  // most offered first
  await expect(offer("절전").locator(".tk-look")).toHaveCount(1);  // 9 of 120 offers picked
  await expect(offer("폭탄").locator(".tk-look")).toHaveCount(0);  // 6 offers are too few to judge
  await expect(offer("레이저").locator(".tk-look")).toHaveCount(0);
  await expect(page.locator("#tenkeyBalanceIdle")).toContainText("12.5%");
  await expect(page.locator("#tenkeyBalanceIdle")).toContainText("14초");
  await expect(page.locator("#tenkeyBalanceIdle .tk-look")).toHaveCount(1);  // idle share over 10 %; 9 of 60 long idle runs is not over a quarter
  await expect(page.locator("#tenkeyBalanceCounters")).toContainText("부순 키");
  await expect(page.locator("#tenkeyBalanceCounters tr", { hasText: "부순 키" }).locator('td[data-label="판당"]')).toHaveText("150");
  await expect(page.locator("#tenkeyBalanceCounters")).toContainText("mystery_x");  // a counter the page has no name for shows as the game wrote it
  await expect(page.locator("#tenkeyBalanceFresh")).toContainText("서버에 남아 있는 줄 (기간·조건과 상관없이 모두): 판 기록 240, 판 흐름 기록 60");
  await expect(page.locator("#tenkeyBalanceFresh")).not.toContainText("—");
  await shot(page, "balance_v4", "#tenkeyBalanceBody");
  await page.evaluate(() => { window.__mockNoAcct = true; });
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceAcctRows")).toContainText("앱 다음 빌드부터");
  expect(errors).toEqual([]);
});

test("밸런스 page (v4): level times from the run timeline mark the one level that holds players more than twice as long as its neighbours", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockV4Reach = true;");
  await expect(page.locator("#tenkeyBalanceReachNote")).toContainText("판 흐름 기록의 레벨업 시각 기준");
  const rows = page.locator("#tenkeyBalanceReachRows tr");
  await expect(rows).toHaveCount(5);  // Lv 1-3, every fifth level, and the slow one (Lv 5 is both)
  const lv5 = page.locator("#tenkeyBalanceReachRows tr", { hasText: "Lv 5" });
  await expect(lv5.locator('td[data-label="다음 레벨까지"]')).toContainText("5분");
  await expect(lv5.locator(".tk-look")).toHaveCount(1);
  await expect(page.locator("#tenkeyBalanceReachRows .tk-look")).toHaveCount(1);
  await shot(page, "balance_reach", "#tenkeyBalanceReach");
  expect(errors).toEqual([]);
});

test("밸런스 page: a stats function without balance.v4 falls back to balance.get with the same filter and says the new tables are missing", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockNoV4 = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1)?.params).toEqual({ days: 7, platform: "app" });
  await expect(page.locator("#tenkeyBalanceFresh")).toContainText("서버가 아직 이전 버전이라");
  for (const id of ["Acct", "Bands", "OffersPanel", "CountersPanel"]) await expect(page.locator(`#tenkeyBalance${id}`)).toBeHidden();
  await expect(page.locator("#tenkeyBalanceWhere")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceTrace")).toBeVisible();
  expect(errors).toEqual([]);
});

test("밸런스 page: when v4 does not echo a build / mode filter, balance.get answers the filtered numbers and the page says the new tables are not filtered", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockV4NoEcho = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  expect(await calls(page, "balance.get")).toEqual([]);  // no build / mode asked yet: v4 alone
  await page.locator("#tenkeyBalanceBuild").selectOption("5");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.get")).at(-1)?.params).toEqual({ days: 7, build: 5, platform: "app" });
  await expect(page.locator("#tenkeyBalanceFresh")).toContainText("아직 빌드·모드를 가리지 않은 값");
  await expect(page.locator("#tenkeyBalanceAcct")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceBuild")).toHaveValue("5");
  expect(errors).toEqual([]);
});

test("밸런스 page: every panel says what it is built from and how long the server keeps it, from the server's own keep list", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  const lines = page.locator("#tenkeyBalanceView .tk-keep-line:has([data-tk-keep])");
  await expect(page.locator("#tenkeyBalanceWhere > .tk-keep-line")).toContainText("모으는 것: 판 기록");
  await expect(page.locator("#tenkeyBalanceWhere > .tk-keep-line")).toContainText("서버 보관 60일");
  await expect(page.locator('#tenkeyBalanceView .impact-note [data-tk-keep="run_trace"]')).toHaveText("60일");
  expect(await lines.count()).toBeGreaterThanOrEqual(10);
  for (let i = 0; i < await lines.count(); i += 1) await expect(lines.nth(i)).toContainText(/서버 보관 \d+일/);
  expect((await calls(page, "keep.get")).length).toBe(1);  // one read fills every line
  expect(errors).toEqual([]);
});

test("밸런스 page: when the keep list cannot be read, each line says \"—\" with a link to the 데이터 보관 page, and the page still renders", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockKeepFail = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  const keep = page.locator("#tenkeyBalanceWhere > .tk-keep-line [data-tk-keep]");
  await expect(keep).toHaveText("—(데이터 보관 화면)");
  await keep.locator("a").click();
  await expect(page.locator("#pageTitle")).toHaveText("데이터 보관");
  expect(errors).toEqual([]);
});

test("밸런스 page: 무적 테스트 판 lists the god accounts' runs apart, by test setup, with where a mortal run would have died (owner 11-19)", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance");
  const god = page.locator("#tenkeyBalanceGod");
  await expect(god).toBeVisible();
  await expect.poll(async () => (await calls(page, "balance.god")).at(0)?.params).toEqual({ days: 7 });
  await expect(page.locator("#tenkeyBalanceGodPresets tr")).toHaveCount(2);
  const p70 = page.locator("#tenkeyBalanceGodPresets tr", { hasText: "강화 70% · 모듈 50%" });
  await expect(p70.locator('td[data-label="죽었을 판"]')).toHaveText("2 · 100%");
  await expect(p70.locator('td[data-label="죽었을 레벨 (가운데)"]')).toHaveText("Lv 9");
  await expect(page.locator("#tenkeyBalanceGodPresets")).toContainText("내 저장 그대로");
  const rows = page.locator("#tenkeyBalanceGodRows tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first().locator('td[data-label="죽었을 곳"]')).toHaveText("Lv 9 · 3분 21초 · 마우스 포획 · DRIFT");
  await expect(rows.first().locator('td[data-label="두 번째로 죽었을 곳"]')).toHaveText("Lv 12 · 5분 30초 · 텐키 파손 · 로봇");
  await expect(rows.first().locator('td[data-label="로봇 에너지가 다 떨어진 곳"]')).toHaveText("Lv 13 · 6분 40초");
  await expect(rows.nth(2).locator('td[data-label="죽었을 곳"]')).toHaveText("안 죽음");
  await expect(rows.nth(2)).toContainText("Lv 21 · 완주");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");  // the players' numbers are untouched
  await shot(page, "balance_god", "#tenkeyBalanceGod");
  await page.locator("#tenkeyBalanceDays").selectOption("30");
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "balance.god")).at(-1)?.params).toEqual({ days: 30 });
  await page.evaluate(() => { window.__mockGodEmpty = true; });
  await page.locator("#tenkeyBalanceForm button[type=submit]").click();
  await expect(page.locator("#tenkeyBalanceGodEmpty")).toBeVisible();
  await expect(page.locator("#tenkeyBalanceGodBody")).toBeHidden();
  expect(errors).toEqual([]);
});

test("밸런스 page: a server without balance.god keeps the 무적 테스트 판 section hidden and the page renders", async ({ page }) => {
  const errors = await open(page, "#/tenkey-balance", "window.__mockNoGod = true;");
  await expect(page.locator("#tenkeyBalanceSummary [data-tk-summary=\"runs\"]")).toHaveText("240");
  await expect.poll(async () => (await calls(page, "balance.god")).length).toBe(1);
  await expect(page.locator("#tenkeyBalanceGod")).toBeHidden();
  await expect(page.locator("#tenkeyBalanceGodMessage")).toHaveText("");
  expect(errors).toEqual([]);
});
