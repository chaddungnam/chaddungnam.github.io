const { test, expect } = require("@playwright/test");

const gameOverDays = Array.from({ length: 10 }, (_, index) => ({
  day: `2026-08-${String(17 + index).padStart(2, "0")}`,
  games: index + 1,
  avgScore: 1000 + index * 500,
  medianScore: 900 + index * 400,
  avgLevel: 2 + index * 0.5,
}));

const dashboard = {
  generatedAt: "2026-08-26T07:00:00.000Z",
  rangeDays: 7,
  truncated: false,
  summary: { installs: 4, activeInstallsToday: 2, sessions: 8, gamesStarted: 6, gameOvers: 4, midGameExits: 1, unobservedGames: 1, avgSessionSeconds: 180, avgGameSeconds: 150 },
  retention: [{ day: 1, rate: 0.25 }, { day: 7, rate: 0.1 }],
  health: { status: "insufficient", score: null, summary: "데이터 수집 중" },
  adEconomics: { estimatedRevenueEur: 0, monetizedImpressions: 0, testImpressions: 0, formatBreakdown: [] },
  platforms: [],
  acquisitionQuality: {},
  purchaseFunnel: {},
  purchaseExclusions: {},
  daily: gameOverDays.map((row) => ({ ...row, activeInstalls: 1, sessions: 1, firstOpens: 0, gamesStarted: 1, gameOvers: 1, midGameExits: 0, unobservedGames: 0, adImpressions: 0, adRewards: 0, avgSessionSeconds: 180, avgGameSeconds: 150 })),
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0, activeInstalls: 0 })),
  ads: [],
  choices: { growth: [], roulette: [] },
  interactions: { buttons: [], screens: [], dropoffs: [] },
  marketingGate: { eligible: false, weightedDailyPeople: 4.9, observedGames: 4, completionRate: 0.49, exitTrend: 0.51 },
  funnel: [{ event: "first_open", users: 4 }, { event: "game_start", users: 3 }, { event: "game_over", users: 2 }],
  periodPlayers: [],
  periodPlayerTotal: 0,
  gameMetrics: { current: null, daily: [] },
  diagnostics: {
    issueSignals: [{ signal: "tutorial_incomplete", count: 1 }],
    tutorial: { started: 4, completed: 2, aborted: 1, incomplete: 1, completionRate: 0.5, stages: [
      { stage: "hook", stageIndex: 1, entered: 4, completed: 4, aborted: 0, incomplete: 0 },
      { stage: "golden_shooting", stageIndex: 8, entered: 3, completed: 2, aborted: 1, incomplete: 0 },
    ] },
    growthChoices: { presented: 0, selected: 4, confirmed: 0, selectionRate: null, byLevel: [], choices: [{ choice: "mad_scientist", selected: 4 }] },
    mechakucha: { started: 0, completed: 0, aborted: 0, incomplete: 0, completionRate: null, avgScoreGain: null, avgMarblesRestored: null },
    gameOver: { total: 10, medianScore: 2600, medianLevel: 4, byDay: gameOverDays, levelBuckets: [{ bucket: "1-2", games: 4, avgScore: 1200, medianScore: 1100, avgLevel: 1.5 }] },
  },
};

test("marketing review gate renders raw waiting evidence and defines explicit app quit truthfully", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{}};`,
  }));
  await page.route("**/console/api.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAPI={initialize:()=>{},post:async(name)=>name==="analytics-dashboard-v2"?${JSON.stringify(dashboard)}:{summary:{},total:0}};`,
  }));

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();

  await expect(page.locator("#marketingGateTitle")).toHaveText("유료 마케팅 검토 조건");
  await expect(page.locator("#marketingGateStatus")).toHaveText("대기");
  await expect(page.locator("#marketingGateSummary")).toContainText("4.9명 / 5명");
  await expect(page.locator("#marketingGateSummary")).toContainText("4판 / 5판");
  await expect(page.locator("#marketingGateSummary")).toContainText("49.0% / 50.0%");
  await expect(page.locator("#marketingGateSummary")).toContainText("51.0% / 50.0% 미만");
  await expect(page.locator("#screenDropoffDefinition")).toHaveText("명시적 app_quit만 집계합니다. 광고·외부 링크·일시 중단의 background는 종료로 세지 않습니다.");
});

test("gameplay diagnostics survive hidden-panel open, resize, legacy choices, and mobile width", async ({ page, isMobile }) => {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/console/auth.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),snapshot:()=>({signedIn:true,unlocked:true,email:"qa@houseduck.in"}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{}};`,
  }));
  await page.route("**/console/api.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.ConsoleAPI={initialize:()=>{},post:async(name)=>name==="analytics-dashboard-v2"?${JSON.stringify(dashboard)}:{summary:{},total:0}};`,
  }));
  await page.addInitScript(() => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    window.__gameOverLabels = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas?.id === "gameOverChart") window.__gameOverLabels.push(String(text));
      return originalFillText.call(this, text, ...args);
    };
  });

  await page.goto("/console/");
  await page.locator("#projectQuirkyBall").click();
  await page.locator("#operatorDetails > summary").click();

  await expect(page.locator("#tutorialStagesTable")).toContainText("첫 목표 소개");
  await expect(page.locator("#tutorialStagesTable")).toContainText("골든 슈팅");
  await expect(page.locator("#tutorialStagesTable")).not.toContainText("단계 2");
  await expect(page.locator("#growthChoicesTable")).toContainText("매드 사이언티스트");
  await expect(page.locator("#growthChoiceStatus")).toHaveText("4회 선택");

  const assertChart = async () => {
    await expect.poll(() => page.locator("#gameOverChart").evaluate((canvas) => ({
      css: Math.round(canvas.getBoundingClientRect().width),
      parent: Math.round(canvas.parentElement.getBoundingClientRect().width),
      bitmap: canvas.width,
      expectedBitmap: Math.round(canvas.parentElement.getBoundingClientRect().width * devicePixelRatio),
    }))).toEqual(expect.objectContaining({ css: expect.any(Number), parent: expect.any(Number) }));
    const geometry = await page.locator("#gameOverChart").evaluate((canvas) => ({
      css: Math.round(canvas.getBoundingClientRect().width),
      parent: Math.round(canvas.parentElement.getBoundingClientRect().width),
      bitmap: canvas.width,
      expectedBitmap: Math.round(canvas.parentElement.getBoundingClientRect().width * devicePixelRatio),
    }));
    expect(geometry.css).toBe(geometry.parent);
    expect(geometry.bitmap).toBe(geometry.expectedBitmap);
  };

  await assertChart();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.evaluate(() => {
      window.__gameOverLabels = [];
      window.dispatchEvent(new Event("resize"));
    });
    await expect.poll(() => page.evaluate(() => window.__gameOverLabels.length)).toBe(3);
    await assertChart();
  }

  if (isMobile) {
    expect(await page.locator("#growthChoiceStatus").evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getClientRects().length;
    })).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
  }
});
