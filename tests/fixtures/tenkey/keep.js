// Local synthetic data only: the 데이터 보관 page's read (tenkey-console-stats "keep.get"). Every other page fills its "보관 N일"
// from the same answer. __mockKeepFail = the read fails (the pages must still render and point to the 데이터 보관 page).
(function () {
  // Relative to the browser's clock: the page marks a dataset whose oldest row is older than its days (+2) as not cleaned up.
  const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const rows = () => [
    { tbl: "tenkey.crash_reports", days: 60, note: "crash reports", rows: 412, bytes: 1835008, oldest: ago(58), last_purge_at: ago(0.4), last_removed: 37 },
    { tbl: "tenkey.crash_log_tail", days: 7, note: "log tails", rows: 51, bytes: 409600, oldest: ago(6), last_purge_at: ago(0.4), last_removed: 12 },
    { tbl: "tenkey.app_issues", days: 60, note: "app issues", rows: 230, bytes: 655360, oldest: ago(75), last_purge_at: null, last_removed: null },
    { tbl: "tenkey.issue_reports", days: 60, note: "inquiries", rows: 9, bytes: 24576, oldest: ago(20), last_purge_at: ago(0.4), last_removed: 0 },
    { tbl: "tenkey_private.telemetry", days: 60, note: "telemetry", rows: 3120, bytes: 7340032, oldest: ago(59), last_purge_at: ago(0.4), last_removed: 140 },
    { tbl: "tenkey_private.run_stats", days: 60, note: "run records", rows: 18200, bytes: 9437184, oldest: ago(60), last_purge_at: ago(0.4), last_removed: 905 },
    { tbl: "tenkey_private.run_trace", days: 60, note: "run timelines", rows: 7400, bytes: 20971520, oldest: ago(60), last_purge_at: ago(0.4), last_removed: 310 },
    { tbl: "tenkey_private.new_mystery", days: null, note: "새 표 (서버 설명)", rows: 3, bytes: null, oldest: null, last_purge_at: null, last_removed: null },
  ];
  Object.assign(window.__tkPages = window.__tkPages || {}, {
    "keep.get": (p, body, fn) => {
      if (fn !== "tenkey-console-stats") throw Object.assign(new Error("unknown_action"), { status: 400 });
      if (window.__mockKeepFail) throw Object.assign(new Error("console_request_failed"), { status: 500 });
      return { ok: true, rows: rows() };
    },
  });
})();
