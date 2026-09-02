const { test, expect } = require("@playwright/test");

test("operator can publish a notice from operations", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `window.ConsoleAPI={initialize:()=>{},post:async(_name,body)=>{if(body.action==="operations.get")return{config:{},notices:[],reward_mail_broadcasts:[],catalog:[]};if(body.action==="announcements.publish"){window.__noticePayload=body;return{ok:true};}return{};}};` }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
  await page.locator("#announcementForm [name=body]").fill("1.1.1 공지 테스트입니다.");
  await page.locator("#announcementForm [name=startsAt]").fill("2026-08-29T10:00");
  await page.locator("#announcementForm [name=reason]").fill("에디터 공지 경로 확인");
  await page.locator("#announcementForm button[type=submit]").click();

  await expect.poll(() => page.evaluate(() => window.__noticePayload)).toMatchObject({
    action: "announcements.publish",
    body: "1.1.1 공지 테스트입니다.",
    reason: "에디터 공지 경로 확인",
  });
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
});
