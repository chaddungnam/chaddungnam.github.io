const { test, expect } = require("@playwright/test");

const path = "a".repeat(64) + ".webp";
const paragraph = (text, overrides = {}) => ({
  type: "paragraph", text, size: "normal", align: "left", bold: false, italic: false, underline: false, ...overrides,
});
const notice = (content) => ({ id: 12, body: "첫 문단\n\n마지막 문단", created_at: "2026-09-06T10:00:00Z", content });
async function openNotice(page, record, lang = "ko") {
  await page.route("**/functions/v1/public-notice?*", (route) => route.fulfill({ json: { locale: lang, notices: [record] } }));
  await page.goto(`/quirky-ball/notices/?embed=1&lang=${lang}&notice=12`);
  await expect(page.locator("#notice-detail")).toBeVisible();
}

test("rich notices render ordered images, paragraph formatting, and dividers without overflow", async ({ page }) => {
  await page.route("**/storage/v1/object/public/announcement-media/*", (route) => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=", "base64"),
  }));
  await openNotice(page, notice({ version: 1, blocks: [
    paragraph("첫 문단", { size: "title", bold: true, align: "center" }),
    { type: "image", path, alt: "업데이트 미리보기", width: 75 },
    { type: "divider" },
    paragraph("마지막 문단", { italic: true, underline: true }),
  ] }));
  const body = page.locator("#notice-body");
  await expect(body.locator(":scope > *")).toHaveCount(4);
  await expect(body.locator("h2")).toHaveText("첫 문단");
  await expect(body.locator("h2")).toHaveCSS("text-align", "center");
  await expect(body.locator("h2")).toHaveCSS("font-weight", "800");
  await expect(body.locator("p")).toHaveCSS("font-style", "italic");
  await expect(body.locator("img")).toHaveAttribute("alt", "업데이트 미리보기");
  await expect.poll(() => body.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const overflow = await page.locator("#notice-detail").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.locator("#back-to-list").click();
  await expect(page.locator(".notice-card p")).toHaveText("첫 문단\n\n마지막 문단");
});

test("legacy plain notices remain text-only", async ({ page }) => {
  await openNotice(page, notice(undefined));
  await expect(page.locator("#notice-body")).toHaveText("첫 문단\n\n마지막 문단");
  await expect(page.locator("#notice-body img")).toHaveCount(0);
});

test("untrusted rich documents fall back without loading arbitrary URLs", async ({ page }) => {
  let unsafeRequests = 0;
  page.on("request", (request) => { if (request.url().includes("attacker.invalid")) unsafeRequests++; });
  await openNotice(page, notice({ version: 1, blocks: [
    paragraph("<img src=x onerror=alert(1)>"),
    { type: "image", path: "https://attacker.invalid/track.webp", alt: "bad", width: 100 },
  ] }));
  await expect(page.locator("#notice-body")).toHaveText("첫 문단\n\n마지막 문단");
  expect(unsafeRequests).toBe(0);
  await expect(page.locator("#notice-body img")).toHaveCount(0);
});

test("markup in paragraph text is never executed", async ({ page }) => {
  await openNotice(page, notice({ version: 1, blocks: [paragraph("<script>window.evil = 1</script>")] }));
  await expect(page.locator("#notice-body p")).toHaveText("<script>window.evil = 1</script>");
  expect(await page.evaluate(() => window.evil)).toBeUndefined();
  await expect(page.locator("#notice-body script")).toHaveCount(0);
});

test("failed image download retains accessible description and the rest of the notice", async ({ page }) => {
  await page.route("**/storage/v1/object/public/announcement-media/*", (route) => route.abort());
  await openNotice(page, notice({ version: 1, blocks: [
    paragraph("앞 문단"), { type: "image", path, alt: "새 공 모양 안내", width: 100 }, paragraph("뒤 문단"),
  ] }));
  await expect(page.locator(".notice-image-unavailable")).toHaveText("새 공 모양 안내");
  await expect(page.locator("#notice-body > p").last()).toHaveText("뒤 문단");
});

test("localized rich text preserves image layout and RTL direction", async ({ page }) => {
  await openNotice(page, notice({ version: 1, blocks: [paragraph("إشعار جديد", { align: "right", size: "large" })] }), "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#notice-body p")).toHaveText("إشعار جديد");
  await expect(page.locator("#notice-body p")).toHaveCSS("text-align", "right");
});

for (const [category, label] of [["notice", "[공지]"], ["event", "[이벤트]"], ["preview", "[예고]"]]) {
  test(`category ${category} is visibly labelled in detail and list`, async ({ page }) => {
    await openNotice(page, { ...notice(undefined), category });
    await expect(page.locator("#notice-category")).toHaveText(label);
    await expect(page.locator("#notice-category")).toHaveAttribute("data-category", category);
    await page.locator("#back-to-list").click();
    await expect(page.locator(".notice-card .notice-kind")).toHaveText(label);
    await expect(page.locator(".notice-card .notice-kind")).toHaveAttribute("data-category", category);
  });
}

test("unknown categories fall back to notice and event labels are localized", async ({ page }) => {
  await openNotice(page, { ...notice(undefined), category: "<script>bad()</script>" });
  await expect(page.locator("#notice-category")).toHaveText("[공지]");
  await expect(page.locator("#notice-category")).toHaveAttribute("data-category", "notice");
  await page.unroute("**/functions/v1/public-notice?*");
  await openNotice(page, { ...notice(undefined), category: "event" }, "ja");
  await expect(page.locator("#notice-category")).toHaveText("[イベント]");
});
