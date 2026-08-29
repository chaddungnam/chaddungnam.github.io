(function attachConsoleModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ConsoleModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createConsoleModel() {
  const pages = new Set(["analytics", "analytics-exclusions", "players", "operations", "purchases", "cs", "audit", "project-k"]);

  function routeFromHash(hash) {
    const path = String(hash || "").replace(/^#\/?/, "").split("?")[0];
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "players" && parts[1]) {
      try {
        return { page: "player", userId: decodeURIComponent(parts[1]) };
      } catch (_error) {
        return { page: "players" };
      }
    }
    return { page: pages.has(parts[0]) ? parts[0] : "analytics" };
  }

  function decodeJwtPayload(token) {
    try {
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
    } catch (_error) {
      return null;
    }
  }

  function dedupePlayers(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (!row?.userId || seen.has(row.userId)) return false;
      seen.add(row.userId);
      return true;
    });
  }

  function playerDisplayName(player) {
    const nickname = String(player?.nickname || "").trim() || "이름 없음";
    const displayCode = String(player?.displayCode || "").trim();
    return displayCode ? `${nickname} · ${displayCode}` : nickname;
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);

  function normalizePlayerNote(value) {
    const nested = value?.operatorNote ?? (value?.operator_note && typeof value.operator_note === "object" ? value.operator_note : null);
    const source = nested || value || {};
    const tagsValue = source.tags ?? source.operator_tags ?? source.operatorTags ?? [];
    const tags = Array.isArray(tagsValue)
      ? tagsValue.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 8)
      : [];
    const noteValue = nested ? source.note : (source.note ?? source.operator_note ?? source.operatorNote);
    return {
      tracked: Boolean(source.tracked ?? source.operator_tracked ?? source.operatorTracked),
      tags,
      note: String(noteValue || "").trim().slice(0, 1000),
      updatedAt: String(source.updated_at ?? source.operator_note_updated_at ?? source.operatorNoteUpdatedAt ?? ""),
    };
  }

  function parsePlayerTags(value) {
    const seen = new Set();
    const tags = [];
    for (const item of String(value || "").split(",")) {
      const tag = item.trim();
      const key = tag.toLocaleLowerCase("ko-KR");
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
    return tags;
  }

  function playerNoteMarkup(value) {
    const operatorNote = normalizePlayerNote(value);
    const badges = [];
    if (operatorNote.tracked) badges.push('<span class="player-note-badge player-note-tracked">추적</span>');
    operatorNote.tags.forEach((tag) => badges.push(`<span class="player-note-badge">${escapeHtml(tag)}</span>`));
    if (operatorNote.note) badges.push(`<span class="player-note-badge player-note-has-memo" title="${escapeHtml(operatorNote.note)}">메모</span>`);
    return badges.length ? `<span class="player-note-badges">${badges.join("")}</span>` : "";
  }

  function playerIdentityMarkup(player, returnHash) {
    const userId = String(player?.userId ?? player?.user_id ?? "").trim();
    const displayName = playerDisplayName({
      nickname: player?.nickname,
      displayCode: player?.displayCode ?? player?.display_code,
    });
    const content = `<span class="player-identity-name">${escapeHtml(displayName)}</span>${playerNoteMarkup(player)}`;
    return userId
      ? `<a class="player-identity-link" href="${escapeHtml(playerDeepLink(userId, returnHash))}">${content}</a>`
      : `<span class="player-identity-link player-identity-unlinked">${content}</span>`;
  }

  const specialCountries = Object.freeze({
    ALN: { name: "외계인", flag: "👽" },
    SGV: { name: "그림자정부", flag: "🕶️" },
    RPT: { name: "렙틸리언", flag: "🦎" },
  });
  let koreanRegionNames;

  function countryDisplay(value) {
    const code = String(value || "").trim().toUpperCase();
    if (!code) return { code: "", name: "국가 미설정", flag: "", custom: false };
    if (specialCountries[code]) return { code, ...specialCountries[code], custom: true };
    if (/^[A-Z]{2}$/.test(code)) {
      try {
        koreanRegionNames ||= new Intl.DisplayNames(["ko-KR"], { type: "region" });
        const name = koreanRegionNames.of(code);
        if (name && name !== code) {
          const flag = String.fromCodePoint(...Array.from(code, (letter) => letter.charCodeAt(0) + 127397));
          return { code, name, flag, custom: false };
        }
      } catch (_error) {
        // Intl.DisplayNames가 없는 오래된 브라우저에서는 아래 안전한 대체 문구를 사용한다.
      }
    }
    return { code, name: `알 수 없는 국가 (${code})`, flag: "", custom: false };
  }

  const actionNames = Object.freeze({
    player_mutation: "플레이어 재화 변경",
    player_mutation_revert: "플레이어 재화 되돌리기",
    player_wipe: "플레이어 데이터 초기화",
    player_note_update: "플레이어 메모 업데이트",
    inventory_mutation: "아이템 지급·회수",
    score_correction: "점수 기록 보정",
    reward_mail_send: "개별 보상 우편",
    reward_mail_broadcast: "전체 보상 우편",
    min_version_update: "최소 지원 버전 변경",
    qa_access_update: "QA 상점 권한 변경",
  });

  function actionDisplayName(value) {
    const action = String(value || "").trim();
    return actionNames[action] || action || "알 수 없는 작업";
  }

  function serializeAnalyticsFilters(filters) {
    const params = new URLSearchParams();
    params.set("rangeDays", String(filters.rangeDays));
    params.set("rangeOffsetDays", String(filters.rangeOffsetDays || 0));
    params.set("distributionKey", String(filters.distributionKey));
    params.set("sort", String(filters.sort));
    params.set("direction", String(filters.direction));
    params.set("page", String(filters.page));
    if (String(filters.query || "").trim()) params.set("query", String(filters.query).trim());
    return params.toString();
  }

  function playerDeepLink(userId, returnHash) {
    return `#/players/${encodeURIComponent(userId)}?return=${encodeURIComponent(returnHash)}`;
  }

  function safeConsoleReturnHash(value) {
    const hash = String(value || "");
    return /^#\/(?:analytics|analytics-exclusions|players(?:\/[^?#\u0000-\u0020\u007f]+)?|operations|purchases|cs|audit)(?:\?[^#\u0000-\u0020\u007f]*)?$/.test(hash)
      ? hash
      : "#/players";
  }

  function buildAttentionItems(pulse, observedAt = "") {
    const targets = {
      duration: "metricDurationCard",
      completion: "metricCompletionCard",
      retention: "metricRetentionCard",
      ads: "metricAdsCard",
    };
    const withContext = (item, targetId) => ({
      ...item,
      source: "Pulse",
      ...(observedAt ? { observedAt } : {}),
      targetId,
    });
    const items = Object.entries(pulse?.metrics || {})
      .filter(([, metric]) => metric?.status === "risk" || metric?.status === "watch")
      .map(([key, metric]) => withContext({ severity: metric.status, label: metric.description }, targets[key] || "healthCard"));
    if (items.length > 0) return items;
    if (pulse?.verdict?.status === "insufficient") {
      return [withContext({ severity: "insufficient", label: "플레이 데이터가 더 필요합니다." }, "healthCard")];
    }
    if (pulse?.verdict?.status === "risk" || pulse?.verdict?.status === "watch") {
      return [withContext({ severity: pulse.verdict.status, label: pulse.verdict.summary || "지표를 확인해 주세요." }, "healthCard")];
    }
    return [];
  }

  const analyticsChoiceNames = Object.freeze({
    breakthrough: "돌파", mad_scientist: "매드 사이언티스트", space: "공간 축소",
    shooting_drop: "슈팅 드롭", fast_growth: "빠른 성장", unstable_growth: "불안정 성장",
    mechakucha_quake: "메챠쿠챠 지진", size_restore: "크기 복원", blood_game: "블러드 게임",
    all_or_nothing: "모 아니면 도", score_double: "점수 2배", roulette_reroll: "룰렛 다시하기",
    drag_drop_level: "드래그 앤 드롭",
    bonus: "보너스 점수", nothing: "꽝", hard_mode: "하드 모드", time_rewind: "시간 되감기",
  });

  const analyticsScreenNames = Object.freeze({
    home: "홈", main: "게임", loading: "첫 실행·로그인", settings: "설정", shop: "상점",
    scorerecord: "점수 기록", attendance: "미션·출석", profile: "프로필", mailbox: "우편함",
    origincutscene: "오프닝 이야기", ranking: "랭킹", friends: "친구", notice: "공지",
  });

  function analyticsChoiceName(value) {
    const key = String(value || "unknown").trim().toLowerCase();
    return analyticsChoiceNames[key] || "기타·구버전 값";
  }

  function analyticsScreenName(value) {
    const key = String(value || "unknown").trim().toLowerCase();
    return analyticsScreenNames[key] || "화면 미식별";
  }

  function analyticsButtonName(buttonId, screen) {
    const raw = String(buttonId || "unknown").trim().toLowerCase();
    const screenName = analyticsScreenName(screen || raw.split("/")[0]);
    const semanticNames = {
      start_game: "게임 시작", pause_menu: "일시정지 메뉴", chance_pop: "찬스 구슬 터뜨리기",
      game_speed_toggle: "게임 배속 전환", level_roulette_screen_tap: "레벨 룰렛 화면 탭",
      level_roulette_stop: "레벨 룰렛 멈추기", level_roulette_ticket: "돌파 티켓 사용",
      bomb_roulette_stop: "폭탄 룰렛 멈추기",
    };
    for (const [key, label] of Object.entries(semanticNames)) {
      if (raw === key || raw.endsWith(`/${key}`)) return `${screenName} · ${label}`;
    }
    const growth = raw.match(/growthchoice_([a-z0-9_]+)$/);
    if (growth) return `성장 선택 팝업 · ${analyticsChoiceName(growth[1])}`;
    if (raw.endsWith("/backbutton")) return `${screenName} · 뒤로가기`;
    if (raw.endsWith("/advancebutton")) return `${screenName} · 다음 대사`;
    if (raw.includes("shoporbbutton")) return "홈 · 상점 열기";
    if (raw.includes("settingsorbbutton")) return "홈 · 설정 열기";
    if (raw.includes("rankingorbbutton")) return "홈 · 랭킹 열기";
    if (raw.includes("questshortcutbutton")) return "홈 · 미션 바로가기";
    if (raw.includes("settingsprofileopenbutton")) return "설정 · 프로필 열기";
    if (raw.endsWith("/settings_contact_open") || raw.includes("settingsinfogrid/button_2")) return "설정 · 문의하기 열기";
    if (raw.endsWith("/settings_contact_support_open") || raw === "settings/control_1/panel_1/button_0") return "설정 · 문의 지원 페이지로 이동 (외부 브라우저)";
    if (raw.endsWith("/onboarding_profile_confirm")) return "첫 실행·로그인 · 닉네임·국가 설정 완료";
    if (raw.endsWith("/onboarding_country_open")) return "첫 실행·로그인 · 국가 선택 열기";
    if (raw.includes("growthchoicehistorybutton")) return "게임 · 성장 효과 기록 열기";
    if (raw === "home/button_0") return "홈 · 게임 시작 (구버전)";
    if (raw === "main/hud/button_0") return "게임 · 일시정지 메뉴 (구버전)";
    if (raw === "main/hud/button_1") return "게임 · 찬스 구슬 터뜨리기 (구버전)";
    const legacyPopup = raw.match(/^main\/ui\/control_\d+\/panel_\d+\/button_(\d+)$/);
    if (legacyPopup) return `게임 중 팝업 · ${Number(legacyPopup[1]) + 1}번째 행동 버튼 (구버전)`;
    const genericButton = raw.match(/button_(\d+)$/);
    if (genericButton) return `${screenName} · ${Number(genericButton[1]) + 1}번째 버튼 (구버전)`;
    return `${screenName} · 이름이 기록되지 않은 버튼`;
  }

  function interactionRecommendation(item) {
    const label = analyticsButtonName(item?.buttonId, item?.screen);
    const idle = Number(item?.avgIdleSec || 0);
    const visits = Number(item?.installs || 0);
    if (label.includes("구버전") || label.includes("기록되지 않은")) {
      return "구버전 식별자라 정확한 기능 이름을 분리할 수 없습니다.";
    }
    if (idle >= 3.5) return "자연스러운 조작 시간인 3초를 넘겨 멈춘 행동입니다. 버튼 문구와 다음 결과를 더 직접적으로 보여주세요.";
    if (visits <= 1) return "한 명에게 몰린 신호일 수 있습니다. 표본이 더 쌓이기 전에는 UI를 바꾸지 마세요.";
    return "반복 사용되는 경로입니다. 바로 앞 화면의 노출 수와 함께 눌림률을 비교하세요.";
  }

  function diffPlayerChanges(current, next) {
    const allowed = ["gems", "stamina", "stamina_max", "breakthrough_tickets", "speed_boost_tickets"];
    return Object.fromEntries(allowed
      .filter((key) => Number.isInteger(next?.[key]) && next[key] >= 0 && current?.[key] !== next[key])
      .map((key) => [key, { before: current?.[key] ?? 0, after: next[key] }]));
  }

  function canSubmitMutation({ reason, changes, mutationsEnabled, stateVersion }) {
    return String(reason || "").trim().length > 0
      && changes && Object.keys(changes).length > 0
      && mutationsEnabled !== false
      && Number.isSafeInteger(stateVersion)
      && stateVersion >= 0;
  }

  return {
    routeFromHash,
    decodeJwtPayload,
    dedupePlayers,
    playerDisplayName,
    normalizePlayerNote,
    parsePlayerTags,
    playerNoteMarkup,
    playerIdentityMarkup,
    countryDisplay,
    actionDisplayName,
    serializeAnalyticsFilters,
    playerDeepLink,
    safeConsoleReturnHash,
    buildAttentionItems,
    analyticsChoiceName,
    analyticsScreenName,
    analyticsButtonName,
    interactionRecommendation,
    diffPlayerChanges,
    canSubmitMutation,
  };
});
