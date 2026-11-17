const { test, expect } = require("@playwright/test");
// The shared stand-in API, auth stub, open(), shot() and calls() (tests/fixtures/tenkey_console.cjs).
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console watch (owner 2026-11-15): tags in the players list and the player page, the 감시 page, the review switch, the review code line.
// TENKEY_SHOTS=<dir> writes captures there.
test.describe.configure({ retries: 2 });
const A1 = "a1111111-1111-4111-8111-111111111111";
const B2 = "b2222222-2222-4222-8222-222222222222";

test("players list shows [검수], [무적], [TOP10] tags and the old server only loses the extra tags", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players", "window.__mockCalls0=1;");
  const row = (id) => page.locator("#tenkeyPlayersTable tr", { has: page.locator(`a[href="#/tenkey-players/${id}"]`) });
  await expect(row(A1).locator('[data-tag="review"]')).toHaveText("[검수]");
  await expect(row(B2).locator('[data-tag="review_off"]')).toHaveText("[검수 꺼짐]");
  await expect(row(B2).locator('[data-tag="top_normal"]')).toHaveText("[TOP10 일반]");
  await expect(row(B2).locator('[data-tag="top_hard"]')).toHaveText("[TOP10 하드]");
  await shot(page, "watch_list_tags", "#tenkeyPlayersView");
  expect(errors).toEqual([]);
});

test("old server (no watch.list): list still works, god tag stays", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players", "window.__mockNoWatch=true;");
  await expect(page.locator("#tenkeyPlayersTable tr")).not.toHaveCount(0);
  await expect(page.locator("[data-tag]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("감시 page: filters, runs with start level, quick ban and review off", async ({ page }) => {
  const errors = await open(page, "#/tenkey-watch");
  await expect(page.locator("#tenkeyWatchTable tr[data-watch-row]")).toHaveCount(2);
  await expect(page.locator('[data-watch-filter="review"] b')).toHaveText("2");
  await expect(page.locator('[data-watch-filter="top"] b')).toHaveText("1");
  await expect(page.locator('[data-watch-filter="god"] b')).toHaveText("0");
  await page.locator('[data-watch-filter="top"]').click();
  await expect(page.locator("#tenkeyWatchTable tr[data-watch-row]")).toHaveCount(1);
  await expect(page.locator("#tenkeyWatchTable")).toContainText("일반 3위 · 하드 1위");
  await page.locator('[data-watch-filter="all"]').click();
  await page.locator(`[data-watch-runs="${A1}"]`).click();
  await expect(page.locator(`[data-watch-detail="${A1}"]`)).toContainText("시작 레벨");
  await expect(page.locator(`[data-watch-detail="${A1}"] tbody tr`)).toHaveCount(3);
  await shot(page, "watch_page", "#tenkeyWatchView");
  // quick review off: reason dialog, then the audited call, then the row loses [검수]
  await page.locator(`[data-watch-review="${A1}"]`).click();
  await page.locator("#tenkeyReasonInput").fill("심사 끝남");
  await page.locator('#tenkeyReasonDialog button[value="confirm"]').click();
  await expect(page.locator(`[data-watch-row="${A1}"]`)).toHaveCount(0);
  const set = await calls(page, "review.set");
  expect(set.length).toBe(1);
  expect(set[0].params).toMatchObject({ player_id: A1, on: false, reason: "심사 끝남" });
  // quick ban
  await page.locator(`[data-watch-ban="${B2}"]`).click();
  await page.locator("#tenkeyReasonInput").fill("점수 의심");
  await page.locator('#tenkeyReasonDialog button[value="confirm"]').click();
  await expect.poll(async () => (await calls(page, "players.ban")).length).toBe(1);
  expect(errors).toEqual([]);
});

test("player page: review switch only turns off, with reason and confirm; 무적 switch stays", async ({ page }) => {
  const errors = await open(page, `#/tenkey-players/${A1}`);
  const form = page.locator("#tenkeyReviewForm");
  await expect(form).toBeVisible();
  await expect(page.locator("#tenkeyGodForm")).toBeVisible();
  await expect(page.locator("#tenkeyReviewState")).toHaveText("켜짐");
  await expect(page.locator("#tenkeyReviewApply")).toBeDisabled();
  await page.locator("#tenkeyReviewForm .tk-switch-track").click();
  await expect(page.locator("#tenkeyReviewApply")).toBeEnabled();
  await shot(page, "watch_review_switch", "#tenkeyPlayerUnlocks");
  await form.locator('input[name="reason"]').fill("심사 끝남");
  await page.locator("#tenkeyReviewApply").click();
  await page.locator('#confirmDialog button[value="confirm"]').click();
  await expect.poll(async () => (await calls(page, "review.set")).length).toBe(1);
  await expect(page.locator("#tenkeyReviewState")).toHaveText("꺼짐 · 권한 없음");
  expect(errors).toEqual([]);
});

test("config page shows the review code line (state only)", async ({ page }) => {
  await open(page, "#/tenkey-config");
  await expect(page.locator("#tenkeyReviewCodeState")).toContainText("켜짐");
  await expect(page.locator("#tenkeyReviewCodeCard button, #tenkeyReviewCodeCard input")).toHaveCount(0);
  await shot(page, "watch_review_code", "#tenkeyReviewCodeCard");
});

test("audit names the review switch", async ({ page }) => {
  await open(page, "#/tenkey-audit");
  await expect(page.locator("#tenkeyAuditList")).toBeVisible();
});
