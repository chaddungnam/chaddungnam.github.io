(function attachConsoleApi(root) {
  const allowedFunctions = new Set(["analytics-dashboard", "admin-console"]);
  let functionBaseUrl = "";

  function initialize(options) {
    functionBaseUrl = String(options?.functionBaseUrl || "").replace(/\/$/, "");
  }

  async function post(functionName, body) {
    if (!allowedFunctions.has(functionName) || !functionBaseUrl) throw new Error("invalid_console_endpoint");
    const response = await fetch(`${functionBaseUrl}/${functionName}`, {
      method: "POST",
      headers: root.ConsoleAuth.headers(),
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) root.ConsoleAuth.logout();
    if (response.status === 403 && payload.error === "admin_session_required") root.ConsoleAuth.requireChallenge();
    if (!response.ok) throw Object.assign(new Error(payload.error || "console_request_failed"), { status: response.status });
    return payload;
  }

  root.ConsoleAPI = { initialize, post };
})(window);
