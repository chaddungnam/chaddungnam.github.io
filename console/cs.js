(function attachConsoleCs(root) {
  const STATUS = ["new", "needs_reply", "waiting_customer", "done"];
  const CATEGORY_LABELS = { billing: "결제", account: "계정", bug: "버그", other: "기타" };
  const COLUMN_IDS = { new: "New", needs_reply: "NeedsReply", waiting_customer: "WaitingCustomer", done: "Done" };
  const state = {
    labels: null, summaries: [], nextPageToken: "", pageTokens: [""], page: 0,
    selected: null, selectedButton: null, bound: false, loading: false,
    view: "kanban", calendarRange: "week", calendarDate: new Date(), dateFilter: "",
    summaryCache: new Map(),
  };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const header = (message, name) => root.GmailModel.headerValue(message?.payload?.headers || [], name);
  const time = (value) => value ? new Date(Number(value)).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const shortDate = (value) => new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });

  function setMessage(value, error = false) {
    byId("csMessage").textContent = value;
    byId("csMessage").style.color = error ? "var(--coral)" : "";
  }

  function setConnected(connected) {
    byId("gmailConnectPanel").hidden = connected;
    byId("csWorkspace").hidden = !connected;
  }

  function statusLabel(status) {
    return ({ new: "새 문의", needs_reply: "답변 필요", waiting_customer: "사용자 회신 대기", done: "완료" })[status] || status;
  }

  function threadData(thread) {
    const messages = [...(thread?.messages || [])].sort((left, right) => Number(left.internalDate || 0) - Number(right.internalDate || 0));
    const latest = messages.at(-1) || {};
    const labelIds = [...new Set(messages.flatMap((message) => message.labelIds || []))];
    const latestFromSupport = root.GmailModel.mailboxAddress(header(latest, "From")) === "support@houseduck.in";
    const status = root.GmailModel.csThreadState({ labelIds, latestFromSupport, latestAt: Number(latest.internalDate || 0) }, state.labels.status);
    const category = Object.entries(state.labels.category).find(([, id]) => labelIds.includes(id))?.[0] || "";
    const subject = header(latest, "Subject") || "제목 없음";
    const snippet = thread.snippet || "";
    const cardSummary = root.CsIntelligence.localSummary({ subject, text: snippet });
    return {
      id: thread.id, messages, latest, labelIds, latestFromSupport, subject, snippet, cardSummary,
      sender: header(latest, "From") || "보낸 사람 미상", latestAt: Number(latest.internalDate || 0),
      unread: labelIds.includes("UNREAD"), category, ...status,
    };
  }

  function visibleRows() {
    return state.dateFilter
      ? state.summaries.filter((row) => root.CsIntelligence.dateKey(row.latestAt) === state.dateFilter)
      : state.summaries;
  }

  function cardMarkup(row) {
    const category = row.category || row.cardSummary.category;
    return `<button class="cs-thread-item" type="button" data-thread-id="${escapeHtml(row.id)}" data-status="${row.status}" data-urgent="${row.urgent}" data-selected="${state.selected?.id === row.id}"><span><strong>${escapeHtml(row.sender)}</strong><small>${escapeHtml(time(row.latestAt))}</small></span><b>${escapeHtml(row.subject)}</b><p>${escapeHtml(row.cardSummary.summary || row.snippet)}</p><i>${escapeHtml(CATEGORY_LABELS[category] || "미분류")}${row.unread ? " · 읽지 않음" : ""}${row.urgent ? " · 24시간+" : ""}</i></button>`;
  }

  function bindThreadButtons(container) {
    container.querySelectorAll("[data-thread-id]").forEach((button) => button.addEventListener("click", () => openThread(button.dataset.threadId, button)));
  }

  function renderKanban() {
    const rows = visibleRows();
    for (const status of STATUS) {
      const statusRows = rows.filter((row) => row.status === status);
      const suffix = COLUMN_IDS[status];
      byId(`csCount${suffix}`).textContent = statusRows.length;
      const list = byId(`csColumn${suffix}`);
      list.innerHTML = statusRows.length ? statusRows.map(cardMarkup).join("") : '<p class="empty-panel">문의 없음</p>';
      bindThreadButtons(list);
    }
    byId("csResultCount").textContent = state.dateFilter ? `${state.dateFilter} · ${rows.length}건` : `불러온 ${state.summaries.length}건`;
    byId("csPrevious").disabled = state.page === 0;
    byId("csNext").disabled = !state.nextPageToken;
  }

  function renderBrief() {
    const rows = state.summaries.map((row) => ({ ...row, category: row.category || row.cardSummary.category }));
    const brief = root.CsIntelligence.weeklyBrief(rows);
    byId("csBriefHeadline").textContent = brief.headline;
    byId("csBriefTotal").textContent = brief.total.toLocaleString("ko-KR");
    byId("csBriefReply").textContent = brief.needsReply.toLocaleString("ko-KR");
    byId("csBriefUrgent").textContent = brief.urgent.toLocaleString("ko-KR");
    byId("csBriefCategory").textContent = CATEGORY_LABELS[brief.topCategory] || "—";
  }

  function calendarCell(date, buckets, outside = false) {
    const key = root.CsIntelligence.dateKey(date);
    const rows = buckets.get(key) || [];
    const needsReply = rows.filter((row) => row.status === "needs_reply").length;
    const subjects = rows.slice(0, 2).map((row) => row.subject).join(" · ");
    return `<button class="cs-calendar-cell" type="button" data-calendar-date="${key}" data-outside="${outside}"><strong>${escapeHtml(shortDate(date))}</strong><small>${rows.length ? `${rows.length}건${needsReply ? ` · 답변 ${needsReply}` : ""}` : "문의 없음"}</small>${subjects ? `<small>${escapeHtml(subjects)}</small>` : ""}</button>`;
  }

  function renderCalendar() {
    const grid = byId("csCalendarGrid");
    const buckets = root.CsIntelligence.bucketByLocalDate(state.summaries);
    grid.dataset.range = state.calendarRange;
    if (state.calendarRange === "year") {
      const months = root.CsIntelligence.yearMonths(state.calendarDate);
      byId("csCalendarTitle").textContent = `${state.calendarDate.getFullYear()}년 문의`;
      grid.innerHTML = months.map((date) => {
        const rows = state.summaries.filter((row) => {
          const rowDate = new Date(row.latestAt);
          return rowDate.getFullYear() === date.getFullYear() && rowDate.getMonth() === date.getMonth();
        });
        return `<button class="cs-calendar-month" type="button" data-calendar-month="${date.getMonth()}"><strong>${date.getMonth() + 1}월</strong><b>${rows.length}건</b><span>답변 필요 ${rows.filter((row) => row.status === "needs_reply").length}건</span></button>`;
      }).join("");
      grid.querySelectorAll("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => {
        state.calendarDate = new Date(state.calendarDate.getFullYear(), Number(button.dataset.calendarMonth), 1);
        setCalendarRange("month");
      }));
      return;
    }
    const dates = state.calendarRange === "month"
      ? root.CsIntelligence.monthGrid(state.calendarDate)
      : Array.from({ length: 7 }, (_, index) => root.CsIntelligence.addLocalDays(root.CsIntelligence.startOfWeek(state.calendarDate), index));
    const month = state.calendarDate.getMonth();
    byId("csCalendarTitle").textContent = state.calendarRange === "month"
      ? `${state.calendarDate.getFullYear()}년 ${month + 1}월`
      : `${shortDate(dates[0])} – ${shortDate(dates[6])}`;
    grid.innerHTML = dates.map((date) => calendarCell(date, buckets, state.calendarRange === "month" && date.getMonth() !== month)).join("");
    grid.querySelectorAll("[data-calendar-date]").forEach((button) => button.addEventListener("click", () => {
      state.dateFilter = button.dataset.calendarDate;
      showView("kanban", true);
      setMessage(`${state.dateFilter}에 들어온 문의만 표시합니다. 칸반 버튼을 누르면 전체로 돌아갑니다.`);
    }));
  }

  function showView(view, preserveDate = false) {
    state.view = view;
    if (!preserveDate) state.dateFilter = "";
    byId("csKanban").hidden = view !== "kanban";
    byId("csCalendar").hidden = view !== "calendar";
    document.querySelectorAll("[data-cs-view]").forEach((button) => button.classList.toggle("active", button.dataset.csView === view));
    if (view === "calendar") renderCalendar();
    else renderKanban();
  }

  function setCalendarRange(range) {
    state.calendarRange = range;
    document.querySelectorAll("[data-calendar-range]").forEach((button) => button.classList.toggle("active", button.dataset.calendarRange === range));
    renderCalendar();
  }

  function shiftCalendar(direction) {
    const date = new Date(state.calendarDate);
    if (state.calendarRange === "week") date.setDate(date.getDate() + direction * 7);
    if (state.calendarRange === "month") date.setMonth(date.getMonth() + direction);
    if (state.calendarRange === "year") date.setFullYear(date.getFullYear() + direction);
    state.calendarDate = date;
    renderCalendar();
  }

  function renderAll(resultSizeEstimate = 0) {
    renderBrief();
    renderKanban();
    if (state.view === "calendar") renderCalendar();
    if (!state.dateFilter && resultSizeEstimate > state.summaries.length) byId("csResultCount").textContent = `약 ${Number(resultSizeEstimate).toLocaleString("ko-KR")}건 · 현재 ${state.summaries.length}건`;
  }

  async function loadList(reset = false) {
    if (state.loading) return;
    if (reset) { state.page = 0; state.pageTokens = [""]; state.dateFilter = ""; }
    state.loading = true;
    setMessage("support@houseduck.in 문의를 불러오는 중...");
    try {
      const status = byId("csStatusFilter").value;
      const category = byId("csCategoryFilter").value;
      const filters = [category ? state.labels.category[category] : ""].filter(Boolean);
      const page = await root.GmailAPI.listSupportThreads({
        query: byId("csSearch").value, labelIds: filters,
        pageToken: state.pageTokens[state.page] || "", unread: byId("csUnreadFilter").checked,
        newerThanDays: Number(byId("csDateFilter").value),
      });
      const summaries = await Promise.allSettled((page.threads || []).map((thread) => root.GmailAPI.getThreadSummary(thread.id)));
      const classified = summaries.filter((result) => result.status === "fulfilled").map((result) => threadData(result.value));
      await Promise.allSettled(classified.filter((row) => !row.labelIds.includes(state.labels.status[row.status])).map((row) => root.GmailAPI.setThreadStatus(row.id, row.status, row.category, row.labelIds)));
      state.summaries = status ? classified.filter((row) => row.status === status) : classified;
      state.nextPageToken = page.nextPageToken || "";
      renderAll(page.resultSizeEstimate || state.summaries.length);
      setMessage("문의판은 페이지당 최대 20건만 불러오고 각 칸 안에서 스크롤됩니다.");
    } catch (error) {
      if (error?.message === "gmail_reconnect_required") setConnected(false);
      setMessage(`문의를 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      state.loading = false;
    }
  }

  function renderMessages(detail) {
    const container = byId("csMessages");
    container.replaceChildren();
    for (const message of detail.messages) {
      const article = document.createElement("article");
      article.className = "cs-message-card";
      const heading = document.createElement("div");
      const sender = document.createElement("strong");
      sender.textContent = header(message, "From") || "보낸 사람 미상";
      const sentAt = document.createElement("small");
      sentAt.textContent = time(message.internalDate);
      heading.append(sender, sentAt);
      const body = document.createElement("pre");
      body.textContent = root.GmailModel.extractMessageText(message.payload);
      article.append(heading, body);
      for (const attachment of root.GmailModel.listAttachments(message.payload)) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `첨부 받기 · ${attachment.filename} (${Math.ceil(attachment.size / 1024)}KB)`;
        button.addEventListener("click", () => downloadAttachment(message.id, attachment));
        article.append(button);
      }
      container.append(article);
    }
  }

  function renderLabelControls(detail) {
    const categories = ["billing", "account", "bug", "other"];
    byId("csLabels").innerHTML = `<div><span>상태</span>${STATUS.map((value) => `<button type="button" data-cs-status="${value}" aria-pressed="${detail.status === value}">${statusLabel(value)}</button>`).join("")}</div><div><span>분류</span>${categories.map((value) => `<button type="button" data-cs-category="${value}" aria-pressed="${detail.category === value}">${CATEGORY_LABELS[value]}</button>`).join("")}</div>`;
    byId("csLabels").querySelectorAll("[data-cs-status]").forEach((button) => button.addEventListener("click", () => updateLabels(button.dataset.csStatus, detail.category)));
    byId("csLabels").querySelectorAll("[data-cs-category]").forEach((button) => button.addEventListener("click", () => updateLabels(detail.status, button.dataset.csCategory)));
  }

  function renderThreadSummary(summary) {
    const container = byId("csThreadSummary");
    container.hidden = false;
    container.innerHTML = `<span>${summary.source === "ai" ? "AI" : "로컬"}</span><strong>${escapeHtml(CATEGORY_LABELS[summary.category] || "기타")} · ${summary.urgency === "high" ? "우선 확인" : "일반"}</strong><p>${escapeHtml(summary.summary)}</p>`;
  }

  async function summarizeThread(detail, latestExternal) {
    const text = root.GmailModel.extractMessageText(latestExternal.payload);
    const local = root.CsIntelligence.localSummary({ subject: detail.subject, text });
    renderThreadSummary(local);
    const cacheKey = latestExternal.id || `${detail.id}:${latestExternal.internalDate || "latest"}`;
    if (state.summaryCache.has(cacheKey)) {
      renderThreadSummary(state.summaryCache.get(cacheKey));
      return;
    }
    const redacted = root.CsIntelligence.redactForSummary(text);
    if (redacted.length < 8) { state.summaryCache.set(cacheKey, local); return; }
    try {
      const result = await root.ConsoleAPI.post("cs-summarize", { text: redacted });
      const summary = {
        summary: String(result.summary || "").trim().slice(0, 180),
        category: CATEGORY_LABELS[result.category] ? result.category : local.category,
        urgency: result.urgency === "high" ? "high" : "normal",
        source: "ai",
      };
      if (!summary.summary) throw new Error("empty_summary");
      state.summaryCache.set(cacheKey, summary);
      if (state.selected?.id === detail.id) renderThreadSummary(summary);
    } catch (_error) {
      state.summaryCache.set(cacheKey, local);
    }
  }

  async function findPlayer(detail) {
    const visibleText = `${detail.subject}\n${detail.messages.map((message) => root.GmailModel.extractMessageText(message.payload)).join("\n")}`;
    const displayCode = root.GmailModel.extractDisplayCode(visibleText);
    if (!displayCode) { byId("csPlayerMatches").replaceChildren(); return; }
    try {
      const result = await root.ConsoleAPI.post("admin-console", { action: "players.list", rangeDays: 0, query: displayCode, sort: "latest_played_at", direction: "desc", page: 1 });
      byId("csPlayerMatches").innerHTML = `<div class="cs-player-match"><strong>연결 가능한 플레이어 · ${escapeHtml(displayCode)}</strong>${(result.rows || []).map((row) => root.ConsoleModel.playerIdentityMarkup(row, "#/cs")).join("") || "<small>일치 계정 없음</small>"}</div>`;
    } catch (_error) {
      byId("csPlayerMatches").innerHTML = '<p class="empty-panel">플레이어 검색을 완료하지 못했습니다.</p>';
    }
  }

  async function openThread(threadId, sourceButton = null) {
    setMessage("문의 내용을 불러오는 중...");
    try {
      const detail = threadData(await root.GmailAPI.getThread(threadId));
      state.selected = detail;
      state.selectedButton = sourceButton || state.selectedButton;
      if (!detail.labelIds.includes(state.labels.status[detail.status])) await root.GmailAPI.setThreadStatus(threadId, detail.status, detail.category);
      byId("csThreadHeader").innerHTML = `<p class="eyebrow">${escapeHtml(statusLabel(detail.status))}</p><h2>${escapeHtml(detail.subject)}</h2><small>${escapeHtml(detail.sender)} · ${escapeHtml(time(detail.latestAt))}</small>`;
      renderLabelControls(detail);
      renderMessages(detail);
      renderKanban();
      await findPlayer(detail);
      const latestExternal = [...detail.messages].reverse().find((message) => root.GmailModel.mailboxAddress(header(message, "From")) !== "support@houseduck.in") || detail.latest;
      summarizeThread(detail, latestExternal);
      byId("csReplyForm").elements.to.value = header(latestExternal, "Reply-To") || header(latestExternal, "From");
      byId("csReplyForm").elements.subject.value = /^re:/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`;
      byId("csThreadPanel").focus({ preventScroll: true });
      if (root.matchMedia("(max-width: 760px)").matches) byId("csThreadPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage("본문은 텍스트로만 표시하고, 요약에는 개인정보를 제거한 최신 문의만 사용합니다.");
    } catch (error) {
      setMessage(`문의를 열지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  async function updateLabels(status, category) {
    if (!state.selected) return;
    try {
      await root.GmailAPI.setThreadStatus(state.selected.id, status, category);
      await openThread(state.selected.id);
      await loadList();
    } catch (error) {
      setMessage(`상태를 바꾸지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  async function downloadAttachment(messageId, attachment) {
    try {
      const result = await root.GmailAPI.getAttachment(messageId, attachment.attachmentId);
      const bytes = root.GmailModel.decodeBase64Url(result.data);
      if (!bytes) throw new Error("invalid_attachment");
      const url = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      link.click();
      root.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setMessage(`첨부파일을 받지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!state.selected) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const files = [...form.elements.attachments.files];
    if (files.some((file) => file.size > 10 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
      setMessage("첨부는 파일당 10MB, 전체 20MB까지 가능합니다.", true);
      return;
    }
    const attachments = await Promise.all(files.map(async (file) => ({ filename: file.name, mimeType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) })));
    const reply = { threadId: state.selected.id, from: form.elements.from.value, to: form.elements.to.value, subject: form.elements.subject.value, body: form.elements.body.value, attachments, category: state.selected.category };
    const review = `보내는 주소: ${reply.from}\n받는 사람: ${reply.to}\n제목: ${reply.subject}\n첨부: ${files.map((file) => file.name).join(", ") || "없음"}\n\n${reply.body}`;
    if (!await root.ConsoleApp.confirmChange("답변 발송 최종 확인", review)) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const outcome = await root.GmailAPI.sendReply(reply);
      form.elements.body.value = "";
      form.elements.attachments.value = "";
      state.selected.status = "waiting_customer";
      state.selected.latestFromSupport = true;
      renderLabelControls(state.selected);
      setMessage(outcome.statusUpdated ? "답변을 발송하고 상태를 사용자 회신 대기로 바꿨습니다." : "답변은 발송됐습니다. 상태 라벨 변경은 실패했으므로 다시 보내지 말고 문의를 다시 열어 주세요.", !outcome.statusUpdated);
    } catch (error) {
      setMessage(error?.message === "gmail_send_rejected" ? "Gmail이 발송을 거부했습니다. 발신 별칭과 받는 주소를 확인해 주세요. 작성 내용은 유지했습니다." : `답변을 발송하지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      button.disabled = false;
    }
  }

  async function connect() {
    setMessage("Google Gmail 권한 확인 중...");
    try {
      await root.GmailAPI.authorize();
      state.labels = await root.GmailAPI.ensureCsLabels();
      setConnected(true);
      await loadList(true);
    } catch (error) {
      setConnected(false);
      setMessage(`Gmail을 연결하지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  function closeThread() {
    byId("csKanban").scrollIntoView({ behavior: "smooth", block: "start" });
    state.selectedButton?.focus({ preventScroll: true });
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    byId("gmailConnectButton").addEventListener("click", connect);
    byId("gmailDisconnectButton").addEventListener("click", () => { root.GmailAPI.disconnect(); setConnected(false); setMessage("Gmail CS 연결을 해제했습니다."); });
    byId("csFilterForm").addEventListener("submit", (event) => { event.preventDefault(); loadList(true); });
    byId("csPrevious").addEventListener("click", () => { if (state.page > 0) { state.page -= 1; loadList(); } });
    byId("csNext").addEventListener("click", () => { if (state.nextPageToken) { state.page += 1; state.pageTokens[state.page] = state.nextPageToken; loadList(); } });
    byId("csThreadBack").addEventListener("click", closeThread);
    byId("csTemplate").addEventListener("change", (event) => { if (event.target.value) byId("csReplyForm").elements.body.value = root.CsTemplates[event.target.value]; });
    byId("csReplyForm").addEventListener("submit", sendReply);
    document.querySelectorAll("[data-cs-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.csView)));
    document.querySelectorAll("[data-calendar-range]").forEach((button) => button.addEventListener("click", () => setCalendarRange(button.dataset.calendarRange)));
    byId("csCalendarPrevious").addEventListener("click", () => shiftCalendar(-1));
    byId("csCalendarNext").addEventListener("click", () => shiftCalendar(1));
    byId("csCalendarToday").addEventListener("click", () => { state.calendarDate = new Date(); renderCalendar(); });
  }

  function mount() {
    bind();
    const params = new URLSearchParams(root.location.hash.split("?")[1] || "");
    if (params.get("userId") && !byId("csSearch").value) byId("csSearch").value = params.get("userId");
    setConnected(root.GmailAPI.isAuthorized());
    showView(state.view);
    if (root.GmailAPI.isAuthorized()) connect();
    else setMessage("CS를 열 때만 Gmail 권한을 요청합니다.");
  }

  root.ConsoleCs = { mount };
})(window);
