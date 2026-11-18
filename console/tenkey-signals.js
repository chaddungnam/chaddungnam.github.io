// 10key Survival: the "웹 기록" panel of the player detail (owner 2026-11-18 TK-502: from a nickname to that player's issues).
// A signed-in web player (itch.io / Nekoland, terms agreed, not marked under 14; the web never asks the age) sends crash reports, app issue reports, the daily open ping,
// run records, run timelines and first-time steps with the account token; the server ties those rows to the account
// (player_id, set by the server only). tenkey-admin "players.signals" {player_id, days} -> admin_player_signals_v1 answers
// {ok, crashes[], issues[], runs[], traces[], steps[], pings[], asks[], counts{}} for the last 30 days, newest first, 50 rows each.
// Anonymous rows (signed out, under 14, the apps, GamePix) are never here: the 이슈함 still has them. Before the server has
// the read (the link1118 migration), the panel says so and the rest of the page works as before.
(function attachConsoleTenkeySignals(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const CRASH = { unclean_exit: "화면을 켠 채 꺼짐", anr_suspect: "멈춤 (5초 이상)", script_error: "스크립트 오류" };
  const ISSUE = { stall: "멈춤", hitch: "버벅임", server_error: "서버 응답 오류", save_issue: "저장 문제", memory_warning: "메모리 부족 경고",
    native_missing: "빠른 계산 부품 없음", suspect: "저장값 이상", ux_fail: "실패 문구가 뜸", script_error: "스크립트 오류" };
  const STEPS = { first_open: "처음 열기", title_shown: "타이틀 화면", first_run_start: "첫 판 시작", first_level_up: "첫 레벨 업",
    first_death: "첫 게임 오버", first_result_closed: "첫 결과 닫기", second_run_start: "두 번째 판 시작", revive: "첫 부활", demo_end: "체험판 끝" };
  const ENDS = { death: "게임 오버", quit: "스스로 그만둠", app_closed: "앱을 닫음", demo_end: "체험판 끝", clear: "노멀 모드 완주" };
  const ASK = { open: "열림", seen: "확인함", done: "고침" };
  const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const where = (p) => `${esc(platformName(String(p.platform || "").toLowerCase()))}<span class="tk-sub">${esc(dash(p.app_version))}</span>`;
  const table = (head, rows, empty) => rows.length
    ? `<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
    : `<p class="empty-panel">${esc(empty)}</p>`;
  const part = (title, count, body) => `<div class="tk-section"><h4>${esc(title)} <span class="panel-total">${esc(num(count))}건</span></h4>${body}</div>`;

  function markup(d) {
    const c = d.counts || {};
    const crashes = (d.crashes || []).map((r) => `<tr><td>${esc(time(r.received_at))}</td><td>${esc(CRASH[r.kind] || dash(r.kind))}</td><td class="tk-wrap">${esc(dash(r.where_at))}</td><td class="tk-num">${esc(num(r.repeats ?? 1))}</td><td>${where(r)}</td><td>${esc(dash(r.device_model))}</td></tr>`);
    const issues = (d.issues || []).map((r) => `<tr><td>${esc(time(r.received_at))}</td><td>${esc(ISSUE[r.kind] || dash(r.kind))}</td><td class="tk-wrap">${esc(dash(r.where_at))}${r.message ? `<span class="tk-sub">${esc(r.message)}</span>` : ""}</td><td class="tk-num">${esc(num(r.repeats ?? 1))}</td><td>${where(r)}</td><td><code>${esc(dash(r.install_short))}</code></td></tr>`);
    const runs = (d.runs || []).map((r) => `<tr><td>${esc(time(r.played_at))}</td><td>${esc(r.mode === "hard" ? "하드" : "노멀")}</td><td class="tk-num">${esc(r.level)}</td><td>${esc(duration(r.time_ms))}</td><td>${esc(r.cleared ? "클리어" : dash(r.cause))}</td><td>${where(r)}</td></tr>`);
    const traces = (d.traces || []).map((r) => `<tr><td>${esc(time(r.received_at))}</td><td>${esc(ENDS[r.end_kind] || dash(r.end_kind))}</td><td class="tk-num">${esc(r.lv)}</td><td>${esc(duration(r.ms))}</td><td>${esc(dash(r.cause))}</td><td class="tk-num">${esc(num(r.idle_n ?? 0))}</td><td>${where(r)}</td></tr>`);
    const steps = (d.steps || []).map((r) => `<tr><td>${esc(STEPS[r.step] || r.step)}</td><td>${esc(time(r.first_at))}</td><td class="tk-num">${esc(r.t_s == null ? "—" : `${num(r.t_s)}초`)}</td><td>${where(r)}</td></tr>`);
    const pings = (d.pings || []).map((r) => `<tr><td>${esc(r.day)}</td><td>${esc(time(r.first_at))}</td><td>${esc(time(r.last_at))}</td><td>${where(r)}</td><td><code>${esc(dash(r.install_short))}</code></td></tr>`);
    const asks = (d.asks || []).map((r) => `<tr><td>${esc(time(r.submitted_at))}</td><td>${esc(dash(r.kind))}</td><td>${esc(ASK[r.status] || dash(r.status))}</td></tr>`);
    return `<h3>웹 기록 (최근 ${esc(num(d.days || 30))}일)</h3>
      <p class="tk-sub">itch.io · 네코랜드 웹에서 약관에 동의하고 로그인한 플레이어가 보낸 기록만 이 플레이어에 붙습니다. 로그인 전, 14세 미만으로 표시된 계정, 앱, GamePix 기록은 이름 없이 이슈함에만 있습니다. 같은 오류가 하루 5번을 넘으면 횟수만 늘어납니다.</p>
      ${part("크래시", c.crashes ?? crashes.length, table(["받은 시각", "종류", "어디서", "횟수", "플랫폼 · 버전", "기기"], crashes, "크래시 보고가 없습니다."))}
      ${part("앱 이상", c.issues ?? issues.length, table(["받은 시각", "종류", "어디서 · 문구", "횟수", "플랫폼 · 버전", "기기 번호 앞자리"], issues, "앱 이상 보고가 없습니다."))}
      ${part("1대1 문의", c.asks ?? asks.length, table(["보낸 시각", "종류", "상태"], asks, "문의가 없습니다 (글은 이슈함 1대1 문의 탭에서 봅니다)."))}
      ${part("판 기록", c.runs ?? runs.length, table(["시각", "모드", "레벨", "시간", "끝난 이유", "플랫폼 · 버전"], runs, "판 기록이 없습니다."))}
      ${part("판 흐름", c.traces ?? traces.length, table(["받은 시각", "끝", "레벨", "시간", "원인", "멈춘 횟수", "플랫폼 · 버전"], traces, "판 흐름 기록이 없습니다."))}
      ${part("첫 단계", c.steps ?? steps.length, table(["단계", "처음 한 시각", "시작부터", "플랫폼 · 버전"], steps, "첫 단계 기록이 없습니다."))}
      ${part("접속한 날", c.pings ?? pings.length, table(["날짜", "처음", "마지막", "플랫폼 · 버전", "기기 번호 앞자리"], pings, "접속 기록이 없습니다."))}`;
  }

  async function load(player) {
    const host = document.getElementById("tenkeyPlayerSignals");
    if (!host || !player?.id) return;
    host.innerHTML = '<h3>웹 기록</h3><p class="empty-panel">웹 기록을 불러오는 중입니다...</p>';
    try {
      const result = await T.call("players.signals", { player_id: player.id, days: 30 });
      host.innerHTML = markup(result.data || {});
    } catch (error) {
      // T.call throws the server's code as the message. Before the link1118 migration / edge update the server has no
      // players.signals (unknown_action) or no admin_player_signals_v1 (rpc_failed): say so here and keep the page.
      const code = String(error?.message || "");
      const text = code === "not_found" ? "이 플레이어의 계정을 찾지 못했습니다."
        : ["unknown_action", "rpc_failed"].includes(code) ? "서버에 아직 이 기능이 없습니다 (웹 기록 연결이 서버에 올라간 뒤 보입니다)."
        : "웹 기록을 불러오지 못했습니다. 잠시 후 플레이어 상세를 새로고침해 주세요.";
      host.innerHTML = `<h3>웹 기록</h3><p class="empty-panel">${esc(text)}</p>`;
    }
  }

  T.signals = { load, markup };
})(window);
