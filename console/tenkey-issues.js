// 10key Survival: 이슈함 (owner 2026-11-17: "서버로 이슈를 받되 재현 절차까지 알 수 있게"). Three tabs, one flow each: groups -> list ->
// one report. 크래시 (crash_reports) and 앱 이상 (app_issues) read tenkey-console-stats "issues.list" {days, source, kind, limit} ->
// {groups, rows} and "issues.get" {source, id} -> {row}; 1대1 문의 reads "issues.asks" {days} -> {rows} (inquiry rows with ctx).
// One report shows the app's own steps before it as numbered lines ("<seconds> <what>", the game's CrashTrail), the run it was
// in as "이 판 다시 만들기: seed … (QA_WORLD_SEED)", the save it had, and on request the same device's other records from ten
// minutes before to ten after ("issues.timeline" {install, at, minutes}). Reports from builds before these fields read '—'.
(function attachConsoleTenkeyIssues(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, shortTime, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const KINDS = { unclean_exit: "화면을 켠 채 꺼짐", anr_suspect: "멈춤 (5초 이상)", script_error: "스크립트 오류", stall: "멈춤", hitch: "버벅임" };
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
    ask: "앱 계정만 보냅니다 (웹, 14세 미만, 약관 미동의는 보내지 않음). 이 빌드부터 보낼 때의 앱 순서와 판·저장 상태가 붙습니다.",
  };
  const state = { bound: false, tab: "crash", groups: [], rows: [], group: null, open: null };
  const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const kindName = (k) => KINDS[k] || dash(k);
  const groupKey = (g) => `${g.kind || ""}|${g.where || ""}`;
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
  const timelineBox = (install) => `<div class="tk-section"><h3>같은 기기의 앞뒤 기록 (10분 전 ~ 10분 뒤)</h3>${install
    ? '<button id="tenkeyIssueTimelineButton" class="text-button" type="button">같은 기기 기록 불러오기</button><div id="tenkeyIssueTimeline"></div>'
    : '<p class="empty-panel">— (이 보고에는 기기 번호가 없어 묶어 볼 수 없습니다)</p>'}</div>`;

  function renderHead() {
    const ask = state.tab === "ask";
    byId("tenkeyIssueGroupsPanel").hidden = ask;
    byId("tenkeyIssueListTitle").textContent = ask ? "1대1 문의 목록" : `${SOURCES[state.tab]} 목록`;
    byId("tenkeyIssueHead").innerHTML = ask
      ? "<tr><th>시각</th><th>플레이어</th><th>내용</th><th>앱 · 기기</th><th class=\"tk-num\">앱 순서</th></tr>"
      : "<tr><th>시각</th><th>종류</th><th>어디서</th><th>앱 · 기기</th><th class=\"tk-num\">횟수</th><th>판 다시 만들기</th></tr>";
    byId("tenkeyIssueKeepNote").innerHTML = `${esc(WHO[state.tab])} 서버는 ${KEEP[state.tab]}.`;
    T.fillKeep(byId("tenkeyIssueKeepNote"));
    for (const b of byId("tenkeyIssueTabs").querySelectorAll("[data-issue-tab]")) b.setAttribute("aria-pressed", String(b.dataset.issueTab === state.tab));
  }

  function groupRow(g) {
    return `<tr data-tk-issue-group="${esc(groupKey(g))}" tabindex="0" aria-selected="${state.group === groupKey(g)}">
      <td class="tk-wrap" data-label="어디서"><strong>${esc(dash(g.where))}</strong></td><td data-label="종류">${esc(kindName(g.kind))}</td>
      <td class="tk-num" data-label="횟수"><strong>${esc(num(g.n))}</strong></td><td data-label="플랫폼">${esc(platformName(g.platform))}</td>
      <td data-label="버전">${esc(Array.isArray(g.versions) ? g.versions.join(", ") || "—" : dash(g.versions))}</td><td data-label="마지막">${esc(time(g.last_at))}</td></tr>`;
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
      <td class="tk-num" data-label="앱 순서">${n === null ? "—" : `${num(n)}단계`}</td></tr>`;
  }

  function renderList() {
    const ask = state.tab === "ask";
    const [kind, where] = (state.group || "|").split("|");
    const rows = ask ? state.rows : state.rows.filter((r) => !state.group || (String(r.kind || "") === kind && String(r.where || "") === where));
    byId("tenkeyIssueTotal").textContent = `${num(rows.length)}건${state.group ? " (묶음 선택됨)" : ""}`;
    byId("tenkeyIssueTable").innerHTML = rows.length ? rows.map(ask ? askRow : issueRow).join("") : '<tr><td colspan="6" class="empty-panel">이 기간에 들어온 보고가 없습니다.</td></tr>';
    if (!ask) {
      byId("tenkeyIssueGroups").innerHTML = state.groups.length ? state.groups.map(groupRow).join("") : '<tr><td colspan="6" class="empty-panel">이 기간에 묶음이 없습니다.</td></tr>';
      byId("tenkeyIssueGroupsTotal").textContent = `${num(state.groups.length)}묶음`;
    }
  }

  async function load() {
    T.setMessage("tenkeyIssueMessage", "불러오는 중입니다...");
    byId("tenkeyIssueDetail").hidden = true;
    state.group = null;
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

  function show(html, install, at) {
    const box = byId("tenkeyIssueDetail");
    box.innerHTML = html;
    box.hidden = false;
    byId("tenkeyIssueClose").addEventListener("click", () => { box.hidden = true; });
    byId("tenkeyIssueTimelineButton")?.addEventListener("click", () => loadTimeline(install, at));
    box.scrollIntoView({ block: "start", behavior: "auto" });
  }
  const head = (eyebrow, title, sub) => `<div class="panel-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${sub ? `<small class="tk-wrap">${esc(sub)}</small>` : ""}</div><button id="tenkeyIssueClose" class="text-button" type="button">닫기</button></div>`;

  async function openIssue(id) {
    try {
      const data = await T.stats("issues.get", { source: state.tab, id: Number.isFinite(Number(id)) ? Number(id) : id });
      const r = data?.row || {};
      const d = r.detail && typeof r.detail === "object" ? r.detail : {};
      const extra = Object.entries(d).filter(([k]) => !["trail", "run", "save", "sid", "trace"].includes(k)).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]);
      const install = r.install_id || r.install || null;
      show(`${head(`${SOURCES[state.tab]} #${dash(r.id ?? id)}`, kindName(r.kind), [r.where, r.said || r.message].filter(Boolean).join(" · "))}
        ${facts([["받은 시각", time(r.at || r.received_at)], ["앱", appText(r.app_version, r.build)], ["플랫폼 · OS", `${platformName(r.platform)} ${r.os_version || ""}`.trim()], ["기기", r.device_model],
          ["언어", r.locale], ["횟수", num(r.count ?? (r.repeats != null ? 1 + Number(r.repeats) : null))], ["세션 번호", d.sid], ["판 흐름 번호", d.trace], ["기기 번호 (앞 8자)", install ? String(install).slice(0, 8) : r.install_short]])}
        ${runBox(d.run)}${steps(d.trail, "앱이 남긴 순서")}${saveBox(d.save)}
        ${extra.length ? `<div class="tk-section"><h3>그 밖의 값</h3>${facts(extra)}</div>` : ""}
        ${r.log_tail ? `<div class="tk-section"><h3>Godot 로그 끝부분</h3><pre class="tk-log">${esc(r.log_tail)}</pre></div>` : ""}
        ${timelineBox(install)}`, install, r.at || r.received_at);
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
      ${facts([["답장 이메일", a.email || "없음 (이전 빌드)"], ["앱", appText(meta.version, meta.build)], ["플랫폼", platformName(meta.platform)], ["기기", meta.device], ["언어", meta.locale], ["세션 번호", ctx.sid], ["상태", a.status]])}
      ${runBox(ctx.run)}${steps(ctx.steps, "보내기 전 앱 순서")}${saveBox(ctx.save)}`, null, a.submitted_at);
  }

  async function loadTimeline(install, at) {
    const box = byId("tenkeyIssueTimeline");
    box.innerHTML = '<p class="empty-panel">불러오는 중입니다...</p>';
    try {
      const data = await T.stats("issues.timeline", { install, at, minutes: 10 });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      box.innerHTML = rows.length
        ? `<ol class="tk-trail tk-steps">${rows.map((r) => `<li><span class="tk-step-at">${esc(shortTime(r.at))}</span> <strong>${esc(SOURCES[r.source] || dash(r.source))}</strong> · ${esc(kindName(r.kind))}${r.summary ? ` · ${esc(r.summary)}` : ""}</li>`).join("")}</ol>`
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
        const key = row.dataset.tkIssueGroup;
        state.group = state.group === key ? null : key;
        renderList();
      });
      bindOpen("tenkeyIssueTable", (row) => (row.dataset.tkAsk !== undefined ? openAsk(row.dataset.tkAsk) : openIssue(row.dataset.tkIssue)));
    }
    load();
  }

  T.mountIssues = mountIssues;
})(window);
