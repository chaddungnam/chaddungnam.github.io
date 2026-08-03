(function attachConsoleOperations(root) {
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "계속";
  let bound = false;
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
    byId("operationsMessage").textContent = value;
    byId("operationsMessage").style.color = error ? "var(--coral)" : "";
  }

  function render(data) {
    const config = data.config || {};
    byId("operationsSummary").innerHTML = `<article><span>최소 버전</span><strong>${escapeHtml(config.min_version || "—")}</strong></article><article><span>Android 코드</span><strong>${escapeHtml(config.min_version_code || "—")}</strong></article><article><span>플레이어 수정</span><strong>${config.admin_player_mutations_enabled === "true" ? "활성" : "잠김"}</strong></article>`;
    const notices = (data.notices || []).map((notice) => `<article class="audit-item"><div><strong>공지 #${notice.id}</strong><small>${escapeHtml(time(notice.starts_at))} → ${escapeHtml(time(notice.ends_at))}</small></div><p>${escapeHtml(notice.body)}</p><code>${notice.active ? "활성" : "비활성"}</code></article>`);
    const mail = (data.reward_mail_broadcasts || []).map((row) => `<article class="audit-item" data-success="${row.success}"><div><strong>전체 보상 우편</strong><small>${escapeHtml(time(row.created_at))} · ${escapeHtml(row.actor_email)}</small></div><p>${escapeHtml(row.reason)}</p><code>${escapeHtml(JSON.stringify(row.summary))}</code></article>`);
    byId("operationsHistory").innerHTML = [...notices, ...mail].join("") || '<p class="empty-panel">최근 운영 기록이 없습니다.</p>';
    byId("minVersionForm").elements.minVersion.value = config.min_version || "";
    byId("minVersionForm").elements.minVersionCode.value = config.min_version_code || "";
  }

  async function load() {
    setMessage("운영 상태를 불러오는 중...");
    try {
      render(await root.ConsoleAPI.post("admin-console", { action: "operations.get" }));
      setMessage("공지·우편·버전·QA 변경은 모두 사유와 함께 기록됩니다.");
    } catch (error) {
      setMessage(`운영 상태를 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  async function submit(form, payload, title, summary) {
    if (!form.reportValidity() || !await root.ConsoleApp.confirmChange(title, summary)) return;
    const button = form.querySelector('button[type="submit"]');
    const fingerprint = JSON.stringify(payload);
    const pending = pendingRequests.get(form);
    const requestId = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
    pendingRequests.set(form, { fingerprint, requestId });
    button.disabled = true;
    try {
      await root.ConsoleAPI.post("admin-console", { ...payload, requestId });
      pendingRequests.delete(form);
      form.reset();
      setMessage(`${title} 작업을 완료했습니다.`);
      await load();
    } catch (error) {
      if (Number(error?.status) >= 400 && Number(error?.status) < 500) pendingRequests.delete(form);
      setMessage(`작업을 완료하지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      button.disabled = false;
    }
  }

  function iso(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function renderRewardTemplate() {
    const key = byId("rewardMailForm").elements.templateKey.value;
    const template = root.CsIntelligence.rewardTemplate(key);
    const copy = templateCopy[key];
    byId("rewardTemplatePreview").innerHTML = template && copy
      ? `<strong>${escapeHtml(copy[0])}</strong><p>${escapeHtml(copy[1])}</p><code>${escapeHtml(template.titleKey)} · ${escapeHtml(template.bodyKey)}</code>`
      : '<p>지원하지 않는 문구입니다.</p>';
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
    byId("rewardMailForm").addEventListener("reset", () => root.setTimeout(renderRewardTemplate, 0));
    byId("minVersionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      submit(form, {
        action: "min_version.update", minVersion: values.minVersion.trim(),
        minVersionCode: Number(values.minVersionCode), reason: values.reason.trim(),
      }, "최소 버전 변경", `버전 ${values.minVersion} · Android 코드 ${values.minVersionCode}\n사유: ${values.reason}`);
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
  }

  function mount() { bind(); renderRewardTemplate(); load(); }
  root.ConsoleOperations = { mount };
})(window);
