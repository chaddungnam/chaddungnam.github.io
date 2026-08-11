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
  await expect(page.locator(".manifesto-action")).toHaveText(/블로그 보러가기/);
  await expect(page.locator(".quirky-sticker img")).toHaveAttribute("src", /assets\/media\/quirky-character\.svg/);
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toHaveCSS("width", "132px");
  await expect(page.locator(".type-cursor")).toHaveCount(0);
  await expect(page.locator(".nav-featured")).toHaveCount(2);
  await expect(page.locator("[data-game-preview]")).toHaveCount(2);
  await expect(page.locator(".phone-side-button")).toHaveCount(4);
  await expect(page.locator(".phone-home-indicator")).toHaveCount(2);
  await expect(page.locator("[data-section='blog-posts']")).toBeVisible();
  await expect(page.locator("#journal-title")).toHaveText("하우스덕 개발 블로그");
  await expect(page.locator(".history-section")).toBeVisible();
  await expect(page.locator(".site-nav a", { hasText: "About" })).toHaveAttribute("href", "#history");
  await expect(page.locator(".history-section")).toHaveAttribute("id", "history");
  await expect(page.locator(".history-number")).toHaveText("02");
  await expect(page.locator(".history-event")).toHaveCount(4);
  await expect(page.locator(".history-heading")).toHaveAttribute("data-reveal-delay", "0");
  expect(await page.locator(".history-event").evaluateAll((nodes) => nodes.map((node) => node.dataset.revealDelay))).toEqual(["90", "180", "270", "360"]);
  await expect(page.locator(".post-preview-card:not(.post-preview-empty)")).toHaveCount(6);
  await expect(page.locator(".post-preview-card-wide")).toHaveCount(3);

  if (!isMobile) {
    await page.waitForTimeout(900);
    const bubble = await page.locator(".manifesto-bubble").boundingBox();
    const bubbleSpacing = await page.locator(".manifesto-bubble").evaluate((node) => {
      const bubbleBox = node.getBoundingClientRect();
      const boxes = Array.from(node.querySelectorAll(".manifesto-mark, .quirky-sticker, .manifesto-dialogue, .manifesto-action"), (child) => child.getBoundingClientRect());
      return {
        top: Math.min(...boxes.map((box) => box.top)) - bubbleBox.top,
        bottom: bubbleBox.bottom - Math.max(...boxes.map((box) => box.bottom), bubbleBox.top),
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
    const mark = await page.locator(".manifesto-mark").boundingBox();
    const quirky = await page.locator(".quirky-sticker").boundingBox();
    const note = await page.locator(".manifesto-note").boundingBox();
    const action = await page.locator(".manifesto-action").boundingBox();
    expect(quirky.x).toBeGreaterThan(mark.x + mark.width);
    expect(Math.abs(quirky.y - mark.y)).toBeLessThan(12);
    expect(action.y).toBeGreaterThanOrEqual(note.y + note.height);
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
    const bubbleAnimation = await page.locator(".manifesto-bubble").evaluate((node) => getComputedStyle(node).animationName);
    expect(bubbleAnimation).toContain("studio-bubble-breathe");
    expect(bubbleAnimation).not.toContain("studio-bubble-float");
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
  await expect(page.locator(".mirror-manifesto .manifesto-bubble")).toContainText("House Duck's Blog,");
  await expect(page.locator(".mirror-manifesto .manifesto-action")).toHaveText(/메인 페이지 보러가기/);
  await expect(page.locator(".mirror-manifesto [data-game-preview]")).toHaveCount(2);
});

test("foreign House Duck pages keep readers in their selected Blog language", async ({ page }) => {
  for (const locale of ["en", "de", "ja"]) {
    await page.goto(`/index_${locale}.html?lang=${locale}`);
    await expect(page.locator(".nav-blog")).toHaveAttribute("href", `blog/${locale}/`);
    await expect(page.locator(".manifesto-action")).toHaveAttribute("href", `blog/${locale}/`);
    await expect(page.locator(".journal-section .text-link")).toHaveAttribute("href", `blog/${locale}/`);
    for (const route of [`/about/index_${locale}.html`, `/quirky-ball/index_${locale}.html`, `/project-k/index_${locale}.html`]) {
      await page.goto(route);
      await expect(page.locator("[data-site-nav] a", { hasText: "Blog" })).toHaveAttribute("href", `../blog/${locale}/`);
    }
  }
});

test("Quirky Ball presents the current build as a responsive candy-neon showcase", async ({ page, isMobile }) => {
  await page.goto("/quirky-ball/?lang=ko");
  await expect(page.locator(".brand-lockup .brand-duck-image")).toBeVisible();
  await expect(page.locator(".brand-lockup .brand-wordmark-image")).toBeVisible();
  if (isMobile) await page.locator("[data-menu-button]").click();
  await expect(page.locator("[data-theme-toggle]")).toBeVisible();
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

  await page.locator("[data-theme-toggle]").click();
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

test("editorial section numbers stay visible without taking over the layout", async ({ page }) => {
  await page.goto("/?lang=ko");
  const homeNumbers = await page.evaluate(() => ({
    games: getComputedStyle(document.querySelector(".device-stage"), "::before").content,
    blog: getComputedStyle(document.querySelector(".journal-section"), "::before").content,
    history: document.querySelector(".history-number").textContent,
  }));
  expect(homeNumbers).toEqual({ games: "none", blog: '"01"', history: "02" });

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
  const businessLink = footer.getByRole("link", { name: /business@houseduck\.in/ });
  await expect(businessLink).toHaveAttribute("href", "mailto:business@houseduck.in");
  await expect(businessLink).toHaveCSS("text-transform", "none");
  await expect(footer.getByRole("link", { name: /business@houseduck\.in/ })).toHaveText(/business@houseduck\.in/);
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

test("journal cards stay fully visible and type their previews quickly", async ({ page }) => {
  await page.goto("/?lang=ko");
  const lastHomeCard = page.locator(".post-preview-card:not(.post-preview-empty)").last();
  expect(await lastHomeCard.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  await lastHomeCard.scrollIntoViewIfNeeded();
  await expect(lastHomeCard.locator("[data-preview-type]")).toHaveCount(2);
  await expect(lastHomeCard.locator("[data-preview-type][data-typed='true']")).toHaveCount(2, { timeout: 4000 });

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
