// 10key Survival: 감시 (owner 2026-11-15). Three kinds of account are tagged everywhere the console shows a player and listed together
// on the 감시 page, because a bad pattern after launch has to be seen and stopped fast:
//   [검수]  review mode (the iOS reviewer's account; granted by the owner's code in the app)
//   [무적]  invincible mode (the developer's own test switch)
//   [TOP10] this season's top 10 of the normal board or of the hard board
// Server: tenkey-admin "watch.list" (admin_watch_v1) answers every tagged account with its tags, today's runs, bests and the last 10
// stored runs; "review.set" switches the review mode off / revokes it (audited); "review.code_state" says whether the app can take the
// code at all (the code hash is set or not; the hash itself never reaches the console and the site never changes it).
(function attachConsoleTenkeyWatch(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, duration, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const CACHE_MS = 60000;
  const cache = { at: 0, ok: false, rows: new Map(), season: "", total: 0 };
  const state = { bound: false, filter: "all", loading: false, open: new Set() };

  // ── tags: one pure function, used by the players list, the player page and the watch page ──
  const GOD_TITLE = "무적 모드: 이 계정의 판은 기록·보상이 반영되지 않음";
  function tagList(info) {
    const i = info || {};
    const tags = [];
    if (i.review_mode) tags.push({ key: "review", label: "[검수]", tone: "review", title: "검수 모드 켜짐: iOS 심사관용 계정. 모든 단계·상품이 열려 있고, 판은 랭킹·통계에 반영되지 않음" });
    else if (i.review_granted) tags.push({ key: "review_off", label: "[검수 꺼짐]", tone: "quiet", title: "검수 코드를 입력해 권한을 받은 계정. 지금은 꺼져 있음 (앱에서 다시 켤 수 있음)" });
    if (i.god_mode) tags.push({ key: "god", label: "[무적]", tone: "risk", title: GOD_TITLE });
    if (i.rank_normal) tags.push({ key: "top_normal", label: "[TOP10 일반]", tone: "watch", title: `이번 시즌 일반 랭킹 ${i.rank_normal}위` });
    if (i.rank_hard) tags.push({ key: "top_hard", label: "[TOP10 하드]", tone: "watch", title: `이번 시즌 하드 랭킹 ${i.rank_hard}위` });
    return tags;
  }
  const badgeMarkup = (tag) => ` <span class="tk-badge tk-watch-tag" data-tone="${tag.tone}" data-tag="${tag.key}" title="${esc(tag.title)}">${esc(tag.label)}</span>`;
  const tagsMarkup = (info) => tagList(info).map(badgeMarkup).join("");

  // ── the watch list (cached one minute; a failing server just means no extra tags, the god tag still comes from the list) ──
  async function load(force = false) {
    if (!force && cache.ok && Date.now() - cache.at < CACHE_MS) return cache.ok;
    try {
      const data = (await T.call("watch.list", { limit: 200 })).data || {};
      cache.rows = new Map((data.rows || []).map((row) => [row.id, row]));
      cache.season = data.season_board || "";
      cache.total = Number(data.total || cache.rows.size);
      cache.ok = true;
      cache.at = Date.now();
    } catch (error) {
      cache.ok = false;
      cache.error = error;
    }
    return cache.ok;
  }
  // The row's own fields (the players list carries god_mode) with the watch fields on top.
  const infoFor = (id, row) => ({ ...(row || {}), ...(cache.rows.get(id) || {}) });
  const tagsFor = (id, row) => tagsMarkup(infoFor(id, row));

  // ── 감시 page ──
  const FILTERS = [
    ["all", "전체", () => true],
    ["review", "검수", (r) => r.review_mode || r.review_granted],
    ["god", "무적", (r) => r.god_mode],
    ["top", "TOP10", (r) => r.rank_normal || r.rank_hard],
  ];
  const filterOf = (key) => FILTERS.find((f) => f[0] === key) || FILTERS[0];
  const modeName = (mode) => (mode === "hard" ? "하드" : "일반");
  const best = (b) => (b && b.score != null ? `${num(b.score)} · Lv ${esc(b.level)}` : "—");
  const rankText = (r) => `일반 ${r.rank_normal ? `${r.rank_normal}위` : "—"} · 하드 ${r.rank_hard ? `${r.rank_hard}위` : "—"}`;

  function runsMarkup(r) {
    const runs = r.runs || [];
    if (!runs.length) return '<p class="empty-panel">서버에 남은 판이 없습니다. 새 최고 기록을 세운 판만 남으므로, 검수·무적 계정의 판은 비어 있을 수 있습니다.</p>';
    return `<div class="table-scroll"><table><thead><tr><th>시각</th><th>모드</th><th class="tk-num">점수</th><th class="tk-num">레벨</th><th class="tk-num">시작 레벨</th><th>시간</th><th>플랫폼 · 빌드</th><th>판정</th></tr></thead><tbody>${runs.map((x) => `<tr${x.flag ? ' class="is-dim"' : ""}>
      <td data-label="시각">${esc(time(x.created_at))}</td><td data-label="모드">${esc(modeName(x.mode))}</td><td data-label="점수" class="tk-num">${esc(num(x.score))}</td><td data-label="레벨" class="tk-num">${esc(x.level)}</td>
      <td data-label="시작 레벨" class="tk-num">${esc(x.start_level == null ? "—" : x.start_level)}</td><td data-label="시간">${esc(duration(x.time_ms))}</td><td data-label="플랫폼 · 빌드">${esc(platformName(x.platform))} · ${esc(x.build || "—")}</td>
      <td data-label="판정"><span class="tk-badge" data-tone="${x.flag ? "risk" : "good"}">${x.flag ? esc(x.flag) : "정상"}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  function rowMarkup(r) {
    const open = state.open.has(r.id);
    const actions = [
      `<a class="player-open-link" href="#/tenkey-players/${esc(r.id)}">상세</a>`,
      `<button type="button" class="tk-mini" data-watch-runs="${esc(r.id)}" aria-expanded="${open}">판 기록</button>`,
      `<button type="button" class="tk-mini ${r.banned ? "" : "is-danger"}" data-watch-ban="${esc(r.id)}">${r.banned ? "정지 풀기" : "랭킹 정지"}</button>`,
      r.review_mode || r.review_granted ? `<button type="button" class="tk-mini is-danger" data-watch-review="${esc(r.id)}">검수 ${r.review_mode ? "끄기" : "권한 회수"}</button>` : "",
      r.god_mode ? `<button type="button" class="tk-mini is-danger" data-watch-god="${esc(r.id)}">무적 끄기</button>` : "",
    ].join("");
    return `<tr${r.banned ? ' class="is-dim"' : ""} data-watch-row="${esc(r.id)}">
      <td data-label="플레이어"><a class="player-identity-link" href="#/tenkey-players/${esc(r.id)}"><span class="player-identity-name">${esc(r.nickname || r.name || "(이름 없음)")}</span></a>${tagsMarkup(r)}${r.banned ? ' <span class="tk-badge" data-tone="risk">정지</span>' : ""}<span class="tk-sub">${esc(String(r.id).slice(0, 8))} · ${esc(platformName(r.platform))}</span></td>
      <td data-label="마지막 접속">${esc(time(r.last_seen_at))}</td>
      <td data-label="오늘 시작한 판" class="tk-num">${esc(num(r.runs_today))}</td>
      <td data-label="최고 점수 (일반)" class="tk-num">${best(r.best_normal)}</td>
      <td data-label="최고 점수 (하드)" class="tk-num">${best(r.best_hard)}</td>
      <td data-label="이번 시즌 순위">${esc(rankText(r))}</td>
      <td data-label="처리" class="tk-watch-actions">${actions}</td></tr>${open ? `<tr class="tk-watch-runs" data-watch-detail="${esc(r.id)}"><td colspan="7"><strong>최근 판 (최대 10)</strong>${runsMarkup(r)}</td></tr>` : ""}`;
  }

  function render() {
    const [, , test] = filterOf(state.filter);
    const all = [...cache.rows.values()];
    const rows = all.filter(test);
    const count = (key) => all.filter(filterOf(key)[2]).length;
    document.querySelectorAll("[data-watch-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.watchFilter === state.filter));
      button.querySelector("b").textContent = num(count(button.dataset.watchFilter));
    });
    byId("tenkeyWatchTotal").textContent = `${num(rows.length)}명`;
    byId("tenkeyWatchTable").innerHTML = rows.length ? rows.map(rowMarkup).join("") : '<tr><td colspan="7" class="empty-panel">조건에 맞는 감시 대상이 없습니다.</td></tr>';
  }

  async function reload(force = true) {
    if (state.loading) return;
    state.loading = true;
    T.setMessage("tenkeyWatchMessage", "감시 대상을 불러오는 중입니다...");
    const ok = await load(force);
    state.loading = false;
    if (!ok) {
      cache.rows = new Map();
      render();
      T.report("tenkeyWatchMessage", cache.error || new Error("console_request_failed"));
      return;
    }
    render();
    const at = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    T.setMessage("tenkeyWatchMessage", `${at} 기준 · 이번 시즌 보드 ${T.fmt.boardName(cache.season)}${cache.total > cache.rows.size ? ` · 마지막 접속이 최근인 ${cache.rows.size}명만 보임 (전체 ${num(cache.total)}명)` : ""}. 검수·무적 계정의 판은 랭킹과 통계에 들어가지 않습니다.`);
  }

  async function quick(button, title, body, action, params, done) {
    const reason = await T.askReason(title, body);
    if (!reason) return;
    button.disabled = true;
    try {
      await T.call(action, { ...params, reason }, button);
      await reload(true);
      T.setMessage("tenkeyWatchMessage", done);
    } catch (error) {
      T.report("tenkeyWatchMessage", error);
      button.disabled = false;
    }
  }

  function onClick(event) {
    const filter = event.target.closest("[data-watch-filter]");
    if (filter) { state.filter = filter.dataset.watchFilter; render(); return; }
    const runs = event.target.closest("[data-watch-runs]");
    if (runs) { const id = runs.dataset.watchRuns; if (state.open.has(id)) state.open.delete(id); else state.open.add(id); render(); return; }
    const pick = (attr) => { const b = event.target.closest(`[data-watch-${attr}]`); return b ? [b, cache.rows.get(b.dataset[`watch${attr[0].toUpperCase()}${attr.slice(1)}`])] : [null, null]; };
    const [banBtn, banRow] = pick("ban");
    if (banBtn && banRow) {
      const banned = !banRow.banned;
      quick(banBtn, banned ? "랭킹에서 정지" : "정지 풀기", `${banRow.nickname || banRow.name}\n${banned ? "모든 랭킹 보드에서 숨깁니다 (기록은 보관)." : "랭킹에 다시 보입니다."}\n사유를 감사 기록에 남깁니다.`,
        "players.ban", { player_id: banRow.id, banned }, banned ? "정지했습니다." : "정지를 풀었습니다.");
      return;
    }
    const [revBtn, revRow] = pick("review");
    if (revBtn && revRow) {
      quick(revBtn, revRow.review_mode ? "검수 모드 끄기" : "검수 권한 회수", `${revRow.nickname || revRow.name}\n검수 모드와 권한이 함께 회수됩니다. 다시 쓰려면 앱에서 코드를 새로 입력해야 합니다.\n사유를 감사 기록에 남깁니다.`,
        "review.set", { player_id: revRow.id, on: false }, "검수 모드를 껐습니다.");
      return;
    }
    const [godBtn, godRow] = pick("god");
    if (godBtn && godRow) {
      quick(godBtn, "무적 모드 끄기", `${godRow.nickname || godRow.name}\n다음 판부터 일반 판으로 돌아옵니다.\n사유를 감사 기록에 남깁니다.`,
        "god.set", { player_id: godRow.id, on: false }, "무적 모드를 껐습니다.");
    }
  }

  function mountWatch() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyWatchView").addEventListener("click", onClick);
      byId("tenkeyWatchRefresh").addEventListener("click", () => reload(true));
    }
    reload(true);
  }

  // ── review switch of the player page (next to the 무적 switch; only OFF / revoke, the owner's code is what turns it on) ──
  function reviewPanelMarkup(player) {
    const known = cache.ok;
    const w = infoFor(player.id);
    const on = !!w.review_mode;
    const granted = !!w.review_granted;
    const can = known && (on || granted);
    const state2 = !known ? "확인 못 함" : on ? "켜짐" : granted ? "꺼짐 · 권한 있음" : "꺼짐 · 권한 없음";
    return `<form id="tenkeyReviewForm" class="admin-form impact-form impact-form-critical tk-god-form tk-review-form" data-review="${on}" data-granted="${granted}">
        <p class="eyebrow">REVIEW · 검수 모드</p>
        <label class="tk-switch"><input type="checkbox" role="switch" name="on" ${on ? "checked" : ""} ${can ? "" : "disabled"}><span class="tk-switch-track" aria-hidden="true"></span><strong>검수 모드 <span id="tenkeyReviewState">${state2}</span></strong></label>
        <p class="impact-note">iOS 심사관용입니다 (무적 모드와는 별개). 켜져 있는 동안 모든 해금 단계와 상점 상품이 열려 있고, 이 계정의 판은 랭킹 · 통계에 반영되지 않습니다. 사이트에서는 끄기와 권한 회수만 할 수 있고, 켜는 것은 앱에서 코드를 넣는 것으로만 됩니다. 끄면 권한도 함께 회수되어 다시 쓰려면 코드를 새로 입력해야 합니다.${known ? "" : " (검수 정보를 서버에서 받지 못해 지금은 바꿀 수 없습니다.)"}</p>
        <label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 심사 끝남" ${can ? "" : "disabled"}></label>
        <p id="tenkeyReviewMessage" class="dashboard-message" role="status" aria-live="polite"></p>
        <div class="tk-actions"><button class="danger-button" type="submit" id="tenkeyReviewApply" disabled>${on ? "검수 모드 끄기" : "검수 권한 회수"}</button></div>
      </form>`;
  }

  function bindReview(ctx) {
    const form = byId("tenkeyReviewForm");
    if (!form) return;
    const { player } = ctx;
    const on = form.dataset.review === "true";
    const sync = () => {
      const checked = form.elements.on.checked;
      byId("tenkeyReviewState").textContent = checked ? "켜짐" : on ? "끄는 중" : byId("tenkeyReviewState").textContent;
      byId("tenkeyReviewApply").disabled = on ? checked : form.dataset.granted !== "true";
    };
    sync();
    form.elements.on.addEventListener("change", sync);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const reason = form.elements.reason.value.trim();
      const verb = on ? "검수 모드 끄기" : "검수 권한 회수";
      if (!await root.ConsoleApp.confirmChange(verb, `${player.name || player.id}\n검수 모드와 권한이 함께 회수됩니다. 다시 쓰려면 앱에서 코드를 새로 입력해야 합니다.\n사유: ${reason}`)) return;
      T.setMessage("tenkeyReviewMessage", "처리하는 중입니다...");
      try {
        await T.call("review.set", { player_id: player.id, on: false, reason }, form);
        await load(true);
        await ctx.reload();
        T.setMessage("tenkeyPlayerMessage", on ? "검수 모드를 껐습니다." : "검수 권한을 회수했습니다.");
      } catch (error) {
        T.report("tenkeyReviewMessage", error);
      }
    });
  }

  // ── "검수 코드 받기" line of the 강제 업데이트 / 설정 page: state only ──
  async function mountCode() {
    const el = byId("tenkeyReviewCodeState");
    if (!el) return;
    el.textContent = "확인 중...";
    el.dataset.tone = "quiet";
    try {
      const on = !!(await T.call("review.code_state", {})).data?.on;
      el.textContent = on ? "켜짐 · 앱에서 코드를 넣을 수 있음" : "꺼짐 · 어떤 코드도 거절함";
      el.dataset.tone = on ? "watch" : "quiet";
    } catch (error) {
      el.textContent = "확인하지 못함";
      el.dataset.tone = "risk";
    }
  }

  T.watch = { tagList, tagsMarkup, tagsFor, infoFor, load, reviewPanelMarkup, bindReview, cache };
  T.mountWatch = mountWatch;
  T.mountReviewCode = mountCode;
})(window);
