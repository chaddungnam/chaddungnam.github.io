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

test("all localized home pages fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const route of ["/?lang=ko", "/index_en.html?lang=en", "/index_de.html?lang=de", "/index_ja.html?lang=ja"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
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
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
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
  await expect.poll(async () => Number(await page.locator("[data-quirky-canvas]").getAttribute("data-frame"))).toBeGreaterThan(firstFrame);

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
    preload: video.preload,
  })));
  expect(state).toEqual([
    { autoplay: false, muted: true, loop: true, playsInline: true, preload: "none" },
    { autoplay: false, muted: true, loop: true, playsInline: true, preload: "none" },
  ]);

  const firstProjectVideo = page.locator("[data-game-preview]").first();
  await firstProjectVideo.scrollIntoViewIfNeeded();
  await expect.poll(() => firstProjectVideo.evaluate((video) => video.paused)).toBe(false);
  const secondProjectVideo = page.locator("[data-game-preview]").nth(1);
  await secondProjectVideo.scrollIntoViewIfNeeded();
  await expect.poll(() => secondProjectVideo.evaluate((video) => video.paused)).toBe(false);
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

test("home desktop scopes the Quirky cursor and impact to hero decoration", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch keeps the platform cursor behavior");
  await stubPlayable(page);
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  await expect(page.locator(".mechanic-stage")).toHaveCSS("border-left-width", "0px");

  const phoneTop = () => page.locator(".hero-phone .iphone-shell").evaluate((node) => node.getBoundingClientRect().top + scrollY);
  await page.mouse.move(0, 0);
  const restingTop = await phoneTop();
  await page.locator("[data-playable-launch]").hover();
  await page.waitForTimeout(240);
  const liftedTop = await phoneTop();
  expect(restingTop - liftedTop).toBeGreaterThanOrEqual(2);
  expect(restingTop - liftedTop).toBeLessThanOrEqual(3.1);
  await page.locator("[data-playable-launch]").click();
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", "ready");
  expect(Math.abs(await phoneTop() - restingTop)).toBeLessThanOrEqual(1);
  await expect(page.locator("[data-playable-phone] iframe")).not.toHaveCSS("cursor", "none");
  await page.locator("[data-playable-exit]").click();

  const cursor = page.locator("[data-game-cursor]");
  await expect(cursor).toHaveCount(1);
  const visual = await page.locator(".release-visual").boundingBox();
  await page.mouse.move(visual.x + 12, visual.y + visual.height / 2);
  await expect(cursor).toHaveCSS("opacity", "1");

  await page.addStyleTag({ content: ".cursor-impact { animation-duration: 1200ms !important; }" });
  await page.mouse.click(visual.x + 12, visual.y + visual.height / 2);
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(1);
  await page.locator(".site-nav a").first().hover();
  await expect(cursor).toHaveCSS("opacity", "0");
  await expect(page.locator(".site-nav a").first()).not.toHaveCSS("cursor", "none");
  await page.locator("[data-motion-toggle]").click();
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(1);
  await expect(page.locator("[data-motion-toggle]")).not.toHaveCSS("cursor", "none");
});

test("home reduced motion holds the canvas and pauses phone video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=ko");
  await expect(page.locator("[data-quirky-canvas]")).toHaveAttribute("data-frame", "1");
  await expect(page.locator("[data-game-cursor]")).toHaveCount(0);
  await expect(page.locator("[data-motion-toggle]")).toBeHidden();
  const mascot = page.locator("[data-scroll-quirky]");
  await expect(mascot).toBeHidden();
  await page.locator("[data-youtube-feed]").scrollIntoViewIfNeeded();
  await expect(mascot).toBeHidden();
  await page.waitForTimeout(180);
  await expect(page.locator("[data-quirky-canvas]")).toHaveAttribute("data-frame", "1");
  await expect.poll(() => page.locator("[data-game-preview]").evaluateAll((videos) => videos.map((video) => ({ autoplay: video.autoplay, paused: video.paused })))).toEqual([
    { autoplay: false, paused: true },
    { autoplay: false, paused: true },
  ]);
  await expect.poll(() => page.locator("[data-hero-gameplay]").evaluate((video) => ({ autoplay: video.autoplay, paused: video.paused }))).toEqual({ autoplay: false, paused: true });
});

async function stubPlayable(page, { ready = true } = {}) {
  const requests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/play/quirky-ball")) requests.push(request.url());
  });
  await page.route("**/play/quirky-ball-site/index.html", (route) => route.fulfill({
    contentType: "text/html",
    body: ready ? `<script>
      setTimeout(() => window.__quirkyBallPlayablesFirstFrameReady = true, 20);
      setTimeout(() => window.__quirkyBallPlayablesGameReady = true, 40);
    </script>` : "<!doctype html><title>waiting</title>",
  }));
  return requests;
}

test("localized homes place a stable playable phone before supporting copy at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPlayable(page);
  for (const route of ["/?lang=ko", "/index_en.html?lang=en", "/index_de.html?lang=de", "/index_ja.html?lang=ja"]) {
    await page.goto(route);
    await page.waitForTimeout(650);
    const layout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const title = rect(".release-heading h1");
      const phone = rect(".hero-phone .iphone-shell");
      const readout = rect(".release-readout");
      const signature = rect(".studio-signature");
      const bodyFonts = [".release-lede", ".hero-description", ".project-copy > p:not(.eyebrow):not(.project-display):not(.project-keywords):not(.project-status)"]
        .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => parseFloat(getComputedStyle(node).fontSize)));
      const controlHeights = [...document.querySelectorAll(".release-button, [data-playable-launch], [data-motion-toggle]")]
        .filter((node) => getComputedStyle(node).display !== "none")
        .map((node) => node.getBoundingClientRect().height);
      const projectCard = document.querySelector('[data-project="project-k"] .project-card').getBoundingClientRect();
      const footer = rect(".site-footer");
      return {
        titleBottom: title.bottom,
        phone: { top: phone.top + scrollY, left: phone.left + scrollX, width: phone.width, height: phone.height, bottom: phone.bottom + scrollY },
        readout: { top: readout.top + scrollY, bottom: readout.bottom + scrollY },
        signatureTop: signature.top + scrollY,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyFonts,
        controlHeights,
        afterProjectK: footer.top - projectCard.bottom,
        cacheAssets: [...document.querySelectorAll('link[href*="studio-home.css"], script[src*="studio-home.js"]')].map((node) => node.href || node.src),
      };
    });
    expect(layout.phone.top).toBeGreaterThanOrEqual(layout.titleBottom - 1);
    expect(layout.phone.top).toBeLessThan(844);
    expect(layout.readout.top).toBeGreaterThanOrEqual(layout.phone.bottom - 1);
    expect(layout.signatureTop).toBeGreaterThanOrEqual(layout.readout.bottom - 1);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.bodyFonts).not.toHaveLength(0);
    expect(Math.min(...layout.bodyFonts)).toBeGreaterThanOrEqual(16);
    expect(layout.controlHeights).not.toHaveLength(0);
    expect(Math.min(...layout.controlHeights)).toBeGreaterThanOrEqual(44);
    expect(layout.afterProjectK).toBeLessThanOrEqual(72);
    expect(layout.cacheAssets).toHaveLength(2);
    expect(layout.cacheAssets.some((asset) => asset.includes("studio-home.css?v=20260904-hero"))).toBeTruthy();
    expect(layout.cacheAssets.some((asset) => asset.includes("studio-home.js?v=20260831-playable"))).toBeTruthy();

    const geometry = async () => page.locator(".hero-phone .iphone-shell").evaluate((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top + scrollY, left: box.left + scrollX, width: box.width, height: box.height };
    });
    const idle = await geometry();
    await page.locator("[data-playable-launch]").click();
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", /^(loading|ready)$/);
    const exitBox = await page.locator("[data-playable-exit]").boundingBox();
    expect(exitBox, `${route} EXIT is visible after PLAY`).not.toBeNull();
    expect(exitBox.height, `${route} EXIT is at least 44px tall`).toBeGreaterThanOrEqual(44);
    const loading = await geometry();
    await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", "ready");
    const ready = await geometry();
    for (const state of [loading, ready]) {
      for (const key of ["top", "left", "width", "height"]) expect(Math.abs(state[key] - idle[key]), `${route} ${key} stays stable`).toBeLessThanOrEqual(1);
    }
    await page.locator("[data-playable-exit]").click();
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

test("hero canvas cancels frames while inactive and resumes without catch-up shots", async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set();
    let cancelled = 0;
    window.requestAnimationFrame = (callback) => {
      let id;
      id = request((time) => { pending.delete(id); callback(time); });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => { if (pending.delete(id)) cancelled += 1; cancel(id); };
    window.__rafAudit = { get pending() { return pending.size; }, get cancelled() { return cancelled; } };
    let forcedHidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => forcedHidden });
    window.__setDocumentHidden = (hidden) => { forcedHidden = hidden; document.dispatchEvent(new Event("visibilitychange")); };
  });
  await stubPlayable(page);
  await page.goto("/?lang=ko");
  const canvas = page.locator("[data-quirky-canvas]");
  await expect.poll(async () => Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(1);

  await page.locator("[data-youtube-feed]").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.__rafAudit.pending)).toBe(0);
  const offscreenFrame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(120);
  await expect(canvas).toHaveAttribute("data-frame", offscreenFrame);
  expect(await page.evaluate(() => window.__rafAudit.cancelled)).toBeGreaterThan(0);

  const shotsBeforeResume = Number(await canvas.getAttribute("data-shot-spawn-count"));
  await canvas.evaluate((node) => {
    const frame = node.dataset.frame;
    window.__firstResumeShotCount = new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (node.dataset.frame === frame) return;
        observer.disconnect();
        resolve(Number(node.dataset.shotSpawnCount));
      });
      observer.observe(node, { attributes: true, attributeFilter: ["data-frame"] });
    });
  });
  await page.locator("[data-studio-hero]").scrollIntoViewIfNeeded();
  const shotsAtFirstResumedFrame = await page.evaluate(() => window.__firstResumeShotCount);
  expect(shotsAtFirstResumedFrame - shotsBeforeResume).toBeLessThanOrEqual(2);

  await page.locator("[data-motion-toggle]").click();
  const pausedFrame = await canvas.getAttribute("data-frame");
  await expect.poll(() => page.evaluate(() => window.__rafAudit.pending)).toBe(0);
  await page.waitForTimeout(120);
  await expect(canvas).toHaveAttribute("data-frame", pausedFrame);

  await page.locator("[data-motion-toggle]").click();
  await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe(pausedFrame);
  await page.locator("[data-playable-launch]").click();
  await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", "ready");
  await expect.poll(() => page.evaluate(() => window.__rafAudit.pending)).toBe(0);
  const playingFrame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(120);
  await expect(canvas).toHaveAttribute("data-frame", playingFrame);

  await page.locator("[data-playable-exit]").click();
  await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe(playingFrame);
  await page.evaluate(() => window.__setDocumentHidden(true));
  await expect.poll(() => page.evaluate(() => window.__rafAudit.pending)).toBe(0);
  const hiddenFrame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(120);
  await expect(canvas).toHaveAttribute("data-frame", hiddenFrame);
  await page.evaluate(() => window.__setDocumentHidden(false));
  await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe(hiddenFrame);
});

test("playable phone stays lazy, reaches ready, and EXIT restores the ambient hero", async ({ page }) => {
  const requests = await stubPlayable(page);
  await page.goto("/?lang=ko");
  const player = page.locator("[data-playable-phone]");
  const launch = page.locator("[data-playable-launch]");
  const exit = page.locator("[data-playable-exit]");
  const video = page.locator("[data-hero-gameplay]");
  const canvas = page.locator("[data-quirky-canvas]");
  const cursor = page.locator("[data-game-cursor]");

  expect(requests).toEqual([]);
  await expect(player.locator("iframe")).toHaveCount(0);
  await player.evaluate((node) => {
    window.__playableStateHistory = [node.dataset.playableState];
    new MutationObserver(() => window.__playableStateHistory.push(node.dataset.playableState))
      .observe(node, { attributes: true, attributeFilter: ["data-playable-state"] });
  });
  await launch.click();
  await expect(exit).toBeFocused();
  await expect(player.locator("iframe")).toHaveCount(1);
  await expect(video).toBeHidden();
  await expect(player).toHaveAttribute("data-playable-state", "ready");
  await expect(player).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("[data-playable-status]")).toHaveText("플레이 준비 완료");
  expect(await page.evaluate(() => window.__playableStateHistory)).toEqual(expect.arrayContaining(["loading", "ready"]));
  expect(requests).toHaveLength(1);
  await page.waitForTimeout(100);
  const pausedFrame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(160);
  await expect(canvas).toHaveAttribute("data-frame", pausedFrame);
  if (await cursor.count()) await expect(cursor).toHaveAttribute("hidden", "");

  await exit.click();
  await expect(player.locator("iframe")).toHaveCount(0);
  await expect(player).toHaveAttribute("data-playable-state", "idle");
  await expect(video).toBeVisible();
  await expect(launch).toBeFocused();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
  await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe(pausedFrame);
  if (await cursor.count()) await expect(cursor).not.toHaveAttribute("hidden", "");
});

test("playable phone preserves the Godot framebuffer aspect ratio", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=ko");
  await page.locator("[data-playable-phone]").evaluate((node) => { node.dataset.playableTimeout = "50000"; });
  await page.locator("[data-playable-launch]").click();
  await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", "ready", { timeout: 55_000 });

  const geometry = await page.locator("[data-playable-phone] iframe").evaluate((frame) => {
    const canvas = frame.contentDocument.querySelector("#canvas");
    const bounds = canvas.getBoundingClientRect();
    return {
      cssRatio: bounds.width / bounds.height,
      framebufferRatio: canvas.width / canvas.height,
    };
  });
  expect(Math.abs(geometry.cssRatio - geometry.framebufferRatio)).toBeLessThan(0.002);
});

test("playable phone timeout cleans up and exposes RETRY", async ({ page }) => {
  await stubPlayable(page, { ready: false });
  await page.goto("/?lang=ko");
  const player = page.locator("[data-playable-phone]");
  await player.evaluate((node) => { node.dataset.playableTimeout = "80"; });
  const launch = page.locator("[data-playable-launch]");

  await launch.click();
  await expect(player).toHaveAttribute("data-playable-state", "error");
  await expect(player.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-playable-status]")).toHaveText("게임을 불러오지 못했습니다");
  await expect(launch).toHaveText("다시 시도");
  await expect(launch).toBeFocused();
});

test("reduced motion still permits explicit playable launch", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubPlayable(page);
  await page.goto("/?lang=ko");
  await page.locator("[data-playable-launch]").click();
  await expect(page.locator("[data-playable-phone] iframe")).toHaveCount(1);
  await expect(page.locator("[data-playable-phone]")).toHaveAttribute("data-playable-state", "ready");
});

test("home lets visitors pause and resume automatic FX", async ({ page }) => {
  await page.goto("/?lang=ko");
  const toggle = page.locator("[data-motion-toggle]");
  const canvas = page.locator("[data-quirky-canvas]");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.locator("[data-hero-gameplay]").evaluate((video) => video.paused)).toBe(true);
  const pausedFrame = await canvas.getAttribute("data-frame");
  await page.waitForTimeout(180);
  await expect(canvas).toHaveAttribute("data-frame", pausedFrame);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe(pausedFrame);
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
  await expect(lastMirrorCard.locator("[data-preview-type][data-typed='true']")).toHaveCount(2, { timeout: 8000 });
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
