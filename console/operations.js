(function attachConsoleOperations(root) {
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "계속";
  const noticeMarkup = (notice) => `<article class="audit-item" data-notice-id="${escapeHtml(notice.id)}" data-starts-at="${escapeHtml(notice.starts_at || "")}" data-ends-at="${escapeHtml(notice.ends_at || "")}"><div><strong>공지 #${escapeHtml(notice.id)}</strong><small>${escapeHtml(time(notice.starts_at))} → ${escapeHtml(time(notice.ends_at))}</small></div><p>${escapeHtml(notice.body)}</p><code>${notice.active ? "활성" : "비활성"}</code><button type="button" class="warning-button" data-edit-notice="${escapeHtml(notice.id)}">수정</button></article>`;
  let bound = false;
  let rewardCatalog = [];
  const pendingRequests = new WeakMap();
  const templateCopy = {
    general: ["안내 보상", "House Duck에서 보낸 보상입니다."],
    compensation: ["불편 보상", "이용 중 불편에 대한 보상을 보내드립니다."],
    maintenance: ["점검 보상", "점검을 기다려 주셔서 감사합니다."],
    welcome: ["환영 보상", "Quirky Ball에 오신 것을 환영합니다."],
    support: ["지원 보상", "문의 확인 후 지급된 보상입니다."],
    update: ["업데이트 보상", "새 버전을 기다려 주셔서 감사합니다."],
    launch: ["게임 출시 보상", "Quirky Ball의 첫 출발을 함께해 주셔서 감사합니다."],
  };

  function setMessage(value, error = false) {
    root.ConsoleUiState.setMessage(byId("operationsMessage"), value, error);
    byId("operationsMessage").style.color = error ? "var(--coral)" : "";
  }

  function setAnnouncementMessage(value, error = false) {
    const message = byId("announcementMessage");
    root.ConsoleUiState.setMessage(message, value, error);
    message.style.color = error ? "var(--coral)" : "";
    setMessage(value, error);
  }

  function operationError(error) {
    const messages = {
      notice_translation_unavailable: "공지 자동 번역 서버가 응답하지 않았습니다. 입력한 본문은 유지됐으니 잠시 후 다시 시도해 주세요.",
    };
    return messages[error?.message] || error?.message || "알 수 없는 오류";
  }

  function render(data, referrals = {}) {
    rewardCatalog = Array.isArray(data.catalog) ? data.catalog : [];
    const config = data.config || {};
    const mutationsEnabled = config.admin_player_mutations_enabled === "true";
    const referralsEnabled = referrals.enabled === true || config.feature_referral_program === "true";
    byId("operationsSummary").innerHTML = `<article data-tone="neutral"><span>최소 표시 버전</span><strong>${escapeHtml(config.min_version || "—")}</strong></article><article data-tone="neutral"><span>공통 호환 코드</span><strong>${escapeHtml(config.min_version_code || "—")}</strong></article><article data-tone="${mutationsEnabled ? "good" : "watch"}"><span>플레이어 수정</span><strong>${mutationsEnabled ? "활성" : "잠김"}</strong></article><article data-tone="${referralsEnabled ? "good" : "watch"}"><span>친구초대</span><strong>${referralsEnabled ? "활성" : "중지"}</strong></article>`;
    byId("referralMetrics").innerHTML = `<article data-tone="neutral"><span>생성 코드</span><strong>${escapeHtml(referrals.codes_issued || 0)}</strong></article><article data-tone="good"><span>성공 초대</span><strong>${escapeHtml(referrals.accepted_total || 0)}</strong></article><article data-tone="neutral"><span>오늘 성공</span><strong>${escapeHtml(referrals.accepted_today_utc || 0)}</strong></article><article data-tone="watch"><span>3회 완료</span><strong>${escapeHtml(referrals.tier_3_total || 0)}</strong></article>`;
    byId("referralConfigForm").elements.enabled.checked = referralsEnabled;
    const notices = (data.notices || []).map(noticeMarkup);
    const mail = (data.reward_mail_broadcasts || []).map((row) => `<article class="audit-item" data-success="${row.success}"><div><strong>전체 보상 우편</strong><small>${escapeHtml(time(row.created_at))} · ${escapeHtml(row.actor_email)}</small></div><p>${escapeHtml(row.reason)}</p><code>${escapeHtml(JSON.stringify(row.summary))}</code></article>`);
    byId("operationsHistory").innerHTML = [...notices, ...mail].join("") || '<p class="empty-panel">최근 운영 기록이 없습니다.</p>';
    byId("minVersionForm").elements.minVersion.value = config.min_version || "";
    byId("minVersionForm").elements.minVersionCode.value = config.min_version_code || "";
  }

  async function load() {
    setMessage("운영 상태를 불러오는 중...");
    try {
      const [operations, referrals] = await Promise.all([
        root.ConsoleAPI.post("admin-console", { action: "operations.get" }),
        root.ConsoleAPI.post("admin-console", { action: "referrals.get" }).catch(() => ({})),
      ]);
      render(operations, referrals);
      syncAnnouncementSubmit(byId("announcementForm"));
      setMessage("공지·우편·버전·QA 변경은 모두 사유와 함께 기록됩니다.");
    } catch (error) {
      setMessage(`운영 상태를 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  async function submit(form, payload, title, summary, options = {}) {
    const report = options.report || setMessage;
    if (!form.reportValidity() || !await root.ConsoleApp.confirmChange(title, summary)) return;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      report(options.progressMessage || `${title} 처리 중입니다...`);
      const fingerprint = JSON.stringify(payload);
      const pending = pendingRequests.get(form);
      const requestId = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
      pendingRequests.set(form, { fingerprint, requestId });
      const result = await root.ConsoleAPI.post("admin-console", { ...payload, requestId });
      pendingRequests.delete(form);
      if (options.onSuccess) options.onSuccess(result);
      form.reset();
      if (form === byId("announcementForm")) {
        form.elements.announcementId.value = "";
        syncAnnouncementSubmit(form);
      }
      if (options.reload !== false) await load();
      report(`${title} 작업을 완료했습니다.`);
    } catch (error) {
      if (Number(error?.status) >= 400 && Number(error?.status) < 500) pendingRequests.delete(form);
      report(`작업을 완료하지 못했습니다: ${operationError(error)}`, true);
    } finally {
      finishRequest();
    }
  }

  function upsertNotice(notice) {
    const id = Number(notice.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const history = byId("operationsHistory");
    const existing = Array.from(history.querySelectorAll("[data-notice-id]"))
      .find((item) => Number(item.dataset.noticeId) === id);
    const markup = noticeMarkup({ ...notice, id });
    if (existing) existing.outerHTML = markup;
    else {
      history.querySelector(".empty-panel")?.remove();
      history.insertAdjacentHTML("afterbegin", markup);
    }
  }

  function iso(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function syncAnnouncementSubmit(form) {
    const editing = Boolean(form.elements.announcementId.value);
    const button = form.querySelector("button[type=submit]");
    if (button) button.textContent = editing ? (button.dataset.editLabel || "공지 수정") : (button.dataset.submitLabel || "공지 발행");
  }

  function fillAnnouncement(notice) {
    const form = byId("announcementForm");
    form.elements.announcementId.value = notice.id || "";
    form.elements.body.value = notice.body || "";
    form.elements.startsAt.value = toLocalInput(notice.starts_at);
    form.elements.endsAt.value = toLocalInput(notice.ends_at);
    form.elements.reason.value = "";
    syncAnnouncementSubmit(form);
    form.elements.body.focus();
  }

  function renderRewardTemplate() {
    const key = byId("rewardMailForm").elements.templateKey.value;
    const template = root.CsIntelligence.rewardTemplate(key);
    const copy = templateCopy[key];
    byId("rewardTemplatePreview").innerHTML = template && copy
      ? `<strong>${escapeHtml(copy[0])}</strong><p>${escapeHtml(copy[1])}</p><code>${escapeHtml(template.titleKey)} · ${escapeHtml(template.bodyKey)}</code>`
      : '<p>지원하지 않는 문구입니다.</p>';
  }

  function syncRewardInput() {
    const form = byId("rewardMailForm");
    const select = form.elements.rewardValue;
    const label = byId("rewardValueLabel");
    if (form.elements.kind.value === "entitlement") {
      label.firstChild.textContent = "상점 아이템";
      select.outerHTML = `<select name="rewardValue" required>${rewardCatalog.map((item) => `<option value="${escapeHtml(item.item_id)}">${escapeHtml(item.item_id)} · ${escapeHtml(item.item_type)} · ${escapeHtml(item.rarity || "common")}</option>`).join("")}</select>`;
    } else {
      label.firstChild.textContent = "수량";
      select.outerHTML = '<input name="rewardValue" type="number" min="1" step="1" required>';
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("rewardMailForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const numericReward = Number(values.rewardValue);
      const rewardValid = values.kind === "entitlement"
        ? Boolean(values.rewardValue.trim())
        : Number.isSafeInteger(numericReward) && numericReward > 0;
      form.elements.rewardValue.setCustomValidity(rewardValid ? "" : "양의 정수 수량 또는 상품 ID를 입력해 주세요.");
      if (!form.reportValidity()) return;
      const reward = values.kind === "entitlement"
        ? [{ kind: values.kind, item_id: values.rewardValue.trim() }]
        : [{ kind: values.kind, amount: numericReward }];
      const template = root.CsIntelligence.rewardTemplate(values.templateKey);
      if (!template) { form.elements.templateKey.setCustomValidity("고정 다국어 문구를 선택해 주세요."); form.reportValidity(); return; }
      form.elements.templateKey.setCustomValidity("");
      submit(form, {
        action: "reward_mail.broadcast", templateKey: template.key, reward,
        expiresAt: iso(values.expiresAt), reason: values.reason.trim(),
      }, "전체 보상 우편 발송", `모든 플레이어에게 ${templateCopy[template.key][0]} 우편을 보냅니다.\n${template.titleKey} · ${template.bodyKey}\n보상: ${values.kind} ${values.rewardValue}\n사유: ${values.reason}`);
    });
    byId("rewardMailForm").elements.templateKey.addEventListener("change", renderRewardTemplate);
    byId("rewardMailForm").elements.kind.addEventListener("change", syncRewardInput);
    byId("rewardMailForm").addEventListener("reset", () => root.setTimeout(renderRewardTemplate, 0));
    byId("minVersionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      submit(form, {
        action: "min_version.update", minVersion: values.minVersion.trim(),
        minVersionCode: Number(values.minVersionCode), reason: values.reason.trim(),
      }, "최소 버전 변경", `표시 버전 ${values.minVersion} · 공통 호환 코드 ${values.minVersionCode}\n사유: ${values.reason}`);
    });
    byId("referralConfigForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      submit(form, {
        action: "referrals.config.update",
        enabled: form.elements.enabled.checked,
        reason: values.reason.trim(),
      }, "친구초대 설정 변경", `친구초대: ${form.elements.enabled.checked ? "활성" : "중지"}\n사유: ${values.reason.trim()}`);
    });
    byId("qaAccessForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      submit(form, {
        action: "qa_access.set", userId: values.userId.trim(),
        shopControlsEnabled: form.elements.shopControlsEnabled.checked, reason: values.reason.trim(),
      }, "QA 권한 변경", `${values.userId}\nQA 상점: ${form.elements.shopControlsEnabled.checked ? "허용" : "미허용"}\n사유: ${values.reason}`);
    });
    byId("announcementForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const startsAt = iso(values.startsAt);
      const endsAt = values.endsAt ? iso(values.endsAt) : null;
      const announcementId = Number(values.announcementId);
      const editing = Number.isInteger(announcementId) && announcementId > 0;
      form.elements.endsAt.setCustomValidity(endsAt && startsAt && Date.parse(endsAt) <= Date.parse(startsAt) ? "게시 종료는 시작보다 뒤여야 합니다." : "");
      if (!startsAt || !form.reportValidity()) return;
      const payload = {
        action: editing ? "announcements.update" : "announcements.publish",
        ...(editing ? { announcementId } : {}),
        body: values.body.trim(), startsAt, endsAt, reason: values.reason.trim(),
      };
      submit(form, payload, editing ? "게임 공지 수정" : "게임 공지 발행", `${values.body.trim()}\n시작: ${startsAt}\n종료: ${endsAt || "없음"}\n사유: ${values.reason.trim()}`, {
        reload: false,
        report: setAnnouncementMessage,
        progressMessage: "공지 번역과 저장을 처리 중입니다. 완료될 때까지 기다려 주세요.",
        onSuccess: (result) => upsertNotice({
          id: editing ? announcementId : Number(result?.announcement_id),
          body: payload.body,
          starts_at: startsAt,
          ends_at: endsAt,
          active: true,
        }),
      });
    });
    byId("announcementForm").addEventListener("invalid", (event) => {
      const label = event.target?.name === "reason" ? "수정·발행 사유" : "필수 항목";
      setAnnouncementMessage(`${label}를 입력해 주세요. 아직 서버에는 반영되지 않았습니다.`, true);
    }, true);
    byId("announcementReset").addEventListener("click", () => {
      const form = byId("announcementForm");
      form.reset();
      form.elements.announcementId.value = "";
      syncAnnouncementSubmit(form);
    });
    byId("operationsHistory").addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-notice]");
      if (!button) return;
      const article = button.closest("[data-notice-id]");
      if (!article) return;
      fillAnnouncement({
        id: Number(article.dataset.noticeId),
        body: article.querySelector("p")?.textContent || "",
        starts_at: article.dataset.startsAt,
        ends_at: article.dataset.endsAt === "계속" ? "" : article.dataset.endsAt,
      });
    });
  }

  function mount() { bind(); renderRewardTemplate(); syncRewardInput(); load(); }
  root.ConsoleOperations = { mount };
})(window);
