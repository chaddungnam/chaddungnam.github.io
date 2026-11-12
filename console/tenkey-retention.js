// 10KEY retention: cohort return rates, first-time milestones and fixed churn diagnostics.
(function attachConsoleTenkeyRetention(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, data: null, churnDays: 3 };
  const MILESTONES = {
    game_opened: "게임 열기", name_set: "이름 설정", first_run_started: "첫 판 시작", first_run_ended: "첫 판 종료",
    run_2: "두 번째 판 시작", first_shop_visit: "첫 상점 방문", first_purchase: "첫 구매", first_module: "첫 모듈 보유",
    level_30: "Lv 30 도달", tab_tenkey: "10KEY 탭 열기", tab_shop: "상점 탭 열기", tab_modules: "모듈 탭 열기",
    tab_upgrade: "강화 탭 열기", tab_ranking: "랭킹 탭 열기",
    level_5: "Lv 5 도달", level_8: "Lv 8 도달 (체험판 끝)", first_robot: "첫 로봇 변신", ranking_entry: "랭킹 등록",
  };
  T.milestoneName = (id) => MILESTONES[id] || id;
  const SCREEN = { title: "타이틀", home: "홈", shop: "상점", modules: "모듈", upgrade: "강화", ranking: "랭킹", run: "게임 중", result: "결과", settings: "설정" };

  function summary(data) {
    const rows = data.cohorts || [];
    const total = rows.reduce((n, row) => n + Number(row.players || 0), 0);
    const mature = (day) => rows.filter((row) => row[`d${day}_rate`] !== null && row[`d${day}_rate`] !== undefined);
    const rate = (day) => {
      const ready = mature(day);
      const people = ready.reduce((n, row) => n + Number(row.players || 0), 0);
      const returned = ready.reduce((n, row) => n + Number(row[`d${day}`] || 0), 0);
      return people ? `${Math.round(returned / people * 1000) / 10}% · ${num(people)}명 성숙` : "표본 대기";
    };
    const cards = [
      ["첫 활동 계정", `${num(total)}명`, `${rows.length}개 코호트 조합`],
      ["D1 재방문", rate(1), "1일차 코호트 계정 중 다음 날 방문"],
      ["D3 재방문", rate(3), "3일차까지 지난 코호트만"],
      ["D7 재방문", rate(7), "7일차까지 지난 코호트만"],
    ];
    byId("tenkeyRetentionSummary").innerHTML = cards.map(([label, value, note]) =>
      `<article class="tk-retention-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
  }

  function cohorts(data) {
    const rows = data.cohorts || [];
    const body = rows.map((row) => `<tr>
      <td>${esc(row.first_day)}</td><td class="tk-num">${esc(row.build == null ? "미기록" : num(row.build))}</td><td>${esc(platformName(row.platform))}</td>
      <td>${esc(row.store_country || "미기록")}</td><td class="tk-num">${esc(num(row.players))}</td>
      ${[1, 3, 7, 14, 30].map((day) => `<td class="tk-num"><strong>${esc(row[`d${day}_rate`] == null ? "—" : `${(Number(row[`d${day}_rate`]) * 100).toFixed(1)}%`)}</strong><small>${esc(row[`d${day}_rate`] == null ? "미성숙" : `${num(row[`d${day}`])}명`)}</small></td>`).join("")}
    </tr>`).join("");
    byId("tenkeyRetentionCohorts").innerHTML = rows.length
      ? `<div class="table-scroll"><table><thead><tr><th>첫 활동일</th><th class="tk-num">빌드</th><th>플랫폼</th><th>스토어 국가</th><th class="tk-num">계정</th><th class="tk-num">D1</th><th class="tk-num">D3</th><th class="tk-num">D7</th><th class="tk-num">D14</th><th class="tk-num">D30</th></tr></thead><tbody>${body}</tbody></table></div>`
      : '<p class="empty-panel">이 기간에 처음 접속한 계정이 없습니다.</p>';
  }

  // Where the numbers come from: the server's own records now; the app's first actions join once its collection is on.
  function sourceNote(data) {
    if (data.source !== "server") return "";
    const app = data.client_on ? "앱이 직접 보내는 첫 행동도 함께 셉니다." : "앱이 직접 보내는 첫 행동(첫 판 시작, 상점·탭 열기)은 개인정보 안내 공개 뒤 수집을 켜면 채워집니다.";
    return `<p class="tk-sub">서버가 이미 가진 기록(로그인, 판, 점수, 구매)으로 계산한 값입니다. ${esc(app)}</p>`;
  }

  function funnel(data) {
    const rows = data.funnel || [];
    byId("tenkeyRetentionFunnel").innerHTML = sourceNote(data) + (rows.length ? rows.map((row) => {
      const name = MILESTONES[row.milestone] || row.milestone;
      if (row.pending || row.players == null) {
        return `<article class="tk-funnel-row is-pending"><div class="tk-funnel-copy"><strong>${esc(name)}</strong><span>앱이 보내야 알 수 있음</span></div><div class="tk-funnel-track"><i style="width:0%"></i></div><small>수집이 켜지면 채워집니다</small></article>`;
      }
      const rate = row.rate == null ? 0 : Math.max(0, Math.min(100, Number(row.rate) * 100));
      const drop = row.drop_from_previous == null ? "" : `앞 단계에서 못 넘어온 ${num(row.drop_from_previous)}명`;
      return `<article class="tk-funnel-row"><div class="tk-funnel-copy"><strong>${esc(name)}</strong><span>${esc(num(row.players))}명 · ${esc(row.rate == null ? "—" : `${(Number(row.rate) * 100).toFixed(1)}%`)}</span></div><div class="tk-funnel-track"><i style="width:${rate.toFixed(1)}%"></i></div><small>${esc(drop)}</small></article>`;
    }).join("") : '<p class="empty-panel">이 기간에 처음 접속한 계정이 없어 첫 행동을 셀 수 없습니다.</p>');
  }

  function churn(data) {
    const rows = state.churnDays === 7 ? (data.churn_7 || []) : (data.churn_3 || []);
    const total = Number(state.churnDays === 7 ? data.churn_7_total : data.churn_3_total);
    const body = rows.map((row) => `<tr>
      <td><a class="player-open-link" href="#/tenkey-players/${esc(row.player_id)}">상세</a></td>
      <td>${esc(time(row.last_seen_at))}</td><td class="tk-num">${esc(num(row.current_streak))}일</td>
      <td>${esc(SCREEN[row.last_screen] || row.last_screen || "—")}</td>
      <td>${esc(row.last_run_level ? `Lv ${row.last_run_level}` : "판 기록 없음")} · ${esc(row.last_run_cause || "—")}</td>
      <td class="tk-num">${esc(num(row.runs_7d))} / ${esc(num(row.sessions_7d))}</td>
      <td class="tk-num">${esc(num(row.crashes_30d))} / ${esc(num(row.hitches_30d))}</td>
      <td class="tk-num">${esc(row.first_day_minutes == null ? "—" : `${Number(row.first_day_minutes).toFixed(1)}분`)}</td>
    </tr>`).join("");
    const count = Number.isFinite(total) && total > rows.length ? `최근에 떠난 순서로 ${num(rows.length)}명만 보입니다 (전체 ${num(total)}명).` : `전체 ${num(rows.length)}명.`;
    const lacking = data.source === "server" && !data.client_on ? " 마지막 화면 · 크래시 · 멈춤 · 첫날 플레이는 앱 수집이 켜진 뒤부터 채워지고 그전에는 — 로 나옵니다." : "";
    byId("tenkeyRetentionChurn").innerHTML = rows.length
      ? `<p class="tk-sub">마지막 접속이 ${state.churnDays}일 넘은 계정. ${esc(count)}${esc(lacking)} 연속 활동 = 떠나기 전 이어서 접속한 날 수, 판 / 활동일 = 마지막 접속 직전 7일.</p><div class="table-scroll"><table><thead><tr><th>플레이어</th><th>마지막 활동</th><th class="tk-num">연속 활동</th><th>마지막 화면</th><th>마지막 판</th><th class="tk-num">판 / 활동일 · 마지막 7일</th><th class="tk-num">크래시 / 멈춤 · 30일</th><th class="tk-num">첫날 플레이</th></tr></thead><tbody>${body}</tbody></table></div>`
      : `<p class="empty-panel">마지막 접속이 ${state.churnDays}일 넘은 계정이 없습니다.</p>`;
    document.querySelectorAll("[data-retention-churn-days]").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.retentionChurnDays) === state.churnDays));
    });
  }

  // Returning players by ACCOUNT on every platform, web included (owner 11-04): the server's active days, ready now.
  const ORDER = ["web", "android", "ios", "steam", "windows", "linux", "macos", "unknown"];
  const PLAT_LABEL = { macos: "Mac (개발 테스트)", unknown: "모름" };
  function accounts(data) {
    const rows = data.rows || [];
    const plats = [...new Set(rows.map((row) => row.platform))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const rate = (list, day) => {
      const ready = list.filter((row) => row[`d${day}_rate`] != null);
      const people = ready.reduce((n, row) => n + Number(row.players || 0), 0);
      const back = ready.reduce((n, row) => n + Number(row[`d${day}`] || 0), 0);
      return people ? `${(back / people * 100).toFixed(1)}%` : "—";
    };
    byId("tenkeyAccountReturnsSummary").innerHTML = plats.map((plat) => {
      const list = rows.filter((row) => row.platform === plat);
      const people = list.reduce((n, row) => n + Number(row.players || 0), 0);
      const back = list.reduce((n, row) => n + Number(row.returned || 0), 0);
      return `<article class="tk-retention-card"><span>${esc(PLAT_LABEL[plat] || platformName(plat))}</span><strong>D1 ${esc(rate(list, 1))} · D7 ${esc(rate(list, 7))}</strong><small>새 계정 ${esc(num(people))}명 · 한 번이라도 다시 온 계정 ${esc(num(back))}명</small></article>`;
    }).join("");
    const body = rows.map((row) => `<tr><td>${esc(row.first_day)}</td><td>${esc(PLAT_LABEL[row.platform] || platformName(row.platform))}</td><td class="tk-num">${esc(num(row.players))}</td>
      ${[1, 3, 7, 14, 30].map((day) => `<td class="tk-num"><strong>${esc(row[`d${day}_rate`] == null ? "—" : `${(Number(row[`d${day}_rate`]) * 100).toFixed(1)}%`)}</strong><small>${esc(row[`d${day}_rate`] == null ? "아직" : `${num(row[`d${day}`])}명`)}</small></td>`).join("")}</tr>`).join("");
    byId("tenkeyAccountReturns").innerHTML = rows.length
      ? `<div class="table-scroll"><table><thead><tr><th>첫 접속일</th><th>플랫폼</th><th class="tk-num">새 계정</th><th class="tk-num">D1</th><th class="tk-num">D3</th><th class="tk-num">D7</th><th class="tk-num">D14</th><th class="tk-num">D30</th></tr></thead><tbody>${body}</tbody></table></div>`
      : '<p class="empty-panel">이 기간에 처음 접속한 계정이 없습니다.</p>';
  }

  function render(data) {
    summary(data);
    cohorts(data);
    funnel(data);
    churn(data);
  }

  async function load() {
    T.setMessage("tenkeyRetentionMessage", "계정 재방문 자료를 불러오는 중입니다...");
    const days = Number(byId("tenkeyRetentionDays").value);
    const buildText = byId("tenkeyRetentionBuild").value.trim();
    T.call("retention.accounts", { days }).then((result) => accounts(result.data || {})).catch((error) => {
      byId("tenkeyAccountReturnsSummary").innerHTML = "";
      byId("tenkeyAccountReturns").innerHTML = `<p class="empty-panel">계정 기준 재방문을 불러오지 못했습니다 (${esc(error && error.message ? error.message : "오류")}).</p>`;
    });
    try {
      const result = await T.call("retention.get", { days, build: buildText || undefined });
      state.data = result.data || {};
      render(state.data);
      const count = (state.data.cohorts || []).reduce((n, row) => n + Number(row.players || 0), 0);
      T.setMessage("tenkeyRetentionMessage", count
        ? `첫 활동일 기준 최근 ${num(state.data.days)}일 · ${num(count)}계정 · 서버 시간은 베를린 날짜입니다.`
        : "이 기간에 처음 접속한 계정이 없습니다.");
    } catch (error) {
      state.data = null;
      byId("tenkeyRetentionSummary").innerHTML = "";
      byId("tenkeyRetentionCohorts").innerHTML = "";
      byId("tenkeyRetentionFunnel").innerHTML = "";
      byId("tenkeyRetentionChurn").innerHTML = "";
      T.report("tenkeyRetentionMessage", error);
    }
  }

  function mountRetention() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyRetentionForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
      byId("tenkeyRetentionRefresh").addEventListener("click", load);
      byId("tenkeyRetentionView").addEventListener("click", (event) => {
        const button = event.target.closest("[data-retention-churn-days]");
        if (!button) return;
        state.churnDays = Number(button.dataset.retentionChurnDays);
        if (state.data) churn(state.data);
      });
    }
    load();
  }

  T.mountRetention = mountRetention;
})(window);
