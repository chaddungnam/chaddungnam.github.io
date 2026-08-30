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
  "/terms/ko.html",
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

test("public pages stay light-only while mobile navigation remains accessible", async ({ page, isMobile }) => {
  await page.addInitScript(() => window.localStorage.setItem("house_duck_theme", "dark"));
  await page.goto("/index_en.html?lang=en");
  let menu;
  if (isMobile) {
    menu = page.locator("[data-menu-button]");
    await expect(menu).toHaveAccessibleName("Open menu");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toHaveAccessibleName("Close menu");
  }

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle], [data-legal-theme-toggle]")).toHaveCount(0);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f8f9fa");

  if (isMobile) {
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  }

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("every public surface ignores a stale dark preference", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("house_duck_theme", "dark"));
  for (const route of [
    "/?lang=ko",
    "/about/?lang=ko",
    "/quirky-ball/?lang=ko",
    "/project-k/?lang=ko",
    "/privacy/ko.html?stay=1",
    "/terms/ko.html",
    "/support/?lang=ko",
    "/blog/kr/",
  ]) {
    await page.goto(route);
    await expect(page.locator("html"), route).toHaveAttribute("data-theme", "light");
    await expect(page.locator("[data-theme-toggle], [data-legal-theme-toggle]"), route).toHaveCount(0);
  }
});

test("localized home pages preserve the published legal and support paths", async ({ page }) => {
  const contracts = [
    ["/?lang=ko", ["terms/ko.html", "privacy/ko.html", "impressum/ko.html", "support/"]],
    ["/index_en.html?lang=en", ["terms/en.html", "privacy/en.html", "impressum/en.html", "support/#english"]],
    ["/index_de.html?lang=de", ["terms/de.html", "privacy/de.html", "impressum/de.html", "support/#german"]],
    ["/index_ja.html?lang=ja", ["terms/ja.html", "privacy/ja.html", "impressum/ja.html", "support/#english"]],
  ];

  for (const [route, hrefs] of contracts) {
    await page.goto(route);
    await expect(page.locator(".site-footer .footer-links a")).toHaveCount(6);
    for (const href of hrefs) await expect(page.locator(`.site-footer a[href="${href}"]`), `${route} keeps ${href}`).toHaveCount(1);
  }
});

test("home opens on the released Quirky Ball specimen and real gameplay", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  const chamber = page.locator("[data-release-chamber]");
  const video = page.locator("[data-hero-gameplay]");

  await expect(chamber).toBeVisible();
  await expect(chamber).toContainText("Quirky Ball");
  await expect(chamber).toContainText("1.1.0");
  await expect(chamber).toContainText(/AIM.*SHOOT.*MERGE/);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node) => ({
    autoplay: node.autoplay,
    muted: node.muted,
    loop: node.loop,
    playsInline: node.playsInline,
  }))).toEqual({ autoplay: true, muted: true, loop: true, playsInline: true });
  const box = await video.boundingBox();
  expect(box.width).toBeGreaterThan(isMobile ? 200 : 300);
});

test("home reads as a game studio and keeps mascot and phone tops complete", async ({ page }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-studio-hero] h1")).toHaveText("Quirky Ball");
  await expect(page.locator("[data-studio-hero]")).toContainText("Are you ready?");
  await expect(page.locator("[data-studio-hero]")).toContainText("Houseduck.in");
  await expect(page.locator(".hero-description")).toContainText("기술과 속도의 강국 한국에서 온 인재가 품질의 나라 독일에서 소프트웨어를 만듭니다.");
  await expect(page.locator("[data-youtube-card]")).toHaveCount(3);
  await expect(page.locator("[data-project]")).toHaveCount(2);
  await expect(page.locator("[data-project='project-k']")).toContainText("출시 예정 미정");
  await expect(page.locator(".history-section, .journal-section")).toHaveCount(0);
  await expect(page.locator("[data-scroll-quirky]")).toHaveAttribute("src", /assets\/red-quirky\.svg/);
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  await expect(page.locator("[data-game-preview]")).toHaveCount(2);
  await expect(page.locator("[data-project] .phone-side-button")).toHaveCount(4);
  await expect(page.locator("[data-project] .phone-home-indicator")).toHaveCount(2);

  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThan(2);

  const firstFrame = Number(await page.locator("[data-quirky-canvas]").getAttribute("data-frame"));
  await page.waitForTimeout(180);
  expect(Number(await page.locator("[data-quirky-canvas]").getAttribute("data-frame"))).toBeGreaterThan(firstFrame);

  await page.locator(".youtube-section").scrollIntoViewIfNeeded();
  await expect(page.locator("html")).toHaveAttribute("data-scroll-tone", "#ffffff");
  await expect.poll(() => page.locator("[data-scroll-quirky]").evaluate((node) => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0);
  await page.locator('[data-project="quirky-ball"]').scrollIntoViewIfNeeded();
  await expect(page.locator("html")).toHaveAttribute("data-scroll-tone", "#dce6ff");

  const mascot = await page.locator("[data-scroll-quirky]").evaluate((node) => ({
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
    objectFit: getComputedStyle(node).objectFit,
  }));
  expect(mascot.naturalWidth).toBe(240);
  expect(mascot.naturalHeight).toBe(260);
  expect(mascot.objectFit).toBe("contain");

  const phoneGeometry = await page.locator("[data-project]").evaluateAll((cards) => cards.map((card) => {
    const phone = card.querySelector(".project-phone").getBoundingClientRect();
    const media = card.querySelector(".project-media").getBoundingClientRect();
    const overflow = [];
    for (let node = card; node; node = node.parentElement) overflow.push(getComputedStyle(node).overflowY);
    return { phoneTop: phone.top, mediaTop: media.top, overflow };
  }));
  for (const item of phoneGeometry) {
    expect(item.phoneTop).toBeLessThan(item.mediaTop);
    expect(item.overflow).not.toContain("hidden");
    expect(item.overflow).not.toContain("clip");
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

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

test("home keeps the hero heavy and the footer lockup compact", async ({ page }) => {
  await page.goto("/?lang=ko");
  const hero = page.locator("[data-studio-hero] h1");
  expect(Number(await hero.evaluate((node) => getComputedStyle(node).fontWeight))).toBeGreaterThanOrEqual(800);

  const footerSizes = await page.locator(".site-footer").evaluate((footer) => {
    const rect = (selector) => footer.querySelector(selector).getBoundingClientRect();
    const duck = rect(".brand-duck-image");
    const wordmark = rect(".footer-wordmark-image");
    return { duck: [duck.width, duck.height], wordmark: [wordmark.width, wordmark.height] };
  });
  expect(footerSizes.duck).toEqual([34, 34]);
  expect(footerSizes.wordmark[0]).toBe(116);
  expect(footerSizes.wordmark[1]).toBeLessThan(34);
});

test("home launch immediately moves marbles and builds a rapid shot burst", async ({ page }) => {
  await page.goto("/?lang=ko");
  const canvas = page.locator("[data-quirky-canvas]");
  await expect(canvas).toHaveAttribute("data-marble-state", /\d/);
  const initialState = await canvas.getAttribute("data-marble-state");
  await expect.poll(() => canvas.getAttribute("data-marble-state")).not.toBe(initialState);
  await expect.poll(async () => Number(await canvas.getAttribute("data-shot-count"))).toBeGreaterThanOrEqual(4);
});

test("home desktop removes the hero divider and turns the pointer into a Quirky shot", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch keeps the platform cursor behavior");
  await page.goto("/?lang=ko");
  await expect(page.locator(".mechanic-stage")).toHaveCSS("border-left-width", "0px");

  const cursor = page.locator("[data-game-cursor]");
  await expect(cursor).toHaveCount(1);
  await page.mouse.move(320, 220);
  await expect(cursor).toHaveCSS("opacity", "1");

  await page.mouse.click(320, 220);
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(1);
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(0, { timeout: 1000 });
});

test("home reduced motion holds the canvas and pauses phone video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-quirky-canvas]")).toHaveAttribute("data-frame", "1");
  await expect(page.locator("[data-game-cursor]")).toHaveCount(0);
  await page.waitForTimeout(180);
  await expect(page.locator("[data-quirky-canvas]")).toHaveAttribute("data-frame", "1");
  await expect.poll(() => page.locator("[data-game-preview]").evaluateAll((videos) => videos.map((video) => ({ autoplay: video.autoplay, paused: video.paused })))).toEqual([
    { autoplay: false, paused: true },
    { autoplay: false, paused: true },
  ]);
  await expect.poll(() => page.locator("[data-hero-gameplay]").evaluate((video) => ({ autoplay: video.autoplay, paused: video.paused }))).toEqual({ autoplay: false, paused: true });
});

test("primary navigation responds with a restrained text hover", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");
  await page.goto("/?lang=ko");
  for (const link of await page.locator(".site-nav > a").all()) {
    await link.hover();
    await page.waitForTimeout(220);
    const state = await link.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
      transform: getComputedStyle(node).transform,
    }));
    expect(state.background).toBe("rgba(0, 0, 0, 0)");
    expect(state.color).toBe("rgb(38, 101, 238)");
    expect(state.transform).toBe("none");
  }
});

test("blog index repeats the speech bubble and game previews", async ({ page }) => {
  await page.goto("/blog/kr/");
  await expect(page.locator(".mirror-manifesto .manifesto-bubble")).toBeVisible();
  await expect(page.locator(".mirror-manifesto .manifesto-bubble")).toContainText("House Duck's Blog,");
  await expect(page.locator(".mirror-manifesto .manifesto-action")).toHaveText(/메인 페이지 보러가기/);
  await expect(page.locator(".mirror-manifesto [data-game-preview]")).toHaveCount(2);
});

test("foreign House Duck pages keep readers in their selected Blog language", async ({ page }) => {
  for (const locale of ["en", "de", "ja"]) {
    await page.goto(`/index_${locale}.html?lang=${locale}`);
    await expect(page.locator(".nav-blog")).toHaveAttribute("href", `blog/${locale}/`);
    for (const route of [`/about/index_${locale}.html`, `/quirky-ball/index_${locale}.html`, `/project-k/index_${locale}.html`]) {
      await page.goto(route);
      await expect(page.locator("[data-site-nav] a", { hasText: "Blog" })).toHaveAttribute("href", `../blog/${locale}/`);
    }
  }
});

test("Quirky Ball presents the current build as a responsive candy-neon showcase", async ({ page, isMobile }) => {
  await page.addInitScript(() => window.localStorage.setItem("house_duck_theme", "dark"));
  await page.goto("/quirky-ball/?lang=ko");
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  if (isMobile) await page.locator("[data-menu-button]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f8f9fa");
  await expect(page.locator(".marble-rain .falling-marble")).toHaveCount(12);
  await expect(page.locator(".hero-device video")).toHaveCount(1);
  await expect(page.locator("[data-quirky-capture]")).toHaveCount(4);
  await expect(page.locator("main")).toContainText("쿼키");
  await expect(page.locator("main")).not.toContainText("조커");

  const playback = await page.locator(".hero-device video").evaluate((video) => ({
    autoplay: video.autoplay,
    muted: video.muted,
    loop: video.loop,
    playsInline: video.playsInline,
  }));
  expect(playback).toEqual({ autoplay: true, muted: true, loop: true, playsInline: true });

  const videoToggle = page.locator("[data-video-toggle]");
  await expect(videoToggle).toHaveAccessibleName(/영상 일시정지/);
  await videoToggle.click();
  await expect.poll(() => page.locator(".hero-device video").evaluate((video) => video.paused)).toBe(true);
  await expect(videoToggle).toHaveAccessibleName(/영상 재생/);
  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await page.locator(".game-hero").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await page.locator(".hero-device video").evaluate((video) => video.paused)).toBe(true);

  const chrome = await page.locator(".hero-device").evaluate((device) => ({
    overflow: getComputedStyle(device).overflow,
    quirkyWidth: parseFloat(getComputedStyle(document.querySelector(".hero-quirky")).width),
  }));
  expect(chrome.overflow).toBe("visible");
  expect(chrome.quirkyWidth).toBeLessThanOrEqual(116);

  const lightContrast = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    const parse = (value) => {
      const hex = value.trim().replace("#", "");
      return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    };
    const luminance = (rgb) => rgb.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const background = luminance(parse(style.getPropertyValue("--qb-bg")));
    return ["--qb-cyan-text", "--qb-yellow-text", "--qb-pink-text", "--qb-lime-text"].map((token) => {
      const foreground = luminance(parse(style.getPropertyValue(token)));
      return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
    });
  });
  expect(Math.min(...lightContrast)).toBeGreaterThanOrEqual(4.5);

  if (!isMobile) {
    const device = await page.locator(".hero-device").boundingBox();
    expect(device.width).toBeGreaterThan(260);
    await expect.poll(() => page.locator(".shot").evaluateAll((nodes) => new Set(nodes.map((node) => getComputedStyle(node).transform)).size)).toBeGreaterThan(2);
  }

  await page.goto("/?lang=ko");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
});

test("all Quirky Ball locales fit a narrow mobile viewport", async ({ page, isMobile }) => {
  if (!isMobile) return;
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ["/quirky-ball/?lang=ko", "/quirky-ball/index_en.html?lang=en", "/quirky-ball/index_de.html?lang=de", "/quirky-ball/index_ja.html?lang=ja"]) {
    await page.goto(route);
    const overflowing = await page.locator(".game-hero-copy").evaluate((copy) => [...copy.querySelectorAll("h1, p, span, a")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return node.scrollWidth > node.clientWidth + 1 || rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((node) => ({ text: node.textContent.trim(), clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, rect: node.getBoundingClientRect().toJSON() })));
    expect(overflowing, `${route} must not clip localized hero copy`).toEqual([]);
  }
});

test("Quirky Ball motion reduction removes the marble intro and pauses the loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/quirky-ball/?lang=ko");
  await expect(page.locator(".marble-rain")).toHaveCSS("display", "none");
  await expect.poll(() => page.locator(".hero-device video").evaluate((video) => ({ autoplay: video.autoplay, paused: video.paused }))).toEqual({ autoplay: false, paused: true });
});

test("the Blog keeps its editorial section number", async ({ page }) => {
  await page.goto("/blog/kr/");
  const blogNumber = await page.locator(".mirror-grid").evaluate((node) => getComputedStyle(node, "::before").content);
  expect(blogNumber).toBe('"01 BLOG"');
});

test("the static Blog footer matches House Duck and exposes legal contact routes", async ({ page }) => {
  await page.goto("/blog/kr/");
  const footer = page.locator(".mirror-footer");
  await expect(footer.locator(".footer-brand-images")).toBeVisible();
  await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum/ko.html");
  const businessLink = footer.getByRole("link", { name: /business@houseduck\.in/ });
  await expect(businessLink).toHaveAttribute("href", "mailto:business@houseduck.in");
  await expect(businessLink).toHaveCSS("text-transform", "none");
  await expect(footer.getByRole("link", { name: /business@houseduck\.in/ })).toHaveText(/business@houseduck\.in/);
  await expect(footer).not.toHaveCSS("background-color", "rgb(9, 17, 31)");
});

test("journal cards gain depth on pointer focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");

  for (const target of [
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

test("journal cards stay fully visible and type their previews quickly", async ({ page }) => {
  await page.goto("/blog/kr/");
  const lastMirrorCard = page.locator(".mirror-grid article").last();
  expect(await lastMirrorCard.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  await lastMirrorCard.scrollIntoViewIfNeeded();
  await expect(lastMirrorCard.locator("[data-preview-type][data-typed='true']")).toHaveCount(2, { timeout: 4000 });
});

test("Tistory semantic categories rename the root and keep subcategories expanded", async ({ page }) => {
  await page.setContent(`<!doctype html><html><body id="tt-body-index">
    <nav data-category-list><ul class="tt_category"><li><a class="link_tit" href="/category">분류 전체보기 <span class="c_cnt">(8)</span></a><ul class="category_list"><li><a class="link_item" href="/category/Mobile%20Game%20Dev.">Mobile Game Dev. <span class="c_cnt">(5)</span></a><ul class="sub_category_list"><li><a class="link_sub_item" href="/category/Mobile%20Game%20Dev./Quirky%20Ball">Quirky Ball <span class="c_cnt">(4)</span></a></li></ul></li></ul></li></ul></nav>
    <nav data-category-list><ul class="tt_category"><li><a class="link_tit" href="/category">분류 전체보기 <span class="c_cnt">(8)</span></a><ul class="category_list"><li><a class="link_item" href="/category/Mobile%20Game%20Dev.">Mobile Game Dev. <span class="c_cnt">(5)</span></a><ul class="sub_category_list"><li><a class="link_sub_item" href="/category/Mobile%20Game%20Dev./Quirky%20Ball">Quirky Ball <span class="c_cnt">(4)</span></a></li></ul></li></ul></li></ul></nav>
  </body></html>`);
  await page.addScriptTag({ url: "http://127.0.0.1:4173/tistory-skin/images/script.js" });

  await expect(page.locator("[data-category-list] .link_tit")).toHaveCount(2);
  await expect(page.locator("[data-category-list] .link_tit").first()).toContainText("전체 글");
  await expect(page.locator("[data-category-list] .link_tit").first()).not.toContainText("분류 전체보기");
  await expect(page.locator("[data-category-list] .sub_category_list").first()).toBeVisible();
  await expect(page.locator("[data-category-list]").first().getByRole("link", { name: /Quirky Ball/ })).toBeVisible();
});

test("YouTube Shorts keep their portrait ratio", async ({ page }) => {
  await page.goto("/blog/kr/내가-독일까지-와서-뜬금없이-개발을-시작하게-된-이유/");
  const frame = page.locator("iframe.video-portrait");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
});
