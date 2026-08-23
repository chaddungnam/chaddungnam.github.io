(function attachConsolePlayers(root) {
  const ADMIN_GRANT_ITEMS = [
    { item_id: "icon_jakwon_tongue", item_type: "profile_icon", admin_label: "yakwon 프로필" },
    { item_id: "skin_jakwon", item_type: "marble_skin", admin_label: "yakwon 구슬" },
  ];
  const state = { query: "", rangeDays: 0, sort: "latest_played_at", direction: "desc", page: 1, loading: false, bound: false, exclusions: new Map() };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const countryMarkup = (value) => {
    const country = root.ConsoleModel.countryDisplay(value);
    return `<span class="country-label" title="국가 코드: ${escapeHtml(country.code || "없음")}">
      <span class="country-flag" aria-hidden="true">${escapeHtml(country.flag)}</span>
      <span><strong>${escapeHtml(country.name)}</strong><small>${escapeHtml(country.code)}</small></span>
    </span>`;
  };
  const number = (value) => Number(value ?? 0).toLocaleString("ko-KR");
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const prettyJson = (value) => value == null ? "없음" : JSON.stringify(value, null, 2);
  const message = (id, value, error = false) => {
    byId(id).textContent = value;
    byId(id).style.color = error ? "var(--coral)" : "";
  };

  function errorText(error) {
    if (error?.message === "version_conflict") return "다른 저장이 먼저 반영되었습니다. 최신 값을 다시 불러왔습니다.";
    if (error?.message === "mutations_disabled") return "호환 게임 빌드 배포 전까지 직접 수정은 잠겨 있습니다.";
    return `요청을 처리하지 못했습니다: ${error?.message || "알 수 없는 오류"}`;
  }

  function readListHash() {
    const params = new URLSearchParams(root.location.hash.split("?")[1] || "");
    state.query = (params.get("query") || "").slice(0, 100);
    state.rangeDays = [0, 1, 7, 28].includes(Number(params.get("rangeDays"))) ? Number(params.get("rangeDays")) : 0;
    state.sort = ["latest_played_at", "best_score", "nickname", "country", "gems", "state_version"].includes(params.get("sort")) ? params.get("sort") : "latest_played_at";
    state.direction = ["asc", "desc"].includes(params.get("direction")) ? params.get("direction") : "desc";
    state.page = Math.max(1, Number(params.get("page")) || 1);
  }

  function syncListHash() {
    const params = new URLSearchParams({ rangeDays: state.rangeDays, sort: state.sort, direction: state.direction, page: state.page });
    if (state.query) params.set("query", state.query);
    root.history.replaceState(null, "", `#/players?${params}`);
  }

  function renderList(data) {
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const total = Number(data.total || 0);
    const pages = Math.max(1, Math.ceil(total / 50));
    byId("playerMutationBanner").textContent = data.mutations_enabled
      ? "직접 수정 활성화 · 모든 변경은 사유와 함께 감사 기록에 남습니다."
      : "읽기 전용 · 다음 호환 게임 빌드가 배포될 때까지 재화와 점수 수정은 잠겨 있습니다.";
    byId("playerMutationBanner").dataset.enabled = String(Boolean(data.mutations_enabled));
    byId("playerTotal").textContent = `${number(total)}명`;
    const rangeStart = total ? (state.page - 1) * 50 + 1 : 0;
    const rangeEnd = Math.min(state.page * 50, total);
    byId("playersPage").textContent = `${state.page} / ${pages} · ${number(rangeStart)}–${number(rangeEnd)} / ${number(total)}`;
    byId("playersPrevious").disabled = state.page <= 1;
    byId("playersNext").disabled = state.page >= pages;
    byId("playersTable").innerHTML = rows.length ? rows.map((row) => `<tr>
      <td><strong>${escapeHtml(root.ConsoleModel.playerDisplayName({ nickname: row.nickname, displayCode: row.display_code }))}</strong><small>${escapeHtml(row.account_type)}</small>${state.exclusions.has(row.user_id) ? '<span class="analytics-exclusion-badge">로컬/QA 제외</span>' : ""}</td>
      <td>${countryMarkup(row.country)}</td><td>${number(row.games_played)}</td>
      <td>${number(row.best_score)}<small>Lv.${number(row.best_level)}</small></td>
      <td>${number(row.gems)}</td><td>${number(row.stamina)} / ${number(row.stamina_max)}</td>
      <td>${number(row.breakthrough_tickets)} · ${number(row.speed_boost_tickets)}</td>
      <td>${escapeHtml(time(row.latest_played_at))}</td>
      <td><a class="player-open-link" href="#/players/${encodeURIComponent(row.user_id)}?return=${encodeURIComponent(root.location.hash)}">상세</a></td>
    </tr>`).join("") : '<tr><td class="empty-row" colspan="9">조건과 일치하는 플레이어가 없습니다.</td></tr>';
  }

  async function loadList() {
    if (state.loading) return;
    state.loading = true;
    const panel = byId("playersTable").closest(".panel");
    panel?.setAttribute("aria-busy", "true");
    message("playersMessage", "플레이어 목록을 업데이트하는 중입니다. 기존 결과는 그대로 유지합니다.");
    try {
      const [data, exclusions] = await Promise.all([
        root.ConsoleAPI.post("admin-console", {
          action: "players.list", rangeDays: state.rangeDays, query: state.query,
          sort: state.sort, direction: state.direction, page: state.page,
        }),
        root.ConsoleAPI.post("admin-console", { action: "analytics_exclusions.list" }).catch(() => []),
      ]);
      const exclusionRows = Array.isArray(exclusions) ? exclusions : Array.isArray(exclusions?.rows) ? exclusions.rows : [];
      state.exclusions = new Map(exclusionRows.map((row) => [row.user_id, row]));
      renderList(data);
      message("playersMessage", "닉네임이 같아도 표시코드와 사용자 ID가 다른 계정은 각각 표시됩니다.");
    } catch (error) {
      message("playersMessage", errorText(error), true);
    } finally {
      state.loading = false;
      panel?.setAttribute("aria-busy", "false");
    }
  }

  function bindList() {
    if (state.bound) return;
    state.bound = true;
    byId("playerSearchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = byId("playerSearch").value.trim();
      state.rangeDays = Number(byId("playerRange").value);
      state.sort = byId("playerSort").value;
      state.direction = byId("playerDirection").value;
      state.page = 1;
      syncListHash();
      loadList();
    });
    byId("playersPrevious").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; syncListHash(); loadList(); } });
    byId("playersNext").addEventListener("click", () => { state.page += 1; syncListHash(); loadList(); });
  }

  function economyFields(player, disabled) {
    const fields = [
      ["gems", "젬"], ["stamina", "스태미나"], ["stamina_max", "최대 스태미나"],
      ["breakthrough_tickets", "돌파 티켓"], ["speed_boost_tickets", "스피드 티켓"],
    ];
    return fields.map(([key, label]) => `<label>${label}<input name="${key}" type="number" min="0" step="1" value="${Number(player[key] || 0)}" ${disabled ? "disabled" : ""}></label>`).join("");
  }

  function auditHtml(rows) {
    return rows.length ? rows.map((row) => `<article class="audit-item" data-success="${row.success}">
      <div><strong>${escapeHtml(root.ConsoleModel.actionDisplayName(row.action_type))}</strong><small>${escapeHtml(time(row.created_at))} · ${escapeHtml(row.actor_email)}</small></div>
      <p>${escapeHtml(row.reason)}</p><details class="audit-diff"><summary>변경값 보기</summary><code>변경 전\n${escapeHtml(prettyJson(row.before))}\n\n변경 후\n${escapeHtml(prettyJson(row.after))}</code></details>
    </article>`).join("") : '<p class="empty-panel">아직 변경 기록이 없습니다.</p>';
  }

  function recordRows(records, disabled) {
    return records.length ? records.map((record) => `<tr>
      <td>${escapeHtml(time(record.played_at))}<small>${escapeHtml(record.source)}</small></td>
      <td>${number(record.score)}</td><td>Lv.${number(record.level)}</td><td>${record.excluded ? "제외됨" : "반영 중"}</td>
      <td><details><summary>${disabled ? "보기" : "보정"}</summary><form class="score-form" data-record-id="${record.record_id}">
        <div class="form-pair"><label>점수<input name="score" type="number" min="0" step="1" value="${record.score}" ${disabled ? "disabled" : ""}></label><label>레벨<input name="level" type="number" min="0" step="1" value="${record.level}" ${disabled ? "disabled" : ""}></label></div>
        <label class="check-label"><input name="excluded" type="checkbox" ${record.excluded ? "checked" : ""} ${disabled ? "disabled" : ""}> 랭킹에서 기록 제외</label>
        <label>보정 사유<input name="reason" maxlength="300" required ${disabled ? "disabled" : ""}></label><button class="primary-button" type="submit" ${disabled ? "disabled" : ""}>기록 보정</button>
      </form></details></td>
    </tr>`).join("") : '<tr><td class="empty-row" colspan="5">게임 기록이 없습니다.</td></tr>';
  }

  function renderDetail(data, userId) {
    const player = data.player;
    const exclusion = data.analytics_exclusion;
    const enabled = Boolean(data.operations?.mutations_enabled);
    const disabled = !enabled || player.state_version == null;
    const catalog = Array.isArray(data.catalog) ? data.catalog : [];
    const owned = new Set((data.entitlements || []).map((item) => item.item_id));
    const grantCatalog = catalog.concat(ADMIN_GRANT_ITEMS.filter((item) => !catalog.some((entry) => entry.item_id === item.item_id)));
    const catalogOptions = grantCatalog.map((item) => `<option value="${escapeHtml(item.item_id)}" ${owned.has(item.item_id) ? "disabled" : ""}>${escapeHtml(item.admin_label || item.item_id)} · ${escapeHtml(item.item_type)}${owned.has(item.item_id) ? " · 보유 중" : ""}</option>`).join("");
    const entitlementRows = (data.entitlements || []).map((item) => `<li><span><strong>${escapeHtml(item.item_id)}</strong><small>${escapeHtml(item.item_type)} · ${escapeHtml(item.acquired_source || "-")}</small></span><button type="button" class="secondary-button inventory-revoke" data-item-id="${escapeHtml(item.item_id)}" ${disabled ? "disabled" : ""}>회수</button></li>`).join("");
    byId("playerDetail").innerHTML = `<div class="player-detail-head panel"><div><p class="eyebrow">PLAYER</p><h2>${escapeHtml(root.ConsoleModel.playerDisplayName({ nickname: player.nickname, displayCode: player.display_code }))} ${exclusion ? '<span class="analytics-exclusion-badge">로컬/QA 제외</span>' : ""}</h2><code>${escapeHtml(userId)}</code>${exclusion ? `<p class="status-label">통계 제외 · ${escapeHtml(exclusion.reason)} · ${escapeHtml(exclusion.note || "메모 없음")}</p>` : ""}</div><div class="detail-actions"><button id="copyPlayerId" type="button">ID 복사</button><a href="#/cs?userId=${encodeURIComponent(userId)}">CS에서 보기</a></div></div>
      <div class="read-only-banner" data-enabled="${enabled}">${enabled ? `수정 가능 · 현재 상태 버전 ${player.state_version}` : "읽기 전용 · 호환 빌드 배포 후 수정 기능을 켤 수 있습니다."}</div>
      <div class="admin-card-grid"><form id="economyForm" class="panel admin-form"><p class="eyebrow">ECONOMY</p><h2>재화 직접 조정</h2><div class="economy-grid">${economyFields(player, disabled)}</div><label>변경 사유<input name="reason" maxlength="300" required ${disabled ? "disabled" : ""}></label><button class="primary-button" type="submit" ${disabled ? "disabled" : ""}>변경 내용 확인</button></form>
      <form id="playerMailForm" class="panel admin-form"><p class="eyebrow">TARGETED MAIL</p><h2>이 플레이어에게 우편</h2><label>고정 다국어 문구<select name="templateKey"><option value="general">안내 보상</option><option value="compensation">불편 보상</option><option value="maintenance">점검 보상</option><option value="welcome">환영 보상</option><option value="support">문의 지원 보상</option><option value="update">업데이트 보상</option><option value="launch">출시 기념 보상</option></select></label><div class="form-pair"><label>보상<select name="kind"><option value="gems">젬</option><option value="breakthrough_ticket">배속 티켓</option><option value="entitlement">상점 아이템</option></select></label><label id="playerMailValueLabel">수량<input name="rewardValue" type="number" min="1" required></label></div><label>수령 기한<input name="expiresAt" type="datetime-local" required></label><label>발송 사유<input name="reason" maxlength="300" required></label><button class="primary-button" type="submit">이 플레이어에게 발송</button></form>
      <article class="panel"><p class="eyebrow">INVENTORY</p><h2>소지 아이템</h2><form id="inventoryForm" class="form-pair"><label>상점 아이템<select name="itemId">${catalogOptions || '<option value="">판매 상품 없음</option>'}</select></label><label>변경 사유<input name="reason" maxlength="300" required ${disabled ? "disabled" : ""}></label><button class="primary-button" type="submit" ${disabled || !catalogOptions ? "disabled" : ""}>지급</button></form><ul class="inventory-list">${entitlementRows || '<li class="empty-panel">보유 아이템이 없습니다.</li>'}</ul></article>
      <article class="panel player-facts"><p class="eyebrow">ACCOUNT</p><h2>계정 상태</h2><dl><div><dt>최고 점수</dt><dd>${number(player.best_score)}</dd></div><div><dt>최고 레벨</dt><dd>${number(player.best_level)}</dd></div><div><dt>게임 수</dt><dd>${number(player.game_count)}</dd></div><div><dt>대기 우편</dt><dd>${number(data.operations?.pending_mail_count)}</dd></div><div><dt>광고 제거</dt><dd>${player.ads_removed ? "예" : "아니오"}</dd></div><div><dt>QA 상점</dt><dd>${data.operations?.qa_shop_controls_enabled ? "허용" : "미허용"}</dd></div></dl></article></div>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">SCORE RECORDS</p><h2>점수 기록 보정</h2><small>기록은 삭제하지 않으며, 최고 기록은 반영 중인 기록에서 서버가 다시 계산합니다.</small></div></div><div class="table-scroll"><table><thead><tr><th>플레이 시각</th><th>점수</th><th>레벨</th><th>랭킹</th><th>처리</th></tr></thead><tbody>${recordRows(data.records || [], disabled)}</tbody></table></div></section>
      <section class="panel danger-zone"><div class="panel-heading"><div><p class="eyebrow">DANGER ZONE</p><h2>플레이어 데이터 초기화</h2><small>재화·인벤토리·우편함·시즌패스·친구 관계를 모두 지우고 닉네임·표시코드·국가·최고기록을 초기화합니다. 게임 기록(랭킹)은 남지만 닉네임이 비어 표시됩니다. 되돌릴 수 없습니다. 다음 실행 시 자동으로 로그아웃됩니다(새 클라이언트 배포 불필요).</small></div></div>
      <form id="wipeForm"><label>초기화 사유<input name="reason" maxlength="300" required ${disabled ? "disabled" : ""}></label><button class="danger-button" type="submit" ${disabled ? "disabled" : ""}>이 플레이어 데이터 초기화</button></form></section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">PLAYER AUDIT</p><h2>이 플레이어의 변경 기록</h2></div></div><div class="audit-list">${auditHtml(data.audit || [])}</div></section>`;
    byId("copyPlayerId").addEventListener("click", async () => {
      await navigator.clipboard.writeText(userId);
      message("playerMessage", "사용자 ID를 복사했습니다.");
    });
    byId("economyForm").addEventListener("submit", (event) => submitEconomy(event, data));
    byId("playerMailForm").addEventListener("submit", (event) => submitPlayerMail(event, userId));
    byId("playerMailForm").elements.kind.addEventListener("change", () => {
      const form = byId("playerMailForm");
      const label = byId("playerMailValueLabel");
      const current = form.elements.rewardValue;
      if (form.elements.kind.value === "entitlement") {
        const options = catalog.map((item) => `<option value="${escapeHtml(item.item_id)}">${escapeHtml(item.item_id)} · ${escapeHtml(item.item_type)}</option>`).join("");
        current.outerHTML = `<select name="rewardValue" required>${options}</select>`;
        label.firstChild.textContent = "상점 아이템";
      } else {
        current.outerHTML = '<input name="rewardValue" type="number" min="1" step="1" required>';
        label.firstChild.textContent = "수량";
      }
    });
    byId("inventoryForm").addEventListener("submit", (event) => submitInventory(event, userId));
    byId("playerDetail").querySelectorAll(".inventory-revoke").forEach((button) => button.addEventListener("click", () => submitInventory(null, userId, button.dataset.itemId, "revoke")));
    byId("playerDetail").querySelectorAll(".score-form").forEach((form) => form.addEventListener("submit", (event) => submitScore(event, userId)));
    byId("wipeForm").addEventListener("submit", (event) => submitWipe(event, userId, player));
  }

  async function submitWipe(event, userId, player) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = form.elements.reason.value.trim();
    const displayName = root.ConsoleModel.playerDisplayName({ nickname: player.nickname, displayCode: player.display_code });
    if (!reason) { message("playerMessage", "초기화 사유를 입력해 주세요.", true); return; }
    if (!await root.ConsoleApp.confirmChange("플레이어 데이터 초기화", `${displayName} (${userId})\n재화·인벤토리·우편함·시즌패스·친구 관계를 모두 지우고 프로필을 초기화합니다.\n되돌릴 수 없습니다.\n사유: ${reason}`)) return;
    try {
      await root.ConsoleAPI.post("admin-console", { action: "players.wipe", userId, reason, requestId: crypto.randomUUID() });
      message("playerMessage", "플레이어 데이터를 초기화했습니다.");
    } catch (error) {
      message("playerMessage", errorText(error), true);
    }
    await mountDetail(userId);
  }

  async function submitPlayerMail(event, userId) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const amount = Number(values.rewardValue);
    if (!form.reportValidity() || (values.kind !== "entitlement" && (!Number.isSafeInteger(amount) || amount < 1))) return;
    const expiresAt = new Date(values.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) return;
    const reward = values.kind === "entitlement" ? [{ kind: "entitlement", item_id: values.rewardValue }] : [{ kind: values.kind, amount }];
    try {
      await root.ConsoleAPI.post("admin-console", { action: "reward_mail.send", userId, templateKey: values.templateKey, reward, expiresAt: expiresAt.toISOString(), reason: values.reason.trim(), requestId: crypto.randomUUID() });
      message("playerMessage", "개별 보상 우편을 발송했습니다.");
      await mountDetail(userId);
    } catch (error) { message("playerMessage", errorText(error), true); }
  }

  async function submitInventory(event, userId, itemId = "", operation = "grant") {
    const form = event?.currentTarget;
    if (event) event.preventDefault();
    const selectedItem = itemId || form.elements.itemId.value;
    const reason = itemId ? "운영자 회수" : form.elements.reason.value.trim();
    if (!selectedItem || !reason || !await root.ConsoleApp.confirmChange(operation === "revoke" ? "아이템 회수" : "아이템 지급", `${selectedItem}\n사유: ${reason}`)) return;
    try {
      await root.ConsoleAPI.post("admin-console", { action: "players.inventory_mutate", userId, itemId: selectedItem, operation, reason, requestId: crypto.randomUUID() });
      message("playerMessage", operation === "revoke" ? "아이템을 회수했습니다." : "아이템을 지급했습니다.");
      await mountDetail(userId);
    } catch (error) { message("playerMessage", errorText(error), true); }
  }

  async function submitEconomy(event, data) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(["gems", "stamina", "stamina_max", "breakthrough_tickets", "speed_boost_tickets"].map((key) => [key, Number(form.elements[key].value)]));
    const changes = root.ConsoleModel.diffPlayerChanges(data.player, values);
    const next = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.after]));
    const reason = form.elements.reason.value.trim();
    if (!root.ConsoleModel.canSubmitMutation({ reason, changes: next, mutationsEnabled: data.operations.mutations_enabled, stateVersion: data.player.state_version })) {
      message("playerMessage", "변경할 값과 사유를 확인해 주세요.", true); return;
    }
    const summary = Object.entries(changes).map(([key, value]) => `${key}: ${value.before} → ${value.after} (${value.after - value.before >= 0 ? "+" : ""}${value.after - value.before})`).join("\n");
    if (!await root.ConsoleApp.confirmChange("재화 변경 확인", `${summary}\n사유: ${reason}`)) return;
    try {
      await root.ConsoleAPI.post("admin-console", { action: "players.mutate", userId: data.player.user_id, expectedVersion: data.player.state_version, changes: next, reason, requestId: crypto.randomUUID() });
      message("playerMessage", "재화 변경을 저장했습니다.");
    } catch (error) {
      message("playerMessage", errorText(error), true);
    }
    await mountDetail(data.player.user_id);
  }

  async function submitScore(event, userId) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const payload = {
      action: "scores.correct", recordId: Number(form.dataset.recordId), score: Number(values.score), level: Number(values.level),
      excluded: form.elements.excluded.checked, reason: String(values.reason || "").trim(), requestId: crypto.randomUUID(),
    };
    if (!payload.reason || !await root.ConsoleApp.confirmChange("점수 기록 보정", `점수 ${payload.score} · 레벨 ${payload.level} · ${payload.excluded ? "랭킹 제외" : "랭킹 반영"}\n최고 기록은 서버에서 다시 계산\n사유: ${payload.reason}`)) return;
    try {
      await root.ConsoleAPI.post("admin-console", payload);
      message("playerMessage", "점수 기록을 보정했습니다.");
    } catch (error) {
      message("playerMessage", errorText(error), true);
    }
    await mountDetail(userId);
  }

  async function mountDetail(userId) {
    const params = new URLSearchParams(root.location.hash.split("?")[1] || "");
    byId("playerBackLink").href = root.ConsoleModel.safeConsoleReturnHash(params.get("return"));
    message("playerMessage", "플레이어 상세를 불러오는 중...");
    try {
      const [data, exclusions] = await Promise.all([
        root.ConsoleAPI.post("admin-console", { action: "players.get", userId }),
        root.ConsoleAPI.post("admin-console", { action: "analytics_exclusions.list" }).catch(() => []),
      ]);
      const exclusionRows = Array.isArray(exclusions) ? exclusions : Array.isArray(exclusions?.rows) ? exclusions.rows : [];
      data.analytics_exclusion = exclusionRows.find((row) => row.user_id === userId) || null;
      renderDetail(data, userId);
      message("playerMessage", "복구 코드와 인증 정보는 콘솔에 표시하지 않습니다.");
    } catch (error) {
      byId("playerDetail").innerHTML = '<div class="empty-state"><strong>플레이어를 찾을 수 없습니다.</strong></div>';
      message("playerMessage", errorText(error), true);
    }
  }

  function mountList() {
    readListHash(); bindList();
    byId("playerSearch").value = state.query;
    byId("playerRange").value = String(state.rangeDays);
    byId("playerSort").value = state.sort;
    byId("playerDirection").value = state.direction;
    loadList();
  }

  root.ConsolePlayers = { mountList, mountDetail };
})(window);
