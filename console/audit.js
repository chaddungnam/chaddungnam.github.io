(function attachConsoleAudit(root) {
  const state = { userId: "", page: 1, bound: false };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const prettyJson = (value) => value == null ? "없음" : JSON.stringify(value, null, 2);

  function setMessage(value, error = false) {
    byId("auditMessage").textContent = value;
    byId("auditMessage").style.color = error ? "var(--coral)" : "";
  }

  function render(data) {
    const rows = data.rows || [];
    const total = Number(data.total || 0);
    const pages = Math.max(1, Math.ceil(total / 50));
    const rangeStart = total ? (state.page - 1) * 50 + 1 : 0;
    const rangeEnd = Math.min(state.page * 50, total);
    byId("auditTotal").textContent = `${total.toLocaleString("ko-KR")}건`;
    byId("auditPage").textContent = `${state.page} / ${pages} · ${rangeStart.toLocaleString("ko-KR")}–${rangeEnd.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}`;
    byId("auditPrevious").disabled = state.page <= 1;
    byId("auditNext").disabled = state.page >= pages;
    byId("auditList").innerHTML = rows.length ? rows.map((row) => {
      const reversible = row.action_type === "player_mutation" && row.success && !row.reverts_action_id && row.target_user_id;
      const status = row.success ? "성공" : `실패 · ${escapeHtml(row.error_code)}`;
      return `<article class="audit-item" data-success="${row.success}"><div><strong>${escapeHtml(root.ConsoleModel.actionDisplayName(row.action_type))}</strong><small>${escapeHtml(time(row.created_at))} · ${escapeHtml(row.actor_email)}</small></div><p>${escapeHtml(row.reason)}</p><div class="audit-meta"><span class="audit-status">${status}</span>${row.target_user_id ? `<code>${escapeHtml(row.target_user_id)}</code>` : ""}</div><details class="audit-diff"><summary>변경값 보기</summary><code>변경 전\n${escapeHtml(prettyJson(row.before))}\n\n변경 후\n${escapeHtml(prettyJson(row.after))}</code></details>${reversible ? `<details class="audit-revert"><summary>이 변경 되돌리기</summary><form class="revert-form" data-action-id="${row.id}" data-user-id="${row.target_user_id}"><label>되돌리기 사유<input name="reason" maxlength="300" required></label><button class="danger-button" type="submit">되돌리기</button></form></details>` : ""}</article>`;
    }).join("") : '<p class="empty-panel">조건과 일치하는 감사 기록이 없습니다.</p>';
    byId("auditList").querySelectorAll(".revert-form").forEach((form) => form.addEventListener("submit", revert));
  }

  async function load() {
    const panel = byId("auditList").closest(".panel");
    panel?.setAttribute("aria-busy", "true");
    setMessage("감사 기록을 업데이트하는 중입니다. 기존 결과는 그대로 유지합니다.");
    try {
      const data = await root.ConsoleAPI.post("admin-console", { action: "audit.list", userId: state.userId || undefined, page: state.page });
      render(data);
      setMessage("되돌리기는 새 변경으로 기록되며, 발송된 우편과 공지는 되돌릴 수 없습니다.");
    } catch (error) {
      setMessage(`감사 기록을 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      panel?.setAttribute("aria-busy", "false");
    }
  }

  async function revert(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = form.elements.reason.value.trim();
    if (!reason) return;
    try {
      const detail = await root.ConsoleAPI.post("admin-console", { action: "players.get", userId: form.dataset.userId });
      if (!await root.ConsoleApp.confirmChange("플레이어 변경 되돌리기", `현재 상태 버전 ${detail.player.state_version}에서 선택한 변경 전 값으로 복원합니다.\n사유: ${reason}`)) return;
      await root.ConsoleAPI.post("admin-console", {
        action: "audit.revert", actionId: form.dataset.actionId, expectedVersion: detail.player.state_version,
        reason, requestId: crypto.randomUUID(),
      });
      setMessage("변경을 되돌리고 새 감사 기록을 남겼습니다.");
      await load();
    } catch (error) {
      setMessage(`되돌리지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    byId("auditFilterForm").addEventListener("submit", (event) => {
      event.preventDefault(); state.userId = byId("auditUserId").value.trim(); state.page = 1; load();
    });
    byId("auditPrevious").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; load(); } });
    byId("auditNext").addEventListener("click", () => { state.page += 1; load(); });
  }

  function mount() {
    const params = new URLSearchParams(root.location.hash.split("?")[1] || "");
    state.userId = (params.get("userId") || state.userId).slice(0, 36);
    byId("auditUserId").value = state.userId;
    bind(); load();
  }
  root.ConsoleAudit = { mount };
})(window);
