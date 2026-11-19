// 10key Survival page (2026-10-28, the itch.io page's look): it is a paid iOS/Android app, so the first screen is the app
// pre-registration form, which posts a sign-up to the tenkey-prereg edge function (mocked here, no real mail; single step since
// 2026-10-30: submitting is the pre-registration); the
// browser build on itch.io sits under it as the free preview. The page states the module odds as text. Also /10key/prereg/ and /10key/get/.
const { test, expect } = require("@playwright/test");

const FN = "https://frepunpqswciugwoyvxo.supabase.co/functions/v1/tenkey-prereg";
// Since 2026-11-18 18:00 Berlin the pages show the launch version (pre-registration closed, owner 2026-11-18; switch in
// assets/tenkey-launch.js). The pre-registration version is still in the pages for the time before that moment, so its
// tests run with the clock pinned before the switch; launch tests set their own time.
const BEFORE_SWITCH = new Date("2026-11-18T12:00:00+01:00");
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(BEFORE_SWITCH); });

for (const [url, words] of Object.entries({
  "/10key/?lang=ko": { preview: "itch.io에서 데모 플레이하기", perk: "사전예약 특전", gate: "사전예약하고 itch.io에서 데모 플레이", popup: "사전예약을 하면 itch.io에서 데모(레벨 8까지)를 플레이할 수 있어요", paid: "유료 · 인앱 구매 있음", go: "사전예약하러 가기", odds: "odds/ko.html", submit: "사전예약하기", ok: "사전예약 완료!", invalid: "이메일 주소를 다시 확인해 주세요", consent: "동의 항목에 체크해 주세요" },
  "/10key/index_en.html?lang=en": { preview: "Play the demo on itch.io", perk: "Pre-registration perk", gate: "Pre-register to play the demo on itch.io", popup: "Pre-register and you can play the demo (up to level 8) on itch.io", paid: "Paid app · In-app purchases", go: "Go to pre-registration", odds: "odds/en.html", submit: "Pre-register", ok: "You are pre-registered!", invalid: "Please check your email address", consent: "Please tick the consent box" },
})) {
  test(`pre-registration is visible at once and signs up, itch.io is the free preview, the odds are text (${url})`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    const posts = [];
    await page.route(FN, async (route) => {
      posts.push({ body: route.request().postData(), type: route.request().headers()["content-type"] });
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' });
    });
    await page.goto(url);
    const card = page.locator("#prereg");
    await expect(card).toBeInViewport();
    await expect(card.getByRole("button", { name: words.submit })).toBeInViewport();
    await expect(card).not.toContainText(/유료|무료|paid|free/i);
    // the paid-app note sits right under the card (owner 11-03 night): paid app with in-app purchases, itch.io a free demo, no price
    await expect(page.locator(".tk-hero .tk-paid-chip")).toHaveText(words.paid);
    await expect(page.locator(".tk-hero .tk-paid")).toContainText("8");
    await expect(page.locator(".tk-hero .tk-paid")).not.toContainText(/\$|USD|달러|dollar|€|円/);
    // where to play (owner 11-04): computer = itch.io demo, best on a PC; phone = Google Play / App Store, coming soon
    await expect(page.locator(".tk-hero .tk-where li:visible")).toHaveCount(2);
    await expect(page.locator(".tk-hero .tk-where")).toContainText("PC");
    await expect(page.locator(".tk-hero .tk-where")).toContainText("App Store");
    // itch.io play is a pre-registration perk (owner 11-03): before sign-up the hero shows a locked line, not the link
    const preview = page.locator(".tk-hero [data-itch-unlock] .tk-preview");
    await expect(page.locator(".tk-hero .tk-perk")).toBeVisible();
    await expect(page.locator(".tk-hero .tk-perk")).toContainText(words.perk);
    await expect(preview).toBeHidden();
    const gate = page.locator(".tk-final-links a[data-itch-gate]");
    await expect(gate).toHaveText(words.gate);
    await expect(gate).toHaveAttribute("href", "#prereg");
    await expect(page.locator(".tk-nav a[data-itch-gate]")).toHaveAttribute("href", "#prereg");
    await expect(page.locator("a[href='https://houseduck.itch.io/10key-survival']:visible")).toHaveCount(0);
    // a locked demo button opens the popup; its button goes to the form
    await gate.click();
    const popup = page.locator("dialog[data-itch-popup]");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(words.popup);
    await popup.getByRole("button", { name: words.go }).click();
    await expect(popup).toBeHidden();
    await expect(card.locator("input[name=email]")).toBeFocused();
    await expect(page).toHaveURL(/#prereg$/);
    await expect(page.locator(".tk-hero .tk-key, .tk-hero .tk-preview:not(#download .tk-preview)")).toHaveCount(2);
    await expect(page.locator(".tk-odds-table")).toHaveCount(0);
    await expect(page.locator(`#odds-info a[href='${words.odds}']`)).toHaveCount(1);

    await card.locator("input[name=email]").fill("not-an-email");
    await card.getByRole("button", { name: words.submit }).click();
    await expect(card.locator("[data-prereg-status]")).toContainText(words.invalid);

    await card.locator("input[name=email]").fill("player@example.com");
    await card.getByRole("button", { name: words.submit }).click();
    await expect(card.locator("[data-prereg-status]")).toContainText(words.consent);
    expect(posts).toHaveLength(0);

    await card.locator("input[name=consent]").check();
    await card.getByRole("button", { name: words.submit }).click();
    await expect(card.locator("[data-prereg-status]")).toContainText(words.ok);
    expect(posts).toHaveLength(1);
    expect(posts[0].type).toContain("text/plain");
    const sent = JSON.parse(posts[0].body);
    expect(sent).toMatchObject({ v: 1, action: "signup", email: "player@example.com", locale: url.includes("ko") ? "ko" : "en", consent: "2026-11-04b", hp: "" });
    await expect(card.locator("input[name=email]")).toBeHidden();
    // after sign-up the itch.io link shows, the gated links open itch.io, and this browser remembers it
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText(words.preview);
    await expect(preview).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
    await expect(page.locator(".tk-hero .tk-perk")).toBeHidden();
    await expect(gate).toHaveText(words.preview);
    await expect(gate).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
    await page.reload();
    await expect(page.locator(".tk-hero [data-itch-unlock] .tk-preview")).toBeVisible();
    await expect(page.locator(".tk-nav a[data-itch-gate]")).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
  });
}

for (const [home, [form, language]] of Object.entries({ "/?lang=ko": ["/10key/", "ko-KR"], "/index_en.html?lang=en": ["/10key/index_en.html", "en-US"] })) {
  test(`the home's big pre-registration key opens the form on the 10key page (${home})`, async ({ page }) => {
    // /10key/ sends browsers that are not set to Korean to the English page, so the Korean case browses in Korean
    await page.addInitScript((value) => Object.defineProperty(navigator, "language", { get: () => value }), language);
    await page.goto(home);
    const key = page.locator("#games a.hd-tk-prereg");
    await key.scrollIntoViewIfNeeded();
    await key.click();
    await expect(page).toHaveURL(new RegExp(`${form.replace(/[./]/g, "\\$&")}(\\?[^#]*)?#prereg$`));
    await expect(page.locator("#prereg")).toBeInViewport();
    await expect(page.locator("#prereg input[name=email]")).toBeInViewport();
  });
}

for (const [url, offline] of Object.entries({ "/10key/?lang=ko": "사전예약 기능을 불러오지 못했어요", "/10key/index_en.html?lang=en": "The pre-registration could not load" })) {
  test(`without its script the form never submits and never puts the email in the address bar (${url})`, async ({ page }) => {
    const posts = [];
    await page.route(FN, (route) => { posts.push(route.request().postData()); route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' }); });
    await page.route(/\/assets\/tenkey-page\.js/, (route) => route.abort());
    const navigations = [];
    page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    await page.goto(url);
    const card = page.locator("#prereg");
    const button = card.locator("button[type=submit]");
    await expect(button).toBeDisabled();
    await expect(card.locator("[data-prereg-status]")).toContainText(offline);
    await expect(card).toHaveClass(/is-offline/);
    await card.locator("input[name=email]").fill("player@example.com");
    await card.locator("input[name=consent]").check();
    await button.click({ force: true });
    await card.locator("input[name=email]").press("Enter");
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain("player");
    expect(page.url()).not.toContain("email=");
    expect(navigations).toHaveLength(1);
    expect(posts).toHaveLength(0);
  });
}

test("with its script the form is ready: the button is enabled and no offline note shows", async ({ page }) => {
  await page.goto("/10key/?lang=ko");
  const card = page.locator("#prereg");
  await expect(card).toHaveAttribute("data-ready", "");
  await expect(card.locator("button[type=submit]")).toBeEnabled();
  await expect(card.locator("[data-prereg-status]")).toHaveText("");
  await expect(card).not.toHaveClass(/is-offline/);
  await expect(card.locator("form")).toHaveAttribute("method", "post");
});

test("confirm link page confirms through the function", async ({ page }) => {
  await page.route(FN, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true,"locale":"ko"}' }));
  await page.goto("/10key/prereg/?a=confirm&t=11111111-2222-4333-8444-555555555555&lang=ko");
  await expect(page.locator("h1")).toHaveText("사전예약 완료!");
});

test("download link page waits for launch and points to the game page (pre-registration closed)", async ({ page }) => {
  await page.goto("/10key/get/?lang=en");
  await expect(page.locator("h1")).toHaveText("Not out yet");
  await expect(page.locator("[data-store]:visible")).toHaveCount(0);
  await expect(page.locator("[data-show-prereg]")).toHaveAttribute("href", "/10key/index_en.html?lang=en");
  await expect(page.locator("[data-show-prereg]")).toHaveText("About the game");
});

// Mail language follows the House Duck page language (owner 2026-10-30): the de/ja home links carry ?lang=de|ja.
for (const [home, locale, ok] of [["/index_de.html?lang=de", "de", "Du bist vorregistriert!"], ["/index_ja.html?lang=ja", "ja", "事前登録が完了しました！"]]) {
  test(`the ${locale} home sends visitors to the form with ?lang=${locale} and the sign-up asks for ${locale} mail`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    const posts = [];
    await page.route(FN, (route) => { posts.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' }); });
    await page.goto(home);
    const key = page.locator("#games a.hd-tk-prereg");
    await expect(key).toHaveAttribute("href", `10key/index_${locale}.html?lang=${locale}#prereg`);
    await page.goto(`/10key/index_en.html?lang=${locale}#prereg`); // old link: moves to the ${locale} page (owner 2026-11-04)
    const card = page.locator("#prereg");
    await card.locator("input[name=email]").fill("player@example.com");
    await card.locator("input[name=consent]").check();
    await card.locator("button[type=submit]").click();
    await expect(card.locator("[data-prereg-status]")).toContainText(ok);
    expect(posts[0].locale).toBe(locale);
  });
}

// Google Ads measurement, consent mode "advanced" (owner 2026-10-31). Before an answer the tag loads with every storage denied
// (cookieless signals only) and a pre-registration is counted; "Allow" grants ad_storage; "Decline" stops the signals and
// keeps Google away on later visits. The email address is never sent.
const GOOGLE = /googletagmanager\.com|google\.com|doubleclick\.net|googleadservices\.com/;
const layerOf = (page) => page.evaluate(() => JSON.stringify((window.dataLayer || []).map((a) => Array.from(a))));

test("ads measurement: before an answer only cookieless signals, and the pre-registration is counted", async ({ page }) => {
  const google = [];
  await page.route(GOOGLE, (route) => { google.push(route.request().url()); route.fulfill({ status: 200, contentType: "text/javascript", body: "" }); });
  await page.route(FN, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' }));
  await page.goto("/10key/?lang=ko&gclid=TeSter-123");
  await expect(page.locator(".tk-adsbar")).toBeVisible();
  await expect.poll(() => google.length).toBeGreaterThan(0);
  expect(google[0]).toContain("gtag/js?id=AW-18020492251");
  let layer = await layerOf(page);
  expect(layer).toContain('"consent","default",{"ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied","analytics_storage":"denied"}');
  expect(layer).toContain('"set","ads_data_redaction",false');
  const card = page.locator("#prereg");
  await card.locator("input[name=email]").fill("player@example.com");
  await card.locator("input[name=consent]").check();
  await card.getByRole("button", { name: "사전예약하기" }).click();
  await expect(card.locator("[data-prereg-status]")).toContainText("사전예약 완료!");
  layer = await layerOf(page);
  expect(layer.match(/"conversion",\{"send_to":"AW-18020492251\/h5j8CPjd7K4dENvH65BD"\}/g)).toHaveLength(1);
  expect(layer).not.toContain("player@example.com");
  // "Allow" afterwards adds the cookie, without counting the pre-registration twice
  await page.locator(".tk-adsbar").getByRole("button", { name: "허용" }).click();
  layer = await layerOf(page);
  expect(layer).toContain('"consent","update",{"ad_storage":"granted"}');
  expect(layer.match(/"conversion"/g)).toHaveLength(1);
  // remembered: the next visit starts with ad_storage granted and no bar; the footer link reopens it
  await page.reload();
  await expect(page.locator(".tk-adsbar")).toHaveCount(0);
  expect(await layerOf(page)).toContain('"consent","default",{"ad_storage":"granted"');
  await page.locator("[data-ads-settings]").click();
  await expect(page.locator(".tk-adsbar")).toBeVisible();
});

test("ads measurement: Decline stops the signals now and keeps Google away on the next visit", async ({ page }) => {
  const google = [];
  await page.route(GOOGLE, (route) => { google.push(route.request().url()); route.fulfill({ status: 200, contentType: "text/javascript", body: "" }); });
  await page.route(FN, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' }));
  await page.goto("/10key/index_en.html?lang=en");
  await page.locator(".tk-adsbar").getByRole("button", { name: "Decline" }).click();
  await expect(page.locator(".tk-adsbar")).toHaveCount(0);
  const card = page.locator("#prereg");
  await card.locator("input[name=email]").fill("player@example.com");
  await card.locator("input[name=consent]").check();
  await card.getByRole("button", { name: "Pre-register" }).click();
  await expect(card.locator("[data-prereg-status]")).toContainText("You are pre-registered!");
  const layer = await layerOf(page);
  expect(layer).toContain('"consent","update",{"ad_storage":"denied"}');
  expect(layer).not.toContain('"conversion"');
  google.length = 0;
  await page.reload();
  await expect(page.locator(".tk-adsbar")).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(google).toHaveLength(0);
});

test("the cancel link page works in German and Japanese", async ({ page }) => {
  await page.route(FN, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true,"locale":"de"}' }));
  await page.goto("/10key/prereg/?a=unsub&t=11111111-2222-4333-8444-555555555555&lang=de");
  await expect(page.locator("h1")).toHaveText("Vorregistrierung storniert");
  await page.goto("/10key/prereg/?a=unsub&t=11111111-2222-4333-8444-555555555555&lang=ja");
  await expect(page.locator("h1")).toHaveText("事前登録を取り消しました");
});

// The in-game "get launch alerts" buttons (itch build) open these addresses: each lands on the form, and the de/ja ones
// keep the mail language. #itch-demo (the home's demo buttons) opens the popup before sign-up.
for (const [url, locale] of Object.entries({ "/10key/?lang=ko#prereg": "ko", "/10key/index_en.html#prereg": "en", "/10key/index_en.html?lang=de#prereg": "de", "/10key/index_en.html?lang=ja#prereg": "ja", "/10key/index_de.html#prereg": "de", "/10key/index_ja.html#prereg": "ja" })) {
  test(`the game's launch-alert address lands on the form (${url})`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    await page.goto(url);
    await expect(page.locator("#prereg input[name=email]")).toBeInViewport();
    await expect(page.locator("dialog[data-itch-popup]")).toHaveCount(0);
  });
}

for (const [url, text] of Object.entries({ "/10key/?lang=ko#itch-demo": "itch.io 데모는 사전예약 특전이에요", "/10key/index_en.html#itch-demo": "The itch.io demo is a pre-registration perk", "/10key/index_en.html?lang=de#itch-demo": "Die itch.io-Demo gibt es mit der Vorregistrierung", "/10key/index_en.html?lang=ja#itch-demo": "itch.ioのデモは事前登録の特典です", "/10key/index_de.html#itch-demo": "Die itch.io-Demo gibt es mit der Vorregistrierung", "/10key/index_ja.html#itch-demo": "itch.ioのデモは事前登録の特典です" })) {
  test(`the home's demo button opens the pre-registration popup in the visitor's language (${url})`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    await page.goto(url);
    const popup = page.locator("dialog[data-itch-popup]");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(text);
    await expect(popup.locator("a[href*='itch.io']")).toHaveCount(0);
    await expect(popup.locator(".tk-gate-paid")).toContainText(/유료|paid|kostenpflichtig|有料/i);
  });
}

// German and Japanese pre-registration pages (owner 2026-11-04): the form posts the page language, the consent bar speaks it.
for (const [url, locale, bar] of [["/10key/index_de.html", "de", "Google-Ads-Messcookie"], ["/10key/index_ja.html", "ja", "Google広告の測定用Cookie"], ["/10key/index_zh.html", "zh", "Google Ads 成效衡量 Cookie"]]) {
  test(`${url} signs up in ${locale} and shows the consent bar in ${locale}`, async ({ page }) => {
    let body = null;
    await page.route(FN, (route) => { body = JSON.parse(route.request().postData() || "{}"); return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' }); });
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", locale === "zh" ? "zh-Hant" : locale);
    await expect(page.locator(".tk-adsbar")).toContainText(bar);
    await page.locator(".tk-adsbar-no").click();
    await page.fill("#prereg input[name=email]", "test@example.com");
    await page.check("#prereg input[name=consent]");
    await page.click("#prereg button[type=submit]");
    await expect(page.locator("[data-itch-unlock]").first()).toBeVisible();
    expect(body.locale).toBe(locale);
    await expect(page.locator(".tk-lang a[aria-current=page]")).toHaveText(locale === "zh" ? "中文" : locale.toUpperCase());
  });
}

// QA 11-04: the Japanese and German pages fit a 390px phone (the screenshot strip scrolls on its own).
for (const url of ["/10key/index_zh.html", "/10key/index_ja.html", "/10key/index_de.html", "/10key/index_en.html", "/10key/?lang=ko"]) {
  test(`${url} has no text running off a 390px screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    await page.goto(url);
    const off = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => !e.closest(".tk-shots") && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)));
    expect(off).toEqual([]);
  });
}

// Language routing (owner 2026-11-04): without ?lang the browser's first language picks the page; ?lang=de|ja|zh on the
// English page (old links in game builds and videos) moves to that page.
for (const [locale, start, expected] of [["zh-TW", "/10key/", "/10key/index_zh.html"], ["zh-HK", "/10key/index_en.html", "/10key/index_zh.html"], ["ja-JP", "/10key/", "/10key/index_ja.html"], ["de-DE", "/10key/", "/10key/index_de.html"], ["zh-CN", "/10key/", "/10key/index_en.html"], ["ko-KR", "/10key/", "/10key/"], ["en-US", "/10key/index_en.html", "/10key/index_en.html"]]) {
  test.describe(`browser language ${locale}`, () => {
    test.use({ locale });
    test(`${start} lands on ${expected}`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
      await page.goto(start + "#prereg");
      await expect(page).toHaveURL(new RegExp(expected.replace(/[.]/g, "[.]") + "#prereg$"));
      await expect(page.locator("#prereg input[name=email]")).toBeVisible();
    });
  });
}
for (const l of ["de", "ja", "zh"]) {
  test(`old link index_en.html?lang=${l} moves to the ${l} page`, async ({ page }) => {
    await page.goto(`/10key/index_en.html?lang=${l}#prereg`);
    await expect(page).toHaveURL(new RegExp(`/10key/index_${l}[.]html[?]lang=${l}#prereg$`));
  });
}


for (const [url, lang] of Object.entries({
  "/10key/odds/ko.html": "ko",
  "/10key/odds/en.html": "en",
  "/10key/odds/ja.html": "ja",
  "/10key/odds/de.html": "de",
  "/10key/odds/zh.html": "zh-Hant",
})) {
  test(`localized odds page stays in sync with the client (${url})`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator(".legal-date")).toContainText("1.0.0");
    await expect(page.locator("[data-box='basic'] tbody tr")).toHaveCount(7);
    await expect(page.locator("[data-box='rare'] tbody tr")).toHaveCount(5);
    await expect(page.locator("[data-box='basic']")).toContainText("0.07%");
    await expect(page.locator("[data-box='basic']")).toContainText("60.00%");
    await expect(page.locator("[data-box='basic']")).toContainText("25.43%");
    await expect(page.locator("[data-box='rare']")).toContainText("62%");
  });
}

// /10key/get/ after-launch page, deployed ahead of launch (owner 2026-11-09). Until STORES.*.live is flipped, visitors
// still get the "not out yet" card; ?preview=pc|ios|android shows the after-launch view without leaving the page.
test("/10key/get/ before launch still shows the not-yet card and the pre-registration key", async ({ page }) => {
  await page.goto("/10key/get/?lang=ko");
  await expect(page.locator("[data-title]")).toHaveText("아직 출시 전이에요");
  await expect(page.locator("[data-show-prereg]")).toBeVisible();
  await expect(page.locator("[data-get-pc]")).toBeHidden();
});
test("/10key/get/?preview=pc shows phone stores with QR and copy link, the itch.io demo and Steam coming soon", async ({ page }) => {
  await page.goto("/10key/get/?preview=pc&lang=en&src=ads_kr");
  const pc = page.locator("[data-get-pc]");
  await expect(pc).toBeVisible();
  await expect(pc.locator(".tk-get-title")).toHaveText("Get 10key Survival");
  await expect(pc.locator("[data-get-link=ios]")).toHaveAttribute("href", "https://apps.apple.com/app/10key-survival/id6824972492?pt=129265473&ct=ads_kr&mt=8");
  await expect(pc.locator("[data-get-link=android]")).toHaveAttribute("href", /id=com\.houseduck\.tenkeysurvival&referrer=utm_source%3Dhouseduck%26utm_medium%3Dget%26utm_campaign%3Dads_kr$/);
  await expect(pc.locator("[data-get-link=itch]")).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
  await expect(pc.locator(".tk-steam-soon")).toContainText("Steam");
  await expect(pc.locator("[data-get-link=ios] img")).toHaveAttribute("src", "/assets/store-badges/app-store-en.svg");
  // the QR code is for a computer screen; phones (under 760px) hide it
  if ((page.viewportSize() || { width: 1440 }).width > 760) await expect(pc.locator(".tk-get-qr img")).toBeVisible();
  else await expect(pc.locator(".tk-get-qr img")).toBeHidden();
});
test("/10key/get/?preview=ios shows the App Store opening card without leaving", async ({ page }) => {
  await page.goto("/10key/get/?preview=ios&lang=ja");
  await expect(page.locator("[data-title]")).toHaveText("App Storeを開いています…");
  await expect(page.locator("[data-store=ios]")).toHaveAttribute("href", /pt=129265473&ct=get&mt=8$/);
  await expect(page).toHaveURL(/\/10key\/get\/\?preview=ios/);
});

// One store first (owner 2026-11-18): an Android phone while only the App Store is live gets "coming soon" + pre-register.
test("/10key/get/ on a phone whose store is not live yet says coming soon and offers pre-registration", async ({ page }) => {
  await page.goto("/10key/get/?preview=android-soon&lang=ko");
  await expect(page.locator("[data-title]")).toHaveText("Google Play 출시 준비 중이에요");
  await expect(page.locator("[data-show-prereg]")).toBeVisible();
  await expect(page.locator("[data-get-pc]")).toBeHidden();
  await page.goto("/10key/get/?preview=ios-soon&lang=en");
  await expect(page.locator("[data-title]")).toHaveText("App Store is coming soon");
});

// Launch switch (owner 2026-11-18): assets/tenkey-launch.js flips the 10key pages, the home pages and /10key/get/ from
// pre-registration to download at 2026-11-20 00:00 Berlin; ?launch=preview shows it earlier. Stores stay "coming soon"
// until their live flag is set; the sale line shows only 11-20 to 11-27.
const LAUNCH_PAGES = [["/10key/?lang=ko", "ko", "지금 출시!"], ["/10key/index_en.html?lang=en", "en", "Out now!"], ["/10key/index_de.html?lang=de", "de", "Jetzt erhältlich!"], ["/10key/index_ja.html?lang=ja", "ja", "配信開始！"], ["/10key/index_zh.html?lang=zh", "zh", "現已上市！"]];
for (const [url, lang, title] of LAUNCH_PAGES) {
  test(`${url} before launch keeps pre-registration; ?launch=preview shows the download block`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
    await page.goto(url);
    await expect(page.locator("#download")).toBeHidden();
    await expect(page.locator("#prereg")).toBeVisible();
    await page.goto(url + "&launch=preview");
    await expect(page.locator("#download h2")).toHaveText(title, { useInnerText: true });
    await expect(page.locator("#prereg")).toBeHidden();
    await expect(page.locator("#download [data-launch-store=ios]")).toHaveAttribute("href", `https://apps.apple.com/app/10key-survival/id6824972492?pt=129265473&ct=site_${lang}&mt=8`);
    await expect(page.locator("#download [data-launch-store=ios] img")).toHaveAttribute("src", `/assets/store-badges/app-store-${lang}.svg`);
    await expect(page.locator("#download [data-launch-store=android] img")).toHaveAttribute("src", lang === "zh" ? "/assets/store-badges/google-play-zh.png" : `/assets/store-badges/google-play-${lang}.svg`);
    await expect(page.locator("#download [data-launch-store=android]")).toHaveAttribute("href", new RegExp(`utm_campaign%3Dsite_${lang}$`));
    await expect(page.locator("#download .tk-dl-sale")).toBeVisible();
    await expect(page.locator("#faq details:visible")).toHaveCount(3);
    await expect(page.locator(".tk-nav-cta:visible")).toHaveAttribute("href", "#download");
    for (const a of await page.locator("[data-itch-gate]").all()) await expect(a).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
    await expect(page.locator("dialog[data-itch-popup]")).toHaveCount(0);
  });
}
test("the launch version is on from 2026-11-18 18:00 Berlin; coming soon until the stores go on at 11-20 00:00; the sale shows 11-20 to 11-27", async ({ page, isMobile }) => {
  await page.addInitScript(() => window.localStorage.setItem("hd_ads_consent", "denied"));
  await page.clock.setFixedTime(new Date("2026-11-18T17:55:00+01:00"));
  await page.goto("/10key/?lang=ko");
  await expect(page.locator("#prereg")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-18T18:05:00+01:00"));
  await page.goto("/10key/?lang=ko");
  await expect(page.locator("#download")).toBeVisible();
  await expect(page.locator("#prereg")).toBeHidden();
  // no store live yet: "coming soon" headings, no badge, only "coming soon" text (official badge rules), no sale line yet
  await expect(page.locator("#download h2")).toHaveText("곧 출시!", { useInnerText: true });
  await expect(page.locator("#final-title-launch [data-store-wait]")).toBeVisible();
  await expect(page.locator("#final-title-launch [data-store-out]")).toBeHidden();
  await expect(page.locator("#download [data-launch-store=ios]")).toBeHidden();
  await expect(page.locator("#download .tk-badge-item.is-soon .tk-badge-soon")).toHaveCount(2);
  await expect(page.locator("#download .tk-dl-sale")).toBeHidden();
  for (const a of await page.locator("[data-itch-gate]").all()) await expect(a).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
  await page.goto("/?lang=ko");
  await expect(page.locator("#games .hd-chip-status:visible")).toHaveText("곧 출시");
  await expect(page.locator("#games a.hd-tk-get")).toBeVisible();
  await expect(page.locator("#games a.hd-tk-prereg")).toBeHidden();
  // /10key/get/ acts as launched already (owner 2026-11-19: link handed out, posts go up before the store release):
  // phones go to their store, a computer gets the store choice.
  if (!isMobile) {
    await page.goto("/10key/get/?lang=ko&src=post");
    await expect(page.locator("[data-get-pc]")).toBeVisible();
    await expect(page.locator("[data-get-pc] [data-get-link=ios]")).toHaveAttribute("href", "https://apps.apple.com/app/10key-survival/id6824972492?pt=129265473&ct=post&mt=8");
    await expect(page.locator("[data-get-pc] [data-get-link=android]")).toBeVisible();
  }
  // 11-20 00:00 Berlin: both stores on (owner 2026-11-18: App Store link final, Google Play = the package page), official
  // badges with the source, "out now" headings, the sale line
  await page.clock.setFixedTime(new Date("2026-11-20T00:05:00+01:00"));
  await page.goto("/10key/?lang=ko");
  await expect(page.locator("#download h2")).toHaveText("지금 출시!", { useInnerText: true });
  await expect(page.locator("#download [data-launch-store=ios]")).toHaveAttribute("href", "https://apps.apple.com/app/10key-survival/id6824972492?pt=129265473&ct=site_ko&mt=8");
  await expect(page.locator("#download [data-launch-store=android]")).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival&referrer=utm_source%3Dhouseduck%26utm_medium%3Dsite%26utm_campaign%3Dsite_ko");
  await expect(page.locator("#download [data-launch-store=ios]")).toBeVisible();
  await expect(page.locator("#download [data-launch-store=android]")).toBeVisible();
  await expect(page.locator("#download .tk-badge-soon:visible")).toHaveCount(0);
  await expect(page.locator("#download .tk-dl-sale")).toBeVisible();
  await page.goto("/?lang=ko");
  await expect(page.locator("#games .hd-chip-status:visible")).toHaveText("지금 출시");
  if (!isMobile) {
    await page.goto("/10key/get/?lang=en&src=mail");
    await expect(page.locator("[data-get-pc]")).toBeVisible();
    await expect(page.locator("[data-get-pc] [data-get-link=ios]")).toHaveAttribute("href", "https://apps.apple.com/app/10key-survival/id6824972492?pt=129265473&ct=mail&mt=8");
    await expect(page.locator("[data-get-pc] [data-get-link=android]")).toBeVisible();
  }
  await page.clock.setFixedTime(new Date("2026-11-28T00:05:00+01:00"));
  await page.goto("/10key/?lang=ko");
  await expect(page.locator("#download")).toBeVisible();
  await expect(page.locator("#download .tk-dl-sale")).toBeHidden();
});
test("home 10key section: pre-registration before launch, download key to /10key/get/ after", async ({ page }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator("#games a.hd-tk-prereg")).toBeVisible();
  await expect(page.locator("#games a.hd-tk-get")).toBeHidden();
  await page.goto("/?lang=ko&launch=preview");
  await expect(page.locator("#games a.hd-tk-get")).toHaveAttribute("href", "10key/get/?src=home_ko&lang=ko");
  await expect(page.locator("#games a.hd-tk-prereg")).toBeHidden();
  await expect(page.locator("#games .hd-tk-preview:visible")).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
});
test("/10key/get/?launch=preview shows the after-launch page without leaving for a store", async ({ page }) => {
  await page.goto("/10key/get/?launch=preview&lang=en");
  const android = await page.evaluate(() => /Android/i.test(navigator.userAgent));
  if (android) await expect(page.locator("[data-title]")).toHaveText("Opening Google Play…");
  else await expect(page.locator("[data-get-pc]")).toBeVisible();
  await expect(page).toHaveURL(/launch=preview/);
});
