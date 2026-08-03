const assert = require("node:assert/strict");
const model = require("../console/model.js");

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

console.log("console model: PASS");
