(function attachConsoleAuth(root) {
  const GOOGLE_TOKEN_KEY = "house_duck_console_google_id_token";
  const ADMIN_TICKET_KEY = "house_duck_console_admin_ticket";
  const TICKET_EXPIRY_KEY = "house_duck_console_ticket_expires_at";
  let config = {};
  let googleIdToken = root.sessionStorage.getItem(GOOGLE_TOKEN_KEY) || "";
  let adminTicket = root.sessionStorage.getItem(ADMIN_TICKET_KEY) || "";
  let ticketExpiresAt = Number(root.sessionStorage.getItem(TICKET_EXPIRY_KEY) || 0);
  let email = "";

  function hasValidGoogleIdentity() {
    const claims = root.ConsoleModel.decodeJwtPayload(googleIdToken);
    if (!claims?.email || Number(claims.exp) * 1_000 <= Date.now()) return false;
    email = claims.email;
    return true;
  }

  function isUnlocked() {
    return hasValidGoogleIdentity() && Boolean(adminTicket) && ticketExpiresAt > Date.now();
  }

  function snapshot() {
    return {
      signedIn: hasValidGoogleIdentity(),
      unlocked: isUnlocked(),
      email,
    };
  }

  function notify() {
    root.dispatchEvent(new CustomEvent("console-auth-change", { detail: snapshot() }));
  }

  function clearTicket() {
    adminTicket = "";
    ticketExpiresAt = 0;
    root.sessionStorage.removeItem(ADMIN_TICKET_KEY);
    root.sessionStorage.removeItem(TICKET_EXPIRY_KEY);
  }

  function handleGoogleCredential(response) {
    googleIdToken = typeof response?.credential === "string" ? response.credential : "";
    if (!hasValidGoogleIdentity()) {
      googleIdToken = "";
      root.sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
      notify();
      return;
    }
    clearTicket();
    root.sessionStorage.setItem(GOOGLE_TOKEN_KEY, googleIdToken);
    notify();
  }

  function waitForGoogleIdentity() {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10_000;
      const check = () => {
        if (root.google?.accounts?.id) return resolve();
        if (Date.now() >= deadline) return reject(new Error("google_identity_script_timeout"));
        root.setTimeout(check, 50);
      };
      check();
    });
  }

  async function initialize(options) {
    config = { ...options };
    if (!hasValidGoogleIdentity()) {
      googleIdToken = "";
      clearTicket();
      root.sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
    } else if (ticketExpiresAt <= Date.now()) {
      clearTicket();
    }

    await waitForGoogleIdentity();
    root.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    root.google.accounts.id.renderButton(document.getElementById("googleButton"), {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 360,
    });
    return snapshot();
  }

  async function unlock(answer) {
    if (!hasValidGoogleIdentity()) throw Object.assign(new Error("invalid_google_identity"), { status: 401 });
    const response = await fetch(config.authUrl, {
      method: "POST",
      headers: {
        ["api" + "key"]: config.publishableKey,
        ["Author" + "ization"]: `Bearer ${googleIdToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.adminTicket !== "string") {
      throw Object.assign(new Error(body.error || "admin_auth_failed"), { status: response.status });
    }
    adminTicket = body.adminTicket;
    ticketExpiresAt = Date.now() + Number(body.expiresIn || 0) * 1_000;
    email = body.email || email;
    root.sessionStorage.setItem(ADMIN_TICKET_KEY, adminTicket);
    root.sessionStorage.setItem(TICKET_EXPIRY_KEY, String(ticketExpiresAt));
    notify();
    return snapshot();
  }

  function headers() {
    return {
      ["api" + "key"]: config.publishableKey,
      ["Author" + "ization"]: `Bearer ${googleIdToken}`,
      "X-Admin-Session": adminTicket,
      "Content-Type": "application/json",
    };
  }

  function requireChallenge() {
    clearTicket();
    notify();
  }

  function logout() {
    const revokeEmail = email;
    root.GmailAPI?.disconnect?.();
    googleIdToken = "";
    email = "";
    clearTicket();
    root.sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
    root.google?.accounts?.id?.disableAutoSelect?.();
    if (revokeEmail) root.google?.accounts?.id?.revoke?.(revokeEmail, () => {});
    notify();
  }

  root.ConsoleAuth = { initialize, unlock, headers, isUnlocked, snapshot, requireChallenge, logout };
})(window);
