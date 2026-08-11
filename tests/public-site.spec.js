const { test, expect } = require("@playwright/test");

const routes = [
  "/?lang=ko",
  "/index_en.html?lang=en",
  "/index_de.html?lang=de",
  "/index_ja.html?lang=ja",
  "/about/?lang=ko",
  "/about/index_en.html?lang=en",
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
  await expect(theme.locator(".theme-sun")).toBeVisible();
  await expect(theme.locator(".theme-moon")).toBeHidden();
  const themeBox = await theme.boundingBox();
  expect(themeBox.height).toBe(44);
  if (!isMobile) expect(themeBox.width).toBe(44);
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAccessibleName(/dark mode/i);
  await expect(theme.locator(".theme-sun")).toBeHidden();
  await expect(theme.locator(".theme-moon")).toBeVisible();

  if (isMobile) {
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  }

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("home hierarchy keeps the statement compact and the journal scannable", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator(".manifesto-bubble")).toContainText("사람냄새 나는 게임과 소프트웨어");
  await expect(page.locator(".manifesto-mark")).toHaveText("HD");
  await expect(page.locator(".brand-lockup")).toHaveCSS("background-image", /house-duck-logo\.png/);
  await expect(page.locator(".type-cursor")).toHaveCount(0);
  await expect(page.locator(".nav-featured")).toHaveCount(2);
  await expect(page.locator("[data-game-preview]")).toHaveCount(2);
  await expect(page.locator(".phone-side-button")).toHaveCount(4);
  await expect(page.locator(".phone-home-indicator")).toHaveCount(2);
  await expect(page.locator("[data-section='blog-posts']")).toBeVisible();
  await expect(page.locator(".post-preview-card:not(.post-preview-empty)")).toHaveCount(4);
  await expect(page.locator(".post-preview-card-wide")).toHaveCount(1);

  if (!isMobile) {
    const bubble = await page.locator(".manifesto-bubble").boundingBox();
    const phone = await page.locator(".iphone-shell").first().boundingBox();
    const cards = await page.locator(".post-preview-card:not(.post-preview-empty)").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { y: box.y, width: box.width };
    }));
    expect(bubble.width).toBeLessThan(680);
    expect(phone.width).toBeGreaterThan(200);
    expect(Math.max(...cards.slice(0, 3).map((card) => card.y)) - Math.min(...cards.slice(0, 3).map((card) => card.y))).toBeLessThan(2);
    expect(cards[3].y).toBeGreaterThan(cards[0].y);
    expect(cards[3].width).toBeGreaterThan(cards[0].width * 2.5);
    expect(await page.locator(".game-device").first().evaluate((node) => getComputedStyle(node).animationName)).toContain("studio-phone-float");
  }

  const state = await page.locator("[data-game-preview]").evaluateAll((videos) => videos.map((video) => ({
    autoplay: video.autoplay,
    muted: video.muted,
    loop: video.loop,
    playsInline: video.playsInline,
  })));
  expect(state).toEqual([
    { autoplay: true, muted: true, loop: true, playsInline: true },
    { autoplay: true, muted: true, loop: true, playsInline: true },
  ]);
});

test("YouTube Shorts keep their portrait ratio", async ({ page }) => {
  await page.goto("/blog/kr/내가-독일까지-와서-뜬금없이-개발을-시작하게-된-이유/");
  const frame = page.locator("iframe.video-portrait");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
});
