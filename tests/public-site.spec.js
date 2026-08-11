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
  await expect(page.locator(".manifesto-bubble h1")).toHaveAttribute("aria-label", "House Duck, 게임 및 기타 소프트웨어 개발과 일기를 보여줍니다.");
  await expect(page.locator(".manifesto-note")).toContainText("환경 변화가 잦았던 제 경험을 녹여");
  await expect(page.locator(".manifesto-mark")).toHaveText("HD");
  await expect(page.locator(".brand-lockup")).toHaveCSS("background-image", /house-duck-logo\.png/);
  await expect(page.locator(".type-cursor")).toHaveCount(0);
  await expect(page.locator(".nav-featured")).toHaveCount(2);
  await expect(page.locator("[data-game-preview]")).toHaveCount(2);
  await expect(page.locator(".phone-side-button")).toHaveCount(4);
  await expect(page.locator(".phone-home-indicator")).toHaveCount(2);
  await expect(page.locator("[data-section='blog-posts']")).toBeVisible();
  await expect(page.locator(".post-preview-card:not(.post-preview-empty)")).toHaveCount(6);
  await expect(page.locator(".post-preview-card-wide")).toHaveCount(3);

  if (!isMobile) {
    await page.waitForTimeout(900);
    const bubble = await page.locator(".manifesto-bubble").boundingBox();
    const bubbleSpacing = await page.locator(".manifesto-bubble").evaluate((node) => {
      const bubbleBox = node.getBoundingClientRect();
      const markBox = node.querySelector(".manifesto-mark").getBoundingClientRect();
      const dialogueBox = node.querySelector(".manifesto-dialogue").getBoundingClientRect();
      return {
        top: Math.min(markBox.top, dialogueBox.top) - bubbleBox.top,
        bottom: bubbleBox.bottom - Math.max(markBox.bottom, dialogueBox.bottom),
      };
    });
    const phone = await page.locator(".iphone-shell").first().boundingBox();
    const cards = await page.locator(".post-preview-card:not(.post-preview-empty)").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    const phones = await page.locator(".game-device").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    expect(bubble.width).toBeLessThan(680);
    expect(bubble.height).toBeLessThan(320);
    expect(Math.max(bubbleSpacing.top, bubbleSpacing.bottom)).toBeLessThan(58);
    expect(Math.abs(bubbleSpacing.top - bubbleSpacing.bottom)).toBeLessThan(20);
    expect(phone.width).toBeGreaterThan(200);
    expect(Math.max(...cards.slice(0, 3).map((card) => card.y)) - Math.min(...cards.slice(0, 3).map((card) => card.y))).toBeLessThan(2);
    expect(cards[3].y).toBeGreaterThan(cards[0].y);
    expect(cards[3].width).toBeGreaterThan(cards[0].width * 2.5);
    expect(cards[3].height).toBeLessThan(210);
    expect(cards[4].y).toBeGreaterThan(cards[3].y);
    expect(cards[5].y).toBeGreaterThan(cards[4].y);
    for (const card of cards.slice(3)) {
      expect(card.width).toBeGreaterThan(cards[0].width * 2.5);
      expect(card.height).toBeLessThan(210);
    }
    expect(phones[1].left - phones[0].right).toBeLessThan(16);
    expect(await page.locator(".game-device").first().evaluate((node) => getComputedStyle(node).animationName)).toContain("studio-phone-float");
    expect(await page.locator(".manifesto-bubble").evaluate((node) => getComputedStyle(node).animationName)).toContain("studio-bubble-float");
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

test("primary navigation responds without colored hover chrome", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");
  await page.goto("/?lang=ko");
  for (const link of await page.locator(".site-nav > a").all()) {
    await link.hover();
    await page.waitForTimeout(220);
    const state = await link.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      transform: getComputedStyle(node).transform,
    }));
    expect(state.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(state.transform).not.toBe("none");
  }
});

test("blog index repeats the speech bubble and game previews", async ({ page }) => {
  await page.goto("/blog/kr/");
  await expect(page.locator(".mirror-manifesto .manifesto-bubble")).toBeVisible();
  await expect(page.locator(".mirror-manifesto .manifesto-bubble")).toContainText("만드는 과정을");
  await expect(page.locator(".mirror-manifesto [data-game-preview]")).toHaveCount(2);
});

test("editorial section numbers stay visible without taking over the layout", async ({ page }) => {
  await page.goto("/?lang=ko");
  const homeNumbers = await page.evaluate(() => ({
    games: getComputedStyle(document.querySelector(".device-stage"), "::before").content,
    blog: getComputedStyle(document.querySelector(".journal-section"), "::before").content,
  }));
  expect(homeNumbers).toEqual({ games: '"02 GAMES"', blog: '"01"' });

  await page.goto("/blog/kr/");
  const blogNumber = await page.locator(".mirror-grid").evaluate((node) => getComputedStyle(node, "::before").content);
  expect(blogNumber).toBe('"01 BLOG"');
});

test("the last three home journal rows show complete artwork in square frames", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator(".post-preview-card:not(.post-preview-empty)")).toHaveCount(6);
  const media = page.locator(".post-preview-card-wide .post-preview-media");
  await expect(media).toHaveCount(3);
  const frames = await media.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    const image = node.querySelector(".post-preview-image");
    return { width: box.width, height: box.height, objectFit: getComputedStyle(image).objectFit };
  }));
  for (const frame of frames) {
    expect(frame.objectFit).toBe("contain");
    if (!isMobile) expect(Math.abs(frame.width - frame.height)).toBeLessThan(2);
  }
});

test("the static Blog footer matches House Duck and exposes legal contact routes", async ({ page }) => {
  await page.goto("/blog/kr/");
  const footer = page.locator(".mirror-footer");
  await expect(footer.locator(".footer-brand-images")).toBeVisible();
  await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum/ko.html");
  await expect(footer.getByRole("link", { name: /business@houseduck\.in/ })).toHaveAttribute("href", "mailto:business@houseduck.in");
  await expect(footer).not.toHaveCSS("background-color", "rgb(9, 17, 31)");
});

test("journal cards gain depth on pointer focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");

  for (const target of [
    { path: "/?lang=ko", card: ".post-preview-card:not(.post-preview-empty)", image: ".post-preview-image", settle: 900 },
    { path: "/blog/kr/", card: ".mirror-grid article", image: "img", settle: 0 },
  ]) {
    await page.goto(target.path);
    await page.waitForTimeout(target.settle);
    const card = page.locator(target.card).first();
    await card.hover();
    await page.waitForTimeout(320);
    const state = await card.evaluate((node, imageSelector) => {
      const image = node.querySelector(imageSelector);
      return {
        border: getComputedStyle(node).borderColor,
        shadow: getComputedStyle(node).boxShadow,
        transform: getComputedStyle(node).transform,
        imageTransform: image ? getComputedStyle(image).transform : "none",
      };
    }, target.image);
    expect(state.shadow).not.toBe("none");
    expect(state.transform).not.toBe("none");
    expect(state.imageTransform).not.toBe("none");
    const channels = state.border.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    expect(Math.max(...channels) - Math.min(...channels)).toBeLessThan(26);
  }
});

test("YouTube Shorts keep their portrait ratio", async ({ page }) => {
  await page.goto("/blog/kr/내가-독일까지-와서-뜬금없이-개발을-시작하게-된-이유/");
  const frame = page.locator("iframe.video-portrait");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
});
