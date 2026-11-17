// 10key Survival: 이슈함 (owner 2026-11-17: "서버로 이슈를 받되 재현 절차까지 알 수 있게"). Three tabs, one flow each: groups -> list ->
// one report. 크래시 (crash_reports) and 앱 이상 (app_issues) read tenkey-console-stats "issues.list" {days, source, kind, limit} ->
// {groups, rows} and "issues.get" {source, id} -> {row}; 1대1 문의 reads "issues.asks" {days} -> {rows} (inquiry rows with ctx).
// One report shows the app's own steps before it as numbered lines ("<seconds> <what>", the game's CrashTrail), the run it was
// in as "이 판 다시 만들기: seed … (QA_WORLD_SEED)", the save it had, and on request the same device's other records from ten
// minutes before to ten after ("issues.timeline" {source, id, minutes}: the server finds the device or the launch itself and
// answers {by, rows:[{t, source, self, ...}]}). Reports from builds before these fields read '—'.
// 처리 상태 (fw8): a crash / app group (kind + platform + place, as the server groups them) or one inquiry is 열림 / 확인함 / 고침
// (+ the build that fixed it, a note). tenkey-admin "issues.mark" {source, kind, where, platform | receipt, status, build, note,
// reason} writes it after the confirm dialog, audited like a ban. issues.list groups carry {sig, triage} and issues.asks rows
// {triage} from the fw8 server (admin_issue_list_v2 / admin_issue_reports_v3); without them (the server before fw8) the state
// column reads '—', no mark form shows, and the rest of the page works as before.
(function attachConsoleTenkeyIssues(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const KINDS = { unclean_exit: "화면을 켠 채 꺼짐", anr_suspect: "멈춤 (5초 이상)", script_error: "스크립트 오류", stall: "멈춤", hitch: "버벅임",
    server_error: "서버 응답 오류", save_issue: "저장 문제", native_missing: "빠른 계산 부품 없음 (느린 예비 코드로 돌아감)", memory_warning: "메모리 부족 경고",
    suspect: "저장값 이상 (음수가 된 값)" };
  const ENDS = { death: "게임 오버", quit: "스스로 그만둠", app_closed: "앱을 닫음", demo_end: "체험판 끝", clear: "노멀 모드 완주" };  // the 밸런스 page's words
  const CAUSES = { battery: "배터리 방전", mouse: "마우스 포획", durability: "텐키 파손", spacebar: "스페이스바에 깔림", wheel_mouse: "휠 마우스에 치임" };
  const SOURCES = { crash: "크래시", app: "앱 이상", ask: "1대1 문의", trace: "판 흐름", telemetry: "성능 보고" };
  const MODES = { classic: "노멀 모드", normal: "노멀 모드", hard: "하드 모드" };
  const FORMS = { tenkey: "텐키 그대로", drift: "DRIFT", robot: "로봇" };
  const KEEP = {
    crash: 'crash_reports에 <span data-tk-keep="crash_reports">—</span>, 로그는 <span data-tk-keep="crash_log_tail">—</span> 보관',
    app: 'app_issues에 <span data-tk-keep="app_issues">—</span> 보관',
    ask: '글과 답장 이메일은 <span data-tk-keep="issue_reports">—</span> 보관',
  };
  const WHO = {
    crash: "스토어 앱과 웹 체험판(itch) 정식 빌드가 보냅니다. 같은 오류는 하루 5건까지만 줄로 남고 그 뒤는 횟수만 늘어납니다.",
    app: "버벅임·멈춤·스크립트 오류를 같은 곳끼리 묶어 보냅니다 (스토어 앱과 웹 체험판). 버벅임과 멈춤은 「성능」 화면에도 나옵니다.",
    ask: "로그인한 앱·itch 계정만 보냅니다 (GamePix·Nekoland 웹, 14세 미만, 약관 미동의는 보내지 않음). 이 빌드부터 보낼 때의 앱 순서와 판·저장 상태가 붙습니다.",
  };
  const STATUS = { open: "열림", seen: "확인함", fixed: "고침" };
  const STATUS_LONG = { open: "열림 (아직 안 봄)", seen: "확인함 (보는 중)", fixed: "고침" };
  const ASK_STATUS = { open: "open", seen: "seen", done: "fixed" };   // issue_reports.status -> the mark's word (고침 = done)
  const state = { bound: false, tab: "crash", groups: [], rows: [], pick: null, open: null };
  const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const kindName = (k) => KINDS[k] || dash(k);
  const groupKey = (g) => `${g.kind || ""}|${g.where || ""}`;
  const picked = () => (state.tab !== "ask" && state.pick !== null ? state.groups[state.pick] || null : null);
  // One state badge: 열림 (gold: nobody looked yet), 확인함 (grey), 고침 (teal, with its build), and a red "고친 뒤 다시 N건" when a
  // fixed group came back (rows from the fixed build or later; rows after the mark when the fix named no build).
  function stateBadge(t, base = "open") {
    const s = t?.status || base;
    const label = s === "fixed" && t?.fixed_in_build ? `고침 · 빌드 ${t.fixed_in_build}` : STATUS[s] || dash(s);
    const back = t?.back ? ` <span class="tk-badge" data-tone="risk">고친 뒤 다시 ${esc(num(t.fixed_in_build ? t.rows_fixed_build : t.rows_after))}건</span>` : "";
    return `<span class="tk-badge" data-tone="${s === "fixed" ? "good" : s === "seen" ? "quiet" : "watch"}">${esc(label)}</span>${back}`;
  }
  const facts = (items) => `<dl class="tk-detail-grid">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(dash(v))}</dd></div>`).join("")}</dl>`;
  const appText = (version, build) => [version ? `v${version}` : "", build ? `빌드 ${build}` : ""].filter(Boolean).join(" · ") || "—";

  // One trail line: "<seconds since start> <what>" (CrashTrail). The step codes the game writes are put in words; the code stays under it.
  function stepText(what) {
    const [code, ...rest] = what.split(" ");
    const arg = rest.join(" ");
    const names = T.gameNames || {};
    const words = {
      pick: () => `레벨업 카드 고름: ${names.cards?.[arg] || arg}`, lvup: () => `레벨 ${arg} 도달`, revive: () => "부활", cage: () => "NUM LOCK 철창에 갇힘",
      crisis: () => `위기 시작: ${names.crises?.[arg] || arg}`, "pop+": () => `팝업 열림: ${arg}`, "pop-": () => `팝업 닫힘: ${arg}`,
      scene: () => `화면: ${arg}`, start: () => `앱 시작: ${arg}`, bg: () => "앱이 뒤로 감", fg: () => "앱으로 돌아옴",
    };
    return words[code] ? words[code]() : null;
  }
  function steps(lines, title) {
    if (!Array.isArray(lines) || !lines.length) return `<div class="tk-section"><h3>${esc(title)}</h3><p class="empty-panel">— (이 보고를 보낸 빌드는 앱 순서를 보내지 않았습니다)</p></div>`;
    const items = lines.map((raw) => {
      const line = String(raw ?? "");
      const m = /^(\d+(?:\.\d+)?)\s+(.*)$/.exec(line);
      const what = m ? m[2] : line;
      const words = stepText(what);
      return `<li>${m ? `<span class="tk-step-at">${esc(m[1])}초</span> ` : ""}${esc(words || what)}${words ? ` <code class="tk-sub">${esc(what)}</code>` : ""}</li>`;
    });
    return `<div class="tk-section"><h3>${esc(title)} (오래된 것부터 ${lines.length}단계)</h3><ol class="tk-trail tk-steps">${items.join("")}</ol></div>`;
  }
  // The run the report came from: its seed rebuilds the same world in QA (QA_WORLD_SEED), with the level / time / mode it was at.
  function runBox(run) {
    if (!run || typeof run !== "object" || run.seed === undefined || run.seed === null) return '<div class="tk-section"><h3>이 판 다시 만들기</h3><p class="empty-panel">— (판 밖에서 났거나, 판 번호를 보내지 않은 빌드입니다)</p></div>';
    return `<div class="tk-section"><h3>이 판 다시 만들기</h3><p class="tk-repro">이 판 다시 만들기: seed <code>${esc(run.seed)}</code> (QA_WORLD_SEED)</p>${facts([
      ["모드", MODES[run.mode] || run.mode], ["그때 레벨", run.lv != null ? `Lv ${run.lv}` : null], ["판 시작 뒤", run.t != null ? `${num(run.t)}초` : null],
      ["시작 레벨", run.start_lv != null ? `Lv ${run.start_lv}` : null], ["모습", FORMS[run.form] || run.form], ["체험판", run.demo === undefined ? null : run.demo ? "예 (웹 체험판)" : "아니오"],
    ])}</div>`;
  }
  function saveBox(save) {
    if (!save || typeof save !== "object") return '<div class="tk-section"><h3>저장 상태</h3><p class="empty-panel">—</p></div>';
    return `<div class="tk-section"><h3>저장 상태</h3>${facts([["저장 형식", save.schema], ["끝낸 판", num(save.runs)], ["최고 레벨", save.best_lv != null ? `Lv ${save.best_lv}` : null],
      ["강화 합", num(save.up_sum)], ["모듈", Array.isArray(save.mods) ? save.mods.join(", ") || "없음" : save.mods]])}</div>`;
  }
  const timelineBox = () => '<div class="tk-section"><h3>같은 기기의 앞뒤 기록 (10분 전 ~ 10분 뒤)</h3><button id="tenkeyIssueTimelineButton" class="text-button" type="button">같은 기기 기록 불러오기</button><div id="tenkeyIssueTimeline"></div></div>';
  // One timeline line in words: a report (what / where), a run (mode, level, how it ended, length) or a performance report.
  function lineText(r) {
    if (r.source === "trace") return [MODES[r.mode] || r.mode, r.lv != null ? `Lv ${r.lv}` : "", `${ENDS[r.end_kind] || dash(r.end_kind)}${CAUSES[r.cause] ? ` (${CAUSES[r.cause]})` : ""}`, r.ms != null ? `${duration(r.ms)} 판` : ""].filter(Boolean).join(" · ");
    if (r.source === "telemetry") return `가장 긴 한 프레임 ${num(r.max_frame_ms)}ms · 버벅임 ${num(r.hitch_n)} · 멈춤 ${num(r.stall_n)} · 통신 실패 ${num(r.net_fail_n)} · 메모리 경고 ${num(r.mem_warn_n)}`;
    return [kindName(r.kind), r.where, r.said].filter(Boolean).join(" · ");
  }
  const clock = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("ko-KR", { hour12: false }) : "—"; };

  function renderHead() {
    const ask = state.tab === "ask";
    byId("tenkeyIssueGroupsPanel").hidden = ask;
    byId("tenkeyIssueListTitle").textContent = ask ? "1대1 문의 목록" : `${SOURCES[state.tab]} 목록`;
    byId("tenkeyIssueHead").innerHTML = ask
      ? "<tr><th>시각</th><th>플레이어</th><th>내용</th><th>앱 · 기기</th><th class=\"tk-num\">앱 순서</th><th>상태</th></tr>"
      : "<tr><th>시각</th><th>종류</th><th>어디서</th><th>앱 · 기기</th><th class=\"tk-num\">횟수</th><th>판 다시 만들기</th></tr>";
    byId("tenkeyIssueKeepNote").innerHTML = `${esc(WHO[state.tab])} 서버는 ${KEEP[state.tab]}.`;
    T.fillKeep(byId("tenkeyIssueKeepNote"));
    for (const b of byId("tenkeyIssueTabs").querySelectorAll("[data-issue-tab]")) b.setAttribute("aria-pressed", String(b.dataset.issueTab === state.tab));
  }

  function groupRow(g, i) {
    return `<tr data-tk-issue-group="${esc(groupKey(g))}" data-tk-index="${i}"${typeof g.sig === "string" ? ` data-tk-sig="${esc(g.sig)}"` : ""} tabindex="0" aria-selected="${state.pick === i}">
      <td class="tk-wrap" data-label="어디서"><strong>${esc(dash(g.where))}</strong></td><td data-label="종류">${esc(kindName(g.kind))}</td>
      <td class="tk-num" data-label="횟수"><strong>${esc(num(g.n))}</strong></td><td data-label="플랫폼">${esc(platformName(g.platform))}</td>
      <td data-label="버전">${esc(Array.isArray(g.versions) ? g.versions.join(", ") || "—" : dash(g.versions))}</td><td data-label="마지막">${esc(time(g.last_at))}</td>
      <td data-label="상태">${typeof g.sig === "string" ? stateBadge(g.triage) : "—"}</td></tr>`;
  }
  function issueRow(r) {
    return `<tr data-tk-issue="${esc(r.id)}" tabindex="0" style="cursor:pointer"><td data-label="시각">${esc(time(r.at))}</td>
      <td data-label="종류"><span class="tk-badge" data-tone="${r.kind === "hitch" || r.kind === "script_error" ? "watch" : "risk"}">${esc(kindName(r.kind))}</span></td>
      <td class="tk-wrap" data-label="어디서">${esc(dash(r.where))}${r.said ? `<span class="tk-sub">${esc(r.said)}</span>` : ""}</td>
      <td data-label="앱 · 기기">${esc(appText(r.app_version, r.build))}<span class="tk-sub">${esc(platformName(r.platform))} · ${esc(dash(r.device_model))}</span></td>
      <td class="tk-num" data-label="횟수">${esc(num(r.count ?? 1))}</td><td data-label="판 다시 만들기">${r.has_run ? '<span class="tk-badge" data-tone="good">있음</span>' : "—"}</td></tr>`;
  }
  function askRow(a) {
    const meta = a.meta && typeof a.meta === "object" ? a.meta : {};
    const who = a.player_id ? `<a href="#/tenkey-players/${encodeURIComponent(a.player_id)}">${esc(a.display_name || "이름 없음")}</a>` : '<span class="tk-sub">플레이어 기록 없음</span>';
    const n = Array.isArray(a.ctx?.steps) ? a.ctx.steps.length : null;
    return `<tr data-tk-ask="${esc(a.receipt)}" tabindex="0" style="cursor:pointer"><td data-label="시각">${esc(time(a.submitted_at))}</td><td data-label="플레이어">${who}</td>
      <td class="tk-wrap tk-report-body" data-label="내용">${esc(a.body)}</td><td data-label="앱 · 기기">${esc(appText(meta.version, meta.build))}<span class="tk-sub">${esc(platformName(meta.platform))} · ${esc(dash(meta.device))}</span></td>
      <td class="tk-num" data-label="앱 순서">${n === null ? "—" : `${num(n)}단계`}</td><td data-label="상태">${stateBadge(a.triage, ASK_STATUS[a.status] || "open")}</td></tr>`;
  }

  function renderList() {
    const ask = state.tab === "ask";
    const g = picked();
    const rows = ask || !g ? state.rows : state.rows.filter((r) => String(r.kind || "") === String(g.kind || "") && String(r.where || "") === String(g.where || "")
      && (!g.platform || !r.platform || r.platform === g.platform));
    byId("tenkeyIssueTotal").textContent = `${num(rows.length)}건${g ? " (묶음 선택됨)" : ""}`;
    byId("tenkeyIssueTable").innerHTML = rows.length ? rows.map(ask ? askRow : issueRow).join("") : '<tr><td colspan="6" class="empty-panel">이 기간에 들어온 보고가 없습니다.</td></tr>';
    if (!ask) {
      byId("tenkeyIssueGroups").innerHTML = state.groups.length ? state.groups.map(groupRow).join("") : '<tr><td colspan="7" class="empty-panel">이 기간에 묶음이 없습니다.</td></tr>';
      byId("tenkeyIssueGroupsTotal").textContent = `${num(state.groups.length)}묶음`;
    }
  }

  async function load() {
    T.setMessage("tenkeyIssueMessage", "불러오는 중입니다...");
    byId("tenkeyIssueDetail").hidden = true;
    state.pick = null;
    renderTriage();
    renderHead();
    const days = Number(byId("tenkeyIssueDays").value) || 7;
    try {
      const data = state.tab === "ask" ? await T.stats("issues.asks", { days }) : await T.stats("issues.list", { days, source: state.tab, limit: 200 });
      state.groups = Array.isArray(data?.groups) ? data.groups : [];
      state.rows = Array.isArray(data?.rows) ? data.rows : [];
      renderList();
      T.setMessage("tenkeyIssueMessage", `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준 · 최근 ${days}일`);
    } catch (error) {
      state.groups = []; state.rows = [];
      renderList();
      T.report("tenkeyIssueMessage", error);
    }
  }

  function show(html, ref) {
    const box = byId("tenkeyIssueDetail");
    box.innerHTML = html;
    box.hidden = false;
    byId("tenkeyIssueClose").addEventListener("click", () => { box.hidden = true; });
    byId("tenkeyIssueTimelineButton")?.addEventListener("click", () => loadTimeline(ref));
    box.scrollIntoView({ block: "start", behavior: "auto" });
  }
  const head = (eyebrow, title, sub) => `<div class="panel-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${sub ? `<small class="tk-wrap">${esc(sub)}</small>` : ""}</div><button id="tenkeyIssueClose" class="text-button" type="button">닫기</button></div>`;

  async function openIssue(id) {
    try {
      const data = await T.stats("issues.get", { source: state.tab, id: Number.isFinite(Number(id)) ? Number(id) : id });
      const r = data?.row || {};
      const d = r.detail && typeof r.detail === "object" ? r.detail : {};
      const extra = Object.entries(d).filter(([k]) => !["trail", "run", "save", "sid", "trace"].includes(k)).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]);
      show(`${head(`${SOURCES[state.tab]} #${dash(r.id ?? id)}`, kindName(r.kind), [r.where, r.said || r.message].filter(Boolean).join(" · "))}
        ${facts([["받은 시각", time(r.at || r.received_at)], ["앱", appText(r.app_version, r.build)], ["플랫폼 · OS", `${platformName(r.platform)} ${r.os_version || ""}`.trim()], ["기기", r.device_model],
          ["언어", r.locale], ["횟수", num(r.count ?? (r.repeats != null ? 1 + Number(r.repeats) : null))], ["세션 번호", d.sid], ["판 흐름 번호", d.trace], ["기기 번호 (앞 8자)", r.install_short]])}
        ${runBox(d.run)}${steps(d.trail, "앱이 남긴 순서")}${saveBox(d.save)}
        ${extra.length ? `<div class="tk-section"><h3>그 밖의 값</h3>${facts(extra)}</div>` : ""}
        ${r.log_tail ? `<div class="tk-section"><h3>Godot 로그 끝부분</h3><pre class="tk-log">${esc(r.log_tail)}</pre></div>` : ""}
        ${timelineBox()}`, { source: state.tab, id: r.id ?? id });
    } catch (error) {
      T.report("tenkeyIssueMessage", error);
    }
  }

  function openAsk(receipt) {
    const a = state.rows.find((x) => String(x.receipt) === String(receipt));
    if (!a) return;
    const meta = a.meta && typeof a.meta === "object" ? a.meta : {};
    const ctx = a.ctx && typeof a.ctx === "object" ? a.ctx : {};
    show(`${head(`1대1 문의 ${dash(a.receipt)}`, a.display_name || "플레이어 기록 없음", time(a.submitted_at))}
      <div class="tk-section"><h3>보낸 글</h3><p class="tk-report-body tk-wrap">${esc(a.body)}</p></div>
      ${facts([["답장 이메일", a.email || "없음 (이전 빌드)"], ["앱", appText(meta.version, meta.build)], ["플랫폼", platformName(meta.platform)], ["기기", meta.device], ["언어", meta.locale], ["세션 번호", ctx.sid], ["상태", STATUS[ASK_STATUS[a.status]] || a.status]])}
      ${runBox(ctx.run)}${steps(ctx.steps, "보내기 전 앱 순서")}${saveBox(ctx.save)}
      ${"triage" in a ? triageForm(a.triage, ASK_STATUS[a.status] || "open") : ""}`, null);
    if (!("triage" in a)) return;
    bindTriage(byId("tenkeyIssueDetail"), {
      what: `1대1 문의 ${a.receipt} · ${a.display_name || "플레이어 기록 없음"}`, was: a.triage?.status || ASK_STATUS[a.status] || "open",
      params: { source: "ask", receipt: a.receipt },
      save: (t, status) => { a.triage = t; a.status = status === "fixed" ? "done" : status; renderList(); openAsk(a.receipt); },
    });
  }

  // The mark form, under the picked group or inside an inquiry. 고침 takes the build that fixed it (blank = a server-side fix).
  function triageForm(t, base) {
    const s = t?.status || base;
    const now = t ? `지금: ${STATUS[t.status]}${t.fixed_in_build ? ` (빌드 ${t.fixed_in_build})` : ""} · ${time(t.at)} · ${t.by || "—"}${t.note ? ` · 메모: ${t.note}` : ""}`
      : `지금: ${STATUS[s]} (콘솔에서 아직 아무도 표시하지 않음)`;
    return `<form id="tenkeyTriageForm" class="admin-form tk-section impact-form">
      <p class="eyebrow">ISSUE STATE</p><h3>처리 상태 바꾸기</h3>
      <p class="tk-triage-now tk-wrap">${esc(now)}</p>
      <p class="impact-note">콘솔 기록용입니다. 게임과 플레이어에게는 아무것도 바뀌지 않습니다. 고친 빌드 번호를 적어 두면 그 빌드 이상에서 같은 보고가 다시 들어올 때 「고친 뒤 다시」가 붙습니다. 서버 쪽에서 고쳤으면 비워 두고, 그때는 표시한 뒤에 들어온 보고로 셉니다. 바꾼 사람·시각·사유는 감사 기록에 남습니다.</p>
      <fieldset class="mail-audience"><legend>상태</legend>${Object.keys(STATUS).map((k) => `<label class="check-label"><input name="status" type="radio" value="${k}"${k === s ? " checked" : ""}> ${esc(STATUS_LONG[k])}</label>`).join("")}</fieldset>
      <label>고친 빌드 번호 (고침일 때)<input name="build" type="number" min="1" max="999999999" step="1" inputmode="numeric" value="${esc(t?.fixed_in_build ?? "")}" placeholder="예: 31"></label>
      <label>메모 (선택)<input name="note" maxlength="300" value="${esc(t?.note || "")}" placeholder="예: dig_main 경계 검사 추가"></label>
      <label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 빌드 31에서 고친 것 확인"></label>
      <p id="tenkeyTriageMessage" class="dashboard-message" role="status" aria-live="polite"></p>
      <div class="tk-actions"><button class="warning-button" type="submit">상태 저장</button></div>
    </form>`;
  }
  function bindTriage(box, target) {
    const form = box.querySelector("#tenkeyTriageForm");
    const sync = () => { form.elements.build.disabled = form.elements.status.value !== "fixed"; };
    form.addEventListener("change", sync);
    sync();
    form.addEventListener("submit", (event) => submitTriage(event, target));
  }
  async function submitTriage(event, target) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const status = form.elements.status.value;
      const raw = form.elements.build.value.trim();
      const build = status === "fixed" && raw ? Number(raw) : null;
      const note = form.elements.note.value.trim(), reason = form.elements.reason.value.trim();
      if (!await root.ConsoleApp.confirmChange("이슈 처리 상태 바꾸기", `${target.what}\n${STATUS[target.was]} → ${STATUS[status]}${build ? ` (빌드 ${build})` : status === "fixed" ? " (빌드 없음: 서버 쪽 수정)" : ""}\n메모: ${note || "없음"}\n사유: ${reason}`)) return;
      T.setMessage("tenkeyTriageMessage", "처리하는 중입니다...");
      const out = (await T.call("issues.mark", { ...target.params, status, build, note, reason }, form))?.data || {};
      target.save(out.triage || null, status);
      T.setMessage("tenkeyTriageMessage", out.changed === false ? "이미 그 상태라 바꾸지 않았습니다 (감사 기록 없음)." : "저장했습니다. 감사 기록에 남았습니다.");
    } catch (error) {
      T.report("tenkeyTriageMessage", error);
    } finally {
      finish();
    }
  }
  // The form under the groups for the picked group (crash / app); hidden with no pick or a server before fw8 (no sig).
  function renderTriage() {
    const box = byId("tenkeyIssueTriage");
    const g = picked();
    if (!g || typeof g.sig !== "string") { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = triageForm(g.triage, "open");
    box.hidden = false;
    bindTriage(box, {
      what: `${dash(g.where)} · ${kindName(g.kind)} · ${platformName(g.platform)}`, was: g.triage?.status || "open",
      // The group's own source (the server's group carries it): a group still on screen from the tab being left (a pick while the
      // new tab loads) must not be marked under the new tab's source (script_error is a crash kind and an app kind).
      params: { source: g.source || state.tab, kind: g.kind, where: g.where || "", platform: g.platform || "" },
      save: (t) => { g.triage = t; renderList(); renderTriage(); },
    });
  }

  async function loadTimeline(ref) {
    const box = byId("tenkeyIssueTimeline");
    box.innerHTML = '<p class="empty-panel">불러오는 중입니다...</p>';
    try {
      const data = await T.stats("issues.timeline", { source: ref.source, id: ref.id, minutes: 10 });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const others = rows.filter((r) => !r.self).length;
      box.innerHTML = data?.by === "none" ? '<p class="empty-panel">— (이 보고에는 기기 번호도 세션 번호도 없어 묶어 볼 수 없습니다)</p>'
        : others ? `<ol class="tk-trail tk-steps">${rows.map((r) => `<li><span class="tk-step-at">${esc(clock(r.t ?? r.at))}</span> <strong>${esc(SOURCES[r.source] || dash(r.source))}</strong> · ${esc(lineText(r))}${r.self ? ' <span class="tk-badge" data-tone="watch">이 보고</span>' : ""}</li>`).join("")}</ol>`
        : '<p class="empty-panel">앞뒤 10분 안에 같은 기기의 다른 기록이 없습니다.</p>';
    } catch (error) {
      box.innerHTML = `<p class="empty-panel">${esc(T.errorText(error))}</p>`;
    }
  }

  function bindOpen(tbodyId, handler) {
    const body = byId(tbodyId);
    const fire = (event) => { const row = event.target.closest("tr[data-tk-issue], tr[data-tk-ask], tr[data-tk-issue-group]"); if (row && !event.target.closest("a")) handler(row); };
    body.addEventListener("click", fire);
    body.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fire(event); } });
  }

  function mountIssues() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyIssueForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
      byId("tenkeyIssueTabs").addEventListener("click", (event) => {
        const b = event.target.closest("[data-issue-tab]");
        if (!b || b.dataset.issueTab === state.tab) return;
        state.tab = b.dataset.issueTab;
        load();
      });
      bindOpen("tenkeyIssueGroups", (row) => {
        const i = Number(row.dataset.tkIndex);
        state.pick = state.pick === i ? null : i;
        renderList();
        renderTriage();
        // On a phone the form sits under every group card: bring it up to the picked group's view.
        if (state.pick !== null && !byId("tenkeyIssueTriage").hidden) byId("tenkeyIssueTriage").scrollIntoView({ block: "nearest", behavior: "auto" });
      });
      bindOpen("tenkeyIssueTable", (row) => (row.dataset.tkAsk !== undefined ? openAsk(row.dataset.tkAsk) : openIssue(row.dataset.tkIssue)));
    }
    load();
  }

  T.mountIssues = mountIssues;
})(window);
