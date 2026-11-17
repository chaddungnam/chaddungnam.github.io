// Local synthetic data only (never real players or devices): the 이슈함 page's reads on tenkey-console-stats, with both shapes the
// server holds: rows from builds that send the run / save / steps (new) and rows from older builds that do not (old, '—').
//   issues.list {days, source: crash|app, kind?, limit} -> {groups, rows}   issues.get {source, id} -> {row}
//   issues.timeline {source, id, minutes} -> {by, rows:[{t, source, self}]}  issues.asks {days} -> {rows} (inquiries, ctx on new rows)
// Shapes as tenkey.admin_issue_*_v1 answers them (hexaworld 20261117130100): groups {n = times}, rows {count, device_model}, one
// report {install_short (8 characters, never the whole install id), detail}, timeline rows {t, source, ...per source}.
// fw8 처리 상태 (admin_issue_list_v2 / admin_issue_reports_v3, hexaworld 20261117140000): every crash / app group carries {sig, triage}
// (null = never marked), every inquiry row {triage}; tenkey-admin "issues.mark" changes them for the page's life. One fixed group
// came back (anr_suspect, fixed in build 2, a build-2 report after it), one app group is 확인함, the rest are 열림.
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
  const sigOf = (source, kind, platform, where) => `${source}:${kind}:${platform || ""}:${where || ""}`;   // the server's is md5 hex
  const MARK_AT = "2026-10-22T08:00:00+00:00";
  const marks = {
    [sigOf("crash", "anr_suspect", "android", "")]: { status: "fixed", fixed_in_build: 2, note: "부팅 대기 줄임", by: "ops@houseduck.in", at: MARK_AT, rows_after: 1, rows_fixed_build: 1, back: true },
    [sigOf("app", "stall", "web_itch", "home_load")]: { status: "seen", fixed_in_build: null, note: "", by: "ops@houseduck.in", at: MARK_AT, rows_after: 1, rows_fixed_build: null, back: false },
  };
  const groupsOf = (list) => {
    const out = new Map();
    for (const r of list) {
      const key = `${r.kind}|${r.where || ""}`;
      const sig = sigOf(r.source, r.kind, r.platform, r.where);
      const g = out.get(key) || { source: r.source, kind: r.kind, where: r.where, platform: r.platform, n: 0, last_at: r.at, versions: [], sig, triage: marks[sig] || null };
      g.n += r.count || 1;
      g.times = g.n;
      if (!g.versions.includes(r.app_version)) g.versions.push(r.app_version);
      out.set(key, g);
    }
    return [...out.values()];
  };
  const details = {
    "crash:41": { ...rows.crash[0], os_version: "14", locale: "ko_KR", install_short: INSTALL.slice(0, 8), log_tail: "Godot Engine v4.7.2.stable.official\nhandle_crash: Program crashed with signal 11",
      detail: { run: RUN, save: SAVE, sid: "s-7f3a", trace: "tr-91c2", trail: TRAIL, uptime_s: 245 } },
    "crash:39": { ...rows.crash[1], os_version: "13", locale: "ko_KR", detail: {} },
    "app:501": { ...rows.app[0], install_short: null, detail: { run: { seed: 4455, mode: "classic", lv: 6, t: 88, start_lv: 1, form: "tenkey", demo: true }, trail: ["0 start Web 1.0.3", "12 scene DigScene", "80 lvup 6", "88 pop+ level_up"] } },
    "app:502": { ...rows.app[1], detail: {} },
    "app:500": { ...rows.app[2], detail: { trail: ["0 start iOS 1.0.0", "5 scene DigScene"] } },
  };
  const asks = [
    { receipt: "c0ffee01", submitted_at: "2026-10-23T11:00:00+00:00", body: "보스 앞에서 화면이 멈췄어요", meta: { version: "1.0.3", build: "41", platform: "android", device: "SM-S918N", locale: "ko" },
      email: "player+qa@example.com", status: "open", player_id: "a1111111-1111-4111-8111-111111111111", display_name: "딸깍덕", public_id: "TK7Q2",
      ctx: { sid: "s-7f3a", steps: ["30 scene DigScene", "40 lvup 2", "41 pick laser", "60 pop+ contact"], run: RUN, save: SAVE } },
    { receipt: "c0ffee00", submitted_at: "2026-10-20T09:00:00+00:00", body: "old build text", meta: { locale: "ja" }, status: "open", player_id: null },
  ];
  for (const a of asks) a.triage = null;
  // tenkey-admin issues.mark: the same checks the edge function makes first (source, status, build, note, reason, a request id).
  const mark = (p, body, fn) => {
    if (fn !== "tenkey-admin") throw Object.assign(new Error("unknown_action"), { status: 400 });
    if (!/^[0-9a-f-]{36}$/.test(String(body.request_id || ""))) throw Object.assign(new Error("invalid_request_id"), { status: 400 });
    if (!String(p.reason || "").trim()) throw Object.assign(new Error("reason_required"), { status: 400 });
    if (!["open", "seen", "fixed"].includes(p.status)) throw Object.assign(new Error("invalid_status"), { status: 400 });
    if (p.build !== null && p.build !== undefined && !(Number.isInteger(p.build) && p.build >= 1 && p.build <= 999999999)) throw Object.assign(new Error("invalid_build"), { status: 400 });
    const next = { status: p.status, fixed_in_build: p.status === "fixed" ? p.build ?? null : null, note: String(p.note || "").trim() };
    const same = (t) => (t?.status || "open") === next.status && (t?.fixed_in_build ?? null) === next.fixed_in_build && (t?.note || "") === next.note;
    if (p.source === "ask") {
      const a = asks.find((x) => x.receipt === p.receipt);
      if (!a) return { ok: false, error: "not_found" };
      if (same(a.triage)) return { ok: true, changed: false, triage: a.triage };
      a.triage = { ...next, by: "qa@houseduck.in", at: new Date().toISOString() };
      a.status = p.status === "fixed" ? "done" : p.status;
      return { ok: true, changed: true, source: "ask", triage: a.triage };
    }
    const sig = sigOf(p.source, p.kind, p.platform, p.where);
    if (!(rows[p.source] || []).some((r) => sigOf(r.source, r.kind, r.platform, r.where) === sig)) return { ok: false, error: "not_found" };
    if (same(marks[sig])) return { ok: true, changed: false, triage: marks[sig] };
    marks[sig] = { ...next, by: "qa@houseduck.in", at: new Date().toISOString(), rows_after: 0, rows_fixed_build: next.fixed_in_build ? 0 : null, back: false };
    return { ok: true, changed: true, source: p.source, signature: sig, triage: marks[sig] };
  };
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
      const r = details[`${p.source}:${p.id}`];
      if (!r) return { ok: false, error: "not_found" };
      const self = { t: r.at, source: p.source, id: r.id, kind: r.kind, where: r.where, said: r.said, app_version: r.app_version, self: true };
      if (!r.install_short) return { ok: true, source: p.source, id: r.id, at: r.at, minutes: p.minutes, by: "none", rows: [self] };
      return { ok: true, source: p.source, id: r.id, at: r.at, minutes: p.minutes, by: "install", rows: [
        { t: "2026-10-23T10:05:00+00:00", source: "telemetry", id: "f6666666-6666-4666-8666-666666666666", start: "2026-10-23T10:01:00+00:00", seq: 3, up_s: 240,
          max_frame_ms: 480, hitch_n: 2, stall_n: 0, net_fail_n: 0, mem_warn_n: 0, app_version: "1.0.3 a41" },
        { t: "2026-10-23T10:11:30+00:00", source: "trace", id: "c3333333-3333-4333-8333-333333333333", start: "2026-10-23T10:07:25+00:00", mode: "classic",
          end_kind: "death", cause: "durability", lv: 12, ms: 245000, app_version: "1.0.3 a41" },
        self,
      ] };
    },
    "issues.asks": (p, body, fn) => { stats(fn); return { ok: true, total: asks.length, rows: asks }; },
    "issues.mark": mark,
  });
})();
