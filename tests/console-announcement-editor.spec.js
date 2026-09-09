const { test, expect } = require("@playwright/test");

const HASHES = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
const MEDIA_BASE = "https://bbgwvpwzkyudbtcgrbtm.supabase.co/storage/v1/object/public/announcement-media/";

function stripWebpMetadata(buffer) {
  const parts = [Buffer.from(buffer.subarray(0, 12))];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const name = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + size + (size % 2);
    if (next > buffer.length) return buffer;
    if (!["EXIF", "XMP ", "ICCP"].includes(name)) {
      const part = Buffer.from(buffer.subarray(offset, next));
      if (name === "VP8X" && size >= 1) part[8] &= ~0x2c;
      parts.push(part);
    }
    offset = next;
  }
  const output = Buffer.concat(parts);
  output.writeUInt32LE(output.length - 8, 4);
  return output;
}

async function boot(page, { notices = [], failFirstUpload = false } = {}) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.route("**/console/auth.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};`,
  }));
  await page.route("**/console/api.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      window.__uploads=[];
      window.__noticePayload=null;
      window.__mediaAttempts=0; window.__activeUploads=0; window.__maxConcurrentUploads=0;
      window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{
        if(body.action==="operations.get")return{config:{},notices:${JSON.stringify(notices)},reward_mail_broadcasts:[],catalog:[]};
        if(body.action==="referrals.get")return{};
        if(body.action==="announcements.media.upload"){
          window.__mediaAttempts+=1; window.__activeUploads+=1; window.__maxConcurrentUploads=Math.max(window.__maxConcurrentUploads,window.__activeUploads);
          await new Promise(resolve=>setTimeout(resolve,180));
          window.__activeUploads-=1;
          if(${failFirstUpload}&&window.__mediaAttempts===1)throw new Error("upload_temporarily_failed");
          const binary=atob(body.dataBase64);
          const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
          window.__uploads.push({keys:Object.keys(body).sort(),size:bytes.length,signature:String.fromCharCode(...bytes.slice(0,12))});
          const hash=${JSON.stringify(HASHES)}[Math.min(window.__uploads.length-1,2)];
          return{path:hash+".webp",url:"https://untrusted.invalid/ignored.webp",bytes:bytes.length};
        }
        if(body.action==="announcements.publish"||body.action==="announcements.update"){
          window.__noticePayload=body;
          return{ok:true,announcement_id:91};
        }
        return{};
      }};
    `,
  }));
  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.locator('#noticeTask').evaluate(node => { node.open = true; });
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
}

async function imageBytes(page, type) {
  const dataUrl = await page.evaluate((mime) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 900, 600);
    gradient.addColorStop(0, "#e96657");
    gradient.addColorStop(0.5, "#21aa9b");
    gradient.addColorStop(1, "#152033");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 900, 600);
    context.fillStyle = "white";
    context.font = "bold 96px sans-serif";
    context.fillText("HOUSE DUCK", 90, 330);
    return canvas.toDataURL(mime, 0.96);
  }, type);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function smallWebpBytes(page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    context.fillStyle = "#21aa9b";
    context.fillRect(0, 0, 96, 64);
    context.fillStyle = "#e96657";
    context.fillRect(24, 16, 48, 32);
    return canvas.toDataURL("image/webp", 0.82);
  });
  return stripWebpMetadata(Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function selectText(page, start, end = start, paragraphIndex = 0) {
  const node = page.locator('#announcementDocument [data-paragraph]').nth(paragraphIndex);
  await node.focus();
  await node.evaluate((element, offsets) => {
    const range = document.createRange();
    range.setStart(element.firstChild, offsets[0]);
    range.setEnd(element.firstChild, offsets[1]);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
  }, [start, end]);
}

async function pasteImages(page, buffers) {
  await page.locator('#announcementDocument').evaluate((editor, encoded) => {
    const data = new DataTransfer();
    encoded.forEach((base64, index) => data.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], 'clipboard-' + index + '.png', {type:'image/png'})));
    editor.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData:data}));
  }, buffers.map(buffer => buffer.toString('base64')));
}

async function submitInvalid(page, message) {
  await page.locator('#announcementForm [name=startsAt]').fill('2026-09-06T12:00');
  await page.locator('#announcementForm [name=reason]').fill('유효성 검사');
  await page.locator('#announcementForm button[type=submit]').click();
  await expect(page.locator('#announcementEditorStatus')).toContainText(message);
  expect(await page.evaluate(() => window.__noticePayload)).toBeNull();
}

async function publish(page, reason = "블록 에디터 회귀 검증") {
  await page.locator("#announcementForm [name=startsAt]").fill("2026-09-06T12:00");
  await page.locator("#announcementForm [name=reason]").fill(reason);
  await page.locator("#announcementForm button[type=submit]").click();
  await expect.poll(() => page.evaluate(() => window.__noticePayload)).not.toBeNull();
  return page.evaluate(() => window.__noticePayload);
}

test("rich notice publishes ordered blocks, paragraph formatting, and aligned fallback body", async ({ page }) => {
  await boot(page);
  const body = page.locator("#announcementDocument [data-paragraph]");
  await body.fill("앞문단뒷문단");
  await selectText(page, 3);
  await page.locator('[data-add-block="divider"]').click();

  await expect(page.locator("#announcementDocument > :not([data-link-preview])")).toHaveCount(3);
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(0)).toHaveText("앞문단");
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(1)).toHaveText("뒷문단");
  await page.locator('#announcementDocument > [data-paragraph]').nth(0).click();
  await page.locator("#announcementTextSize").selectOption("title");
  await page.locator('[data-format="bold"]').click();
  await page.locator('[data-align="center"]').click();

  const payload = await publish(page);
  expect(payload.body).toBe("앞문단\n\n뒷문단");
  expect(payload.content).toEqual({
    version: 1,
    blocks: [
      { type: "paragraph", text: "앞문단", size: "title", align: "center", bold: true, italic: false, underline: false },
      { type: "divider" },
      { type: "paragraph", text: "뒷문단", size: "normal", align: "left", bold: false, italic: false, underline: false },
    ],
  });
});

test("editing uses the notice ID map and preserves existing rich content exactly", async ({ page }) => {
  const content = {
    version: 1,
    blocks: [
      { type: "paragraph", text: "저장된 제목", size: "title", align: "center", bold: true, italic: false, underline: true },
      { type: "image", path: `${HASHES[0]}.webp`, alt: "오리와 공", width: 75 },
      { type: "paragraph", text: "저장된 본문", size: "small", align: "right", bold: false, italic: true, underline: false },
    ],
  };
  await boot(page, { notices: [{ id: 7, category: "preview", body: "DOM에 보이는 요약은 편집 정본이 아님", content, starts_at: "2026-09-06T10:00:00.000Z", ends_at: null, active: true }] });
  await page.locator("[data-edit-notice='7']").click();

  await expect(page.locator("#announcementDocument")).toBeVisible();
  await expect(page.locator("#announcementDocument > :not([data-link-preview])")).toHaveCount(3);
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(0)).toHaveText("저장된 제목");
  await expect(page.locator('#announcementDocument figure img').first()).toHaveAttribute("src", `${MEDIA_BASE}${HASHES[0]}.webp`);
  const payload = await publish(page, "기존 리치 공지 보존");
  expect(payload.action).toBe("announcements.update");
  expect(payload.announcementId).toBe(7);
  expect(payload.body).toBe("저장된 제목\n\n저장된 본문");
  expect(payload.content).toEqual(content);
  expect(payload.category).toBe("preview");
  await expect(page.locator("[data-notice-id='7'] .announcement-category")).toHaveText("[예고]");
});

test("generated PNG and JPEG are converted to bounded WebP bytes before upload", async ({ page }) => {
  await boot(page);
  await page.locator("#announcementDocument [data-paragraph]").fill("이미지 압축 공지");
  const png = await imageBytes(page, "image/png");
  const jpeg = await imageBytes(page, "image/jpeg");

  await page.locator("#announcementImageInput").setInputFiles({ name: "source.png", mimeType: "image/png", buffer: png });
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(1);
  await expect(page.locator("#announcementEditorStatus")).toContainText("업로드 완료");
  await page.locator('#announcementDocument [data-image-alt]').nth(0).fill("첫 번째 압축 이미지");
  await page.locator('#announcementDocument [data-image-width]').nth(0).selectOption("75");
  await page.locator("#announcementImageInput").setInputFiles({ name: "source.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(2);
  await page.locator('#announcementDocument [data-image-alt]').nth(1).fill("두 번째 압축 이미지");
  await page.locator('#announcementDocument [data-image-width]').nth(1).selectOption("50");

  const uploads = await page.evaluate(() => window.__uploads);
  for (const upload of uploads) {
    expect(upload.keys).toEqual(["action", "dataBase64"]);
    expect(upload.signature.slice(0, 4)).toBe("RIFF");
    expect(upload.signature.slice(8, 12)).toBe("WEBP");
    expect(upload.size).toBeLessThanOrEqual(300 * 1024);
  }
  const payload = await publish(page, "브라우저 WebP 압축 검증");
  expect(payload.content.blocks.filter((block) => block.type === "image")).toEqual([
    { type: "image", path: `${HASHES[0]}.webp`, alt: "첫 번째 압축 이미지", width: 75 },
    { type: "image", path: `${HASHES[1]}.webp`, alt: "두 번째 압축 이미지", width: 50 },
  ]);
});

test("small metadata-free WebP is never enlarged and does not claim false savings", async ({ page }) => {
  await boot(page);
  await page.locator("#announcementDocument [data-paragraph]").fill("작은 WebP 공지");
  const webp = await smallWebpBytes(page);
  await page.locator("#announcementImageInput").setInputFiles({ name: "optimized.webp", mimeType: "image/webp", buffer: webp });
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(1);

  const upload = await page.evaluate(() => window.__uploads[0]);
  expect(upload.size).toBeLessThanOrEqual(webp.length);
  await expect(page.locator("#announcementEditorStatus")).not.toContainText("0% 절감");
  await expect(page.locator("#announcementEditorStatus")).not.toContainText("증가");
});

test("compression continues through resized passes until it meets the target", async ({ page }) => {
  await boot(page);
  await page.locator("#announcementDocument [data-paragraph]").fill("다단계 압축 공지");
  const png = await imageBytes(page, "image/png");
  await page.evaluate(() => {
    window.__compressionWidths = [];
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function patchedToBlob(callback, type, quality) {
      window.__compressionWidths.push(this.width);
      return original.call(this, (blob) => {
        if (this.width > 600) callback(new Blob([blob, new Uint8Array(220 * 1024)], { type: "image/webp" }));
        else callback(blob);
      }, type, quality);
    };
  });
  await page.locator("#announcementImageInput").setInputFiles({ name: "multipass.png", mimeType: "image/png", buffer: png });
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(1);

  const result = await page.evaluate(() => ({ upload: window.__uploads[0], widths: [...new Set(window.__compressionWidths)] }));
  expect(result.widths.length).toBeGreaterThan(1);
  expect(result.widths.at(-1)).toBeLessThanOrEqual(600);
  expect(result.upload.size).toBeLessThanOrEqual(200 * 1024);
});

test("source budget counts codepoints, blank paragraph joins, and image alts", async ({ page }) => {
  const exactBody = `${"가".repeat(1997)}\n\n`;
  const exactContent = {
    version: 1,
    blocks: [
      { type: "paragraph", text: "가".repeat(1997), size: "normal", align: "left", bold: false, italic: false, underline: false },
      { type: "image", path: `${HASHES[0]}.webp`, alt: "😀", width: 100 },
      { type: "paragraph", text: "", size: "normal", align: "left", bold: false, italic: false, underline: false },
    ],
  };
  const altLimitContent = {
    version: 1,
    blocks: [
      { type: "paragraph", text: "짧은 본문", size: "normal", align: "left", bold: false, italic: false, underline: false },
      { type: "image", path: `${HASHES[1]}.webp`, alt: "a".repeat(200), width: 100 },
    ],
  };
  await boot(page, { notices: [
    { id: 11, body: exactBody, content: exactContent, starts_at: "2026-09-06T10:00:00.000Z", ends_at: null, active: true },
    { id: 12, body: "짧은 본문", content: altLimitContent, starts_at: "2026-09-06T10:00:00.000Z", ends_at: null, active: true },
  ] });
  await page.locator("[data-edit-notice='11']").click();
  await expect(page.locator("#announcementTextCount")).toContainText("2000 / 2000");
  const exactAlt = page.locator('#announcementDocument [data-image-alt]').nth(0);
  await exactAlt.evaluate((node) => {
    node.value = "😀😀";
    node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "😀" }));
  });
  await expect(exactAlt).toHaveValue("😀😀");
  await expect(page.locator('#announcementTextCount')).toContainText('2001 / 2000');
  await submitInvalid(page, '2000자');
  await expect(exactAlt).toHaveValue('😀😀');
  await exactAlt.fill('😀');
  const payload = await publish(page, "빈 문단과 코드포인트 예산 검증");
  expect(payload.body).toBe(exactBody);
  expect(payload.content).toEqual(exactContent);

  await page.locator("[data-edit-notice='12']").click();
  const boundedAlt = page.locator('#announcementDocument [data-image-alt]').nth(0);
  await boundedAlt.evaluate((node) => {
    node.value = "a".repeat(201);
    node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "a" }));
  });
  await expect(boundedAlt).toHaveValue("a".repeat(201));
  await page.evaluate(() => { window.__noticePayload = null; });
  await submitInvalid(page, '대체 텍스트는 200자');
  await expect(boundedAlt).toHaveValue('a'.repeat(201));
  await boundedAlt.fill('a'.repeat(200));
  const bounded = await publish(page);
  expect(bounded.content.blocks.find(block => block.type === 'image').alt).toBe('a'.repeat(200));
});

test("invalid animated WebP is rejected without upload and the text draft remains", async ({ page }) => {
  await boot(page);
  await page.locator("#announcementDocument [data-paragraph]").fill("보존할 초안");
    const animated = Buffer.from("RIFF0000WEBPVP8X00000000ANIM0000ANMF0000", "ascii");
  await page.locator("#announcementImageInput").setInputFiles({ name: "animated.webp", mimeType: "image/webp", buffer: animated });

  await expect(page.locator("#announcementEditorStatus")).toContainText("움직이는 WebP는 지원하지 않습니다");
  expect(await page.evaluate(() => window.__uploads.length)).toBe(0);
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(0)).toHaveText("보존할 초안");
  await expect(page.locator("[data-block-action=retry]")).toBeVisible();
});

test("failed upload unlocks controls, keeps the draft, and succeeds on retry", async ({ page }) => {
  await boot(page, { notices: [{ id: 3, body: "다른 공지", starts_at: "2026-09-06T10:00:00.000Z", ends_at: null, active: true }], failFirstUpload: true });
  await page.locator("#announcementDocument [data-paragraph]").fill("실패해도 남을 초안");
  const png = await imageBytes(page, "image/png");
  await page.locator("#announcementImageInput").setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: png });

  await expect(page.locator("#announcementForm button[type=submit]")).toBeDisabled();
  await expect(page.locator("#announcementReset")).toBeDisabled();
  await expect(page.locator("[data-edit-notice='3']")).toBeDisabled();
  await expect(page.locator("[data-block-action=retry]")).toBeVisible();
  await expect(page.locator("#announcementForm button[type=submit]")).toBeEnabled();
  await expect(page.locator("#announcementReset")).toBeEnabled();
  await expect(page.locator("[data-edit-notice='3']")).toBeEnabled();
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(0)).toHaveText("실패해도 남을 초안");

  await page.locator("[data-block-action=retry]").click();
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(1);
  await expect(page.locator("#announcementEditorStatus")).toContainText("업로드 완료");
  await expect(page.locator('#announcementDocument > [data-paragraph]').nth(0)).toHaveText("실패해도 남을 초안");
});

test("rich editor controls fit a narrow mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.locator("#announcementDocument [data-paragraph]").fill("모바일 공지");
    await page.locator("#announcementDocument").press("Enter");

  const dimensions = await page.locator("#announcementEditor").evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    viewport: document.documentElement.clientWidth,
    right: node.getBoundingClientRect().right,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
  const toolbar = await page.locator(".announcement-block-toolbar").boundingBox();
  expect(toolbar.width).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(page.locator(".announcement-block-toolbar button").first()).toHaveCSS("min-height", "44px");
});

test('PNG clipboard paste at a real middle caret preserves paragraph image paragraph order', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('앞문단뒷문단');
  await selectText(page, 3);
  await pasteImages(page, [await imageBytes(page, 'image/png')]);
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(1);
  await expect(page.locator('#announcementDocument > [data-paragraph]')).toHaveText(['앞문단', '뒷문단']);
  const payload = await publish(page);
  expect(payload.body).toBe('앞문단\n\n뒷문단');
  expect(payload.content.blocks.map(block => block.type)).toEqual(['paragraph', 'image', 'paragraph']);
  expect(payload.content.blocks[1].path).toBe(`${HASHES[0]}.webp`);
});

test('hostile clipboard HTML is pasted as plaintext without remote images or execution', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('앞뒤');
  await selectText(page, 1);
  const text = '<img src=x onerror="window.__clipboardExecuted=true">안전';
  await page.locator('#announcementDocument').evaluate((editor, plain) => {
    const data = new DataTransfer();
    data.setData('text/plain', plain);
    data.setData('text/html', '<img src="https://evil.invalid/pixel" onerror="window.__clipboardExecuted=true"><script>window.__clipboardExecuted=true</script><b>안전</b>');
    editor.dispatchEvent(new ClipboardEvent('paste', {bubbles:true,cancelable:true,clipboardData:data}));
  }, text);
  await expect(page.locator('#announcementDocument')).toHaveText(`앞${text}뒤`);
  await expect(page.locator('#announcementDocument img, #announcementDocument script, #announcementDocument b')).toHaveCount(0);
  expect(await page.evaluate(() => window.__clipboardExecuted)).toBeUndefined();
  expect((await publish(page)).body).toBe(`앞${text}뒤`);
});

test('Enter splits a paragraph and selected typing replaces only the selected text', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('앞문단뒷문단');
  await selectText(page, 3);
  await page.keyboard.press('Enter');
  await expect(page.locator('#announcementDocument > [data-paragraph]')).toHaveText(['앞문단', '뒷문단']);
  await selectText(page, 0, 1, 1);
  await page.keyboard.insertText('새');
  const payload = await publish(page);
  expect(payload.body).toBe('앞문단\n\n새문단');
  expect(payload.content.blocks.map(block => block.text)).toEqual(['앞문단', '새문단']);
});

test('empty and whitespace-only body cannot publish', async ({ page }) => {
  await boot(page);
  await submitInvalid(page, '공지 본문');
  await page.locator('#announcementDocument [data-paragraph]').fill('   ');
  await submitInvalid(page, '공지 본문');
  await expect(page.locator('#announcementForm [name=body]')).toHaveValue('   ');
});

test('multiple clipboard images upload sequentially and preserve middle caret text', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('앞뒤');
  await selectText(page, 1);
  const png = await imageBytes(page, 'image/png');
  await pasteImages(page, [png, png]);
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(2);
  await expect(page.locator('#announcementDocument figure')).toHaveCount(2);
  expect(await page.evaluate(() => window.__maxConcurrentUploads)).toBe(1);
  const payload = await publish(page);
  expect(payload.content.blocks.map(block => block.type)).toEqual(['paragraph', 'image', 'image', 'paragraph']);
  expect(payload.content.blocks.filter(block => block.type === 'paragraph').map(block => block.text)).toEqual(['앞', '뒤']);
  expect(payload.content.blocks.filter(block => block.type === 'image').map(block => block.path)).toEqual(HASHES.slice(0, 2).map(hash => `${hash}.webp`));
  expect(payload.body).toBe('앞\n\n뒤');
});

test('link previews appear inside editor and never enter stored body or blocks', async ({ page }) => {
  await boot(page);
  const text = '미리보기 https://youtu.be/dQw4w9WgXcQ https://example.com/docs';
  await page.locator('#announcementDocument [data-paragraph]').fill(text);
  await expect(page.locator('#announcementDocument [data-link-preview] .notice-link-preview')).toHaveCount(2);
  await expect(page.locator('#announcementDocument [data-link-preview]')).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('#announcementDocument .notice-link-poster img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  const payload = await publish(page);
  expect(payload.body).toBe(text);
  expect(payload.content.blocks).toHaveLength(1);
  expect(payload.content.blocks[0].text).toBe(text);
});

test('typed draft retains 2001 codepoints but only the exact 2000 boundary publishes', async ({ page }) => {
  await boot(page);
  const paragraph = page.locator('#announcementDocument [data-paragraph]');
  const exact = '😀'.repeat(2000);
  await paragraph.fill(exact + '가');
  await expect(page.locator('#announcementTextCount')).toContainText('2001 / 2000');
  await submitInvalid(page, '2000자');
  await expect(paragraph).toHaveText(exact + '가');
  await paragraph.fill(exact);
  expect((await publish(page)).body).toBe(exact);
});

test('stored content ending in media roundtrips without adding an empty paragraph', async ({ page }) => {
  const content = {version: 1, blocks: [
    {type:'paragraph', text:'원본', size:'normal', align:'left', bold:false, italic:false, underline:false},
    {type:'image', path:`${HASHES[0]}.webp`, alt:'마지막 이미지', width:100},
  ]};
  await boot(page, {notices:[{id:19, body:'원본', content, starts_at:'2026-09-06T10:00:00.000Z', active:true}]});
  await page.locator('[data-edit-notice="19"]').click();
  const payload = await publish(page);
  expect(payload.body).toBe('원본');
  expect(payload.content).toEqual(content);
});

test('compression over the hard 300 KiB ceiling cannot upload or discard the draft', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('압축 실패에도 유지');
  const png = await imageBytes(page, 'image/png');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      return original.call(this, blob => callback(new Blob([blob, new Uint8Array(301 * 1024)], {type:'image/webp'})), type, quality);
    };
  });
  await page.locator('#announcementImageInput').setInputFiles({name:'too-large.png', mimeType:'image/png', buffer:png});
  await expect(page.locator('#announcementEditorStatus')).toContainText('300 KiB');
  expect(await page.evaluate(() => window.__mediaAttempts)).toBe(0);
  await expect(page.locator('#announcementDocument [data-paragraph]').first()).toHaveText('압축 실패에도 유지');
  await expect(page.locator('[data-block-action=retry]')).toBeVisible();
});

// Pasting plaintext retains its original line breaks rather than doubling each line.
test('multiline plaintext paste keeps exact newlines', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('앞뒤');
  await selectText(page, 1);
  await page.locator('#announcementDocument').evaluate(node => {
    const data = new DataTransfer();
    data.setData('text/plain', '첫줄\n\n둘째줄');
    node.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
  });
  const payload = await publish(page);
  expect(payload.body).toBe('앞첫줄\n\n둘째줄뒤');
});
