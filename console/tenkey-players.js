// 10key Survival: 플레이어 (user pool) and 플레이어 상세. The pool is tenkey.players: CrazyGames web players who signed in
// there and mobile guest accounts. Search by name / player id / login id; the detail shows the account, ranks, bests, recent
// stored runs, purchases + gem ledger, the nickname change and the ranking ban (reason + confirm, audited).
// The list refreshes itself every AUTO_MS while it is on screen (owner 2026-10-24: new nicknames show up without a reload).
(function attachConsoleTenkeyPlayers(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, query: "", platform: "", sort: "last_seen_at", direction: "desc", detail: null };
  let pager = null;
  const AUTO_MS = 20000;
  let autoTimer = 0;

  const FLAG_NAMES = { banned: "정지 상태" };  // only a manual ban holds a run back (2026-10-24)
  const flagName = (flag) => (flag ? FLAG_NAMES[flag] || flag : "정상");
  const ageName = (band) => (band ? `${band}세 이상` : "미확인");
  const scoreText = (row) => (row.best_score == null ? "—" : `${num(row.best_score)}${row.best_level ? ` · Lv ${row.best_level}` : ""}`);
  // Where the player last played (the server: the latest stored run's platform; CrazyGames sign-ins are always that portal).
  const platformOf = (row) => platformName(row.provider === "crazygames" ? "web_crazygames" : row.platform);

  function rowMarkup(row) {
    const name = row.name || row.nickname || "(이름 없음)";
    return `<tr${row.banned ? ' class="is-dim"' : ""}>
      <td data-label="플레이어"><a class="player-identity-link" href="#/tenkey-players/${esc(row.id)}"><span class="player-identity-name">${esc(name)}</span></a><span class="tk-sub">${esc(String(row.id).slice(0, 8))} · ${esc(row.provider === "crazygames" ? "CrazyGames 로그인" : "게스트 계정")}</span></td>
      <td data-label="플랫폼">${esc(platformOf(row))}</td>
      <td data-label="가입">${esc(time(row.created_at))}</td>
      <td data-label="마지막 접속">${esc(time(row.last_seen_at))}</td>
      <td data-label="최고 점수" class="tk-num">${esc(scoreText(row))}</td>
      <td data-label="나이대">${esc(row.provider === "crazygames" ? "—" : ageName(row.age_band))}</td>
      <td data-label="상태"><span class="tk-badge" data-tone="${row.banned ? "risk" : "good"}">${row.banned ? "정지" : "정상"}</span></td>
      <td data-label="처리"><a class="player-open-link" href="#/tenkey-players/${esc(row.id)}">상세</a></td></tr>`;
  }

  async function loadList(page = 1, quiet = false) {
    if (!quiet) T.setMessage("tenkeyPlayersMessage", "플레이어를 불러오는 중입니다...");
    try {
      const result = await T.call("players.list", { query: state.query, platform: state.platform || undefined, sort: state.sort, direction: state.direction, page });
      const data = result.data;
      pager.st.page = page;
      pager.st.total = Number(data.total || 0);
      byId("tenkeyPlayerTotal").textContent = `${num(data.total)}명`;
      byId("tenkeyPlayersTable").innerHTML = (data.rows || []).length
        ? data.rows.map(rowMarkup).join("")
        : '<tr><td colspan="8" class="empty-panel">조건에 맞는 플레이어가 없습니다.</td></tr>';
      pager.draw();
      const at = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      T.setMessage("tenkeyPlayersMessage", `${at} 기준 · 20초마다 자동으로 새로 불러옵니다. 마지막 접속은 기록을 보내거나 앱이 계정을 확인한 때입니다. 6개월(183일) 오지 않은 플레이어는 자동으로 지워집니다.`);
    } catch (error) {
      T.report("tenkeyPlayersMessage", error);
    }
  }

  function mountPlayers() {
    if (!state.bound) {
      state.bound = true;
      pager = T.pager({ prev: "tenkeyPlayersPrevious", next: "tenkeyPlayersNext", label: "tenkeyPlayersPage" }, 50, loadList);
      byId("tenkeyPlayerSearchForm").addEventListener("submit", (event) => {
        event.preventDefault();
        state.query = byId("tenkeyPlayerSearch").value.trim();
        state.platform = byId("tenkeyPlayerPlatform").value;
        state.sort = byId("tenkeyPlayerSort").value;
        state.direction = byId("tenkeyPlayerDirection").value;
        loadList(1);
      });
    }
    loadList(pager.st.page || 1);
    startAuto();
  }

  // Reloads the list page that is open, only while the list is on screen and the tab is visible; stops by itself when
  // the admin goes to another page (the list table leaves the layout) and starts again on the next mount.
  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      const table = byId("tenkeyPlayersTable");
      if (!table || !table.offsetParent) { clearInterval(autoTimer); return; }
      if (document.hidden || document.activeElement === byId("tenkeyPlayerSearch")) return;
      loadList(pager.st.page || 1, true);
    }, AUTO_MS);
  }

  // ── detail ──
  const facts = (items) => `<dl class="tk-detail-grid">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
  const table = (head, rows, empty) => rows.length
    ? `<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
    : `<p class="empty-panel">${esc(empty)}</p>`;
  const boardName = (board) => (board === "all" ? "전체 기간" : `주간 ${String(board).slice(1)}`);

  function detailMarkup(d) {
    const p = d.player;
    const account = d.account || {};
    const mobile = (d.identities || []).some((i) => i.provider === "supabase");
    const bests = (d.bests || []).map((b) => `<tr><td>${esc(boardName(b.board))}</td><td class="tk-num">${esc(num(b.score))}</td><td class="tk-num">${esc(b.level)}</td><td>${esc(duration(b.time_ms))}</td><td>${esc(time(b.achieved_at))}</td><td class="tk-num">${esc(b.rules)}</td></tr>`);
    const runs = (d.runs || []).map((r) => `<tr${r.flag ? ' class="is-dim"' : ""}><td>${esc(time(r.created_at))}</td><td class="tk-num">${esc(num(r.score))}</td><td class="tk-num">${esc(r.level)}</td><td>${esc(duration(r.time_ms))}</td><td class="tk-num">${esc(num(r.depth))}</td><td class="tk-num">${esc(num(r.scrap))}</td><td class="tk-num">${esc(num(r.combo))}</td><td class="tk-num">${esc(r.skills)}</td><td>${esc(r.cause || "—")}</td><td>${esc(platformName(r.platform))} · ${esc(r.build)}</td><td><span class="tk-badge" data-tone="${r.flag ? "risk" : "good"}">${esc(flagName(r.flag))}</span></td></tr>`);
    const buys = (d.purchases || []).map((b) => `<tr><td>${esc(time(b.created_at))}</td><td>${esc(b.product_id)}</td><td>${esc(platformName(b.platform))}</td><td><span class="tk-badge" data-tone="${b.state === "refunded" ? "risk" : b.state === "sandbox" ? "quiet" : "good"}">${esc({ granted: "결제 완료", sandbox: "테스트", refunded: "환불" }[b.state] || b.state)}</span></td><td>${esc(b.order_tail || "—")}</td><td>${esc(b.refunded_at ? `${time(b.refunded_at)} · ${b.refund_reason_category || ""}` : "—")}</td></tr>`);
    const ledger = ((d.wallet || {}).ledger || []).map((g) => `<tr><td>${esc(time(g.at))}</td><td>${esc(g.kind === "grant" ? "받음" : "씀")}</td><td class="tk-num">${esc(num(g.amount))}</td><td>${esc(g.reason || "—")}</td><td>${esc(g.source === "server" ? "서버(구매)" : "앱 보고")}</td></tr>`);
    const ids = (d.identities || []).map((i) => `<tr><td>${esc(i.provider === "crazygames" ? "CrazyGames" : "게스트 로그인")}</td><td><code>${esc(i.subject)}</code></td><td><code>${esc(i.login || "—")}</code></td><td>${esc(time(i.created_at))}</td></tr>`);
    return `<section class="panel">
      <div class="player-detail-head"><div><p class="eyebrow">PLAYER</p><h2>${esc(p.name || "(이름 없음)")} <span class="tk-badge" data-tone="${p.banned ? "risk" : "good"}">${p.banned ? "정지" : "정상"}</span></h2><code>${esc(p.id)}</code></div></div>
      ${facts([
        ["가입", time(p.created_at)], ["마지막 접속", time(p.last_seen_at)],
        ["전체 기간 순위", d.rank?.all ? `${num(d.rank.all)}위` : "—"], [`이번 주 순위`, d.rank?.week ? `${num(d.rank.week)}위` : "—"],
        ...(mobile ? [["나이대", ageName(account.age_band)], ["약관 버전", account.terms_version || "—"], ["닉네임 변경", `${num(account.rename_count)}회`]] : []),
      ])}
      <div class="tk-section"><h3>로그인 · 식별</h3>${table(["종류", "식별 값", "로그인 번호", "만든 시각"], ids, "식별 정보가 없습니다.")}</div>
      <div class="tk-section"><h3>보드별 최고 기록</h3>${table(["보드", "점수", "레벨", "시간", "기록 시각", "점수 규칙"], bests, "기록이 없습니다.")}</div>
      <div class="tk-section"><h3>최근 서버 기록 (신기록 판만 남음, 최근 20)</h3>${table(["시각", "점수", "레벨", "시간", "깊이", "부품", "콤보", "스킬", "끝난 이유", "플랫폼 · 빌드", "판정"], runs, "남은 판이 없습니다.")}</div>
      ${mobile ? `<div class="tk-section"><h3>구매 · 권한</h3>${table(["시각", "상품", "스토어", "상태", "주문 번호 끝", "환불"], buys, "구매 기록이 없습니다.")}${(d.entitlements || []).length ? `<p class="tk-sub">권한: ${(d.entitlements || []).map((e) => esc(e.key)).join(", ")}</p>` : ""}</div>
      <div class="tk-section"><h3>젬 장부 (잔액 ${esc(num(d.wallet?.balance))} · 서버가 아는 합계)</h3>${table(["시각", "구분", "수량", "이유", "출처"], ledger, "장부가 비어 있습니다.")}</div>` : ""}
      ${mobile ? `<form id="tenkeyRenameForm" class="admin-form tk-section impact-form">
        <p class="eyebrow">NICKNAME</p>
        <p class="impact-note">앱의 닉네임 규칙(2~10자, 한글·영문·숫자, 금지어·중복 불가)을 그대로 따릅니다. 플레이어의 변경 횟수에는 들어가지 않으며, 앱은 다음 실행 때 새 이름을 받고 랭킹에는 몇 분 안에 반영됩니다.</p>
        <label>새 닉네임<input name="nickname" maxlength="10" required value="${esc(account.nickname || p.name || "")}"></label>
        <label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 부적절한 닉네임 신고"></label>
        <p id="tenkeyRenameMessage" class="dashboard-message" role="status" aria-live="polite"></p>
        <div class="tk-actions"><button class="warning-button" type="submit">닉네임 바꾸기</button></div>
      </form>` : ""}
      <form id="tenkeyBanForm" class="admin-form tk-section impact-form impact-form-critical">
        <p class="eyebrow">RANKING MODERATION</p>
        <p class="impact-note">${p.banned ? "정지를 풀면 이 플레이어의 기록이 다시 랭킹에 보입니다." : "정지하면 이 플레이어는 모든 랭킹 보드에서 숨고 새 기록도 순위에 오르지 않습니다. 계정과 기록은 지워지지 않고, 언제든 풀 수 있습니다. 랭킹 순위는 몇 분 안에 새로 계산됩니다."}</p>
        <label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 점수 조작 확인 (직접 확인 후 정지)"></label>
        <p id="tenkeyBanMessage" class="dashboard-message" role="status" aria-live="polite"></p>
        <div class="tk-actions"><button class="${p.banned ? "warning-button" : "danger-button"}" type="submit">${p.banned ? "정지 풀기" : "랭킹에서 정지"}</button></div>
      </form>
    </section>`;
  }

  async function submitBan(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const player = state.detail.player;
      const banned = !player.banned;
      const reason = form.elements.reason.value.trim();
      if (!await root.ConsoleApp.confirmChange(banned ? "랭킹에서 정지" : "정지 풀기", `${player.name || player.id}\n${banned ? "모든 랭킹 보드에서 숨깁니다 (기록은 보관)." : "랭킹에 다시 보입니다."}\n사유: ${reason}`)) return;
      T.setMessage("tenkeyBanMessage", "처리하는 중입니다...");
      await T.call("players.ban", { player_id: player.id, banned, reason }, form);
      await loadDetail(player.id);
      T.setMessage("tenkeyPlayerMessage", banned ? "정지했습니다." : "정지를 풀었습니다.");
    } catch (error) {
      T.report("tenkeyBanMessage", error);
    } finally {
      finish();
    }
  }

  async function submitRename(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const player = state.detail.player;
      const nickname = form.elements.nickname.value.trim();
      const reason = form.elements.reason.value.trim();
      if (!await root.ConsoleApp.confirmChange("닉네임 바꾸기", `${player.name || player.id} → ${nickname}\n사유: ${reason}`)) return;
      T.setMessage("tenkeyRenameMessage", "처리하는 중입니다...");
      await T.call("players.rename", { player_id: player.id, nickname, reason }, form);
      await loadDetail(player.id);
      T.setMessage("tenkeyPlayerMessage", `닉네임을 ${nickname}(으)로 바꿨습니다.`);
    } catch (error) {
      T.report("tenkeyRenameMessage", error);
    } finally {
      finish();
    }
  }

  async function loadDetail(id) {
    T.setMessage("tenkeyPlayerMessage", "플레이어를 불러오는 중입니다...");
    try {
      const result = await T.call("players.get", { player_id: id });
      state.detail = result.data;
      byId("tenkeyPlayerDetail").innerHTML = detailMarkup(state.detail);
      byId("tenkeyBanForm").addEventListener("submit", submitBan);
      byId("tenkeyRenameForm")?.addEventListener("submit", submitRename);
      T.setMessage("tenkeyPlayerMessage", "");
    } catch (error) {
      byId("tenkeyPlayerDetail").innerHTML = "";
      T.report("tenkeyPlayerMessage", error);
    }
  }

  T.mountPlayers = mountPlayers;
  T.mountPlayer = (id) => loadDetail(id);
})(window);
