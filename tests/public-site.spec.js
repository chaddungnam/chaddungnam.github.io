const { test, expect } = require("@playwright/test");

const routes = [
  "/?lang=ko",
  "/index_en.html?lang=en",
  "/index_de.html?lang=de",
  "/index_ja.html?lang=ja",
  "/about/?lang=ko",
  "/about/index_en.html?lang=en",
  "/quirky-ball/?lang=ko",
  "/hexaworld1984/index_en.html?lang=en",
  "/privacy/?stay=1",
  "/terms/ko.html",
  "/support/?lang=en",
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
    "/hexaworld1984/index_ko.html?lang=ko",
    "/privacy/ko.html?stay=1",
    "/terms/ko.html",
    "/support/?lang=ko",
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
    expect(await page.locator(".site-footer .footer-links a").count(), `${route} footer links`).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) await expect(page.locator(`.site-footer a[href="${href}"]`), `${route} keeps ${href}`).toHaveCount(1);
    await expect(page.locator(".site-footer a[href^=\"about/\"]"), `${route} footer links About`).toHaveCount(1);
    await expect(page.locator(".site-nav a[href^=\"about/\"]"), `${route} header links About`).toHaveCount(1);
  }
});

test("all localized home pages fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const route of ["/?lang=ko", "/index_en.html?lang=en", "/index_de.html?lang=de", "/index_ja.html?lang=ja"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
});

test("home opens on the 10key Survival hero and its real gameplay loop", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  const chamber = page.locator("[data-release-chamber]");
  const video = page.locator("[data-hero-gameplay]");

  await expect(chamber).toBeVisible();
  await expect(chamber).toContainText("딸깍 서바이벌");
  await expect(chamber).toContainText("10key Survival");
  await expect(chamber).toContainText("출시 준비 중");
  await expect(chamber).toContainText(/DIG DOWN.*LEVEL UP.*SURVIVE/);
  await expect(chamber).not.toContainText("Quirky");
  await expect(page.locator(".studio-hero .release-actions a")).toHaveCount(1);
  await expect(page.locator(".studio-hero .release-actions a")).toHaveAttribute("href", "10key/");
  await expect(page.locator(".studio-hero .google-play-badge, .studio-hero .app-store-badge")).toHaveCount(0);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node) => ({
    autoplay: node.autoplay,
    muted: node.muted,
    loop: node.loop,
    playsInline: node.playsInline,
  }))).toEqual({ autoplay: true, muted: true, loop: true, playsInline: true });
  const box = await video.boundingBox();
  expect(box.width).toBeGreaterThan(isMobile ? 200 : 300);
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
  await expect.poll(() => video.evaluate((node) => node.currentTime)).toBeGreaterThan(0);
});

test("home reads as a game studio and keeps phone tops complete", async ({ page }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-studio-hero] h1")).toContainText("딸깍 서바이벌");
  await expect(page.locator("[data-studio-hero] .release-title-alt")).toHaveText("10key Survival");
  await expect(page.locator("[data-studio-hero] .release-lede")).toHaveText("살아 있는 텐키(숫자 키패드)가 되어 끝없는 3D 키보드를 파고 내려가세요. 키를 부수고, 레벨업마다 새 스킬을 고르고, 마우스에게서 살아남으세요.");
  await expect(page.locator("[data-youtube-card]")).toHaveCount(3);
  await expect(page.locator("[data-project]")).toHaveCount(2);
  await expect(page.locator("[data-project='tenkey-survival']")).toContainText("출시 준비 중");
  await expect(page.locator("[data-project='quirky-ball']")).toContainText("Quirky Ball");
  await expect(page.locator("[data-project='hexaworld1984'], [data-hexaworld-preview]")).toHaveCount(0);
  await expect(page.locator(".history-section, .journal-section")).toHaveCount(0);
  await expect(page.locator("[data-scroll-quirky], [data-quirky-canvas], .hero-quirky")).toHaveCount(0);
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  await expect(page.locator("[data-game-preview]")).toHaveCount(1);
  await expect(page.locator("[data-project] .phone-side-button")).toHaveCount(4);
  await expect(page.locator("[data-project] .phone-home-indicator")).toHaveCount(2);

  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThan(2);

  await page.locator(".youtube-section").scrollIntoViewIfNeeded();
  await expect(page.locator("html")).toHaveAttribute("data-scroll-tone", "#ffffff");
  await page.locator('[data-project="quirky-ball"]').scrollIntoViewIfNeeded();
  await expect(page.locator("html")).toHaveAttribute("data-scroll-tone", "#dce6ff");
  await page.locator('[data-project="tenkey-survival"]').scrollIntoViewIfNeeded();
  await expect(page.locator(".section-rail a[aria-current='location']")).toHaveAttribute("href", "#games");

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
    preload: video.preload,
  })));
  expect(state).toEqual([
    { autoplay: false, muted: true, loop: true, playsInline: true, preload: "none" },
  ]);

  const quirkyVideo = page.locator("[data-game-preview]").first();
  await quirkyVideo.scrollIntoViewIfNeeded();
  await expect.poll(() => quirkyVideo.evaluate((video) => video.paused)).toBe(false);
});

test("10key Survival zone shows real gameplay in the shared phone and the quiet Comrade farewell closes the page", async ({ page }) => {
  const farewell = [
    ["/?lang=ko", "동무와 멋진신세계", "다른 장르의 게임에서 만나요"],
    ["/index_en.html?lang=en", "Comrade and the Brave New World", "See you in a game of another genre"],
    ["/index_de.html?lang=de", "Genosse und die schöne neue Welt", "Wir sehen uns in einem Spiel eines anderen Genres"],
    ["/index_ja.html?lang=ja", "Comrade and the Brave New World", "別のジャンルのゲームでまた会いましょう"],
  ];
  for (const [route, name, line] of farewell) {
    await page.goto(route);
    const zone = page.locator("[data-project='tenkey-survival']");
    await zone.scrollIntoViewIfNeeded();
    const image = zone.locator(".project-phone img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(zone.locator("a[href='10key/']")).toHaveCount(2);
    await expect(zone.locator(".project-copy h2")).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await zone.locator("a[href*='play.google.com'], a[href*='apps.apple.com']").count(), `${route} no store links before release`).toBe(0);

    const block = page.locator(".home-farewell");
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator(".farewell-name")).toHaveText(name);
    await expect(block.locator(".farewell-line")).toHaveText(line);
    await expect(block.locator("a")).toHaveCount(0);
    await expect(block).not.toContainText(/개발 중|In development|In Entwicklung|開発中/);
    const order = await page.evaluate(() => {
      const top = (selector) => document.querySelector(selector).getBoundingClientRect().top + scrollY;
      return [top("#player-support"), top(".home-farewell"), top(".site-footer")];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  }
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

test("home replaces its YouTube fallback with the synced feed", async ({ page }) => {
  const videos = [
    { videoId: "bOUGPw5Iih4", title: "SYNCED VIDEO ONE" },
    { videoId: "l_t2G09Zye4", title: "SYNCED VIDEO TWO" },
    { videoId: "uHgzc85Fb2k", title: "SYNCED VIDEO THREE" },
  ];
  await page.route("**/assets/youtube-feed.json", (route) => route.fulfill({ json: { videos } }));
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-youtube-feed] strong")).toHaveText(videos.map((video) => video.title));
  expect(await page.locator("[data-youtube-feed] a").evaluateAll((links) => links.map((link) => link.href))).toEqual(
    videos.map((video) => `https://www.youtube.com/watch?v=${video.videoId}`),
  );
});

test("home desktop keeps the normal cursor over the 10key Survival hero", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch keeps the platform cursor behavior");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  await expect(page.locator("[data-game-cursor]")).toHaveCount(0);
  const visual = await page.locator(".release-visual").boundingBox();
  await page.mouse.move(visual.x + 12, visual.y + visual.height / 2);
  await page.mouse.click(visual.x + 12, visual.y + visual.height / 2);
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(0);
  await expect(page.locator(".release-visual")).not.toHaveCSS("cursor", "none");
});

test("home reduced motion pauses the phone videos and hides motion extras", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-game-cursor]")).toHaveCount(0);
  await expect(page.locator("[data-motion-toggle]")).toBeHidden();
  await page.locator("[data-youtube-feed]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  await expect.poll(() => page.locator("[data-game-preview]").evaluateAll((videos) => videos.map((video) => ({ autoplay: video.autoplay, paused: video.paused })))).toEqual([
    { autoplay: false, paused: true },
  ]);
  await expect.poll(() => page.locator("[data-hero-gameplay]").evaluate((video) => ({ autoplay: video.autoplay, paused: video.paused }))).toEqual({ autoplay: false, paused: true });
});

test("home shows the console min_version and keeps 2.0.0 when the lookup fails", async ({ page }) => {
  await page.route("**/functions/v1/public-version", (route) => route.fulfill({ json: { min_version: "1.2.3" } }));
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-live-version]").first()).toHaveText("1.2.3");
  await expect(page.locator("[data-live-version]")).toHaveText(["1.2.3"]);
  await expect(page.locator("[data-project='quirky-ball'] [data-live-version]")).toHaveText("1.2.3");

  await page.route("**/functions/v1/public-version", (route) => route.abort());
  await page.reload();
  await expect(page.locator("[data-live-version]").first()).toHaveText("2.0.0");
});

test("localized homes place the 10key Survival phone before the readout at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/?lang=ko", "/index_en.html?lang=en", "/index_de.html?lang=de", "/index_ja.html?lang=ja"]) {
    await page.goto(route);
    await page.waitForTimeout(650);
    const layout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const title = rect(".release-heading h1");
      const phone = rect(".hero-phone .iphone-shell");
      const readout = rect(".release-readout");
      const bodyFonts = [".release-lede", ".project-copy > p:not(.eyebrow):not(.project-display):not(.project-keywords):not(.project-status)"]
        .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => parseFloat(getComputedStyle(node).fontSize)));
      const controlHeights = [...document.querySelectorAll(".studio-hero .release-button, [data-motion-toggle]")]
        .filter((node) => getComputedStyle(node).display !== "none")
        .map((node) => node.getBoundingClientRect().height);
      const support = rect(".home-support");
      const farewell = rect(".home-farewell");
      const footer = rect(".site-footer");
      const heroCopy = [...document.querySelectorAll(".studio-hero .release-copy *")].filter((node) => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== "inline").map((node) => node.className || node.tagName);
      return {
        titleBottom: title.bottom,
        phone: { top: phone.top + scrollY, left: phone.left + scrollX, width: phone.width, height: phone.height, bottom: phone.bottom + scrollY },
        readout: { top: readout.top + scrollY, bottom: readout.bottom + scrollY },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyFonts,
        controlHeights,
        afterSupport: farewell.top - support.bottom,
        afterFarewell: footer.top - farewell.bottom,
        supportHeight: support.height,
        heroCopy,
        cacheAssets: [...document.querySelectorAll('link[href*="studio-home.css"], script[src*="studio-home.js"]')].map((node) => node.href || node.src),
      };
    });
    expect(layout.phone.top).toBeGreaterThanOrEqual(layout.titleBottom - 1);
    expect(layout.phone.top).toBeLessThan(1100);
    expect(layout.readout.top).toBeGreaterThanOrEqual(layout.phone.bottom - 1);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.heroCopy, `${route} hero copy is not clipped`).toEqual([]);
    expect(layout.bodyFonts).not.toHaveLength(0);
    expect(Math.min(...layout.bodyFonts)).toBeGreaterThanOrEqual(16);
    expect(layout.controlHeights).not.toHaveLength(0);
    expect(Math.min(...layout.controlHeights)).toBeGreaterThanOrEqual(44);
    expect(layout.supportHeight).toBeGreaterThan(0);
    expect(layout.afterSupport).toBeGreaterThanOrEqual(0);
    expect(layout.afterSupport).toBeLessThanOrEqual(8);
    expect(layout.afterFarewell).toBeGreaterThanOrEqual(0);
    expect(layout.afterFarewell).toBeLessThanOrEqual(8);
    expect(layout.cacheAssets).toHaveLength(2);
    expect(layout.cacheAssets.some((asset) => {
      const url = new URL(asset);
      return url.pathname.endsWith("/assets/studio-home.css") && url.search.length > 1;
    })).toBeTruthy();
    expect(layout.cacheAssets.some((asset) => {
      const url = new URL(asset);
      return url.pathname.endsWith("/assets/studio-home.js") && url.search.length > 1;
    })).toBeTruthy();
  }
});

test("hero entrance is one-shot and reduced motion is immediately settled", async ({ page }) => {
  await page.goto("/?lang=ko");
  const entrance = await page.locator("[data-studio-hero]").evaluate((hero) => hero.getAnimations({ subtree: true }).map((animation) => animation.effect.getTiming()));
  expect(entrance.length).toBeGreaterThanOrEqual(2);
  for (const timing of entrance) {
    expect(timing.iterations).toBe(1);
    expect(timing.duration).toBeGreaterThanOrEqual(360);
    expect(timing.duration).toBeLessThanOrEqual(520);
  }
  await page.waitForTimeout(650);
  expect(await page.locator("[data-studio-hero]").evaluate((hero) => hero.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length)).toBe(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await page.locator("[data-studio-hero]").evaluate((hero) => hero.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.locator(".release-heading").evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  expect(await page.locator(".release-visual").evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
});

test("home carries no Quirky Ball playable demo and requests no game files", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/play/")) requests.push(request.url());
  });
  await page.goto("/?lang=ko");
  await page.waitForTimeout(400);
  await expect(page.locator("[data-playable-phone], [data-playable-launch], iframe")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("home lets visitors pause and resume automatic FX", async ({ page }) => {
  await page.goto("/?lang=ko");
  const toggle = page.locator("[data-motion-toggle]");
  const video = page.locator("[data-hero-gameplay]");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
});

test("primary navigation uses a high-contrast yellow hover without motion", async ({ page, isMobile }) => {
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
    expect(state.background).toBe("rgb(255, 210, 31)");
    expect(state.color).toBe("rgb(16, 24, 39)");
    expect(state.transform).toBe("none");
  }
});

test("Quirky Ball 2.0 uses the home components with the vertical gameplay loop, store links and real screens", async ({ page, isMobile }) => {
  await page.addInitScript(() => window.localStorage.setItem("house_duck_theme", "dark"));
  await page.goto("/quirky-ball/?lang=ko");
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f8f9fa");
  await expect(page.locator(".hero-device video")).toHaveCount(1);
  await expect(page.locator("[data-quirky-capture]")).toHaveCount(10);
  await expect(page.locator(".qb-screen .iphone-shell")).toHaveCount(8);
  await expect(page.locator("main")).toContainText("쿼키");
  await expect(page.locator("main")).not.toContainText("조커");
  await expect(page.locator(".studio-hero .google-play-badge")).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.quirkyball.app");
  await expect(page.locator(".studio-hero .app-store-badge")).toHaveAttribute("href", "https://apps.apple.com/app/id6797996754");
  // Same header colors as the House Duck home.
  expect(await page.locator(".site-header").evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(17, 20, 25, 0.97)");

  const video = page.locator(".hero-device video");
  const playback = await video.evaluate((node) => ({ autoplay: node.autoplay, muted: node.muted, loop: node.loop, playsInline: node.playsInline }));
  expect(playback).toEqual({ autoplay: true, muted: true, loop: true, playsInline: true });
  await expect.poll(() => video.evaluate((node) => !node.paused && node.currentTime > 0)).toBe(true);

  const videoToggle = page.locator("[data-video-toggle]");
  await expect(videoToggle).toHaveAccessibleName(/영상 일시정지/);
  await videoToggle.click();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(true);
  await expect(videoToggle).toHaveAccessibleName(/영상 재생/);
  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await page.locator(".studio-hero").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await video.evaluate((node) => node.paused)).toBe(true);
  expect(await page.locator(".hero-device").evaluate((device) => getComputedStyle(device).overflow)).toBe("visible");

  if (!isMobile) {
    const phone = await page.locator(".hero-device .iphone-shell").boundingBox();
    expect(phone.width).toBeGreaterThan(260);
  }

  // Nothing loads from YouTube until the trailer card is pressed.
  await expect(page.locator("#trailer iframe")).toHaveCount(0);
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title>" }));
  await page.locator("[data-qb-youtube]").click();
  await expect(page.locator("#trailer iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/rnksH-UdAAc/);

  await page.goto("/?lang=ko");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-theme-toggle]")).toHaveCount(0);
});

test("all Quirky Ball locales fit a narrow mobile viewport", async ({ page, isMobile }) => {
  if (!isMobile) return;
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ["/quirky-ball/?lang=ko", "/quirky-ball/index_en.html?lang=en", "/quirky-ball/index_de.html?lang=de", "/quirky-ball/index_ja.html?lang=ja"]) {
    await page.goto(route);
    const overflowing = await page.locator(".release-copy").evaluate((copy) => [...copy.querySelectorAll("h1, p, span, a")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return node.scrollWidth > node.clientWidth + 1 || rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((node) => ({ text: node.textContent.trim(), clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, rect: node.getBoundingClientRect().toJSON() })));
    expect(overflowing, `${route} must not clip localized hero copy`).toEqual([]);
  }
});

test("all Quirky Ball locales keep a 320px viewport free of horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ["/quirky-ball/?lang=ko", "/quirky-ball/index_en.html?lang=en", "/quirky-ball/index_de.html?lang=de", "/quirky-ball/index_ja.html?lang=ja"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(320);
  }
});

test("Quirky Ball zone keeps custom light localized Play badges next to its copy", async ({ page }) => {
  for (const [route, lang] of [["/?lang=ko", "ko"], ["/index_en.html?lang=en", "en"], ["/index_de.html?lang=de", "de"], ["/index_ja.html?lang=ja", "ja"]]) {
    await page.goto(route);
    const zone = page.locator('[data-project="quirky-ball"]');
    await zone.scrollIntoViewIfNeeded();
    await expect(page.locator(".hero-hook, .studio-signature")).toHaveCount(0);
    await expect(zone.locator(".release-actions a")).toHaveCount(2);
    await expect(zone.locator(".app-store-badge")).not.toHaveAttribute("aria-disabled", "true");
    await expect(zone.locator(".app-store-badge")).toHaveAttribute("href", "https://apps.apple.com/app/id6797996754");
    await expect(page.locator(".coming-soon-bubble")).toHaveCount(0);
    const badge = zone.locator(".google-play-badge");
    await expect(badge).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.quirkyball.app");
    await expect(badge.locator("img")).toHaveAttribute("src", "assets/store-badges/google-play-" + lang + "-light.svg");
    await expect(badge.locator("img")).toBeVisible();
    const metrics = await badge.evaluate(node => {
      const img = node.querySelector("img");
      const style = getComputedStyle(node);
      const copy = node.closest(".project-copy");
      return { loaded: img.complete && img.naturalWidth > 0, height: img.getBoundingClientRect().height, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(parseFloat), left: img.getBoundingClientRect().left, aboveLeft: copy.querySelector("h2").getBoundingClientRect().left, belowLeft: copy.querySelector(".store-disclosure").getBoundingClientRect().left };
    });
    expect(metrics.loaded).toBe(true);
    expect(Math.abs(metrics.left - metrics.aboveLeft)).toBeLessThan(1);
    expect(Math.abs(metrics.left - metrics.belowLeft)).toBeLessThan(1);
    expect(metrics.height).toBeGreaterThanOrEqual(28);
    expect(Math.min(...metrics.padding)).toBeGreaterThanOrEqual(metrics.height / 4);
  }
});
