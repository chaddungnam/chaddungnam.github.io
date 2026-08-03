(function attachConsoleCs(root) {
  const state = { labels: null, summaries: [], nextPageToken: "", pageTokens: [""], page: 0, selected: null, selectedButton: null, bound: false, loading: false };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const header = (message, name) => root.GmailModel.headerValue(message?.payload?.headers || [], name);
  const time = (value) => value ? new Date(Number(value)).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";

  function setMessage(value, error = false) {
    byId("csMessage").textContent = value;
    byId("csMessage").style.color = error ? "var(--coral)" : "";
  }

  function setConnected(connected) {
    byId("gmailConnectPanel").hidden = connected;
    byId("csWorkspace").hidden = !connected;
  }

  function threadData(thread) {
    const messages = [...(thread?.messages || [])].sort((left, right) => Number(left.internalDate || 0) - Number(right.internalDate || 0));
    const latest = messages.at(-1) || {};
    const labelIds = [...new Set(messages.flatMap((message) => message.labelIds || []))];
    const latestFromSupport = root.GmailModel.mailboxAddress(header(latest, "From")) === "support@houseduck.in";
    const status = root.GmailModel.csThreadState({ labelIds, latestFromSupport, latestAt: Number(latest.internalDate || 0) }, state.labels.status);
    const category = Object.entries(state.labels.category).find(([, id]) => labelIds.includes(id))?.[0] || "";
    return {
      id: thread.id, messages, latest, labelIds, latestFromSupport,
      sender: header(latest, "From") || "보낸 사람 미상",
      subject: header(latest, "Subject") || "제목 없음",
      latestAt: Number(latest.internalDate || 0),
      snippet: thread.snippet || "",
      unread: labelIds.includes("UNREAD"), category, ...status,
    };
  }

  function statusLabel(status) {
    return ({ new: "새 문의", needs_reply: "답변 필요", waiting_customer: "사용자 회신 대기", done: "완료" })[status] || status;
  }

  function renderList(resultSizeEstimate = 0) {
    byId("csResultCount").textContent = `약 ${Number(resultSizeEstimate).toLocaleString("ko-KR")}건`;
    byId("csPrevious").disabled = state.page === 0;
    byId("csNext").disabled = !state.nextPageToken;
    byId("csThreadList").innerHTML = state.summaries.length ? state.summaries.map((row) => `<button class="cs-thread-item" type="button" data-thread-id="${row.id}" data-status="${row.status}" data-urgent="${row.urgent}"><span><strong>${escapeHtml(row.sender)}</strong><small>${escapeHtml(time(row.latestAt))}</small></span><b>${escapeHtml(row.subject)}</b><p>${escapeHtml(row.snippet)}</p><i>${escapeHtml(statusLabel(row.status))}${row.category ? ` · ${escapeHtml(row.category)}` : ""}${row.unread ? " · 읽지 않음" : ""}</i></button>`).join("") : '<p class="empty-panel">조건과 일치하는 문의가 없습니다.</p>';
    byId("csThreadList").querySelectorAll("[data-thread-id]").forEach((button) => button.addEventListener("click", () => openThread(button.dataset.threadId, button)));
  }

  async function loadList(reset = false) {
    if (state.loading) return;
    if (reset) { state.page = 0; state.pageTokens = [""]; }
    state.loading = true;
    setMessage("support@houseduck.in 문의를 불러오는 중...");
    try {
      const status = byId("csStatusFilter").value;
      const category = byId("csCategoryFilter").value;
      const filters = [category ? state.labels.category[category] : ""].filter(Boolean);
      const page = await root.GmailAPI.listSupportThreads({
        query: byId("csSearch").value,
        labelIds: filters,
        pageToken: state.pageTokens[state.page] || "",
        unread: byId("csUnreadFilter").checked,
        newerThanDays: Number(byId("csDateFilter").value),
      });
      const summaries = await Promise.allSettled((page.threads || []).map((thread) => root.GmailAPI.getThreadSummary(thread.id)));
      const classified = summaries.filter((result) => result.status === "fulfilled").map((result) => threadData(result.value));
      await Promise.allSettled(classified
        .filter((row) => !row.labelIds.includes(state.labels.status[row.status]))
        .map((row) => root.GmailAPI.setThreadStatus(row.id, row.status, row.category, row.labelIds)));
      state.summaries = status ? classified.filter((row) => row.status === status) : classified;
      state.nextPageToken = page.nextPageToken || "";
      renderList(status ? state.summaries.length : page.resultSizeEstimate || state.summaries.length);
      setMessage("목록에는 support@houseduck.in으로 들어온 문의만 표시됩니다.");
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
    const statuses = ["new", "needs_reply", "waiting_customer", "done"];
    const categories = ["billing", "account", "bug", "other"];
    byId("csLabels").innerHTML = `<div><span>상태</span>${statuses.map((value) => `<button type="button" data-cs-status="${value}" aria-pressed="${detail.status === value}">${statusLabel(value)}</button>`).join("")}</div><div><span>분류</span>${categories.map((value) => `<button type="button" data-cs-category="${value}" aria-pressed="${detail.category === value}">${({ billing: "결제", account: "계정", bug: "버그", other: "기타" })[value]}</button>`).join("")}</div>`;
    byId("csLabels").querySelectorAll("[data-cs-status]").forEach((button) => button.addEventListener("click", () => updateLabels(button.dataset.csStatus, detail.category)));
    byId("csLabels").querySelectorAll("[data-cs-category]").forEach((button) => button.addEventListener("click", () => updateLabels(detail.status, button.dataset.csCategory)));
  }

  async function findPlayer(detail) {
    const visibleText = `${detail.subject}\n${detail.messages.map((message) => root.GmailModel.extractMessageText(message.payload)).join("\n")}`;
    const displayCode = root.GmailModel.extractDisplayCode(visibleText);
    if (!displayCode) { byId("csPlayerMatches").replaceChildren(); return; }
    try {
      const result = await root.ConsoleAPI.post("admin-console", { action: "players.list", rangeDays: 0, query: displayCode, sort: "latest_played_at", direction: "desc", page: 1 });
      byId("csPlayerMatches").innerHTML = `<div class="cs-player-match"><strong>연결 가능한 플레이어 · ${escapeHtml(displayCode)}</strong>${(result.rows || []).map((row) => `<a href="#/players/${encodeURIComponent(row.user_id)}?return=${encodeURIComponent("#/cs")}">${escapeHtml(root.ConsoleModel.playerDisplayName({ nickname: row.nickname, displayCode: row.display_code }))}</a>`).join("") || "<small>일치 계정 없음</small>"}</div>`;
    } catch (_error) {
      byId("csPlayerMatches").innerHTML = '<p class="empty-panel">플레이어 검색을 완료하지 못했습니다.</p>';
    }
  }

  async function openThread(threadId, sourceButton = null) {
    setMessage("문의 내용을 불러오는 중...");
    try {
      const raw = await root.GmailAPI.getThread(threadId);
      const detail = threadData(raw);
      state.selected = detail;
      state.selectedButton = sourceButton || state.selectedButton;
      if (!detail.labelIds.includes(state.labels.status[detail.status])) {
        await root.GmailAPI.setThreadStatus(threadId, detail.status, detail.category);
      }
      byId("csThreadHeader").innerHTML = `<p class="eyebrow">${escapeHtml(statusLabel(detail.status))}</p><h2>${escapeHtml(detail.subject)}</h2><small>${escapeHtml(detail.sender)} · ${escapeHtml(time(detail.latestAt))}</small>`;
      renderLabelControls(detail);
      renderMessages(detail);
      await findPlayer(detail);
      const latestExternal = [...detail.messages].reverse().find((message) => root.GmailModel.mailboxAddress(header(message, "From")) !== "support@houseduck.in") || detail.latest;
      byId("csReplyForm").elements.to.value = header(latestExternal, "Reply-To") || header(latestExternal, "From");
      byId("csReplyForm").elements.subject.value = /^re:/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`;
      byId("csThreadPanel").classList.add("active");
      byId("csReplyPanel").classList.add("active");
      byId("csThreadPanel").focus({ preventScroll: true });
      setMessage("메일 본문은 텍스트로만 표시하며 원격 이미지는 불러오지 않습니다.");
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
    const reply = {
      threadId: state.selected.id, from: form.elements.from.value, to: form.elements.to.value,
      subject: form.elements.subject.value, body: form.elements.body.value, attachments, category: state.selected.category,
    };
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
      setMessage(outcome.statusUpdated
        ? "답변을 발송하고 상태를 사용자 회신 대기로 바꿨습니다."
        : "답변은 발송됐습니다. 상태 라벨 변경은 실패했으므로 다시 보내지 말고 문의를 다시 열어 주세요.", !outcome.statusUpdated);
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
    byId("csThreadPanel").classList.remove("active");
    byId("csReplyPanel").classList.remove("active");
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
  }

  function mount() {
    bind();
    const params = new URLSearchParams(root.location.hash.split("?")[1] || "");
    if (params.get("userId") && !byId("csSearch").value) byId("csSearch").value = params.get("userId");
    setConnected(root.GmailAPI.isAuthorized());
    if (root.GmailAPI.isAuthorized()) connect();
    else setMessage("CS를 열 때만 Gmail 권한을 요청합니다.");
  }

  root.ConsoleCs = { mount };
})(window);
