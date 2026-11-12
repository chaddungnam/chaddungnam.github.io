const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

// 10key console audit 2 (owner 2026-11-12): every panel that showed nothing, a constant or a raw id now shows a real value or says why.
// Each test fails on the page before this round. TENKEY_SHOTS=<dir> writes captures of the changed panels.
const SHOTS = process.env.TENKEY_SHOTS || "";
test.describe.configure({ retries: 2 });
const API = fs.readFileSync(path.join(__dirname, "fixtures/console_tenkey_api.js"), "utf8");
const AUTH = fs.readFileSync(path.join(__dirname, "console-tenkey.spec.js"), "utf8").match(/const AUTH = `([^`]*)`/)[1];
const stub = (fn) => `\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{if(fn==="tenkey-admin"){const r=(${fn})(b);if(r!==undefined)return {ok:true,data:r};}return real(pj,fn,b);};})();`;

async function open(page, hash = "", extra = "") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("https://translate.googleapis.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: AUTH }));
  await page.route("**/console/api.js*", (route) => route.fulfill({ contentType: "application/javascript", body: API + extra }));
  await page.goto("/console/");
  await page.locator("#projectTenkey").click();
  if (hash) await page.evaluate((h) => { window.location.hash = h; }, hash);
  return errors;
}
async function shot(page, name, selector) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const project = test.info().project.name.startsWith("mobile") ? "phone" : "desktop";
  const file = path.join(SHOTS, `${project}_${name}.png`);
  if (selector) await page.locator(selector).screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: true });
}

test("overview: 다음 날 다시 온 비율 on the itch filter counts accounts (no more 0 % / '—'); the Android filter says it is the app total until the server splits it", async ({ page }) => {
  const errors = await open(page);
  await page.locator('[data-tk-platform="web_itch"]').click();
  const card = page.locator("#tenkeyGlanceWeek .tk-glance-card").nth(3);
  await expect(card).toContainText("다음 날 다시 온 비율");
  await expect(card.locator(".tk-glance-value")).toHaveText("33.3%");  // fixture: 7 days x (3 new, 1 back) itch accounts
  await expect(card).toContainText("새 계정 21명 중 7명");
  await expect(card).not.toContainText("셀 수 없음");
  await shot(page, "overview_return_itch", "#tenkeyGlanceWeek");
  await page.locator('[data-tk-platform="android"]').click();
  await expect(card.locator(".tk-glance-value")).toHaveText("50%");  // app cohort 2 new, 1 back, no android split in the old server answer
  await expect(card).toContainText("Android+iOS 합계");
  expect(errors).toEqual([]);
});

test("overview: with the v2 server answer the Android filter counts Android accounts only", async ({ page }) => {
  const MOCK = `\n(()=>{const real=window.ConsoleAPI.postProject;window.ConsoleAPI.postProject=async(pj,fn,b)=>{const r=await real(pj,fn,b);if(b&&b.action==="dau.get"&&r&&r.data)r.data.days.forEach((d)=>{d.new_android=4;d.back_android=1;d.new_ios=1;d.back_ios=1;});return r;};})();`;
  const errors = await open(page, "", MOCK);
  await page.locator('[data-tk-platform="android"]').click();
  const card = page.locator("#tenkeyGlanceWeek .tk-glance-card").nth(3);
  await expect(card.locator(".tk-glance-value")).toHaveText("25%");
  await expect(card).not.toContainText("합계");
  expect(errors).toEqual([]);
});

test("overview: the language chart says web builds send no language", async ({ page }) => {
  const errors = await open(page);
  await page.locator("#tenkeyOverviewMore summary").click();
  await expect(page.locator("#tenkeyOverviewMoreCharts")).toContainText("웹(itch) 판은 언어를 보내지 않아");
  await shot(page, "overview_language_note", "#tenkeyOverviewMoreCharts .ov-card:has(h3:has-text('누가 쓰나'))");
  expect(errors).toEqual([]);
});

test("audit: community link, nickname, mail and title changes get a plain name and summary instead of a raw id and '공지 #?'", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action!=="audit.list")return undefined;
    const row=(id,action,params)=>({id,at:"2026-11-12T09:00:00+00:00",admin_email:"ops@houseduck.in",action,params:{reason:"점검",...params},result:{ok:true}});
    return [row(5,"community.set",{url:"https://www.youtube.com/watch?v=abc"}),row(4,"players.rename",{player_id:"a1111111-1111-4111-8111-111111111111",nickname:"새이름"}),
      row(3,"mail.send",{all:true,target:"",title_i18n:{ko:"보상 안내"}}),row(2,"titles.grant",{player_id:"a1111111-1111-4111-8111-111111111111",title_id:"event_winner"}),row(1,"notices.delete",{id:7})];
  }`);
  const errors = await open(page, "#/tenkey-audit", MOCK);
  const list = page.locator("#tenkeyAuditList");
  await expect(list.locator(".audit-item")).toHaveCount(5);
  await expect(list).toContainText("유튜브 소통 링크 변경");
  await expect(list).toContainText("https://www.youtube.com/watch?v=abc");
  await expect(list).toContainText("닉네임 변경");
  await expect(list).toContainText("메일 보내기");
  await expect(list).toContainText("전체 계정 · 보상 안내");
  await expect(list).toContainText("칭호 부여");
  await expect(list).toContainText("공지 #7");
  await expect(list).not.toContainText("community.set");
  await expect(list).not.toContainText("공지 #?");
  await shot(page, "audit_names", "#tenkeyAuditList");
  expect(errors).toEqual([]);
});

test("ranking: the running board is a quarter season, not 'this week'", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action!=="ranking.board")return undefined;
    return {ok:true,board:b.params.board==="all"?"all":"q2026-4",kind:b.params.board==="all"?"all":"week",ends:b.params.board==="all"?null:"2027-01-01T09:00:00+00:00",current_rules:1,total:1,
      rows:[{rank:1,player_id:"a1111111-1111-4111-8111-111111111111",name:"PD",provider:"supabase",score:2013580,level:12,time_ms:562504,achieved_at:"2026-11-06T12:54:54+00:00",rules:1,banned:false,eligible:true}],boards:["all","q2026-4"]};
  }`);
  const errors = await open(page, "#/tenkey-ranking", MOCK);
  await expect(page.locator("#tenkeyBoardTitle")).toContainText("2026년 4분기 시즌");
  await expect(page.locator("#tenkeyBoardMeta")).toContainText("시즌 끝");
  const options = await page.locator("#tenkeyBoardSelect option").allTextContents();
  expect(options).toEqual(["이번 시즌", "전체 기간"]);  // no second entry for the same running season
  await expect(page.locator("#tenkeyRankingView")).not.toContainText("이번 주");
  await shot(page, "ranking_season", "#tenkeyRankingView");
  expect(errors).toEqual([]);
});

test("purchases and player detail: products read as names (젬 200개), the raw id stays small beneath", async ({ page }) => {
  const errors = await open(page, "#/tenkey-purchases");
  const table = page.locator("#tenkeyPurchasesTable");
  await expect(table).toContainText("젬 200개");
  await expect(table).toContainText("tk_gems_200");
  await expect(page.locator("#tenkeyGemFacts")).toContainText("젬 200개 1건");
  await shot(page, "purchases_names", "#tenkeyPurchasesView .panel:has(#tenkeyPurchasesTable)");
  expect(errors).toEqual([]);
});

test("player detail: the device block and the balance runs say why they are empty (privacy gate), not just '—'", async ({ page }) => {
  const MOCK = stub(`(b)=>{
    if(b.action!=="players.facts")return undefined;
    return {ok:true,client_info:null,balance_runs:[],platform:{value:"android",source:"run"},age_state:"unregistered",retention:{source:"server",first_day:"2026-11-01",milestones:[]}};
  }`);
  const errors = await open(page, "#/tenkey-players/a1111111-1111-4111-8111-111111111111", MOCK);
  const detail = page.locator("#tenkeyPlayerDetail");
  await expect(detail).toContainText("개인정보 방침에 이 항목이 올라가기 전");
  await expect(detail).toContainText("플레이어에 연결하는 기능이 개인정보 방침 반영 전이라 꺼져 있어");
  await expect(detail).not.toContainText("아직 연결된 판 기록이 없습니다");
  await expect(detail).toContainText("이번 시즌 순위");
  await shot(page, "player_empty_reasons", "#tenkeyPlayerDetail");
  expect(errors).toEqual([]);
});

test("unlock panel: the hard card rule uses the game's level (8, apps only), not the stale 20", async ({ page }) => {
  const errors = await open(page, "#/tenkey-players/a1111111-1111-4111-8111-111111111111");
  const row = page.locator('.tk-unlock-row[data-step="hard_card"]');
  await expect(row).toContainText("최고 레벨이 8 이상이면 보임 (앱만)");
  await expect(row).not.toContainText("20 이상");
  expect(errors).toEqual([]);
});

test("crashes: the 설치 수 column explains its dashes", async ({ page }) => {
  const errors = await open(page, "#/tenkey-crashes");
  await expect(page.locator('#tenkeyCrashGroups td[data-label="설치 수"]').first()).toHaveAttribute("title", /설치 번호를 보낸 보고만/);
  expect(errors).toEqual([]);
});
