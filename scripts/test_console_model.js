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
assert.deepEqual(model.normalizePlayerNote({ operator_tracked: true, operator_tags: ["구독자"], operator_note: "재현 확인" }), {
  tracked: true, tags: ["구독자"], note: "재현 확인", updatedAt: "",
});
assert.deepEqual(model.parsePlayerTags("구독자, 지인, 구독자,  "), ["구독자", "지인"]);
assert.match(model.playerNoteMarkup({ tracked: true, tags: ["<지인>"], note: '"확인"' }), /추적/);
assert.match(model.playerNoteMarkup({ tracked: true, tags: ["<지인>"], note: '"확인"' }), /&lt;지인&gt;/);
assert.match(model.playerIdentityMarkup({ user_id: "user/1", nickname: "Duck", display_code: "AB12", operator_tags: ["구독자"] }, "#/analytics"), /#\/players\/user%2F1/);
assert.match(model.playerIdentityMarkup({ user_id: "user/1", nickname: "Duck", display_code: "AB12", operator_tags: ["구독자"] }, "#/analytics"), /구독자/);
assert.deepEqual(model.countryDisplay("KR"), { code: "KR", name: "대한민국", flag: "🇰🇷", custom: false });
assert.deepEqual(model.countryDisplay("aln"), { code: "ALN", name: "외계인", flag: "👽", custom: true });
assert.deepEqual(model.countryDisplay("SGV"), { code: "SGV", name: "그림자정부", flag: "🕶️", custom: true });
assert.deepEqual(model.countryDisplay("RPT"), { code: "RPT", name: "렙틸리언", flag: "🦎", custom: true });
assert.deepEqual(model.countryDisplay(""), { code: "", name: "국가 미설정", flag: "", custom: false });
assert.equal(model.actionDisplayName("player_mutation"), "플레이어 재화 변경");
assert.equal(model.actionDisplayName("player_note_update"), "플레이어 메모 업데이트");
assert.equal(model.actionDisplayName("reward_mail_broadcast"), "전체 보상 우편");
assert.equal(model.actionDisplayName("future_action"), "future_action");
assert.equal(model.analyticsChoiceName("mechakucha_quake"), "메챠쿠챠 지진");
assert.equal(model.analyticsChoiceName("roulette_reroll"), "룰렛 다시하기");
assert.equal(model.analyticsChoiceName("drag_drop_level"), "드래그 앤 드롭");
assert.equal(model.analyticsButtonName("main/ui/control_0/panel_1/growthchoice_space", "main"), "성장 선택 팝업 · 공간 축소");
assert.equal(model.analyticsButtonName("main/hud/button_0", "main"), "게임 · 일시정지 메뉴 (구버전)");
assert.equal(model.analyticsButtonName("home/start_game", "home"), "홈 · 게임 시작");
assert.equal(model.analyticsButtonName("settings/control_1/panel_1/button_0", "settings"), "설정 · 문의 지원 페이지로 이동 (외부 브라우저)");
assert.equal(model.analyticsButtonName("loading/onboarding_profile_confirm", "loading"), "첫 실행·로그인 · 닉네임·국가 설정 완료");
assert.equal(model.analyticsScreenName("profilecustomize"), "프로필 꾸미기");
assert.match(model.analyticsButtonName("main/ui/control_0/panel_1/button_2", "main"), /게임 중 팝업.*3번째 행동 버튼.*구버전/);
assert.match(model.interactionRecommendation({ buttonId: "home/start_game", screen: "home", avgIdleSec: 25, installs: 5 }), /5초 이상.*5회/);

assert.equal(model.serializeAnalyticsFilters({
  rangeDays: 28,
  rangeOffsetDays: 0,
  distributionKey: "google_play",
  sort: "gems",
  direction: "asc",
  page: 3,
  query: "Duck",
}), "rangeDays=28&rangeOffsetDays=0&distributionKey=google_play&sort=gems&direction=asc&page=3&query=Duck");
assert.equal(model.serializeAnalyticsFilters({
  startDate: "2026-08-21",
  endDate: "2026-08-30",
  distributionKey: "all",
  sort: "latest_played_at",
  direction: "desc",
  page: 1,
}), "startDate=2026-08-21&endDate=2026-08-30&distributionKey=all&sort=latest_played_at&direction=desc&page=1");
assert.deepEqual(model.normalizeCustomAnalyticsRange("2026-08-21", "2026-08-30", "2026-08-30"), {
  ok: true, startDate: "2026-08-21", endDate: "2026-08-30", days: 10,
});
assert.match(model.normalizeCustomAnalyticsRange("2026-08-01", "2026-08-30", "2026-08-30").error, /최대 28일/);
assert.match(model.normalizeCustomAnalyticsRange("2026-08-31", "2026-08-30", "2026-08-30").error, /확인/);
assert.match(model.normalizeCustomAnalyticsRange("2026-08-30", "2026-08-31", "2026-08-30").error, /오늘 이후/);
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
