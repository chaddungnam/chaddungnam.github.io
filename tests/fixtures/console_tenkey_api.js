// Local synthetic data only (never real players): a stand-in for window.ConsoleAPI that answers the tenkey-admin actions the
// "10key Survival" console pages call, with the same shapes the server's admin RPCs return. State changes (notice saves, ends,
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
  const overview = (platform) => {
    const k = platform ? (platform === "android" ? 0.7 : 0.3) : 1;
    const scale = (v) => Math.round(v * k);
    const last = series.at(-1);
    const prev = series.at(-2);
    return {
      ok: true, today: TODAY, days: DAYS, platform: platform || null,
      series: platform ? series.map((r) => ({ ...r, dau: scale(r.dau), runs: scale(r.runs), new_installs: scale(r.new_installs) })) : series,
      active: { d1: scale(last.dau), d1_prev: scale(prev.dau), d7: scale(420), d7_prev: scale(310), d30: scale(780), d30_prev: 0 },
      runs: { d1: scale(last.runs), d1_prev: scale(prev.runs), d7: scale(sumLast("runs", 7)), d7_prev: scale(1900), d30: scale(sumLast("runs", 30)), d30_prev: 0 },
      new_installs: { d1: scale(last.new_installs), d1_prev: scale(prev.new_installs), d7: scale(sumLast("new_installs", 7)), d7_prev: scale(120), d30: scale(sumLast("new_installs", 30)), d30_prev: 0, all: scale(sumLast("new_installs", 90)) },
      retention: { d1: { cohort: 96, back: 41 }, d7: { cohort: 52, back: 14 }, d30: { cohort: 0, back: 0 } },
      platforms: [{ key: "android", n: 330 }, { key: "ios", n: 90 }],
      versions: [{ key: "1.0.0 a2 i2", n: 310 }, { key: "1.0.0 a1 i1", n: 110 }],
      langs: [{ key: "ko", n: 560 }, { key: "en", n: 190 }, { key: "?", n: 30 }],
      totals: { players: 842, accounts: 611, banned: 2, crash_rows_24h: 5, crash_times_24h: 9, notices_live: 1, purchases_30d: 14, stored_runs: 1834,
        db_bytes: 91234816, tenkey_bytes: 4194304 },
      as_of: "2026-10-23T13:30:00+00:00",
    };
  };

  const PLAYERS = [
    { id: "a1111111-1111-4111-8111-111111111111", name: "딸깍덕", nickname: "딸깍덕", provider: "supabase", platform: "android", created_at: "2026-10-12T09:10:00+00:00", last_seen_at: "2026-10-23T11:02:00+00:00", best_score: 184200, best_level: 14, banned: false, age_band: 18, runs_stored: 11 },
    { id: "b2222222-2222-4222-8222-222222222222", name: "KeyMaster", nickname: "KeyMaster", provider: "supabase", platform: "ios", created_at: "2026-10-15T15:44:00+00:00", last_seen_at: "2026-10-23T08:30:00+00:00", best_score: 96100, best_level: 11, banned: false, age_band: 14, runs_stored: 6 },
    { id: "c3333333-3333-4333-8333-333333333333", name: "cg_player_77", nickname: null, provider: "crazygames", platform: "web", created_at: "2026-10-18T19:00:00+00:00", last_seen_at: "2026-10-22T20:15:00+00:00", best_score: 51200, best_level: 9, banned: false, age_band: null, runs_stored: 4 },
    { id: "d4444444-4444-4444-8444-444444444444", name: "의심스러운덕", nickname: "의심스러운덕", provider: "supabase", platform: "android", created_at: "2026-10-20T01:00:00+00:00", last_seen_at: "2026-10-22T23:59:00+00:00", best_score: 9990000, best_level: 40, banned: true, age_band: 18, runs_stored: 9 },
    { id: "e5555555-5555-4555-8555-555555555555", name: "초보오리", nickname: "초보오리", provider: "supabase", platform: "mobile", created_at: "2026-10-23T06:20:00+00:00", last_seen_at: "2026-10-23T06:20:00+00:00", best_score: null, best_level: null, banned: false, age_band: 18, runs_stored: 0 },
  ];
  const detailFor = (id) => {
    const p = PLAYERS.find((x) => x.id === id) || PLAYERS[0];
    const mobile = p.provider === "supabase";
    return {
      ok: true,
      player: { id: p.id, name: p.name, avatar_url: "", created_at: p.created_at, last_seen_at: p.last_seen_at, banned: p.banned },
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

  const crashes = [
    { id: 41, received_at: "2026-10-23T10:12:00+00:00", last_at: "2026-10-23T12:40:00+00:00", repeats: 3, kind: "unclean_exit", platform: "Android", app_version: "1.0.0 a2 i2", os_version: "14", device_model: "SM-S918N", locale: "ko_KR", message: "handle_crash: Program crashed with signal 11", has_log: true, install_short: "9f31a0c2" },
    { id: 40, received_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", repeats: 0, kind: "script_error", platform: "iOS", app_version: "1.0.0 a2 i2", os_version: "17.6", device_model: "iPhone14,5", locale: "en_US", message: "res://scripts/dig/dig_run.gd:212", has_log: false, install_short: null },
    { id: 39, received_at: "2026-10-22T19:30:00+00:00", last_at: "2026-10-22T19:30:00+00:00", repeats: 0, kind: "anr_suspect", platform: "Android", app_version: "1.0.0 a1 i1", os_version: "13", device_model: "Pixel 6a", locale: "ko_KR", message: "anr_suspect", has_log: false, install_short: null },
  ];
  const groups = (by) => ({
    ok: true, by, days: 7,
    rows: by === "kind"
      ? [{ key: "unclean_exit", rows: 3, times: 6, installs: 2, devices: 2, versions: 2, first_at: "2026-10-21T10:00:00+00:00", last_at: "2026-10-23T12:40:00+00:00", sample_id: 41, kinds: ["unclean_exit"], platforms: ["Android"], said: null }, { key: "script_error", rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", sample_id: 40, kinds: ["script_error"], platforms: ["iOS"], said: "Invalid get index 'x'" }]
      : [{ key: crashes[0].message, rows: 3, times: 6, installs: 2, devices: 2, versions: 2, first_at: "2026-10-21T10:00:00+00:00", last_at: "2026-10-23T12:40:00+00:00", sample_id: 41, kinds: ["unclean_exit"], platforms: ["Android"], said: null },
        { key: crashes[1].message, rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", sample_id: 40, kinds: ["script_error"], platforms: ["iOS"], said: "Invalid get index 'x' (on base: 'Dictionary')." },
        { key: "anr_suspect", rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-22T19:30:00+00:00", last_at: "2026-10-22T19:30:00+00:00", sample_id: 39, kinds: ["anr_suspect"], platforms: ["Android"], said: null }],
  });
  const crashDetail = (id) => {
    const c = crashes.find((x) => x.id === id) || crashes[0];
    return { ok: true, crash: { ...c, build: 2, signature: "9a0b3f", enriched_at: c.has_log ? "2026-10-23T10:12:06+00:00" : null, same_signature_rows: 3,
      detail: { uptime_s: 412, trail: ["start Android 1.0.0 a2 i2", "scene BootScene", "scene TitleScene", "scene DigScene", "bg", "fg"] },
      log_tail: c.has_log ? "Godot Engine v4.7.2.stable.official\nOpenGL API OpenGL ES 3.2\n...\nERROR: Condition \"!is_inside_tree()\" is true.\n   at: get_global_transform (scene/3d/node_3d.cpp:412)\n================================================================\nhandle_crash: Program crashed with signal 11\nEngine version: Godot Engine v4.7.2.stable.official\nDumping the backtrace. Please include this when reporting the bug to the project developer.\n[1] 0x1a2b3c4d" : "" } };
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
  let config = { min_version_code: 1, latest_version_code: 2, min_build_ios: 0, latest_build_ios: 0, store_url_android: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival", store_url_ios: "", updated_at: "2026-10-22T09:00:00+00:00" };

  window.__mockCalls = [];
  window.__mockFailures = {};
  const respond = (action, p, body) => {
    switch (action) {
      case "overview.get": return overview(p.platform);
      case "players.list": {
        const q = String(p.query || "").toLowerCase();
        const rows = PLAYERS.filter((x) => (!q || x.name.toLowerCase().includes(q) || x.id.startsWith(q)) && (!p.platform || x.platform === p.platform || (p.platform === "web" && x.provider === "crazygames")));
        return { ok: true, total: rows.length, rows };
      }
      case "players.get": return detailFor(p.player_id);
      case "players.ban": { const x = PLAYERS.find((r) => r.id === p.player_id); if (x) x.banned = p.banned; audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action: action, params: p, result: { ok: true } }); return { ok: true, banned: p.banned }; }
      case "crashes.list": return { ok: true, total: crashes.length, rows: crashes.filter((c) => (!p.kind || c.kind === p.kind) && (!p.query || c.message.includes(p.query) || c.device_model.includes(p.query) || c.app_version.includes(p.query))) };
      case "crashes.groups": return groups(p.by);
      case "crashes.get": return crashDetail(p.id);
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
      case "config.get": return config;
      case "config.set": config = { ...config, ...p.config, updated_at: new Date().toISOString() }; audit.unshift({ id: audit.length + 1, at: new Date().toISOString(), admin_email: "qa@houseduck.in", action, params: p, result: { ok: true } }); return { ok: true, config };
      default: throw Object.assign(new Error("unknown_action"), { status: 400 });
    }
  };
  window.ConsoleAPI = {
    initialize: () => {}, initializeProject: () => {},
    post: async () => ({ summary: {}, daily: [], players: [], retention: [], rows: [], total: 0 }),
    postProject: async (project, fn, body) => {
      window.__mockCalls.push({ project, fn, ...JSON.parse(JSON.stringify(body)) });
      if (window.__mockFailures[body.action]) throw Object.assign(new Error(window.__mockFailures[body.action]), { status: 400 });
      const data = respond(body.action, body.params || {}, body);
      return { ok: true, data: JSON.parse(JSON.stringify(data)), auth_mode: "console_ticket" };
    },
  };
})();
