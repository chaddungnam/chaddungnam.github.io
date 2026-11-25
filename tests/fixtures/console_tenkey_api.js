// Local synthetic data only (never real players): a stand-in for window.ConsoleAPI that answers the tenkey-admin actions the
// "10key Survival" console pages call, with the same shapes the server's admin RPCs return (the per-page actions are in tenkey/*.js). State changes (notice saves, ends,
// deletes, bans, config) stick for the page's life so the flows can be walked through. Calls are kept in window.__mockCalls.
(function () {
  const DAYS = 90;
  const TODAY = "2026-10-23";
  const dayAt = (back) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // The app started pinging 12 days ago, so older days are empty and the newest ones grow.
  const series = Array.from({ length: DAYS }, (_, i) => {
    const back = DAYS - 1 - i;
    const live = back <= 12;
    const base = live ? Math.round(18 + (12 - back) * 9 + rnd() * 14) : 0;
    return {
      day: dayAt(back), dau: base, runs: live ? Math.round(base * (5 + rnd() * 3)) : 0, new_installs: live ? Math.round(6 + rnd() * 20) : 0,
      new_accounts: live ? Math.round(4 + rnd() * 14) : 0, stored_runs: live ? Math.round(base * 0.4) : 0,
      crashes: live && rnd() > 0.45 ? Math.round(1 + rnd() * 4) : 0, purchases: live && rnd() > 0.6 ? Math.round(1 + rnd() * 3) : 0,
    };
  });
  const sumLast = (key, n) => series.slice(-n).reduce((s, r) => s + r[key], 0);
  // window.__mockNoPing = the closed-test build of 2026-10-22, which sends no daily ping: every ping-based number is 0 and only
  // the game server's own counts (server.seen / played, the series' new_accounts) are there.
  const overview = (platform) => {
    const k = window.__mockNoPing ? 0 : platform ? (platform === "android" ? 0.7 : 0.3) : 1;
    const scale = (v) => Math.round(v * k);
    const last = series.at(-1);
    const prev = series.at(-2);
    return {
      ok: true, today: TODAY, days: DAYS, platform: platform || null,
      series: k !== 1 ? series.map((r) => ({ ...r, dau: scale(r.dau), runs: scale(r.runs), new_installs: scale(r.new_installs) })) : series,
      active: { d1: scale(last.dau), d1_prev: scale(prev.dau), d7: scale(420), d7_prev: scale(310), d30: scale(780), d30_prev: 0 },
      runs: { d1: scale(last.runs), d1_prev: scale(prev.runs), d7: scale(sumLast("runs", 7)), d7_prev: scale(1900), d30: scale(sumLast("runs", 30)), d30_prev: 0 },
      new_installs: { d1: scale(last.new_installs), d1_prev: scale(prev.new_installs), d7: scale(sumLast("new_installs", 7)), d7_prev: scale(120), d30: scale(sumLast("new_installs", 30)), d30_prev: 0, all: scale(sumLast("new_installs", 90)) },
      retention: window.__mockNoPing ? { d1: { cohort: 0, back: 0 }, d7: { cohort: 0, back: 0 }, d30: { cohort: 0, back: 0 } }
        : { d1: { cohort: 96, back: 41 }, d7: { cohort: 52, back: 14 }, d30: { cohort: 0, back: 0 } },
      server: { seen: { d1: 31, d1_prev: 27, d7: 260, d7_prev: 200, d30: 600 }, played: { d1: 24, d7: 190, d30: 410 }, players: 842,
        days: series.map((r, i) => ({ day: r.day, active: Math.round(r.dau / 4), players: 500 + series.slice(0, i + 1).reduce((n, x) => n + x.new_accounts, 0) })) },
      platforms: [{ key: "android", n: 330 }, { key: "ios", n: 90 }, { key: "web_itch", n: 12 }],
      versions: [{ key: "1.0.0 a2 i2", n: 310 }, { key: "1.0.0 a1 i1", n: 110 }],
      langs: [{ key: "ko", n: 560 }, { key: "en", n: 190 }, { key: "?", n: 30 }],
      totals: { players: 842, accounts: 611, banned: 2, crash_rows_24h: 5, crash_times_24h: 9, notices_live: 1, purchases_30d: 14, stored_runs: 1834,
        db_bytes: 91234816, tenkey_bytes: 4194304 },
      as_of: "2026-10-23T13:30:00+00:00",
    };
  };

  // Rank guard (owner 11-22): KeyMaster carries a gem mark (holds the ranking) and a macro tag; 랭킹 허용 (players.ban false) releases both.
  const GUARD = { "b2222222-2222-4222-8222-222222222222": [
    { kind: "gem", at: "2026-11-22T10:00:00+00:00", detail: { why: "one_grant", reason: "daily_set", amount: 500 } },
    { kind: "macro", at: "2026-11-22T09:00:00+00:00", detail: { n: 640, gap: 912, nt: 0, spot: 0, score: 96100, level: 11, platform: "ios" } },
  ] };
  const passed = new Set();
  const guardOf = (id) => (GUARD[id] || []).map((s) => ({ ...s, released: passed.has(id) }));
  const PLAYERS = [
    { id: "a1111111-1111-4111-8111-111111111111", name: "딸깍덕", nickname: "딸깍덕", provider: "supabase", platform: "android", created_at: "2026-10-12T09:10:00+00:00", last_seen_at: "2026-10-23T11:02:00+00:00", best_score: 184200, best_level: 14, banned: false, age_band: 18, runs_stored: 11 },
    { id: "b2222222-2222-4222-8222-222222222222", name: "KeyMaster", nickname: "KeyMaster", provider: "supabase", platform: "ios", created_at: "2026-10-15T15:44:00+00:00", last_seen_at: "2026-10-23T08:30:00+00:00", best_score: 96100, best_level: 11, banned: false, age_band: 14, runs_stored: 6 },
    { id: "c3333333-3333-4333-8333-333333333333", name: "cg_player_77", nickname: null, provider: "crazygames", platform: "web", created_at: "2026-10-18T19:00:00+00:00", last_seen_at: "2026-10-22T20:15:00+00:00", best_score: 51200, best_level: 9, banned: false, age_band: null, runs_stored: 4 },
    { id: "d4444444-4444-4444-8444-444444444444", bug_user: true, cap_hits: [{ day: "2026-10-22", scrap: 40000000, runs: 12, play_min: 95, odd: true }], name: "의심스러운덕", nickname: "의심스러운덕", provider: "supabase", platform: "android", created_at: "2026-10-20T01:00:00+00:00", last_seen_at: "2026-10-22T23:59:00+00:00", best_score: 9990000, best_level: 40, banned: true, age_band: 18, runs_stored: 9 },
    { id: "e5555555-5555-4555-8555-555555555555", name: "초보오리", nickname: "초보오리", provider: "supabase", platform: "mobile", created_at: "2026-10-23T06:20:00+00:00", last_seen_at: "2026-10-23T06:20:00+00:00", best_score: null, best_level: null, banned: false, age_band: 18, runs_stored: 0 },
    { id: "f6666666-6666-4666-8666-666666666666", name: "창문덕", nickname: "창문덕", provider: "supabase", platform: "windows", created_at: "2026-10-24T10:00:00+00:00", last_seen_at: "2026-10-24T12:00:00+00:00", best_score: 30500, best_level: 7, banned: false, age_band: 18, runs_stored: 2 },
    { id: "a7777777-7777-4777-8777-777777777777", name: "사과덕", nickname: "사과덕", provider: "supabase", platform: "macos", created_at: "2026-10-24T11:00:00+00:00", last_seen_at: "2026-10-24T13:00:00+00:00", best_score: 12000, best_level: 5, banned: false, age_band: 18, runs_stored: 1 },
  ];
  // Hard-mode round (2026-11-08): the v2 answer of players.get carries unlocks {step: 'on'|'off'} (missing = auto), god_mode, hard_ready,
  // best_hard_level; unlocks.set / unlocks.upto / god.set change them for the page's life (steps in the order of hard_mode.md section 1).
  const UNLOCK_STEPS = ["tab_research", "tab_ranking", "quests", "tab_shop", "tab_modules", "home_friends", "home_mailbox", "purchase", "discount", "upgrade_robot", "hard_card", "hard_play", "hard_upgrade", "hard_pack", "hard_ranking", "hard_sale", "shop_test"];
  const unlockState = {};  // player id -> { unlocks, god }
  const unlockOf = (id) => (unlockState[id] = unlockState[id] || { unlocks: {}, god: false, checkpoint: {} });
  // cpcon1119 (owner 11-19): players.get v2 + checkpoint {classic|hard: 1|8|15} (missing = auto) and checkpoint_best; checkpoint.set and
  // unlocks.many change them. window.__mockNoCheckpoint = a server before 20261119160000 (no keys); __mockNoMany = a tenkey-admin without unlocks.many.
  const reviewState = { "a1111111-1111-4111-8111-111111111111": { on: true, granted: true }, "b2222222-2222-4222-8222-222222222222": { on: false, granted: true } };
  const reviewOf = (id) => (reviewState[id] = reviewState[id] || { on: false, granted: false });
  const detailFor = (id) => {
    const p = PLAYERS.find((x) => x.id === id) || PLAYERS[0];
    const mobile = p.provider === "supabase";
    return {
      ok: true,
      unlocks: { ...unlockOf(p.id).unlocks }, god_mode: unlockOf(p.id).god, hard_ready: !!p.best_level && p.best_level >= 14, best_hard_level: p.best_level >= 14 ? 3 : 0,
      ...(window.__mockNoCheckpoint ? {} : { checkpoint: { ...unlockOf(p.id).checkpoint }, checkpoint_best: { classic: p.best_level || 0, hard: p.best_level >= 14 ? 3 : 0 } }),
      suspects: guardOf(p.id), rank_hold: !p.banned && guardOf(p.id).some((s) => s.kind === "gem" && !s.released) ? "gem" : "",
      player: { id: p.id, name: p.name, avatar_url: "", created_at: p.created_at, last_seen_at: p.last_seen_at, banned: p.banned, bug_user: !!p.bug_user, cap_hits: p.cap_hits || [] },
      identities: [{ provider: p.provider, subject: mobile ? p.id.replace(/^./, "f") : "cg-user-77", login: mobile ? p.id.replace(/^./, "f") : null, created_at: p.created_at }],
      account: mobile ? { nickname: p.nickname, age_band: p.age_band, terms_version: "2026-10-20", consented_at: p.created_at, created_at: p.created_at, renamed_at: null, rename_count: 1 } : null,
      rank: { week_board: "w2026-10-19", all: p.banned || !p.best_score ? null : 3, week: p.banned || !p.best_score ? null : 2 },
      bests: p.best_score ? [{ board: "all", score: p.best_score, level: p.best_level, time_ms: 612000, achieved_at: "2026-10-22T10:00:00+00:00", rules: 1 }, { board: "w2026-10-19", score: p.best_score, level: p.best_level, time_ms: 612000, achieved_at: "2026-10-22T10:00:00+00:00", rules: 1 }] : [],
      runs: p.best_score ? [
        { id: "r1", score: p.best_score, level: p.best_level, time_ms: 612000, depth: 480, scrap: 5230, combo: 77, skills: 9, cause: "battery", build: "1.0.0 (2)", platform: p.platform === "web" ? "web_crazygames" : p.platform, flag: "", created_at: "2026-10-22T10:00:00+00:00" },
        { id: "r2", score: p.banned ? 9990000 : 40100, level: 3, time_ms: 4000, depth: 4, scrap: 12, combo: 2, skills: 0, cause: "battery", build: "1.0.0 (2)", platform: p.platform, flag: p.banned ? "score" : "", created_at: "2026-10-21T10:00:00+00:00" },
      ] : [],
      purchases: mobile && p.best_score ? [{ id: "pu1", platform: p.platform === "ios" ? "ios" : "android", product_id: "tk_gems_60", state: "granted", created_at: "2026-10-21T12:00:00+00:00", refunded_at: null, refund_reason_category: null, order_tail: "A1B2C3D4" }] : [],
      entitlements: mobile && p.best_score ? [{ key: "revive_pass", source: "purchase:tk_revive_pass", granted_at: "2026-10-21T12:05:00+00:00" }] : [],
      wallet: mobile ? { balance: 55, ledger: [{ kind: "grant", amount: 60, reason: "purchase:tk_gems_60", source: "server", at: "2026-10-21T12:00:00+00:00" }, { kind: "spend", amount: 5, reason: "revive", source: "client", at: "2026-10-22T09:00:00+00:00" }] } : null,
    };
  };

  // notices.translate stand-in: "[lang] text" per line, unless a test sets window.__mockTranslate(title, body) -> {lang: {title, body}}.
  const TR_LANGS = ["en", "ja", "de", "zh_TW", "fr", "es", "pt"];
  const fakeTranslations = (title, body) => (window.__mockTranslate ? window.__mockTranslate(title, body)
    : Object.fromEntries(TR_LANGS.map((l) => [l, { title: `[${l}] ${title}`, body: body.split("\n").map((line) => (line.trim() ? `[${l}] ${line}` : line)).join("\n") }])));
  let nextNotice = 5;
  const notices = [
    { id: 4, title_ko: "점검 안내", title_en: "Maintenance", body_ko: "10월 25일 오전 3시부터 1시간 점검합니다.\n점검 중에는 랭킹이 보이지 않습니다.", body_en: "Short maintenance on Oct 25, 3 AM KST for one hour.\nRankings are hidden meanwhile.", translations: fakeTranslations("점검 안내", "10월 25일 오전 3시부터 1시간 점검합니다.\n점검 중에는 랭킹이 보이지 않습니다."), priority: 5, starts_at: "2026-10-24T18:00:00+00:00", ends_at: "2026-10-24T19:30:00+00:00", active: true, created_by: "ops@houseduck.in", updated_by: "ops@houseduck.in", created_at: "2026-10-23T09:00:00+00:00", updated_at: "2026-10-23T09:00:00+00:00", status: "scheduled" },
    { id: 3, title_ko: "1.0.0 업데이트", title_en: "Update 1.0.0", body_ko: "키캡 소리가 새로워졌어요.", body_en: "New keycap sounds.", priority: 0, starts_at: "2026-10-20T00:00:00+00:00", ends_at: null, active: true, created_by: "ops@houseduck.in", updated_by: "ops@houseduck.in", created_at: "2026-10-20T00:00:00+00:00", updated_at: "2026-10-20T00:00:00+00:00", status: "live" },
    { id: 2, title_ko: "오픈 기념 이벤트", title_en: "", body_ko: "오픈을 기념해 젬을 드립니다.", body_en: "", priority: 0, starts_at: "2026-10-10T00:00:00+00:00", ends_at: "2026-10-17T00:00:00+00:00", active: true, created_by: "ops@houseduck.in", updated_by: "ops@houseduck.in", created_at: "2026-10-09T00:00:00+00:00", updated_at: "2026-10-09T00:00:00+00:00", status: "ended" },
    { id: 1, title_ko: "테스트 공지 (숨김)", title_en: "Test notice", body_ko: "x", body_en: "x", priority: -5, starts_at: "2026-10-01T00:00:00+00:00", ends_at: null, active: false, created_by: "ops@houseduck.in", updated_by: "ops@houseduck.in", created_at: "2026-10-01T00:00:00+00:00", updated_at: "2026-10-01T00:00:00+00:00", status: "off" },
  ];
  const statusOf = (n) => (!n.active ? "off" : Date.parse(n.starts_at) > Date.now() ? "scheduled" : n.ends_at && Date.parse(n.ends_at) <= Date.now() ? "ended" : "live");

  const purchaseRows = [
    { id: "p1", created_at: "2026-10-23T09:12:00+00:00", platform: "android", product_id: "tk_gems_200", state: "granted", order_tail: "5521.3388", refunded_at: null, refund_reason_category: null, login_short: "f1111111", player_id: PLAYERS[0].id, name: "딸깍덕" },
    { id: "p2", created_at: "2026-10-22T20:01:00+00:00", platform: "ios", product_id: "tk_revive_pass", state: "granted", order_tail: "90001122", refunded_at: null, refund_reason_category: null, login_short: "f2222222", player_id: PLAYERS[1].id, name: "KeyMaster" },
    { id: "p3", created_at: "2026-10-21T11:40:00+00:00", platform: "android", product_id: "tk_gems_60", state: "refunded", order_tail: "5521.1100", refunded_at: "2026-10-22T08:00:00+00:00", refund_reason_category: "customer_request", login_short: "f1111111", player_id: PLAYERS[0].id, name: "딸깍덕" },
    { id: "p4", created_at: "2026-10-20T10:00:00+00:00", platform: "android", product_id: "tk_gems_60", state: "sandbox", order_tail: "—", refunded_at: null, refund_reason_category: null, login_short: "f9999999", player_id: null, name: null },
  ];

  const boardRows = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, player_id: PLAYERS[i % 3].id, name: ["딸깍덕", "KeyMaster", "cg_player_77"][i % 3] + (i > 2 ? ` ${i}` : ""), provider: i % 3 === 2 ? "crazygames" : "supabase",
    score: 184200 - i * 11300, level: 14 - Math.floor(i / 2), time_ms: 612000 - i * 21000, achieved_at: `2026-10-${22 - (i % 5)}T10:00:00+00:00`, rules: 1, banned: false, eligible: true }))
    .concat([{ rank: null, player_id: PLAYERS[3].id, name: "의심스러운덕", provider: "supabase", score: 9990000, level: 40, time_ms: 4000, achieved_at: "2026-10-21T10:00:00+00:00", rules: 1, banned: true, eligible: false }]);

  let audit = [
    { id: 3, at: "2026-10-23T09:00:00+00:00", admin_email: "ops@houseduck.in", action: "notices.save", params: { reason: "점검 예약", notice: { title_ko: "점검 안내", title_en: "Maintenance" } }, result: { ok: true } },
    { id: 2, at: "2026-10-22T21:10:00+00:00", admin_email: "ops@houseduck.in", action: "players.ban", params: { reason: "점수 조작 의심 (의심 기록 3건)", player_id: PLAYERS[3].id, banned: true }, result: { ok: true } },
    { id: 1, at: "2026-10-22T09:00:00+00:00", admin_email: "ops@houseduck.in", action: "config.set", params: { reason: "1.0.0 배포", config: { min_version_code: 1, latest_version_code: 2 } }, result: { ok: true } },
  ];
  let config = { min_version_code: 1, latest_version_code: 2, min_build_ios: 0, latest_build_ios: 0, store_url_android: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival", store_url_ios: "https://testflight.apple.com/join/RqNJg7Dp", updated_at: "2026-10-22T09:00:00+00:00", community_url: "",
    outside_links: { youtube: "https://www.youtube.com/@Sergeant_Houseduck", instagram: "https://www.instagram.com/sergeant_houseduck/",
      x: "https://x.com/houseduckin", threads: "https://www.threads.com/@sergeant_houseduck", community: "" },
    links: { android: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival", ios: "https://testflight.apple.com/join/RqNJg7Dp", ios_official: false, ios_checked_at: "2026-10-25T17:58:00+00:00" },
    builds: [{ platform: "android", build: 3, players: 0, installs: 4 }, { platform: "android", build: 2, players: 8, installs: 0 }, { platform: "ios", build: 3, players: 0, installs: 2 }, { platform: "ios", build: 2, players: 1, installs: 0 }],
    balance: { ver: 0, xp_scale: 1, mouse_pace: 1, battery_drain_scale: 1, robot_power_scale: 1, updated_at: "2026-10-25T15:34:00+00:00", updated_by: "" } };
  // A few rows of the server's dial table (tenkey_private.balance_tune_bounds, 20261125120000), one per group, same values.
  // window.__mockNoBounds = a server before that migration (no balance_bounds in config.get).
  config.balance_bounds = [
    { name: "drift_power_x", min: 1.1, max: 1.35, int: false, default: 1.2, label: "드리프트 직진 힘", group: "DRIFT", since: "1.0.1" },
    { name: "robot_bite_deep", min: 0, max: 2, int: true, default: 1, label: "로봇 앞으로 금 가는 줄", group: "로봇", since: "1.0.1" },
    { name: "wear", min: 1.26, max: 2.52, int: false, default: 1.8, label: "Lv 30 내구도 소모 배율", group: "압박", since: "1.0.1" },
    { name: "ovc_band_1", min: 0.5, max: 1.3, int: false, default: 0.8, label: "오버클럭 키 비율 · Lv 2~6", group: "오버클럭", since: "1.0.1" },
    { name: "upg_cost_x", min: 0.5, max: 2, int: false, step: 0.01, default: 1, label: "텐키 부품 강화 비용 배수 (해금 키 Lv 1 포함, 수수료 제외)", group: "강화 비용", since: "1.0.1" },
  ];

  window.__mockCalls = [];
  window.__mockFailures = {};
  const logAudit = (action, p) => audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } });
  // The pages' own actions live in tests/fixtures/tenkey/<page>.js (window.__tkPages[action] = (params, body, fn) => answer); this
  // core keeps the shared players, notices, purchases, ranking, audit and config. tests/fixtures/tenkey_console.cjs joins them.
  window.__tkFx = { TODAY, dayAt, PLAYERS };
  window.__tkPages = window.__tkPages || {};
  const respond = (action, p, body, fn) => {
    if (window.__tkPages[action]) return window.__tkPages[action](p, body, fn);
    switch (action) {
      case "overview.get": return overview(p.platform);
      // tenkey-console-stats (separate function): pre-registration counts by Berlin day and page language.
      case "overview.web": return overview("web_itch");
      // admin_dau_v3 (2026-11-24): + mobile (android + ios), u3_/u7_mobile, u3_/u7_itch, players_mobile / players_itch, unknown.
      // + the launch cohort (2026-11-24): launch_day = the fixture's 3rd-last day; mobile 7 = 4 store players + 3 testers from it.
      case "dau.get": { const series = overview().series; const launch = series.at(-3).day;
        return { version: 3, launch_day: launch, days: series.map((r, i) => { const on = r.day >= launch; const k = on ? series.length - 1 - i : 0;
          return { day: r.day, all: 20 + i, web_itch: 12 + i, android: 5, ios: 2, other: 1, unknown: 0, mobile: 7, u7: 50 + i, u3: 30 + i,
            u7_mobile: 20 + i, u3_mobile: 12 + i, u7_itch: 30 + i, u3_itch: 18 + i, players_mobile: 40 + i, players_itch: 300 + i,
            mobile_launch: on ? 4 : 0, mobile_tester: on ? 3 : 7, players_launch: on ? 5 + (2 - k) * 3 : 0, u3_launch: on ? 4 : 0, u7_launch: on ? 4 : 0,
            web_gamepix: 1, web_nekoland: 2, visits_itch: 15 + i, visits_gamepix: 0, visits_nekoland: 3,
            new_itch: 3, back_itch: 1, new_app: 2, back_app: 1, new_other: 0, back_other: 0 }; }) }; }
      // money per purchase and totals (2026-11-25): the first fixture purchase has Google's own revenue, the second an estimate
      case "money.get": { const unit = p.unit || "day";
        const items = {}; const firstIds = ["p1", "p2"];
        if (firstIds[0]) items[firstIds[0]] = { store: "android", country: "KR", currency: "KRW", price: 4400, tax: 400, dev_revenue: 3400, fx_eur: 0.000678, price_eur: 2.9832, net_eur: 2.3052, net_source: "store", vat_rate: null, fee_rate: null };
        if (firstIds[1]) items[firstIds[1]] = { store: "ios", country: "JP", currency: "JPY", price: 500, fx_eur: 0.0057, price_eur: 2.85, net_eur: 2.2023, net_source: "estimate", vat_rate: 0.1, fee_rate: 0.15 };
        return { unit, fee_rate: 0.15, items, periods: [
          { period: "2026-10-23", iap_count: 2, iap_gross_eur: 5.83, iap_net_eur: 4.51, iap_unpriced: 0, app_units: 3, app_gross_eur: 8.97, app_net_eur: 6.4, by_store: null },
          { period: "2026-10-22", iap_count: 0, iap_gross_eur: 0, iap_net_eur: 0, iap_unpriced: 0, app_units: 1, app_gross_eur: 2.99, app_net_eur: 2.1, by_store: null }] }; }
      // economy flow (2026-11-25): two days, gems grow faster than they go
      case "economy.get": return { first_day: "2026-10-22", today: "2026-10-23", days: [
          { day: "2026-10-22", gems_in: 500, gems_out: 120, gems_bought: 260, scrap_in: 9000, scrap_out: 7000, parts_in: 20, parts_out: 10, accounts: 6 },
          { day: "2026-10-23", gems_in: 300, gems_out: 280, gems_bought: 0, scrap_in: 8000, scrap_out: 9000, parts_in: 12, parts_out: 15, accounts: 8 }],
        reasons: [{ currency: "gems", kind: "grant", reason: "purchase", amount: 260, events: 1, accounts: 1 }, { currency: "gems", kind: "grant", reason: "play", amount: 540, events: 40, accounts: 8 },
          { currency: "gems", kind: "spend", reason: "revive", amount: 400, events: 40, accounts: 6 }, { currency: "scrap", kind: "grant", reason: "run", amount: 17000, events: 30, accounts: 8 },
          { currency: "scrap", kind: "spend", reason: "upgrade", amount: 16000, events: 20, accounts: 7 }],
        balances: [{ currency: "gems", accounts: 8, avg: 140, median: 120, p90: 300, max: 520 }] };
      // per app build health (2026-11-24): Android 23 newest and clean, Android 22 with problems, iOS 22
      case "builds.get": return { days: 7, today: overview().series.at(-1).day, builds: [
        { platform: "android", build: 23, app_version: "1.0.0 a23 i24 w55", devices: 8, devices_today: 6, first_day: "2026-10-19", last_day: "2026-10-23", exits: 0, exit_devices: 0, anrs: 0, script_errors: 0, hitches: 11, hitch_devices: 4, memory_warnings: 0, server_errors: 0 },
        { platform: "android", build: 22, app_version: "1.0.0 a22 i23 w54", devices: 3, devices_today: 2, first_day: "2026-10-18", last_day: "2026-10-23", exits: 1, exit_devices: 1, anrs: 1, script_errors: 2, hitches: 1, hitch_devices: 1, memory_warnings: 0, server_errors: 1 },
        { platform: "ios", build: 22, app_version: "1.0.0 a20 i22 w50", devices: 7, devices_today: 6, first_day: "2026-10-18", last_day: "2026-10-23", exits: 0, exit_devices: 0, anrs: 0, script_errors: 0, hitches: 6, hitch_devices: 4, memory_warnings: 1, server_errors: 0 }] };
      // store reviews and ratings (2026-11-24): one App Store review without a reply, one Play review answered
      case "reviews.get": return { sync: [{ store: "google_reviews", ok: true, note: "reviews 1" }, { store: "apple_reviews", ok: true, note: "reviews 1, storefronts 10" }],
        stats: [{ store: "apple", reviews: 1, average: 2, unanswered: 1, last_7d: 1, stars: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 } }, { store: "google", reviews: 1, average: 5, unanswered: 0, last_7d: 1, stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } }],
        ratings: [{ store: "apple", country: "KR", average: 4.5, count: 12, prev_count: 10, day: "2026-11-24" }, { store: "apple", country: "JP", average: 4, count: 4, prev_count: 4, day: "2026-11-24" }],
        checked: 120, countries: [{ country: "KR", reviews: 1, average: 2, unanswered: 1, last_at: "2026-11-24T10:00:00Z", stores: ["apple"] }, { country: "lang:ko", reviews: 1, average: 5, unanswered: 0, last_at: "2026-11-23T10:00:00Z", stores: ["google"] }],
        reviews: [{ store: "apple", review_id: "r1", rating: 2, title: "어려워요", body: "튜토리얼이 너무 빨라요", territory: "KOR", lang: "", author: "a", created_at: "2026-11-24T10:00:00Z", app_version: "", reply: "", replied_at: null },
          { store: "google", review_id: "g1", rating: 5, title: "", body: "딸깍 소리 최고", territory: "", lang: "ko", author: "b", created_at: "2026-11-23T10:00:00Z", app_version: "1.0.0", reply: "감사합니다", replied_at: "2026-11-23T12:00:00Z" }] };
      // the stores' reports (2026-11-24): Play connected with two days of sales, App Store waiting for its API key
      case "store.get": return { sync: [{ store: "apple", ok: false, note: "apple_not_configured", tried_at: new Date().toISOString(), synced_at: null },
          { store: "google", ok: true, note: "files: sales/salesreport_202610.zip", tried_at: new Date().toISOString(), synced_at: new Date().toISOString() }],
        // store days are the stores' own (Pacific) days counted back from the real today, like the page's chart
        days: [{ day: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), store: "google", app_units: 3, app_refunds: 0, iap_units: 1 },
          { day: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), store: "google", app_units: 2, app_refunds: 0, iap_units: 0 }],
        totals: { google_app: 5, apple_app: 0 }, money: [], installs: [], countries: [{ country: "KR", units: 5 }] };
      case "prereg.get": {
        const days = overview().series.map((r, i) => ({ day: r.day, n: i % 5, ko: i % 2, en: i % 5 - (i % 2) > 0 ? i % 5 - (i % 2) : 0, ja: 0, zh: i % 3 === 0 ? 1 : 0, de: 0 }));
        days.forEach((d) => { d.n = d.ko + d.en + d.zh; });
        const sumN = (rows) => rows.reduce((t, d) => t + d.n, 0);
        return { today: days.at(-1).day, total: sumN(days), d1: days.at(-1).n, d1_prev: days.at(-2).n, d7: sumN(days.slice(-7)), d7_prev: sumN(days.slice(-14, -7)),
          by_locale: { ko: days.reduce((t, d) => t + d.ko, 0), en: days.reduce((t, d) => t + d.en, 0), zh: days.reduce((t, d) => t + d.zh, 0) }, unsubscribed: 0, last_at: new Date().toISOString(), days };
      }
      case "players.list": {
        const q = String(p.query || "").toLowerCase();
        // 'app' (2026-11-24, tenkey-console-stats / admin_players_list_v3) = every player that is not a web build
        const isWeb = (x) => String(x.platform || "").startsWith("web") || x.provider === "crazygames";
        const rows = PLAYERS.filter((x) => (!q || x.name.toLowerCase().includes(q) || x.id.startsWith(q)) && (!p.platform || x.platform === p.platform
          || (p.platform === "web" && isWeb(x)) || (p.platform === "app" && !isWeb(x))));
        return { ok: true, total: rows.length, rows: rows.map((x) => ({ ...x, god_mode: unlockOf(x.id).god, tags: [...new Set(guardOf(x.id).filter((g) => !g.released).map((g) => g.kind))].sort() })) };
      }
      case "players.get": return detailFor(p.player_id);
      // the player page also asks for the latest device facts and the last 10 balance runs (console 11-04, 8ddf341)
      case "players.facts": return { client_info: { platform: "android", app_version: "1.0.0", build: 2, device_model: "SM-S918N", os_version: "14", store_country: "KR", device_region: "KR", first_seen_at: "2026-10-20T10:00:00+00:00", last_seen_at: "2026-10-23T10:00:00+00:00" }, retention: { current_streak: 2, first_day: "2026-10-20", milestones: [] }, balance_runs: [] };
      case "players.ban": { const x = PLAYERS.find((r) => r.id === p.player_id); if (x) x.banned = p.banned; if (!p.banned) passed.add(p.player_id); audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action: action, params: p, result: { ok: true } }); return { ok: true, banned: p.banned }; }
      case "unlocks.set": {
        if (!UNLOCK_STEPS.includes(p.step) || !["auto", "on", "off"].includes(p.state) || !p.reason) return { ok: false, error: "invalid_request" };
        const u = unlockOf(p.player_id).unlocks, before = u[p.step] || "auto";
        if (p.state === "auto") delete u[p.step]; else u[p.step] = p.state;
        logAudit(action, p);
        return { ok: true, changed: before !== p.state };
      }
      case "unlocks.upto": {
        const at = UNLOCK_STEPS.indexOf(p.step);
        if (at < 0 || !p.reason) return { ok: false, error: "invalid_request" };
        const u = unlockOf(p.player_id).unlocks;
        UNLOCK_STEPS.slice(0, at + 1).forEach((step) => { u[step] = "on"; });
        logAudit(action, p);
        return { ok: true, changed: true };
      }
      case "unlocks.many": {
        if (window.__mockNoMany) throw new Error("unknown_action");
        if (!Array.isArray(p.steps) || !p.steps.length || p.steps.some((s) => !UNLOCK_STEPS.includes(s)) || !["auto", "on", "off"].includes(p.state) || !p.reason) return { ok: false, error: "invalid_request" };
        const u = unlockOf(p.player_id).unlocks;
        p.steps.forEach((step) => { if (p.state === "auto") delete u[step]; else u[step] = p.state; });
        logAudit(action, p);
        return { ok: true, changed: true, count: p.steps.length, unlocks: { ...u } };
      }
      case "checkpoint.set": {
        if (window.__mockNoCheckpoint) throw new Error("unknown_action");
        if (!["classic", "hard"].includes(p.mode) || !(p.level === null || [1, 8, 15].includes(p.level)) || !p.reason) return { ok: false, error: "invalid_request" };
        const c = unlockOf(p.player_id).checkpoint, before = c[p.mode] ?? null;
        if (p.level === null) delete c[p.mode]; else c[p.mode] = p.level;
        if (before !== p.level) logAudit(action, p);
        return { ok: true, changed: before !== p.level, mode: p.mode, level: p.level, checkpoint: { ...c } };
      }
      case "god.set": { const g = unlockOf(p.player_id); const changed = g.god !== !!p.on; g.god = !!p.on; logAudit(action, p); return { ok: true, changed }; }
      // Watch round (2026-11-15): tagged accounts. 딸깍덕 = review ON, KeyMaster = review granted but off, god = whoever god.set turned on, TOP10 by rank.
      case "watch.list": {
        if (window.__mockNoWatch) return { ok: false, error: "unknown_action" };
        const runs = (mode, start) => [1, 2, 3].map((i) => ({ id: `w${i}${mode}`, score: 90000 - i * 1000, level: 12 - i, time_ms: 300000 + i * 1000, mode, cause: "battery", platform: "ios", build: "1.0.0 (22)", flag: "", created_at: `2026-11-15T0${i}:00:00+00:00`, start_level: start }));
        const rows = PLAYERS.filter((x) => x.provider === "supabase").map((x) => ({
          id: x.id, name: x.name, nickname: x.nickname, banned: x.banned, created_at: x.created_at, last_seen_at: x.last_seen_at, platform: x.platform,
          god_mode: unlockOf(x.id).god, review_mode: reviewOf(x.id).on, review_granted: reviewOf(x.id).granted,
          rank_normal: x.id.startsWith("b2") ? 3 : null, rank_hard: x.id.startsWith("b2") ? 1 : null, runs_today: 4,
          best_normal: x.best_score ? { score: x.best_score, level: x.best_level } : null, best_hard: x.id.startsWith("b2") ? { score: 5200, level: 6 } : null,
          runs: x.id.startsWith("a1") ? runs("classic", 8) : x.id.startsWith("b2") ? runs("hard", null) : []  /* null = what admin_watch_v1 sends today (tenkey.runs stores no start) */,
        })).filter((r) => r.god_mode || r.review_mode || r.review_granted || r.rank_normal || r.rank_hard);
        return { ok: true, season_board: "q2026-4", total: rows.length, rows };
      }
      case "review.code_state": return { ok: true, on: window.__mockReviewCode !== false };
      case "review.set": {
        const r = reviewOf(p.player_id); const changed = r.on || r.granted;
        if (p.on !== false || !p.reason) return { ok: false, error: "invalid_request" };
        r.on = false; r.granted = false; logAudit(action, p); return { ok: true, changed, review_mode: false };
      }
      case "notices.list": notices.forEach((n) => { n.status = statusOf(n); }); return notices.slice().sort((a, b) => b.id - a.id);
      case "notices.translate": return { translations: fakeTranslations(p.notice.title_ko, p.notice.body_ko) };
      case "notices.save": {
        const n = { ...p.notice };
        const filled = fakeTranslations(n.title_ko, n.body_ko);
        n.translations = Object.fromEntries(TR_LANGS.map((l) => [l, n.translations?.[l] || filled[l]]));
        n.title_en = n.translations.en.title; n.body_en = n.translations.en.body;
        if (n.id) { Object.assign(notices.find((x) => x.id === n.id), n, { updated_by: "qa@houseduck.in" }); }
        else notices.push({ ...n, id: nextNotice++, ends_at: n.ends_at || null, created_by: "qa@houseduck.in", updated_by: "qa@houseduck.in", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } });
        return { ok: true, notice: n };
      }
      case "notices.end": { const n = notices.find((x) => x.id === p.id); if (n) { if (Date.parse(n.starts_at) > Date.now()) n.active = false; else n.ends_at = new Date().toISOString(); } return { ok: true }; }
      case "notices.delete": { const i = notices.findIndex((x) => x.id === p.id); if (i >= 0) notices.splice(i, 1); return { ok: true }; }
      case "purchases.list": {
        const rows = purchaseRows.filter((r) => (!p.platform || r.platform === p.platform) && (!p.state || r.state === p.state));
        return { ok: true, total: rows.length, rows, summary: { total: 4, granted: 2, sandbox: 1, refunded: 1, android: 3, ios: 1, by_product: [{ product: "tk_gems_200", n: 1 }, { product: "tk_revive_pass", n: 1 }],
          gems: { granted_range: 260, spent_range: 85, granted_all: 320, spent_all: 140, wallets: 3, revive_pass_owners: 1 } } };
      }
      case "ranking.board": return { ok: true, board: p.board === "all" ? "all" : "w2026-10-19", kind: p.board === "all" ? "all" : "week", ends: p.board === "all" ? null : "2026-10-26T09:00:00+00:00", current_rules: 1, total: 12, rows: boardRows.slice(0, p.limit || 50), boards: ["all", "w2026-10-19", "w2026-10-12"] };
      case "ranking.flagged": return { ok: true, rows: [
        { id: "f1", created_at: "2026-10-21T10:00:00+00:00", player_id: PLAYERS[3].id, name: "의심스러운덕", score: 9990000, level: 40, time_ms: 4000, depth: 4, scrap: 12, combo: 2, skills: 0, cause: "battery", build: "1.0.0 (2)", platform: "android", flag: "score" },
        { id: "f2", created_at: "2026-10-21T09:00:00+00:00", player_id: PLAYERS[3].id, name: "의심스러운덕", score: 120000, level: 30, time_ms: 9000, depth: 4, scrap: 12, combo: 2, skills: 0, cause: "battery", build: "1.0.0 (2)", platform: "android", flag: "level" }] };
      case "audit.list": return audit.slice(0, p.limit || 50);
      case "config.get": {
        if (window.__mockBounds) config.balance_bounds = window.__mockBounds;  // a capture with the whole server table
        if (!window.__mockNoBounds) return config;
        const { balance_bounds, ...older } = config;
        return older;
      }
      // Owner 2026-11-24: shared social-link setter; config.links remains the store-link object.
      case "links.set": {
        const next = { ...(config.outside_links || {}), [p.id]: p.url };
        config = { ...config, outside_links: next, ...(p.id === "community" ? { community_url: p.url } : {}) };
        return { ok: true, changed: true, links: next };
      }
      case "knobs.set": {
        const k = p.knobs || {};
        if (Object.entries(k).some(([name, v]) => name !== "tune" && (typeof v !== "number" || v < 0.7 || v > 1.3))) return { ok: false, error: "invalid_knob_value" };
        // The server's tune rule (tenkey_private.balance_tune_ok): a known row, a number inside its range, whole for int rows.
        if (k.tune && Object.entries(k.tune).some(([name, v]) => {
          const r = (config.balance_bounds || []).find((b) => b.name === name);
          return !r || typeof v !== "number" || v < r.min || v > r.max || (r.int && !Number.isInteger(v))
            || (r.step && Math.abs(v / r.step - Math.round(v / r.step)) > 1e-9);
        })) return { ok: false, error: "invalid_knob_value" };
        const next = { ...config.balance, ...k };
        if (["xp_scale", "mouse_pace", "battery_drain_scale", "robot_power_scale"].every((n) => next[n] === config.balance[n])
          && JSON.stringify(next.tune || {}) === JSON.stringify(config.balance.tune || {})) return { ok: true, unchanged: true, balance: config.balance };
        config.balance = { ...next, ver: config.balance.ver + 1, updated_by: "qa@houseduck.in", updated_at: new Date().toISOString() };
        audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } });
        return { ok: true, balance: config.balance };
      }
      case "config.set": config = { ...config, ...p.config, updated_at: new Date().toISOString() }; audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } }); return { ok: true, config };
      case "community.set": {  // the server's rule (tenkey.admin_community_set_v1): "" resets, else a YouTube https link
        const u = String(p.url || "").trim();
        if (u && !/^https:\/\/(((www|m)\.)?youtube\.com|youtu\.be)\/[^\s]+$/.test(u)) throw Object.assign(new Error("invalid_url"), { status: 400 });
        const changed = config.community_url !== u;
        config = { ...config, community_url: u };
        if (changed) audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } });
        return { ok: true, changed, community_url: u };
      }
      default: throw Object.assign(new Error("unknown_action"), { status: 400 });
    }
  };
  window.ConsoleAPI = {
    initialize: () => {}, initializeProject: () => {},
    post: async () => ({ summary: {}, daily: [], players: [], retention: [], rows: [], total: 0 }),
    postProject: async (project, fn, body) => {
      window.__mockCalls.push({ project, fn, ...JSON.parse(JSON.stringify(body)) });
      if (window.__mockFailures[body.action]) throw Object.assign(new Error(window.__mockFailures[body.action]), { status: 400 });
      const data = respond(body.action, body.params || {}, body, fn);
      return { ok: true, data: JSON.parse(JSON.stringify(data)), auth_mode: "console_ticket" };
    },
  };
})();
