// 10key Survival: the players' "1대1 문의" texts (game SETTINGS -> CONTACT -> 1:1 INQUIRY, formerly "문제 제보"; owner 2026-11-05:
// "10key 클라에 제보하기 기능이 있는데 콘솔에서 그런게 안보이는거같아서 보이게"). The server keeps a report 7 days (tenkey.issue_reports);
// tenkey-console-stats "reports.list" -> tenkey.admin_issue_reports_v1 returns them newest first, each with the email the player
// gave for the reply (owner 2026-11-09; shown with a copy key and a mailto link, never stored here). Reading is the only thing the
// table does. The small form under it writes the YouTube link behind the game's "유튜브에서 공개 소통하기" key (tenkey-admin
// `community.set` {url, reason}; "" = the game's default channel) and shows the current value (`config.get` -> community_url).
(function attachConsoleTenkeyReports(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const LOCALES = { ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어" };
  const state = { bound: false, busy: false };
  const DEFAULT_CHANNEL = "https://www.youtube.com/@Sergeant_Houseduck";
  // the same rule as the server (tenkey.admin_community_set_v1) and the game (CommunityUrl.valid)
  const YOUTUBE = /^https:\/\/(((www|m)\.)?youtube\.com|youtu\.be)\/[^\s]+$/;

  const localeName = (value) => LOCALES[value] || LOCALES[String(value || "").split(/[_-]/)[0]] || String(value || "—");

  function row(report) {
    const meta = report.meta && typeof report.meta === "object" ? report.meta : {};
    const who = report.player_id
      ? `<a href="#/tenkey-players/${encodeURIComponent(report.player_id)}">${esc(report.display_name || "이름 없음")}</a>${report.public_id ? `<span class="tk-sub">${esc(report.public_id)}</span>` : ""}`
      : '<span class="tk-sub">플레이어 기록 없음</span>';
    const app = [meta.version ? `v${meta.version}` : "", meta.build ? `빌드 ${meta.build}` : ""].filter(Boolean).join(" · ") || "—";
    const device = [meta.platform ? platformName(meta.platform) : "", meta.device || ""].filter(Boolean).join(" · ") || "—";
    const mail = typeof report.email === "string" && report.email
      ? `<a href="mailto:${esc(encodeURI(report.email))}">${esc(report.email)}</a> <button type="button" class="text-button" data-copy-email="${esc(report.email)}">복사</button>`
      : '<span class="tk-sub">없음 (이전 빌드)</span>';
    return `<tr><td data-label="시각">${esc(time(report.submitted_at))}</td><td data-label="플레이어">${who}</td>`
      + `<td data-label="내용" class="tk-report-body">${esc(report.body)}</td><td data-label="답장 이메일">${mail}</td><td data-label="앱">${esc(app)}<span class="tk-sub">${esc(device)}</span></td>`
      + `<td data-label="언어">${esc(localeName(meta.locale))}</td><td data-label="접수 번호"><code>${esc(report.receipt)}</code></td></tr>`;
  }

  async function load() {
    if (state.busy) return;
    state.busy = true;
    const days = Number(byId("tenkeyReportDays").value) || 7;
    byId("tenkeyReportTable").innerHTML = '<tr><td colspan="7" class="empty-panel">불러오는 중입니다...</td></tr>';
    T.setMessage("tenkeyReportMessage", "");
    try {
      const result = await root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "reports.list", params: { days, limit: 200 } });
      const data = result?.data;
      if (!data || !Array.isArray(data.rows)) throw new Error("console_invalid_response");
      byId("tenkeyReportTotal").textContent = `${num(data.total)}건`;
      byId("tenkeyReportTable").innerHTML = data.rows.length
        ? data.rows.map(row).join("")
        : `<tr><td colspan="7" class="empty-panel">최근 ${days}일 동안 들어온 제보가 없습니다.</td></tr>`;
      const more = Number(data.total) > data.rows.length ? ` · 최신 ${num(data.rows.length)}건만 표시` : "";
      T.setMessage("tenkeyReportMessage", `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준${more}`);
    } catch (error) {
      byId("tenkeyReportTotal").textContent = "—";
      byId("tenkeyReportTable").innerHTML = '<tr><td colspan="7" class="empty-panel">제보 목록을 읽지 못했습니다.</td></tr>';
      T.report("tenkeyReportMessage", error);
    } finally {
      state.busy = false;
    }
  }

  async function copyEmail(button) {
    const text = button.dataset.copyEmail || "";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "복사됨";
    } catch (_error) {
      button.textContent = "복사 안 됨";
    }
    setTimeout(() => { button.textContent = "복사"; }, 1500);
  }

  function showCommunity(url) {
    const link = byId("tenkeyCommunityCurrent");
    const value = typeof url === "string" ? url : "";
    link.textContent = value || DEFAULT_CHANNEL;
    link.href = value || DEFAULT_CHANNEL;
    byId("tenkeyCommunityNote").textContent = value ? "" : " (기본값: 하우스덕 채널)";
    byId("tenkeyCommunityForm").elements.url.value = value;
  }

  async function loadCommunity() {
    try {
      const result = await T.call("config.get", {});
      showCommunity(result?.data?.community_url);
    } catch (error) {
      T.report("tenkeyCommunityFormMessage", error);
    }
  }

  async function submitCommunity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const url = String(form.elements.url.value || "").trim();
      const reason = String(form.elements.reason.value || "").trim();
      if (url && (url.length > 300 || !YOUTUBE.test(url))) {
        T.setMessage("tenkeyCommunityFormMessage", T.errorText({ message: "invalid_url" }), true);
        return;
      }
      if (!await root.ConsoleApp.confirmChange("10KEY 유튜브 소통 링크 변경", [`새 주소: ${url || "(비움: 기본 하우스덕 채널)"}`, `변경 이유: ${reason}`].join("\n"))) return;
      T.setMessage("tenkeyCommunityFormMessage", "저장하는 중입니다...");
      const result = await T.call("community.set", { url, reason }, form);
      showCommunity(result?.data?.community_url ?? url);
      form.elements.reason.value = "";
      T.setMessage("tenkeyCommunityFormMessage", "");
      T.setMessage("tenkeyReportMessage", "유튜브 소통 링크를 저장했습니다. 스토어 앱은 다음에 켤 때부터 이 주소를 엽니다.");
    } catch (error) {
      T.report("tenkeyCommunityFormMessage", error);
    } finally {
      finish();
    }
  }

  function mountReports() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyCommunityForm").addEventListener("submit", submitCommunity);
      byId("tenkeyReportTable").addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-copy-email]");
        if (button) copyEmail(button);
      });
      byId("tenkeyReportFilterForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
      byId("tenkeyReportDays").addEventListener("change", load);
    }
    load();
    loadCommunity();
  }

  T.mountReports = mountReports;
})(window);
