const { test, expect } = require("@playwright/test");

test("operator can publish a notice from operations", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{if(body.action==="operations.get")return{config:{},notices:[],reward_mail_broadcasts:[],catalog:[]};if(body.action==="announcements.publish"){window.__noticePayload=body;return{ok:true,announcement_id:8};}return{};}};` }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
  const noticeForm = page.locator("#announcementForm");
  const noticeBody = noticeForm.locator("[name=body]");
  const [gridBox, formBox, bodyBox] = await Promise.all([
    page.locator("#operationsView .admin-card-grid").boundingBox(),
    noticeForm.boundingBox(),
    noticeBody.boundingBox(),
  ]);
  expect(Math.abs(gridBox.width - formBox.width)).toBeLessThanOrEqual(1);
  expect(bodyBox.height).toBeGreaterThanOrEqual(350);
  expect(bodyBox.height).toBeLessThanOrEqual(500);
  await expect(noticeBody).toHaveCSS("font-size", "16px");
  await expect(noticeBody).toHaveCSS("line-height", "26.4px");
  await expect(noticeBody).toHaveCSS("resize", "vertical");
  await expect(noticeBody).toHaveAttribute("maxlength", "2000");
  await noticeBody.fill("1.1.1 공지 테스트입니다.");
  await page.locator("#announcementForm [name=startsAt]").fill("2026-08-29T10:00");
  await page.locator("#announcementForm [name=reason]").fill("에디터 공지 경로 확인");
  await page.locator("#announcementForm button[type=submit]").click();

  await expect.poll(() => page.evaluate(() => window.__noticePayload)).toMatchObject({
    action: "announcements.publish",
    body: "1.1.1 공지 테스트입니다.",
    reason: "에디터 공지 경로 확인",
  });
  await expect(page.locator("[data-notice-id='8'] p")).toHaveText("1.1.1 공지 테스트입니다.");
  await expect(page.locator("#announcementMessage")).toContainText("작업을 완료했습니다");
});

test("operator can edit an existing notice including start and end dates", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{if(body.action==="operations.get")return{config:{},notices:[{id:7,body:"이전 공지",starts_at:"2026-08-29T10:00:00.000Z",ends_at:"2026-09-01T10:00:00.000Z",active:true}],reward_mail_broadcasts:[],catalog:[]};if(body.action==="announcements.update"){window.__noticePayload=body;return{ok:true};}return{};}};` }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
  await page.locator("[data-edit-notice='7']").click();
  await page.locator("#announcementForm [name=body]").fill("1.1.1 공지 본문과 날짜를 수정합니다.");
  await page.locator("#announcementForm [name=startsAt]").fill("2026-09-02T09:00");
  await page.locator("#announcementForm [name=endsAt]").fill("2026-09-16T09:00");
  await page.locator("#announcementForm [name=reason]").fill("게시 시작일 수정");
  await page.locator("#announcementForm button[type=submit]").click();

  await expect.poll(() => page.evaluate(() => window.__noticePayload)).toMatchObject({
    action: "announcements.update",
    announcementId: 7,
    body: "1.1.1 공지 본문과 날짜를 수정합니다.",
    reason: "게시 시작일 수정",
  });
  await expect(page.locator("[data-notice-id='7'] p")).toHaveText("1.1.1 공지 본문과 날짜를 수정합니다.");
  await expect(page.locator("#announcementForm [name=announcementId]")).toHaveValue("");
  await expect(page.locator("#announcementForm button[type=submit]")).toHaveText("공지 발행");
});

test("notice edit clearly explains that a required reason is missing", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{if(body.action==="operations.get")return{config:{},notices:[{id:7,body:"이전 공지",starts_at:"2026-08-29T10:00:00.000Z",ends_at:null,active:true}],reward_mail_broadcasts:[],catalog:[]};return{};}};` }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.locator("[data-edit-notice='7']").click();
  await page.locator("#announcementForm [name=body]").fill("수정했지만 사유는 비어 있습니다.");
  await page.locator("#announcementForm button[type=submit]").click();

  await expect(page.locator("#announcementMessage")).toHaveText("수정·발행 사유를 입력해 주세요. 아직 서버에는 반영되지 않았습니다.");
  await expect(page.locator("#announcementForm [name=body]")).toHaveValue("수정했지만 사유는 비어 있습니다.");
});


test("notice translation failure keeps the draft and shows a useful message", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{if(body.action==="operations.get")return{config:{},notices:[{id:7,body:"이전 공지",starts_at:"2026-08-29T10:00:00.000Z",ends_at:null,active:true}],reward_mail_broadcasts:[],catalog:[]};if(body.action==="announcements.update")throw Object.assign(new Error("notice_translation_unavailable"),{status:503});return{};}};` }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
  await page.locator("[data-edit-notice='7']").click();
  await page.locator("#announcementForm [name=body]").fill("번역 실패에도 보존할 공지");
  await page.locator("#announcementForm [name=reason]").fill("번역 실패 회귀 검증");
  await page.locator("#announcementForm button[type=submit]").click();

  await expect(page.locator("#announcementMessage")).toContainText("입력한 본문은 유지됐으니 잠시 후 다시 시도해 주세요");
  await expect(page.locator("#announcementForm [name=body]")).toHaveValue("번역 실패에도 보존할 공지");
  await expect(page.locator("[data-notice-id='7'] p")).toHaveText("이전 공지");
});
