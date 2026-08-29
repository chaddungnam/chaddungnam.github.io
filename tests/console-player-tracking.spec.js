const { test, expect } = require("@playwright/test");

const USER_ID = "11111111-1111-4111-8111-111111111111";

test("tracked player identity opens detail and memo tags persist", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};`,
  }));
  await page.route("**/console/api.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      window.__playerNote={tracked:true,tags:["유튜브 구독자"],note:"첫 실행 버그 확인 중"};
      window.ConsoleAPI={initialize:()=>{},post:async(name,body)=>{
        if(name==="analytics-dashboard") return new Promise(()=>{});
        if(body.action==="analytics_exclusions.list") return {rows:[]};
        if(body.action==="players.list") return {total:1,mutations_enabled:true,rows:[{
          user_id:"${USER_ID}",nickname:"테스트덕",display_code:"pTESTDUCK01",account_type:"google",country:"KR",
          games_played:3,best_score:12000,best_level:7,gems:40,stamina:4,stamina_max:4,
          breakthrough_tickets:1,speed_boost_tickets:0,latest_played_at:"2026-08-29T06:00:00Z",
          operator_tracked:window.__playerNote.tracked,operator_tags:window.__playerNote.tags,operator_note:window.__playerNote.note
        }]};
        if(body.action==="players.note.set") { window.__playerNote={tracked:body.tracked,tags:body.tags,note:body.note}; window.__savedPlayerNote=body; return {ok:true}; }
        if(body.action==="players.get") return {ok:true,player:{
          user_id:"${USER_ID}",nickname:"테스트덕",display_code:"pTESTDUCK01",account_type:"google",country:"KR",
          state_version:2,best_score:12000,best_level:7,game_count:3,gems:40,stamina:4,stamina_max:4,
          breakthrough_tickets:1,speed_boost_tickets:0,ads_removed:false,latest_game_at:"2026-08-29T06:00:00Z",
          account_created_at:"2026-08-20T09:00:00Z"
        },operator_note:window.__playerNote,operations:{mutations_enabled:true,pending_mail_count:0,qa_shop_controls_enabled:false},catalog:[],entitlements:[],records:[],audit:[]};
        return {summary:{},total:0,rows:[]};
      }};`,
  }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator('#consoleNav a[data-page="players"]').click();

  const identity = page.locator("#playersTable .player-identity-link");
  await expect(identity).toContainText("테스트덕 · pTESTDUCK01");
  await expect(identity).toContainText("추적");
  await expect(identity).toContainText("유튜브 구독자");
  await identity.click();

  await expect(page.locator("#pageTitle")).toHaveText("플레이어 상세");
  await expect(page.locator("#playerNoteForm")).toBeVisible();
  await expect(page.locator("#playerNoteForm [name=tracked]")).toBeChecked();
  await expect(page.locator("#playerNoteForm [name=tags]")).toHaveValue("유튜브 구독자");
  await expect(page.locator("#playerNoteForm [name=note]")).toHaveValue("첫 실행 버그 확인 중");
  await expect(page.locator(".player-facts")).toContainText("최근 완료");
  await expect(page.locator(".player-facts")).toContainText("계정 생성");

  await page.locator("#playerNoteForm [name=tags]").fill("유튜브 구독자, 지인");
  await page.locator("#playerNoteForm [name=note]").fill("튜토리얼 재현 영상 요청");
  await page.locator("#playerNoteForm button[type=submit]").click();

  await expect(page.locator("#playerMessage")).toContainText("추적 메모를 저장했습니다");
  await expect(page.locator(".player-detail-head")).toContainText("지인");
  expect(await page.evaluate(() => window.__savedPlayerNote)).toMatchObject({
    action: "players.note.set",
    userId: USER_ID,
    tracked: true,
    tags: ["유튜브 구독자", "지인"],
    note: "튜토리얼 재현 영상 요청",
  });
});
