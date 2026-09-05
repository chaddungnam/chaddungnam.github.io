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
  unfinishedPlays: [{
    installKey: "설치 123456", userId: "user-pop", nickname: "팝팝", displayCode: "POP1", country: "KR",
    startedAt: 1788333072, lastSeenAt: 1788333114, level: 1, score: 157, tutorial: true,
    tutorialStage: "bomb_roulette", tutorialStageIndex: 9, lastScreen: "main",
    lastButtonId: "main/ui/control_0/panel_1/button_0", status: "background", isNewPlayer: true,
    identityMatch: "auth_window", platformKey: "ios", platformSource: "analytics_event", accountCompletedGameCount: 0,
    sameInstallCompletedAfterCount: 0,
  }, {
    installKey: "설치 654321", userId: "user-scapy", nickname: "스카피", displayCode: "SCAPY1", country: "KR",
    startedAt: 1788332000, lastSeenAt: 1788332400, level: 16, score: 538961, tutorial: false,
    tutorialStage: "", tutorialStageIndex: null, lastScreen: "gameloading",
    lastButtonId: "main/ui/control_0/panel_1/button_0", status: "verified_exit", isNewPlayer: false,
    identityMatch: "same_runtime", platformKey: "android", platformSource: "analytics_event", accountCompletedGameCount: 3,
    sameInstallCompletedAfterCount: 1, latestCompletedScore: 2005262, latestCompletedLevel: 16,
  }],
  periodPlayers: [
    { userId: "user-pop", nickname: "팝팝", displayCode: "POP1", country: "KR", distributionKey: "app_store", platformSource: "apple_identity", platformSeenAt: "2026-08-26T06:40:00Z", periodDistributionKeys: [], observedDistributionKeys: ["app_store"], gamesPlayed: 1, visitCount: 1, visitDays: 1, bestScore: 157, bestLevel: 1, latestActivityAt: "2026-08-26T06:40:00Z", activitySource: "visit_and_game" },
    { userId: "user-scapy", nickname: "스카피", displayCode: "SCAPY1", country: "JP", distributionKey: "google_play", platformSource: "observed", platformSeenAt: "2026-08-25T06:40:00Z", periodDistributionKeys: [], observedDistributionKeys: ["app_store", "google_play"], gamesPlayed: 0, visitCount: 0, visitDays: 0, bestScore: 0, bestLevel: 0, latestActivityAt: "2026-08-26T06:30:00Z", activitySource: "app_activity" },
    { userId: "user-legacy", nickname: "구버전", displayCode: "OLD1", country: "DE", distributionKey: "", platformSource: "unknown", platformSeenAt: "", periodDistributionKeys: [], observedDistributionKeys: [], gamesPlayed: 0, visitCount: 0, visitDays: 0, bestScore: 0, bestLevel: 0, latestActivityAt: "2026-08-26T06:20:00Z", activitySource: "signed_in" },
  ],
  periodPlayerTotal: 3,
  gameMetrics: { current: null, daily: [] },
  gameRunSummary: {
    total: 4,
    rows: [
      { status: "completed", games: 1, suspendCount: 1, resumeCount: 1, checkpointCount: 1, lastCheckpointAgeSec: 100, lastSeenAgeSec: 80, lastLevel: 5, lastScore: 300, stale: false },
      { status: "scene_exit", games: 1, suspendCount: 0, resumeCount: 0, checkpointCount: 0, lastCheckpointAgeSec: null, lastSeenAgeSec: 60, lastLevel: null, lastScore: null, stale: false },
      { status: "app_quit", games: 1, suspendCount: 0, resumeCount: 0, checkpointCount: 0, lastCheckpointAgeSec: null, lastSeenAgeSec: 40, lastLevel: null, lastScore: null, stale: false },
      { status: "unknown_stale", games: 1, suspendCount: 0, resumeCount: 0, checkpointCount: 1, lastCheckpointAgeSec: 30, lastSeenAgeSec: 30, lastLevel: 1, lastScore: 80, stale: true },
    ],
    latestCheckpoint: { ageSec: 30, level: 1, score: 80, status: "unknown_stale" },
  },
  balanceSummary: {
    runs: 4,
    terminalOutcomes: [
      { status: "completed", games: 1, medianLevel: 6, medianScore: 500, medianDurationSec: 100 },
      { status: "scene_exit", games: 1, medianLevel: 2, medianScore: 100, medianDurationSec: 30 },
      { status: "app_quit", games: 1, medianLevel: 1, medianScore: 60, medianDurationSec: 20 },
      { status: "unknown_stale", games: 1, medianLevel: 1, medianScore: 80, medianDurationSec: null },
    ],
    pressure: { checkpointSamples: 2, medianMarbles: 10.5, p90Marbles: 12, medianMaxLevel: 4.5, p90MaxLevel: 5, medianOccupancyPct: 52.5, p90OccupancyPct: 80 },
    choiceOutcomes: [
      { choice: "watcher_eye", selectedRuns: 1, completedRuns: 1, sceneExitRuns: 0, appQuitRuns: 0, unknownStaleRuns: 0, completionRate: 1, medianFinalLevel: 6, medianFinalScore: 500 },
    ],
  },
  diagnostics: {
    issueSignals: [{ signal: "tutorial_incomplete", count: 1 }],
    tutorial: { started: 4, completed: 2, aborted: 1, incomplete: 1, completionRate: 0.5, stages: [
      { stage: "hook", stageIndex: 1, entered: 4, completed: 4, aborted: 0, incomplete: 0 },
      { stage: "golden_shooting", stageIndex: 8, entered: 3, completed: 2, aborted: 1, incomplete: 0 },
    ] },
    growthChoices: { presented: 0, selected: 4, confirmed: 0, selectionRate: null, byLevel: [], choices: [{ choice: "mad_scientist", selected: 4 }] },
    mechakucha: { started: 0, completed: 0, aborted: 0, incomplete: 0, completionRate: null, avgScoreGain: null, avgMarblesRestored: null },
    gameOver: { total: 10, medianScore: 2600, medianLevel: 4, avgScorePerMinute: 1840, avgBestChain: 3.2, level10ReachRate: 0.3, breakthroughUseRate: 0.4, scoreSamples: 10, scorePerMinuteSamples: 7, bestChainSamples: 6, levelSamples: 10, breakthroughSamples: 5, byDay: gameOverDays, levelBuckets: [{ bucket: "1-2", games: 4, avgScore: 1200, medianScore: 1100, avgLevel: 1.5 }] },
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
  await expect(page.locator("#unfinishedPlaysTitle")).toHaveText("완료되지 않은 판");
  await expect(page.locator("#unfinishedPlaysStatus")).toHaveText("2판");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("팝팝");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("스카피");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("신규 첫 실행");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("백그라운드 전환");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("튜토리얼 · 폭탄 룰렛");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("Lv.1");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("157점");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("계정 완료 0판");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("이후 완료 1판");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("2,005,262점 · Lv.16");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("유일한 인증·플레이 시각 연결");
  await expect(page.locator("#unfinishedPlaysTable")).toContainText("같은 앱 실행의 인증 계정 확인");
  await expect(page.locator("#unfinishedPlaysTable .platform-label")).toHaveText(["iOS", "AOS"]);
  await expect(page.locator("#periodPlayersTable")).toContainText("대한민국");
  await expect(page.locator("#periodPlayersTable")).toContainText("일본");
  await expect(page.locator("#periodPlayersTable")).toContainText("독일");
  await expect(page.locator("#periodPlayersTable .platform-label")).toHaveText(["iOS", "iOS · AOS", "추적 대기"]);
  await expect(page.locator("#coreLoopSummary")).toContainText("중앙 점수");
  await expect(page.locator("#coreLoopSummary")).toContainText("2,600점");
  await expect(page.locator("#coreLoopSummary")).toContainText("분당 점수");
  await expect(page.locator("#coreLoopSummary")).toContainText("1,840점");
  await expect(page.locator("#coreLoopSummary")).toContainText("Lv.10 도달");
  await expect(page.locator("#coreLoopSummary")).toContainText("30.0%");
  await expect(page.locator("#coreLoopStatus")).toHaveText("총 10판");
  await expect(page.locator("#coreLoopSummary .coverage-card").filter({ hasText: "중앙 점수" })).toContainText("표본 10판");
  await expect(page.locator("#coreLoopSummary .coverage-card").filter({ hasText: "분당 점수" })).toContainText("표본 7판");
  await expect(page.locator("#coreLoopSummary .coverage-card").filter({ hasText: "최고 연쇄 평균" })).toContainText("표본 6판");
  await expect(page.locator("#coreLoopSummary .coverage-card").filter({ hasText: "Lv.10 도달" })).toContainText("표본 10판");
  await expect(page.locator("#coreLoopSummary .coverage-card").filter({ hasText: "돌파 사용" })).toContainText("표본 5판");
  await expect(page.locator("#gameRunStatusTotal")).toHaveText("4판");
  await expect(page.locator("#gameRunStatusTable")).toContainText("정상 완료");
  await expect(page.locator("#gameRunStatusTable")).toContainText("장면 종료");
  await expect(page.locator("#gameRunStatusTable")).toContainText("앱 종료 감지");
  await expect(page.locator("#gameRunStatusTable")).toContainText("미확인·stale");
  await expect(page.locator("#gameRunStatusTable")).toContainText("1회 · 1회");
  await expect(page.locator("#gameRunLatestCheckpoint")).toContainText("30초 전");
  await expect(page.locator("#balanceTerminalTable")).toContainText("정상 완료");
  await expect(page.locator("#balanceTerminalTable")).toContainText("500점");
  await expect(page.locator("#balancePressureSummary")).toContainText("중앙 10.5개");
  await expect(page.locator("#balancePressureSummary")).toContainText("P90 12개");
  await expect(page.locator("#balancePressureSummary")).toContainText("중앙 52.5%");
  await expect(page.locator("#balanceChoiceTable")).toContainText("Watcher Eye");
  await expect(page.locator("#balanceChoiceTable")).toContainText("100.0%");
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
