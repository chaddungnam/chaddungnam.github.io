const { test, expect } = require("@playwright/test");

const routes = [
  "/?lang=ko",
  "/index_en.html?lang=en",
  "/index_de.html?lang=de",
  "/index_ja.html?lang=ja",
  "/quirky-ball/?lang=ko",
  "/project-k/index_en.html?lang=en",
  "/privacy/de.html?stay=1",
  "/support/?lang=en",
  "/blog/kr/",
  "/blog/en/내가-독일까지-와서-뜬금없이-개발을-시작하게-된-이유/",
];

for (const route of routes) {
  test(`${route} renders without broken media or horizontal overflow`, async ({ page }) => {
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(route, { waitUntil: "load" });
    expect(response?.ok(), `${route} must return HTTP 2xx`).toBeTruthy();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.brokenImages).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("theme, mobile menu, and keyboard state stay understandable", async ({ page, isMobile }) => {
  await page.goto("/index_en.html?lang=en");
  let menu;
  if (isMobile) {
    menu = page.locator("[data-menu-button]");
    await expect(menu).toHaveAccessibleName("Open menu");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toHaveAccessibleName("Close menu");
  }

  const theme = page.locator("[data-theme-toggle]").first();
  await expect(theme).toHaveAccessibleName(/light mode/i);
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAccessibleName(/dark mode/i);

  if (isMobile) {
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  }

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("YouTube Shorts keep their portrait ratio", async ({ page }) => {
  await page.goto("/blog/kr/내가-독일까지-와서-뜬금없이-개발을-시작하게-된-이유/");
  const frame = page.locator("iframe.video-portrait");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
});
