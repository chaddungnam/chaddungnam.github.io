(function attachConsolePurchases(root) {
  const byId = (id) => document.getElementById(id);
  const model = root.ConsolePurchasesModel;
  const state = { page: 1, pageCount: 1, requestSeq: 0, routeQuery: null };

  function text(value) { return value == null || value === "" ? "—" : String(value); }
  function shortUser(value) { const id = text(value); return id === "—" || id.length <= 14 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`; }
  function dateTime(row) {
    const raw = row.refunded_at || row.purchased_at || row.updated_at;
    if (!raw) return "—";
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(date);
  }
  function cell(row, value, className = "") { const td = row.insertCell(); td.textContent = text(value); if (className) td.className = className; return td; }
  function playerCell(row, item) {
    const td = row.insertCell();
    td.className = "purchase-player-cell";
    td.innerHTML = item.user_id ? root.ConsoleModel.playerIdentityMarkup(item, root.location.hash) : '<span class="player-identity-unlinked">계정 미연결</span>';
    if (item.user_id) {
      const id = document.createElement("small");
      id.title = text(item.user_id);
      id.textContent = shortUser(item.user_id);
      td.append(id);
    }
    return td;
  }
  function filters() {
    return {
      action: "purchases.list", rangeDays: Number(byId("purchaseRange").value), platform: byId("purchasePlatform").value,
      status: byId("purchaseStatus").value, productId: byId("purchaseProduct").value,
      query: byId("purchaseQuery").value.trim(), page: state.page, limit: 50,
    };
  }
  function renderRows(rows) {
    const body = byId("purchasesTable"); body.replaceChildren();
    if (!rows.length) { const tr = body.insertRow(); const td = tr.insertCell(); td.colSpan = 9; td.className = "empty-table-cell"; td.textContent = "조건에 맞는 실제 구매·환불 기록이 없습니다."; return; }
    rows.forEach((item) => {
      const tr = body.insertRow();
      tr.dataset.status = item.status || "unknown";
      tr.dataset.review = String(Boolean(item.repeat_refund_review));
      cell(tr, dateTime(item)); playerCell(tr, item); cell(tr, model.PRODUCT_LABELS[item.product_id] || item.product_id);
      cell(tr, item.platform === "ios" ? "App Store" : "Google Play"); cell(tr, model.formatMoney(item.amount_micros, item.currency));
      cell(tr, model.STATUS_LABELS[item.status] || item.status, `purchase-status purchase-status-${item.status}`);
      cell(tr, model.ENTITLEMENT_LABELS[item.entitlement_status] || item.entitlement_status);
      cell(tr, model.REASON_LABELS[item.refund_reason_category] || item.refund_reason_category);
      cell(tr, item.repeat_refund_review ? "반복 확인 필요" : "—", item.repeat_refund_review ? "purchase-review-flag" : "");
    });
  }
  function render(data) {
    const values = { total: data.summary.total || 0, purchased: data.summary.purchased || 0, refunded: data.summary.refunded || 0, chargebacks: data.summary.chargebacks || 0, refundRate: model.formatRate(data.summary.refundRate) };
    Object.entries(values).forEach(([key, value]) => { const node = document.querySelector(`[data-purchase-summary="${key}"]`); if (node) node.textContent = text(value); });
    const rangeStart = data.total ? (data.page - 1) * 50 + 1 : 0;
    const rangeEnd = Math.min(data.page * 50, data.total);
    byId("purchaseTotal").textContent = `${Number(data.total).toLocaleString("ko-KR")}건`;
    byId("purchasesPage").textContent = `${data.page} / ${data.pageCount} · ${rangeStart.toLocaleString("ko-KR")}–${rangeEnd.toLocaleString("ko-KR")} / ${Number(data.total).toLocaleString("ko-KR")}`;
    state.page = data.page; state.pageCount = data.pageCount;
    byId("purchasesPrevious").disabled = data.page <= 1; byId("purchasesNext").disabled = data.page >= data.pageCount;
    renderRows(data.purchases);
    const note = byId("purchaseSyncStatus"); note.dataset.connected = data.connected ? "true" : "false";
    note.querySelector(".status-label").textContent = data.connected ? "자동 동기화 연결됨" : "자동 동기화 미연동";
  }
  async function load() {
    const requestSeq = ++state.requestSeq;
    const panel = byId("purchasesTable").closest(".panel");
    panel?.setAttribute("aria-busy", "true");
    byId("purchasesMessage").textContent = "구매 기록을 업데이트하는 중입니다. 기존 결과는 그대로 유지합니다.";
    try {
      const data = await root.ConsoleAPI.post("admin-console", filters());
      if (requestSeq !== state.requestSeq) return;
      render(model.normalize(data));
      byId("purchasesMessage").textContent = "";
    } catch (_error) {
      if (requestSeq !== state.requestSeq) return;
      byId("purchasesMessage").textContent = "구매 기록을 불러오지 못했습니다. 기존 결과를 유지했습니다. 새로고침으로 다시 시도해 주세요.";
      if (!byId("purchasesTable").children.length) {
        const tr = byId("purchasesTable").insertRow();
        const td = tr.insertCell();
        td.colSpan = 9;
        td.className = "empty-table-cell error-state";
        td.textContent = "구매 기록을 불러오지 못했습니다.";
      }
    } finally {
      if (requestSeq === state.requestSeq) panel?.setAttribute("aria-busy", "false");
    }
  }
  function mount() {
    const query = new URLSearchParams(root.location.hash.split("?")[1] || "").get("query");
    if (query !== state.routeQuery) { byId("purchaseQuery").value = (query || "").slice(0, 100); state.page = 1; state.routeQuery = query; }
    load();
  }
  byId("purchaseFilterForm").addEventListener("submit", (event) => { event.preventDefault(); state.page = 1; load(); });
  byId("purchasesPrevious").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; load(); } });
  byId("purchasesNext").addEventListener("click", () => { if (state.page < state.pageCount) { state.page += 1; load(); } });
  root.ConsolePurchases = { mount };
})(window);
