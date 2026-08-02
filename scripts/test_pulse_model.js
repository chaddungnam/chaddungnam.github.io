const assert = require("node:assert/strict");
const { buildPulseModel } = require("../analytics/pulse-model.js");

function payload(overrides = {}) {
  return {
    summary: {
      sessions: 40,
      avgGameSeconds: 210,
      gamesStarted: 20,
      gameOvers: 15,
      activeInstallsToday: 10,
      ...overrides.summary,
    },
    retention: overrides.retention ?? [{ day: 1, rate: 0.25 }],
    adEconomics: { impressionsPerPlayer: 2, estimatedRevenueEur: 1.25, ...overrides.adEconomics },
    funnel: overrides.funnel ?? [
      { event: "session_start", users: 10 },
      { event: "game_start", users: 8 },
      { event: "game_over", users: 6 },
      { event: "ad_impression", users: 4 },
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
assert.deepEqual(healthy.journey.map((step) => step.users), [10, 8, 6, 4]);
assert.deepEqual(healthy.journey.map((step) => step.rate), [1, 0.8, 0.75, 2 / 3]);

const insufficient = buildPulseModel(payload({ summary: { sessions: 8 } }));
assert.equal(insufficient.verdict.status, "insufficient");
assert.equal(insufficient.metrics.duration.status, "insufficient");
assert.match(insufficient.action, /22회/);

const risky = buildPulseModel(payload({
  summary: { avgGameSeconds: 45, gamesStarted: 20, gameOvers: 6 },
  retention: [{ day: 1, rate: 0.05 }],
  adEconomics: { impressionsPerPlayer: 6.2 },
  health: { status: "risk", score: 31, summary: "확인이 필요합니다." },
}));
assert.equal(risky.metrics.duration.status, "risk");
assert.equal(risky.metrics.completion.status, "risk");
assert.equal(risky.metrics.retention.status, "risk");
assert.equal(risky.metrics.ads.status, "risk");
assert.match(risky.action, /끝까지/);

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

console.log("pulse model: PASS");
