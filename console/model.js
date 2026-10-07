(function attachConsoleModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ConsoleModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createConsoleModel() {
  const pages = new Set([
    "analytics", "analytics-exclusions", "players", "operations", "purchases", "cs", "audit", "notes", "project-k",
    "hexaworld-overview", "hexaworld-notices", "hexaworld-attendance", "hexaworld-mail", "hexaworld-config", "hexaworld-audit",
    "hexaworld-players",
  ]);

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

  function platformDisplay(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "google_play" || key === "android") return { key, label: "AOS", known: true };
    if (key === "app_store" || key === "ios") return { key, label: "iOS", known: true };
    if (key === "onestore") return { key, label: "AOS · 원스토어", known: true };
    return { key, label: "기기 미확인", known: false };
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
    return (action === "liveops_update" ? "라이브 이벤트 설정" : actionNames[action]) || action || "알 수 없는 작업";
  }

  const catalogLabels = Object.freeze({
    profile_icon: "아이콘",
    profile_frame: "테두리",
    marble_skin: "마블",
    icon_joker: "흑백 쿼키",
    icon_joker_red: "붉은 쿼키",
    icon_rebel: "반항아 쿼키",
    icon_midnight: "미드나이트 쿼키",
    icon_winter_joker: "윈터 쿼키",
    icon_pumpkin_joker: "펌킨 쿼키",
    icon_korean_joker: "한복 쿼키",
    icon_aurora: "오로라 쿼키",
    icon_scientist: "과학자 쿼키",
    icon_pass_lab: "패스 쿼키",
    icon_jakwon_tongue: "yakwon 프로필",
    frame_basic: "기본 테두리",
    frame_lab: "연구소 테두리",
    frame_pass_lab: "패스 연구소 테두리",
    frame_quirky_rainbow: "쿼키 무지개 테두리",
    skin_classic: "클래식 마블",
    skin_mint: "민트 마블",
    skin_galaxy: "갤럭시 마블",
    skin_science_crate: "과학 상자 마블",
    skin_pass_lab: "패스 연구소 마블",
    skin_jakwon: "yakwon 구슬",
  });

  function catalogItemLabel(item) {
    const id = String(item?.item_id || item || "").trim();
    const type = String(item?.item_type || "").trim();
    const name = item?.admin_label || catalogLabels[id] || id;
    const kind = catalogLabels[type] || type;
    return kind ? `${name} · ${kind}` : name;
  }

  function rewardKindLabel(kind) {
    return ({ gems: "젬", breakthrough_ticket: "돌파 티켓", speed_ticket: "스피드 티켓", entitlement: "상점 아이템" })[kind] || kind || "보상";
  }

  function mailSummaryText(summary) {
    const data = summary && typeof summary === "object" ? summary : {};
    const count = Number(data.recipient_count);
    const template = String(data.template_key || "");
    const expires = data.expires_at ? new Date(data.expires_at) : null;
    const expireText = expires && !Number.isNaN(expires.getTime())
      ? expires.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
      : "";
    const rewards = Array.isArray(data.rewards) ? data.rewards.map((reward) => {
      if (reward?.kind === "entitlement") return catalogItemLabel(reward.item_id);
      const amount = Number(reward?.amount);
      return Number.isFinite(amount) ? `${rewardKindLabel(reward.kind)} ${amount.toLocaleString("ko-KR")}` : rewardKindLabel(reward?.kind);
    }).filter(Boolean) : [];
    const parts = [
      count >= 0 && Number.isFinite(count) ? `${count.toLocaleString("ko-KR")}명` : "",
      template,
      rewards.join(" · "),
      expireText ? `기한 ${expireText}` : "",
    ].filter(Boolean);
    return parts.join(" · ") || "우편 발송";
  }

  function normalizeCustomAnalyticsRange(startDate, endDate, today, maxDays = 28) {
    const validDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
      && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDay(startDate) || !validDay(endDate) || startDate > endDate) return { ok: false, error: "시작일과 종료일을 확인해 주세요." };
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    const days = Math.round((end - start) / 86400000) + 1;
    if (days < 1 || days > maxDays) return { ok: false, error: `집계 기간은 최대 ${maxDays}일입니다.` };
    if (today && endDate > today) return { ok: false, error: "오늘 이후 날짜는 선택할 수 없습니다." };
    if (today) {
      const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - (maxDays - 1) * 86400000).toISOString().slice(0, 10);
      if (startDate < earliest) return { ok: false, error: `원본 이벤트 보관 기간인 최근 ${maxDays}일 안에서 선택해 주세요.` };
    }
    return { ok: true, startDate, endDate, days };
  }

  function serializeAnalyticsFilters(filters) {
    const params = new URLSearchParams();
    if (filters.startDate && filters.endDate) {
      params.set("startDate", String(filters.startDate));
      params.set("endDate", String(filters.endDate));
    } else {
      params.set("rangeDays", String(filters.rangeDays));
      params.set("rangeOffsetDays", String(filters.rangeOffsetDays || 0));
    }
    params.set("distributionKey", String(filters.distributionKey));
    if (filters.appFamily && filters.appFamily !== "all") params.set("appFamily", String(filters.appFamily));
    if (filters.runMode && filters.runMode !== "all") params.set("runMode", String(filters.runMode));
    params.set("sort", String(filters.sort));
    params.set("direction", String(filters.direction));
    params.set("page", String(filters.page));
    if (String(filters.query || "").trim()) params.set("query", String(filters.query).trim());
    // C(2026-10-01) 한눈 요약 필터. 기본값이면 생략해 기존 주소와 같다.
    if (filters.overviewPeriod && Number(filters.overviewPeriod) !== 7) params.set("period", String(filters.overviewPeriod));
    if (filters.overviewVersion && filters.overviewVersion !== "all") params.set("version", String(filters.overviewVersion));
    if (filters.overviewPlatform && filters.overviewPlatform !== "all") params.set("platform", String(filters.overviewPlatform));
    if (filters.legacyOpen) params.set("legacy", "1");
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
    lab_boss_mad: "매드 사이언티스트 연사", lab_boss_awakened: "각성 매드 사이언티스트",
    lab_score_bonus: "즉시 점수",
    bonus: "보너스 점수", nothing: "꽝", hard_mode: "하드 모드", time_rewind: "시간 되감기",
  });

  const analyticsScreenNames = Object.freeze({
    home: "홈", main: "게임", loading: "첫 실행·로그인", settings: "설정", shop: "상점",
    scorerecord: "점수 기록", attendance: "미션·출석", profile: "프로필", profilecustomize: "프로필 꾸미기", mailbox: "우편함",
    origincutscene: "오프닝 이야기", ranking: "랭킹", friends: "친구", notice: "공지",
    labhome: "실험실 홈", labshop: "실험실 상점", labranking: "실험실 랭킹", labvip: "VIP",
    labtutorialhome: "튜토리얼 홈",
  });

  function readableRawId(value) {
    const raw = String(value || "unknown").trim();
    return raw.replace(/[_-]+/g, " ") || "unknown";
  }

  function analyticsChoiceName(value) {
    const key = String(value || "unknown").trim().toLowerCase();
    return analyticsChoiceNames[key] || readableRawId(value);
  }

  function analyticsScreenName(value) {
    const key = String(value || "unknown").trim().toLowerCase();
    return analyticsScreenNames[key] || readableRawId(value);
  }

  const labTutorialStageNames = Object.freeze({
    opening: "오프닝", drop: "첫 드롭", level1_free: "1레벨 자유 플레이", mad: "매드 연사",
    bomb_ready: "폭탄 준비", bomb_roulette: "폭탄 룰렛", bomb_drop: "폭탄 드롭", bomb_practice: "폭탄 연습",
    penalty_warning: "페널티 경고", penalty_demo: "페널티 시연", penalty_result: "페널티 결과",
    golden_roulette: "골든 룰렛", golden: "골든 슈팅", beaker: "비커", beaker_play: "비커 플레이",
    mason: "메이슨", choice: "성장 선택", approach: "보스 접근", boss_dodge_guide: "보스 회피 안내",
    boss_dodge_entry: "보스 회피 진입", boss_dodge: "보스 회피", boss_return: "보스 복귀",
    boss_attack: "보스 공격", superior_taunt: "보스 도발", boss_defeat: "보스 격파", home_handoff: "홈 인계",
    boss_escape: "보스 탈출", boss_flight: "보스 비행", boss_repair: "보스 수리",
    home_story: "홈 이야기", home_growth: "홈 성장", home_free: "홈 자유",
  });

  function labTutorialStageName(stage) {
    const key = String(stage || "").trim().toLowerCase();
    return labTutorialStageNames[key] || readableRawId(stage);
  }

  function isHomeScreen(value) {
    const key = String(value || "").trim().toLowerCase();
    return key === "home" || key === "labhome";
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
    if (idle >= 5) return "같은 버튼에서 5초 이상 걸린 행동이 5회 이상 반복됐습니다. 문구와 다음 결과가 바로 이해되는지 점검하세요.";
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

  function sampleRate(numerator, denominator) {
    if (numerator == null || denominator == null || !Number.isFinite(Number(numerator)) || !Number.isFinite(Number(denominator))) return "기록 없음";
    const n = Number(numerator), d = Number(denominator);
    if (n < 0 || d < 0 || n > d) return "집계 확인 필요";
    return d < 50 ? "표본 부족" : `${(n / d * 100).toFixed(1)}%`;
  }

  function snapshotRank(row) {
    return !row?.captured_at ? "스냅숏 없음" : row.rank == null ? "상위 200명에 없음" : `${row.rank}위`;
  }

  function tutorialStatus(tutorial) {
    if (!tutorial) return "확인 불가";
    if (tutorial.home_at) return "완료 후 홈 도착 확인";
    if (tutorial.completed_at) return "완료 확인";
    if (tutorial.started_at) return "시작 확인 · 완료 기록 없음";
    return "기록 없음";
  }

  // ── C (2026-10-01) 한눈 요약: 필터·숫자·증감·작은 그래프 ─────────────────
  const overviewPeriods = Object.freeze([1, 3, 7, 30, 90]);
  // 기간 이름: 1일 = 오늘(독일 시간 0시부터)과 어제, 그 밖은 '이번/이전 N일'.
  function overviewNowLabel(periodDays) { return Number(periodDays) === 1 ? "오늘" : `이번 ${periodDays || 7}일`; }
  function overviewPrevLabel(periodDays) { return Number(periodDays) === 1 ? "어제" : `이전 ${periodDays || 7}일`; }
  // 시간 칸 이름 "YYYY-MM-DDTHH:00" → 툴팁 제목·축 글자.
  function overviewSlotParts(label) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00$/.exec(String(label || ""));
    return match ? { day: `${match[1]}-${match[2]}-${match[3]}`, month: Number(match[2]), date: Number(match[3]), hour: Number(match[4]) } : null;
  }
  function overviewSlotTitle(label, hours) {
    const slot = overviewSlotParts(label);
    if (!slot) return "";
    const end = slot.hour + (hours || 1);
    return `${slot.month}월 ${slot.date}일 ${String(slot.hour).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
  }
  const overviewVersions = Object.freeze(["all", "1.x", "2.x"]);
  const overviewPlatforms = Object.freeze(["all", "android", "ios"]);

  function normalizeOverviewFilters(params) {
    const get = (key) => (typeof params?.get === "function" ? params.get(key) : params?.[key]) ?? "";
    const period = Number(get("period"));
    const version = String(get("version"));
    const platform = String(get("platform"));
    return {
      periodDays: overviewPeriods.includes(period) ? period : 7,
      version: overviewVersions.includes(version) ? version : "all",
      platform: overviewPlatforms.includes(platform) ? platform : "all",
    };
  }

  const finite = (value) => typeof value === "number" && Number.isFinite(value);

  function formatOverviewSeconds(value) {
    const seconds = Math.max(0, Math.round(value));
    if (seconds < 60) return `${seconds}초`;
    if (seconds < 3600) {
      const rest = seconds % 60;
      return rest ? `${Math.floor(seconds / 60)}분 ${rest}초` : `${seconds / 60}분`;
    }
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes ? `${Math.floor(seconds / 3600)}시간 ${minutes}분` : `${Math.floor(seconds / 3600)}시간`;
  }

  function formatOverviewValue(value, format, currency) {
    if (!finite(value)) return "—";
    if (format === "percent") return `${(value * 100).toFixed(1)}%`;
    if (format === "seconds") return formatOverviewSeconds(value);
    if (format === "milliseconds") return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}초`;
    if (format === "money") {
      if (/^[A-Z]{3}$/.test(String(currency || "")) && currency !== "XXX") {
        try {
          return new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
        } catch (_error) {
          // 알 수 없는 통화 코드는 숫자와 코드로 둔다.
        }
      }
      return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${currency || ""}`.trim();
    }
    if (format === "decimal" || format === "per1k") {
      const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
      return value.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    }
    return Math.round(value).toLocaleString("ko-KR");
  }

  // 증감: 비교할 수 없으면 비워 두고(이유 문구), 좋아짐·나빠짐은 화살표와 글자로도 보인다(색만으로 구분하지 않음).
  function overviewDelta(metric, periodDays) {
    const compare = metric?.compare || "none";
    const label = overviewPrevLabel(periodDays);
    if (metric?.value == null) return { text: "", tone: "neutral", arrow: "", label: "" };
    if (compare === "none") return { text: "현재 상태", tone: "neutral", arrow: "", label: "" };
    if (!finite(metric.delta)) return { text: "비교 없음", tone: "neutral", arrow: "", label: metric.previous == null ? "비교 기간 기록 없음" : "0에서 늘어남" };
    const magnitude = Math.abs(metric.delta) * 100;
    const flat = magnitude < 0.05;
    const sign = flat ? "±" : metric.delta > 0 ? "+" : "−";
    const amount = compare === "points" ? `${magnitude.toFixed(1)}%p` : `${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`;
    const better = metric.better || "none";
    const good = better === "up" ? metric.delta > 0 : metric.delta < 0;
    const tone = flat || better === "none" ? "neutral" : good ? "good" : "bad";
    return { text: `${sign}${amount}`, tone, arrow: flat ? "→" : metric.delta > 0 ? "▲" : "▼", label };
  }

  // 작은 선 그래프: null은 끊고(보관 밖·기록 전), 0은 그린다. 선은 추세를 보이려고 값의 범위(domain="data")로,
  // 막대처럼 0부터 읽어야 하면 domain="zero"로, 두 선이 한 축을 나눠 쓰면 [min, max]로 그린다. 값이 모두 같으면 가운데 줄이다.
  function sparklineGeometry(points, width = 120, height = 36, pad = 3, domain = "data") {
    const list = Array.isArray(points) ? points : [];
    const values = list.filter(finite);
    if (!values.length) return { segments: [], last: null, min: null, max: null };
    const fixed = Array.isArray(domain) && finite(domain[0]) && finite(domain[1]);
    const min = fixed ? domain[0] : domain === "zero" ? Math.min(0, ...values) : Math.min(...values);
    const max = fixed ? domain[1] : domain === "zero" ? Math.max(...values, 0) : Math.max(...values);
    const span = max - min;
    const x = (index) => list.length > 1 ? pad + index * (width - pad * 2) / (list.length - 1) : width / 2;
    const y = (value) => span === 0 ? height / 2 : height - pad - (value - min) / span * (height - pad * 2);
    const segments = [];
    let current = [];
    list.forEach((value, index) => {
      if (!finite(value)) {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push([Number(x(index).toFixed(2)), Number(y(value).toFixed(2))]);
    });
    if (current.length) segments.push(current);
    let lastIndex = -1;
    list.forEach((value, index) => { if (finite(value)) lastIndex = index; });
    return { segments, last: { index: lastIndex, value: list[lastIndex], x: Number(x(lastIndex).toFixed(2)), y: Number(y(list[lastIndex]).toFixed(2)) }, min, max };
  }

  function sparkBars(points, width = 120, height = 36, pad = 2) {
    const list = Array.isArray(points) ? points : [];
    const values = list.filter(finite);
    const max = Math.max(0, ...values);
    const slot = list.length ? (width - pad * 2) / list.length : 0;
    const barWidth = Math.max(1, Math.min(12, slot * 0.62));
    return list.map((value, index) => {
      if (!finite(value)) return { index, value: null, x: 0, y: 0, width: 0, height: 0 };
      const barHeight = max > 0 ? Math.max(value > 0 ? 1.5 : 0, value / max * (height - pad * 2)) : 0;
      return {
        index, value,
        x: Number((pad + index * slot + (slot - barWidth) / 2).toFixed(2)),
        y: Number((height - pad - barHeight).toFixed(2)),
        width: Number(barWidth.toFixed(2)),
        height: Number(barHeight.toFixed(2)),
      };
    });
  }

  const overviewStatusLabels = Object.freeze({ ok: "정상", partial: "일부 기간", no_data: "아직 데이터 없음", error: "집계 실패" });
  function overviewStatusLabel(status) {
    return overviewStatusLabels[status] || "확인 필요";
  }

  const overviewFlowNames = Object.freeze({
    claim_idle: "방치 보상", "grant_reagent:escape": "탈출 보상", "grant_reagent:quest": "연구 퀘스트",
    "grant_reagent:sweep": "소탕", grant_reagent: "시약 지급", ad_drone: "광고 드론", claim_daily_goal: "하루 목표",
    claim_weekly_chest: "주간 상자", claim_deep_milestone: "심층 이정표", grant_deep_zone: "심층 구역",
    claim_result_bonus: "결과 보너스", complete_run: "런 완료", report_play: "플레이 보고", upgrade_hex: "육각 강화",
    cancel_upgrade: "강화 취소", tune_core: "코어 조율", shop_free: "상점 무료 젬", shop_ad: "상점 광고 젬",
    mailbox: "우편 수령", cosmetic: "꾸미기 구매", stamina: "스태미나", stamina_bundle: "스태미나 묶음",
    breakthrough_ticket: "돌파 티켓", emergency_breakthrough_ticket: "긴급 돌파 티켓", speed_boost_ticket: "가속 티켓",
    nickname_ticket: "닉네임 변경권", country_ticket: "국가 변경권",
  });
  function overviewFlowName(flow) {
    const key = String(flow || "").trim();
    return overviewFlowNames[key] || overviewFlowNames[key.split(":")[0]] || readableRawId(key);
  }

  const overviewPlacementNames = Object.freeze({
    home_stamina_refill: "홈 스태미나 충전", shop_stamina_refill: "상점 스태미나 충전", shop_gems: "상점 젬",
    ingame_pop_chance: "인게임 팝 찬스", gameover_restart_refill: "게임오버 재시작", gameover_stamina_refill: "게임오버 스태미나",
    midgame_exit: "중간 종료", gameover_to_home: "게임오버→홈", gameover_to_ranking: "게임오버→랭킹",
  });
  function overviewPlacementName(placement) {
    const key = String(placement || "").trim();
    return overviewPlacementNames[key] || readableRawId(key);
  }

  // LabPhaseProgress.BOSS_IDS (P1–P8 순서).
  const overviewBossNames = Object.freeze({ scientist: "P1 과학자", airship: "P2 비행선", ufo: "P3 UFO", drone: "P4 드론", agent: "P5 요원", p6: "P6 보스", p7: "P7 보스", p8: "P8 보스" });
  function overviewBossName(bossId) {
    return overviewBossNames[String(bossId || "")] || readableRawId(bossId);
  }

  const overviewSocialNames = Object.freeze({ engine: "엔진 오류", script: "스크립트 오류", shader: "셰이더 오류" });
  function overviewErrorKindName(kind) {
    return overviewSocialNames[String(kind || "")] || readableRawId(kind);
  }

  // ── C2 (2026-10-01) 한눈 보드: 그래프가 먼저, 정확한 숫자·정의·표본은 툴팁으로 ─────────
  // 툴팁 값: 없으면 0이 아니라 '기록 없음'. 분자/분모가 있으면 표본을, 표본 수만 있으면 '표본 N'을 붙인다.
  function overviewTipValue(value, format, options = {}) {
    if (!finite(value)) return options.empty || "기록 없음";
    const shown = formatOverviewValue(value, format, options.currency);
    const unit = options.unit ?? "명";
    const count = (number) => Math.round(number).toLocaleString("ko-KR");
    if (finite(options.numerator) && finite(options.denominator)) return `${shown} (${count(options.numerator)}/${count(options.denominator)}${unit})`;
    if (finite(options.sample)) return `${shown} · 표본 ${count(options.sample)}${unit}`;
    return shown;
  }

  // 툴팁 한 개 = 첫 줄 제목, 다음 줄부터 "라벨\t값" 또는 메모 한 줄. 화면은 이 글자를 textContent로만 그린다.
  function overviewTipText(title, rows = [], note = "") {
    const clean = (value) => String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
    const lines = [clean(title)];
    for (const row of rows) {
      if (!row) continue;
      lines.push(Array.isArray(row) ? `${clean(row[0])}\t${clean(row[1])}` : clean(row));
    }
    if (note) lines.push(clean(note));
    return lines.join("\n");
  }

  function parseOverviewTip(text) {
    const [title = "", ...lines] = String(text ?? "").split("\n");
    return {
      title,
      rows: lines.filter(Boolean).map((line) => {
        const tab = line.indexOf("\t");
        return tab < 0 ? { note: line } : { label: line.slice(0, tab), value: line.slice(tab + 1) };
      }),
    };
  }

  // 지표 하나의 툴팁 줄: 이번 값, 이전 값과 증감, 버전별 값(없으면 이유). 숫자는 화면 대신 여기에만 둔다.
  function overviewMetricTipRows(metric, periodDays) {
    if (!metric) return [];
    const days = periodDays || 7;
    const value = (number) => overviewTipValue(number, metric.format, { currency: metric.currency, empty: metric.empty || "기록 없음" });
    const rows = [[metric.compare === "none" ? "지금" : overviewNowLabel(days), value(metric.value)]];
    if (metric.compare && metric.compare !== "none" && metric.value != null) {
      const delta = overviewDelta(metric, days);
      rows.push([overviewPrevLabel(days), finite(metric.previous)
        ? `${formatOverviewValue(metric.previous, metric.format, metric.currency)}${finite(metric.delta) ? ` (${delta.text})` : ""}`
        : "비교 기간 기록 없음"]);
    }
    if (metric.split) {
      for (const [family, name] of [["1.x", "1.x"], ["2.x", "2.0+"]]) {
        const split = metric.split[family];
        rows.push([name, finite(split) ? formatOverviewValue(split, metric.format, metric.currency) : String(metric.splitEmpty?.[family] || "기록 없음").replace(/^1\.x\s+/, "")]);
      }
    }
    return rows;
  }

  // '이번 기간 요약' 문장: 증감이 있는 핵심 지표만, 크게 변한 순서로 3개. AI 없이 규칙으로 만든다.
  // 크기 비교: 상대 지표는 증감률 그대로, %p 지표는 이전 값 대비 비율로 맞춘다(38.3%에서 5.9%p ↓ ≈ 15%).
  const overviewSummarySubjects = Object.freeze({
    dau: "DAU가", new_accounts: "신규 유입이", d1: "D1 복귀가", d7: "D7 복귀가",
    revenue: "검증 매출이", purchases: "검증 구매가", p1_boss: "신규의 P1 보스 클리어가", runs_per_dau: "DAU당 판 수가",
    boss_win: "보스 승률이", clear_rate: "런 클리어율이", unclean_per_1k: "사용 중 꺼짐이", errors_per_1k: "오류 위치가", load_p50: "시작 로딩 시간이",
  });

  function overviewSummarySentences(cards, periodDays, options = {}) {
    const days = periodDays || 7;
    const metrics = (Array.isArray(cards) ? cards : []).flatMap((card) => [card?.headline, ...(card?.metrics || [])]).filter(Boolean);
    const seen = new Set();
    const changes = [];
    let flat = 0;
    metrics.forEach((metric, order) => {
      const subject = overviewSummarySubjects[metric.key];
      if (!subject || seen.has(metric.key)) return;
      seen.add(metric.key);
      if (!finite(metric.value) || !finite(metric.delta) || !metric.compare || metric.compare === "none") return;
      const points = metric.compare === "points";
      const magnitude = Math.abs(metric.delta);
      if (points ? magnitude < 0.01 : magnitude < 0.05) {
        flat += 1;
        return;
      }
      const size = points && finite(metric.previous) && metric.previous > 0 ? magnitude / metric.previous : magnitude;
      const percent = magnitude * 100;
      const amount = points ? `${percent.toFixed(1)}%p` : `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;
      const up = metric.delta > 0;
      const verb = points ? (up ? "올라갔어요" : "내려갔어요") : (up ? "늘었어요" : "줄었어요");
      changes.push({ key: metric.key, direction: up ? "up" : "down", size, order, text: `${subject} ${overviewPrevLabel(days)}보다 ${amount} ${verb}` });
    });
    changes.sort((left, right) => right.size - left.size || left.order - right.order);
    const sentences = changes.slice(0, 3).map(({ key, direction, text }) => ({ key, direction, text }));
    if (sentences.length < 3 && flat > 0) sentences.push({ key: "flat", direction: null, text: `나머지 지표는 ${overviewPrevLabel(days)}${Number(days) === 1 ? "와" : "과"} 비슷해요` });
    if (!changes.length && !flat) sentences.push({ key: "no_compare", direction: null, text: `${overviewPrevLabel(days)}${Number(days) === 1 ? "와" : "과"} 비교할 기록이 아직 없어요` });
    if (sentences.length < 3 && options.has2x === false) sentences.push({ key: "no_2x", direction: null, text: "2.0 데이터는 아직 기다리는 중이에요" });
    return sentences.slice(0, 3);
  }

  // 2.0 첫 세션 퍼널 막대: 동의→튜토리얼→첫 런→첫 3D→P1 보스→다음 날. 막대 길이는 신규 대비, 사이 숫자는 앞 막대에서 빠진 비율.
  // '다음 날'은 분모가 다르다(P1 보스까지 간 어제 이전 설치). 그 단계 비율을 앞 막대 길이에 곱한다.
  const overviewFunnelPick = Object.freeze([["first_open", "동의"], ["tutorial_done", "튜토리얼"], ["first_run", "첫 런"], ["first_3d", "첫 3D"], ["p1_boss", "P1 보스"], ["next_day", "다음 날"]]);
  function overviewFunnelBars(steps) {
    const byKey = new Map((Array.isArray(steps) ? steps : []).map((step) => [step?.key, step]));
    const start = byKey.get("first_open");
    if (!start || !finite(start.reached) || start.reached <= 0) return [];
    const bars = [];
    for (const [key, label] of overviewFunnelPick) {
      const step = byKey.get(key);
      if (!step || !finite(step.reached)) continue;
      const previous = bars.at(-1);
      const share = key === "next_day"
        ? (previous && finite(previous.share) && finite(step.stepRate) ? previous.share * step.stepRate : null)
        : (finite(step.fromStart) ? step.fromStart : null);
      const drop = previous && finite(previous.share) && previous.share > 0 && finite(share) ? Math.max(0, 1 - share / previous.share) : null;
      bars.push({ key, label, step, share, drop });
    }
    return bars;
  }

  // 도달 페이즈 분포(설치 비율)와 그 페이즈 보스 승률. 둘 다 0~100%라 한 축을 나눠 쓴다.
  function overviewPhaseBars(phases, bosses, minPhases = 8) {
    const list = (Array.isArray(phases) ? phases : []).filter((row) => finite(row?.phase));
    const total = list.reduce((sum, row) => sum + (finite(row.installs) ? row.installs : 0), 0);
    if (total <= 0) return [];
    const fights = Array.isArray(bosses) ? bosses : [];
    const last = Math.max(minPhases, ...list.map((row) => row.phase));
    return Array.from({ length: last }, (_, index) => {
      const phase = index + 1;
      const installs = list.filter((row) => row.phase === phase).reduce((sum, row) => sum + (finite(row.installs) ? row.installs : 0), 0);
      const here = fights.filter((row) => row?.phase === phase);
      const attempts = here.reduce((sum, row) => sum + (finite(row.attempts) ? row.attempts : 0), 0);
      const clears = here.reduce((sum, row) => sum + (finite(row.clears) ? row.clears : 0), 0);
      return { phase, installs, share: installs / total, attempts, clears, winRate: attempts > 0 ? clears / attempts : null, bosses: here.map((row) => row.bossId) };
    });
  }

  // 복귀 곡선: D0은 정의상 100%. 대상(분모)이 없는 날은 0이 아니라 빈칸이다. 그릴 점이 하나도 없으면 빈 배열.
  function overviewRetentionCurve(row) {
    if (!row) return [];
    const points = [1, 7, 30].map((day) => {
      const cell = row[`d${day}`] || {};
      const eligible = finite(cell.eligible) ? cell.eligible : 0;
      return { day, rate: eligible > 0 && finite(cell.rate) ? cell.rate : null, retained: finite(cell.retained) ? cell.retained : 0, eligible };
    });
    if (!points.some((point) => finite(point.rate))) return [];
    return [{ day: 0, rate: 1, retained: null, eligible: null }, ...points];
  }

  // 축 눈금용 깔끔한 최댓값(1·2·2.5·5·10 단위).
  function overviewNiceMax(value) {
    if (!finite(value) || value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((unit) => unit * power >= value - 1e-9);
    return step * power;
  }

  return {
    normalizeOverviewFilters,
    formatOverviewValue,
    overviewNowLabel,
    overviewPrevLabel,
    overviewSlotParts,
    overviewSlotTitle,
    formatOverviewSeconds,
    overviewDelta,
    sparklineGeometry,
    sparkBars,
    overviewStatusLabel,
    overviewFlowName,
    overviewPlacementName,
    overviewErrorKindName,
    overviewBossName,
    overviewTipValue,
    overviewTipText,
    parseOverviewTip,
    overviewMetricTipRows,
    overviewSummarySentences,
    overviewFunnelBars,
    overviewPhaseBars,
    overviewRetentionCurve,
    overviewNiceMax,
    sampleRate, snapshotRank,
    tutorialStatus,
    routeFromHash,
    decodeJwtPayload,
    dedupePlayers,
    playerDisplayName,
    normalizePlayerNote,
    parsePlayerTags,
    playerNoteMarkup,
    playerIdentityMarkup,
    countryDisplay,
    platformDisplay,
    actionDisplayName,
    normalizeCustomAnalyticsRange,
    serializeAnalyticsFilters,
    playerDeepLink,
    safeConsoleReturnHash,
    buildAttentionItems,
    analyticsChoiceName,
    analyticsScreenName,
    labTutorialStageName,
    isHomeScreen,
    analyticsButtonName,
    interactionRecommendation,
    diffPlayerChanges,
    canSubmitMutation,
    catalogItemLabel,
    rewardKindLabel,
    mailSummaryText,
  };
});
