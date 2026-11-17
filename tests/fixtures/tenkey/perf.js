// Local synthetic data only: the 성능 page's read (tenkey-console-stats "telemetry.get" {days, build} = tenkey.admin_telemetry_v1's
// answer shape). __mockPerfEmpty = no session in the window.
(function () {
  const answer = (p) => (window.__mockPerfEmpty
    ? { ok: true, days: p.days, build: p.build ?? null, total: { sessions: 0, installs: 0 }, devices: [], stages: [], areas: [], first_use: [], stalls: [], net: [], buy: [], builds: [] }
    : { ok: true, days: p.days ?? 7, from: "2026-10-17", build: p.build ?? null,
      total: { sessions: 140, installs: 38, median_up_s: 610, p50_first_frame_ms: 2100, p90_first_frame_ms: 4800, sessions_with_stall: 6, sessions_with_mem_warn: 3, p50_peak_mb: 410, p90_peak_mb: 690, peak_sessions: 96 },
      devices: [{ device_model: "SM-S918N", platform: "android", sessions: 60, p50_first_frame_ms: 1700, p90_first_frame_ms: 2600, frames_over_100_per_session: 1.4, stall_sessions: 1, mem_warn_sessions: 0 },
        { device_model: "SM-A135F", platform: "android", sessions: 30, p50_first_frame_ms: 3900, p90_first_frame_ms: 6100, frames_over_100_per_session: 9.2, stall_sessions: 4, mem_warn_sessions: 3 },
        { device_model: "iPhone14,5", platform: "ios", sessions: 50, p50_first_frame_ms: 1500, p90_first_frame_ms: 2200, frames_over_100_per_session: 0.6, stall_sessions: 1, mem_warn_sessions: 0 }],
      stages: [{ stage: "boot", sessions: 140, p50_t_ms: 0, p90_t_ms: 0, p50_stay_ms: 900, p90_stay_ms: 1600, p90_max_frame_ms: 320, max_frame_ms: 1200 },
        { stage: "home", sessions: 138, p50_t_ms: 2100, p90_t_ms: 4800, p50_stay_ms: 30000, p90_stay_ms: 90000, p90_max_frame_ms: 140, max_frame_ms: 480 }],
      areas: [{ area: "run", sessions: 120, seconds: 21000, frames: 1260000, over_100: 340, over_250: 41, over_1000: 2, max_ms: 1450 },
        { area: "home", sessions: 138, seconds: 6000, frames: 360000, over_100: 25, over_250: 3, over_1000: 0, max_ms: 410 }],
      first_use: [{ where: "fx_level_aura", times: 80, avg_ms: 180, max_ms: 620, after_pipeline_compile: 12 }],
      stalls: [{ ms: 5400, stage: "run", where: "boss_intro", device_model: "SM-A135F", app_version: "1.0.3", at: "2026-10-23T10:00:00+00:00" }],
      net: [], buy: [],
      builds: [{ build: 41, version: "1.0.3", platform: "android", sessions: 90 }, { build: 41, version: "1.0.3", platform: "ios", sessions: 40 }, { build: 22, version: "1.0.0", platform: "ios", sessions: 10 }] });
  Object.assign(window.__tkPages = window.__tkPages || {}, {
    "telemetry.get": (p, body, fn) => {
      if (fn !== "tenkey-console-stats") throw Object.assign(new Error("unknown_action"), { status: 400 });
      return answer(p);
    },
  });
})();
