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
// Puts a section's top edge just under the fixed bar, so the bar's tone probe reads that section.
const jumpToSection = (page, selector) => page.evaluate((sel) => window.scrollTo({ top: document.querySelector(sel).getBoundingClientRect().top + scrollY + 8, behavior: "instant" }), selector);
const heroTrack = (page) => page.evaluate(() => {
  const hero = document.querySelector(".hd-hero");
  return { height: hero.offsetHeight, viewport: window.innerHeight };
});
// Where the hero hand-off lands: the 10key card sits just under the bar (setupHeroGlide uses the same formula).
const glideLanding = (page) => page.evaluate(() => Math.max(0, Math.round(document.querySelector(".hd-tenkey-grid").getBoundingClientRect().top + scrollY - (innerWidth > 720 ? 96 : 76))));
// The hero hand-off animates the scroll (about 1.1 to 2.4 s), so a test waits for scrollY to settle instead of expecting an instant jump.
const scrollSettlesAt = async (page, target, tolerance = 4) => {
  await expect.poll(() => page.evaluate((to) => Math.abs(Math.round(scrollY) - to), target), { timeout: 8000, intervals: [100, 200, 300] }).toBeLessThanOrEqual(tolerance);
  // After a glide the page ignores further wheel / key / swipe input for about 450 ms (trackpad inertia); wait that out before the next gesture.
  await page.waitForTimeout(600);
};
const homeCopy = {
  "/?lang=ko": { tenkeyHref: "10key/", more: "자세히 보기", comrade: ["동무와 멋진신세계", "다른 장르의 게임에서 만나요"], quirkyHref: "quirky-ball/?lang=ko" },
  "/index_en.html?lang=en": { tenkeyHref: "10key/index_en.html", more: "Learn more", comrade: ["Comrade and the Brave New World", "See you in a game of another genre"], quirkyHref: "quirky-ball/?lang=en" },
  "/index_de.html?lang=de": { tenkeyHref: "10key/index_en.html", more: "Mehr erfahren", comrade: ["Genosse und die schöne neue Welt", "Wir sehen uns in einem Spiel eines anderen Genres"], quirkyHref: "quirky-ball/?lang=de" },
  "/index_ja.html?lang=ja": { tenkeyHref: "10key/index_en.html", more: "詳しく見る", comrade: ["Comrade and the Brave New World", "別のジャンルのゲームでまた会いましょう"], quirkyHref: "quirky-ball/?lang=ja" },
};

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
  const video = tenkey.locator("[data-hero-gameplay]");

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
  // Over the duck scene the bar is clear so the art stays uncovered.
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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

  // 10key Survival: the first game, free in the browser on itch.io; the apps are unreleased, so no store links yet.
  await tenkey.scrollIntoViewIfNeeded();
  await expect(tenkey).toContainText("딸깍 서바이벌");
  await expect(tenkey).toContainText("10key Survival");
  await expect(tenkey).toContainText("출시 준비 중");
  await expect(tenkey).toContainText("화려한 모험, 그리고 ASMR");
  await expect(tenkey).not.toContainText("Quirky");
  await expect(tenkey.locator("a")).toHaveCount(4);
  // a paid app: the big gold key is the pre-registration, the itch.io build is the free preview under it
  await expect(tenkey.locator("a.hd-tk-prereg")).toHaveAttribute("href", "10key/#prereg");
  await expect(tenkey.locator("a.hd-tk-prereg")).toHaveText("사전예약하기");
  await expect(tenkey.locator("a.hd-tk-preview")).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
  await expect(tenkey.locator("a.hd-tk-preview")).toHaveText("itch.io에서 미리 플레이해보기");
  await expect(tenkey.locator("a.hd-tk-more")).toHaveAttribute("href", "10key/");
  await expect(tenkey.locator(".hd-tk-fine a")).toHaveAttribute("href", "10key/odds/");
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
  await expect(page.locator("#games .hd-lede")).toHaveText("부수는 키마다 실제로 녹음한 키보드 소리가 딸깍, 와장창 울려요. 살아 있는 텐키가 되어 끝없는 3D 키보드를 파고 내려가세요.");
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
  // Two phones (Quirky Ball and the Comrade farewell); 10key Survival plays its loop in the plain itch.io-style frame. One loop each.
  await expect(page.locator(".hd-phone")).toHaveCount(2);
  await expect(page.locator(".hd-phone-button")).toHaveCount(6);
  await expect(page.locator(".hd-phone-island")).toHaveCount(2);
  await expect(page.locator(".hd-phone-home")).toHaveCount(2);
  await expect(page.locator("#games .hd-tk-screen-frame")).toHaveCount(1);
  await expect(page.locator("[data-hero-gameplay]")).toHaveCount(3);
  await expect(page.locator("#games [data-hero-gameplay]")).toHaveCount(1);
  await expect(page.locator("#quirky [data-hero-gameplay]")).toHaveCount(1);
  await expect(page.locator("#comrade [data-hero-gameplay]")).toHaveCount(1);
  await expect(page.locator("[data-shot], [data-stack], .hd-ghost")).toHaveCount(0);
  // Section order: hero, 10key Survival, Quirky Ball, the Comrade farewell, lab notes, support.
  const tops = await page.evaluate(() => ["#studio", "#games", "#quirky", "#comrade", "#lab-notes", "#player-support"].map((selector) => document.querySelector(selector).getBoundingClientRect().top + scrollY));
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(await page.locator("#comrade").evaluate((node) => node.previousElementSibling.id)).toBe("quirky");
  expect(await page.locator("#player-support").evaluate((node) => node.nextElementSibling)).toBeNull();

  // Desktop shows the three video cards in one row of equal height; on a phone they stack as rows.
  const cardHeights = await page.locator("[data-youtube-card]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  if (!isMobile) expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThan(2);

  // Every phone and the 10key game frame is never cut: it sits whole inside every ancestor that clips (the 10key section
  // clips its background art, the Quirky Ball and farewell sections clip their glows).
  for (const index of [0, 1, 2]) {
    const phone = page.locator("#games .hd-tk-screen-frame, .hd-phone").nth(index);
    await phone.scrollIntoViewIfNeeded();
    const clippedBy = await phone.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const clipped = [];
      for (let ancestor = node.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!["hidden", "clip"].includes(style.overflowY) && !["hidden", "clip"].includes(style.overflowX)) continue;
        const box = ancestor.getBoundingClientRect();
        if (rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5 || rect.left < box.left - 0.5 || rect.right > box.right + 0.5) clipped.push(ancestor.className || ancestor.tagName);
      }
      return clipped;
    });
    expect(clippedBy, `phone ${index + 1} is clipped`).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  // The header tracks what is under it. data-hd-theme names the section tone (night over the desk, and still night once the zoom has
  // handed over to the dark 10key section); data-hd-over-hero is on only while the bar sits over the desk before its zoom ends, and the
  // bar is the dark House Duck bar elsewhere.
  await jumpTo(page, 0);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
  const track = await heroTrack(page);
  await jumpTo(page, track.height - track.viewport);
  await expect(page.locator("#studio")).toHaveClass(/is-entered/);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(17, 20, 25, 0.97)");
  await jumpToSection(page, "#lab-notes");
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "paper");
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
  // Over the night Comrade farewell the tone follows the section, and the bar stays the dark bar.
  await jumpToSection(page, "#comrade");
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(17, 20, 25, 0.97)");
});

test("Quirky Ball title is the game's own logo, cut into letters that land one by one when it scrolls into view", async ({ page }) => {
  await page.goto("/?lang=ko");
  const title = page.locator("#quirky-title");
  const logo = title.locator("[data-qb-logo]");
  const pieces = logo.locator("img.hd-qb-piece");
  // The heading still says "Quirky Ball" to search and screen readers; the logo itself is decoration.
  await expect(title).toHaveText("Quirky Ball");
  await expect(title.locator(".hd-visually-hidden")).toHaveText("Quirky Ball");
  await expect(logo).toHaveAttribute("aria-hidden", "true");
  expect(await pieces.evaluateAll((nodes) => nodes.map((node) => node.dataset.piece))).toEqual(["q", "u", "i", "r", "k", "y", "b", "a", "l1", "l2", "dot", "hex", "ball"]);
  expect(await pieces.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")))).toEqual(
    ["q", "u", "i", "r", "k", "y", "b", "a", "l1", "l2", "dot", "hex", "ball"].map((piece) => `assets/media/home/qb-logo/${piece}.webp`),
  );

  // Before it is in view the letters wait, invisible; the shot of Quirky Ball is not a stack of screenshots any more.
  await expect(logo).not.toHaveClass(/is-in/);
  expect(await pieces.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity))).toEqual(Array(13).fill("0"));

  // Scrolled into view, they drop in one after another in --i order, and every piece image really loads.
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toHaveClass(/is-in/);
  const timing = await pieces.evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return { piece: node.dataset.piece, order: Number(node.style.getPropertyValue("--i")), animation: style.animationName.split(",")[0].trim(), delay: parseFloat(style.animationDelay) };
  }));
  for (const letter of timing.filter((entry) => !["dot", "hex", "ball"].includes(entry.piece))) {
    expect(letter.animation, `${letter.piece} drops in`).toBe("hd-qb-drop");
    expect(letter.delay, `${letter.piece} waits for its turn`).toBeCloseTo(letter.order * 0.065, 3);
  }
  expect(timing.find((entry) => entry.piece === "dot").animation).toBe("hd-qb-pop");
  expect(timing.find((entry) => entry.piece === "hex").animation).toBe("hd-qb-hex-in");
  expect(timing.find((entry) => entry.piece === "ball").animation).toBe("hd-qb-ball-in");
  await expect.poll(() => pieces.evaluateAll((nodes) => nodes.every((node) => node.complete && node.naturalWidth > 0)), { message: "logo pieces load" }).toBe(true);
  await expect.poll(() => pieces.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity)), { timeout: 8000, message: "letters have landed" }).toEqual(Array(13).fill("1"));

  // Landed, the letters read as the logo: both rows run left to right inside the logo box, the dot over the i.
  const boxes = await logo.evaluate((node) => {
    const frame = node.getBoundingClientRect();
    const out = { frame: { width: frame.width, height: frame.height }, pieces: {} };
    for (const piece of node.querySelectorAll(".hd-qb-piece")) {
      const rect = piece.getBoundingClientRect();
      out.pieces[piece.dataset.piece] = { left: rect.left - frame.left, top: rect.top - frame.top, right: rect.right - frame.left, bottom: rect.bottom - frame.top, midX: (rect.left + rect.right) / 2 - frame.left };
    }
    return out;
  });
  expect(boxes.frame.width / boxes.frame.height).toBeCloseTo(861 / 551, 1);
  for (const [piece, box] of Object.entries(boxes.pieces)) {
    expect(box.left, `${piece} stays inside the logo box (left)`).toBeGreaterThanOrEqual(-boxes.frame.width * 0.03);
    expect(box.right, `${piece} stays inside the logo box (right)`).toBeLessThanOrEqual(boxes.frame.width * 1.03);
    expect(box.top, `${piece} stays inside the logo box (top)`).toBeGreaterThanOrEqual(-boxes.frame.height * 0.08);
    expect(box.bottom, `${piece} stays inside the logo box (bottom)`).toBeLessThanOrEqual(boxes.frame.height * 1.03);
  }
  const lefts = (names) => names.map((name) => boxes.pieces[name].left);
  expect(lefts(["q", "u", "i", "r", "k", "y"]), "QUIRKY reads left to right").toEqual([...lefts(["q", "u", "i", "r", "k", "y"])].sort((a, b) => a - b));
  expect(lefts(["b", "a", "l1", "l2"]), "BALL reads left to right").toEqual([...lefts(["b", "a", "l1", "l2"])].sort((a, b) => a - b));
  expect(boxes.pieces.b.top, "the second word sits below the first").toBeGreaterThan(boxes.pieces.q.top + boxes.frame.height * 0.2);
  expect(boxes.pieces.dot.bottom, "the dot rides above the i").toBeLessThanOrEqual(boxes.pieces.i.top + 2);
  expect(Math.abs(boxes.pieces.dot.midX - boxes.pieces.i.midX)).toBeLessThan(boxes.frame.width * 0.03);
});

test("10key Survival shows its real gameplay in its game frame and the quiet Comrade farewell sits right under Quirky Ball", async ({ page }) => {
  for (const [route, copy] of Object.entries(homeCopy)) {
    const [name, line] = copy.comrade;
    await page.goto(route);
    const zone = page.locator("#games");
    await zone.scrollIntoViewIfNeeded();
    const video = zone.locator(".hd-tk-screen video");
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((node) => node.readyState >= 2 && node.videoWidth > 0), { message: `${route} gameplay loads` }).toBe(true);
    await expect(zone.locator(`a[href='${copy.tenkeyHref}']`)).toHaveCount(1);
    await expect(zone.locator("a[href='https://houseduck.itch.io/10key-survival']")).toHaveCount(1);
    await expect(zone.locator(`a[href='${copy.tenkeyHref}#prereg']`)).toHaveCount(1);
    await expect(zone.locator("a")).toHaveCount(4);
    // the itch.io theme: light text (#ECE6D6) on the dark page (#141318), the game's own pixel font
    await expect(zone.locator("#tenkey-title")).toHaveCSS("color", "rgb(236, 230, 214)");
    await expect(zone.locator("#tenkey-title")).toHaveCSS("font-family", /Galmuri11/);
    // five store screenshots in the page's language, loaded only when they come near
    const shots = await zone.locator(".hd-tk-shots img").evaluateAll((nodes) => nodes.map((node) => ({ src: node.getAttribute("src"), lazy: node.loading })));
    expect(shots, `${route} screenshots`).toHaveLength(5);
    for (const shot of shots) expect(shot.lazy).toBe("lazy");
    const pageLang = await page.evaluate(() => document.documentElement.lang);
    for (const shot of shots) expect(shot.src, `${route} screenshot language`).toMatch(new RegExp(`-${pageLang}\\.webp$`));
    expect(await zone.locator("a[href*='play.google.com'], a[href*='apps.apple.com']").count(), `${route} no store links before release`).toBe(0);

    // The dropped game: night section right after Quirky Ball, its old play loop in a phone, one line, no link, no status.
    const block = page.locator("#comrade");
    await expect(block).toHaveClass(/home-farewell/);
    await expect(block).toHaveAttribute("data-theme", "night");
    await expect(block).toHaveAttribute("aria-labelledby", "comrade-title");
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator(".farewell-name")).toHaveText(name);
    await expect(block.locator("h2.farewell-line#comrade-title")).toHaveText(line);
    await expect(block.locator("a")).toHaveCount(0);
    await expect(block).not.toContainText(/개발 중|In development|In Entwicklung|開発中/);
    await expect(block).toHaveCSS("background-color", "rgb(11, 15, 42)");
    await expect(block.locator(".hd-ghost, [data-ghost], canvas")).toHaveCount(0);
    const farewellVideo = block.locator("video[data-hero-gameplay]");
    await expect(farewellVideo).toHaveCount(1);
    await expect(farewellVideo).toBeVisible();
    expect(await farewellVideo.evaluate((node) => ({ poster: node.getAttribute("poster"), sources: [...node.querySelectorAll("source")].map((source) => source.getAttribute("src")), autoplay: node.autoplay, muted: node.muted, loop: node.loop, playsInline: node.playsInline, preload: node.preload }))).toEqual({
      poster: "assets/media/comrade-gameplay-poster.jpg", sources: ["assets/media/comrade-gameplay.mp4"], autoplay: true, muted: true, loop: true, playsInline: true, preload: "none",
    });
    await expect.poll(() => farewellVideo.evaluate((node) => node.readyState >= 2 && node.videoWidth > 0), { message: `${route} farewell loop loads` }).toBe(true);
    await expect.poll(() => farewellVideo.evaluate((node) => node.paused), { message: `${route} farewell loop plays while on screen` }).toBe(false);
    // Comrade only ever appears as the farewell (the synced YouTube titles are the channel's own words, so they are left out).
    const elsewhere = await page.locator("main").evaluate((main) => {
      const copy = main.cloneNode(true);
      copy.querySelector(".home-farewell").remove();
      copy.querySelector("[data-youtube-feed]").remove();
      return copy.textContent;
    });
    expect(elsewhere, `${route} mentions Comrade outside the farewell`).not.toMatch(/comrade|동무|genosse/i);
    // The farewell is no longer the last block: Quirky Ball, farewell, lab notes, support, footer.
    const order = await page.evaluate(() => {
      const top = (selector) => document.querySelector(selector).getBoundingClientRect().top + scrollY;
      return [top("#quirky"), top("#comrade"), top("#lab-notes"), top("#player-support"), top(".site-footer")];
    });
    expect([...order].sort((a, b) => a - b), `${route} section order`).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    expect(await page.evaluate(() => document.querySelector("#comrade").previousElementSibling.id)).toBe("quirky");
    expect(await page.evaluate(() => document.querySelector("#comrade").nextElementSibling.id)).toBe("lab-notes");
  }
});

test("home keeps its titles heavy and the footer lockup compact", async ({ page }) => {
  await page.goto("/?lang=ko");
  // Quirky Ball's title is its logo (no font weight); the farewell line is a calmer bold on the night section.
  for (const title of ["#lab-title", "#help-title"]) {
    expect(Number(await page.locator(title).evaluate((node) => getComputedStyle(node).fontWeight)), `${title} weight`).toBeGreaterThanOrEqual(800);
  }
  // 10key Survival's title is set in the game's bold pixel font, like its itch.io page.
  expect(Number(await page.locator("#tenkey-title").evaluate((node) => getComputedStyle(node).fontWeight)), "#tenkey-title weight").toBeGreaterThanOrEqual(700);
  expect(Number(await page.locator("#comrade-title").evaluate((node) => getComputedStyle(node).fontWeight)), "#comrade-title weight").toBeGreaterThanOrEqual(700);
  expect(await page.locator("#quirky-title .hd-qb-logo").evaluate((node) => getComputedStyle(node).display)).toBe("block");

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

// ---------- hero hand-off (setupHeroGlide): one wheel / swipe / key / in-page link in the duck scene plays the zoom calmly ----------
// Samples scrollY every frame for `ms` milliseconds, so a test can tell an eased glide from an instant jump.
const sampleScroll = (page, ms) => page.evaluate((duration) => new Promise((resolve) => {
  const samples = [];
  const start = performance.now();
  const tick = () => {
    const at = performance.now() - start;
    samples.push([Math.round(at), Math.round(scrollY)]);
    if (at >= duration) resolve(samples); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), ms);
const expectGlide = (samples, landing, label) => {
  const values = samples.map((sample) => sample[1]);
  expect(Math.max(...values), `${label} reaches the destination`).toBeGreaterThanOrEqual(landing - 4);
  const distinct = new Set(values.filter((value) => value > 8 && value < landing - 8));
  expect(distinct.size, `${label} is an eased glide, not a jump (frames in between: ${distinct.size})`).toBeGreaterThan(8);
  for (let i = 1; i < values.length; i += 1) expect(values[i], `${label} never runs backwards`).toBeGreaterThanOrEqual(values[i - 1] - 1);
};

test("hero hand-off: one wheel notch in the duck scene glides to the 10key card, and wheeling up from the scene glides back", async ({ page, isMobile }) => {
  test.skip(isMobile, "wheel input is a desktop gesture; the phone swipe is covered below");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  const landing = await glideLanding(page);
  expect(landing, "the 10key card lies far below the desk").toBeGreaterThan(600);

  // Down: a single notch plays the whole zoom, lasts at least a second, and lands the 10key card under the bar.
  const down = sampleScroll(page, 3600);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 120);
  const samples = await down;
  const moving = samples.filter((sample) => sample[1] > 4 && sample[1] < landing - 4);
  expect(moving.length, "the glide takes many frames").toBeGreaterThan(20);
  expect(moving[moving.length - 1][0] - moving[0][0], "the glide lasts about 1.1 to 2.4 seconds").toBeGreaterThan(900);
  expect(moving[moving.length - 1][0] - moving[0][0], "the glide lasts about 1.1 to 2.4 seconds").toBeLessThan(3200);
  expectGlide(samples, landing, "wheel down");
  await scrollSettlesAt(page, landing, 3);
  await expect(page.locator("#studio")).toHaveClass(/is-entered/);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
  expect(await page.evaluate(() => document.querySelector(".hd-tenkey-grid").getBoundingClientRect().top)).toBeLessThan(110);

  // Up: from inside the scene (above the landing spot) one notch up glides back to the top, and the bar turns clear again.
  await jumpTo(page, Math.round(landing * 0.6));
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
  const up = sampleScroll(page, 3600);
  await page.mouse.wheel(0, -120);
  const upSamples = await up;
  expect(new Set(upSamples.map((sample) => sample[1]).filter((value) => value > 8 && value < landing * 0.6 - 8)).size, "wheel up is an eased glide").toBeGreaterThan(8);
  await scrollSettlesAt(page, 0, 2);
  await expect(page.locator("#studio")).not.toHaveClass(/is-entered/);
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");
});

test("hero hand-off: keys glide the same way, window.scrollTo stays instant, and below the 10key card the page scrolls normally", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard hand-off is a desktop gesture");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  const landing = await glideLanding(page);
  // scrollTo is not intercepted: it lands at once (the zoom tests rely on this).
  await jumpTo(page, 300);
  expect(await page.evaluate(() => Math.round(scrollY))).toBe(300);
  await jumpTo(page, 0);

  for (const [key, label] of [["ArrowDown", "arrow down"], ["PageDown", "page down"], ["Space", "space"]]) {
    await jumpTo(page, 0);
    await page.evaluate(() => document.activeElement?.blur());
    const sampling = sampleScroll(page, 3400);
    await page.keyboard.press(key);
    expectGlide(await sampling, landing, label);
    await scrollSettlesAt(page, landing, 3);
    // Going up from inside the scene glides back; Shift+Space and PageUp count as "up".
    await jumpTo(page, Math.round(landing * 0.5));
    await page.keyboard.press(key === "Space" ? "Shift+Space" : "PageUp");
    await scrollSettlesAt(page, 0, 2);
  }

  // Past the landing spot the glide leaves the page alone: a wheel notch is not turned into a jump to the top or anywhere else.
  await jumpTo(page, landing + 500);
  const intercepted = await page.evaluate(() => {
    const wheel = new WheelEvent("wheel", { deltaY: 120, cancelable: true, bubbles: true });
    window.dispatchEvent(wheel);
    return wheel.defaultPrevented;
  });
  expect(intercepted).toBe(false);
  expect(await page.evaluate(() => Math.round(scrollY))).toBe(landing + 500);
});

test("hero hand-off: the CRT screen and the header Games / Studio links glide too and update the URL", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desk screen and header links are exercised with a mouse");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  const landing = await glideLanding(page);

  // The glowing screen in the scene.
  const toGames = sampleScroll(page, 3600);
  await page.locator(".hd-desk-screen-link").click();
  expectGlide(await toGames, landing, "screen link");
  await scrollSettlesAt(page, landing, 3);
  await expect(page).toHaveURL(/#games$/);

  // Header "Studio" glides back to the top of the page; header "Games" glides down again. Both are in-page links.
  const toStudio = sampleScroll(page, 3600);
  await page.locator('.site-nav a[href="#studio"]').click();
  const studioSamples = await toStudio;
  expect(new Set(studioSamples.map((sample) => sample[1]).filter((value) => value > 8 && value < landing - 8)).size, "Studio link is an eased glide").toBeGreaterThan(8);
  await scrollSettlesAt(page, 0, 2);
  await expect(page).toHaveURL(/#studio$/);
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");

  await page.waitForTimeout(500);
  await page.locator('.site-nav a[href="#games"]').click();
  await scrollSettlesAt(page, landing, 3);
  await expect(page).toHaveURL(/#games$/);
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
});

test("hero hand-off: a swipe up in the duck scene glides to the 10key card on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch swipes are a phone gesture");
  await page.goto("/?lang=ko");
  await page.waitForTimeout(650);
  const landing = await glideLanding(page);
  expect(landing).toBeGreaterThan(400);
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (fromY, toY) => {
    const x = 200;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
    for (let step = 1; step <= 8; step += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: fromY + ((toY - fromY) * step) / 8 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const sampling = sampleScroll(page, 3600);
  await swipe(600, 300);
  expectGlide(await sampling, landing, "swipe up");
  await scrollSettlesAt(page, landing, 3);
  await expect(page.locator("#studio")).toHaveClass(/is-entered/);
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");

  // A swipe down from inside the scene glides back to the duck.
  await jumpTo(page, Math.round(landing * 0.5));
  await swipe(300, 600);
  await scrollSettlesAt(page, 0, 2);
  await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
});

test("home reduced motion keeps a still desk, a finished logo, no hero glide and paused videos", async ({ page }) => {
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

  // Quirky Ball: the logo is simply there, finished, with no drop-in or idle animation on any letter.
  await expect(page.locator("[data-qb-logo]")).toHaveClass(/is-in/);
  const letters = await page.locator(".hd-qb-piece").evaluateAll((nodes) => nodes.map((node) => ({ opacity: getComputedStyle(node).opacity, animation: getComputedStyle(node).animationName })));
  expect(letters).toHaveLength(13);
  for (const letter of letters) expect(letter).toEqual({ opacity: "1", animation: "none" });

  // The hero hand-off does not take over the wheel, keys or links: the page scrolls the browser's own way.
  const intercepted = await page.evaluate(() => {
    const wheel = new WheelEvent("wheel", { deltaY: 120, cancelable: true, bubbles: true });
    window.dispatchEvent(wheel);
    const key = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true, bubbles: true });
    document.body.dispatchEvent(key);
    return { wheel: wheel.defaultPrevented, key: key.defaultPrevented };
  });
  expect(intercepted).toEqual({ wheel: false, key: false });

  // None of the three phone videos starts by itself.
  for (const selector of ["#games", "#quirky", "#comrade"]) {
    const video = page.locator(`${selector} [data-hero-gameplay]`);
    await video.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await expect.poll(() => video.evaluate((node) => ({ autoplay: node.autoplay, paused: node.paused })), { message: `${selector} loop stays still` }).toEqual({ autoplay: false, paused: true });
  }
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

test("localized homes keep the 10key Survival copy, game frame and sections readable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of homeRoutes) {
    await page.goto(route);
    await page.waitForTimeout(650);
    const layout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const title = rect("#tenkey-title");
      const glass = rect(".hd-tk-copy");
      const phone = rect(".hd-tk-screen-frame");
      const bodyFonts = [".hd-lede", ".hd-quirky-copy .hd-lede"]
        .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => parseFloat(getComputedStyle(node).fontSize)));
      const controlHeights = [...document.querySelectorAll(".hd-keycap-cta, .hd-btn, .hd-arrow-link, .store-button")]
        .filter((node) => getComputedStyle(node).display !== "none")
        .map((node) => node.getBoundingClientRect().height);
      const support = rect("#player-support");
      const quirky = rect("#quirky");
      const farewell = rect(".home-farewell");
      const lab = rect("#lab-notes");
      const footer = rect(".site-footer");
      // On a phone the Quirky Ball column reads: eyebrow, logo, lede, phone, store buttons, link, community numbers.
      const flow = ["#quirky .hd-eyebrow-row", "#quirky .hd-qb-title", "#quirky .hd-lede", "#quirky .hd-qb-phone", "#quirky .project-stores", "#quirky .hd-keycap-cta", "#quirky .hd-research"]
        .map((selector) => { const box = rect(selector); return { selector, top: box.top + scrollY, bottom: box.bottom + scrollY, left: box.left, right: box.right }; });
      const copyClipped = [...document.querySelectorAll(".hd-tk-copy *, .hd-quirky-copy *")]
        .filter((node) => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== "inline" && !node.closest(".counter-digits, .counter-accessible, .hd-research-total strong, .hd-visually-hidden"))
        .map((node) => node.className || node.tagName);
      return {
        titleBottom: title.bottom,
        glass: { top: glass.top + scrollY, bottom: glass.bottom + scrollY },
        phone: { top: phone.top + scrollY, left: phone.left, right: phone.right, width: phone.width, bottom: phone.bottom + scrollY },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyFonts,
        controlHeights,
        afterQuirky: farewell.top - quirky.bottom,
        afterFarewell: lab.top - farewell.bottom,
        afterSupport: footer.top - support.bottom,
        flow,
        supportHeight: support.height,
        copyClipped,
        homeAssets: [...document.querySelectorAll('link[href*="home"], script[src*="home"], link[href*="studio-home"], script[src*="studio-home"]')].map((node) => node.href || node.src),
      };
    });
    // On a phone the copy and PLAY come first and the game frame follows, whole and centred.
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
    // Sections meet edge to edge: Quirky Ball, the Comrade farewell, lab notes, then support and the footer.
    for (const gap of ["afterQuirky", "afterFarewell", "afterSupport"]) {
      expect(layout[gap], `${route} ${gap}`).toBeGreaterThanOrEqual(0);
      expect(layout[gap], `${route} ${gap}`).toBeLessThanOrEqual(8);
    }
    for (let i = 1; i < layout.flow.length; i += 1) expect(layout.flow[i].top, `${route} ${layout.flow[i].selector} follows ${layout.flow[i - 1].selector}`).toBeGreaterThanOrEqual(layout.flow[i - 1].bottom - 1);
    for (const box of layout.flow) {
      expect(box.left, `${route} ${box.selector} left`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${route} ${box.selector} right`).toBeLessThanOrEqual(390);
    }
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

  // At the end the zoom is complete and the page is on the 10key section's dark tone (the zoom fades to it).
  await jumpTo(page, track.height - track.viewport);
  await expect(hero).toHaveClass(/is-entered/);
  await expect.poll(progress).toBeGreaterThanOrEqual(0.98);
  await expect(page.locator("body")).toHaveAttribute("data-hd-theme", "night");

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

test("home plays each phone video (10key Survival, Quirky Ball, Comrade farewell) only while it is on screen", async ({ page }) => {
  await page.goto("/?lang=ko");
  for (const selector of ["#games", "#quirky", "#comrade"]) {
    const video = page.locator(`${selector} [data-hero-gameplay]`);
    await expect(video).toHaveJSProperty("paused", true);

    await video.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((node) => node.paused), { message: `${selector} starts when it appears` }).toBe(false);

    await jumpTo(page, 0);
    await expect.poll(() => video.evaluate((node) => node.paused), { message: `${selector} stops when it leaves` }).toBe(true);

    await video.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((node) => node.paused), { message: `${selector} resumes` }).toBe(false);
    await jumpTo(page, 0);
  }
});

test("home keycaps sink while pressed and release without following their link", async ({ page, isMobile }) => {
  test.skip(isMobile, "pointer presses are covered by the desktop project");
  await page.goto("/?lang=ko");
  await page.locator("#games").scrollIntoViewIfNeeded();
  // 10key Survival's pre-registration is the big gold keycap; the Quirky Ball link is the same keycap and sinks the same way.
  const quirkyCta = page.locator("#quirky .hd-keycap-cta");
  await expect(quirkyCta).toHaveAttribute("href", "quirky-ball/?lang=ko");
  await expect(quirkyCta).toHaveAttribute("data-pressable", "");
  await expect(quirkyCta.locator(".hd-keycap-face")).toHaveText("자세히 보기");
  const cta = page.locator("#games .hd-keycap-cta");
  await expect(cta).toHaveAttribute("href", "10key/#prereg");
  await expect(cta).toHaveAttribute("data-pressable", "");
  const ctaBox = await cta.boundingBox();
  expect(ctaBox.height, "pre-registration is a big button").toBeGreaterThanOrEqual(72);
  await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y + ctaBox.height / 2);
  await page.mouse.down();
  await expect(cta).toHaveClass(/is-down/);
  await expect(cta.locator(".hd-smudge")).toHaveCount(1);
  // Leaving the key releases it (and keeps the click from following the link).
  await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y - 40);
  await expect(cta).not.toHaveClass(/is-down/);
  await page.mouse.up();
  expect(page.url()).not.toContain("10key");
  // The keycap toy that used to sit behind the 10key card is gone.
  await expect(page.locator("[data-keyfield], .hd-key, [data-key-hint]")).toHaveCount(0);

  // The Quirky Ball keycap sinks while pressed and releases when the pointer leaves, without following its link.
  await quirkyCta.scrollIntoViewIfNeeded();
  const quirkyBox = await quirkyCta.boundingBox();
  await page.mouse.move(quirkyBox.x + quirkyBox.width / 2, quirkyBox.y + quirkyBox.height / 2);
  await page.mouse.down();
  await expect(quirkyCta).toHaveClass(/is-down/);
  await page.mouse.move(quirkyBox.x + quirkyBox.width / 2, quirkyBox.y - 60);
  await expect(quirkyCta).not.toHaveClass(/is-down/);
  await page.mouse.up();
  expect(page.url()).not.toContain("quirky-ball");
});

test("primary navigation shows a readable hover tint without motion", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is covered by the desktop project");
  await page.goto("/?lang=ko");
  const luminance = (rgb) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // Over the clear bar on the night desk and over the dark House Duck bar further down, the hover must stay readable.
  for (const [scrollTop, theme, overHero, backdrop] of [[0, "night", true, [11, 15, 42]], [2400, "night", false, [17, 20, 25]]]) {
    await jumpTo(page, scrollTop);
    await expect(page.locator("body")).toHaveAttribute("data-hd-theme", theme);
    if (overHero) await expect(page.locator("body")).toHaveAttribute("data-hd-over-hero", "");
    else await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
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

test("Quirky Ball zone shows two matching HTML store buttons, localized, beside its copy", async ({ page }) => {
  const stores = {
    "/?lang=ko": { smallFirst: false, google: { label: "Google Play에서 다운로드", small: "다운로드" }, apple: { label: "App Store에서 다운로드", small: "다운로드" } },
    "/index_en.html?lang=en": { smallFirst: true, google: { label: "Get it on Google Play", small: "GET IT ON" }, apple: { label: "Download on the App Store", small: "Download on the" } },
    "/index_de.html?lang=de": { smallFirst: true, google: { label: "Jetzt bei Google Play", small: "JETZT BEI" }, apple: { label: "Im App Store laden", small: "Laden im" } },
    "/index_ja.html?lang=ja": { smallFirst: false, google: { label: "Google Play で手に入れよう", small: "で手に入れよう" }, apple: { label: "App Storeからダウンロード", small: "からダウンロード" } },
  };
  for (const [route, expected] of Object.entries(stores)) {
    await page.goto(route);
    const zone = page.locator('[data-project="quirky-ball"]');
    await zone.scrollIntoViewIfNeeded();
    await expect(page.locator(".hero-hook, .studio-signature")).toHaveCount(0);
    await expect(zone.locator(".release-actions a")).toHaveCount(2);
    await expect(zone.locator(".release-actions a.store-button")).toHaveCount(2);
    await expect(page.locator(".coming-soon-bubble")).toHaveCount(0);
    const apple = zone.locator("a.store-button.app-store-badge");
    const google = zone.locator("a.store-button.google-play-badge");
    await expect(apple).not.toHaveAttribute("aria-disabled", "true");
    await expect(apple).toHaveAttribute("href", "https://apps.apple.com/app/id6797996754");
    await expect(google).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.quirkyball.app");
    await expect(google).toHaveAttribute("aria-label", expected.google.label);
    await expect(apple).toHaveAttribute("aria-label", expected.apple.label);
    // Both are plain HTML buttons set in the site's type: an inline Play prism and an App Store mark, no bitmap badge artwork.
    await expect(google.locator("svg.store-icon path")).toHaveCount(4);
    await expect(apple.locator("svg.store-icon")).toHaveCount(1);
    await expect(zone.locator(".release-actions img")).toHaveCount(0);
    await expect(google.locator(".store-copy strong")).toHaveText("Google Play");
    await expect(apple.locator(".store-copy strong")).toHaveText("App Store");
    await expect(google.locator(".store-copy small")).toHaveText(expected.google.small);
    await expect(apple.locator(".store-copy small")).toHaveText(expected.apple.small);

    const metrics = await zone.evaluate((node, smallFirst) => {
      const box = (element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; };
      const google = box(node.querySelector(".google-play-badge"));
      const apple = box(node.querySelector(".app-store-badge"));
      const copy = node.querySelector(".hd-quirky-copy");
      const order = (button) => {
        const small = button.querySelector("small").getBoundingClientRect();
        const strong = button.querySelector("strong").getBoundingClientRect();
        return small.top < strong.top;
      };
      return {
        google, apple,
        disclosure: box(copy.querySelector(".store-disclosure")),
        lede: box(copy.querySelector(".hd-lede")),
        cta: box(copy.querySelector(".hd-keycap-cta")),
        smallFirst: { google: order(node.querySelector(".google-play-badge")), apple: order(node.querySelector(".app-store-badge")) },
        expectedSmallFirst: smallFirst,
        fonts: [...node.querySelectorAll(".store-copy strong")].map((strong) => getComputedStyle(strong).fontFamily),
        clipped: [...node.querySelectorAll(".store-button, .store-copy")].filter((item) => item.scrollWidth > item.clientWidth + 1).length,
      };
    }, expected.smallFirst);
    // Matching pair: same height and baseline row, a clear gap between them, whole inside the copy column and not squeezed.
    expect(metrics.google.height).toBe(metrics.apple.height);
    expect(Math.abs(metrics.google.top - metrics.apple.top)).toBeLessThan(1);
    expect(metrics.google.height, `${route} store button height`).toBeGreaterThanOrEqual(44);
    expect(metrics.apple.left - metrics.google.right, `${route} gap between the two buttons`).toBeGreaterThanOrEqual(8);
    expect(metrics.clipped, `${route} store text is not clipped`).toBe(0);
    expect(metrics.smallFirst, `${route} small line position`).toEqual({ google: metrics.expectedSmallFirst, apple: metrics.expectedSmallFirst });
    expect(metrics.fonts[0], `${route} both store names share one typeface`).toBe(metrics.fonts[1]);
    // Left edge lines up with the disclosure below; the lede sits above, the keycap link below.
    expect(Math.abs(metrics.google.left - metrics.disclosure.left)).toBeLessThan(1);
    expect(metrics.google.top, `${route} buttons sit under the lede`).toBeGreaterThan(metrics.lede.bottom);
    expect(metrics.disclosure.top, `${route} disclosure sits under the buttons`).toBeGreaterThanOrEqual(metrics.google.bottom);
    expect(metrics.cta.top, `${route} keycap link sits under the disclosure`).toBeGreaterThanOrEqual(metrics.disclosure.bottom);
  }
});

test("home header: dark House Duck bar, uppercase tracked nav, red dot before YouTube", async ({ page, isMobile }) => {
  test.skip(isMobile, "the nav collapses into the menu button on a phone");
  await page.goto("/?lang=ko");
  await jumpTo(page, 2400);
  await expect(page.locator("body")).not.toHaveAttribute("data-hd-over-hero", "");
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(17, 20, 25, 0.97)");
  const links = await page.locator(".site-nav > a").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    const dot = getComputedStyle(node, "::before");
    return { text: node.textContent, transform: style.textTransform, spacing: parseFloat(style.letterSpacing), dot: { content: dot.content, background: dot.backgroundColor, radius: dot.borderRadius, width: dot.width } };
  }));
  expect(links.map((link) => link.text)).toEqual(["YouTube", "Games", "Studio", "About", "Support"]);
  for (const link of links) {
    expect(link.transform, `${link.text} is uppercase`).toBe("uppercase");
    expect(link.spacing, `${link.text} is tracked`).toBeGreaterThan(1);
  }
  expect(links[0].dot.content).toBe('""');
  expect(links[0].dot.radius).toBe("50%");
  expect(links[0].dot.width).toBe("7px");
  expect(links[0].dot.background).not.toBe("rgba(0, 0, 0, 0)");
  for (const link of links.slice(1)) expect(link.dot.content, `${link.text} has no dot`).not.toBe('""');
});
