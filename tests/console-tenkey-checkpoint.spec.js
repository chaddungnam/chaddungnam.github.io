const path = require("node:path");
const { test, expect } = require("@playwright/test");
// The shared stand-in API, auth stub, open(), shot() and calls() (tests/fixtures/tenkey_console.cjs).
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console, owner 2026-11-19: item 7 "플레이어 상세에서 체크포인트 조정 가능하게" (자동 / 레벨 1 / 8 / 15부터 per mode,
// reason + audit, the row says where the next run starts) and item 9 (steps 1-6 as ONE "기본 탭 (1~6)" row with one switch, every
// other row's text from the game code). TENKEY_SHOTS=<dir> writes captures there.
test.describe.configure({ retries: 2 });
const A1 = "a1111111-1111-4111-8111-111111111111";  // best normal Lv 14 (auto start 8), best hard Lv 3 (auto start 1)
// The checkpoint rows and the 기본 탭 row in one capture (page coordinates, the sticky top bar let go so it does not cover them).
async function clipShot(page, name) {
  const dir = process.env.TENKEY_SHOTS;
  if (!dir) return;
  await page.addStyleTag({ content: ".console-topbar { position: static !important; }" });
  const clip = await page.evaluate(() => {
    const top = document.getElementById("tenkeyCheckpointHead").getBoundingClientRect();
    const end = document.querySelector('ol.tk-unlock-list [data-step="home_mailbox"]').getBoundingClientRect();
    const box = document.getElementById("tenkeyPlayerUnlocks").getBoundingClientRect();
    return { x: Math.max(0, box.left - 8), y: top.top + window.scrollY - 8, width: Math.min(box.width + 16, document.documentElement.clientWidth), height: end.bottom - top.top + 16 };
  });
  const project = test.info().project.name.startsWith("mobile") ? "phone" : "desktop";
  await page.screenshot({ path: path.join(dir, `${project}_${name}.png`), fullPage: true, clip });
}
const confirmReason = async (page, text) => {
  await page.locator("#tenkeyReasonInput").fill(text);
  await page.locator('#tenkeyReasonDialog button[value="confirm"]').click();
};

test("checkpoint rows: the start now, a change with a reason goes to checkpoint.set and shows, 자동 sends null", async ({ page }) => {
  const errors = await open(page, `#/tenkey-players/${A1}`);
  const classic = page.locator('.tk-cp-row[data-cp="classic"]');
  const hard = page.locator('.tk-cp-row[data-cp="hard"]');
  await expect(classic).toContainText("지금: 레벨 8부터 (자동 · 최고 Lv 14)");
  await expect(hard).toContainText("지금: 레벨 1부터 (자동 · 최고 Lv 3)");
  await expect(classic.locator('[data-state="auto"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tenkeyPlayerUnlocks")).toContainText('"체크포인트!" 띠');
  await clipShot(page, "checkpoint_rows");

  // a cancelled dialog sends nothing
  await classic.locator('[data-state="15"]').click();
  await page.locator('#tenkeyReasonDialog button[value="cancel"]').click();
  expect(await calls(page, "checkpoint.set")).toEqual([]);

  await classic.locator('[data-state="15"]').click();
  await expect(page.locator("#tenkeyReasonBody")).toContainText("일반 모드 체크포인트: 자동 → 레벨 15부터");
  await confirmReason(page, "Lv 15 보스 테스트");
  await expect(page.locator('.tk-cp-row[data-cp="classic"]')).toContainText("지금: 레벨 15부터 (콘솔 설정 · 최고 Lv 14)");
  await expect(page.locator('.tk-cp-row[data-cp="classic"] [data-state="15"]')).toHaveAttribute("aria-pressed", "true");
  let set = await calls(page, "checkpoint.set");
  expect(set.length).toBe(1);
  expect(set[0].params).toEqual({ player_id: A1, mode: "classic", level: 15, reason: "Lv 15 보스 테스트" });
  expect(set[0].request_id).toBeTruthy();

  await page.locator('.tk-cp-row[data-cp="hard"] [data-state="8"]').click();
  await confirmReason(page, "하드 8 테스트");
  await expect(page.locator('.tk-cp-row[data-cp="hard"]')).toContainText("지금: 레벨 8부터 (콘솔 설정 · 최고 Lv 3)");
  await page.locator('.tk-cp-row[data-cp="classic"] [data-state="auto"]').click();
  await confirmReason(page, "되돌림");
  await expect(page.locator('.tk-cp-row[data-cp="classic"]')).toContainText("지금: 레벨 8부터 (자동 · 최고 Lv 14)");
  set = await calls(page, "checkpoint.set");
  expect(set.map((c) => [c.params.mode, c.params.level])).toEqual([["classic", 15], ["hard", 8], ["classic", null]]);
  // pressing the choice already on sends nothing
  await page.locator('.tk-cp-row[data-cp="hard"] [data-state="8"]').click();
  await expect(page.locator("#tenkeyReasonDialog")).not.toBeVisible();
  expect((await calls(page, "checkpoint.set")).length).toBe(3);
  await clipShot(page, "checkpoint_rows_set");

  // the audit page names the change in words
  await page.evaluate(() => { window.location.hash = "#/tenkey-audit"; });
  await expect(page.locator("#tenkeyAuditList")).toContainText("체크포인트 변경");
  await expect(page.locator("#tenkeyAuditList")).toContainText("하드 → 레벨 8부터");
  expect(errors).toEqual([]);
});

test("old server (no checkpoint key): the rows show the auto start, the switches are off with a note", async ({ page }) => {
  const errors = await open(page, `#/tenkey-players/${A1}`, "window.__mockNoCheckpoint=true;");
  await expect(page.locator('.tk-cp-row[data-cp="classic"]')).toContainText("지금: 레벨 8부터 (자동 · 최고 Lv 14)");
  await expect(page.locator(".tk-cp-row .tk-seg")).toHaveCount(8);
  for (const seg of await page.locator(".tk-cp-row .tk-seg").all()) await expect(seg).toBeDisabled();
  await expect(page.locator("#tenkeyPlayerUnlocks")).toContainText("서버 반영 전이라 아직 바꿀 수 없습니다");
  expect(errors).toEqual([]);
});

test("기본 탭 (1~6): one row, one switch sets the six steps in one call, mixed shows 섞임, step 7 on stays its own row", async ({ page }) => {
  const errors = await open(page);
  // quests forced off beforehand: the six differ
  await page.evaluate((id) => window.ConsoleAPI.postProject("houseduck", "tenkey-admin", { action: "unlocks.set", params: { player_id: id, step: "quests", state: "off", reason: "setup" } }), A1);
  await page.evaluate((id) => { window.location.hash = `#/tenkey-players/${id}`; }, A1);
  const list = page.locator("ol.tk-unlock-list");
  await expect(list.locator(".tk-unlock-row")).toHaveCount(12);  // 기본 탭 + steps 7-17
  for (const id of ["tab_research", "tab_ranking", "quests", "tab_shop", "tab_modules", "home_friends"]) await expect(list.locator(`[data-step="${id}"]`)).toHaveCount(0);
  const basic = list.locator('[data-step="basic"]');
  await expect(basic.locator(".tk-unlock-no")).toHaveText("1~6");
  await expect(basic).toHaveAttribute("data-current", "mixed");
  await expect(basic).toContainText("지금: 섞임 (자동 5 · 켜짐 0 · 꺼짐 1)");
  await expect(basic).toContainText("SHOP은 처음부터");
  await expect(basic.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(list.locator('[data-step="home_mailbox"] .tk-unlock-no')).toHaveText("7");
  await expect(list.locator('[data-step="shop_test"] .tk-unlock-no')).toHaveText("17");
  await expect(list.locator('[data-step="hard_card"]')).toContainText("최고 레벨이 7 이상이면 보임 (앱만");
  await clipShot(page, "basic_tabs_mixed");

  await basic.locator('[data-state="on"]').click();
  await expect(page.locator("#tenkeyReasonBody")).toContainText("기본 탭 6개");
  await confirmReason(page, "탭 전부 열기");
  await expect(list.locator('[data-step="basic"]')).toHaveAttribute("data-current", "on");
  const many = await calls(page, "unlocks.many");
  expect(many.length).toBe(1);
  expect(many[0].params).toEqual({ player_id: A1, steps: ["tab_research", "tab_ranking", "quests", "tab_shop", "tab_modules", "home_friends"], state: "on", reason: "탭 전부 열기" });
  expect(await calls(page, "unlocks.set")).toHaveLength(1);  // only the setup call
  await expect(page.locator("#tenkeyUnlockAll")).toHaveText("모두 자동 (6개 되돌림)");

  // 여기까지 켜기 on step 7 still sends unlocks.upto
  await list.locator('[data-unlock-upto="home_mailbox"]').click();
  await expect(page.locator("#tenkeyReasonBody")).toContainText("7번 우편함까지 7개 단계");
  await confirmReason(page, "우편함까지");
  await expect.poll(async () => (await calls(page, "unlocks.upto")).length).toBe(1);
  await expect(list.locator('[data-step="home_mailbox"]')).toHaveAttribute("data-current", "on");
  expect(errors).toEqual([]);
});

test("기본 탭 (1~6) on a tenkey-admin without unlocks.many: six unlocks.set calls instead", async ({ page }) => {
  const errors = await open(page, `#/tenkey-players/${A1}`, "window.__mockNoMany=true;");
  const basic = page.locator('ol.tk-unlock-list [data-step="basic"]');
  await expect(basic).toHaveAttribute("data-current", "auto");
  await basic.locator('[data-state="off"]').click();
  await confirmReason(page, "탭 닫기");
  await expect(page.locator('ol.tk-unlock-list [data-step="basic"]')).toHaveAttribute("data-current", "off");
  const set = await calls(page, "unlocks.set");
  expect(set.map((c) => c.params.step)).toEqual(["tab_research", "tab_ranking", "quests", "tab_shop", "tab_modules", "home_friends"]);
  expect(set.every((c) => c.params.state === "off" && c.params.reason === "탭 닫기")).toBe(true);
  await expect(page.locator("#tenkeyUnlockMessage")).toHaveText("");
  expect(errors).toEqual([]);
});

test("the panel fits the phone and desktop width: no row wider than the panel", async ({ page }) => {
  const errors = await open(page, `#/tenkey-players/${A1}`);
  const panel = page.locator("#tenkeyPlayerUnlocks");
  await expect(panel.locator(".tk-cp-row")).toHaveCount(2);
  const over = await panel.evaluate((host) => {
    const edge = host.getBoundingClientRect().right + 1;
    return [...host.querySelectorAll(".tk-unlock-row, .tk-segs")].filter((el) => el.getBoundingClientRect().right > edge).map((el) => el.className);
  });
  expect(over).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await shot(page, "unlock_panel_full", "#tenkeyPlayerUnlocks");
  expect(errors).toEqual([]);
});
