// 10key Survival page (2026-10-28, the itch.io page's look): it is a paid iOS/Android app, so the first screen is the app
// pre-registration form, which posts a double opt-in sign-up to the tenkey-prereg edge function (mocked here, no real mail); the
// browser build on itch.io sits under it as the free preview. The page states the module odds as text. Also /10key/prereg/ and /10key/get/.
const { test, expect } = require("@playwright/test");

const FN = "https://frepunpqswciugwoyvxo.supabase.co/functions/v1/tenkey-prereg";

for (const [url, words] of Object.entries({
  "/10key/?lang=ko": { preview: "itch.io에서 미리 플레이해보기", odds: "odds/", submit: "사전예약하기", ok: "확인 메일을 보냈어요", invalid: "이메일 주소를 다시 확인해 주세요", consent: "동의 항목에 체크해 주세요" },
  "/10key/index_en.html?lang=en": { preview: "Play the free preview on itch.io", odds: "odds/#en", submit: "Pre-register", ok: "We sent you a confirmation email", invalid: "Please check your email address", consent: "Please tick the consent box" },
})) {
  test(`pre-registration is visible at once and signs up, itch.io is the free preview, the odds are text (${url})`, async ({ page }) => {
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
    const preview = page.locator(".tk-hero .tk-preview");
    await expect(preview).toHaveText(words.preview);
    await expect(preview).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
    await expect(page.locator(".tk-hero .tk-key, .tk-hero .tk-preview")).toHaveCount(2);
    await expect(page.locator(".tk-odds-table tbody tr")).toHaveCount(12);
    await expect(page.locator(".tk-odds-table tbody")).toContainText("8.333%");
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
    expect(sent).toMatchObject({ v: 1, action: "signup", email: "player@example.com", consent: "2026-10-24", hp: "" });
    await expect(card.locator("input[name=email]")).toBeHidden();
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

test("download link page waits for launch and points to pre-registration", async ({ page }) => {
  await page.goto("/10key/get/?lang=en");
  await expect(page.locator("h1")).toHaveText("Not out yet");
  await expect(page.locator("[data-store]:visible")).toHaveCount(0);
  await expect(page.locator("[data-show-prereg]")).toHaveAttribute("href", "/10key/index_en.html?lang=en#prereg");
});
