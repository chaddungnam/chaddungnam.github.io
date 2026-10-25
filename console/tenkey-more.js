// 10key Survival: 구매·젬, 랭킹 (보드), 감사 기록. Read-only views over what the server already keeps: purchase receipts
// verified with the stores, the gem ledger, the weekly / all-time boards (no automatic suspicious runs since 2026-10-24: sanctions are
// manual, a ban from the player detail), plus the audit rows
// of the admin writes (notices, bans, force-update settings).
(function attachConsoleTenkeyMore(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, pct, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { purchases: { bound: false, q: {} }, ranking: { bound: false }, audit: { bound: false } };
  let purchasePager = null;

  const STATE_NAMES = { granted: ["결제 완료", "good"], sandbox: ["테스트 결제", "quiet"], refunded: ["환불", "risk"] };
  const playerLink = (id, name) => (id ? `<a class="player-identity-link" href="#/tenkey-players/${esc(id)}"><span class="player-identity-name">${esc(name || "(이름 없음)")}</span></a>` : esc(name || "—"));

  // ── 구매 · 젬 ──
  function purchaseRow(p) {
    const [label, tone] = STATE_NAMES[p.state] || [p.state, "quiet"];
    return `<tr><td data-label="시각">${esc(time(p.created_at))}</td>
      <td data-label="플레이어">${p.player_id ? playerLink(p.player_id, p.name) : `<span class="tk-sub">탈퇴한 계정 · ${esc(p.login_short || "—")}</span>`}</td>
      <td data-label="상품">${esc(p.product_id)}</td><td data-label="스토어">${esc(platformName(p.platform))}</td>
      <td data-label="상태"><span class="tk-badge" data-tone="${tone}">${esc(label)}</span></td>
      <td data-label="주문 번호 끝"><code>${esc(p.order_tail || "—")}</code></td>
      <td data-label="환불">${esc(p.refunded_at ? `${time(p.refunded_at)}${p.refund_reason_category ? ` · ${p.refund_reason_category}` : ""}` : "—")}</td></tr>`;
  }

  async function loadPurchases(page = 1) {
    T.setMessage("tenkeyPurchasesMessage", "구매 기록을 불러오는 중입니다...");
    try {
      const q = state.purchases.q;
      const result = await T.call("purchases.list", { range_days: q.range ?? 30, platform: q.platform || undefined, state: q.state || undefined, query: q.query || "", page });
      const d = result.data;
      purchasePager.st.page = page;
      purchasePager.st.total = Number(d.total || 0);
      const s = d.summary || {};
      const set = (name, value) => { byId("tenkeyPurchaseSummary").querySelector(`[data-tk-summary="${name}"]`).textContent = value; };
      set("total", num(s.total)); set("granted", num(s.granted)); set("sandbox", num(s.sandbox)); set("refunded", num(s.refunded));
      set("refundRate", Number(s.granted) + Number(s.refunded) > 0 ? pct(s.refunded, Number(s.granted) + Number(s.refunded)) : "—");
      const g = s.gems || {};
      byId("tenkeyGemFacts").innerHTML = [
        ["기간 안에 받은 젬", num(g.granted_range)], ["기간 안에 쓴 젬", num(g.spent_range)],
        ["지금까지 받은 젬", num(g.granted_all)], ["지금까지 쓴 젬", num(g.spent_all)],
        ["장부 합계 (받음 − 씀)", num(Number(g.granted_all || 0) - Number(g.spent_all || 0))], ["장부가 있는 계정", num(g.wallets)],
        ["리바이브 패스 보유", num(g.revive_pass_owners)],
        ["상품별 결제", (s.by_product || []).map((x) => `${x.product} ${x.n}`).join(" · ") || "—"],
      ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
      byId("tenkeyPurchaseTotal").textContent = `${num(d.total)}건`;
      byId("tenkeyPurchasesTable").innerHTML = (d.rows || []).length ? d.rows.map(purchaseRow).join("") : '<tr><td colspan="7" class="empty-panel">조건에 맞는 구매 기록이 없습니다. 아직 스토어 결제가 없을 수 있습니다.</td></tr>';
      purchasePager.draw();
      T.setMessage("tenkeyPurchasesMessage", "환불은 스토어에서 환불 알림을 받거나 확인한 뒤에만 표시됩니다 (자동 알림 연결 전에는 늦을 수 있음).");
    } catch (error) {
      T.report("tenkeyPurchasesMessage", error);
    }
  }

  function mountPurchases() {
    const st = state.purchases;
    if (!st.bound) {
      st.bound = true;
      purchasePager = T.pager({ prev: "tenkeyPurchasesPrevious", next: "tenkeyPurchasesNext", label: "tenkeyPurchasesPage" }, 50, loadPurchases);
      byId("tenkeyPurchaseFilterForm").addEventListener("submit", (event) => {
        event.preventDefault();
        st.q = { range: Number(byId("tenkeyPurchaseRange").value), platform: byId("tenkeyPurchasePlatform").value, state: byId("tenkeyPurchaseState").value, query: byId("tenkeyPurchaseQuery").value.trim() };
        loadPurchases(1);
      });
    }
    loadPurchases(purchasePager.st.page || 1);
  }

  // ── 랭킹 ──
  const boardLabel = (board) => (board === "week" ? "이번 주" : board === "all" ? "전체 기간" : `${String(board).slice(1)} 시작 주`);

  function boardRow(r) {
    const hidden = !r.eligible;
    const status = r.banned ? ["정지", "risk"] : hidden ? ["옛 점수 규칙", "quiet"] : ["순위 반영", "good"];
    return `<tr${hidden ? ' class="is-dim"' : ""}><td class="tk-num" data-label="순위"><strong>${r.rank ? esc(num(r.rank)) : "—"}</strong></td>
      <td data-label="플레이어">${playerLink(r.player_id, r.name)}<span class="tk-sub">${esc(r.provider === "crazygames" ? "CrazyGames 로그인" : "앱 게스트 계정")}</span></td>
      <td class="tk-num" data-label="점수">${esc(num(r.score))}</td><td class="tk-num" data-label="레벨">${esc(r.level)}</td>
      <td data-label="시간">${esc(duration(r.time_ms))}</td><td data-label="기록 시각">${esc(time(r.achieved_at))}</td>
      <td data-label="상태"><span class="tk-badge" data-tone="${status[1]}">${esc(status[0])}</span></td></tr>`;
  }

  async function loadBoard() {
    T.setMessage("tenkeyBoardMessage", "랭킹을 불러오는 중입니다...");
    const select = byId("tenkeyBoardSelect");
    try {
      const board = select.value || "week";
      const result = await T.call("ranking.board", { board, limit: Number(byId("tenkeyBoardLimit").value) });
      const d = result.data;
      const keep = select.value;
      select.innerHTML = ['<option value="week">이번 주</option>', '<option value="all">전체 기간</option>',
        ...(d.boards || []).filter((b) => b !== "all").map((b) => `<option value="${esc(b)}">${esc(boardLabel(b))}</option>`)].join("");
      select.value = keep;
      byId("tenkeyBoardTitle").textContent = `랭킹 보드 · ${boardLabel(board)}`;
      byId("tenkeyBoardTotal").textContent = `순위 반영 ${num(d.total)}명`;
      byId("tenkeyBoardMeta").textContent = `보드 ${d.board} · 점수 규칙 ${d.current_rules}${d.ends ? ` · 주 끝 ${time(d.ends)}` : ""}. 앱에 보이는 순위 그대로입니다. 정지된 플레이어와 옛 점수 규칙의 기록은 순위 없이 흐리게 보입니다.`;
      byId("tenkeyBoardTable").innerHTML = (d.rows || []).length ? d.rows.map(boardRow).join("") : '<tr><td colspan="7" class="empty-panel">이 보드에는 아직 기록이 없습니다.</td></tr>';
      T.setMessage("tenkeyBoardMessage", "");
    } catch (error) {
      T.report("tenkeyBoardMessage", error);
    }
  }

  function mountRanking() {
    if (!state.ranking.bound) {
      state.ranking.bound = true;
      byId("tenkeyBoardForm").addEventListener("submit", (event) => { event.preventDefault(); loadBoard(); });
    }
    loadBoard();
  }

  // ── 감사 기록 ──
  const ACTION_NAMES = { "players.ban": "플레이어 정지 / 해제", "notices.save": "공지 저장", "notices.end": "공지 종료", "notices.delete": "공지 삭제", "config.set": "앱 설정 변경", "knobs.set": "밸런스 조정값 변경" };
  function auditSummary(a) {
    const p = a.params || {};
    if (a.action === "notices.save") return p.notice?.title_en ? `${p.notice?.title_ko || ""} / ${p.notice.title_en}` : `${p.notice?.title_ko || ""}${p.notice?.translations ? " (자동 번역 포함)" : ""}`;
    if (a.action === "players.ban") return `${p.banned ? "정지" : "정지 해제"} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "config.set") return JSON.stringify(p.config || {});
    if (a.action === "knobs.set") return JSON.stringify(p.knobs || {});
    return `공지 #${p.id ?? "?"}`;
  }
  function auditRow(a) {
    return `<article class="audit-item"><div><strong>${esc(ACTION_NAMES[a.action] || a.action)}</strong><small>${esc(time(a.at))} · ${esc(a.admin_email)}</small></div>
      <p>사유: ${esc((a.params || {}).reason || "—")}</p><code>${esc(auditSummary(a))}</code></article>`;
  }

  async function loadAudit() {
    T.setMessage("tenkeyAuditMessage", "감사 기록을 불러오는 중입니다...");
    try {
      const result = await T.call("audit.list", { limit: Number(byId("tenkeyAuditLimit").value) });
      const rows = Array.isArray(result.data) ? result.data : [];
      byId("tenkeyAuditTotal").textContent = `${num(rows.length)}건`;
      byId("tenkeyAuditList").innerHTML = rows.length ? rows.map(auditRow).join("") : '<p class="empty-panel">아직 기록이 없습니다.</p>';
      T.setMessage("tenkeyAuditMessage", "");
    } catch (error) {
      T.report("tenkeyAuditMessage", error);
    }
  }

  function mountAudit() {
    if (!state.audit.bound) {
      state.audit.bound = true;
      byId("tenkeyAuditFilterForm").addEventListener("submit", (event) => { event.preventDefault(); loadAudit(); });
    }
    loadAudit();
  }

  T.mountPurchases = mountPurchases;
  T.mountRanking = mountRanking;
  T.mountAudit = mountAudit;
})(window);
