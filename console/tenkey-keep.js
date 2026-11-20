// 10key Survival: 데이터 보관 (owner 2026-11-17: "서버는 필요한 것만 받고, 데이터는 2달마다 삭제 ... 콘솔 사이트에서 이 모든 걸 투명하게
// 볼 수 있게"). One row per dataset the game server keeps: what it holds in plain words, which builds send it, how many days it is
// kept, rows now, size, the oldest row, the last cleanup and how many rows that cleanup removed. Read-only: tenkey-console-stats
// "keep.get" -> {rows: [{tbl, days, note, rows, bytes, oldest, last_purge_at, last_removed}]}.
// The same answer fills every "보관 N일" on the other pages (T.fillKeep: elements with data-tk-keep="<tbl>[|<tbl>...]"), so no page
// writes a retention number of its own.
(function attachConsoleTenkeyKeep(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, bytes } = T.fmt;
  const byId = (id) => document.getElementById(id);
  // Who sends what, from the client code (CrashWatch / IssueReport.wanted, TenkeyOps, TenkeyWebStats, RunTrace, Telemetry):
  // never GamePix, the editor or a debug build; INVINCIBLE and 관리자 실험 모드 runs are left out. Nekoland sends what itch
  // sends since 11-18 (owner TK-502, 10key WebSignalsData.LISTED; a signed-in web player's rows carry the account).
  const APP_ITCH = "스토어 앱(Android·iOS)과 웹 체험판(itch·네코랜드)의 정식 빌드. GamePix·에디터·디버그 빌드는 보내지 않음";
  const SETS = {
    crash_reports: ["크래시 보고", "앱이 켜진 채 꺼졌거나 5초 넘게 멈췄거나 스크립트 오류가 났을 때의 보고: 오류 줄, 앱 버전, 기기, 앱이 남긴 순서", APP_ITCH],
    crash_log_tail: ["크래시 로그", "크래시 보고에 붙는 Godot 로그 끝부분 (보고보다 먼저 지움)", APP_ITCH],
    app_issues: ["앱 이상 보고", "버벅임·멈춤·스크립트 오류를 같은 곳끼리 묶은 보고: 어디서, 몇 번, 그때의 판 번호", APP_ITCH],
    issue_reports: ["1대1 문의", "플레이어가 게임 설정 「1대1 문의하기」로 보낸 글과 답장 이메일, 보낼 때의 앱 순서", "로그인한 앱·itch·네코랜드 계정만. GamePix 웹, 14세 미만, 약관에 동의하지 않은 플레이어는 보내지 않음"],
    telemetry: ["성능 보고", "한 번 켤 때의 첫 화면까지 시간, 가장 느린 프레임, 버벅인 곳, 메모리", "스토어 앱(Android·iOS) 정식 빌드, 테스트 기간 동안만. 웹·GamePix·네코랜드는 보내지 않음"],
    run_stats: ["판 기록", "판이 끝날 때마다의 짧은 기록: 끝난 레벨·시간·이유, 고른 카드, 만난 적. 앱은 기기마다 무작위 번호뿐 · 웹 체험판은 로그인한 플레이어의 판에 계정이 붙음", "스토어 앱과 웹 체험판(itch·네코랜드). 무적 모드·관리자 실험 모드 판은 빼고 받음"],
    run_trace: ["판 흐름 기록", "한 판의 시간 흐름: 레벨업 시각, 위기, 나온 카드와 고른 카드, 레벨 구간별 시간", "스토어 앱과 웹 체험판(itch·네코랜드). 무적 계정의 판은 서버가 버림"],
    funnel: ["첫 플레이 단계", "처음 하는 사람이 어느 단계까지 갔는지", "스토어 앱과 웹 체험판(itch·네코랜드)"],
    god_runs: ["무적 테스트 판", "무적 계정이 노멀 모드에서 한 판의 밸런스 기록", "무적 계정만 (플레이어 기록과 따로 보관)"],
    report_trash: ["옮겨 둔 옛 보고", "11월 이전 크래시 보고와 판 기록을 옆으로 옮겨 둔 것", "새로 들어오지 않음"],
    rank_trash: ["옮겨 둔 옛 랭킹", "11월 이전 랭킹 기록을 옆으로 옮겨 둔 것", "새로 들어오지 않음"],
  };
  const LOG = ["crash_log_tail", "crash_reports.log_tail", "crash_log", "crash_logs"];
  const tblName = (tbl) => String(tbl || "").replace(/^tenkey(_private)?\./, "");
  const setOf = (tbl) => SETS[tblName(tbl)] || (LOG.includes(tblName(tbl)) ? SETS.crash_log_tail : null);
  let cache = null;

  // keep.get once per page load (the 데이터 보관 page reads it fresh); a failed read is not kept.
  function keepRows(fresh = false) {
    if (fresh || !cache) cache = T.stats("keep.get", {}).then((d) => (Array.isArray(d?.rows) ? d.rows : [])).catch((error) => { cache = null; throw error; });
    return cache;
  }
  const findRow = (rows, names) => names.map((n) => rows.find((r) => tblName(r.tbl) === n)).find(Boolean);
  const daysText = (row) => (row && Number(row.days) > 0 ? `${num(row.days)}일` : "—");
  // "N일" for the first of `names` the server lists, "—" when none is listed; null when keep.get cannot be read.
  async function keepText(names) {
    try { return daysText(findRow(await keepRows(), [].concat(names).map(tblName))); } catch (_error) { return null; }
  }
  async function fillKeep(scope = document) {
    const els = [...scope.querySelectorAll("[data-tk-keep]")];
    if (!els.length) return;
    let rows = null;
    try { rows = await keepRows(); } catch (_error) { rows = null; }
    for (const el of els) {
      const names = el.dataset.tkKeep.split("|").map(tblName);
      if (rows) el.textContent = daysText(findRow(rows, names.flatMap((n) => (n === "crash_log_tail" ? LOG : [n]))));
      else el.innerHTML = '—<a class="tk-keep-miss" href="#/tenkey-keep">(데이터 보관 화면)</a>';
    }
  }

  function keepRow(r) {
    const set = setOf(r.tbl);
    const late = Number(r.days) > 0 && r.oldest && (Date.now() - Date.parse(r.oldest)) / 86400000 > Number(r.days) + 2;
    return `<tr><td class="tk-wrap" data-label="데이터"><strong>${esc(set ? set[0] : tblName(r.tbl))}</strong><span class="tk-sub">${esc(set ? set[1] : r.note || "—")}</span><code class="tk-sub">${esc(r.tbl)}</code></td>`
      + `<td class="tk-wrap" data-label="보내는 곳">${esc(set ? set[2] : "—")}</td>`
      + `<td class="tk-num" data-label="보관"><strong>${esc(daysText(r))}</strong></td><td class="tk-num" data-label="줄 수">${esc(num(r.rows))}</td><td class="tk-num" data-label="크기">${esc(r.bytes == null ? "—" : bytes(r.bytes))}</td>`
      + `<td data-label="가장 오래된 줄">${esc(time(r.oldest))}${late ? '<span class="tk-badge" data-tone="risk">보관 기간보다 오래된 줄 있음</span>' : ""}</td>`
      + `<td data-label="마지막 정리">${esc(r.last_purge_at ? time(r.last_purge_at) : "아직 없음")}</td><td class="tk-num" data-label="지운 줄">${esc(r.last_purge_at ? num(r.last_removed) : "—")}</td></tr>`;
  }

  async function load() {
    T.setMessage("tenkeyKeepMessage", "보관 현황을 불러오는 중입니다...");
    const set = (key, value) => { byId("tenkeyKeepSummary").querySelector(`[data-keep-summary="${key}"]`).textContent = value; };
    try {
      const rows = await keepRows(true);
      byId("tenkeyKeepTable").innerHTML = rows.length ? rows.map(keepRow).join("") : '<tr><td colspan="8" class="empty-panel">서버가 보관 현황을 보내지 않았습니다.</td></tr>';
      byId("tenkeyKeepTotal").textContent = `${num(rows.length)}종류`;
      const sum = (k) => rows.filter((r) => !LOG.includes(tblName(r.tbl))).reduce((s, r) => s + (Number(r[k]) || 0), 0);  // the log row is part of crash_reports: counted once
      const purged = rows.map((r) => r.last_purge_at).filter(Boolean).sort().at(-1);
      set("sets", num(rows.length)); set("rows", num(sum("rows"))); set("bytes", bytes(sum("bytes"))); set("purge", purged ? time(purged) : "아직 없음");
      T.setMessage("tenkeyKeepMessage", `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준 · 서버 값`);
    } catch (error) {
      byId("tenkeyKeepTable").innerHTML = '<tr><td colspan="8" class="empty-panel">보관 현황을 읽지 못했습니다.</td></tr>';
      for (const k of ["sets", "rows", "bytes", "purge"]) set(k, "—");
      T.report("tenkeyKeepMessage", error);
    }
  }

  Object.assign(T, { mountKeep: load, keepRows, keepText, fillKeep, KEEP_LOG: LOG });
})(window);
