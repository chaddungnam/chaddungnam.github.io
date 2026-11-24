// 10key Survival: the players' "1대1 문의" texts (game SETTINGS -> CONTACT -> 1:1 INQUIRY, formerly "문제 제보"; owner 2026-11-05:
// "10key 클라에 제보하기 기능이 있는데 콘솔에서 그런게 안보이는거같아서 보이게"). How long the server keeps a report (tenkey.issue_reports)
// is the server's number (keep.get, filled into the data-tk-keep span of the table note);
// tenkey-console-stats "reports.list" -> tenkey.admin_issue_reports_v1 returns them newest first, each with the email the player
// gave for the reply (owner 2026-11-09; shown with a copy key and a mailto link, never stored here). Reading is the only thing the
// table does. The external-links panel uses one parameterized links.set action (owner 2026-11-24).
(function attachConsoleTenkeyReports(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const LOCALES = { ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어" };
  const state = { bound: false, busy: false };
  const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
  const LINKS = {
    youtube: { label: "YouTube 채널", url: "https://www.youtube.com/@Sergeant_Houseduck", hosts: YOUTUBE_HOSTS },
    instagram: { label: "Instagram", url: "https://www.instagram.com/sergeant_houseduck/", hosts: ["instagram.com", "www.instagram.com"] },
    x: { label: "X (日本語)", url: "https://x.com/houseduckin", hosts: ["x.com", "twitter.com"] },
    threads: { label: "Threads", url: "https://www.threads.com/@sergeant_houseduck", hosts: ["threads.com", "www.threads.com", "threads.net"] },
    community: { label: "유튜브 소통 페이지", url: "https://www.youtube.com/@Sergeant_Houseduck", hosts: YOUTUBE_HOSTS },
  };
  const formId = (id) => id === "community" ? "tenkeyCommunityForm" : `tenkeyOutside_${id}`;
  const currentId = (id) => id === "community" ? "tenkeyCommunityCurrent" : `${formId(id)}Current`;
  const noteId = (id) => id === "community" ? "tenkeyCommunityNote" : `${formId(id)}Note`;
  const messageId = (id) => `${formId(id)}Message`;

  function validLink(id, url) {
    const match = /^https:\/\/([^/?#]+)\/[^\s\\]+$/.exec(url);
    return url.length <= 300 && !/[\x00-\x20\x7f]/.test(url) && !!match && LINKS[id].hosts.includes(match[1]);
  }

  function linkRows() {
    return Object.entries(LINKS).map(([id, spec]) => `<form id="${formId(id)}" class="admin-form impact-form" data-outside-link="${id}" novalidate>`
      + `<h3>${esc(spec.label)}</h3><p class="tk-update-link">지금 값: <a id="${currentId(id)}" target="_blank" rel="noopener noreferrer">불러오는 중</a><small id="${noteId(id)}"></small></p>`
      + `<label>새 주소<input name="url" type="url" maxlength="300" placeholder="${esc(spec.url)}" autocomplete="off"><small>허용 주소: ${esc(spec.hosts.join(" · "))}. 비우고 저장해도 기본 주소로 돌아갑니다.</small></label>`
      + `<label>변경 이유<input name="reason" maxlength="300" required></label><p id="${messageId(id)}" class="dashboard-message" role="status" aria-live="polite"></p>`
      + '<div class="form-actions"><button class="primary-button" type="submit" value="save" disabled>저장</button> <button class="secondary-button" type="submit" value="reset" disabled>기본 주소로 되돌리기</button></div></form>').join("");
  }

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
    T.fillKeep(byId("tenkeyReportsView"));
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

  function showLinks(values) {
    for (const [id, spec] of Object.entries(LINKS)) {
      const raw = typeof values[id] === "string" ? values[id] : "";
      const value = validLink(id, raw) ? raw : spec.url;
      const link = byId(currentId(id));
      link.textContent = value;
      link.href = value;
      const isDefault = value === spec.url;
      byId(noteId(id)).textContent = isDefault ? " (기본값)" : "";
      byId(formId(id)).elements.url.value = isDefault ? "" : value;
      byId(formId(id)).querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
  }

  async function loadCommunity() {
    for (const id of Object.keys(LINKS)) byId(formId(id)).querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const result = await T.call("config.get", {});
      const data = result?.data, values = data?.outside_links;
      const legacyValid = data && typeof data === "object" && !Array.isArray(data)
        && typeof data.community_url === "string" && (!data.community_url || validLink("community", data.community_url));
      const mapValid = values === undefined || (values && typeof values === "object" && !Array.isArray(values)
        && Object.keys(LINKS).every((id) => Object.prototype.hasOwnProperty.call(values, id)
          && typeof values[id] === "string" && (!values[id] || validLink(id, values[id])))
        && values.community === data.community_url);
      if (!legacyValid || !mapValid) throw new Error("console_invalid_response");
      showLinks({ community: data.community_url, ...(values || {}) });
    } catch (error) {
      T.report(messageId("community"), error);
    }
  }

  async function submitCommunity(event) {
    event.preventDefault();
    const form = event.target.closest("[data-outside-link]");
    if (!form) return;
    const id = form.dataset.outsideLink;
    const url = event.submitter?.value === "reset" ? "" : String(form.elements.url.value || "").trim();
    const reason = String(form.elements.reason.value || "").trim();
    if (!reason) { T.setMessage(messageId(id), "변경 이유를 입력해 주세요.", true); form.elements.reason.reportValidity(); return; }
    if (url && !validLink(id, url)) {
      T.setMessage(messageId(id), `${LINKS[id].label}: 허용된 https 주소를 입력해 주세요.`, true);
      return;
    }
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!await root.ConsoleApp.confirmChange(`10KEY ${LINKS[id].label} 변경`, [`새 주소: ${url || `(기본값) ${LINKS[id].url}`}`, `변경 이유: ${reason}`].join("\n"))) return;
      T.setMessage(messageId(id), "저장하는 중입니다...");
      const result = await T.call("links.set", { id, url, reason }, form);
      const values = result?.data?.links;
      if (result?.data?.ok !== true || !values || typeof values !== "object" || Array.isArray(values)
          || !Object.prototype.hasOwnProperty.call(values, id) || typeof values[id] !== "string") {
        throw new Error(result?.data?.error || "console_invalid_response");
      }
      // Only update this row: another row may have an unsaved edit or an in-flight request.
      const current = byId(currentId(id));
      const value = values[id] || LINKS[id].url;
      if (!validLink(id, value) || value !== (url || LINKS[id].url)) throw new Error("console_invalid_response");
      current.textContent = value; current.href = value;
      byId(noteId(id)).textContent = value === LINKS[id].url ? " (기본값)" : "";
      form.elements.url.value = value === LINKS[id].url ? "" : value;
      form.elements.reason.value = "";
      T.setMessage(messageId(id), "저장했습니다. 스토어 앱을 다음에 켤 때 적용됩니다.");
    } catch (error) {
      if (error.message === "invalid_url") T.setMessage(messageId(id), `${LINKS[id].label}: 허용된 https 주소를 입력해 주세요.`, true);
      else T.report(messageId(id), error);
    } finally {
      finish();
    }
  }

  function mountReports() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyOutsideLinks").innerHTML = linkRows();
      byId("tenkeyOutsideLinks").addEventListener("submit", submitCommunity);
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
