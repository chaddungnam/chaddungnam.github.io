const { test, expect } = require("@playwright/test");
// The shared stand-in API (issues.*: tests/fixtures/tenkey/issues.js), auth stub, open(), shot() and calls().
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console 이슈함 page (owner 2026-11-17: "서버로 이슈를 받되 재현 절차까지 알 수 있게"): crash reports, app issues and 1:1 inquiries,
// each opening one report with the app's own steps before it, the run's seed to rebuild it in QA, the save it had and the same
// device's records around it. Reports from builds before these fields show '—'. TENKEY_SHOTS=<dir> writes captures.
test.describe.configure({ retries: 2 });

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
  const line = page.locator("#tenkeyIssueTimeline li");
  await expect(line).toHaveCount(3);
  await expect(line.nth(0)).toContainText("성능 보고 · 가장 긴 한 프레임 480ms · 버벅임 2");
  await expect(line.nth(1)).toContainText("판 흐름 · 노멀 모드 · Lv 12 · 게임 오버 (텐키 파손) · 4분 5초 판");
  await expect(line.nth(2)).toContainText("크래시 · 화면을 켠 채 꺼짐 · DigScene · signal 11");
  await expect(line.nth(2).locator(".tk-badge")).toHaveText("이 보고");
  await expect(line.nth(0)).not.toContainText("undefined");
  // the server finds the device from the report itself: the page sends the report, never an install id
  expect((await calls(page, "issues.timeline")).at(-1).params).toEqual({ source: "crash", id: 41, minutes: 10 });
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
  await expect(detail.locator(".tk-repro")).toHaveCount(0);
  await detail.locator("#tenkeyIssueTimelineButton").click();
  await expect(detail.locator("#tenkeyIssueTimeline")).toHaveText("— (이 보고에는 기기 번호도 세션 번호도 없어 묶어 볼 수 없습니다)");
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

// 처리 상태 (fw8): a group or an inquiry is 열림 / 확인함 / 고침 (+ the build that fixed it, a note), written by tenkey-admin
// issues.mark after the Korean confirm dialog and audited like a ban; a fixed group that came back says so in red.
test("이슈함 처리 상태: each group shows its state; picking one opens the form; 고침 + build + note goes through the confirm dialog to tenkey-admin", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  const exitRow = page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="unclean_exit|DigScene"]');
  await expect(exitRow.locator('td[data-label="상태"]')).toHaveText("열림");
  const anr = page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="anr_suspect|"]');
  await expect(anr.locator('td[data-label="상태"] .tk-badge').nth(0)).toHaveText("고침 · 빌드 2");
  await expect(anr.locator('td[data-label="상태"] .tk-badge[data-tone="risk"]')).toHaveText("고친 뒤 다시 1건");
  await expect(page.locator("#tenkeyIssueTriage")).toBeHidden();

  await exitRow.click();
  const form = page.locator("#tenkeyTriageForm");
  await expect(form).toBeVisible();
  await expect(exitRow).toHaveAttribute("aria-selected", "true");
  await expect(form.locator(".tk-triage-now")).toHaveText("지금: 열림 (콘솔에서 아직 아무도 표시하지 않음)");
  await expect(form.locator('input[name="status"][value="open"]')).toBeChecked();
  await expect(form.locator('input[name="build"]')).toBeDisabled();   // a build only goes with 고침
  await form.locator('input[name="status"][value="fixed"]').check();
  await expect(form.locator('input[name="build"]')).toBeEnabled();
  await form.locator('input[name="build"]').fill("41");
  await form.locator('input[name="note"]').fill("화면 끄기 전 저장");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toBeHidden();            // no reason yet: the browser stops the form, nothing is sent
  expect(await calls(page, "issues.mark")).toEqual([]);

  await form.locator('input[name="reason"]').fill("빌드 41에서 고침 확인");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("DigScene · 화면을 켠 채 꺼짐 · Android");
  await expect(page.locator("#confirmDialog")).toContainText("열림 → 고침 (빌드 41)");
  await expect(page.locator("#confirmDialog")).toContainText("메모: 화면 끄기 전 저장");
  await expect(page.locator("#confirmDialog")).toContainText("사유: 빌드 41에서 고침 확인");
  await page.locator("#confirmDialog button[value=cancel]").click();
  expect(await calls(page, "issues.mark")).toEqual([]);                  // cancel sends nothing

  await form.locator("button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyTriageMessage")).toHaveText("저장했습니다. 감사 기록에 남았습니다.");
  const sent = (await calls(page, "issues.mark")).at(-1);
  expect(sent).toMatchObject({ fn: "tenkey-admin", params: { source: "crash", kind: "unclean_exit", where: "DigScene", platform: "android", status: "fixed", build: 41,
    note: "화면 끄기 전 저장", reason: "빌드 41에서 고침 확인" } });
  expect(sent.request_id).toMatch(/^[0-9a-f-]{36}$/);
  await expect(exitRow.locator('td[data-label="상태"]')).toHaveText("고침 · 빌드 41");
  await expect(page.locator("#tenkeyTriageForm .tk-triage-now")).toContainText("지금: 고침 (빌드 41)");
  await expect(page.locator("#tenkeyTriageForm .tk-triage-now")).toContainText("qa@houseduck.in · 메모: 화면 끄기 전 저장");
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(1);     // the list still shows the picked group only
  await shot(page, "issues_triage", "#tenkeyIssueGroupsPanel");

  // The same state again: the server answers changed:false, the page says nothing was recorded.
  await page.locator('#tenkeyTriageForm input[name="reason"]').fill("다시 눌러 봄");
  await page.locator("#tenkeyTriageForm button[type=submit]").click();
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyTriageMessage")).toHaveText("이미 그 상태라 바꾸지 않았습니다 (감사 기록 없음).");

  // A refusal reads in Korean and keeps the form.
  await page.evaluate(() => { window.__mockFailures["issues.mark"] = "invalid_build"; });
  await page.locator('#tenkeyTriageForm input[name="status"][value="seen"]').check();
  await page.locator('#tenkeyTriageForm input[name="reason"]').fill("보는 중");
  await page.locator("#tenkeyTriageForm button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("고침 → 확인함");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyTriageMessage")).toContainText("고친 빌드 번호는 1 이상의 정수로 입력해 주세요");
  await expect(exitRow.locator('td[data-label="상태"]')).toHaveText("고침 · 빌드 41");

  await exitRow.click();                                                  // a second press lets the group go
  await expect(page.locator("#tenkeyIssueTriage")).toBeHidden();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("이슈함 처리 상태: 고침 without a build (a server-side fix) says so; app groups mark the same way; a new list keeps the marks", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await page.locator('#tenkeyIssueTabs [data-issue-tab="app"]').click();
  const stall = page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="stall|home_load"]');
  await expect(stall.locator('td[data-label="상태"]')).toHaveText("확인함");
  const hitch = page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="hitch|level_up_cards"]');
  await hitch.click();
  const form = page.locator("#tenkeyTriageForm");
  await form.locator('input[name="status"][value="fixed"]').check();
  await form.locator('input[name="reason"]').fill("서버 응답 캐시로 고침");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("열림 → 고침 (빌드 없음: 서버 쪽 수정)");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyTriageMessage")).toHaveText("저장했습니다. 감사 기록에 남았습니다.");
  expect((await calls(page, "issues.mark")).at(-1).params).toEqual({ source: "app", kind: "hitch", where: "level_up_cards", platform: "web_itch", status: "fixed",
    build: null, note: "", reason: "서버 응답 캐시로 고침" });
  await expect(hitch.locator('td[data-label="상태"]')).toHaveText("고침");
  await page.locator("#tenkeyIssueForm button[type=submit]").click();
  await expect(page.locator("#tenkeyIssueTriage")).toBeHidden();
  await expect(page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="hitch|level_up_cards"] td[data-label="상태"]')).toHaveText("고침");
  expect(errors).toEqual([]);
});

test("이슈함 처리 상태: an inquiry shows its state in the list and marks from its own page; 고침 shows as 고침", async ({ page }) => {
  const errors = await open(page, "#/tenkey-issues");
  await page.locator('#tenkeyIssueTabs [data-issue-tab="ask"]').click();
  const row = page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee01"]');
  await expect(row.locator('td[data-label="상태"]')).toHaveText("열림");
  await row.click();
  const detail = page.locator("#tenkeyIssueDetail");
  await expect(detail.locator("#tenkeyTriageForm")).toBeVisible();
  await detail.locator('#tenkeyTriageForm input[name="status"][value="fixed"]').check();
  await detail.locator('#tenkeyTriageForm input[name="build"]').fill("42");
  await detail.locator('#tenkeyTriageForm input[name="reason"]').fill("보스 멈춤 고침");
  await detail.locator("#tenkeyTriageForm button[type=submit]").click();
  await expect(page.locator("#confirmDialog")).toContainText("1대1 문의 c0ffee01 · 딸깍덕");
  await page.locator("#confirmDialog button[value=confirm]").click();
  await expect(page.locator("#tenkeyTriageMessage")).toHaveText("저장했습니다. 감사 기록에 남았습니다.");
  expect((await calls(page, "issues.mark")).at(-1).params).toEqual({ source: "ask", receipt: "c0ffee01", status: "fixed", build: 42, note: "", reason: "보스 멈춤 고침" });
  await expect(row.locator('td[data-label="상태"]')).toHaveText("고침 · 빌드 42");
  await expect(detail).toContainText("보스 앞에서 화면이 멈췄어요");
  await expect(detail.locator(".tk-detail-grid").first()).toContainText("상태고침");
  await shot(page, "issues_ask_triage", "#tenkeyIssueDetail");
  expect(errors).toEqual([]);
});

test("이슈함 처리 상태: against the server before fw8 (no sig / triage) the state reads '—' or the inquiry's own status, and no form shows", async ({ page }) => {
  const strip = `{ const l = window.__tkPages["issues.list"], a = window.__tkPages["issues.asks"];
    window.__tkPages["issues.list"] = (...x) => { const r = l(...x); return { ...r, groups: r.groups.map(({ sig, triage, ...g }) => g) }; };
    window.__tkPages["issues.asks"] = (...x) => { const r = a(...x); return { ...r, rows: r.rows.map(({ triage, ...g }) => ({ ...g, status: g.receipt === "c0ffee00" ? "seen" : g.status })) }; }; }`;
  const errors = await open(page, "#/tenkey-issues", strip);
  const exitRow = page.locator('#tenkeyIssueGroups tr[data-tk-issue-group="unclean_exit|DigScene"]');
  await expect(exitRow.locator('td[data-label="상태"]')).toHaveText("—");
  await exitRow.click();
  await expect(page.locator("#tenkeyIssueTable tr")).toHaveCount(1);
  await expect(page.locator("#tenkeyIssueTriage")).toBeHidden();
  await page.locator('#tenkeyIssueTabs [data-issue-tab="ask"]').click();
  await expect(page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee00"] td[data-label="상태"]')).toHaveText("확인함");
  await page.locator('#tenkeyIssueTable tr[data-tk-ask="c0ffee01"]').click();
  await expect(page.locator("#tenkeyIssueDetail")).toContainText("보스 앞에서 화면이 멈췄어요");
  await expect(page.locator("#tenkeyTriageForm")).toHaveCount(0);
  expect(errors).toEqual([]);
});
