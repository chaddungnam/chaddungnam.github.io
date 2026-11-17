// 10key Survival: 성능 (owner 2026-11-17: "극한 최적화"). What the phone apps measure each time they are opened (Telemetry, store
// builds during the test period; tenkey-console-stats "telemetry.get" {days, build} -> tenkey.admin_telemetry_v1): time to the first
// frame, the slowest frames per loading stage, the places frames went over 100 ms, the first-use hitches, the 2 s stalls (TelemetryData.STALL_MS: one frame of 2 s or more; the crash watchdog's 5 s is a separate thing) and the
// peak memory, by device model and by build. The web demo sends no telemetry: its hitches and stalls come as app_issues groups
// ("issues.list" {source: "app", kind: "hitch" | "stall"}). Review and INVINCIBLE sessions are never counted by the server.
(function attachConsoleTenkeyPerf(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, build: "" };
  const ms = (v) => (v === null || v === undefined || v === "" ? "—" : `${num(v)}ms`);
  const mb = (v) => (v === null || v === undefined || Number(v) <= 0 ? "—" : `${num(v)}MB`);
  const rowsOf = (list, heads, cells) => list.map((r) => `<tr>${cells(r).map(([v, numeric], i) => `<td data-label="${esc(heads[i])}"${numeric ? ' class="tk-num"' : ""}>${esc(v)}</td>`).join("")}</tr>`).join("");
  const table = (id, rows, heads, cells, empty) => { byId(id).innerHTML = rows.length ? rowsOf(rows, heads, cells) : `<tr><td colspan="${heads.length}" class="empty-panel">${esc(empty)}</td></tr>`; };
  const NONE = "이 기간에 받은 성능 보고가 없습니다.";
  // A place's time over all sessions runs to hours: "5시간 50분" reads at a glance where "350분 0초" does not.
  const long = (sec) => (sec == null ? "—" : Number(sec) >= 3600 ? `${Math.floor(Number(sec) / 3600)}시간 ${Math.floor((Number(sec) % 3600) / 60)}분` : duration(Number(sec) * 1000));

  function render(d) {
    const t = d.total || {};
    const set = (key, value) => { byId("tenkeyPerfSummary").querySelector(`[data-perf-summary="${key}"]`).textContent = value; };
    const n = Number(t.sessions || 0);
    set("sessions", num(n)); set("installs", num(t.installs));
    set("first", n ? `${ms(t.p50_first_frame_ms)} / ${ms(t.p90_first_frame_ms)}` : "—");
    set("stall", n ? `${num(t.sessions_with_stall)} · ${T.fmt.pct(t.sessions_with_stall, n)}` : "—");
    set("mem", n ? `${num(t.sessions_with_mem_warn)} · ${T.fmt.pct(t.sessions_with_mem_warn, n)}` : "—");
    set("peak", n ? `${mb(t.p50_peak_mb)} / ${mb(t.p90_peak_mb)}` : "—");
    table("tenkeyPerfDevices", d.devices || [], ["기기", "플랫폼", "세션", "첫 화면 (가운데)", "첫 화면 (느린 쪽 10%)", "세션당 100ms 넘은 프레임", "멈춘 세션", "메모리 경고 세션"],
      (r) => [[r.device_model || "—"], [platformName(r.platform)], [num(r.sessions), true], [ms(r.p50_first_frame_ms), true], [ms(r.p90_first_frame_ms), true], [num(r.frames_over_100_per_session), true], [num(r.stall_sessions), true], [num(r.mem_warn_sessions), true]], NONE);
    table("tenkeyPerfStages", d.stages || [], ["불러오는 단계", "세션", "켠 뒤 도착 (가운데)", "머문 시간 (가운데)", "가장 느린 프레임 (느린 쪽 10%)", "가장 느린 프레임"],
      (r) => [[r.stage || "—"], [num(r.sessions), true], [duration(r.p50_t_ms), true], [ms(r.p50_stay_ms), true], [ms(r.p90_max_frame_ms), true], [ms(r.max_frame_ms), true]], NONE);
    table("tenkeyPerfAreas", d.areas || [], ["곳", "세션", "머문 시간", "프레임", "100ms 넘음", "250ms 넘음", "1초 넘음", "가장 느린 프레임"],
      (r) => [[r.area || "—"], [num(r.sessions), true], [long(r.seconds), true], [num(r.frames), true], [num(r.over_100), true], [num(r.over_250), true], [num(r.over_1000), true], [ms(r.max_ms), true]], NONE);
    table("tenkeyPerfFirstUse", d.first_use || [], ["처음 쓸 때 걸린 곳", "횟수", "평균", "가장 길게", "셰이더 준비 뒤"],
      (r) => [[r.where || "—"], [num(r.times), true], [ms(r.avg_ms), true], [ms(r.max_ms), true], [num(r.after_pipeline_compile), true]], "처음 쓸 때 걸린 곳이 없습니다.");
    table("tenkeyPerfStalls", d.stalls || [], ["시각", "멈춘 시간", "단계", "곳", "기기", "앱 버전"],
      (r) => [[time(r.at)], [ms(r.ms), true], [r.stage || "—"], [r.where || "—"], [r.device_model || "—"], [r.app_version || "—"]], "이 기간에 2초 넘게 멈춘 세션이 없습니다.");
    table("tenkeyPerfBuilds", d.builds || [], ["빌드", "버전", "플랫폼", "세션"], (r) => [[`빌드 ${r.build}`], [r.version || "—"], [platformName(r.platform)], [num(r.sessions), true]], NONE);
    const builds = [...new Set((d.builds || []).map((b) => String(b.build)))];
    byId("tenkeyPerfBuild").innerHTML = ['<option value="">전체</option>', ...builds.map((b) => `<option value="${esc(b)}">빌드 ${esc(b)}</option>`)].join("");
    byId("tenkeyPerfBuild").value = builds.includes(state.build) ? state.build : "";
  }

  // The web demo (and the apps) report hitches and stalls through app_issues, grouped by where they happened.
  async function loadWeb(days) {
    for (const [kind, id] of [["hitch", "tenkeyPerfWebHitch"], ["stall", "tenkeyPerfWebStall"]]) {
      try {
        const data = await T.stats("issues.list", { days, source: "app", kind, limit: 50 });
        table(id, Array.isArray(data?.groups) ? data.groups : [], ["곳", "플랫폼", "횟수", "버전", "마지막"],
          (g) => [[g.where || "—"], [platformName(g.platform)], [num(g.n), true], [Array.isArray(g.versions) ? g.versions.join(", ") : g.versions || "—"], [time(g.last_at)]], kind === "hitch" ? "이 기간에 버벅임 보고가 없습니다." : "이 기간에 멈춤 보고가 없습니다.");
      } catch (error) {
        byId(id).innerHTML = `<tr><td colspan="5" class="empty-panel">${esc(T.errorText(error))}</td></tr>`;
      }
    }
  }

  async function load() {
    T.setMessage("tenkeyPerfMessage", "성능 보고를 불러오는 중입니다...");
    const days = Number(byId("tenkeyPerfDays").value) || 7;
    state.build = byId("tenkeyPerfBuild").value;
    T.fillKeep(byId("tenkeyPerfView"));
    loadWeb(days);
    try {
      render((await T.stats("telemetry.get", { days, build: state.build === "" ? undefined : Number(state.build) })) || {});
      T.setMessage("tenkeyPerfMessage", `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준 · 최근 ${days}일`);
    } catch (error) {
      render({});
      T.report("tenkeyPerfMessage", error);
    }
  }

  function mountPerf() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyPerfForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
    }
    load();
  }

  T.mountPerf = mountPerf;
})(window);
