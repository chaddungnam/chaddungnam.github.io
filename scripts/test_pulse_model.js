const assert = require("node:assert/strict");
const { buildPulseModel } = require("../analytics/pulse-model.js");

function payload(overrides = {}) {
  return {
    summary: {
      sessions: 40,
      installs: 40,
      avgGameSeconds: 210,
      gamesStarted: 20,
      gameOvers: 15,
      activeInstallsToday: 10,
      ...overrides.summary,
    },
    rangeDays: overrides.rangeDays ?? 1,
    daily: overrides.daily ?? [{ activeInstalls: 10 }],
    periodReturn: overrides.periodReturn ?? { currentPlayers: 10, previousPlayers: 20, returnedPlayers: 5, rate: 0.25 },
    retention: overrides.retention ?? [{ day: 1, rate: 0.25 }],
    adEconomics: {
      impressionsPerPlayer: 2,
      estimatedRevenueEur: 1.25,
      formatBreakdown: [{ format: "interstitial", impressionsPerPlayer: 0.5 }],
      ...overrides.adEconomics,
    },
    funnel: overrides.funnel ?? [
      { event: "first_open", users: 10 },
      { event: "game_start", users: 8 },
      { event: "game_over", users: 6 },
    ],
    health: { status: "good", score: 82, summary: "흐름이 안정적입니다.", ...overrides.health },
  };
}

const healthy = buildPulseModel(payload());
assert.equal(healthy.verdict.status, "good");
assert.equal(healthy.metrics.duration.status, "good");
assert.equal(healthy.metrics.completion.status, "good");
assert.equal(healthy.metrics.retention.status, "good");
assert.equal(healthy.metrics.ads.status, "good");
assert.equal(healthy.metrics.completion.value, 0.75);
assert.deepEqual(healthy.journey.map((step) => step.users), [10, 8, 6]);
assert.deepEqual(healthy.journey.map((step) => step.rate), [1, 0.8, 0.75]);

const smallSampleEstimate = buildPulseModel(payload({ summary: { sessions: 13, installs: 3 }, daily: [{ activeInstalls: 3 }] }));
assert.equal(smallSampleEstimate.verdict.status, "good");
assert.equal(smallSampleEstimate.metrics.duration.status, "good");
assert.equal(smallSampleEstimate.confidence, "estimate");
assert.match(smallSampleEstimate.action, /근사 평가/);
assert.match(smallSampleEstimate.verdict.summary, /표본이 적은 근사 평가.*하루 평균 3명/);

const fivePeoplePerDayIsEnough = buildPulseModel(payload({
  rangeDays: 3,
  summary: { sessions: 25, installs: 11 },
  daily: [{ activeInstalls: 4 }, { activeInstalls: 5 }, { activeInstalls: 6 }],
}));
assert.equal(fivePeoplePerDayIsEnough.dailyActivePeople, 5);
assert.equal(fivePeoplePerDayIsEnough.verdict.status, "good");
assert.equal(fivePeoplePerDayIsEnough.confidence, "standard");

const oneHeavyPlayerDoesNotAddIndependentSample = buildPulseModel(payload({
  rangeDays: 1,
  summary: { sessions: 20, installs: 4, playerSegments: { lightPeople: 3, heavyPeople: 1, weightedPeople: 5 } },
  daily: [{ activeInstalls: 4, lightPeople: 3, heavyPeople: 1, weightedPeople: 5 }],
}));
assert.equal(oneHeavyPlayerDoesNotAddIndependentSample.dailyActivePeople, 4);
assert.equal(oneHeavyPlayerDoesNotAddIndependentSample.dailyEffectivePeople, 5);
assert.equal(oneHeavyPlayerDoesNotAddIndependentSample.confidence, "estimate");

const sparseReturnSampleStaysConservative = buildPulseModel(payload({
  periodReturn: { currentPlayers: 13, previousPlayers: 7, returnedPlayers: 4, rate: 4 / 7 },
}));
assert.equal(sparseReturnSampleStaysConservative.metrics.retention.value, 4 / 7);
assert.equal(sparseReturnSampleStaysConservative.metrics.retention.status, "insufficient");
assert.equal(sparseReturnSampleStaysConservative.verdict.status, "watch");
assert.equal(sparseReturnSampleStaysConservative.confidence, "estimate");
assert.equal(sparseReturnSampleStaysConservative.verdict.score, null);
assert.match(sparseReturnSampleStaysConservative.verdict.summary, /재방문 비교 표본이 7명으로 적어/);

const selectedRangeReturnOverridesCohortD1 = buildPulseModel(payload({
  periodReturn: { currentPlayers: 20, previousPlayers: 20, returnedPlayers: 20, rate: 1 },
  retention: [{ day: 1, rate: 0 }],
}));
assert.equal(selectedRangeReturnOverridesCohortD1.metrics.retention.value, 1);
assert.equal(selectedRangeReturnOverridesCohortD1.metrics.retention.status, "good");

const risky = buildPulseModel(payload({
  summary: { avgGameSeconds: 45, gamesStarted: 20, gameOvers: 6 },
  periodReturn: { currentPlayers: 10, previousPlayers: 20, returnedPlayers: 1, rate: 0.05 },
  adEconomics: { formatBreakdown: [{ format: "interstitial", impressionsPerPlayer: 2.2 }] },
  health: { status: "risk", score: 31, summary: "확인이 필요합니다." },
}));
assert.equal(risky.metrics.duration.status, "risk");
assert.equal(risky.metrics.completion.status, "risk");
assert.equal(risky.metrics.retention.status, "risk");
assert.equal(risky.metrics.ads.status, "risk");
assert.match(risky.action, /완료된 판/);

const unfinishedGamesDoNotLowerCompletion = buildPulseModel(payload({
  summary: { gamesStarted: 10, observedGames: 5, gameOvers: 4 },
}));
assert.equal(unfinishedGamesDoNotLowerCompletion.metrics.completion.value, 0.8);

const serverOnlyRisk = buildPulseModel(payload({
  health: { status: "risk", score: 42, summary: "앱에 머무는 시간이 너무 짧아요." },
}));
assert.equal(serverOnlyRisk.verdict.status, "risk");
assert.doesNotMatch(serverOnlyRisk.action, /전체 흐름이 좋아요/);
assert.match(serverOnlyRisk.action, /머무는 시간/);

const contradictorySummary = buildPulseModel(payload({
  health: { status: "risk", score: 35, summary: "전체 지표가 안정적입니다." },
}));
assert.doesNotMatch(contradictorySummary.verdict.summary, /안정적/);
assert.match(contradictorySummary.verdict.summary, /위험 신호/);

const adOverridesGreenHealth = buildPulseModel(payload({
  adEconomics: { formatBreakdown: [{ format: "interstitial", impressionsPerPlayer: 2.4 }] },
  health: { status: "good", score: 88, summary: "플레이 지표는 좋아요." },
}));
assert.equal(adOverridesGreenHealth.metrics.ads.status, "risk");
assert.equal(adOverridesGreenHealth.verdict.status, "risk");
assert.equal(adOverridesGreenHealth.verdict.score, null);
assert.match(adOverridesGreenHealth.verdict.summary, /광고/);

const passiveAdsDoNotTriggerForcedAdRisk = buildPulseModel(payload({
  adEconomics: {
    impressionsPerPlayer: 8.6,
    formatBreakdown: [
      { format: "interstitial", impressionsPerPlayer: 0.2 },
      { format: "rewarded", impressionsPerPlayer: 0.4 },
      { format: "banner", impressionsPerPlayer: 3 },
      { format: "native", impressionsPerPlayer: 5 },
    ],
  },
}));
assert.equal(passiveAdsDoNotTriggerForcedAdRisk.metrics.ads.status, "good");
assert.equal(passiveAdsDoNotTriggerForcedAdRisk.metrics.ads.value, 0.2);

console.log("pulse model: PASS");
