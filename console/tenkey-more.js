// 10key Survival: 구매·젬, 랭킹 (보드), 감사 기록. Read-only views over what the server already keeps: purchase receipts
// verified with the stores, the gem ledger, the weekly / all-time boards (no automatic suspicious runs since 2026-10-24: sanctions are
// manual, a ban from the player detail), plus the audit rows
// of the admin writes (notices, bans, force-update settings).
(function attachConsoleTenkeyMore(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, pct, platformName, productName, boardName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { purchases: { bound: false, q: {}, unit: "day", money: null }, ranking: { bound: false }, audit: { bound: false } };
  // Money per purchase (owner 2026-11-24 night: country store, amount, expected net, totals by day / week / month): tenkey-console-stats
  // money.get (it also fills the store numbers of new purchases). Country names in Korean from the browser.
  const regionName = (() => { try { const d = new Intl.DisplayNames(["ko"], { type: "region" }); return (c) => (c ? `${d.of(c) || c}` : "—"); } catch (_e) { return (c) => c || "—"; } })();
  const cur = (v, c) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: ["KRW", "JPY", "TWD", "HUF", "CLP", "IDR", "VND"].includes(c) ? 0 : 2 })} ${c || ""}`.trim());
  const eur = (v) => (v === null || v === undefined ? "—" : `€${Number(v).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  let purchasePager = null;

  const STATE_NAMES = { granted: ["결제 완료", "good"], sandbox: ["테스트 결제", "quiet"], refunded: ["환불", "risk"] };
  const cubesUsd = (cubes) => "USD " + (Number(cubes || 0) / 100).toFixed(2);  // Nekoland: 1 cube = USD 0.01 (owner 11-06)
  const playerLink = (id, name) => (id ? `<a class="player-identity-link" href="#/tenkey-players/${esc(id)}"><span class="player-identity-name">${esc(name || "(이름 없음)")}</span></a>` : esc(name || "—"));

  // ── 구매 · 젬 ──
  function purchaseRow(p) {
    const [label, tone] = STATE_NAMES[p.state] || [p.state, "quiet"];
    return `<tr><td data-label="시각">${esc(time(p.created_at))}</td>
      <td data-label="플레이어">${p.player_id ? playerLink(p.player_id, p.name) : `<span class="tk-sub">탈퇴한 계정 · ${esc(p.login_short || "—")}</span>`}</td>
      <td data-label="상품">${esc(productName(p.product_id))}<span class="tk-sub">${esc(p.product_id)}</span>${p.platform === "nekoland" && p.price_cents != null ? `<span class="tk-sub">${esc(num(p.price_cents))} 큐브 (${esc(cubesUsd(p.price_cents))})</span>` : ""}</td>
      ${moneyCells(p)}
      <td data-label="상태"><span class="tk-badge" data-tone="${tone}">${esc(label)}</span></td>
      <td data-label="주문 번호 끝"><code>${esc(p.order_tail || "—")}</code></td>
      <td data-label="환불">${esc(p.refunded_at ? `${time(p.refunded_at)}${p.refund_reason_category ? ` · ${p.refund_reason_category}` : ""}` : "—")}</td></tr>`;
  }

  function moneyCells(p) {
    const m = state.purchases.money?.items?.[p.id];
    const where = `${esc(platformName(p.platform))}<span class="tk-sub">${esc(m ? regionName(m.country) : p.platform === "nekoland" ? "—" : "확인 중")}</span>`;
    if (!m) return `<td data-label="스토어 · 나라">${where}</td><td data-label="결제 금액" class="tk-num">—</td><td data-label="예상 순수익" class="tk-num">—</td>`;
    const src = m.net_source === "store" ? "스토어 값" : m.net_source === "estimate" ? `예상 (부가세 ${Math.round(Number(m.vat_rate || 0) * 1000) / 10}%, 수수료 15%)` : (m.note || "금액 못 받음");
    return `<td data-label="스토어 · 나라">${where}</td>
      <td data-label="결제 금액" class="tk-num">${esc(cur(m.price, m.currency))}<span class="tk-sub">${esc(eur(m.price_eur))}</span></td>
      <td data-label="예상 순수익" class="tk-num">${esc(eur(m.net_eur))}<span class="tk-sub">${esc(src)}</span></td>`;
  }

  function periodLabel(day, unit) {
    const d = new Date(`${day}T00:00:00Z`);
    if (unit === "month") return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월`;
    if (unit === "week") { const e = new Date(d.getTime() + 6 * 86400000); return `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ~ ${e.getUTCMonth() + 1}. ${e.getUTCDate()}.`; }
    return `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. (${"일월화수목금토"[d.getUTCDay()]})`;
  }

  function renderMoney() {
    const m = state.purchases.money;
    if (!m) { byId("tenkeyMoneyTable").innerHTML = '<tr><td colspan="7" class="empty-panel">매출을 불러오지 못했습니다.</td></tr>'; return; }
    const rows = m.periods || [];
    const total = (r) => Number(r.iap_net_eur || 0) + Number(r.app_net_eur || 0);
    const label = { day: "오늘", week: "이번 주", month: "이번 달" }[m.unit] || "이번";
    const now = rows[0] || {}, prev = rows[1] || {};
    const sumAll = rows.reduce((t, r) => t + total(r), 0);
    byId("tenkeyMoneyFacts").innerHTML = [
      [`${label} 순수익`, eur(total(now))], [`${label} 결제액 (인앱 + 앱)`, eur(Number(now.iap_gross_eur || 0) + Number(now.app_gross_eur || 0))],
      [`앞 ${{ day: "날", week: "주", month: "달" }[m.unit] || "기간"} 순수익`, eur(total(prev))], [`표의 ${rows.length}${{ day: "일", week: "주", month: "개월" }[m.unit]} 합계`, eur(sumAll)],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    byId("tenkeyMoneyTable").innerHTML = rows.map((r) => `<tr>
      <td data-label="기간">${esc(periodLabel(r.period, m.unit))}</td>
      <td data-label="인앱 건수" class="tk-num">${esc(num(r.iap_count))}${r.iap_unpriced ? `<span class="tk-sub">금액 확인 중 ${esc(num(r.iap_unpriced))}</span>` : ""}</td>
      <td data-label="인앱 결제액" class="tk-num">${esc(eur(r.iap_gross_eur))}</td><td data-label="인앱 순수익" class="tk-num">${esc(eur(r.iap_net_eur))}</td>
      <td data-label="앱 판매" class="tk-num">${esc(num(r.app_units))}</td><td data-label="앱 판매 순수익" class="tk-num">${esc(eur(r.app_net_eur))}</td>
      <td data-label="순수익 합계" class="tk-num"><strong>${esc(eur(total(r)))}</strong></td></tr>`).join("");
  }

  async function loadMoney() {
    try {
      state.purchases.money = await T.stats("money.get", { unit: state.purchases.unit, periods: state.purchases.unit === "day" ? 14 : state.purchases.unit === "week" ? 12 : 12 });
    } catch (_e) {
      state.purchases.money = null;
    }
    renderMoney();
  }

  async function loadPurchases(page = 1) {
    T.setMessage("tenkeyPurchasesMessage", "구매 기록을 불러오는 중입니다...");
    try {
      const q = state.purchases.q;
      const [result] = await Promise.all([
        T.call("purchases.list", { range_days: q.range ?? 30, platform: q.platform || undefined, state: q.state || undefined, query: q.query || "", page }),
        loadMoney(),
      ]);
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
        ["상품별 결제", (s.by_product || []).map((x) => `${productName(x.product)} ${x.n}건`).join(" · ") || "—"],
        ["네코랜드 결제 (1 큐브 = 1 센트)", `${num(s.nekoland)}건 · ${num(s.nekoland_cubes)} 큐브 (${cubesUsd(s.nekoland_cubes)})`],
      ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
      byId("tenkeyPurchaseTotal").textContent = `${num(d.total)}건`;
      byId("tenkeyPurchasesTable").innerHTML = (d.rows || []).length ? d.rows.map(purchaseRow).join("") : '<tr><td colspan="9" class="empty-panel">조건에 맞는 구매 기록이 없습니다. 아직 스토어 결제가 없을 수 있습니다.</td></tr>';
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
      byId("tenkeyMoney").addEventListener("click", (event) => {
        const b = event.target.closest("[data-tk-money-unit]");
        if (!b) return;
        st.unit = b.dataset.tkMoneyUnit;
        document.querySelectorAll("[data-tk-money-unit]").forEach((x) => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); });
        loadMoney();
      });
      byId("tenkeyPurchaseFilterForm").addEventListener("submit", (event) => {
        event.preventDefault();
        st.q = { range: Number(byId("tenkeyPurchaseRange").value), platform: byId("tenkeyPurchasePlatform").value, state: byId("tenkeyPurchaseState").value, query: byId("tenkeyPurchaseQuery").value.trim() };
        loadPurchases(1);
      });
    }
    loadPurchases(purchasePager.st.page || 1);
  }

  // ── 랭킹 ──
  const boardLabel = boardName;

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
      select.innerHTML = ['<option value="week">이번 시즌</option>', '<option value="all">전체 기간</option>',
        ...(d.boards || []).filter((b) => b !== "all" && !(board === "week" && b === d.board)).map((b) => `<option value="${esc(b)}">${esc(boardLabel(b))}</option>`)].join("");
      select.value = keep;
      byId("tenkeyBoardTitle").textContent = `랭킹 보드 · ${boardLabel(board === "week" && d.board ? d.board : board)}`;
      byId("tenkeyBoardTotal").textContent = `순위 반영 ${num(d.total)}명`;
      byId("tenkeyBoardMeta").textContent = `보드 ${d.board} · 점수 규칙 ${d.current_rules}${d.ends ? ` · 시즌 끝 ${time(d.ends)}` : ""}. 앱에 보이는 순위 그대로입니다. 정지된 플레이어와 옛 점수 규칙의 기록은 순위 없이 흐리게 보입니다.`;
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
  const ACTION_NAMES = { "players.ban": "플레이어 정지 / 해제", "unlocks.set": "해금 단계 변경", "unlocks.upto": "해금 여기까지 켜기", "unlocks.many": "기본 탭 (1~6) 한 번에 변경", "checkpoint.set": "체크포인트 변경", "god.set": "무적 모드 켜기 / 끄기", "review.set": "검수 모드 끄기 / 권한 회수", "notices.save": "공지 저장", "notices.end": "공지 종료", "notices.delete": "공지 삭제", "config.set": "강제 업데이트 번호 변경", "knobs.set": "밸런스 조정값 변경", "community.set": "유튜브 소통 링크 변경", "players.rename": "닉네임 변경", "mail.send": "메일 보내기", "mail.cancel": "미수령 메일 취소", "titles.grant": "칭호 부여", "titles.revoke": "칭호 회수", "issues.mark": "이슈 처리 상태 변경" };
  function auditSummary(a) {
    const p = a.params || {};
    if (a.action === "notices.save") return p.notice?.title_en ? `${p.notice?.title_ko || ""} / ${p.notice.title_en}` : `${p.notice?.title_ko || ""}${p.notice?.translations ? " (자동 번역 포함)" : ""}`;
    if (a.action === "players.ban") return `${p.banned ? "정지" : "정지 해제"} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "unlocks.set") return `${p.step} → ${{ auto: "자동", on: "켜짐", off: "꺼짐" }[p.state] || p.state} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "unlocks.many") return `${(p.steps || []).length}개 → ${{ auto: "자동", on: "켜짐", off: "꺼짐" }[p.state] || p.state} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "checkpoint.set") return `${p.mode === "hard" ? "하드" : "일반"} → ${p.level == null ? "자동" : `레벨 ${p.level}부터`} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "unlocks.upto") return `1~${p.step} 켜짐 · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "god.set") return `무적 ${p.on ? "켜짐" : "꺼짐"} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "review.set") return `검수 ${p.on ? "켜짐" : "꺼짐 · 권한 회수"} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "config.set") return JSON.stringify(p.config || {});
    if (a.action === "knobs.set") return JSON.stringify(p.knobs || {});
    if (a.action === "community.set") return p.url || "(비움: 기본 하우스덕 채널)";
    if (a.action === "players.rename") return `${p.nickname || ""} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "mail.send") return `${p.all ? "전체 계정" : `대상 ${p.target || "?"}`} · ${p.title_i18n?.ko || ""}`;
    if (a.action === "mail.cancel") return `메일 #${p.id ?? "?"}`;
    if (a.action === "titles.grant" || a.action === "titles.revoke") return `${p.title_id || ""} · ${String(p.player_id || "").slice(0, 8)}`;
    if (a.action === "issues.mark") {
      const state = { open: "열림", seen: "확인함", fixed: "고침" }[p.status] || p.status;
      const what = p.source === "ask" ? `1대1 문의 ${p.receipt || "?"}` : `${{ crash: "크래시", app: "앱 이상" }[p.source] || p.source} ${p.kind || ""} · ${p.where || "—"} · ${p.platform || "—"}`;
      return `${what} → ${state}${p.status === "fixed" && p.build ? ` (빌드 ${p.build})` : ""}${p.note ? ` · 메모: ${p.note}` : ""}`;
    }
    if (String(a.action).startsWith("notices.")) return `공지 #${p.id ?? "?"}`;
    return JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => k !== "reason")));
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
