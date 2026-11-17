const { test, expect } = require("@playwright/test");
// The shared stand-in API (issues.*: tests/fixtures/tenkey/issues.js), auth stub, open(), shot() and calls().
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console 이슈함 page (owner 2026-11-17: "서버로 이슈를 받되 재현 절차까지 알 수 있게"): crash reports, app issues and 1:1 inquiries,
// each opening one report with the app's own steps before it, the run's seed to rebuild it in QA, the save it had and the same
// device's records around it. Reports from builds before these fields show '—'. TENKEY_SHOTS=<dir> writes captures.
test.describe.configure({ retries: 2 });
const INSTALL = "9f31a0c2-0000-4000-8000-000000000001";  // tests/fixtures/tenkey/issues.js

test("이슈함 크래시: groups narrow the list, one report shows how to rebuild the run, the numbered steps in words, the save, the log and the same device's records", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await expect(page.locator("#pageTitle")).toHaveText("이슈함");
  await expect(page.locator('#tenkeyIssueTabs [data-issue-tab="crash"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyIssueGroups tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyIssueKeepNote")).toContainText("crash_reports에 60일, 로그는 7일 보관");
  expect((await calls(page, "issues.list")).at(-1)).toMatchObject({ fn: "tenkey-console-stats", params: { days: 7, source: "crash", limit: 200 } });
  await page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="unclean_exit|DigScene"]').click();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(1);
  await expect(page.locator("#tenkeyIssueTotal")).toHaveText("1건 (묶음 선택됨)");
  await page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="unclean_exit|DigScene"]').click();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  await shot(page, "issues_crash");

  await page.locator('#tenkeyIssueTable tr[data-tk-issue="41"]').click();
  const detail = page.locator("#tenkeyIssueDetail");
  await expect(detail).toBeVisible();
  expect((await calls(page, "issues.get")).at(-1).params).toEqual({ source: "crash", id: 41 });
  await expect(detail.locator(".tk-repro")).toHaveText("이 판 다시 만들기: seed 918273 (QA_WORLD_SEED)");
  await expect(detail).toContainText("노멀 모드");
  await expect(detail).toContainText("Lv 12");
  const steps = detail.locator(".tk-steps li");
  await expect(steps).toHaveCount(11);
  await expect(detail).toContainText("앱이 남긴 순서 (오래된 것부터 11단계)");
  await expect(steps.nth(0)).toContainText("0초 앱 시작: Android 1.0.3 a41");
  await expect(steps.nth(4)).toContainText("41초 레벨업 카드 고름: 레이저");
  await expect(steps.nth(4).locator("code")).toHaveText("pick laser");  // the code the game wrote stays under the words
  await expect(steps.nth(5)).toContainText("위기 시작: NUM LOCK 철창");
  await expect(steps.nth(6)).toContainText("NUM LOCK 철창에 갇힘");
  await expect(steps.nth(10)).toContainText("앱이 뒤로 감");
  await expect(detail).toContainText("m_xp, m_bat");
  await expect(detail).toContainText("Lv 18");
  await expect(detail).toContainText("9f31a0c2");
  await expect(detail).toContainText("uptime_s");  // a value the page has no place for is still shown
  await expect(detail.locator(".tk-log")).toContainText("signal 11");
  await shot(page, "issues_crash_detail", "#tenkeyIssueDetail");

  await page.locator("#tenkeyIssueTimelineButton").click();
  await expect(page.locator("#tenkeyIssueTimeline li")).toHaveCount(3);
  await expect(page.locator("#tenkeyIssueTimeline")).toContainText("성능 보고");
  await expect(page.locator("#tenkeyIssueTimeline")).toContainText("판 흐름");
  expect((await calls(page, "issues.timeline")).at(-1).params).toEqual({ install: INSTALL, at: "2026-10-23T10:12:00+00:00", minutes: 10 });
  await page.locator("#tenkeyIssueClose").click();
  await expect(detail).toBeHidden();
  expect(errors).toEqual([]);
});

test("이슈함 크래시: a report from an older build reads '—' for the run, the steps, the save and the device records instead of breaking", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await page.locator('#tenkeyIssueTable tr[data-tk-issue="39"]').click();
  const detail = page.locator("#tenkeyIssueDetail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("멈춤 (5초 이상)");
  await expect(detail).toContainText("— (판 밖에서 났거나, 판 번호를 보내지 않은 빌드입니다)");
  await expect(detail).toContainText("— (이 보고를 보낸 빌드는 앱 순서를 보내지 않았습니다)");
  await expect(detail).toContainText("— (이 보고에는 기기 번호가 없어 묶어 볼 수 없습니다)");
  await expect(detail.locator(".tk-repro")).toHaveCount(0);
  await expect(detail.locator("#tenkeyIssueTimelineButton")).toHaveCount(0);
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-issue="39"] td[data-label="판 다시 만들기"]')).toHaveText("—");
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-issue="41"] td[data-label="판 다시 만들기"]')).toHaveText("있음");
  expect(errors).toEqual([]);
});

test("이슈함 앱 이상: hitches, stalls and script errors grouped by place; a web demo hitch rebuilds its run; the period goes to the server", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await page.locator('#tenkeyIssueTabs [data-issue-tab="app"]').click();
  await expect(page.locator('#tenkeyIssueTabs [data-issue-tab="app"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyIssueListTitle")).toHaveText("앱 이상 목록");
  await expect.poll(async () => (await calls(page, "issues.list")).at(-1).params).toEqual({ days: 7, source: "app", limit: 200 });
  await expect(page.locator("#tenkeyIssueGroups tr")).toHaveCount(3);
  await expect(page.locator("#tenkeyIssueGroups tr", { hasText: "level_up_cards" })).toContainText("버벅임");
  await expect(page.locator("#tenkeyIssueKeepNote")).toContainText("app_issues에 60일 보관");
  await page.locator('#tenkeyIssueTable tr[data-tk-issue="501"]').click();
  const detail = page.locator("#tenkeyIssueDetail");
  await expect(detail.locator(".tk-repro")).toHaveText("이 판 다시 만들기: seed 4455 (QA_WORLD_SEED)");
  await expect(detail).toContainText("예 (웹 체험판)");
  await expect(detail.locator(".tk-steps li")).toHaveCount(4);
  await expect(detail.locator(".tk-steps li").nth(3)).toContainText("팝업 열림: level_up");
  await page.locator("#tenkeyIssueDays").selectOption("30");
  await page.locator("#tenkeyIssueForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "issues.list")).at(-1).params).toEqual({ days: 30, source: "app", limit: 200 });
  await expect(detail).toBeHidden();
  expect(errors).toEqual([]);
});

test("이슈함 1대1 문의: the inquiry with its reply email, the steps before it was sent and the run / save; an older inquiry reads '—'", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await page.locator('#tenkeyIssueTabs [data-issue-tab="ask"]').click();
  await expect(page.locator("#tenkeyIssueGroupsPanel")).toBeHidden();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  expect((await calls(page, "issues.asks")).at(-1).params).toEqual({ days: 7 });
  await expect(page.locator("#tenkeyIssueKeepNote")).toContainText("글과 답장 이메일은 60일 보관");
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee01"] td[data-label="앱 순서"]')).toHaveText("4단계");
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee00"] td[data-label="앱 순서"]')).toHaveText("—");
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee00"]')).toContainText("플레이어 기록 없음");
  await page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee01"]').click();
  const detail = page.locator("#tenkeyIssueDetail");
  await expect(detail).toContainText("보스 앞에서 화면이 멈췄어요");
  await expect(detail).toContainText("player+qa@example.com");
  await expect(detail.locator(".tk-repro")).toHaveText("이 판 다시 만들기: seed 918273 (QA_WORLD_SEED)");
  await expect(detail).toContainText("보내기 전 앱 순서 (오래된 것부터 4단계)");
  await expect(detail.locator(".tk-steps li").nth(3)).toContainText("팝업 열림: contact");
  await shot(page, "issues_ask_detail", "#tenkeyIssueDetail");
  await page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee00"]').click();
  await expect(detail).toContainText("없음 (이전 빌드)");
  await expect(detail).toContainText("— (이 보고를 보낸 빌드는 앱 순서를 보내지 않았습니다)");
  await expect(detail.locator(".tk-repro")).toHaveCount(0);
  // The player link opens the player page, not the inquiry.
  await page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee01"] a').click();
  await expect(page).toHaveURL(/#\/tenkey-players\/a1111111-1111-4111-8111-111111111111$/);
  expect(errors).toEqual([]);
});

test("이슈함: a failed read says so in Korean and leaves an empty list, without breaking the tabs", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  await page.evaluate(() => { window.__mockFailures["issues.list"] = "console_request_failed"; });
  await page.locator("#tenkeyIssueForm button[type=submit]").click();
  await expect(page.locator("#tenkeyIssueMessage")).toContainText("요청을 처리하지 못했습니다.");
  await expect(page.locator("#tenkeyIssueTable")).toContainText("이 기간에 들어온 보고가 없습니다.");
  await page.locator('#tenkeyIssueTabs [data-issue-tab="ask"]').click();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  expect(errors).toEqual([]);
});
