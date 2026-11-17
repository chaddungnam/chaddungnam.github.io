// Local synthetic data only (never real players or devices): the 이슈함 page's reads on tenkey-console-stats, with both shapes the
// server holds: rows from builds that send the run / save / steps (new) and rows from older builds that do not (old, '—').
//   issues.list {days, source: crash|app, kind?, limit} -> {groups, rows}   issues.get {source, id} -> {row}
//   issues.timeline {install, at, minutes} -> {rows}                       issues.asks {days} -> {rows} (inquiries, ctx on new rows)
(function () {
  const INSTALL = "9f31a0c2-0000-4000-8000-000000000001";
  const RUN = { seed: 918273, mode: "classic", lv: 12, t: 245, start_lv: 1, form: "drift", demo: false };
  const SAVE = { schema: 7, runs: 33, best_lv: 18, up_sum: 14, mods: ["m_xp", "m_bat"] };
  const TRAIL = ["0 start Android 1.0.3 a41", "3 scene TitleScene", "9 scene DigScene", "40 lvup 2", "41 pick laser", "120 crisis numlock", "121 cage",
    "150 pop+ revive", "152 revive", "153 pop- revive", "245 bg"];
  const rows = {
    crash: [
      { source: "crash", id: 41, at: "2026-10-23T10:12:00+00:00", kind: "unclean_exit", platform: "android", app_version: "1.0.3", build: 41, where: "DigScene", said: "signal 11", count: 4, device_model: "SM-S918N", has_run: true },
      { source: "crash", id: 39, at: "2026-10-22T19:30:00+00:00", kind: "anr_suspect", platform: "android", app_version: "1.0.0", build: 2, where: null, said: null, count: 1, device_model: "Pixel 6a", has_run: false },
    ],
    app: [
      { source: "app", id: 501, at: "2026-10-23T09:00:00+00:00", kind: "hitch", platform: "web_itch", app_version: "1.0.3", build: 52, where: "level_up_cards", said: "frame 640 ms", count: 7, device_model: "Chrome 141", has_run: true },
      { source: "app", id: 502, at: "2026-10-23T08:30:00+00:00", kind: "stall", platform: "web_itch", app_version: "1.0.3", build: 52, where: "home_load", said: "5.4 s", count: 2, device_model: "Chrome 141", has_run: false },
      { source: "app", id: 500, at: "2026-10-21T08:00:00+00:00", kind: "script_error", platform: "ios", app_version: "1.0.0", build: 2, where: "res://scripts/dig/dig_run.gd:212", said: "Invalid get index 'x'", count: 1, device_model: null, has_run: false },
    ],
  };
  const groupsOf = (list) => {
    const out = new Map();
    for (const r of list) {
      const key = `${r.kind}|${r.where || ""}`;
      const g = out.get(key) || { source: r.source, kind: r.kind, where: r.where, platform: r.platform, n: 0, last_at: r.at, versions: [] };
      g.n += r.count || 1;
      if (!g.versions.includes(r.app_version)) g.versions.push(r.app_version);
      out.set(key, g);
    }
    return [...out.values()];
  };
  const details = {
    "crash:41": { ...rows.crash[0], os_version: "14", locale: "ko_KR", install_id: INSTALL, log_tail: "Godot Engine v4.7.2.stable.official\nhandle_crash: Program crashed with signal 11",
      detail: { run: RUN, save: SAVE, sid: "s-7f3a", trace: "tr-91c2", trail: TRAIL, uptime_s: 245 } },
    "crash:39": { ...rows.crash[1], os_version: "13", locale: "ko_KR", detail: {} },
    "app:501": { ...rows.app[0], install_id: "web-page-load-0001", detail: { run: { seed: 4455, mode: "classic", lv: 6, t: 88, start_lv: 1, form: "tenkey", demo: true }, trail: ["0 start Web 1.0.3", "12 scene DigScene", "80 lvup 6", "88 pop+ level_up"] } },
    "app:502": { ...rows.app[1], detail: {} },
    "app:500": { ...rows.app[2], detail: { trail: ["0 start iOS 1.0.0", "5 scene DigScene"] } },
  };
  const asks = [
    { receipt: "c0ffee01", submitted_at: "2026-10-23T11:00:00+00:00", body: "보스 앞에서 화면이 멈췄어요", meta: { version: "1.0.3", build: "41", platform: "android", device: "SM-S918N", locale: "ko" },
      email: "player+qa@example.com", status: "open", player_id: "a1111111-1111-4111-8111-111111111111", display_name: "딸깍덕", public_id: "TK7Q2",
      ctx: { sid: "s-7f3a", steps: ["30 scene DigScene", "40 lvup 2", "41 pick laser", "60 pop+ contact"], run: RUN, save: SAVE } },
    { receipt: "c0ffee00", submitted_at: "2026-10-20T09:00:00+00:00", body: "old build text", meta: { locale: "ja" }, status: "open", player_id: null },
  ];
  const stats = (fn) => { if (fn !== "tenkey-console-stats") throw Object.assign(new Error("unknown_action"), { status: 400 }); };
  Object.assign(window.__tkPages = window.__tkPages || {}, {
    "issues.list": (p, body, fn) => {
      stats(fn);
      const list = (rows[p.source] || []).filter((r) => !p.kind || r.kind === p.kind);
      return { ok: true, groups: groupsOf(list), rows: list };
    },
    "issues.get": (p, body, fn) => {
      stats(fn);
      const row = details[`${p.source}:${p.id}`];
      if (!row) return { ok: false, error: "not_found" };
      return { ok: true, row };
    },
    "issues.timeline": (p, body, fn) => {
      stats(fn);
      if (p.install !== INSTALL) return { ok: true, rows: [] };
      return { ok: true, rows: [
        { source: "telemetry", at: "2026-10-23T10:03:00+00:00", kind: "session", summary: "첫 화면 2.1초" },
        { source: "trace", at: "2026-10-23T10:08:00+00:00", kind: "run", summary: "Lv 12 · 245초" },
        { source: "crash", at: "2026-10-23T10:12:00+00:00", kind: "unclean_exit", summary: "signal 11" },
      ] };
    },
    "issues.asks": (p, body, fn) => { stats(fn); return { ok: true, total: asks.length, rows: asks }; },
  });
})();
