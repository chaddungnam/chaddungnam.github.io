// 10key Survival: 플레이어 (user pool) and 플레이어 상세. The pool is tenkey.players: CrazyGames web players who signed in
// there and mobile guest accounts. Search by name / player id / login id; the detail shows the account, ranks, bests, recent
// stored runs, purchases + gem ledger, the nickname change and the ranking ban (reason + confirm, audited).
// The list refreshes itself every AUTO_MS while it is on screen (owner 2026-10-24: new nicknames show up without a reload).
(function attachConsoleTenkeyPlayers(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, query: "", platform: "", country: "", sort: "last_seen_at", direction: "desc", detail: null };
  let pager = null;
  const AUTO_MS = 20000;
  let autoTimer = 0;

  const FLAG_NAMES = { banned: "정지 상태" };  // only a manual ban holds a run back (2026-10-24)
  const flagName = (flag) => (flag ? FLAG_NAMES[flag] || flag : "정상");
  const ageName = (band) => (band ? `${band}세 이상` : "미확인");
  const countryName = (code) => code ? (String(code).toUpperCase() === "XX" ? "미기록" : String(code).toUpperCase()) : "—";
  const clientPlatformName = (code) => ({ android: "Android", ios: "iOS", web_itch: "웹 · itch.io", web_gamepix: "웹 · GamePix" }[String(code || "").toLowerCase()] || platformName(code));
  const scoreText = (row) => (row.best_score == null ? "—" : `${num(row.best_score)}${row.best_level ? ` · Lv ${row.best_level}` : ""}`);
  // Where the player last played (the server: the latest stored run's platform; CrazyGames sign-ins are always that portal).
  const platformOf = (row) => platformName(row.provider === "crazygames" ? "web_crazygames" : row.platform);

  function rowMarkup(row) {
    const name = row.name || row.nickname || "(이름 없음)";
    return `<tr${row.banned ? ' class="is-dim"' : ""}>
      <td data-label="플레이어"><a class="player-identity-link" href="#/tenkey-players/${esc(row.id)}"><span class="player-identity-name">${esc(name)}</span></a>${row.bug_user ? ' <span class="tk-badge" data-tone="risk" title="하루 부품 상한에 닿았는데 그날 플레이 시간과 맞지 않음 (표시만, 제재 아님)">[버그유저]</span>' : ""}${T.unlocks.godBadge(row.god_mode)}<span class="tk-sub">${esc(String(row.id).slice(0, 8))} · ${esc(row.provider === "crazygames" ? "CrazyGames 로그인" : "게스트 계정")}</span></td>
      <td data-label="플랫폼">${esc(platformOf(row))}</td>
      <td data-label="스토어 국가">${esc(countryName(row.store_country))}</td>
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
      const result = await T.call("players.list", { query: state.query, platform: state.platform || undefined, country: state.country || undefined, sort: state.sort, direction: state.direction, page });
      const data = result.data;
      pager.st.page = page;
      pager.st.total = Number(data.total || 0);
      byId("tenkeyPlayerTotal").textContent = `${num(data.total)}명`;
      byId("tenkeyPlayersTable").innerHTML = (data.rows || []).length
        ? data.rows.map(rowMarkup).join("")
        : '<tr><td colspan="9" class="empty-panel">조건에 맞는 플레이어가 없습니다.</td></tr>';
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
        state.country = byId("tenkeyPlayerCountry").value.trim().toUpperCase();
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
  const balanceRuns = (runs) => (runs || []).map((r) => {
    const skills = Array.isArray(r.skills) ? r.skills.map((s) => `${s[0]} Lv${s[1]}`).join(", ") : "—";
    const reaches = r.lv_ms == null ? "미계측" : Array.isArray(r.lv_ms) && r.lv_ms.length
      ? r.lv_ms.map((pair) => `Lv${pair[0]} ${duration(pair[1])}`).join(" · ") : "레벨 2 미도달";
    return `<tr>
      <td>${esc(time(r.played_at))}</td>
      <td class="tk-num">${esc(r.level)}</td>
      <td>${esc(duration(r.time_ms))}</td>
      <td>${esc(r.cleared ? "클리어" : r.cause || "종료")}</td>
      <td class="tk-wrap">${esc(skills)}</td>
      <td class="tk-num">${esc(num(r.charge ?? 0))}</td>
      <td>${esc(duration(r.drift_ms))}</td>
      <td>${esc(duration(r.robot_ms))}</td>
      <td>${esc(r.revive === 2 ? "부활" : r.revive === 1 ? "거절" : "없음")}</td>
      <td class="tk-wrap">${esc(reaches)}</td></tr>`;
  });

  async function loadPlayerTitles(player) {
    const host = byId("tenkeyPlayerTitles");
    if (!host || !player?.id) return;
    host.innerHTML = '<h3>칭호</h3><p class="empty-panel">칭호를 불러오는 중입니다...</p>';
    try {
      const [ownedResult, catalog] = await Promise.all([
        T.call("titles.player", { player_id: player.id }),
        T.loadTitleCatalog(),
      ]);
      const owned = Array.isArray(ownedResult.data) ? ownedResult.data : [];
      const rows = owned.map((title) => {
        const info = T.titleInfo(title.id);
        return `<tr><td><strong>${esc(info.name)}</strong><span class="tk-sub">${esc(title.id)}</span></td><td>${esc(time(title.granted_at))}</td><td>${esc(title.grant_source || "server")}</td><td>${title.equipped ? '<span class="tk-badge" data-tone="good">장착 중</span>' : "—"}</td><td><button class="warning-button" type="button" data-title-revoke="${esc(title.id)}">회수</button></td></tr>`;
      });
      const options = catalog.map((title) => `<option value="${esc(title.id)}">${esc(T.titleInfo(title.id).name)}${title.console_only ? " · 운영자 전용" : ""}</option>`).join("");
      host.innerHTML = `<div class="tk-title-head"><div><h3>칭호</h3><small>플레이어가 가진 칭호를 확인하고 운영 사유를 남겨 부여하거나 회수합니다.</small></div><span class="panel-total">${num(owned.length)}개</span></div>
        ${rows.length ? `<div class="table-scroll tk-title-owned"><table><thead><tr><th>칭호</th><th>획득 시각</th><th>부여 출처</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>` : '<p class="empty-panel">보유한 칭호가 없습니다.</p>'}
        <form class="admin-form tk-title-grant"><label>부여할 칭호<select name="title_id" required><option value="" selected disabled>칭호 선택</option>${options}</select></label><label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 이벤트 우승 확인"></label><p class="dashboard-message" role="status"></p><button class="warning-button" type="submit">칭호 부여</button></form>`;
      host.querySelector(".tk-title-grant").addEventListener("submit", submitTitleGrant);
      host.querySelectorAll("[data-title-revoke]").forEach((button) => button.addEventListener("click", () => revokeTitle(button, player)));
    } catch (error) {
      host.innerHTML = '<h3>칭호</h3><p class="empty-panel">칭호 정보를 불러오지 못했습니다. 잠시 후 플레이어 상세를 새로고침해 주세요.</p>';
      T.report("tenkeyPlayerMessage", error);
    }
  }

  async function submitTitleGrant(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const player = state.detail?.player;
      const titleId = form.elements.title_id.value;
      const reason = form.elements.reason.value.trim();
      const info = T.titleInfo(titleId);
      if (!await root.ConsoleApp.confirmChange("칭호 부여", `${player.name || player.id} · ${info.name}\n사유: ${reason}`)) return;
      const result = await T.call("titles.grant", { player_id: player.id, title_id: titleId, reason }, form);
      await loadPlayerTitles(player);
      T.setMessage("tenkeyPlayerMessage", result.data?.granted ? "칭호를 부여했습니다." : "이미 보유한 칭호입니다.");
    } catch (error) {
      T.report("tenkeyPlayerMessage", error);
    } finally {
      finish();
    }
  }

  async function revokeTitle(button, player) {
    const titleId = button.dataset.titleRevoke;
    const info = T.titleInfo(titleId);
    const reason = await T.askReason("칭호 회수", `${player.name || player.id} · ${info.name}\n회수 사유를 감사 기록에 남깁니다.`);
    if (!reason) return;
    button.disabled = true;
    try {
      await T.call("titles.revoke", { player_id: player.id, title_id: titleId, reason }, button);
      await loadPlayerTitles(player);
      T.setMessage("tenkeyPlayerMessage", "칭호를 회수했습니다. 장착 중이었다면 함께 해제했습니다.");
    } catch (error) {
      T.report("tenkeyPlayerMessage", error);
      button.disabled = false;
    }
  }

  function detailMarkup(d) {
    const p = d.player;
    const account = d.account || {};
    const info = d.client_info || {};
    const retention = d.retention || {};
    const mobile = (d.identities || []).some((i) => i.provider === "supabase");
    const bests = (d.bests || []).map((b) => `<tr><td>${esc(boardName(b.board))}</td><td class="tk-num">${esc(num(b.score))}</td><td class="tk-num">${esc(b.level)}</td><td>${esc(duration(b.time_ms))}</td><td>${esc(time(b.achieved_at))}</td><td class="tk-num">${esc(b.rules)}</td></tr>`);
    const runs = (d.runs || []).map((r) => `<tr${r.flag ? ' class="is-dim"' : ""}><td>${esc(time(r.created_at))}</td><td class="tk-num">${esc(num(r.score))}</td><td class="tk-num">${esc(r.level)}</td><td>${esc(duration(r.time_ms))}</td><td class="tk-num">${esc(num(r.depth))}</td><td class="tk-num">${esc(num(r.scrap))}</td><td class="tk-num">${esc(num(r.combo))}</td><td class="tk-num">${esc(r.skills)}</td><td>${esc(r.cause || "—")}</td><td>${esc(platformName(r.platform))} · ${esc(r.build)}</td><td><span class="tk-badge" data-tone="${r.flag ? "risk" : "good"}">${esc(flagName(r.flag))}</span></td></tr>`);
    const buys = (d.purchases || []).map((b) => `<tr><td>${esc(time(b.created_at))}</td><td>${esc(b.product_id)}</td><td>${esc(platformName(b.platform))}</td><td><span class="tk-badge" data-tone="${b.state === "refunded" ? "risk" : b.state === "sandbox" ? "quiet" : "good"}">${esc({ granted: "결제 완료", sandbox: "테스트", refunded: "환불" }[b.state] || b.state)}</span></td><td>${esc(b.order_tail || "—")}</td><td>${esc(b.refunded_at ? `${time(b.refunded_at)} · ${b.refund_reason_category || ""}` : "—")}</td></tr>`);
    const ledger = ((d.wallet || {}).ledger || []).map((g) => `<tr><td>${esc(time(g.at))}</td><td>${esc(g.kind === "grant" ? "받음" : "씀")}</td><td class="tk-num">${esc(num(g.amount))}</td><td>${esc(g.reason || "—")}</td><td>${esc(g.source === "server" ? "서버(구매)" : "앱 보고")}</td></tr>`);
    const ids = (d.identities || []).map((i) => `<tr><td>${esc(i.provider === "crazygames" ? "CrazyGames" : "게스트 로그인")}</td><td><code>${esc(i.subject)}</code></td><td><code>${esc(i.login || "—")}</code></td><td>${esc(time(i.created_at))}</td></tr>`);
    return `<section class="panel">
      <div class="player-detail-head"><div><p class="eyebrow">PLAYER</p><h2>${esc(p.name || "(이름 없음)")} <span class="tk-badge" data-tone="${p.banned ? "risk" : "good"}">${p.banned ? "정지" : "정상"}</span>${p.bug_user ? ' <span class="tk-badge" data-tone="risk">[버그유저]</span>' : ""}${T.unlocks.godBadge(d.god_mode ?? p.god_mode)}</h2><code>${esc(p.id)}</code></div></div>
      ${(p.cap_hits || []).length ? `<div class="tk-section"><h3>하루 부품 상한 도달</h3><p class="tk-sub">24시간 판 부품이 상한(정상 플레이로는 거의 못 닿는 값)에 닿은 날입니다. 정상 최고 속도(초당 733)보다 빠르거나 24시간 중 16시간 넘게 플레이한 것으로 나오면 [버그유저]로 표시합니다. 표시만 하며 제재는 하지 않습니다.</p>${table(["날짜", "24시간 부품", "판 수", "플레이 시간", "판정"], p.cap_hits.map((h) => `<tr><td>${esc(h.day)}</td><td class="tk-num">${esc(num(h.scrap))}</td><td class="tk-num">${esc(num(h.runs))}</td><td>${esc(`${num(h.play_min)}분`)}</td><td><span class="tk-badge" data-tone="${h.odd ? "risk" : "quiet"}">${h.odd ? "말이 안 됨" : "가능"}</span></td></tr>`))}</div>` : ""}
      ${facts([
        ["가입", time(p.created_at)], ["마지막 접속", time(p.last_seen_at)],
        ["전체 기간 순위", d.rank?.all ? `${num(d.rank.all)}위` : "—"], [`이번 주 순위`, d.rank?.week ? `${num(d.rank.week)}위` : "—"],
        ...(mobile ? [["나이대", ageName(account.age_band)], ["약관 버전", account.terms_version || "—"], ["닉네임 변경", `${num(account.rename_count)}회`]] : []),
      ])}
      <div class="tk-section"><h3>기기 정보 · 지역</h3><p class="tk-sub">최신 기록입니다. 스토어 국가와 기기 지역은 별도 값이며, 수집 전에는 — 로 표시합니다.</p>${facts([
        ["스토어 국가", countryName(info.store_country)], ["기기 지역", info.device_region || "—"],
        ["플랫폼", clientPlatformName(info.platform)], ["앱 버전 · 빌드", info.platform ? `${info.app_version || "—"} · ${info.build ?? "—"}` : "—"],
        ["기기 모델", info.device_model || "—"], ["운영체제", info.os_version || "—"],
        ["처음 확인", time(info.first_seen_at)], ["마지막 확인", time(info.last_seen_at)],
      ])}</div>
      <div class="tk-section"><h3>재방문 · 첫 행동</h3><p class="tk-sub">계정 retention 수집이 시작된 뒤의 값입니다. streak는 오늘 또는 어제까지 이어진 연속 활동일입니다.</p>${facts([
        ["현재 연속 활동일", retention.current_streak === undefined ? "—" : `${num(retention.current_streak)}일`],
        ["첫 활동일", retention.first_day || "—"], ["마지막 활동", time(retention.last_seen_at)],
      ])}${table(["도달한 첫 행동", "기록 시각"], (retention.milestones || []).map((m) => `<tr><td>${esc({
        game_opened: "게임 열기", name_set: "이름 설정", first_run_started: "첫 판 시작", first_run_ended: "첫 판 종료",
        run_2: "두 번째 판 시작", tab_tenkey: "10KEY 탭 열기", tab_shop: "상점 탭 열기", tab_modules: "모듈 탭 열기",
        tab_upgrade: "강화 탭 열기", tab_ranking: "랭킹 탭 열기", first_module: "첫 모듈 보유", first_shop_visit: "첫 상점 방문",
        first_purchase: "첫 구매", level_30: "Lv 30 도달",
      }[m.id] || m.id)}</td><td>${esc(time(m.reached_at))}</td></tr>`), "아직 기록된 첫 행동이 없습니다.")}</div>
      <div class="tk-section"><h3>최근 밸런스 기록 (최근 10판)</h3>${table(["시각", "레벨", "시간", "끝", "고른 스킬", "차지", "DRIFT", "로봇", "부활", "레벨 도달"], balanceRuns(d.balance_runs), "아직 연결된 판 기록이 없습니다.")}</div>
      <section id="tenkeyPlayerTitles" class="tk-section tk-player-titles"><h3>칭호</h3><p class="empty-panel">칭호를 불러오는 중입니다...</p></section>
      <div class="tk-section"><h3>로그인 · 식별</h3>${table(["종류", "식별 값", "로그인 번호", "만든 시각"], ids, "식별 정보가 없습니다.")}</div>
      <div class="tk-section"><h3>보드별 최고 기록</h3>${table(["보드", "점수", "레벨", "시간", "기록 시각", "점수 규칙"], bests, "기록이 없습니다.")}</div>
      <div class="tk-section"><h3>최근 서버 기록 (신기록 판만 남음, 최근 20)</h3>${table(["시각", "점수", "레벨", "시간", "깊이", "부품", "콤보", "스킬", "끝난 이유", "플랫폼 · 빌드", "판정"], runs, "남은 판이 없습니다.")}</div>
      ${mobile ? `<div class="tk-section"><h3>구매 · 권한</h3>${table(["시각", "상품", "스토어", "상태", "주문 번호 끝", "환불"], buys, "구매 기록이 없습니다.")}${(d.entitlements || []).length ? `<p class="tk-sub">권한: ${(d.entitlements || []).map((e) => esc(e.key)).join(", ")}</p>` : ""}</div>
      <div class="tk-section"><h3>젬 장부 (잔액 ${esc(num(d.wallet?.balance))} · 서버가 아는 합계)</h3>${table(["시각", "구분", "수량", "이유", "출처"], ledger, "장부가 비어 있습니다.")}</div>` : ""}
      ${mobile ? T.unlocks.panelMarkup(d, p) : ""}
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
      const [result, extra] = await Promise.all([
        T.call("players.get", { player_id: id }),
        T.call("players.facts", { player_id: id }),
      ]);
      state.detail = { ...result.data, ...extra.data };
      byId("tenkeyPlayerDetail").innerHTML = detailMarkup(state.detail);
      byId("tenkeyBanForm").addEventListener("submit", submitBan);
      byId("tenkeyRenameForm")?.addEventListener("submit", submitRename);
      if (byId("tenkeyPlayerUnlocks")) T.unlocks.bind({ player: state.detail.player, data: () => state.detail, reload: reloadKeepScroll });
      await loadPlayerTitles(state.detail.player);
      T.setMessage("tenkeyPlayerMessage", "");
    } catch (error) {
      byId("tenkeyPlayerDetail").innerHTML = "";
      T.report("tenkeyPlayerMessage", error);
    }
  }

  // The unlock panel / god switch redraw the whole detail after a write; the page stays where the admin was.
  async function reloadKeepScroll() {
    const y = window.scrollY;
    await loadDetail(state.detail.player.id);
    window.scrollTo(0, y);
  }

  T.mountPlayers = mountPlayers;
  T.mountPlayer = (id) => loadDetail(id);
})(window);
