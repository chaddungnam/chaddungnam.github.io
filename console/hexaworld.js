(function attachConsoleHexaworld(root) {
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const number = (value) => Number(value ?? 0).toLocaleString("ko-KR");
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const prettyJson = (value) => value == null ? "없음" : JSON.stringify(value, null, 2);

  // starts_at/ends_at and the datetime-local inputs are always shown/read as KST regardless of the
  // admin's own browser timezone, computed by hand (no Intl timezone dependency).
  const KST_OFFSET_MIN = 9 * 60;
  function isoToKstInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const shifted = new Date(date.getTime() + KST_OFFSET_MIN * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
  }
  function kstInputToIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const [y, mo, d, h, mi] = match.slice(1).map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MIN * 60000).toISOString();
  }

  const CATEGORY_LABELS = { notice: "[공지]", event: "[이벤트]", update: "[업데이트]", maintenance: "[점검]" };
  const CURRENCY_LABELS = { coins: "코인", gems: "젬", keys: "열쇠", parts: "부품" };
  const CURRENCY_LIMITS = { coins: 10_000_000, gems: 100_000, keys: 1_000, parts: 10_000_000 };
  const HX_ACTION_LABELS = {
    "notices.upsert": "공지 저장", "notices.delete": "공지 삭제",
    "attendance.set": "출석 보상 설정", "mail.broadcast": "전체 우편 발송", "config.set": "앱 설정 변경",
  };
  const HX_ERROR_MESSAGES = {
    admin_session_required: "HEXAWORLD 세션이 만료되었습니다.",
    admin_required: "이 계정은 HEXAWORLD 관리자 목록에 없습니다.",
    origin_not_allowed: "허용되지 않은 주소에서 접속했습니다. houseduck.in에서 다시 열어 주세요.",
    admin_check_failed: "관리자 확인 서버에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    unknown_action: "지원하지 않는 요청입니다.",
    invalid_json: "요청 형식을 확인해 주세요.",
    method_not_allowed: "요청 방식을 확인해 주세요.",
    console_invalid_response: "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    console_request_failed: "요청을 처리하지 못했습니다.",
    invalid_title: "제목을 확인해 주세요 (한국어 1~80자, 영어 80자 이하).",
    invalid_body: "본문을 확인해 주세요 (한국어 1~2000자, 영어 2000자 이하).",
    invalid_link: "링크 URL은 http:// 또는 https://로 시작해야 합니다.",
    invalid_image: "이미지 URL은 https://로 시작해야 합니다.",
    invalid_category: "분류를 확인해 주세요.",
    invalid_starts_at: "게시 시작 시각(KST)을 확인해 주세요.",
    invalid_ends_at: "게시 종료는 시작 이후 시각이어야 합니다.",
    not_found: "이미 삭제되었거나 존재하지 않는 항목입니다. 목록을 새로고침해 주세요.",
    invalid_rewards: "출석 보상 형식을 확인해 주세요.",
    invalid_cycle_length: "출석 일수는 1~28일이어야 합니다.",
    days_must_be_1_to_n: "일차는 1부터 빠짐없이 연속되어야 합니다.",
    invalid_reward: "보상 값을 확인해 주세요 (한도를 초과했거나 형식이 올바르지 않습니다).",
    invalid_text: "제목·본문 길이를 확인해 주세요.",
    invalid_expiry: "수령 기한은 1~30일이어야 합니다.",
    invalid_maintenance_msg: "점검 안내문(한국어)을 입력해 주세요 (300자 이하). 사용하지 않으려면 두 언어 모두 비워두세요.",
    invalid_feature_flags: "기능 플래그는 JSON 객체 형식이어야 합니다.",
    min_version_above_latest: "최소 지원 버전 코드는 최신 버전 코드보다 클 수 없습니다.",
  };

  function hxErrorText(error) {
    if (error?.message === "rpc_failed") {
      return HX_ERROR_MESSAGES[error.detail] || `저장하지 못했습니다: ${error.detail || "알 수 없는 오류"}`;
    }
    const base = HX_ERROR_MESSAGES[error?.message] || `요청을 처리하지 못했습니다: ${error?.message || "알 수 없는 오류"}`;
    return Number.isInteger(error?.day) || typeof error?.day === "string" ? `${base} (${error.day}일차)` : base;
  }
  function hxActionLabel(action) { return HX_ACTION_LABELS[action] || action || "알 수 없는 작업"; }

  const state = {
    bound: { overview: false, notices: false, attendance: false, mail: false, config: false, audit: false },
    notices: new Map(),
    attendanceCycle: [],
    config: null,
    auditLimit: 50,
  };
  const pendingRequests = new WeakMap();

  function setMessage(id, value, error = false) {
    const el = byId(id);
    root.ConsoleUiState.setMessage(el, value, error);
    el.style.color = error ? "var(--coral)" : "";
    const stray = el.nextElementSibling;
    if (stray?.dataset?.hexaworldAuthRecovery === "true") stray.remove();
  }

  // 403 admin_session_required / admin_required: never call ConsoleAuth.requireChallenge() here —
  // that would clear the unrelated Quirky Ball ticket. Offer the same Google Sign-In button inline
  // instead so the admin can refresh their Google identity without losing the QB session.
  function renderAuthRecovery(messageElId, error) {
    setMessage(messageElId, hxErrorText(error), true);
    const messageEl = byId(messageElId);
    const panel = document.createElement("div");
    panel.dataset.hexaworldAuthRecovery = "true";
    panel.className = "read-only-banner hexaworld-auth-recovery";
    const text = document.createElement("p");
    text.textContent = error.message === "admin_session_required"
      ? "Google 로그인이 만료되어 HEXAWORLD 서버가 요청을 거부했습니다. 아래 버튼으로 Google에 다시 로그인해 주세요."
      : "이 Google 계정은 HEXAWORLD 관리자 목록에 없습니다. 다른 관리자 계정으로 전환해 주세요.";
    const buttonHost = document.createElement("div");
    panel.append(text, buttonHost);
    messageEl.insertAdjacentElement("afterend", panel);
    root.ConsoleAuth.renderGoogleButton(buttonHost, { text: "signin_with", size: "medium" });
  }

  function reportError(messageElId, error) {
    if (error?.status === 403 && (error.message === "admin_session_required" || error.message === "admin_required")) {
      renderAuthRecovery(messageElId, error);
    } else {
      setMessage(messageElId, hxErrorText(error), true);
    }
  }

  // Unwraps {ok, data, auth_mode}. RPC-level validation failures arrive as HTTP 200 with
  // data.ok === false and are re-thrown as a normal Error so every caller uses one catch path.
  function unwrap(result) {
    if (result?.data && typeof result.data === "object" && result.data.ok === false) {
      throw Object.assign(new Error(result.data.error || "rpc_failed"), { day: result.data.day });
    }
    return result;
  }
  async function callHx(action, params) {
    return unwrap(await root.ConsoleAPI.postProject("hexaworld", "hx-admin", { action, params }));
  }
  // Writes get a fresh request_id per call, reused only when the exact same payload is retried
  // from the same form (network hiccup), so a retry never double-applies.
  async function callHxWrite(action, params, formKey) {
    const fingerprint = JSON.stringify({ action, params });
    const pending = pendingRequests.get(formKey);
    const request_id = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
    pendingRequests.set(formKey, { fingerprint, requestId: request_id });
    try {
      const result = unwrap(await root.ConsoleAPI.postProject("hexaworld", "hx-admin", { action, params, request_id }));
      pendingRequests.delete(formKey);
      return result;
    } catch (error) {
      if (Number(error?.status) >= 400 && Number(error?.status) < 500) pendingRequests.delete(formKey);
      throw error;
    }
  }

  function bindCounter(form, fieldName, counterKey, max) {
    const input = form.elements[fieldName];
    const counter = form.querySelector(`[data-counter="${counterKey}"]`);
    if (!input || !counter) return;
    const update = () => { counter.textContent = `${input.value.length} / ${max}자`; };
    input.addEventListener("input", update);
    update();
  }

  // ─────────────────────────────────────────── overview
  function renderOverview(data, authMode) {
    const config = data.config || {};
    byId("hexaworldOverviewSummary").innerHTML = [
      ["전체 플레이어", number(data.players_total)],
      ["오늘 신규", number(data.players_new_today)],
      ["오늘 출석", number(data.attendance_today)],
      ["게시 중 공지", number(data.notices_live)],
      ["대기 중 전체 우편", number(data.mail_live)],
    ].map(([label, value]) => `<article data-tone="neutral"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
    byId("hexaworldOverviewAuthMode").textContent = authMode === "console_ticket" ? "세션 티켓 인증" : authMode === "google_id" ? "Google 로그인 인증" : "—";
    byId("hexaworldOverviewConfig").innerHTML = [
      ["최소 지원 버전 코드", number(config.min_version_code)],
      ["최신 버전 코드", number(config.latest_version_code)],
      ["점검 모드", config.maintenance ? "사용 중" : "꺼짐"],
      ["Android 스토어", config.store_url_android || "미설정"],
      ["iOS 스토어", config.store_url_ios || "미설정"],
    ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("");
    setMessage("hexaworldOverviewMessage", `서버 시각 ${time(data.server_time)} 기준입니다.`);
  }

  async function loadOverview() {
    setMessage("hexaworldOverviewMessage", "운영 현황을 불러오는 중입니다...");
    try {
      const result = await callHx("operations.get", {});
      renderOverview(result.data, result.auth_mode);
    } catch (error) {
      reportError("hexaworldOverviewMessage", error);
    }
  }
  function mountOverview() { loadOverview(); }

  // ─────────────────────────────────────────── notices
  function categoryOf(notice) { return Object.hasOwn(CATEGORY_LABELS, notice?.category) ? notice.category : "notice"; }

  function noticeStatus(notice) {
    const now = Date.now();
    const starts = Date.parse(notice.starts_at);
    const ends = notice.ends_at ? Date.parse(notice.ends_at) : null;
    if (!notice.active) return { key: "inactive", label: "비활성" };
    if (Number.isFinite(starts) && starts > now) return { key: "scheduled", label: "예약" };
    if (ends != null && Number.isFinite(ends) && ends <= now) return { key: "ended", label: "종료" };
    return { key: "live", label: "게시 중" };
  }

  function noticeRowMarkup(notice) {
    const status = noticeStatus(notice);
    const category = categoryOf(notice);
    const title = notice.title?.ko || notice.title?.en || "(제목 없음)";
    const excerpt = Array.from(String(notice.body?.ko || notice.body?.en || "").replace(/\s+/g, " ")).slice(0, 100).join("");
    return `<article class="audit-item" data-notice-id="${escapeHtml(notice.id)}">
      <div><strong><span class="announcement-category category-${escapeHtml(category)}">${escapeHtml(CATEGORY_LABELS[category])}</span> #${escapeHtml(notice.id)} ${escapeHtml(title)}${notice.pinned ? ' <span class="status-label">고정</span>' : ""}</strong>
      <small>${escapeHtml(time(notice.starts_at))} → ${notice.ends_at ? escapeHtml(time(notice.ends_at)) : "계속"} · 우선순위 ${escapeHtml(notice.priority ?? 0)}</small></div>
      <p>${escapeHtml(excerpt)}</p>
      <code class="hx-status-badge" data-hx-status="${status.key}">${status.label}</code>
      <div class="announcement-history-actions"><button type="button" class="warning-button" data-edit-notice="${escapeHtml(notice.id)}">수정</button><button type="button" class="danger-button" data-delete-notice="${escapeHtml(notice.id)}" aria-label="공지 #${escapeHtml(notice.id)} 삭제">삭제</button></div>
    </article>`;
  }

  function renderNoticesList() {
    const rows = Array.from(state.notices.values()).sort((a, b) => (b.pinned - a.pinned) || (b.priority - a.priority) || Date.parse(b.starts_at) - Date.parse(a.starts_at));
    byId("hexaworldNoticesTotal").textContent = `${number(rows.length)}건`;
    byId("hexaworldNoticesListing").innerHTML = rows.length ? rows.map(noticeRowMarkup).join("") : '<p class="empty-panel">등록된 공지가 없습니다.</p>';
  }

  async function loadNotices() {
    setMessage("hexaworldNoticesMessage", "공지 목록을 불러오는 중입니다...");
    try {
      const result = await callHx("notices.list", {});
      state.notices.clear();
      (Array.isArray(result.data) ? result.data : []).forEach((notice) => state.notices.set(Number(notice.id), notice));
      renderNoticesList();
      setMessage("hexaworldNoticesMessage", "삭제는 되돌릴 수 없습니다 (목록에서 즉시 사라집니다).");
    } catch (error) {
      reportError("hexaworldNoticesMessage", error);
    }
  }

  function updateNoticePreview() {
    const form = byId("hexaworldNoticeForm");
    const preview = byId("hexaworldNoticePreview");
    preview.innerHTML = "";
    const titleEl = document.createElement("strong");
    titleEl.textContent = form.elements.titleKo.value || "(제목 없음)";
    const bodyEl = document.createElement("p");
    bodyEl.style.margin = "6px 0 0";
    preview.append(titleEl, bodyEl);
    root.NoticeLinks.render(form.elements.bodyKo.value || "", bodyEl);
  }

  function updateNoticeLinkCheck() {
    const form = byId("hexaworldNoticeForm");
    const hint = byId("hexaworldNoticeLinkCheck");
    const url = form.elements.linkUrl.value.trim();
    hint.innerHTML = "";
    if (!url || !root.NoticeLinks.isYouTubeUrl(url)) { hint.hidden = true; return; }
    hint.hidden = false;
    hint.append(document.createTextNode("앱에서 외부로 열림 (YouTube) "));
    const testButton = document.createElement("button");
    testButton.type = "button";
    testButton.className = "text-button";
    testButton.textContent = "테스트로 열어보기";
    testButton.addEventListener("click", () => root.open(url, "_blank", "noopener,noreferrer"));
    hint.append(testButton);
  }

  function syncNoticeSubmitLabel(form) {
    const editing = Boolean(form.elements.noticeId.value);
    const button = form.querySelector("button[type=submit]");
    button.textContent = editing ? button.dataset.editLabel : button.dataset.submitLabel;
  }

  function refreshNoticeCounters(form) {
    ["titleKo", "titleEn", "bodyKo", "bodyEn"].forEach((field) => form.elements[field].dispatchEvent(new Event("input")));
  }

  function resetNoticeForm() {
    const form = byId("hexaworldNoticeForm");
    form.reset();
    form.elements.noticeId.value = "";
    form.elements.category.value = "notice";
    form.elements.active.checked = true;
    pendingRequests.delete(form);
    syncNoticeSubmitLabel(form);
    refreshNoticeCounters(form);
    updateNoticePreview();
    updateNoticeLinkCheck();
    setMessage("hexaworldNoticeFormMessage", "");
  }

  function fillNoticeForm(notice) {
    if (!notice) return;
    const form = byId("hexaworldNoticeForm");
    form.elements.noticeId.value = notice.id;
    form.elements.category.value = categoryOf(notice);
    form.elements.pinned.checked = Boolean(notice.pinned);
    form.elements.titleKo.value = notice.title?.ko || "";
    form.elements.titleEn.value = notice.title?.en || "";
    form.elements.bodyKo.value = notice.body?.ko || "";
    form.elements.bodyEn.value = notice.body?.en || "";
    form.elements.linkUrl.value = notice.link_url || "";
    form.elements.linkLabelKo.value = notice.link_label?.ko || "";
    form.elements.linkLabelEn.value = notice.link_label?.en || "";
    form.elements.imageUrl.value = notice.image_url || "";
    form.elements.priority.value = Number.isInteger(notice.priority) ? notice.priority : 0;
    form.elements.active.checked = notice.active !== false;
    form.elements.startsAt.value = isoToKstInput(notice.starts_at);
    form.elements.endsAt.value = isoToKstInput(notice.ends_at);
    form.elements.reason.value = "";
    syncNoticeSubmitLabel(form);
    refreshNoticeCounters(form);
    updateNoticePreview();
    updateNoticeLinkCheck();
    form.scrollIntoView({ block: "start" });
    form.elements.titleKo.focus();
  }

  function collectNoticePayload(form) {
    const values = Object.fromEntries(new FormData(form));
    const notice = {
      category: values.category,
      title: { ko: values.titleKo.trim(), en: values.titleEn.trim() },
      body: { ko: values.bodyKo.trim(), en: values.bodyEn.trim() },
      link_url: values.linkUrl.trim() || null,
      link_label: { ko: values.linkLabelKo.trim(), en: values.linkLabelEn.trim() },
      image_url: values.imageUrl.trim() || null,
      pinned: form.elements.pinned.checked,
      priority: Number.isFinite(Number(values.priority)) ? Math.trunc(Number(values.priority)) : 0,
      starts_at: kstInputToIso(values.startsAt),
      ends_at: values.endsAt ? kstInputToIso(values.endsAt) : null,
      active: form.elements.active.checked,
    };
    const noticeId = Number(values.noticeId);
    if (Number.isInteger(noticeId) && noticeId > 0) notice.id = noticeId;
    return { notice, reason: values.reason.trim() };
  }

  function validateNotice(notice) {
    if (!notice.title.ko || notice.title.ko.length > 80 || notice.title.en.length > 80) return "invalid_title";
    if (!notice.body.ko || notice.body.ko.length > 2000 || notice.body.en.length > 2000) return "invalid_body";
    if (notice.link_url && !/^https?:\/\/\S+$/i.test(notice.link_url)) return "invalid_link";
    if (notice.image_url && !/^https:\/\/\S+$/i.test(notice.image_url)) return "invalid_image";
    if (!Object.hasOwn(CATEGORY_LABELS, notice.category)) return "invalid_category";
    if (!notice.starts_at) return "invalid_starts_at";
    if (notice.ends_at && Date.parse(notice.ends_at) <= Date.parse(notice.starts_at)) return "invalid_ends_at";
    return null;
  }

  async function submitNotice(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      if (!form.reportValidity()) return;
      const { notice, reason } = collectNoticePayload(form);
      const problem = validateNotice(notice);
      if (problem) { setMessage("hexaworldNoticeFormMessage", hxErrorText({ message: problem }), true); return; }
      const editing = Boolean(notice.id);
      const summary = `${CATEGORY_LABELS[notice.category]} ${notice.title.ko}\n게시(KST): ${form.elements.startsAt.value} → ${form.elements.endsAt.value || "계속"}\n활성: ${notice.active ? "예" : "아니오"} · 고정: ${notice.pinned ? "예" : "아니오"}\n사유: ${reason || "(없음)"}`;
      if (!await root.ConsoleApp.confirmChange(editing ? "공지 수정" : "공지 발행", summary)) return;
      setMessage("hexaworldNoticeFormMessage", "저장하는 중입니다...");
      const result = await callHxWrite("notices.upsert", { notice, reason }, form);
      const saved = result.data.notice;
      state.notices.set(Number(saved.id), saved);
      renderNoticesList();
      resetNoticeForm();
      setMessage("hexaworldNoticesMessage", `공지 #${saved.id}를 저장했습니다.`);
    } catch (error) {
      reportError("hexaworldNoticeFormMessage", error);
    } finally {
      finishRequest();
    }
  }

  async function deleteNotice(id) {
    const notice = state.notices.get(id);
    if (!notice) return;
    const title = notice.title?.ko || `#${id}`;
    if (!await root.ConsoleApp.confirmChange("공지 삭제", `${CATEGORY_LABELS[categoryOf(notice)]} #${id} ${title}\n삭제하면 게임 내 공지 목록에서 즉시 사라집니다. 되돌릴 수 없습니다.`)) return;
    setMessage("hexaworldNoticesMessage", "삭제하는 중입니다...");
    try {
      await callHxWrite("notices.delete", { id, reason: "console delete" }, byId("hexaworldNoticesListing"));
      state.notices.delete(id);
      renderNoticesList();
      if (Number(byId("hexaworldNoticeForm").elements.noticeId.value) === id) resetNoticeForm();
      setMessage("hexaworldNoticesMessage", `공지 #${id}를 삭제했습니다.`);
    } catch (error) {
      reportError("hexaworldNoticesMessage", error);
    }
  }

  function bindNotices() {
    if (state.bound.notices) return;
    state.bound.notices = true;
    const form = byId("hexaworldNoticeForm");
    bindCounter(form, "titleKo", "titleKo", 80);
    bindCounter(form, "titleEn", "titleEn", 80);
    bindCounter(form, "bodyKo", "bodyKo", 2000);
    bindCounter(form, "bodyEn", "bodyEn", 2000);
    form.elements.titleKo.addEventListener("input", updateNoticePreview);
    form.elements.bodyKo.addEventListener("input", updateNoticePreview);
    form.elements.linkUrl.addEventListener("input", updateNoticeLinkCheck);
    form.addEventListener("submit", submitNotice);
    byId("hexaworldNoticeReset").addEventListener("click", resetNoticeForm);
    byId("hexaworldNoticesListing").addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-notice]");
      const deleteButton = event.target.closest("[data-delete-notice]");
      if (editButton) fillNoticeForm(state.notices.get(Number(editButton.dataset.editNotice)));
      if (deleteButton) deleteNotice(Number(deleteButton.dataset.deleteNotice));
    });
  }
  function mountNotices() { bindNotices(); loadNotices(); }

  // ─────────────────────────────────────────── attendance
  function attendanceRowMarkup(day, reward, isLast) {
    const cell = (currency) => {
      const value = reward?.[currency];
      return `<input type="number" min="1" max="${CURRENCY_LIMITS[currency]}" step="1" data-day="${day}" data-currency="${currency}" value="${Number.isFinite(value) ? value : ""}" placeholder="—" aria-label="${day}일차 ${CURRENCY_LABELS[currency]}">`;
    };
    return `<tr data-day-row="${day}"><td>${day}일차</td><td>${cell("coins")}</td><td>${cell("gems")}</td><td>${cell("keys")}</td><td>${cell("parts")}</td>
      <td>${isLast ? `<button type="button" class="danger-button" data-remove-day="${day}">삭제</button>` : ""}</td></tr>`;
  }

  function renderAttendanceTable(cycle) {
    const tbody = byId("hexaworldAttendanceTable");
    const n = cycle.length;
    tbody.innerHTML = cycle.map((entry, index) => attendanceRowMarkup(entry.day, entry.reward, index === n - 1)).join("");
    byId("hexaworldAttendanceDayCount").textContent = `${n}일`;
    byId("hexaworldAttendanceAddDay").disabled = n >= 28;
  }

  async function loadAttendance() {
    setMessage("hexaworldAttendanceMessage", "출석 보상을 불러오는 중입니다...");
    try {
      const result = await callHx("attendance.get", {});
      state.attendanceCycle = (result.data.cycle || []).map((entry) => ({ day: entry.day, reward: entry.reward || {} }));
      renderAttendanceTable(state.attendanceCycle);
      byId("hexaworldAttendanceSummary").innerHTML = [
        ["오늘 출석", number(result.data.claims_today)],
        ["누적 출석 참여 인원", number(result.data.players_with_claims)],
      ].map(([label, value]) => `<article data-tone="neutral"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
      setMessage("hexaworldAttendanceMessage", "저장하면 다음 출석부터 모든 플레이어에게 즉시 적용됩니다.");
    } catch (error) {
      reportError("hexaworldAttendanceMessage", error);
    }
  }

  function addAttendanceDay() {
    if (state.attendanceCycle.length >= 28) return;
    state.attendanceCycle.push({ day: state.attendanceCycle.length + 1, reward: {} });
    renderAttendanceTable(state.attendanceCycle);
  }
  function removeLastAttendanceDay(day) {
    if (Number(day) !== state.attendanceCycle.length || state.attendanceCycle.length <= 1) return;
    state.attendanceCycle.pop();
    renderAttendanceTable(state.attendanceCycle);
  }

  function collectAttendanceRewards() {
    const rows = Array.from(byId("hexaworldAttendanceTable").querySelectorAll("tr[data-day-row]"));
    const rewards = [];
    for (const row of rows) {
      const day = Number(row.dataset.dayRow);
      const reward = {};
      for (const input of row.querySelectorAll("input[data-currency]")) {
        const currency = input.dataset.currency;
        const raw = input.value.trim();
        if (!raw) continue;
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1 || value > CURRENCY_LIMITS[currency]) {
          return { error: `${day}일차 ${CURRENCY_LABELS[currency]} 값을 확인해 주세요 (1~${CURRENCY_LIMITS[currency].toLocaleString("ko-KR")}).` };
        }
        reward[currency] = value;
      }
      rewards.push({ day, reward });
    }
    return { rewards };
  }

  async function submitAttendance(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      if (!form.reportValidity()) return;
      const collected = collectAttendanceRewards();
      if (collected.error) { setMessage("hexaworldAttendanceFormMessage", collected.error, true); return; }
      const reason = form.elements.reason.value.trim();
      const summary = `${collected.rewards.length}일 사이클\n${collected.rewards.map((entry) => `${entry.day}일차: ${Object.entries(entry.reward).map(([key, value]) => `${CURRENCY_LABELS[key]} ${number(value)}`).join(", ") || "보상 없음"}`).join("\n")}\n사유: ${reason || "(없음)"}`;
      if (!await root.ConsoleApp.confirmChange("출석 보상 저장", summary)) return;
      setMessage("hexaworldAttendanceFormMessage", "저장하는 중입니다...");
      const result = await callHxWrite("attendance.set", { rewards: collected.rewards, reason }, form);
      state.attendanceCycle = (result.data.cycle || []).map((entry) => ({ day: entry.day, reward: entry.reward || {} }));
      renderAttendanceTable(state.attendanceCycle);
      setMessage("hexaworldAttendanceFormMessage", "");
      setMessage("hexaworldAttendanceMessage", "출석 보상을 저장했습니다.");
    } catch (error) {
      reportError("hexaworldAttendanceFormMessage", error);
    } finally {
      finishRequest();
    }
  }

  function bindAttendance() {
    if (state.bound.attendance) return;
    state.bound.attendance = true;
    byId("hexaworldAttendanceAddDay").addEventListener("click", addAttendanceDay);
    byId("hexaworldAttendanceTable").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-day]");
      if (button) removeLastAttendanceDay(button.dataset.removeDay);
    });
    byId("hexaworldAttendanceForm").addEventListener("submit", submitAttendance);
  }
  function mountAttendance() { bindAttendance(); loadAttendance(); }

  // ─────────────────────────────────────────── mail
  let mailRowSeq = 0;
  function mailRewardRowMarkup(rowId) {
    const options = Object.keys(CURRENCY_LABELS).map((key) => `<option value="${key}">${CURRENCY_LABELS[key]}</option>`).join("");
    return `<div class="form-pair" data-reward-row="${rowId}"><label>보상 종류<select data-reward-type>${options}</select></label><label>수량<input type="number" min="1" step="1" data-reward-amount required></label><button type="button" class="danger-button" data-remove-reward="${rowId}">이 보상 삭제</button></div>`;
  }

  function syncMailRewardOptions() {
    const rows = Array.from(byId("hexaworldMailRewards").querySelectorAll("[data-reward-row]"));
    const used = new Set();
    rows.forEach((row) => {
      const select = row.querySelector("[data-reward-type]");
      if (used.has(select.value)) {
        const free = Object.keys(CURRENCY_LABELS).find((key) => !used.has(key));
        if (free) select.value = free;
      }
      used.add(select.value);
    });
    rows.forEach((row) => {
      const select = row.querySelector("[data-reward-type]");
      Array.from(select.options).forEach((option) => { option.disabled = used.has(option.value) && option.value !== select.value; });
    });
    byId("hexaworldMailAddReward").disabled = rows.length >= Object.keys(CURRENCY_LABELS).length;
  }

  function addMailRewardRow() {
    const container = byId("hexaworldMailRewards");
    if (container.children.length >= Object.keys(CURRENCY_LABELS).length) return;
    mailRowSeq += 1;
    container.insertAdjacentHTML("beforeend", mailRewardRowMarkup(mailRowSeq));
    syncMailRewardOptions();
  }
  function removeMailRewardRow(rowId) {
    byId("hexaworldMailRewards").querySelector(`[data-reward-row="${rowId}"]`)?.remove();
    syncMailRewardOptions();
  }

  function collectMailRewards() {
    const rows = Array.from(byId("hexaworldMailRewards").querySelectorAll("[data-reward-row]"));
    const rewards = {};
    for (const row of rows) {
      const type = row.querySelector("[data-reward-type]").value;
      const raw = row.querySelector("[data-reward-amount]").value.trim();
      const amount = Number(raw);
      if (!raw || !Number.isInteger(amount) || amount < 1 || amount > CURRENCY_LIMITS[type]) {
        return { error: `${CURRENCY_LABELS[type]} 수량을 확인해 주세요 (1~${CURRENCY_LIMITS[type].toLocaleString("ko-KR")}).` };
      }
      rewards[type] = amount;
    }
    return { rewards };
  }

  async function loadMailContext() {
    try {
      const result = await callHx("operations.get", {});
      setMessage("hexaworldMailMessage", `현재 대기 중인 전체 우편 ${number(result.data.mail_live)}건.`);
    } catch (error) {
      reportError("hexaworldMailMessage", error);
    }
  }

  async function submitMail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      const titleKo = values.titleKo.trim();
      const titleEn = values.titleEn.trim();
      const bodyKo = values.bodyKo.trim();
      const bodyEn = values.bodyEn.trim();
      if (!titleKo || titleKo.length > 60 || titleEn.length > 60 || !bodyKo || bodyKo.length > 500 || bodyEn.length > 500) {
        setMessage("hexaworldMailFormMessage", hxErrorText({ message: "invalid_text" }), true);
        return;
      }
      const expiresDays = Number(values.expiresDays);
      if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 30) {
        setMessage("hexaworldMailFormMessage", hxErrorText({ message: "invalid_expiry" }), true);
        return;
      }
      const collected = collectMailRewards();
      if (collected.error) { setMessage("hexaworldMailFormMessage", collected.error, true); return; }
      const reason = values.reason.trim();
      const mail = { title: { ko: titleKo, en: titleEn }, body: { ko: bodyKo, en: bodyEn }, rewards: collected.rewards, expires_days: expiresDays };
      const rewardSummary = Object.entries(collected.rewards).map(([key, value]) => `${CURRENCY_LABELS[key]} ${number(value)}`).join(", ") || "보상 없음";
      if (!await root.ConsoleApp.confirmChange("전체 보상 우편 발송", `모든 플레이어에게 발송됩니다.\n${titleKo}\n보상: ${rewardSummary}\n수령 기한: ${expiresDays}일\n사유: ${reason || "(없음)"}`)) return;
      setMessage("hexaworldMailFormMessage", "발송하는 중입니다...");
      await callHxWrite("mail.broadcast", { mail, reason }, form);
      form.reset();
      byId("hexaworldMailRewards").innerHTML = "";
      addMailRewardRow();
      ["titleKo", "titleEn", "bodyKo", "bodyEn"].forEach((field) => form.elements[field].dispatchEvent(new Event("input")));
      setMessage("hexaworldMailFormMessage", "");
      setMessage("hexaworldMailMessage", "전체 보상 우편을 발송했습니다.");
    } catch (error) {
      reportError("hexaworldMailFormMessage", error);
    } finally {
      finishRequest();
    }
  }

  function bindMail() {
    if (state.bound.mail) return;
    state.bound.mail = true;
    const form = byId("hexaworldMailForm");
    bindCounter(form, "titleKo", "mailTitleKo", 60);
    bindCounter(form, "titleEn", "mailTitleEn", 60);
    bindCounter(form, "bodyKo", "mailBodyKo", 500);
    bindCounter(form, "bodyEn", "mailBodyEn", 500);
    byId("hexaworldMailAddReward").addEventListener("click", addMailRewardRow);
    byId("hexaworldMailRewards").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-reward]");
      if (button) removeMailRewardRow(button.dataset.removeReward);
    });
    byId("hexaworldMailRewards").addEventListener("change", (event) => {
      if (event.target.matches("[data-reward-type]")) syncMailRewardOptions();
    });
    form.addEventListener("submit", submitMail);
  }
  function mountMail() {
    bindMail();
    if (!byId("hexaworldMailRewards").children.length) addMailRewardRow();
    loadMailContext();
  }

  // ─────────────────────────────────────────── config
  function fillConfigForm(config) {
    const form = byId("hexaworldConfigForm");
    form.elements.minVersionCode.value = config.min_version_code ?? "";
    form.elements.latestVersionCode.value = config.latest_version_code ?? "";
    form.elements.storeUrlAndroid.value = config.store_url_android || "";
    form.elements.storeUrlIos.value = config.store_url_ios || "";
    form.elements.maintenance.checked = Boolean(config.maintenance);
    form.elements.maintenanceMsgKo.value = config.maintenance_msg?.ko || "";
    form.elements.maintenanceMsgEn.value = config.maintenance_msg?.en || "";
    form.elements.featureFlags.value = JSON.stringify(config.feature_flags || {}, null, 2);
    setMessage("hexaworldConfigJsonMessage", "");
  }

  async function loadConfig() {
    setMessage("hexaworldConfigMessage", "앱 설정을 불러오는 중입니다...");
    try {
      const result = await callHx("config.get", {});
      state.config = result.data || {};
      fillConfigForm(state.config);
      setMessage("hexaworldConfigMessage", "점검 켜기·버전 변경은 즉시 모든 클라이언트에 적용됩니다.");
    } catch (error) {
      reportError("hexaworldConfigMessage", error);
    }
  }

  async function submitConfig(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      const minCode = Number(values.minVersionCode);
      const latestCode = Number(values.latestVersionCode);
      if (!Number.isInteger(minCode) || minCode < 0 || !Number.isInteger(latestCode) || latestCode < 0) {
        setMessage("hexaworldConfigFormMessage", "버전 코드를 확인해 주세요.", true);
        return;
      }
      if (minCode > latestCode) {
        setMessage("hexaworldConfigFormMessage", hxErrorText({ message: "rpc_failed", detail: "min_version_above_latest" }), true);
        return;
      }
      const maintenance = form.elements.maintenance.checked;
      const msgKo = values.maintenanceMsgKo.trim();
      const msgEn = values.maintenanceMsgEn.trim();
      if ((msgKo || msgEn) && !msgKo) {
        setMessage("hexaworldConfigFormMessage", hxErrorText({ message: "invalid_maintenance_msg" }), true);
        return;
      }
      if (maintenance && !msgKo) {
        setMessage("hexaworldConfigFormMessage", "점검을 켜려면 점검 안내(한국어)를 입력해 주세요.", true);
        return;
      }
      let featureFlags;
      try {
        featureFlags = values.featureFlags.trim() ? JSON.parse(values.featureFlags) : {};
        if (typeof featureFlags !== "object" || featureFlags === null || Array.isArray(featureFlags)) throw new Error("not_object");
        setMessage("hexaworldConfigJsonMessage", "");
      } catch (_error) {
        setMessage("hexaworldConfigJsonMessage", '기능 플래그 JSON 형식을 확인해 주세요 (예: {"key": true}).', true);
        return;
      }
      const config = {
        min_version_code: minCode, latest_version_code: latestCode,
        store_url_android: values.storeUrlAndroid.trim(), store_url_ios: values.storeUrlIos.trim(),
        maintenance, feature_flags: featureFlags,
      };
      if (msgKo) config.maintenance_msg = { ko: msgKo, en: msgEn };
      const reason = values.reason.trim();
      const turningMaintenanceOn = maintenance && !state.config?.maintenance;
      const summary = [
        `최소 버전 코드: ${minCode} · 최신 버전 코드: ${latestCode}`,
        `점검 모드: ${maintenance ? "켜짐" : "꺼짐"}${maintenance && msgKo ? ` (${msgKo})` : ""}`,
        `기능 플래그: ${Object.keys(featureFlags).length}개`,
        `사유: ${reason || "(없음)"}`,
      ].join("\n");
      if (!await root.ConsoleApp.confirmChange(turningMaintenanceOn ? "점검 모드 켜기" : "앱 설정 변경", summary)) return;
      setMessage("hexaworldConfigFormMessage", "저장하는 중입니다...");
      const result = await callHxWrite("config.set", { config, reason }, form);
      state.config = result.data.config || config;
      fillConfigForm(state.config);
      setMessage("hexaworldConfigFormMessage", "");
      setMessage("hexaworldConfigMessage", "앱 설정을 저장했습니다.");
    } catch (error) {
      reportError("hexaworldConfigFormMessage", error);
    } finally {
      finishRequest();
    }
  }

  function bindConfig() {
    if (state.bound.config) return;
    state.bound.config = true;
    byId("hexaworldConfigForm").addEventListener("submit", submitConfig);
  }
  function mountConfig() { bindConfig(); loadConfig(); }

  // ─────────────────────────────────────────── audit
  function auditRowMarkup(row) {
    return `<article class="audit-item"><div><strong>${escapeHtml(hxActionLabel(row.action))}</strong><small>${escapeHtml(time(row.created_at))} · ${escapeHtml(row.admin_email)}</small></div>
      <details class="audit-diff"><summary>세부 내용 보기</summary><code>요청\n${escapeHtml(prettyJson(row.params))}\n\n결과\n${escapeHtml(prettyJson(row.result))}</code></details></article>`;
  }

  async function loadAudit() {
    setMessage("hexaworldAuditMessage", "감사 로그를 불러오는 중입니다...");
    try {
      const result = await callHx("audit.list", { limit: state.auditLimit });
      const rows = Array.isArray(result.data) ? result.data : [];
      byId("hexaworldAuditTotal").textContent = `${number(rows.length)}건`;
      byId("hexaworldAuditList").innerHTML = rows.length ? rows.map(auditRowMarkup).join("") : '<p class="empty-panel">감사 기록이 없습니다.</p>';
      setMessage("hexaworldAuditMessage", "");
    } catch (error) {
      reportError("hexaworldAuditMessage", error);
    }
  }

  function bindAudit() {
    if (state.bound.audit) return;
    state.bound.audit = true;
    byId("hexaworldAuditFilterForm").addEventListener("submit", (event) => {
      event.preventDefault();
      state.auditLimit = Number(byId("hexaworldAuditLimit").value) || 50;
      loadAudit();
    });
  }
  function mountAudit() { bindAudit(); loadAudit(); }

  root.ConsoleHexaworld = { mountOverview, mountNotices, mountAttendance, mountMail, mountConfig, mountAudit };
})(window);
