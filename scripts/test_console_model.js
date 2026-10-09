const assert = require("node:assert/strict");
const model = require("../console/model.js");

// Missing/legacy evidence must not be reported as failed or completed onboarding.
assert.equal(model.tutorialStatus(null), "확인 불가");
assert.equal(model.tutorialStatus({}), "기록 없음");
assert.equal(model.tutorialStatus({ started_at: "2026-09-06T08:46:17Z" }), "시작 확인 · 완료 기록 없음");
assert.equal(model.tutorialStatus({ completed_at: "2026-09-06T08:47:50Z" }), "완료 확인");
assert.equal(model.tutorialStatus({ home_at: "2026-09-06T08:47:51Z" }), "완료 후 홈 도착 확인");

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
assert.deepEqual(model.platformDisplay("google_play"), { key: "google_play", label: "AOS", known: true });
assert.deepEqual(model.platformDisplay("app_store"), { key: "app_store", label: "iOS", known: true });
assert.deepEqual(model.platformDisplay("ios"), { key: "ios", label: "iOS", known: true });
assert.deepEqual(model.platformDisplay(""), { key: "", label: "기기 미확인", known: false });
assert.deepEqual(model.platformDisplay("crazygames"), { key: "crazygames", label: "웹(크레이지게임즈)", known: true });
assert.equal(model.actionDisplayName("player_mutation"), "플레이어 재화 변경");
assert.equal(model.actionDisplayName("player_note_update"), "플레이어 메모 업데이트");
assert.equal(model.actionDisplayName("reward_mail_broadcast"), "전체 보상 우편");
assert.equal(model.actionDisplayName("future_action"), "future_action");
assert.equal(model.analyticsChoiceName("mechakucha_quake"), "메챠쿠챠 지진");
assert.equal(model.analyticsChoiceName("roulette_reroll"), "룰렛 다시하기");
assert.equal(model.analyticsChoiceName("drag_drop_level"), "드래그 앤 드롭");
assert.equal(model.analyticsChoiceName("lab_boss_mad"), "매드 사이언티스트 연사");
assert.equal(model.analyticsChoiceName("lab_boss_awakened"), "각성 매드 사이언티스트");
assert.equal(model.analyticsChoiceName("lab_score_bonus"), "즉시 점수");
assert.equal(model.analyticsChoiceName("lab_unknown_perk"), "lab unknown perk");
assert.doesNotMatch(model.analyticsChoiceName("lab_unknown_perk"), /기타/);
assert.equal(model.analyticsScreenName("labhome"), "실험실 홈");
assert.equal(model.analyticsScreenName("labshop"), "실험실 상점");
assert.equal(model.analyticsScreenName("labranking"), "실험실 랭킹");
assert.equal(model.analyticsScreenName("labvip"), "VIP");
assert.equal(model.analyticsScreenName("labtutorialhome"), "튜토리얼 홈");
assert.equal(model.analyticsScreenName("labreview"), "labreview");
assert.equal(model.labTutorialStageName("opening"), "오프닝");
assert.equal(model.labTutorialStageName("home_handoff"), "홈 인계");
assert.equal(model.labTutorialStageName("unlisted_step"), "unlisted step");
assert.equal(model.isHomeScreen("home"), true);
assert.equal(model.isHomeScreen("labhome"), true);
assert.equal(model.isHomeScreen("shop"), false);
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
assert.equal(model.serializeAnalyticsFilters({
  rangeDays: 3, distributionKey: "all", appFamily: "all", runMode: "all",
  sort: "latest_played_at", direction: "desc", page: 1,
}), "rangeDays=3&rangeOffsetDays=0&distributionKey=all&sort=latest_played_at&direction=desc&page=1");
assert.match(model.serializeAnalyticsFilters({
  rangeDays: 3, distributionKey: "all", appFamily: "2.x", runMode: "lab",
  sort: "latest_played_at", direction: "desc", page: 1,
}), /appFamily=2\.x&runMode=lab/);
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

assert.equal(model.catalogItemLabel({ item_id: "icon_joker", item_type: "profile_icon" }), "흑백 쿼키 · 아이콘");
assert.equal(model.rewardKindLabel("speed_ticket"), "스피드 티켓");
assert.match(model.mailSummaryText({ template_key: "update", recipient_count: 63, expires_at: "2026-09-04T05:39:00+00:00", rewards: [{ kind: "gems", amount: 50 }] }), /63명/);
assert.match(model.mailSummaryText({ template_key: "update", recipient_count: 63 }), /update/);
assert.equal(require("../console/purchases-model.js").formatMoney(undefined, "KRW"), "금액 미기록");
assert.match(require("../console/purchases-model.js").formatMoney(3900000000, "KRW"), /3,900|₩3900|₩3,900/);


// 2.0 never turns missing/small/inconsistent samples into an actionable percentage.
assert.equal(model.sampleRate(0, 0), '표본 부족');
assert.equal(model.sampleRate(48, 49), '표본 부족');
assert.equal(model.sampleRate(25, 50), '50.0%');
assert.equal(model.sampleRate(51, 50), '집계 확인 필요');
assert.equal(model.sampleRate(null, 100), '기록 없음');
assert.equal(model.snapshotRank({captured_at:null,rank:null}), '스냅숏 없음');
assert.equal(model.snapshotRank({captured_at:'2026-09-27',rank:null}), '상위 200명에 없음');
assert.equal(model.snapshotRank({captured_at:'2026-09-27',rank:3}), '3위');
assert.equal(require('../console/purchases-model.js').PRODUCT_LABELS.vip1, 'VIP1');

// C (2026-10-01) 한눈 요약: 필터 정규화·숫자·증감·작은 그래프. 비교 못 하는 값은 비우고, 좋아짐·나빠짐은 화살표와 글자로도 보인다.
assert.deepEqual(model.normalizeOverviewFilters(new URLSearchParams("period=90&version=2.x&platform=ios")), { periodDays: 90, version: "2.x", platform: "ios" });
assert.deepEqual(model.normalizeOverviewFilters(new URLSearchParams("period=28&version=3.x&platform=desktop")), { periodDays: 7, version: "all", platform: "all" });
// 웹판(크레이지게임즈, 10-09)은 플랫폼 web으로 따로 볼 수 있다.
assert.deepEqual(model.normalizeOverviewFilters(new URLSearchParams("platform=web")), { periodDays: 7, version: "all", platform: "web" });
assert.deepEqual(model.normalizeOverviewFilters({}), { periodDays: 7, version: "all", platform: "all" });
const legacyFilters = { rangeDays: 3, rangeOffsetDays: 0, distributionKey: "all", sort: "latest_played_at", direction: "desc", page: 1 };
assert.equal(model.serializeAnalyticsFilters({ ...legacyFilters, overviewPeriod: 7, overviewVersion: "all", overviewPlatform: "all", legacyOpen: false }), model.serializeAnalyticsFilters(legacyFilters), "default overview filters keep the old URL");
assert.match(model.serializeAnalyticsFilters({ ...legacyFilters, overviewPeriod: 30, overviewVersion: "2.x", overviewPlatform: "android", legacyOpen: true }), /period=30&version=2\.x&platform=android&legacy=1$/);
assert.equal(model.formatOverviewValue(null, "count"), "—");
assert.equal(model.formatOverviewValue(1234.4, "count"), "1,234");
assert.equal(model.formatOverviewValue(0.3333, "percent"), "33.3%");
assert.equal(model.formatOverviewValue(2 / 7, "decimal"), "0.29");
assert.equal(model.formatOverviewValue(333, "seconds"), "5분 33초");
assert.equal(model.formatOverviewValue(3720, "seconds"), "1시간 2분");
assert.equal(model.formatOverviewValue(850, "milliseconds"), "850ms");
assert.equal(model.formatOverviewValue(4200, "milliseconds"), "4.2초");
assert.match(model.formatOverviewValue(4.99, "money", "EUR"), /4[.,]99/);
assert.match(model.formatOverviewValue(5500, "money", "KRW"), /5,500/);
assert.equal(model.formatOverviewValue(12, "money", "XXX"), "12 XXX", "unknown currency codes are never guessed");
const up = { value: 10, previous: 8, delta: 0.25, compare: "relative", better: "up" };
assert.deepEqual(model.overviewDelta(up, 7), { text: "+25%", tone: "good", arrow: "▲", label: "이전 7일" });
assert.deepEqual(model.overviewDelta({ ...up, delta: -0.031, compare: "points" }, 30), { text: "−3.1%p", tone: "bad", arrow: "▼", label: "이전 30일" });
assert.equal(model.overviewDelta({ ...up, better: "down" }, 7).tone, "bad", "more crashes is worse");
assert.equal(model.overviewDelta({ ...up, better: "none" }, 7).tone, "neutral");
assert.equal(model.overviewDelta({ ...up, delta: 0 }, 7).text, "±0.0%");
assert.equal(model.overviewDelta({ ...up, delta: null, previous: null }, 7).label, "비교 기간 기록 없음");
assert.equal(model.overviewDelta({ ...up, delta: null, previous: 0 }, 7).label, "0에서 늘어남");
assert.equal(model.overviewDelta({ ...up, compare: "none" }, 7).text, "현재 상태");
assert.equal(model.overviewDelta({ ...up, value: null }, 7).text, "", "no value, no delta");
const line = model.sparklineGeometry([null, 2, 4, null, 3], 100, 20, 0);
assert.equal(line.segments.length, 2, "uncovered days break the line instead of being drawn as zero");
assert.deepEqual(line.segments[0], [[25, 20], [50, 0]]);
assert.deepEqual(line.last, { index: 4, value: 3, x: 100, y: 10 });
assert.deepEqual(model.sparklineGeometry([5, 5], 100, 20, 0).segments[0], [[0, 10], [100, 10]], "a flat series is a centered line");
assert.equal(model.sparklineGeometry([0, 10], 100, 20, 0, "zero").segments[0][0][1], 20);
assert.equal(model.sparklineGeometry([null, null]).last, null);
const bars = model.sparkBars([0, 5, null, 10], 100, 20, 0);
assert.deepEqual(bars.map((bar) => bar.height), [0, 10, 0, 20]);
assert.equal(bars[2].value, null);
assert.equal(model.overviewStatusLabel("partial"), "일부 기간");
assert.equal(model.overviewStatusLabel("no_data"), "아직 데이터 없음");
assert.equal(model.overviewFlowName("grant_reagent:escape"), "탈출 보상");
assert.equal(model.overviewFlowName("grant_reagent:newsource"), "시약 지급");
assert.equal(model.overviewFlowName("brand_new_flow"), "brand new flow");
assert.equal(model.overviewBossName("scientist"), "P1 과학자");
assert.equal(model.overviewPlacementName("shop_gems"), "상점 젬");
assert.equal(model.labTutorialStageName("home_growth"), "홈 성장");

// C2 (2026-10-01) 한눈 보드: 툴팁 값 글자. 없으면 0이 아니라 이유, 비율은 표본을 붙인다.
assert.equal(model.overviewTipValue(null, "percent"), "기록 없음");
assert.equal(model.overviewTipValue(undefined, "count", { empty: "2.0 이벤트 아직 없음" }), "2.0 이벤트 아직 없음");
assert.equal(model.overviewTipValue(0, "count"), "0", "a real zero stays a zero");
assert.equal(model.overviewTipValue(0.3235, "percent", { numerator: 11, denominator: 34 }), "32.4% (11/34명)");
assert.equal(model.overviewTipValue(1234, "count", { numerator: 1234, denominator: 5000, unit: "판" }), "1,234 (1,234/5,000판)");
assert.equal(model.overviewTipValue(2600, "milliseconds", { sample: 194, unit: "회" }), "2.6초 · 표본 194회");
assert.match(model.overviewTipValue(39.96, "money", { currency: "EUR" }), /39[.,]96/);
const tipText = model.overviewTipText("D1\t복귀\n", [["이번 7일", "32.4% (11/34명)"], null, ["1.x", "기간\n내 표본 없음"]], "정의: 설치 다음 날 다시 실행");
assert.equal(tipText, "D1 복귀\n이번 7일\t32.4% (11/34명)\n1.x\t기간 내 표본 없음\n정의: 설치 다음 날 다시 실행", "tabs and newlines inside values never break the row format");
assert.deepEqual(model.parseOverviewTip(tipText), { title: "D1 복귀", rows: [{ label: "이번 7일", value: "32.4% (11/34명)" }, { label: "1.x", value: "기간 내 표본 없음" }, { note: "정의: 설치 다음 날 다시 실행" }] });
const d1Metric = { key: "d1", label: "D1 복귀", format: "percent", value: 0.324, previous: 0.383, delta: -0.059, compare: "points", better: "up",
  split: { "1.x": 0.3, "2.x": null }, splitEmpty: { "1.x": null, "2.x": "2.0 이벤트 아직 없음" } };
assert.deepEqual(model.overviewMetricTipRows(d1Metric, 7), [["이번 7일", "32.4%"], ["이전 7일", "38.3% (−5.9%p)"], ["1.x", "30.0%"], ["2.0+", "2.0 이벤트 아직 없음"]]);
assert.deepEqual(model.overviewMetricTipRows({ ...d1Metric, previous: null, delta: null, split: null }, 30), [["이번 30일", "32.4%"], ["이전 30일", "비교 기간 기록 없음"]]);
assert.deepEqual(model.overviewMetricTipRows({ key: "vip", format: "count", value: 6, compare: "none" }, 7), [["지금", "6"]]);

// '이번 기간 요약' 문장 규칙: 크게 변한 순서로 3개, %p 지표는 이전 값 대비로 크기를 맞추고, 작은 변화·비교 불가는 빼고, 빈자리는 이유로 채운다.
const metricOf = (key, extra) => ({ key, format: "decimal", value: 1, previous: 1, delta: 0, compare: "relative", better: "up", ...extra });
const summaryCards = [
  { headline: metricOf("dau", { delta: 0.3 }), metrics: [metricOf("d1", { compare: "points", value: 0.324, previous: 0.383, delta: -0.059 }), metricOf("d7", { compare: "points", value: 0.34, previous: 0.336, delta: 0.004 }), metricOf("session_length", { delta: 0.9 })] },
  { headline: metricOf("revenue", { delta: 1.67 }), metrics: [metricOf("buyers", { delta: 0.5 })] },
  { headline: metricOf("unclean_per_1k", { delta: 0.12, better: "down" }), metrics: [metricOf("load_p50", { delta: -0.02 })] },
];
assert.deepEqual(model.overviewSummarySentences(summaryCards, 7).map((sentence) => sentence.text), [
  "검증 매출이 이전 7일보다 167% 늘었어요",
  "DAU가 이전 7일보다 30% 늘었어요",
  "D1 복귀가 이전 7일보다 5.9%p 내려갔어요",
], "biggest change first; 5.9%p of 38.3% (≈15%) outranks +12%, unlisted metrics (session length, buyers) never speak");
assert.equal(model.overviewSummarySentences(summaryCards, 7)[2].direction, "down");
assert.deepEqual(model.overviewSummarySentences([{ headline: metricOf("dau", { delta: -0.08 }), metrics: [metricOf("d7", { compare: "points", delta: 0.004 })] }], 30, { has2x: false }).map((sentence) => sentence.text), [
  "DAU가 이전 30일보다 8.0% 줄었어요",
  "나머지 지표는 이전 30일과 비슷해요",
  "2.0 데이터는 아직 기다리는 중이에요",
]);
assert.deepEqual(model.overviewSummarySentences([{ headline: metricOf("dau", { delta: null, previous: null }), metrics: [metricOf("d1", { value: null, delta: null })] }], 7).map((sentence) => sentence.text), ["이전 7일과 비교할 기록이 아직 없어요"]);
assert.deepEqual(model.overviewSummarySentences([], 7), [{ key: "no_compare", direction: null, text: "이전 7일과 비교할 기록이 아직 없어요" }]);
assert.equal(model.overviewSummarySentences([{ headline: metricOf("vip", { compare: "none", delta: 1 }), metrics: [] }], 7)[0].key, "no_compare", "snapshot metrics have no change to report");

// 퍼널 막대·페이즈 분포·복귀 곡선: 빈 2.0은 0 막대가 아니라 빈 배열(화면은 '2.0 데이터 대기 중').
const funnel = model.overviewFunnelBars([
  { key: "app_open", reached: null }, { key: "first_open", reached: 36, fromStart: 1 }, { key: "tutorial_start", reached: 33, fromStart: 0.917 },
  { key: "tutorial_done", reached: 28, fromStart: 0.778 }, { key: "first_run", reached: 28, fromStart: 0.778 }, { key: "p1_boss", reached: 21, fromStart: 0.583 },
  { key: "next_day", reached: 10, stepRate: 0.5, fromStart: null },
]);
assert.deepEqual(funnel.map((bar) => bar.label), ["동의", "튜토리얼", "첫 런", "P1 보스", "다음 날"], "missing first_3d (old build) is skipped, not drawn as zero");
assert.equal(funnel[0].drop, null);
assert.equal(funnel[1].drop.toFixed(3), "0.222");
assert.equal(funnel[2].drop, 0);
assert.equal(funnel[4].share.toFixed(4), "0.2915", "next day uses its own base times the bar before it");
assert.equal(funnel[4].drop, 0.5);
assert.deepEqual(model.overviewFunnelBars([{ key: "first_open", reached: 0, fromStart: null }]), []);
assert.deepEqual(model.overviewFunnelBars(undefined), []);
const phaseBars = model.overviewPhaseBars([{ phase: 1, installs: 3 }, { phase: 3, installs: 1 }], [{ bossId: "scientist", phase: 1, attempts: 4, clears: 3 }, { bossId: "p1b", phase: 1, attempts: 1, clears: 0 }]);
assert.equal(phaseBars.length, 8);
assert.deepEqual(phaseBars.slice(0, 3).map((bar) => [bar.phase, bar.installs, bar.share, bar.winRate]), [[1, 3, 0.75, 0.6], [2, 0, 0, null], [3, 1, 0.25, null]]);
assert.deepEqual(model.overviewPhaseBars([], []), []);
assert.deepEqual(model.overviewRetentionCurve({ d1: { eligible: 34, retained: 11, rate: 11 / 34 }, d7: { eligible: 0, retained: 0, rate: null }, d30: { eligible: 9, retained: 1, rate: 1 / 9 } }).map((point) => [point.day, point.rate === null ? null : Number(point.rate.toFixed(3))]),
  [[0, 1], [1, 0.324], [7, null], [30, 0.111]]);
assert.deepEqual(model.overviewRetentionCurve({ d1: { eligible: 0 }, d7: { eligible: 0 }, d30: { eligible: 0 } }), []);
assert.deepEqual([0, 0.4, 7, 38, 51, 240].map(model.overviewNiceMax), [1, 0.5, 10, 50, 100, 250]);
assert.deepEqual(model.sparklineGeometry([0, 5], 100, 20, 0, [0, 10]).segments[0], [[0, 20], [100, 10]], "two series share one axis");

console.log("console model: PASS");

// r23 (10-05): 1일·3일 기간과 시간 칸 이름
{
  const assert = require("node:assert/strict");
  const model = require("../console/model.js");
  assert.equal(model.normalizeOverviewFilters({ period: "1" }).periodDays, 1);
  assert.equal(model.normalizeOverviewFilters({ period: "3" }).periodDays, 3);
  assert.equal(model.overviewPrevLabel(1), "어제");
  assert.equal(model.overviewNowLabel(1), "오늘");
  assert.equal(model.overviewPrevLabel(3), "이전 3일");
  assert.equal(model.overviewSlotTitle("2026-10-05T06:00", 6), "10월 5일 06:00–12:00");
  assert.equal(model.overviewSlotParts("2026-10-05"), null);
  const sentences = model.overviewSummarySentences([], 1);
  assert.match(sentences[0].text, /^어제와 /);
  console.log("console model r23: PASS");
}
