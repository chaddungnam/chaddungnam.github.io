const { test, expect } = require("@playwright/test");
const video = "dQw4w9WgXcQ";
const paragraph = (text) => ({ type: "paragraph", text, size: "normal", align: "left", bold: false, italic: false, underline: false });
async function open(page, body, { embed = true, content } = {}) {
  await page.route("**/functions/v1/public-notice?*", (route) => route.fulfill({ json: { notices: [
    { id: 15, body, content, created_at: "2026-09-09T10:00:00Z" },
  ] } }));
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=", "base64") }));
  await page.goto(`/quirky-ball/notices/?lang=en&notice=15${embed ? "&embed=1" : ""}`);
  await expect(page.locator("#notice-detail")).toBeVisible();
}

test("legacy paragraphs keep text and punctuation with safe links and deduplicated cards", async ({ page }) => {
  const body = `Watch (https://youtu.be/${video}). Again https://www.youtube.com/watch?v=${video}&t=12\nhttps://example.com/a_(b).`;
  await open(page, body);
  const content = page.locator("#notice-body");
  await expect(content.locator(".notice-inline-link")).toHaveCount(3);
  await expect(content.locator(".notice-link-preview")).toHaveCount(2);
  await expect(content.locator(".notice-inline-link").last()).toHaveAttribute("href", "https://example.com/a_(b)");
  expect(await content.evaluate((el) => [...el.childNodes].filter((n) => !n.classList?.contains("notice-link-preview")).map((n) => n.textContent).join(""))).toBe(body);
  for (const link of await content.locator("a").all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(content.locator("img")).toHaveAttribute("loading", "lazy");
  await expect(content.locator("iframe")).toHaveCount(0);
  expect(await page.locator("#notice-detail").evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false);
});

test("official watch, shorts, live and youtu.be variants resolve to one video", async ({ page }) => {
  await open(page, "https://example.com");
  const results = await page.evaluate((id) => {
    return [ `https://youtube.com/watch?v=${id}`, `https://www.youtube.com/shorts/${id}`, `https://m.youtube.com/live/${id}`, `https://youtu.be/${id}?si=abc` ].map((url) => {
      const div = document.createElement("div");
      NoticeLinks.previews(url, div);
      return div.querySelector("img")?.getAttribute("src");
    });
  }, video);
  expect(results).toEqual(Array(4).fill(`https://i.ytimg.com/vi/${video}/hqdefault.jpg`));
});

test("malicious URLs and markup never execute or fetch arbitrary metadata", async ({ page }) => {
  const external = [];
  page.on("request", (request) => { if (/attacker|example\.com|localhost/.test(request.url())) external.push(request.url()); });
  await open(page, [
    '<img src=x onerror="window.evil=1"> <script>window.evil=1</script>',
    'javascript:alert(1) javascript:https://attacker.invalid http://example.com //attacker.invalid',
    'https://youtube.com@attacker.invalid https://youtube.com\\@attacker.invalid https://localhost/a https://127.0.0.1/a',
    'https://youtube.com:444/watch?v=dQw4w9WgXcQ https://example.com/%0aevil',
    `https://youtube.com.attacker.invalid/watch?v=${video} https://www.youtu.be/${video}`,
    'https://example.com/safe',
  ].join("\n"));
  await expect(page.locator("#notice-body .notice-link-preview")).toHaveCount(3);
  await expect(page.locator("#notice-body img, #notice-body script, #notice-body iframe")).toHaveCount(0);
  expect(await page.evaluate(() => window.evil)).toBeUndefined();
  expect(external).toEqual([]);
});

test("append APIs preserve existing nodes and bound repeated cards without modifying text", async ({ page }) => {
  await open(page, "test");
  const result = await page.evaluate((id) => {
    const div = document.createElement("div");
    const input = document.createElement("input");
    input.value = "unsaved editor text";
    div.append(input);
    NoticeLinks.previews(`https://youtu.be/${id}`, div);
    NoticeLinks.previews(`https://youtube.com/watch?v=${id}`, div);
    const afterPreviews = div.querySelectorAll(".notice-inline-link").length;
    NoticeLinks.render("hello https://example.com", div);
    NoticeLinks.previews(Array.from({ length: 30 }, (_, n) => `https://example.com/${n}`).join(" "), div);
    return { same: div.firstChild === input, value: input.value, afterPreviews, cards: div.querySelectorAll(".notice-link-preview").length, inline: div.querySelectorAll(".notice-inline-link").length };
  }, video);
  expect(result).toEqual({ same: true, value: "unsaved editor text", afterPreviews: 0, cards: 12, inline: 1 });
});

test("rich paragraphs use shared renderer and deduplicate video cards across blocks", async ({ page }) => {
  await open(page, "fallback", { content: { version: 1, blocks: [
    paragraph(`https://youtu.be/${video}`), paragraph(`https://youtube.com/live/${video}`),
    paragraph("Read https://example.com/"),
  ] } });
  await expect(page.locator("#notice-body > p")).toHaveCount(3);
  await expect(page.locator("#notice-body .notice-inline-link")).toHaveCount(3);
  await expect(page.locator("#notice-body .notice-link-preview")).toHaveCount(2);
});

test("failed thumbnail leaves visible play affordance and original link", async ({ page }) => {
  await open(page, `https://youtu.be/${video}`);
  await page.locator(".notice-link-poster img").evaluate((img) => img.dispatchEvent(new Event("error")));
  await expect(page.locator(".notice-link-poster img")).toBeHidden();
  await expect(page.locator(".notice-link-play")).toBeVisible();
  await expect(page.locator(".notice-link-destination")).toHaveAttribute("href", `https://youtu.be/${video}`);
});

test("browser click alone loads privacy enhanced player without autoplay and keeps fallback", async ({ page }) => {
  const embeds = [];
  await page.route("https://www.youtube-nocookie.com/**", (route) => { embeds.push(route.request().url()); return route.fulfill({ contentType: "text/html", body: "Player mock" }); });
  await open(page, `https://youtu.be/${video}`, { embed: false });
  expect(embeds).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.locator(".notice-link-poster").click();
  await expect(page.locator(".notice-link-player")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${video}?playsinline=1`);
  await expect(page.locator(".notice-link-destination")).toBeVisible();
  expect(embeds.every((url) => !url.includes("autoplay"))).toBe(true);
});

test("embedded notice mode never attempts a player even after poster click", async ({ page }) => {
  await open(page, `https://youtu.be/${video}`);
  await page.locator(".notice-link-poster").evaluate((link) => {
    // Prevent real navigation while testing whether the helper itself handles the click.
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
  });
  await expect(page.locator(".notice-link-poster")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
});
