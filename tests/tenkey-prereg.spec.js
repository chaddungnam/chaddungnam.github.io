// 10key Survival page (rebuilt 2026-10-28 to match the itch.io page): the first screen is the big PLAY to the free browser build on
// itch.io; the app pre-registration is one click away (the link under PLAY) and posts a double opt-in sign-up to the tenkey-prereg
// edge function (mocked here, no real mail). The page states the module odds as text. Also /10key/prereg/ and /10key/get/.
const { test, expect } = require("@playwright/test");

const FN = "https://frepunpqswciugwoyvxo.supabase.co/functions/v1/tenkey-prereg";

for (const [url, words] of Object.entries({
  "/10key/?lang=ko": { play: "지금 플레이", odds: "odds/", submit: "사전예약하기", ok: "확인 메일을 보냈어요", invalid: "이메일 주소를 다시 확인해 주세요", consent: "동의 항목에 체크해 주세요" },
  "/10key/index_en.html?lang=en": { play: "Play now", odds: "odds/#en", submit: "Pre-register", ok: "We sent you a confirmation email", invalid: "Please check your email address", consent: "Please tick the consent box" },
})) {
  test(`PLAY opens itch.io from the first screen, the odds are text, and pre-registration signs up (${url})`, async ({ page }) => {
    const posts = [];
    await page.route(FN, async (route) => {
      posts.push({ body: route.request().postData(), type: route.request().headers()["content-type"] });
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"ok":true}' });
    });
    await page.goto(url);
    const play = page.locator(".tk-hero .tk-play");
    await expect(play).toBeInViewport();
    await expect(play).toHaveText(words.play);
    await expect(play).toHaveAttribute("href", "https://houseduck.itch.io/10key-survival");
    await expect(page.locator(".tk-odds-table tbody tr")).toHaveCount(12);
    await expect(page.locator(".tk-odds-table tbody")).toContainText("8.333%");
    await expect(page.locator(`#odds-info a[href='${words.odds}']`)).toHaveCount(1);

    const card = page.locator("#prereg");
    await page.locator(".tk-hero-app").click();
    await expect(card).toBeInViewport();
    await expect(card.getByRole("button", { name: words.submit })).toBeInViewport();
    await expect(card).not.toContainText(/유료|무료|paid|free/i);

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
