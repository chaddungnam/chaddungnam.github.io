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
      // Images without a source yet are placeholders (the home keypad loads its crack frames on the first scroll), not broken media.
      brokenImages: [...document.images]
        .filter((image) => image.getAttribute("src") && image.complete && image.naturalWidth === 0)
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

const homeRoutes = ["/?lang=ko", "/index_en.html?lang=en", "/index_de.html?lang=de", "/index_ja.html?lang=ja"];

// Jumps without the page's smooth-scroll easing so a test can read the settled state.
const jumpTo = (page, top) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
const heroTrack = (page) => page.evaluate(() => {
  const hero = document.querySelector(".hd-hero");
  return { height: hero.offsetHeight, viewport: window.innerHeight };
});

test("all localized home pages fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const route of homeRoutes) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} scrolls sideways`).toBeLessThanOrEqual(320);
    // The three lab-note cards share one width and one thumbnail width whatever the title length.
    const cards = await page.locator("[data-youtube-card]").evaluateAll((nodes) => nodes.map((card) => ({
      width: card.getBoundingClientRect().width,
      thumb: card.querySelector(".hd-thumb").getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    })));
    expect(cards, `${route} video cards`).toHaveLength(3);
    for (const card of cards) {
      expect(Math.abs(card.width - cards[0].width), `${route} card width`).toBeLessThanOrEqual(1);
      expect(Math.abs(card.thumb - cards[0].thumb), `${route} thumbnail width`).toBeLessThanOrEqual(1);
      expect(card.height, `${route} card height`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("home opens on the night pixel desk and leads to 10key Survival and its real gameplay loop", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  const hero = page.locator("#studio");
  const tenkey = page.locator("#games");
  const video = page.locator("[data-hero-gameplay]");

  // The hero is the scene only: one canvas, no overlay copy; the h1 is there for search and screen readers.
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute("data-theme", "night");
  await expect(hero.locator("canvas.hd-desk-canvas")).toHaveCount(1);
  await expect(hero).toHaveText("House Duck");
  await expect(hero.locator("h1")).toHaveText("House Duck");
  await expect(hero.locator("h1")).toHaveClass(/hd-visually-hidden/);
  await expect(hero.locator("a")).toHaveCount(1);
  await expect(hero.locator("a")).toHaveAttribute("href", "#games");
  await expect(hero.locator("a")).toHaveAccessibleName("딸깍 서바이벌 보러 가기");
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  // The pixel room really is drawn (it needs the layered desk PNGs to load): a blank canvas would show only one or two colours.
  await expect.poll(() => hero.locator("canvas.hd-desk-canvas").evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    const colours = new Set();
    for (let i = 0; i < data.length; i += 4 * 797) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return colours.size;
  }), { message: "desk canvas has been painted" }).toBeGreaterThan(8);
  // The CRT carries the two gameplay loops; both videos are muted loops so nothing can make noise.
  expect(await hero.locator(".hd-desk video").evaluateAll((nodes) => nodes.map((node) => ({
    source: node.getAttribute("src"), muted: node.muted, loop: node.loop, playsInline: node.playsInline,
  })))).toEqual([
    { source: "assets/media/tenkey-gameplay.mp4", muted: true, loop: true, playsInline: true },
    { source: "quirky-ball/v2/loop.mp4", muted: true, loop: true, playsInline: true },
  ]);

  // 10key Survival: the first game, unreleased, so no store links yet.
  await tenkey.scrollIntoViewIfNeeded();
  await expect(tenkey).toContainText("딸깍 서바이벌");
  await expect(tenkey).toContainText("10key Survival");
  await expect(tenkey).toContainText("출시 준비 중");
  await expect(tenkey).not.toContainText("Quirky");
  await expect(tenkey.locator("a")).toHaveCount(1);
  await expect(tenkey.locator("a")).toHaveAttribute("href", "10key/");
  await expect(tenkey.locator("a[href*='play.google.com'], a[href*='apps.apple.com'], .google-play-badge, .app-store-badge")).toHaveCount(0);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node) => ({
    autoplay: node.autoplay,
    muted: node.muted,
    loop: node.loop,
    playsInline: node.playsInline,
    preload: node.preload,
  }))).toEqual({ autoplay: true, muted: true, loop: true, playsInline: true, preload: "none" });
  const box = await video.boundingBox();
  expect(box.width).toBeGreaterThan(isMobile ? 200 : 250);
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
  await expect.poll(() => video.evaluate((node) => node.currentTime)).toBeGreaterThan(0);
});

test("home reads as a game studio: 10key Survival first, Quirky Ball second, phones and sections whole", async ({ page, isMobile }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator("#tenkey-title")).toContainText("딸깍 서바이벌");
  await expect(page.locator("#tenkey-title .hd-title-alt")).toHaveText("10key Survival");
  await expect(page.locator("#games .hd-lede")).toHaveText("살아 있는 텐키(숫자 키패드)가 되어 끝없는 3D 키보드를 파고 내려가세요. 키를 부수고, 레벨업마다 스킬 카드를 고르고, 마우스에게서 살아남으세요.");
  await expect(page.locator("[data-youtube-card]")).toHaveCount(3);
  await expect(page.locator("[data-project]")).toHaveCount(1);
  await expect(page.locator("[data-tenkey]")).toHaveCount(1);
  await expect(page.locator("#games")).toContainText("출시 준비 중");
  await expect(page.locator("[data-project='quirky-ball']")).toContainText("Quirky Ball");
  await expect(page.locator("[data-project='hexaworld1984'], [data-hexaworld-preview]")).toHaveCount(0);
  await expect(page.locator(".history-section, .journal-section")).toHaveCount(0);
  await expect(page.locator("[data-scroll-quirky], [data-quirky-canvas], .hero-quirky")).toHaveCount(0);
  await expect(page.locator(".section-rail, [data-motion-toggle], [data-game-preview], [data-release-chamber], [data-studio-hero], .project-zone, .community-section")).toHaveCount(0);
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  await expect(page.locator(".hd-phone-button")).toHaveCount(3);
  await expect(page.locator(".hd-phone-island")).toHaveCount(1);
  await expect(page.locator(".hd-phone-home")).toHaveCount(1);
  await expect(page.locator("[data-hero-gameplay]")).toHaveCount(1);

  // Desktop shows the three video cards in one row of equal height; on a phone they stack as rows.
  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  if (!isMobile) expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThan(2);

  // The phone is never cut: it sits whole inside every ancestor that clips (the 10key section clips its decorative keys).
  await page.locator(".hd-phone").scrollIntoViewIfNeeded();
  const clippedBy = await page.locator(".hd-phone").evaluate((phone) => {
    const rect = phone.getBoundingClientRect();
    const clipped = [];
    for (let node = phone.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (!["hidden", "clip"].includes(style.overflowY) && !["hidden", "clip"].includes(style.overflowX)) continue;
      const box = node.getBoundingClientRect();
      if (rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5 || rect.left < box.left - 0.5 || rect.right > box.right + 0.5) clipped.push(node.className || node.tagName);
    }
    return clipped;
  });
  expect(clippedBy).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  // The header pill follows the tone behind it: night over the desk, paper once the zoom has handed over to the 10key page.
  await jumpTo(page, 0);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  const track = await heroTrack(page);
  await jumpTo(page, track.height - track.viewport);
  await expect(page.locator("#studio")).toHaveClass(/is-entered/);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "paper");
  await page.locator("#lab-notes").scrollIntoViewIfNeeded();
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "paper");
});

test("Quirky Ball screens stack follows the scroll and names every screen", async ({ page }) => {
  await page.goto("/?lang=ko");
  const track = page.locator("[data-stack]");
  const captions = await page.locator("[data-shot]").evaluateAll((nodes) => nodes.map((node) => node.dataset.caption));
  expect(captions).toHaveLength(10);
  await page.locator("#quirky").scrollIntoViewIfNeeded();
  // Positions the page so the sticky stage has travelled `fraction` (0..1) of its track.
  const travelTo = (fraction) => page.evaluate((f) => {
    const col = document.querySelector("[data-stack-col]");
    const stage = document.querySelector("[data-stack-stage]");
    const travel = col.offsetHeight - stage.offsetHeight;
    window.scrollTo({ top: col.getBoundingClientRect().top + window.scrollY + travel * f, behavior: "instant" });
  }, fraction);
  for (const index of [0, 5, 9, 3]) {
    await travelTo(index / 9);
    await expect(track).toHaveAttribute("data-stack-active", String(index));
    const label = `${String(index + 1).padStart(2, "0")} / 10`;
    await expect(page.locator("[data-stack-index]").first()).toHaveText(label);
    await expect(page.locator("[data-stack-caption]").first()).toHaveText(captions[index]);
    await expect(page.locator("[data-shot]").nth(index)).toHaveClass(/is-active/);
    await expect(page.locator("[data-shot].is-active")).toHaveCount(1);
  }
});

test("10key Survival shows its real gameplay in the phone and the quiet Comrade farewell closes the page", async ({ page }) => {
  const farewell = [
    ["/?lang=ko", "동무와 멋진신세계", "다른 장르의 게임에서 만나요"],
    ["/index_en.html?lang=en", "Comrade and the Brave New World", "See you in a game of another genre"],
    ["/index_de.html?lang=de", "Genosse und die schöne neue Welt", "Wir sehen uns in einem Spiel eines anderen Genres"],
    ["/index_ja.html?lang=ja", "Comrade and the Brave New World", "別のジャンルのゲームでまた会いましょう"],
  ];
  for (const [route, name, line] of farewell) {
    await page.goto(route);
    const zone = page.locator("#games");
    await zone.scrollIntoViewIfNeeded();
    const video = zone.locator(".hd-phone video");
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((node) => node.readyState >= 2 && node.videoWidth > 0), { message: `${route} gameplay loads` }).toBe(true);
    await expect(zone.locator("a[href='10key/']")).toHaveCount(1);
    await expect(zone.locator("#tenkey-title")).toHaveCSS("color", "rgb(20, 22, 43)");
    expect(await zone.locator("a[href*='play.google.com'], a[href*='apps.apple.com']").count(), `${route} no store links before release`).toBe(0);

    const block = page.locator(".home-farewell");
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator(".farewell-name")).toHaveText(name);
    await expect(block.locator(".farewell-line")).toHaveText(line);
    await expect(block.locator("a")).toHaveCount(0);
    await expect(block).not.toContainText(/개발 중|In development|In Entwicklung|開発中/);
    // The poster is redrawn as a dim ASCII ghost; if that ever fails the plain image takes over.
    const ghost = block.locator("[data-ghost]");
    await expect.poll(() => ghost.evaluate((node) => node.dataset.ghostReady === "true" || node.classList.contains("is-fallback")), { message: `${route} ghost` }).toBe(true);
    if (await ghost.getAttribute("data-ghost-ready") === "true") {
      expect(await ghost.locator("canvas").evaluate((canvas) => {
        const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        let inked = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) inked += 1;
        return inked;
      }), `${route} ghost canvas has glyphs`).toBeGreaterThan(200);
    } else {
      await expect(ghost.locator("img")).toBeVisible();
    }
    // Comrade only ever appears as the farewell (the synced YouTube titles are the channel's own words, so they are left out).
    const elsewhere = await page.locator("main").evaluate((main) => {
      const copy = main.cloneNode(true);
      copy.querySelector(".home-farewell").remove();
      copy.querySelector("[data-youtube-feed]").remove();
      return copy.textContent;
    });
    expect(elsewhere, `${route} mentions Comrade outside the farewell`).not.toMatch(/comrade|동무|genosse/i);
    const order = await page.evaluate(() => {
      const top = (selector) => document.querySelector(selector).getBoundingClientRect().top + scrollY;
      return [top("#player-support"), top(".home-farewell"), top(".site-footer")];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  }
});

test("home keeps its titles heavy and the footer lockup compact", async ({ page }) => {
  await page.goto("/?lang=ko");
  for (const title of ["#tenkey-title", "#quirky-title", "#lab-title", "#help-title"]) {
    expect(Number(await page.locator(title).evaluate((node) => getComputedStyle(node).fontWeight)), `${title} weight`).toBeGreaterThanOrEqual(800);
  }

  const footer = await page.locator(".site-footer").evaluate((node) => {
    const rect = (selector) => node.querySelector(selector).getBoundingClientRect();
    const duck = rect(".brand-duck-image");
    const wordmark = rect(".footer-wordmark-image");
    // Contrast of the legal links against the footer background (both opaque or white-on-night here).
    const parse = (value) => value.match(/[\d.]+/g).map(Number);
    const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
    const luminance = (rgb) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const background = parse(getComputedStyle(node).backgroundColor).slice(0, 3);
    const contrasts = [...node.querySelectorAll(".footer-links a")].map((link) => {
      const a = luminance(over(parse(getComputedStyle(link).color), background));
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return { duck: [duck.width, duck.height], wordmark: [wordmark.width, wordmark.height], contrasts };
  });
  expect(footer.duck[0]).toBeGreaterThanOrEqual(22);
  expect(footer.duck[0]).toBeLessThanOrEqual(36);
  expect(footer.duck[1]).toBe(footer.duck[0]);
  expect(footer.wordmark[0]).toBeGreaterThanOrEqual(80);
  expect(footer.wordmark[0]).toBeLessThanOrEqual(124);
  expect(footer.wordmark[1]).toBeLessThan(34);
  expect(Math.min(...footer.contrasts), "footer links stay readable on the night footer").toBeGreaterThanOrEqual(4.5);
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
  expect(await page.locator("[data-youtube-feed] img").evaluateAll((images) => images.map((image) => image.getAttribute("src")))).toEqual(
    videos.map((video) => `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`),
  );
  await expect(page.locator("[data-youtube-feed] [data-youtube-card]")).toHaveCount(3);
  await expect(page.locator("[data-youtube-feed] .hd-thumb")).toHaveCount(3);
});

test("home desktop keeps the normal cursor over the desk hero and its screen opens 10key Survival", async ({ page, isMobile }) => {
  test.skip(isMobile, "touch keeps the platform cursor behavior");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  await expect(page.locator("[data-game-cursor]")).toHaveCount(0);
  await expect(page.locator(".hd-desk")).not.toHaveCSS("cursor", "none");
  await page.mouse.move(24, 450);
  await page.mouse.click(24, 450);
  await expect(page.locator("[data-cursor-impact]")).toHaveCount(0);
  await expect(page.locator("#studio")).not.toHaveCSS("cursor", "none");
  expect(page.url()).not.toContain("#games");

  // Only the glowing CRT is a link, and it takes the visitor down to the game.
  const screen = page.locator(".hd-desk-screen-link");
  await expect(screen).toHaveCSS("cursor", "pointer");
  await screen.click();
  await expect(page).toHaveURL(/#games$/);
  await expect.poll(() => page.locator("#games").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.5 && rect.bottom > 0;
  })).toBe(true);
});

test("home reduced motion keeps a still desk, a flat screen row and paused videos", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=ko");
  await expect(page.locator("body")).toHaveAttribute("data-hd-motion", "reduce");
  await expect(page.locator("[data-game-cursor], [data-motion-toggle]")).toHaveCount(0);

  // The hero is one still screen: no scroll track, no CSS animation, no zoom however far the visitor scrolls.
  const track = await heroTrack(page);
  expect(track.height).toBe(track.viewport);
  expect(await page.locator("#studio").evaluate((hero) => hero.getAnimations({ subtree: true }).length)).toBe(0);
  await jumpTo(page, Math.floor(track.viewport / 2));
  await page.waitForTimeout(250);
  await expect(page.locator("#studio")).not.toHaveClass(/is-zooming/);
  await expect(page.locator("#studio")).not.toHaveClass(/is-entered/);
  expect(await page.locator("#studio").evaluate((hero) => hero.style.getPropertyValue("--desk-progress"))).toBe("0.000");
  expect(await page.locator(".hd-desk video").evaluateAll((videos) => videos.map((video) => video.paused))).toEqual([true, true]);

  // Lab notes: no ASCII dissolve over the thumbnails.
  await page.locator("[data-youtube-feed]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  await expect(page.locator(".youtube-card canvas")).toHaveCount(0);

  // Quirky Ball: the ten screens lie flat in a scrollable row instead of the 3D stack.
  const shots = await page.locator("[data-shot]").evaluateAll((nodes) => nodes.map((node) => ({ position: getComputedStyle(node).position, transform: getComputedStyle(node).transform, opacity: getComputedStyle(node).opacity })));
  expect(shots).toHaveLength(10);
  for (const shot of shots) expect(shot).toEqual({ position: "static", transform: "none", opacity: "1" });
  expect(await page.locator("[data-stack-list]").evaluate((list) => getComputedStyle(list).overflowX)).toBe("auto");

  // The phone video never starts by itself.
  await page.locator("[data-hero-gameplay]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
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

test("localized homes keep the 10key Survival copy, phone and sections readable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of homeRoutes) {
    await page.goto(route);
    await page.waitForTimeout(650);
    const layout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const title = rect("#tenkey-title");
      const glass = rect(".hd-glass");
      const phone = rect(".hd-phone-shell");
      const bodyFonts = [".hd-lede", ".hd-quirky-body .hd-lede"]
        .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => parseFloat(getComputedStyle(node).fontSize)));
      const controlHeights = [...document.querySelectorAll(".hd-keycap-cta, .hd-btn, .hd-arrow-link")]
        .filter((node) => getComputedStyle(node).display !== "none")
        .map((node) => node.getBoundingClientRect().height);
      const support = rect("#player-support");
      const farewell = rect(".home-farewell");
      const footer = rect(".site-footer");
      const copyClipped = [...document.querySelectorAll(".hd-glass *, .hd-quirky-copy *")]
        .filter((node) => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== "inline" && !node.closest(".counter-digits, .counter-accessible, .hd-research-total strong"))
        .map((node) => node.className || node.tagName);
      return {
        titleBottom: title.bottom,
        glass: { top: glass.top + scrollY, bottom: glass.bottom + scrollY },
        phone: { top: phone.top + scrollY, left: phone.left, right: phone.right, width: phone.width, bottom: phone.bottom + scrollY },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyFonts,
        controlHeights,
        afterSupport: farewell.top - support.bottom,
        afterFarewell: footer.top - farewell.bottom,
        supportHeight: support.height,
        copyClipped,
        homeAssets: [...document.querySelectorAll('link[href*="home"], script[src*="home"], link[href*="studio-home"], script[src*="studio-home"]')].map((node) => node.href || node.src),
      };
    });
    // On a phone the text card comes first and the phone follows it, whole and centred.
    expect(layout.phone.top, `${route} phone follows the copy`).toBeGreaterThanOrEqual(layout.glass.bottom - 1);
    expect(layout.phone.left).toBeGreaterThanOrEqual(0);
    expect(layout.phone.right).toBeLessThanOrEqual(390);
    expect(layout.phone.width).toBeGreaterThan(200);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.copyClipped, `${route} copy is not clipped`).toEqual([]);
    expect(layout.bodyFonts).not.toHaveLength(0);
    expect(Math.min(...layout.bodyFonts)).toBeGreaterThanOrEqual(16);
    expect(layout.controlHeights).not.toHaveLength(0);
    expect(Math.min(...layout.controlHeights)).toBeGreaterThanOrEqual(44);
    expect(layout.supportHeight).toBeGreaterThan(0);
    expect(layout.afterSupport).toBeGreaterThanOrEqual(0);
    expect(layout.afterSupport).toBeLessThanOrEqual(8);
    expect(layout.afterFarewell).toBeGreaterThanOrEqual(0);
    expect(layout.afterFarewell).toBeLessThanOrEqual(8);
    // Cache-busted home assets only; the quirky-ball/ stylesheet and script are not loaded here.
    expect(layout.homeAssets.map((asset) => new URL(asset).pathname.split("/").pop()).sort()).toEqual(["home-desk.css", "home-desk.js", "home.css", "home.js"]);
    for (const asset of layout.homeAssets) expect(new URL(asset).search.length, `${asset} carries a cache-busting version`).toBeGreaterThan(1);
  }
});

test("hero zoom follows the scroll into the CRT and hands over to 10key Survival", async ({ page }) => {
  await page.goto("/?lang=ko");
  const hero = page.locator("#studio");
  const progress = () => hero.evaluate((node) => Number(node.style.getPropertyValue("--desk-progress")));
  const track = await heroTrack(page);
  expect(track.height, "the hero is a tall scroll track").toBeGreaterThan(track.viewport * 1.5);

  // At rest nothing runs on the CSS side; the canvas is the only moving part and the camera has not moved.
  expect(await hero.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect.poll(progress).toBe(0);
  await expect(hero).not.toHaveClass(/is-zooming/);
  await expect(hero).not.toHaveClass(/is-entered/);

  // Half way through the track the camera is part-way in and the desk stays pinned to the viewport.
  await jumpTo(page, (track.height - track.viewport) * 0.5);
  await expect(hero).toHaveClass(/is-zooming/);
  await expect.poll(progress).toBeGreaterThan(0.3);
  expect(await progress()).toBeLessThan(0.7);
  await expect(hero).not.toHaveClass(/is-entered/);
  expect(await hero.locator(".hd-hero-sticky").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBe(0);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");

  // At the end the zoom is complete and the page is on the paper tone.
  await jumpTo(page, track.height - track.viewport);
  await expect(hero).toHaveClass(/is-entered/);
  await expect.poll(progress).toBeGreaterThanOrEqual(0.98);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "paper");

  // Scrolling back reverses it.
  await jumpTo(page, 0);
  await expect(hero).not.toHaveClass(/is-entered/);
  await expect(hero).not.toHaveClass(/is-zooming/);
  await expect.poll(progress).toBe(0);
});

test("home carries no Quirky Ball playable demo and requests no game files", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/play/") || pathname.includes("/assets/studio-home.")) requests.push(request.url());
  });
  await page.goto("/?lang=ko");
  await page.waitForTimeout(400);
  await expect(page.locator("[data-playable-phone], [data-playable-launch], iframe")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("home plays the 10key Survival phone video only while it is on screen", async ({ page }) => {
  await page.goto("/?lang=ko");
  const video = page.locator("[data-hero-gameplay]");
  await expect(video).toHaveJSProperty("paused", true);

  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);

  await jumpTo(page, 0);
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(true);

  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((node) => node.paused)).toBe(false);
});

test("home keycaps sink while pressed; pressing a keypad key cracks it and clears the hint", async ({ page, isMobile }) => {
  test.skip(isMobile, "the decorative keypad sits behind the card on a phone");
  await page.goto("/?lang=ko");
  await page.locator("#games").scrollIntoViewIfNeeded();
  const cta = page.locator(".hd-keycap-cta");
  const ctaBox = await cta.boundingBox();
  await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y + ctaBox.height / 2);
  await page.mouse.down();
  await expect(cta).toHaveClass(/is-down/);
  await expect(cta.locator(".hd-smudge")).toHaveCount(1);
  // Leaving the key releases it (and keeps the click from following the link).
  await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y - 40);
  await expect(cta).not.toHaveClass(/is-down/);
  await page.mouse.up();
  expect(page.url()).not.toContain("10key");

  // Pressing one of the keycaps behind the card hides the hint and cracks that key one step.
  const hint = page.locator("[data-key-hint]");
  await expect(hint).not.toHaveClass(/is-hidden/);
  const target = await page.evaluate(() => {
    for (const key of document.querySelectorAll(".hd-key")) {
      const box = key.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      // Scrolling the page already digs the keys (data-state 0..4); pick one that can still crack.
      if (y > 0 && y < innerHeight && Number(key.dataset.state) < 4 && (hit === key || key.contains(hit))) return { x, y, id: key.dataset.key, state: Number(key.dataset.state) };
    }
    return null;
  });
  expect(target, "at least one keycap is exposed beside the card").not.toBeNull();
  const key = page.locator(`.hd-key[data-key="${target.id}"]`);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await expect(hint).toHaveClass(/is-hidden/);
  await expect(key).toHaveAttribute("data-state", String(target.state + 1));
  await page.mouse.up();
});

test("primary navigation shows a readable hover tint without motion", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");
  await page.goto("/?lang=ko");
  const luminance = (rgb) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // Over the night desk and over the paper page the pill changes tone; both must keep the hover readable.
  for (const [scrollTop, theme, backdrop] of [[0, "night", [11, 15, 42]], [2400, "paper", [251, 251, 253]]]) {
    await jumpTo(page, scrollTop);
    await expect(page.locator("body")).toHaveAttribute("data-hd-theme", theme);
    for (const link of await page.locator(".site-nav > a").all()) {
      const before = await link.evaluate((node) => getComputedStyle(node).backgroundColor);
      await link.hover();
      await page.waitForTimeout(260);
      const state = await link.evaluate((node) => ({
        background: getComputedStyle(node).backgroundColor,
        color: getComputedStyle(node).color,
        transform: getComputedStyle(node).transform,
      }));
      expect(state.background, `${theme}: hover tints the link`).not.toBe(before);
      expect(state.transform, `${theme}: hover does not move the link`).toBe("none");
      const parse = (value) => value.match(/[\d.]+/g).map(Number);
      const tint = parse(state.background);
      const ink = parse(state.color);
      const blended = [0, 1, 2].map((i) => tint[i] * (tint[3] ?? 1) + backdrop[i] * (1 - (tint[3] ?? 1)));
      const a = luminance(ink.slice(0, 3));
      const b = luminance(blended);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${theme}: hovered text contrast`).toBeGreaterThanOrEqual(7);
    }
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
      const copy = node.closest(".hd-quirky-copy");
      const box = img.getBoundingClientRect();
      // Store-badge rules want clear space of a quarter of the badge height on every side: measure the distance from the badge image
      // to the nearest thing around it (the App Store badge beside it, the disclosure below, the paragraph above).
      const clearSpaceTo = (other) => {
        const rect = other.getBoundingClientRect();
        const dx = Math.max(rect.left - box.right, box.left - rect.right, 0);
        const dy = Math.max(rect.top - box.bottom, box.top - rect.bottom, 0);
        return Math.hypot(dx, dy);
      };
      const neighbours = [copy.querySelector(".app-store-badge"), copy.querySelector(".store-disclosure"), copy.querySelector(".hd-quirky-body .hd-lede")];
      return { loaded: img.complete && img.naturalWidth > 0, height: box.height, clearSpace: neighbours.map(clearSpaceTo), left: box.left, aboveLeft: copy.querySelector("h2").getBoundingClientRect().left, belowLeft: copy.querySelector(".store-disclosure").getBoundingClientRect().left };
    });
    expect(metrics.loaded).toBe(true);
    expect(Math.abs(metrics.left - metrics.aboveLeft)).toBeLessThan(1);
    expect(Math.abs(metrics.left - metrics.belowLeft)).toBeLessThan(1);
    expect(metrics.height).toBeGreaterThanOrEqual(28);
    expect(Math.min(...metrics.clearSpace), `${route} Google Play badge clear space (App Store badge, disclosure, paragraph)`).toBeGreaterThanOrEqual(metrics.height / 4);
  }
});
