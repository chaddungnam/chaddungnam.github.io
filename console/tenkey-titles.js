// 10key Survival: server-owned player title catalog and holder counts.
(function attachConsoleTenkeyTitles(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const INFO = Object.freeze({
    beta_tester: { name: "베타 테스터", rule: "스토어 출시 전에 만든 계정" },
    first_clear: { name: "첫 클리어", rule: "일반 모드에서 Lv 30을 넘겨 클리어" },
    season_top_10: { name: "시즌 TOP 10", rule: "분기 시즌 종료 때 상위 10위" },
    season_champion: { name: "시즌 1위", rule: "분기 시즌 종료 때 1위" },
    module_collector: { name: "모듈 수집가", rule: "모듈 종류 24개 모두 보유" },
    robot_pilot: { name: "로봇 파일럿", rule: "로봇 모드 첫 기록 제출" },
    developer: { name: "개발자", rule: "운영자 직접 부여" },
    event_winner: { name: "이벤트 우승자", rule: "운영자 직접 부여" },
  });
  let catalogRequest = null;

  function titleInfo(id) {
    return INFO[id] || { name: String(id || "알 수 없는 칭호"), rule: "서버 카탈로그에 등록된 칭호" };
  }

  function loadTitleCatalog(force = false) {
    if (force || !catalogRequest) {
      catalogRequest = T.call("titles.catalog", {}).then((result) => {
        if (!Array.isArray(result.data)) throw new Error("console_invalid_response");
        return result.data;
      }).catch((error) => {
        catalogRequest = null;
        throw error;
      });
    }
    return catalogRequest;
  }

  async function mountTitles() {
    T.setMessage("tenkeyTitlesMessage", "칭호 보유 현황을 불러오는 중입니다...");
    byId("tenkeyTitlesTable").innerHTML = '<tr><td colspan="4" class="empty-panel">불러오는 중입니다...</td></tr>';
    try {
      const titles = await loadTitleCatalog(true);
      const ordered = [...titles].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      byId("tenkeyTitleTotal").textContent = `${num(ordered.length)}개`;
      byId("tenkeyTitlesTable").innerHTML = ordered.map((title) => {
        const info = titleInfo(title.id);
        const kind = title.console_only ? '<span class="tk-badge" data-tone="watch">운영자 부여</span>' : '<span class="tk-badge" data-tone="good">플레이 해금</span>';
        return `<tr><td><strong>${esc(info.name)}</strong><span class="tk-sub">${esc(title.id)}</span></td><td>${esc(info.rule)}</td><td class="tk-num">${esc(num(title.holders))}</td><td>${kind}</td></tr>`;
      }).join("");
      T.setMessage("tenkeyTitlesMessage", `서버 카탈로그 ${num(ordered.length)}종 · 보유자 수는 현재 지급된 계정 기준입니다.`);
    } catch (error) {
      byId("tenkeyTitleTotal").textContent = "—";
      byId("tenkeyTitlesTable").innerHTML = '<tr><td colspan="4" class="empty-panel">칭호 목록을 읽지 못했습니다.</td></tr>';
      T.report("tenkeyTitlesMessage", error);
    }
  }

  T.titleInfo = titleInfo;
  T.loadTitleCatalog = loadTitleCatalog;
  T.mountTitles = mountTitles;
})(window);
