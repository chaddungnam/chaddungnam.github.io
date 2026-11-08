// Sharing (owner 2026-11-06): the share key + sheet on the 10key pages and the home's 10key section, the hero scroll cue, per-URL
// preview tags, no stale "level 15" demo text, and a light first screen (no gameplay video downloads before the visitor scrolls).
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const TENKEY = {
  ko: { url: "/10key/?lang=ko", share: "공유하기", copy: "링크 복사", canon: "https://houseduck.in/10key/" },
  en: { url: "/10key/index_en.html?lang=en", share: "Share", copy: "Copy link", canon: "https://houseduck.in/10key/index_en.html" },
  de: { url: "/10key/index_de.html?lang=de", share: "Teilen", copy: "Link kopieren", canon: "https://houseduck.in/10key/index_de.html" },
  ja: { url: "/10key/index_ja.html?lang=ja", share: "シェア", copy: "リンクをコピー", canon: "https://houseduck.in/10key/index_ja.html" },
  zh: { url: "/10key/index_zh.html?lang=zh", share: "分享", copy: "複製連結", canon: "https://houseduck.in/10key/index_zh.html" },
};
const KAKAO_UA = "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK 2511200";

async function quiet(page) {
  await page.addInitScript(() => { try { localStorage.setItem("hd_ads_consent", "denied"); } catch (e) {} });
  await page.route(/kakaocdn\.net/, (r) => r.abort()); // the suite never needs the network (nor the real Kakao key)
}
// stub the phone share sheet (calls end up in window.__shared) and the clipboard (window.__copied)
async function stubs(page, { share = true, files = true } = {}) {
  await page.addInitScript(({ share, files }) => {
    window.__shared = []; window.__copied = [];
    if (share) {
      navigator.share = (d) => { window.__shared.push({ title: d.title, text: d.text, url: d.url, files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }); return Promise.resolve(); };
      navigator.canShare = (d) => !(d && d.files) || files;
    } else { try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch (e) {} }
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
  }, { share, files });
}

for (const [lang, c] of Object.entries(TENKEY)) {
  test(`10key ${lang}: share key sends the picture + text + link through the phone share sheet`, async ({ page }) => {
    await quiet(page); await stubs(page);
    await page.goto(c.url);
    const row = page.locator("[data-share-row]");
    await expect(row).toBeVisible();
    const key = row.locator("[data-share-open]");
    await expect(key).toHaveText(c.share);
    await expect(row.locator("[data-share-copy]")).toHaveText(c.copy);
    await key.hover(); // starts loading the picture
    await key.click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const s = await page.evaluate(() => window.__shared[0]);
    expect(s.url).toBe(c.canon);
    expect(s.text.length).toBeGreaterThan(20);
    expect(s.files).toHaveLength(1);
    expect(s.files[0].type).toBe("image/png");
    await expect(page.locator("dialog.hd-share[open]")).toHaveCount(0);
  });
}

test("share falls back: no file support -> text + link only; no share api -> the sheet", async ({ page }) => {
  await quiet(page); await stubs(page, { share: true, files: false });
  await page.goto(TENKEY.en.url);
  await page.locator("[data-share-open]").click();
  await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
  expect((await page.evaluate(() => window.__shared[0])).files).toHaveLength(0);
  expect((await page.evaluate(() => window.__shared[0])).url).toBe(TENKEY.en.canon);
});

test("share sheet (no phone share): X, Threads, copy text, save picture; copied state; Esc closes and focus returns", async ({ page }) => {
  await quiet(page); await stubs(page, { share: false });
  await page.goto(TENKEY.en.url);
  const open = page.locator("[data-share-open]");
  await open.click();
  const dlg = page.locator("dialog.hd-share");
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute("aria-labelledby", "hd-share-title");
  await expect(dlg.locator("img")).toHaveAttribute("src", /tenkey-share-en\.png$/);
  const x = dlg.getByRole("link", { name: "Post on X" });
  expect(await x.getAttribute("href")).toContain("twitter.com/intent/tweet?text=");
  expect(decodeURIComponent(await x.getAttribute("href"))).toContain(TENKEY.en.canon);
  const th = dlg.getByRole("link", { name: "Post on Threads" });
  expect(await th.getAttribute("href")).toContain("threads.net/intent/post?text=");
  const save = dlg.getByRole("link", { name: "Save picture" });
  await expect(save).toHaveAttribute("download", /png$/);
  const copyAll = dlg.locator("li[data-k=copyAll] button");
  await expect(copyAll).toBeVisible();
  await copyAll.click();
  await expect(copyAll).toHaveText("Copied");
  expect((await page.evaluate(() => window.__copied[0]))).toContain(TENKEY.en.canon);
  await expect(dlg.locator("[role=status]")).toHaveText("Copied.");
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(open).toBeFocused();
});

test("KakaoTalk in-app browser: the sheet opens first, copy leads, the picture says long-press to save", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: KAKAO_UA, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await quiet(page); await stubs(page, { share: true });
  await page.goto(TENKEY.ko.url);
  await page.locator("[data-share-open]").click();
  const dlg = page.locator("dialog.hd-share");
  await expect(dlg).toBeVisible();
  expect(await page.evaluate(() => window.__shared.length)).toBe(0);
  await expect(dlg.locator(".hd-share-item").first()).toHaveText("글과 링크 복사");
  await expect(dlg.locator("figcaption")).toContainText("길게 눌러 저장");
  await ctx.close();
});

test("copy link key is always visible and shows the copied state", async ({ page }) => {
  await quiet(page); await stubs(page);
  await page.goto(TENKEY.ko.url);
  const copy = page.locator("[data-share-copy]");
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(copy).toHaveText("복사됨");
  expect(await page.evaluate(() => window.__copied[0])).toBe("https://houseduck.in/10key/");
  await expect(copy).toHaveText("링크 복사", { timeout: 4000 });
});

for (const [file, lang, share] of [["/?lang=ko", "ko", "공유하기"], ["/index_en.html?lang=en", "en", "Share"], ["/index_de.html?lang=de", "de", "Teilen"], ["/index_ja.html?lang=ja", "ja", "シェア"]]) {
  test(`home ${lang}: the 10key section has the share + copy keys and shares the 10key page`, async ({ page }) => {
    await quiet(page); await stubs(page);
    await page.goto(file);
    const key = page.locator("[data-share-open]");
    await key.scrollIntoViewIfNeeded();
    await expect(key).toHaveText(share);
    await key.click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    expect((await page.evaluate(() => window.__shared[0].url))).toBe(TENKEY[lang].canon);
  });
}

test("home hero: a blinking pixel triangle under the hero taps down to the 10key section; steady with reduced motion", async ({ page, browser }) => {
  await quiet(page);
  await page.goto("/?lang=ko");
  const cue = page.locator(".hd-scroll-cue");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveJSProperty("tagName", "BUTTON");
  expect(await cue.getAttribute("aria-label")).toBeTruthy();
  expect(await page.locator(".hd-scroll-cue-tri").evaluate((e) => getComputedStyle(e).animationTimingFunction)).toContain("steps");
  await cue.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const p2 = await ctx.newPage(); await p2.goto("/?lang=ko");
  expect(await p2.locator(".hd-scroll-cue-tri").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await ctx.close();
});

test("first screen is light: no gameplay video or other-orientation art before the visitor scrolls", async ({ page }) => {
  await quiet(page);
  const urls = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto("/?lang=ko");
  await page.waitForTimeout(2500);
  expect(urls.filter((u) => /comrade-gameplay\.mp4|quirky-ball\/v2\/loop\.mp4|assets\/media\/tenkey-gameplay\.mp4|desk-quirky\.mp4/.test(u))).toEqual([]);
  expect(urls.some((u) => /desk-tenkey\.mp4/.test(u))).toBe(true);
  expect(urls.some((u) => /desk-(landscape|portrait)\.webp/.test(u))).toBe(true);
  expect(urls.filter((u) => /desk-[a-z]+\.png/.test(u))).toEqual([]);
  expect(urls.filter((u) => /Montserrat-Variable\.woff2/.test(u))).toEqual([]);
  expect(urls.filter((u) => /^https?:\/\/[^/]*kakao/i.test(u))).toEqual([]); // the Kakao SDK waits for a visitor who reaches for the Kakao key
});

// ---- KakaoTalk share (owner 2026-11-08): Korean pages only, the SDK only on intent, never a key that does nothing ----
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js";
const KAKAO_SRI = "sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w";
const FAKE_KEY = "0123456789abcdef0123456789abcdef";
// serve share-sheet.js with KAKAO_JS_KEY set to `key` (whatever the real file holds)
async function kakaoKey(page, key) {
  await page.route(/\/assets\/share-sheet\.js/, async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const out = body.replace(/var KAKAO_JS_KEY = "[^"]*";/, `var KAKAO_JS_KEY = "${key}";`);
    if (!/var KAKAO_JS_KEY = "[^"]*";/.test(body)) throw new Error("share-sheet.js has no KAKAO_JS_KEY line");
    await route.fulfill({ response: res, body: out });
  });
}
// a stand-in Kakao SDK shaped like the real 2.8.4 (Kakao.Share appears only after Kakao.init);
// window.Kakao already there = share-sheet.js does not fetch the real one
async function fakeKakao(page) {
  await page.addInitScript(() => {
    window.__kakao = { init: [], sent: [] };
    window.Kakao = { _k: null, isInitialized() { return !!this._k; }, init(k) { this._k = k; window.__kakao.init.push(k); this.Share = { sendDefault(o) { window.__kakao.sent.push(JSON.parse(JSON.stringify(o))); } }; } };
  });
}
const KAKAO_HOST = /^https?:\/\/[^/]*kakao/i; // a request to any Kakao server (kakaocdn.net, kakao.com)
function kakaoRequests(page) { const urls = []; page.on("request", (r) => { if (KAKAO_HOST.test(r.url())) urls.push(r.url()); }); return urls; }

for (const [where, url, canon] of [["10key", TENKEY.ko.url, TENKEY.ko.canon], ["home", "/?lang=ko", TENKEY.ko.canon]]) {
  test(`KakaoTalk ${where} ko (key set): "카카오톡으로 공유" in the row sends a feed with the ko picture, text and link`, async ({ page }) => {
    await quiet(page); await stubs(page); await kakaoKey(page, FAKE_KEY); await fakeKakao(page);
    await page.goto(url);
    const row = page.locator("[data-share-row]");
    const k = row.locator("[data-share-kakao]");
    await k.scrollIntoViewIfNeeded();
    await expect(k).toBeVisible();
    await expect(k).toHaveText("카카오톡으로 공유");
    await expect(row.locator("button")).toHaveText(["공유하기", "링크 복사", "카카오톡으로 공유"]);
    await k.click();
    await expect.poll(() => page.evaluate(() => window.__kakao.sent.length)).toBe(1);
    expect(await page.evaluate(() => window.__kakao.init)).toEqual([FAKE_KEY]);
    const o = await page.evaluate(() => window.__kakao.sent[0]);
    expect(o.objectType).toBe("feed");
    expect(o.content.title).toBe("딸깍 서바이벌");
    expect(o.content.description).toContain("사전예약");
    expect(o.content.imageUrl).toBe("https://houseduck.in/assets/media/share/tenkey-share-ko.png");
    expect([o.content.imageWidth, o.content.imageHeight]).toEqual([1200, 630]);
    expect(o.content.link).toEqual({ webUrl: canon, mobileWebUrl: canon });
    expect(o.buttons).toEqual([{ title: "자세히 보기", link: { webUrl: canon, mobileWebUrl: canon } }]);
    expect(await page.evaluate(() => window.__shared.length)).toBe(0); // the phone share sheet stays shut
  });
}

test("KakaoTalk ko (key set): the share sheet has the Kakao entry right after the first one, also in the KakaoTalk app", async ({ page, browser }) => {
  await quiet(page); await stubs(page, { share: false }); await kakaoKey(page, FAKE_KEY); await fakeKakao(page);
  await page.goto(TENKEY.ko.url);
  await page.locator("[data-share-open]").click();
  const dlg = page.locator("dialog.hd-share");
  await expect(dlg).toBeVisible();
  await expect(dlg.locator(".hd-share-item").nth(1)).toHaveText("카카오톡으로 공유");
  await dlg.locator("li[data-k=kakao] button").click();
  await expect.poll(() => page.evaluate(() => window.__kakao.sent.length)).toBe(1);
  expect((await page.evaluate(() => window.__kakao.sent[0])).content.link.webUrl).toBe(TENKEY.ko.canon);

  const ctx = await browser.newContext({ userAgent: KAKAO_UA, viewport: { width: 390, height: 844 } });
  const p2 = await ctx.newPage();
  await quiet(p2); await stubs(p2, { share: true }); await kakaoKey(p2, FAKE_KEY); await fakeKakao(p2);
  await p2.goto(TENKEY.ko.url);
  await p2.locator("[data-share-open]").click();
  const d2 = p2.locator("dialog.hd-share");
  await expect(d2.locator(".hd-share-item")).toHaveText(["글과 링크 복사", "카카오톡으로 공유", "링크 복사", "휴대폰 공유창", "X에 올리기", "Threads에 올리기", "그림 저장"]);
  await ctx.close();
});

for (const [where, url] of [["10key en", TENKEY.en.url], ["10key de", TENKEY.de.url], ["10key ja", TENKEY.ja.url], ["10key zh", TENKEY.zh.url], ["home en", "/index_en.html?lang=en"], ["home de", "/index_de.html?lang=de"], ["home ja", "/index_ja.html?lang=ja"]]) {
  test(`KakaoTalk never on ${where}, even with a key: not in the row, not in the sheet, no Kakao request`, async ({ page }) => {
    await quiet(page); await stubs(page, { share: false }); await kakaoKey(page, FAKE_KEY); await fakeKakao(page);
    const urls = kakaoRequests(page);
    await page.goto(url);
    const row = page.locator("[data-share-row]");
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    await expect(row.locator("button")).toHaveCount(2);
    await row.locator("[data-share-open]").click();
    const dlg = page.locator("dialog.hd-share");
    await expect(dlg).toBeVisible();
    await expect(page.locator("[data-share-kakao], li[data-k=kakao]")).toHaveCount(0);
    await expect(dlg).not.toContainText("카카오톡으로 공유");
    expect(await page.evaluate(() => window.__kakao.init)).toEqual([]);
    expect(urls).toEqual([]);
  });
}

test("KakaoTalk ko without a key: no Kakao key in the row or the sheet and no Kakao request", async ({ page }) => {
  await quiet(page); await stubs(page, { share: false }); await kakaoKey(page, ""); await fakeKakao(page);
  const urls = kakaoRequests(page);
  await page.goto(TENKEY.ko.url);
  const row = page.locator("[data-share-row]");
  await expect(row).toBeVisible();
  await expect(row.locator("button")).toHaveText(["공유하기", "링크 복사"]);
  await row.locator("[data-share-open]").click();
  await expect(page.locator("dialog.hd-share")).toBeVisible();
  await expect(page.locator("[data-share-kakao], li[data-k=kakao]")).toHaveCount(0);
  expect(await page.evaluate(() => window.__kakao.init)).toEqual([]);
  expect(urls).toEqual([]);
});

test("KakaoTalk SDK: nothing from Kakao at page load; on intent the pinned SDK with its integrity hash; if it fails the key goes and the sheet opens", async ({ page }) => {
  await quiet(page); await stubs(page, { share: false }); await kakaoKey(page, FAKE_KEY);
  // the SDK "fails" (blocked) a moment after it is asked for, as an ad blocker or a dead network would
  await page.route(/kakaocdn\.net/, async (r) => { await new Promise((res) => setTimeout(res, 400)); await r.abort(); });
  const urls = kakaoRequests(page);
  await page.goto(TENKEY.ko.url);
  const k = page.locator("[data-share-row] [data-share-kakao]");
  await expect(k).toBeVisible();
  await page.waitForTimeout(800);
  expect(urls).toEqual([]);
  await k.click();
  await expect.poll(() => urls.length).toBeGreaterThan(0);
  expect(urls[0]).toBe(KAKAO_SDK);
  const s = page.locator(`script[src="${KAKAO_SDK}"]`);
  await expect(s).toHaveAttribute("integrity", KAKAO_SRI);
  await expect(s).toHaveAttribute("crossorigin", "anonymous");
  const dlg = page.locator("dialog.hd-share");
  await expect(dlg).toBeVisible();
  await expect(page.locator("[data-share-kakao], li[data-k=kakao]")).toHaveCount(0);
  expect(urls.filter((u) => u === KAKAO_SDK)).toHaveLength(1);
});

// ---- public files ----
const PAGES = {
  home: ["index.html", "index_en.html", "index_de.html", "index_ja.html"],
  tenkey: ["10key/index.html", "10key/index_en.html", "10key/index_de.html", "10key/index_ja.html", "10key/index_zh.html"],
  quirky: ["quirky-ball/index.html", "quirky-ball/index_en.html", "quirky-ball/index_de.html", "quirky-ball/index_ja.html"],
  comrade: ["hexaworld1984/index.html", "hexaworld1984/index_ko.html", "hexaworld1984/index_en.html", "hexaworld1984/index_de.html", "hexaworld1984/index_ja.html"],
  about: ["about/index.html", "about/index_en.html", "about/index_de.html", "about/index_ja.html"],
};
const LOCALE = { ko: "ko_KR", en: "en_US", de: "de_DE", ja: "ja_JP", "zh-Hant": "zh_TW" };
const tag = (h, re) => { const m = h.match(re); return m ? m[1].replace(/&amp;/g, "&") : null; };

test("every public page has its own preview: og title / description / url / image (+size, alt) / locale, twitter card, canonical", async () => {
  const urls = new Set(), descs = new Set();
  for (const file of Object.values(PAGES).flat()) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    const head = html.split("</head>")[0];
    const lang = tag(html, /<html[^>]*lang="([^"]+)"/);
    const og = (k) => tag(head, new RegExp(`<meta property="og:${k}" content="([^"]*)"`));
    const canon = tag(head, /<link rel="canonical" href="([^"]*)"/);
    expect(canon, file).toBeTruthy();
    expect(og("url"), file).toBe(canon);
    expect(urls.has(canon), `${file} duplicates a URL`).toBe(false); urls.add(canon);
    expect(og("title"), file).toBeTruthy();
    expect(og("description"), file).toBeTruthy();
    expect(descs.has(og("description")), `${file} reuses another page's description`).toBe(false); descs.add(og("description"));
    expect(og("locale"), file).toBe(LOCALE[lang] || LOCALE[lang.slice(0, 2)]);
    expect(og("type"), file).toBe("website");
    expect(og("image"), file).toMatch(/^https:\/\/houseduck\.in\/.+\.(png|jpg)$/);
    expect(og("image:width"), file).toMatch(/^\d+$/);
    expect(og("image:height"), file).toMatch(/^\d+$/);
    expect(og("image:alt"), file).toBeTruthy();
    expect(head, file).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(fs.existsSync(path.join(ROOT, og("image").replace("https://houseduck.in/", ""))), `${file} image missing`).toBe(true);
    expect((head.match(/<meta property="og:title"/g) || []).length, file).toBe(1);
    expect((head.match(/rel="canonical"/g) || []).length, file).toBe(1);
  }
  for (const l of ["ko", "en", "de", "ja", "zh"]) {
    const buf = fs.readFileSync(path.join(ROOT, `assets/media/share/tenkey-share-${l}.png`));
    expect(buf.readUInt32BE(16), l).toBe(1200); expect(buf.readUInt32BE(20), l).toBe(630);
  }
});

test("no stale demo limit: nothing on the site says the demo goes up to level 15", async () => {
  const bad = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    if (["node_modules", "test-results", ".git"].includes(e.name)) return;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|js|txt|json|md|py|css)$/.test(e.name) && !/^share-sheet\.spec/.test(e.name) && fs.readFileSync(p, "utf8").match(/level 15|레벨 ?15|Lv ?15|stufe 15|レベル15|第 15 關/i)) bad.push(path.relative(ROOT, p));
  });
  walk(ROOT);
  expect(bad).toEqual([]);
});
