(function (root) {
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const value = (v) => v == null ? "기록 없음" : String(v);
  const time = (v) => v ? new Date(v).toLocaleString("ko-KR") : "기록 없음";
  const post = (body) => root.ConsoleAPI.post("admin-console", body);
  const errorText = "조회하지 못했습니다. 서버 적용 상태와 관리자 권한을 확인한 뒤 다시 조회해 주세요.";
  const sequences = {player:0,analytics:0,ranking:0,reports:0};
  let reportPage = 1, reportPages = 1;
  function table(headers, rows, empty = "기록이 없습니다.") {
    return rows.length ? `<table class="lab-table"><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell,i) => `<td data-label="${esc(headers[i])}">${esc(value(cell))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p class="empty-panel">${esc(empty)}</p>`;
  }
  function facts(rows) { return `<dl class="lab-facts">${rows.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(value(v))}</dd></div>`).join("")}</dl>`; }
  async function loadPlayer(userId) {
    const seq = ++sequences.player;
    const panel = byId("labPlayer");
    if (!panel) return;
    panel.setAttribute("aria-busy","true");
    try {
      const d = await post({action:"lab.get",userId});
      if (!panel.isConnected || seq !== sequences.player) return;
      const p = d.profile, progress = d.snapshot?.progress;
      panel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">LAB ACCOUNT</p><h2>2.0 연구소</h2></div><button id="labPlayerRefresh" type="button">다시 조회</button></div>
        ${!p ? '<p class="empty-panel">연구소 프로필이 없습니다. 아직 2.0을 시작하지 않은 계정일 수 있습니다.</p>' : facts([
          ["진행",progress ? `페이즈 ${progress.phase} · 스텝 ${progress.step}${progress.completed ? " · 완료" : ""}` : null],
          ["시약",p.reagent],["VIP 등급",p.vip_tier],["마지막 방치 수령",time(p.idle_claimed_at)],
          ["진행 저장",time(d.snapshot?.updated_at)],["코어 적립 초",d.core?.play_seconds_balance],
          ["코어 구매 단계",d.core?.steps_bought],["확인된 완료 런",d.facts?.labCompletedRuns],
        ])}
        <p>읽기 전용 · 지능 Lv1 이상은 튜토리얼 완료 증거가 아닙니다. 기록 없는 값을 0으로 추정하지 않습니다.</p>
        ${facts(Object.entries(p?.hex_stats || {}).map(([k,v]) => [({intelligence:"지능",speed:"속도",endurance:"지구력",luck:"운",psychic:"초능력",reserved:"예약 스탯"})[k] || k,v]))}
        ${facts([["랭킹 보류",d.held ? "보류 중" : "보류 없음"],["친구 요청 알림",d.friends?.requests ? "있음" : "없음"],["미수령 선물",d.friends?.gifts ? "있음" : "없음"]])}
        <details><summary>무결성 가드와 최근 신호 (${(d.integrity || []).length})</summary><p>확인 신호이며 부정 이용 확정이 아닙니다.</p>${facts(Object.entries(d.guard_modes || {}))}${table(["종류","심각도","판정","횟수","최근 감지"],(d.integrity || []).map(r => [r.kind,r.severity,r.action,r.occurrences,time(r.last_seen_at)]))}</details>
        <details><summary>런 티켓 · 최근 20건</summary>${table(["진행","상태","판정","시약","발급 시각"],(d.tickets || []).map(r => [`P${r.phase} · ${r.step}`,r.state,[r.verdict,...(r.verdict_reasons || [])].filter(Boolean).join(" · "),r.granted_reagent,time(r.issued_at)]))}</details>
        <details><summary>플레이 원장 · 최근 20건</summary>${table(["결과","활성 초","저장 시각"],(d.ledger || []).map(r => [r.result_id,r.active_sec,time(r.created_at)]))}</details>
        <details><summary>결과 보너스·재화 이벤트 · 최근 20건</summary>${table(["종류","지급량","코어 적립 초","시각"],(d.events || []).map(r => [r.event_type,r.granted_reagent ?? r.amount,r.core_play_seconds_balance,time(r.created_at)]))}</details>`;
    } catch (_) {
      if (panel.isConnected && seq === sequences.player) panel.innerHTML = `<h2>2.0 연구소</h2><p role="status">${errorText}</p><button id="labPlayerRefresh" type="button">다시 조회</button>`;
    } finally {
      if (panel.isConnected && seq === sequences.player) { panel.setAttribute("aria-busy","false"); panel.querySelector("#labPlayerRefresh")?.addEventListener("click", () => loadPlayer(userId)); }
    }
  }
  async function loadAnalytics() {
    const seq = ++sequences.analytics;
    const panel = byId("labAnalyticsPanel"); panel.setAttribute("aria-busy","true");
    byId("labAnalyticsMessage").textContent = "2.0 지표를 집계하는 중입니다. 기존 결과는 이전 조회 값입니다.";
    try {
      const d = await post({action:"lab.analytics",rangeDays:Number(byId("labAnalyticsForm").elements.rangeDays.value)});
      if (seq !== sequences.analytics) return;
      const sections = {tutorial:"튜토리얼 단계 도달률",bonus:"결과 보너스",boss:"보스 첫 관측 결과",season:"시즌 유료 관심·구매",dialogue:"대사",retention:"버전별 유지율"};
      byId("labAnalyticsRows").innerHTML = Object.entries(sections).map(([section,title]) => `<details open><summary>${title}</summary>${table(["버전","언어","단계","도달/성공","분모","비율"],(d.metrics || []).filter(r => r.section === section).map(r => [r.app_version,r.locale === "unknown" ? "언어 미기록" : r.locale === "all" ? "전체" : r.locale,section === "tutorial" ? root.ConsoleModel.labTutorialStageName(r.label) : r.label,r.numerator,r.denominator,root.ConsoleModel.sampleRate(r.numerator,r.denominator)]),"표본 부족 · 수집된 기록이 없습니다.")}</details>`).join("");
      byId("labAnalyticsMessage").textContent = `최근 ${d.range_days}일 · 이벤트 ${d.events || 0}건 · 언어 미기록 ${d.unknown_locale_events || 0}건`;
    } catch (_) { if (seq === sequences.analytics) byId("labAnalyticsMessage").textContent = `${errorText} 기존 결과는 이전 조회 값입니다.`; }
    finally { if (seq === sequences.analytics) panel.setAttribute("aria-busy","false"); }
  }
  async function loadRanking() {
    const form = byId("rankingForm"); if (!form.reportValidity()) return;
    const userId = form.elements.userId.value.trim();
    if (userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) { byId("rankingMessage").textContent = "계정 UUID 형식을 확인해 주세요."; return; }
    const seq = ++sequences.ranking;
    byId("rankingPanel").setAttribute("aria-busy","true"); byId("rankingMessage").textContent = "스냅숏을 불러오는 중입니다.";
    try {
      const d = await post({action:"ranking.snapshots",day:form.elements.day.value,limit:Number(form.elements.limit.value),userId});
      if (seq !== sequences.ranking) return;
      byId("rankingMessage").textContent = d.captured_at ? `${d.day} · 저장 ${time(d.captured_at)} · 전체 ${value(d.total_players)}명` : `${d.day} 스냅숏이 없습니다. 저장 시각 또는 서버 예약 상태를 확인하세요.`;
      byId("rankingComparison").innerHTML = userId ? facts((d.comparison || []).map(r => [r.day,root.ConsoleModel.snapshotRank(r)])) : "";
      byId("rankingRows").innerHTML = table(["순위","닉네임","계정","파워"],(d.rows || []).map(r => [r.rank,r.nickname,r.user_id,r.quirky_power]));
    } catch (_) { if (seq === sequences.ranking) byId("rankingMessage").textContent = `${errorText} 기존 결과는 이전 조회 값입니다.`; }
    finally { if (seq === sequences.ranking) byId("rankingPanel").setAttribute("aria-busy","false"); }
  }
  async function loadReports() {
    const seq = ++sequences.reports;
    byId("issueReportsPanel").setAttribute("aria-busy","true"); byId("issueReportsMessage").textContent = "게임 안 문의·제보를 불러오는 중입니다.";
    try {
      const d = await post({action:"reports.list",page:reportPage});
      if (seq !== sequences.reports) return;
      reportPages = Math.max(1,Number(d.pageCount || 1));
      byId("issueReportsRows").innerHTML = (d.reports || []).map(r => `<article class="audit-item"><strong>${esc(time(r.submitted_at))}</strong><a href="#/players/${encodeURIComponent(r.user_id)}">${esc(r.nickname || "닉네임 없음")} · ${esc(r.user_id)}</a><p class="report-body">${esc(r.body)}</p><small>${esc([r.metadata?.app_version && `앱 ${r.metadata.app_version}${r.metadata?.build ? ` (빌드 ${r.metadata.build})` : ""}`,r.metadata?.platform,r.metadata?.locale && `언어 ${r.metadata.locale}`].filter(Boolean).join(" · "))}</small></article>`).join("") || '<p class="empty-panel">게임 안에서 보낸 문의·제보가 아직 없습니다.</p>';
      byId("issueReportsMessage").textContent = `${d.total || 0}건 · 읽기 전용`;
      byId("issueReportsPage").textContent = `${reportPage} / ${reportPages}`;
      byId("issueReportsPrevious").disabled = reportPage <= 1; byId("issueReportsNext").disabled = reportPage >= reportPages;
    } catch (_) { if (seq === sequences.reports) byId("issueReportsMessage").textContent = errorText; }
    finally { if (seq === sequences.reports) byId("issueReportsPanel").setAttribute("aria-busy","false"); }
  }
  byId("labAnalyticsForm").addEventListener("submit", e => {e.preventDefault();loadAnalytics();});
  byId("rankingForm").elements.day.value = new Date().toISOString().slice(0,10);
  byId("rankingForm").addEventListener("submit", e => {e.preventDefault();loadRanking();});
  byId("rankingPanel").addEventListener("toggle", () => {if (byId("rankingPanel").open && !sequences.ranking) loadRanking();});
  byId("issueReportsRefresh").addEventListener("click",loadReports);
  byId("issueReportsPrevious").addEventListener("click",()=>{if(reportPage>1){reportPage--;loadReports();}});
  byId("issueReportsNext").addEventListener("click",()=>{if(reportPage<reportPages){reportPage++;loadReports();}});
  root.ConsoleLab = {loadPlayer,loadAnalytics,loadRanking,loadReports,table};
})(window);
