const assert = require("node:assert/strict");
const model = require("../console/model.js");

const diagnosticsFixture = {
  issueSignals: [{ signal: "tutorial_incomplete", count: 2 }],
  tutorial: {
    started: 5, completed: 3, aborted: 1, incomplete: 1, completionRate: 0.6,
    stages: [{ stage: "intro", stageIndex: 0, entered: 5, completed: 3, aborted: 1, incomplete: 1 }],
  },
  growthChoices: {
    presented: 8, selected: 6, confirmed: 5, selectionRate: null,
    byLevel: [{ level: 3, presented: 4, selected: 3, confirmed: 2, selectionRate: 0.75 }],
    choices: [{ choice: "fast_growth", selected: 3 }],
  },
  mechakucha: { started: 2, completed: 1, aborted: 1, incomplete: 0, completionRate: 0.5, avgScoreGain: 120, avgMarblesRestored: 3 },
  gameOver: {
    total: 4, medianScore: 1000, medianLevel: 4,
    byDay: [{ day: "2026-08-26", games: 4, avgScore: 1120, medianScore: 1000, avgLevel: 4 }],
    levelBuckets: [{ bucket: "1-3", games: 4, avgScore: 1120, medianScore: 1000, avgLevel: 4 }],
  },
};
assert.equal(diagnosticsFixture.growthChoices.selectionRate, null, "legacy selected choices must preserve a null selection rate");
assert.deepEqual(Object.keys(diagnosticsFixture.gameOver.byDay[0]), ["day", "games", "avgScore", "medianScore", "avgLevel"]);
assert.deepEqual(Object.keys(diagnosticsFixture.tutorial.stages[0]), ["stage", "stageIndex", "entered", "completed", "aborted", "incomplete"]);

assert.deepEqual(model.routeFromHash("#/analytics"), { page: "analytics" });
assert.deepEqual(model.routeFromHash("#/players/abc%20123"), { page: "player", userId: "abc 123" });
assert.deepEqual(model.routeFromHash("#/players/"), { page: "players" });
assert.deepEqual(model.routeFromHash("#/unknown"), { page: "analytics" });

assert.deepEqual(
  model.decodeJwtPayload("x.eyJlbWFpbCI6Iuq0gOumrOyekEBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.y"),
  { email: "관리자@example.com", exp: 9999999999 },
);
assert.equal(model.decodeJwtPayload("broken"), null);

const players = model.dedupePlayers([
  { userId: "1", nickname: "Duck" },
  { userId: "1", nickname: "Duplicate" },
  { userId: "2", nickname: "Duck" },
]);
assert.deepEqual(players.map((player) => player.userId), ["1", "2"]);
assert.equal(players[0].nickname, "Duck");
assert.equal(model.playerDisplayName({ nickname: "Duck", displayCode: "AB12" }), "Duck · AB12");
assert.equal(model.playerDisplayName({ nickname: "Duck", displayCode: "" }), "Duck");
assert.equal(model.playerDisplayName({ nickname: "", displayCode: "AB12" }), "이름 없음 · AB12");
assert.deepEqual(model.countryDisplay("KR"), { code: "KR", name: "대한민국", flag: "🇰🇷", custom: false });
assert.deepEqual(model.countryDisplay("aln"), { code: "ALN", name: "외계인", flag: "👽", custom: true });
assert.deepEqual(model.countryDisplay("SGV"), { code: "SGV", name: "그림자정부", flag: "🕶️", custom: true });
assert.deepEqual(model.countryDisplay("RPT"), { code: "RPT", name: "렙틸리언", flag: "🦎", custom: true });
assert.deepEqual(model.countryDisplay(""), { code: "", name: "국가 미설정", flag: "", custom: false });
assert.equal(model.actionDisplayName("player_mutation"), "플레이어 재화 변경");
assert.equal(model.actionDisplayName("reward_mail_broadcast"), "전체 보상 우편");
assert.equal(model.actionDisplayName("future_action"), "future_action");

assert.equal(model.serializeAnalyticsFilters({
  rangeDays: 28,
  distributionKey: "google_play",
  sort: "gems",
  direction: "asc",
  page: 3,
  query: "Duck",
}), "rangeDays=28&distributionKey=google_play&sort=gems&direction=asc&page=3&query=Duck");
assert.equal(
  model.playerDeepLink("user/1", "#/analytics?rangeDays=7&sort=gems"),
  "#/players/user%2F1?return=%23%2Fanalytics%3FrangeDays%3D7%26sort%3Dgems",
);
assert.equal(model.safeConsoleReturnHash("#/analytics?rangeDays=7"), "#/analytics?rangeDays=7");
assert.equal(model.safeConsoleReturnHash("#/players/user%2F1?return=%23%2Fcs"), "#/players/user%2F1?return=%23%2Fcs");
assert.equal(model.safeConsoleReturnHash("javascript:alert(1)"), "#/players");
assert.equal(model.safeConsoleReturnHash("#/players\njavascript:alert(1)"), "#/players");

assert.deepEqual(model.buildAttentionItems({
  verdict: { status: "risk", summary: "이탈을 확인하세요." },
  metrics: {
    duration: { status: "good", description: "평균 한 판 시간" },
    retention: { status: "risk", description: "다음 날 다시 온 비율" },
  },
}, "2026-08-03T14:00:00Z"), [{
  severity: "risk",
  label: "다음 날 다시 온 비율",
  source: "Pulse",
  observedAt: "2026-08-03T14:00:00Z",
  targetId: "metricRetentionCard",
}]);
assert.deepEqual(model.buildAttentionItems({ verdict: { status: "insufficient" }, metrics: {} }), [
  { severity: "insufficient", label: "플레이 데이터가 더 필요합니다.", source: "Pulse", targetId: "healthCard" },
]);
assert.deepEqual(model.buildAttentionItems({ verdict: { status: "good" }, metrics: {} }), []);

assert.deepEqual(model.diffPlayerChanges({ gems: 10 }, { gems: 12 }), { gems: { before: 10, after: 12 } });
assert.deepEqual(model.diffPlayerChanges({ gems: 10, recovery_code: "hidden" }, { gems: 10, recovery_code: "changed" }), {});
assert.equal(model.canSubmitMutation({ reason: "", changes: { gems: 12 } }), false);
assert.equal(model.canSubmitMutation({ reason: "CS 보상", changes: { gems: 12 }, mutationsEnabled: true, stateVersion: 0 }), true);
assert.equal(model.canSubmitMutation({ reason: "CS 보상", changes: { gems: 12 }, mutationsEnabled: true }), false);
assert.equal(model.canSubmitMutation({ reason: "CS 보상", changes: { gems: 12 }, mutationsEnabled: false, stateVersion: 4 }), false);
assert.equal(model.canSubmitMutation({ reason: "CS 보상", changes: { gems: 12 }, mutationsEnabled: true, stateVersion: null }), false);

console.log("console model: PASS");
