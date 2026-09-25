(function attachConsoleApi(root) {
  const allowedFunctions = new Set(["analytics-dashboard", "analytics-dashboard-v2", "admin-console", "cs-summarize"]);
  let functionBaseUrl = "";
  // Additional per-project clients (e.g. HEXAWORLD) — separate base URL + publishable key,
  // never mixed into the Quirky Ball client above so its requests stay byte-for-byte unchanged.
  const projects = new Map();

  function initialize(options) {
    functionBaseUrl = String(options?.functionBaseUrl || "").replace(/\/$/, "");
  }

  function initializeProject(projectKey, options) {
    projects.set(String(projectKey), {
      functionBaseUrl: String(options?.functionBaseUrl || "").replace(/\/$/, ""),
      publishableKey: String(options?.publishableKey || ""),
      allowedFunctions: new Set(options?.allowedFunctions || []),
    });
  }

  async function post(functionName, body) {
    if (!allowedFunctions.has(functionName) || !functionBaseUrl) throw new Error("invalid_console_endpoint");
    const response = await fetch(`${functionBaseUrl}/${functionName}`, {
      method: "POST",
      headers: root.ConsoleAuth.headers(),
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(String(body?.action || "").startsWith("announcements.") ? 120_000 : 45_000),
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401) root.ConsoleAuth.logout();
    if (response.status === 403 && payload?.error === "admin_session_required") root.ConsoleAuth.requireChallenge();
    if (!response.ok) throw Object.assign(new Error(payload?.error || "console_request_failed"), { status: response.status });
    if (!payload || typeof payload !== "object") throw new Error("console_invalid_response");
    return payload;
  }

  // Separate from post(): a different project may need admin_session_required handled without
  // wiping the Quirky Ball ticket (see console/hexaworld.js), so this never calls requireChallenge.
  async function postProject(projectKey, functionName, body) {
    const project = projects.get(String(projectKey));
    if (!project || !project.allowedFunctions.has(functionName) || !project.functionBaseUrl) throw new Error("invalid_console_endpoint");
    const headers = { ...root.ConsoleAuth.headers(), ["api" + "key"]: project.publishableKey };
    const response = await fetch(`${project.functionBaseUrl}/${functionName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401) root.ConsoleAuth.logout();
    if (!response.ok) throw Object.assign(new Error(payload?.error || "console_request_failed"), { status: response.status, detail: payload?.detail });
    if (!payload || typeof payload !== "object") throw new Error("console_invalid_response");
    return payload;
  }

  root.ConsoleAPI = { initialize, initializeProject, post, postProject };
})(window);
