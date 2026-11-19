// Local synthetic data only: the 밸런스 page's reads. tenkey-admin "balance.get" = admin_balance_v3 (the older server), and
// tenkey-console-stats "balance.v4" = the same keys plus the run-timeline tables (2026-11-17). Switches a test can set:
//   __mockNoV4      the stats function has no balance.v4 (unknown_action), so the page must fall back to balance.get
//   __mockV4NoEcho  v4 does not echo build / mode (a server that takes only days + platform): the page asks v3 for those
//   __mockV4Reach   v4 sends level times from the run timeline (reach_src "trace"), with one level that holds players long
//   __mockNoAcct    no run has sent its account growth yet (acct = [])
(function () {
  const { TODAY, dayAt } = window.__tkFx;
  const v3 = (p) => {
        if (window.__mockBalanceEmpty) return { ok: true, days: p.days, total: { runs: 0, installs: 0 }, levels: [], causes: [], forms: [], drift_levels: [], robot_levels: [], skills: [], encounters: [], daily: [], builds: [], knobs: [] };
        return { ok: true, days: p.days ?? 7, from: dayAt(6), today: TODAY, build: p.build ?? null, mode: p.mode ?? null,
          total: { runs: 240, installs: 31, median_ms: 252000, median_level: 18, avg_level: 19.6, drift: 84, robot: 30, robot_returned: 9, cleared: 4, revive_offered: 40, revived: 18, transformer_owned: 12 },
          levels: [{ lv: 3, n: 20 }, { lv: 8, n: 34 }, { lv: 12, n: 60 }, { lv: 14, n: 22 }, { lv: 18, n: 70 }, { lv: 26, n: 34 }],
          causes: [{ cause: "battery", n: 150, avg_level: 17.2 }, { cause: "mouse", n: 70, avg_level: 21.4 }, { cause: "wheel_mouse", n: 16, avg_level: 27 }, { cause: "clear", n: 4, avg_level: 40 }],
          forms: [{ form: "tenkey", n: 156 }, { form: "drift", n: 63 }, { form: "robot", n: 21 }],
          drift_levels: [{ lv: 10, n: 50 }, { lv: 11, n: 34 }], robot_levels: [{ lv: 20, n: 22 }, { lv: 22, n: 8 }],
          skills: [{ skill: "laser", kind: "n", picks: 190, runs: 170, avg_pick_level: 4.2, avg_end_level: 20.8 }, { skill: "drift", kind: "d", picks: 90, runs: 84, avg_pick_level: 10, avg_end_level: 24.1 },
            { skill: "laser", kind: "u", picks: 120, runs: 80, avg_pick_level: 9.5, avg_end_level: 22 }, { skill: "nitro", kind: "p", picks: 40, runs: 38, avg_pick_level: 12.3, avg_end_level: 25.5 }, { skill: "fever", kind: "f", picks: 30, runs: 24, avg_pick_level: 6, avg_end_level: 15 }],
          encounters: [{ id: "mouse", met: 260, won: 190, runs: 200 }, { id: "wheel_mouse", met: 30, won: 14, runs: 28 }, { id: "spacebar", met: 0, won: 0, runs: 0 }],
          daily: Array.from({ length: 7 }, (_, i) => ({ day: dayAt(6 - i), runs: 20 + i * 6, installs: 8 + i, avg_level: 18 + i / 2 })),
          builds: [{ build: 5, version: "1.0.1", runs: 200, avg_level: 20.1 }, { build: 2, version: "1.0.0", runs: 40, avg_level: 17.3 }],
          knobs: [{ kv: 0, runs: 240, avg_level: 19.6 }],
          // admin_balance_v3 (2026-11-12): window.__mockBalanceV1 = the older server without these keys; window.__mockHard = hard runs exist.
          ...(window.__mockBalanceV1 ? {} : {
            platform: p.platform ?? null,
            platforms: [{ platform: "android", runs: 140, installs: 20, drift: 0, avg_level: 6.1 }, { platform: "ios", runs: 30, installs: 5, drift: 0, avg_level: 5.2 }, { platform: "web_itch", runs: 70, installs: 40, drift: 8, avg_level: 9.4 }],
            modes: window.__mockHard ? [{ mode: "classic", runs: 230, installs: 31 }, { mode: "hard", runs: 10, installs: 2 }] : [{ mode: "classic", runs: 240, installs: 31 }],
            reach: window.__mockReach ? [{ lv: 2, n: 20, median_ms: 31000, p90_ms: 60000 }, { lv: 5, n: 18, median_ms: 150000, p90_ms: 260000 }] : [],
            times: { n: window.__mockReach ? 20 : 0, drift_ms: window.__mockReach ? 90000 : 0, robot_ms: 0 },
            trace: { runs: 60, installs: 25, with_form: 40,
              crises: [{ id: "numlock", runs: 55, n: 120 }, { id: "mouse", runs: 40, n: 66 }, { id: "spacebar", runs: 5, n: 5 }],
              cards: [{ kind: "d", offered: 12, won: 7, runs: 12 }, { kind: "f", offered: 20, won: 9, runs: 20 }, { kind: "t", offered: 4, won: 1, runs: 4 }],
              form_s: { drift: 21.5, robot: 3, fever: 7.5 } },
            hard: window.__mockHard
              ? { runs: 10, installs: 2, with_meter: window.__mockHardNoMeter ? 0 : 8,
                  bosses: [{ lv: 10, met: 6, won: 2, sec: 480 }, { lv: 20, met: 1, won: 0, sec: 90 }, { lv: 30, met: 0, won: 0, sec: 0 }],
                  meter: window.__mockHardNoMeter ? {} : { lb: [40, 10, 5, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0], ld: [0, 0, 8, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0], rb: [10, 4, 0, 0, 0, 0, 0, 0, 0, 0], rd: [0, 0, 0, 0, 0, 6], dm: [30, 0, 12], cl: [4, 3, 20, 40, 18] } }
              : { runs: 0, installs: 0, with_meter: 0, bosses: [], meter: {} } }) };
  };
  const v4 = (p, body, fn) => {
    if (fn !== "tenkey-console-stats" || window.__mockNoV4) throw Object.assign(new Error("unknown_action"), { status: 400 });
    const echo = window.__mockV4NoEcho ? { build: null, mode: null } : { build: p.build ?? null, mode: p.mode ?? null };
    const base = { ...v3(p), ...echo };
    if (window.__mockBalanceEmpty) return base;
    const reach = window.__mockV4Reach ? [[1, 0], [2, 20], [3, 45], [4, 70], [5, 100], [6, 400], [7, 430], [8, 470], [10, 560]].map(([lv, s], i) => ({ lv, n: 60 - i * 5, median_ms: s * 1000, p90_ms: s * 1500 })) : base.reach;
    return { ...base, reach, reach_src: window.__mockV4Reach ? "trace" : "stats",
      // the shapes tenkey.admin_balance_v4 answers (hexaworld 20261117130200): tables = whole tables, not this filter
      last_received_at: "2026-10-23T12:58:00+00:00",
      tables: { run_stats: { rows: 240, oldest: "2026-09-01", last_received_at: "2026-10-23T12:58:00+00:00" }, run_trace: { rows: 60, oldest: "2026-09-02", last_received_at: "2026-10-23T12:40:00+00:00" },
        funnel: { rows: 30, oldest: "2026-09-01", last_received_at: "2026-10-23T12:00:00+00:00" } },
      acct: window.__mockNoAcct ? [{ band: "none", runs: 60, avg_lv: 9.1, median_ms: 180000 }] : [{ band: "none", runs: 12, avg_lv: 7, median_ms: 120000 },
        { band: "0", runs: 90, avg_lv: 10.2, median_ms: 150000 }, { band: "10-24", runs: 100, avg_lv: 19, median_ms: 260000 }, { band: "160+", runs: 50, avg_lv: 28.4, median_ms: 420000 }],
      bands: [{ band: 0, runs: 60, secs: 95, keys: 42, dmg: 31, revives: 2 }, { band: 1, runs: 48, secs: 160, keys: 80, dmg: 45, revives: 6 },
        { band: 2, runs: 30, secs: 140, keys: 70, dmg: 52, revives: 5 }, { band: 3, runs: 12, secs: 260, keys: 120, dmg: 60, revives: 3 }, { band: 4, runs: 4, secs: 80, keys: 30, dmg: 70, revives: 0 }],
      offers: [{ skill: "laser", offered: 300, picked: 190, pick_rate: 0.633 }, { skill: "eco", offered: 120, picked: 9, pick_rate: 0.075 }, { skill: "bomb", offered: 6, picked: 0, pick_rate: 0 }],
      idle: { runs: 60, with_idle: 40, avg_n: 1.4, p50_longest_s: 14, p90_longest_s: 40, avg_total_s: 22, idle_share_pct: 12.5, long_idle_runs: 9 },
      counters: { keys_broken: 9000, numlock_caught: 66, life_hurt: 1200, mystery_x: 3 }, counter_runs: 60 };
  };
  // tenkey-console-stats "balance.god" = tenkey.admin_god_runs_v1 (hexaworld 20261119150000, godlab1119): the INVINCIBLE test runs.
  //   __mockNoGod     the stats function has no balance.god yet (unknown_action): the section stays hidden
  //   __mockGodEmpty  no god run in the period
  const god = (p, body, fn) => {
    if (fn !== "tenkey-console-stats" || window.__mockNoGod) throw Object.assign(new Error("unknown_action"), { status: 400 });
    if (window.__mockGodEmpty) return { ok: true, days: p.days ?? 7, total: 0, presets: [], rows: [] };
    return { ok: true, days: p.days ?? 7, total: 3,
      presets: [{ up: 70, mod: 50, runs: 2, avg_level: 14.5, max_level: 17, died: 2, die_level_p50: 9, die_sec_avg: 215 },
        { up: 0, mod: 0, runs: 1, avg_level: 21, max_level: 21, died: 0, die_level_p50: null, die_sec_avg: null }],
      rows: [
        { at: "2026-11-19T14:11:15+00:00", name: "이리오너라", platform: "ios", build: 25, up: 70, mod: 50, level: 17, st: 1, sec: 610, cause: "quit", clear: false, form: "robot",
          die_level: 9, die_sec: 201, die_cause: "mouse", die_form: "drift", deaths: [[9, 201, "mouse", "drift"], [12, 330, "durability", "robot"]], ret: [[10, 240]], rb: [[13, 400]], floor_pts: 812, shadow_left: 0 },
        { at: "2026-11-19T13:58:05+00:00", name: "이리오너라", platform: "ios", build: 25, up: 70, mod: 50, level: 12, st: 1, sec: 420, cause: "quit", clear: false, form: "drift",
          die_level: 10, die_sec: 229, die_cause: "durability", die_form: "tenkey", deaths: [[10, 229, "durability", "tenkey"]], ret: [], rb: [], floor_pts: 120, shadow_left: 40 },
        { at: "2026-11-19T13:40:00+00:00", name: "이리오너라", platform: "ios", build: 25, up: 0, mod: 0, level: 21, st: 1, sec: 900, cause: "clear", clear: true, form: "robot",
          die_level: null, die_sec: null, die_cause: null, die_form: null, deaths: [], ret: [], rb: [], floor_pts: 0, shadow_left: 88 }] };
  };
  Object.assign(window.__tkPages = window.__tkPages || {}, { "balance.get": (p) => v3(p), "balance.v4": v4, "balance.god": god });
})();
