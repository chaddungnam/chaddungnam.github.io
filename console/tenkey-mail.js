// 10KEY mailbox administration. The console owns only the UI; tenkey-admin validates and writes each mail.
(function attachConsoleTenkeyMail(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const state = { bound: false, rows: [] };
  const byId = (id) => document.getElementById(id);
  const LABELS = { gems: "젬", parts: "고급부품", basic_box: "기본 상자", rare_box: "고급 상자", rename_ticket: "닉네임 변경권" };
  const LIMITS = { gems: 1_000_000, parts: 100_000, basic_box: 100, rare_box: 100, rename_ticket: 50 };
  const pad = (n) => String(n).padStart(2, "0");
  function timeKst(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "—";
    return `${new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ")} KST`;
  }

  function localKstInput(date) {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
  }
  function kstInputToIso(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!m) return "";
    const [y, mo, d, h, mi] = m.slice(1).map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - 9 * 60 * 60 * 1000).toISOString();
  }
  function setDefaultExpiry() {
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    byId("tenkeyMailForm").elements.expiresAt.value = localKstInput(expiry);
  }
  function attachmentData() {
    return Array.from(byId("tenkeyMailAttachments").querySelectorAll("[data-mail-attachment]"))
      .map((row) => ({ kind: row.querySelector('[name="kind"]').value, amount: Number(row.querySelector('[name="amount"]').value) }));
  }
  function renderPreview() {
    const f = byId("tenkeyMailForm").elements;
    const audience = f.audience.value === "all" ? "전체 계정" : (f.target.value.trim() || "받는 사람");
    const rewards = attachmentData().filter((item) => item.amount > 0).map((item) => `${LABELS[item.kind]} ${num(item.amount)}`).join(" · ") || "첨부 보상 없음";
    const expires = f.expiresAt.value ? `${f.expiresAt.value.replace("T", " ")} KST` : "만료 시각 미입력";
    byId("tenkeyMailPreview").innerHTML = `
      <article class="mail-preview-card"><small>한국어 · ${esc(audience)} · ${esc(expires)}</small><strong>${esc(f.titleKo.value || "메일 제목")}</strong><span>${esc(f.bodyKo.value || "메일 본문")}</span><small>${esc(rewards)}</small></article>
      <article class="mail-preview-card"><small>English · other device languages fall back to English</small><strong>${esc(f.titleEn.value || "Mail title")}</strong><span>${esc(f.bodyEn.value || "Mail body")}</span><small>${esc(rewards)}</small></article>`;
  }
  function syncAudience() {
    const f = byId("tenkeyMailForm").elements;
    const broadcast = f.audience.value === "all";
    f.target.disabled = broadcast;
    f.target.required = !broadcast;
    f.target.value = broadcast ? "" : f.target.value;
    renderPreview();
  }
  function addAttachment() {
    const host = byId("tenkeyMailAttachments");
    if (host.children.length >= 5) return;
    const used = new Set(attachmentData().map((item) => item.kind));
    const next = Object.keys(LABELS).find((kind) => !used.has(kind));
    if (!next) return;
    const row = byId("tenkeyMailAttachmentTemplate").content.firstElementChild.cloneNode(true);
    row.querySelector('[name="kind"]').value = next;
    row.querySelector('[name="amount"]').value = "1";
    host.append(row);
    updateKindOptions();
    renderPreview();
  }
  function updateKindOptions() {
    const rows = Array.from(byId("tenkeyMailAttachments").querySelectorAll("[data-mail-attachment]"));
    for (const row of rows) {
      const current = row.querySelector('[name="kind"]');
      const usedElsewhere = new Set(rows.filter((other) => other !== row).map((other) => other.querySelector('[name="kind"]').value));
      Array.from(current.options).forEach((option) => { option.disabled = usedElsewhere.has(option.value); });
    }
  }
  function renderList() {
    byId("tenkeyMailTotal").textContent = `${num(state.rows.length)}건`;
    byId("tenkeyMailListing").innerHTML = state.rows.length ? state.rows.map((row) => {
      const rewards = Array.isArray(row.attachments) ? row.attachments.map((item) => `${LABELS[item.kind] || item.kind} ${num(item.amount)}`).join(" · ") : "첨부 없음";
      const open = Math.max(0, Number(row.recipients || 0) - Number(row.claimed || 0) - Number(row.cancelled || 0));
      const mayCancel = open > 0 && new Date(row.expires_at).getTime() > Date.now();
      return `<article class="mail-sent-card"><div class="mail-sent-head"><strong>${esc(row.title_ko || "(제목 없음)")}</strong><span>${row.broadcast ? "전체 계정" : `대상 ${esc(row.target || "—")}`}</span></div><div class="mail-sent-meta"><span>발송 ${esc(timeKst(row.created_at))} · 만료 ${esc(timeKst(row.expires_at))}</span><span>${num(row.claimed)} / ${num(row.recipients)} 수령 · ${num(row.cancelled)} 취소</span></div><div class="mail-sent-meta"><span>${esc(rewards)} · 사유: ${esc(row.reason || "—")}</span>${mayCancel ? `<button class="warning-button" type="button" data-mail-cancel="${Number(row.id)}">미수령 취소 (${num(open)})</button>` : "<small>취소할 미수령 메일 없음</small>"}</div></article>`;
    }).join("") : '<p class="empty-panel">발송한 메일이 없습니다.</p>';
  }
  async function load() {
    T.setMessage("tenkeyMailMessage", "발송 목록을 불러오는 중입니다...");
    try {
      const result = await T.call("mail.list", { limit: 50 });
      state.rows = Array.isArray(result.data) ? result.data : [];
      renderList();
      T.setMessage("tenkeyMailMessage", "전체 50건까지 표시합니다. 미수령 보상만 취소됩니다.");
    } catch (error) { T.report("tenkeyMailMessage", error); }
  }
  function collect() {
    const f = byId("tenkeyMailForm").elements;
    const all = f.audience.value === "all";
    const target = f.target.value.trim();
    if (!all && !target) { T.setMessage("tenkeyMailFormMessage", "받는 사람의 공개 코드 또는 닉네임을 입력해 주세요.", true); return null; }
    const attachments = attachmentData();
    const seen = new Set();
    for (const item of attachments) {
      if (seen.has(item.kind) || !Number.isSafeInteger(item.amount) || item.amount < 1 || item.amount > LIMITS[item.kind]) {
        T.setMessage("tenkeyMailFormMessage", "보상 종류는 중복할 수 없고 수량 범위도 확인해 주세요.", true); return null;
      }
      seen.add(item.kind);
    }
    const expiresAt = kstInputToIso(f.expiresAt.value);
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now() || new Date(expiresAt).getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      T.setMessage("tenkeyMailFormMessage", "만료 시각은 현재부터 30일 이내로 설정해 주세요.", true); return null;
    }
    return {
      target, all,
      title_i18n: { ko: f.titleKo.value.trim(), en: f.titleEn.value.trim() },
      body_i18n: { ko: f.bodyKo.value.trim(), en: f.bodyEn.value.trim() },
      attachments, expires_at: expiresAt, reason: f.reason.value.trim(),
    };
  }
  async function submit(event) {
    event.preventDefault();
    const form = byId("tenkeyMailForm");
    if (!form.reportValidity()) return;
    const params = collect();
    if (!params) return;
    const target = params.all ? "전체 계정" : params.target;
    const summary = params.attachments.map((item) => `${LABELS[item.kind]} ${num(item.amount)}`).join(" · ") || "첨부 없음";
    if (!await root.ConsoleApp.confirmChange("10KEY 메일 발송", `${target}에게 ${summary}을(를) 보냅니다. 발송 후 수령한 보상은 회수할 수 없습니다.`)) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    T.setMessage("tenkeyMailFormMessage", "메일을 발송하고 있습니다...");
    try {
      const result = await T.call("mail.send", params, form);
      T.setMessage("tenkeyMailFormMessage", `${num(result.data?.recipient_count)}개 계정에 발송했습니다. (메일 ${num(result.data?.id)})`);
      form.elements.titleKo.value = ""; form.elements.titleEn.value = "";
      form.elements.bodyKo.value = ""; form.elements.bodyEn.value = ""; form.elements.reason.value = "";
      setDefaultExpiry(); renderPreview(); await load();
    } catch (error) { T.report("tenkeyMailFormMessage", error); }
    finally { button.disabled = false; }
  }
  async function cancel(id, button) {
    const reason = await T.askReason("미수령 메일 취소", `메일 ${id}의 아직 받지 않은 보상을 취소합니다.`);
    if (!reason) return;
    button.disabled = true;
    try {
      await T.call("mail.cancel", { id, reason }, byId("tenkeyMailListing"));
      await load();
    } catch (error) { T.report("tenkeyMailMessage", error); }
    finally { button.disabled = false; }
  }
  function mountMail() {
    if (!state.bound) {
      state.bound = true;
      const form = byId("tenkeyMailForm");
      form.addEventListener("submit", submit);
      form.addEventListener("input", renderPreview);
      form.addEventListener("change", (event) => {
        if (event.target.name === "audience") syncAudience();
        else { if (event.target.name === "kind") updateKindOptions(); renderPreview(); }
      });
      byId("tenkeyMailAddAttachment").addEventListener("click", addAttachment);
      byId("tenkeyMailAttachments").addEventListener("click", (event) => {
        const button = event.target.closest("[data-mail-remove]");
        if (!button) return;
        const rows = byId("tenkeyMailAttachments");
        button.closest("[data-mail-attachment]").remove();
        updateKindOptions();
        renderPreview();
      });
      byId("tenkeyMailListing").addEventListener("click", (event) => {
        const button = event.target.closest("[data-mail-cancel]");
        if (button) cancel(Number(button.dataset.mailCancel), button);
      });
      setDefaultExpiry(); syncAudience();
    }
    load();
  }
  root.ConsoleTenkey.mountMail = mountMail;
})(window);
