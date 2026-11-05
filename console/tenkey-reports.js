// 10key Survival: the players' "문제 제보" texts (game SETTINGS -> REPORT A PROBLEM), read only (owner 2026-11-05: "10key 클라에
// 제보하기 기능이 있는데 콘솔에서 그런게 안보이는거같아서 보이게"). The server keeps a report 7 days (tenkey.issue_reports);
// tenkey-console-stats "reports.list" -> tenkey.admin_issue_reports_v1 returns them newest first. Nothing is written here.
(function attachConsoleTenkeyReports(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const LOCALES = { ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어" };
  const state = { bound: false, busy: false };

  const localeName = (value) => LOCALES[value] || LOCALES[String(value || "").split(/[_-]/)[0]] || String(value || "—");

  function row(report) {
    const meta = report.meta && typeof report.meta === "object" ? report.meta : {};
    const who = report.player_id
      ? `<a href="#/tenkey-players/${encodeURIComponent(report.player_id)}">${esc(report.display_name || "이름 없음")}</a>${report.public_id ? `<span class="tk-sub">${esc(report.public_id)}</span>` : ""}`
      : '<span class="tk-sub">플레이어 기록 없음</span>';
    const app = [meta.version ? `v${meta.version}` : "", meta.build ? `빌드 ${meta.build}` : ""].filter(Boolean).join(" · ") || "—";
    const device = [meta.platform ? platformName(meta.platform) : "", meta.device || ""].filter(Boolean).join(" · ") || "—";
    return `<tr><td data-label="시각">${esc(time(report.submitted_at))}</td><td data-label="플레이어">${who}</td>`
      + `<td data-label="내용" class="tk-report-body">${esc(report.body)}</td><td data-label="앱">${esc(app)}<span class="tk-sub">${esc(device)}</span></td>`
      + `<td data-label="언어">${esc(localeName(meta.locale))}</td><td data-label="접수 번호"><code>${esc(report.receipt)}</code></td></tr>`;
  }

  async function load() {
    if (state.busy) return;
    state.busy = true;
    const days = Number(byId("tenkeyReportDays").value) || 7;
    byId("tenkeyReportTable").innerHTML = '<tr><td colspan="6" class="empty-panel">불러오는 중입니다...</td></tr>';
    T.setMessage("tenkeyReportMessage", "");
    try {
      const result = await root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "reports.list", params: { days, limit: 200 } });
      const data = result?.data;
      if (!data || !Array.isArray(data.rows)) throw new Error("console_invalid_response");
      byId("tenkeyReportTotal").textContent = `${num(data.total)}건`;
      byId("tenkeyReportTable").innerHTML = data.rows.length
        ? data.rows.map(row).join("")
        : `<tr><td colspan="6" class="empty-panel">최근 ${days}일 동안 들어온 제보가 없습니다.</td></tr>`;
      const more = Number(data.total) > data.rows.length ? ` · 최신 ${num(data.rows.length)}건만 표시` : "";
      T.setMessage("tenkeyReportMessage", `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준${more}`);
    } catch (error) {
      byId("tenkeyReportTotal").textContent = "—";
      byId("tenkeyReportTable").innerHTML = '<tr><td colspan="6" class="empty-panel">제보 목록을 읽지 못했습니다.</td></tr>';
      T.report("tenkeyReportMessage", error);
    } finally {
      state.busy = false;
    }
  }

  function mountReports() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyReportFilterForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
      byId("tenkeyReportDays").addEventListener("change", load);
    }
    load();
  }

  T.mountReports = mountReports;
})(window);
