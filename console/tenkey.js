// 10KEY (10key Survival) force-update settings. Same Supabase project and hx-admin function as
// Comrade, so the Comrade project client ("hexaworld") is reused; only the actions differ.
(function attachConsoleTenkey(root) {
  const byId = (id) => document.getElementById(id);
  const FORM_MESSAGE = "tenkeyConfigFormMessage";
  const PAGE_MESSAGE = "tenkeyConfigMessage";
  const NUMBER_FIELDS = ["minVersionCode", "latestVersionCode", "minBuildIos", "latestBuildIos"];
  const ERROR_MESSAGES = {
    unknown_action: "서버에 10KEY 설정이 아직 배포되지 않았습니다.",
    invalid_number: "번호는 0 이상의 정수로 입력해 주세요 (0은 꺼짐).",
    min_above_latest_android: "Android 최소 versionCode는 최신 versionCode보다 클 수 없습니다.",
    min_above_latest_ios: "iOS 최소 빌드 번호는 최신 빌드 번호보다 클 수 없습니다.",
    invalid_store_url: "스토어 링크는 비우거나 https://로 시작해야 합니다.",
    ios_store_url_required: "iOS 번호를 0보다 크게 하려면 App Store 링크가 필요합니다.",
    reason_required: "변경 이유를 입력해 주세요.",
    admin_session_required: "Google 로그인이 만료되어 서버가 요청을 거부했습니다. 아래 버튼으로 Google에 다시 로그인해 주세요.",
    admin_required: "이 Google 계정은 관리자 목록에 없습니다. 다른 관리자 계정으로 전환해 주세요.",
    origin_not_allowed: "허용되지 않은 주소에서 접속했습니다. houseduck.in에서 다시 열어 주세요.",
    admin_check_failed: "관리자 확인 서버에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    console_invalid_response: "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    console_request_failed: "요청을 처리하지 못했습니다.",
  };
  const state = { bound: false, config: null };
  const pendingRequests = new WeakMap();

  const errorText = (error) => ERROR_MESSAGES[error?.message] || `요청을 처리하지 못했습니다: ${error?.message || "알 수 없는 오류"}`;

  function setMessage(id, value, error = false) {
    const el = byId(id);
    root.ConsoleUiState.setMessage(el, value, error);
    el.style.color = error ? "var(--coral)" : "";
    const stray = el.nextElementSibling;
    if (stray?.dataset?.tenkeyAuthRecovery === "true") stray.remove();
  }

  // 403: offer the Google sign-in button inline, so the admin keeps the other projects' sessions.
  function report(id, error) {
    setMessage(id, errorText(error), true);
    if (error?.status !== 403 || !["admin_session_required", "admin_required"].includes(error.message)) return;
    const panel = document.createElement("div");
    panel.dataset.tenkeyAuthRecovery = "true";
    panel.className = "read-only-banner hexaworld-auth-recovery";
    root.ConsoleAuth.renderGoogleButton(panel, { text: "signin_with", size: "medium" });
    byId(id).insertAdjacentElement("afterend", panel);
  }

  // hx-admin answers validation failures as HTTP 200 with data.ok === false: re-throw as an Error
  // whose message is the server code, so every caller has one catch path.
  function unwrap(result) {
    if (result?.data?.ok === false) throw new Error(result.data.error || "rpc_failed");
    return result;
  }
  // A write gets a fresh request_id, reused only when the exact same payload is retried from the
  // same form (network hiccup), so a retry never double-applies. Same rule as Comrade's callHxWrite.
  async function call(action, params, formKey) {
    const body = { action, params };
    if (formKey) {
      const fingerprint = JSON.stringify({ action, params });
      const pending = pendingRequests.get(formKey);
      body.request_id = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
      pendingRequests.set(formKey, { fingerprint, requestId: body.request_id });
    }
    try {
      const result = unwrap(await root.ConsoleAPI.postProject("hexaworld", "hx-admin", body));
      if (formKey) pendingRequests.delete(formKey);
      return result;
    } catch (error) {
      if (formKey && Number(error?.status) >= 400 && Number(error?.status) < 500) pendingRequests.delete(formKey);
      throw error;
    }
  }

  // Form values -> {config, reason}, or {error: <server error code>}. Mirrors the server checks so
  // the admin gets the message before the confirm dialog; the server stays the final judge.
  function validate(values) {
    const n = {};
    for (const key of NUMBER_FIELDS) {
      const text = String(values[key] ?? "").trim();
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) return { error: "invalid_number" };
      n[key] = Number(text);
    }
    if (n.minVersionCode > n.latestVersionCode) return { error: "min_above_latest_android" };
    if (n.minBuildIos > n.latestBuildIos) return { error: "min_above_latest_ios" };
    const android = String(values.storeUrlAndroid ?? "").trim();
    const ios = String(values.storeUrlIos ?? "").trim();
    if ([android, ios].some((url) => url && !/^https:\/\/\S+$/.test(url))) return { error: "invalid_store_url" };
    if ((n.minBuildIos > 0 || n.latestBuildIos > 0) && !ios) return { error: "ios_store_url_required" };
    const reason = String(values.reason ?? "").trim();
    if (!reason) return { error: "reason_required" };
    return {
      reason,
      config: {
        min_version_code: n.minVersionCode, latest_version_code: n.latestVersionCode,
        min_build_ios: n.minBuildIos, latest_build_ios: n.latestBuildIos,
        store_url_android: android, store_url_ios: ios,
      },
    };
  }

  function summary(config, reason) {
    return [
      `Android 최소 ${config.min_version_code} · 최신 ${config.latest_version_code}`,
      `iOS 최소 빌드 ${config.min_build_ios} · 최신 ${config.latest_build_ios}`,
      `Google Play 링크: ${config.store_url_android || "(없음)"}`,
      `App Store 링크: ${config.store_url_ios || "(없음)"}`,
      `변경 이유: ${reason}`,
    ].join("\n");
  }

  function fillForm(config) {
    const fields = byId("tenkeyConfigForm").elements;
    fields.minVersionCode.value = config.min_version_code ?? 0;
    fields.latestVersionCode.value = config.latest_version_code ?? 0;
    fields.minBuildIos.value = config.min_build_ios ?? 0;
    fields.latestBuildIos.value = config.latest_build_ios ?? 0;
    fields.storeUrlAndroid.value = config.store_url_android || "";
    fields.storeUrlIos.value = config.store_url_ios || "";
  }

  async function loadConfig() {
    setMessage(PAGE_MESSAGE, "10KEY 설정을 불러오는 중입니다...");
    try {
      state.config = (await call("tenkey.config_get", {})).data || {};
      fillForm(state.config);
      const saved = state.config.updated_at ? new Date(state.config.updated_at) : null;
      const savedText = saved && !Number.isNaN(saved.getTime()) ? ` 마지막 저장: ${saved.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}` : "";
      setMessage(PAGE_MESSAGE, `서버에 저장된 현재 값입니다.${savedText}`);
    } catch (error) {
      report(PAGE_MESSAGE, error);
    }
  }

  async function submitConfig(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    try {
      if (!form.reportValidity()) return;
      const checked = validate(Object.fromEntries(new FormData(form)));
      if (checked.error) {
        setMessage(FORM_MESSAGE, errorText({ message: checked.error }), true);
        return;
      }
      const { config, reason } = checked;
      if (!await root.ConsoleApp.confirmChange("10KEY 앱 설정 변경", summary(config, reason))) return;
      setMessage(FORM_MESSAGE, "저장하는 중입니다...");
      const result = await call("tenkey.config_set", { config, reason }, form);
      state.config = result.data?.config || config;
      fillForm(state.config);
      form.elements.reason.value = "";
      setMessage(FORM_MESSAGE, "");
      setMessage(PAGE_MESSAGE, "10KEY 앱 설정을 저장했습니다.");
    } catch (error) {
      report(FORM_MESSAGE, error);
    } finally {
      finishRequest();
    }
  }

  function mountConfig() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyConfigForm").addEventListener("submit", submitConfig);
    }
    loadConfig();
  }

  root.ConsoleTenkey = { mountConfig, validate };
})(window);
