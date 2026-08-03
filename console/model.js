(function attachConsoleModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ConsoleModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createConsoleModel() {
  const pages = new Set(["analytics", "players", "operations", "purchases", "cs", "audit", "project-k"]);

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

  return {
    routeFromHash,
    decodeJwtPayload,
    dedupePlayers,
    playerDisplayName,
    serializeAnalyticsFilters,
    playerDeepLink,
    buildAttentionItems,
  };
});
