const { test, expect } = require("@playwright/test");

// Owner 10-04 (iPhone 2.0 build): an empty console table opened the error text as a "detail" page
// with a visible "← 공지 목록" button ([hidden] lost to .back's display), and that button led to a
// blank slab. Empty/failed loads must stay on the list page, and theme=dark must not paint any surface.
const route = (page, reply) => page.route("**/functions/v1/public-notice?*", reply);
const notices = [
  { id: 2, category: "notice", body: "두 번째 공지", created_at: "2026-10-02T10:00:00Z" },
  { id: 1, category: "event", body: "첫 공지", created_at: "2026-10-01T10:00:00Z" },
];

test("empty notice table shows the list empty state, never the detail or its back button", async ({ page }) => {
  await route(page, (r) => r.fulfill({ json: { locale: "ko", notices: [] } }));
  await page.goto("/quirky-ball/notices/?embed=1&lang=ko");
  await expect(page.locator("#notice-list .notice-empty")).toHaveText("아직 등록된 공지사항이 없어요.");
  await expect(page.locator("#notice-detail")).toBeHidden();
  await expect(page.locator("#back-to-list")).toBeHidden();
});

test("a failed load stays on the list page", async ({ page }) => {
  await route(page, (r) => r.fulfill({ status: 500, body: "x" }));
  await page.goto("/quirky-ball/notices/?embed=1&lang=en");
  await expect(page.locator("#notice-list .notice-empty.error")).toHaveText("Could not load announcements.");
  await expect(page.locator("#notice-detail")).toBeHidden();
});

test("dark embed is transparent from first paint and list/detail/back round-trips", async ({ page }) => {
  await route(page, (r) => r.fulfill({ json: { locale: "ko", notices } }));
  await page.goto("/quirky-ball/notices/?embed=1&theme=dark&lang=ko");
  await expect(page.locator(".notice-card")).toHaveCount(2);
  for (const selector of ["html", "body", ".notice-shell"]) {
    await expect(page.locator(selector)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  await expect(page.locator("header")).toBeHidden();
  await page.locator(".notice-card").first().click();
  await expect(page.locator("#notice-detail")).toBeVisible();
  await page.locator("#back-to-list").click();
  await expect(page.locator("#notice-list")).toBeVisible();
  await expect(page.locator(".notice-card")).toHaveCount(2);
});

test("the light 1.1.3 embed keeps its white surface", async ({ page }) => {
  await route(page, (r) => r.fulfill({ json: { locale: "ko", notices } }));
  await page.goto("/quirky-ball/notices/?embed=1&lang=ko");
  await expect(page.locator(".notice-card")).toHaveCount(2);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
