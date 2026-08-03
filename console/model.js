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

  return { routeFromHash, dedupePlayers, playerDisplayName };
});
