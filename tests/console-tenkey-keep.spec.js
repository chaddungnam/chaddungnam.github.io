const { test, expect } = require("@playwright/test");
// The shared stand-in API (keep.get: tests/fixtures/tenkey/keep.js), auth stub, open(), shot() and calls().
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console 데이터 보관 page (owner 2026-11-17: "서버는 필요한 것만 받고, 데이터는 2달마다 삭제 ... 콘솔 사이트에서 이 모든 걸 투명하게
// 볼 수 있게"): one row per dataset the game server keeps, read from the server's own keep list, and every other page's "보관 N일"
// filled from the same answer. TENKEY_SHOTS=<dir> writes captures.
test.describe.configure({ retries: 2 });

test("데이터 보관: every dataset in plain words with who sends it, days kept, rows, size, oldest row and the last cleanup; totals on top", async ({ page }) => {
  const errors = await open(page, "#/tenkey-keep");
  await expect(page.locator("#pageTitle")).toHaveText("데이터 보관");
  const rows = page.locator("#tenkeyKeepTable tr");
  await expect(rows).toHaveCount(8);
  const card = (k) => page.locator(`#tenkeyKeepSummary [data-keep-summary="${k}"]`);
  await expect(card("sets")).toHaveText("8");
  await expect(card("rows")).toHaveText("29,374");   // the log row (51, its bytes) lives inside crash_reports: not counted twice
  await expect(card("bytes")).toHaveText("38.4 MB");
  await expect(card("purge")).not.toHaveText(/—|아직 없음/);
  // One row by its table name (the code line under the plain name).
  const row = (tbl) => page.locator("#tenkeyKeepTable tr", { has: page.locator("code", { hasText: new RegExp(`\\.${tbl}$`) }) });
  await expect(row("crash_reports").locator('td[data-label="보관"]')).toHaveText("60일");
  await expect(row("log_tail").locator('td[data-label="보관"]')).toHaveText("7일");   // the server's name: tenkey.crash_reports.log_tail
  await expect(row("crash_reports").locator('td[data-label="데이터"] strong')).toHaveText("크래시 보고");
  await expect(row("crash_reports").locator('td[data-label="보내는 곳"]')).toContainText("GamePix·에디터·디버그 빌드는 보내지 않음");
  await expect(row("crash_reports").locator('td[data-label="보내는 곳"]')).toContainText("itch·네코랜드");
  await expect(row("issue_reports").locator('td[data-label="보내는 곳"]')).toContainText("14세 미만");
  await expect(row("telemetry").locator('td[data-label="데이터"] code')).toHaveText("tenkey_private.telemetry");
  // A dataset whose oldest row is older than its days (+2) was not cleaned up: only that one is marked.
  await expect(page.locator("#tenkeyKeepTable .tk-badge")).toHaveCount(1);
  await expect(row("app_issues").locator(".tk-badge")).toHaveText("보관 기간보다 오래된 줄 있음");
  await expect(row("app_issues").locator('td[data-label="마지막 정리"]')).toHaveText("아직 없음");
  await expect(row("app_issues").locator('td[data-label="지운 줄"]')).toHaveText("—");
  await expect(row("run_stats").locator('td[data-label="지운 줄"]')).toHaveText("905");
  // A table the page has no words for shows the server's own name and note, never a made-up number.
  const odd = row("new_mystery");
  await expect(odd).toContainText("새 표 (서버 설명)");
  await expect(odd.locator('td[data-label="보관"]')).toHaveText("—");
  await expect(odd.locator('td[data-label="크기"]')).toHaveText("—");
  const sent = await calls(page, "keep.get");
  expect(sent.at(-1)).toMatchObject({ fn: "tenkey-console-stats", params: {} });
  await shot(page, "keep");
  expect(errors).toEqual([]);
});

test("데이터 보관: the other pages' retention words come from the same keep list (crash 60일 / log 7일, 1대1 문의 60일, 성능 60일)", async ({ page }) => {
  const errors = await open(page, "#/tenkey-crashes");
  await expect(page.locator("#tenkeyCrashMessage")).toContainText("크래시 보고는 60일, 로그는 7일 보관합니다 (서버 값)");
  await page.evaluate(() => { window.location.hash = "#/tenkey-reports"; });
  await expect(page.locator('#tenkeyReportsView [data-tk-keep="issue_reports"]')).toHaveText("60일");
  await expect(page.locator("#tenkeyReportsView")).not.toContainText("7일만");
  await page.evaluate(() => { window.location.hash = "#/tenkey-perf"; });
  await expect(page.locator('#tenkeyPerfView [data-tk-keep="telemetry"]')).toHaveText("60일");
  await expect(page.locator('#tenkeyPerfView [data-tk-keep="app_issues"]')).toHaveText("60일");
  expect(errors).toEqual([]);
});

test("데이터 보관: when the keep list cannot be read the page says so, and the other pages show '—' with a link here instead of a number", async ({ page }) => {
  const errors = await open(page, "#/tenkey-keep", "window.__mockKeepFail = true;");
  await expect(page.locator("#tenkeyKeepTable")).toContainText("보관 현황을 읽지 못했습니다.");
  await expect(page.locator('#tenkeyKeepSummary [data-keep-summary="sets"]')).toHaveText("—");
  await expect(page.locator("#tenkeyKeepMessage")).not.toBeEmpty();
  await page.evaluate(() => { window.location.hash = "#/tenkey-crashes"; });
  await expect(page.locator("#tenkeyCrashMessage")).toContainText("보관 기간은 「데이터 보관」 화면에서 봅니다");
  await page.evaluate(() => { window.location.hash = "#/tenkey-perf"; });
  const keep = page.locator('#tenkeyPerfView [data-tk-keep="telemetry"]');
  await expect(keep).toHaveText("—(데이터 보관 화면)");
  await expect(keep.locator("a")).toHaveAttribute("href", "#/tenkey-keep");
  expect(errors).toEqual([]);
});
