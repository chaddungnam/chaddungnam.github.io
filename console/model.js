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
    countryDisplay,
    actionDisplayName,
    serializeAnalyticsFilters,
    playerDeepLink,
    safeConsoleReturnHash,
    buildAttentionItems,
    diffPlayerChanges,
    canSubmitMutation,
  };
});
