const { test, expect } = require("@playwright/test");
// The shared stand-in API (telemetry.get: tests/fixtures/tenkey/perf.js; issues.list: issues.js), auth stub, open(), shot(), calls().
const { open, shot, calls } = require("./fixtures/tenkey_console.cjs");

// 10key console 성능 page (owner 2026-11-17: "극한 최적화"): what the phone apps measure each time they are opened (first frame,
// slowest frames per loading stage, hitch places, first-use hitches, 5 s stalls, memory) by device and build, plus the web demo's
// hitch / stall groups from the app issues. TENKEY_SHOTS=<dir> writes captures.
test.describe.configure({ retries: 2 });

test("성능: summary, devices, stages, hitch places, first use, stalls and builds from the server; the build filter goes to the server", async ({ page }) => {
  const errors = await open(page, "#/tenkey-perf");
  await expect(page.locator("#pageTitle")).toHaveText("성능");
  const card = (k) => page.locator(`#tenkeyPerfSummary [data-perf-summary="${k}"]`);
  await expect(card("sessions")).toHaveText("140");
  await expect(card("installs")).toHaveText("38");
  await expect(card("first")).toHaveText("2,100ms / 4,800ms");
  await expect(card("stall")).toHaveText("6 · 4.3%");
  await expect(card("mem")).toHaveText("3 · 2.1%");
  await expect(card("peak")).toHaveText("410MB / 690MB");
  await expect(page.locator("#tenkeyPerfDevices tr")).toHaveCount(3);
  const slow = page.locator("#tenkeyPerfDevices tr", { hasText: "SM-A135F" });
  await expect(slow.locator('td[data-label="세션당 100ms 넘은 프레임"]')).toHaveText("9.2");
  await expect(page.locator("#tenkeyPerfStages tr")).toHaveCount(2);
  await expect(page.locator("#tenkeyPerfStages tr", { hasText: "home" }).locator('td[data-label="켠 뒤 도착 (가운데)"]')).toHaveText("2초");
  await expect(page.locator("#tenkeyPerfAreas tr", { hasText: "run" }).first().locator('td[data-label="머문 시간"]')).toHaveText("5시간 50분");
  await expect(page.locator("#tenkeyPerfAreas tr", { hasText: "home" }).locator('td[data-label="머문 시간"]')).toHaveText("1시간 40분");
  await expect(page.locator("#tenkeyPerfFirstUse")).toContainText("fx_level_aura");
  await expect(page.locator("#tenkeyPerfStalls tr")).toHaveCount(1);
  await expect(page.locator("#tenkeyPerfStalls")).toContainText("boss_intro");
  await expect(page.locator("#tenkeyPerfBuilds tr")).toHaveCount(3);
  await expect(page.locator("#tenkeyPerfBuild option")).toHaveCount(3);  // 전체 + builds 41 and 22 (41 twice: Android and iOS)
  expect((await calls(page, "telemetry.get")).at(-1)).toMatchObject({ fn: "tenkey-console-stats", params: { days: 7 } });
  await shot(page, "perf");
  await page.locator("#tenkeyPerfBuild").selectOption("41");
  await page.locator("#tenkeyPerfDays").selectOption("30");
  await page.locator("#tenkeyPerfForm button[type=submit]").click();
  await expect.poll(async () => (await calls(page, "telemetry.get")).at(-1).params).toEqual({ days: 30, build: 41 });
  await expect(page.locator("#tenkeyPerfBuild")).toHaveValue("41");
  expect(errors).toEqual([]);
});

test("성능: the web demo's hitches and stalls come from the app issues, grouped by place", async ({ page }) => {
  const errors = await open(page, "#/tenkey-perf");
  await expect(page.locator("#tenkeyPerfWebHitch tr")).toHaveCount(1);
  await expect(page.locator("#tenkeyPerfWebHitch")).toContainText("level_up_cards");
  await expect(page.locator("#tenkeyPerfWebHitch td[data-label=\"횟수\"]")).toHaveText("7");
  await expect(page.locator("#tenkeyPerfWebHitch")).toContainText("웹 · itch.io");
  await expect(page.locator("#tenkeyPerfWebStall tr")).toHaveCount(1);
  await expect(page.locator("#tenkeyPerfWebStall")).toContainText("home_load");
  const sent = (await calls(page, "issues.list")).map((c) => c.params);
  expect(sent).toEqual(expect.arrayContaining([{ days: 7, source: "app", kind: "hitch", limit: 50 }, { days: 7, source: "app", kind: "stall", limit: 50 }]));
  await shot(page, "perf_web", "#tenkeyPerfWebHitch");
  expect(errors).toEqual([]);
});

test("성능: a week without sessions shows '—' and says why in each table instead of zeros that look measured", async ({ page }) => {
  const errors = await open(page, "#/tenkey-perf", "window.__mockPerfEmpty = true;");
  const card = (k) => page.locator(`#tenkeyPerfSummary [data-perf-summary="${k}"]`);
  await expect(card("sessions")).toHaveText("0");
  for (const k of ["first", "stall", "mem", "peak"]) await expect(card(k)).toHaveText("—");
  await expect(page.locator("#tenkeyPerfDevices")).toContainText("이 기간에 받은 성능 보고가 없습니다.");
  await expect(page.locator("#tenkeyPerfStalls")).toContainText("이 기간에 5초 넘게 멈춘 세션이 없습니다.");
  await expect(page.locator("#tenkeyPerfFirstUse")).toContainText("처음 쓸 때 걸린 곳이 없습니다.");
  await expect(page.locator("#tenkeyPerfBuild option")).toHaveCount(1);
  expect(errors).toEqual([]);
});
