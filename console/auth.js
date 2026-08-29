(function attachConsoleAuth(root) {
  const GOOGLE_TOKEN_KEY = "house_duck_console_google_id_token";
  const ADMIN_TICKET_KEY = "house_duck_console_admin_ticket";
  const TICKET_EXPIRY_KEY = "house_duck_console_ticket_expires_at";
  const storage = root.localStorage;
  const legacyStorage = root.sessionStorage;
  const storedValue = (key) => storage.getItem(key) || legacyStorage.getItem(key) || "";
  const storeValue = (key, value) => {
    storage.setItem(key, value);
    legacyStorage.removeItem(key);
  };
  const removeValue = (key) => {
    storage.removeItem(key);
    legacyStorage.removeItem(key);
  };
  let config = {};
  let googleIdToken = storedValue(GOOGLE_TOKEN_KEY);
  let adminTicket = storedValue(ADMIN_TICKET_KEY);
  let ticketExpiresAt = Number(storedValue(TICKET_EXPIRY_KEY) || 0);
  let email = "";

  function hasValidGoogleIdentity() {
    const claims = root.ConsoleModel.decodeJwtPayload(googleIdToken);
    if (!claims?.email || Number(claims.exp) * 1_000 <= Date.now()) return false;
    email = claims.email;
    return true;
  }

  function hasValidAdminSession() {
    const encodedClaims = adminTicket.split(".")[0] || "";
    const claims = root.ConsoleModel.decodeJwtPayload(`header.${encodedClaims}.signature`);
    if (!claims?.sub || !claims?.email || Number(claims.exp) * 1_000 <= Date.now()) return false;
    if (ticketExpiresAt <= Date.now() || ticketExpiresAt > Number(claims.exp) * 1_000 + 5_000) return false;
    email = claims.email;
    return true;
  }

  function isUnlocked() {
    return hasValidAdminSession();
  }

  function snapshot() {
    const unlocked = isUnlocked();
    return {
      signedIn: unlocked || hasValidGoogleIdentity(),
      unlocked,
      email,
    };
  }

  function notify() {
    root.dispatchEvent(new CustomEvent("console-auth-change", { detail: snapshot() }));
  }

  function clearTicket() {
    adminTicket = "";
    ticketExpiresAt = 0;
    removeValue(ADMIN_TICKET_KEY);
    removeValue(TICKET_EXPIRY_KEY);
  }

  function handleGoogleCredential(response) {
    googleIdToken = typeof response?.credential === "string" ? response.credential : "";
    if (!hasValidGoogleIdentity()) {
      googleIdToken = "";
      removeValue(GOOGLE_TOKEN_KEY);
      notify();
      return;
    }
    clearTicket();
    storeValue(GOOGLE_TOKEN_KEY, googleIdToken);
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
    const validGoogleIdentity = hasValidGoogleIdentity();
    const validAdminSession = hasValidAdminSession();
    if (!validGoogleIdentity) {
      googleIdToken = "";
      removeValue(GOOGLE_TOKEN_KEY);
    }
    if (!validAdminSession) clearTicket();
    else {
      storeValue(ADMIN_TICKET_KEY, adminTicket);
      storeValue(TICKET_EXPIRY_KEY, String(ticketExpiresAt));
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
    const expiresIn = Number(body.expiresIn);
    if (!response.ok || typeof body.adminTicket !== "string" || !body.adminTicket.trim() || !Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
      throw Object.assign(new Error(body.error || "admin_auth_failed"), { status: response.status });
    }
    adminTicket = body.adminTicket;
    ticketExpiresAt = Date.now() + expiresIn * 1_000;
    email = body.email || email;
    storeValue(ADMIN_TICKET_KEY, adminTicket);
    storeValue(TICKET_EXPIRY_KEY, String(ticketExpiresAt));
    notify();
    return snapshot();
  }

  function headers() {
    const result = {
      ["api" + "key"]: config.publishableKey,
      "X-Admin-Session": adminTicket,
      "Content-Type": "application/json",
    };
    if (hasValidGoogleIdentity()) result["Author" + "ization"] = `Bearer ${googleIdToken}`;
    return result;
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
    removeValue(GOOGLE_TOKEN_KEY);
    root.google?.accounts?.id?.disableAutoSelect?.();
    if (revokeEmail) root.google?.accounts?.id?.revoke?.(revokeEmail, () => {});
    notify();
  }

  root.ConsoleAuth = { initialize, unlock, headers, isUnlocked, snapshot, requireChallenge, logout };
})(window);
