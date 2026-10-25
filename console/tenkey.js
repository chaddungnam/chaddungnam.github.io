// 10key Survival ("10KEY") project of the console: shared helpers, the admin call and the force-update page.
// Every call goes to the House Duck game server's tenkey-admin function (the console ticket + the admin allow list, see
// server docs docs/server/tenkey_server.md §15). The other 10KEY pages (tenkey-overview.js, tenkey-players.js,
// tenkey-crashes.js, tenkey-notices.js, tenkey-more.js) add their mount functions to window.ConsoleTenkey.
(function attachConsoleTenkey(root) {
  const byId = (id) => document.getElementById(id);
  const FORM_MESSAGE = "tenkeyConfigFormMessage";
  const PAGE_MESSAGE = "tenkeyConfigMessage";
  // One number per store since 2026-10-25 (owner: the two-number form with typed store links was too much): the minimum
  // build. It is sent as both min and latest, so the skippable "new version" prompt never shows on its own; the links are
  // the server's (Google Play; iOS = TestFlight until the hourly App Store lookup finds the game).
  const NUMBER_FIELDS = ["minVersionCode", "minBuildIos"];
  const STORES = [{ platform: "android", field: "minVersionCode", body: "tenkeyBuildsAndroid", name: "Android" },
    { platform: "ios", field: "minBuildIos", body: "tenkeyBuildsIos", name: "iOS" }];
  const ERROR_MESSAGES = {
    unknown_action: "서버에 10KEY 기능이 아직 배포되지 않았습니다.",
    invalid_number: "빌드 번호는 0 이상의 정수로 입력해 주세요 (0은 꺼짐).",
    min_above_latest_android: "Android 최소 versionCode는 최신 versionCode보다 클 수 없습니다.",
    min_above_latest_ios: "iOS 최소 빌드 번호는 최신 빌드 번호보다 클 수 없습니다.",
    invalid_store_url: "스토어 링크는 비우거나 https://로 시작해야 합니다.",
    reason_required: "변경 이유를 입력해 주세요.",
    invalid_knobs: "바꿀 밸런스 조정값이 없습니다.",
    invalid_knob_value: "밸런스 조정값은 0.70 ~ 1.30 사이의 숫자로 입력해 주세요.",
    invalid_request_id: "요청 번호를 만들지 못했습니다. 새로고침 후 다시 시도해 주세요.",
    invalid_title: "제목을 확인해 주세요 (한국어 1~80자).",
    invalid_body: "본문을 확인해 주세요 (한국어 1~2000자).",
    invalid_translations: "번역 글을 확인해 주세요 (언어마다 제목 1~300자, 본문 1~8000자).",
    notice_translation_unavailable: "자동 번역 서버가 응답하지 않았습니다. 쓴 글은 그대로 있으니 잠시 후 다시 눌러 주세요. 아직 발행하지 않았습니다.",
    invalid_priority: "우선순위는 -100에서 100 사이 정수여야 합니다.",
    invalid_starts_at: "게시 시작 시각을 확인해 주세요.",
    invalid_ends_at: "게시 종료는 시작보다 뒤여야 합니다.",
    invalid_notice: "공지 형식을 확인해 주세요.",
    not_found: "이미 삭제되었거나 없는 항목입니다. 목록을 새로고침해 주세요.",
    invalid_player_id: "플레이어 번호 형식이 맞지 않습니다.",
    invalid_banned: "정지 값 형식이 맞지 않습니다.",
    invalid_nickname: "새 닉네임을 입력해 주세요.",
    invalid_length: "닉네임은 2~10자여야 합니다.",
    invalid_chars: "닉네임에는 한글·영문·숫자만 쓸 수 있습니다.",
    banned_word: "쓸 수 없는 단어가 들어 있습니다.",
    taken: "다른 플레이어가 이미 쓰는 닉네임입니다.",
    same_name: "지금 닉네임과 같습니다.",
    no_account: "웹(CrazyGames) 플레이어의 이름은 CrazyGames에서 오므로 여기서 바꿀 수 없습니다.",
    invalid_range: "기간 값을 확인해 주세요.",
    invalid_platform: "플랫폼 값을 확인해 주세요.",
    invalid_query: "검색어는 100자 이하여야 합니다.",
    invalid_sort: "정렬 값을 확인해 주세요.",
    invalid_group: "묶는 기준을 확인해 주세요.",
    invalid_filter: "필터 값을 확인해 주세요.",
    invalid_board: "보드 이름을 확인해 주세요.",
    admin_session_required: "Google 로그인이 만료되어 서버가 요청을 거부했습니다. 아래 버튼으로 Google에 다시 로그인해 주세요.",
    admin_required: "이 Google 계정은 관리자 목록에 없습니다. 다른 관리자 계정으로 전환해 주세요.",
    origin_not_allowed: "허용되지 않은 주소에서 접속했습니다. houseduck.in에서 다시 열어 주세요.",
    admin_check_failed: "관리자 확인 서버에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    console_invalid_response: "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    console_request_failed: "요청을 처리하지 못했습니다.",
  };
  const state = { bound: false, config: null };
  const pendingRequests = new WeakMap();

  const errorText = (error) => {
    if (error?.message === "rpc_failed") return `서버가 요청을 거부했습니다: ${error.detail || "알 수 없는 오류"}`;
    return ERROR_MESSAGES[error?.message] || `요청을 처리하지 못했습니다: ${error?.message || "알 수 없는 오류"}`;
  };

  // ── small formatters shared by every 10KEY page ──
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[c]);
  const num = (value) => (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) ? "—" : Number(value).toLocaleString("ko-KR");
  const time = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  };
  const shortTime = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  };
  const dayText = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "—";
  };
  const duration = (ms) => {
    const sec = Math.round(Number(ms) / 1000);
    if (!Number.isFinite(sec) || sec < 0) return "—";
    return sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`;
  };
  const bytes = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
    return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
  };
  const pct = (part, whole) => (Number(whole) > 0 ? `${Math.round(Number(part) / Number(whole) * 1000) / 10}%` : "—");
  // The platform names the game sends (a run's platform, an install ping, a crash report): OS.get_name() lowercased for the
  // store apps and desktop builds, "web" for a web build with no portal, the portal builds by name. "mobile" = a guest
  // account the server cannot place (no stored run, no sign-in from the game's own HTTP client).
  const PLATFORM_NAMES = {
    android: "Android", ios: "iOS", windows: "Windows", macos: "Mac", linux: "Linux", steam: "Steam (PC)",
    web: "웹 (공통)", web_crazygames: "웹 · CrazyGames", crazygames: "웹 · CrazyGames", web_itch: "웹 · itch.io",
    mobile: "모름", supabase: "앱 계정",
  };
  const platformName = (value) => PLATFORM_NAMES[String(value || "").toLowerCase()] || String(value || "—");

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
    panel.className = "read-only-banner console-auth-recovery";
    root.ConsoleAuth.renderGoogleButton(panel, { text: "signin_with", size: "medium" });
    byId(id).insertAdjacentElement("afterend", panel);
  }

  // The server answers validation failures as HTTP 200 with data.ok === false: re-throw as an Error
  // whose message is the server code, so every caller has one catch path.
  function unwrap(result) {
    if (result?.data?.ok === false) throw new Error(result.data.error || "rpc_failed");
    return result;
  }
  // A write gets a fresh request_id, reused only when the exact same payload is retried from the
  // same form (network hiccup), so a retry never double-applies (a notice create is idempotent by it).
  async function call(action, params, formKey) {
    const body = { action, params };
    if (formKey) {
      const fingerprint = JSON.stringify({ action, params });
      const pending = pendingRequests.get(formKey);
      body.request_id = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
      pendingRequests.set(formKey, { fingerprint, requestId: body.request_id });
    }
    try {
      const result = unwrap(await root.ConsoleAPI.postProject("houseduck", "tenkey-admin", body));
      if (formKey) pendingRequests.delete(formKey);
      return result;
    } catch (error) {
      if (formKey && Number(error?.status) >= 400 && Number(error?.status) < 500) pendingRequests.delete(formKey);
      throw error;
    }
  }

  // A small dialog that asks for the reason a list action (end / delete) is audited with; resolves with the text or null.
  function askReason(title, body) {
    const dialog = byId("tenkeyReasonDialog");
    if (dialog.open) return Promise.resolve(null);
    const input = byId("tenkeyReasonInput");
    byId("tenkeyReasonTitle").textContent = title;
    byId("tenkeyReasonBody").textContent = body;
    input.value = "";
    dialog.returnValue = "cancel";
    dialog.showModal();
    return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm" ? input.value.trim() || null : null), { once: true }));
  }

  // Pagination used by every list: `loader(page)` fetches and renders, `render` shows "n / N".
  function pager(ids, pageSize, loader) {
    const st = { page: 1, total: 0 };
    const draw = () => {
      const last = Math.max(1, Math.ceil(st.total / pageSize));
      byId(ids.label).textContent = `${st.page} / ${last}`;
      byId(ids.prev).disabled = st.page <= 1;
      byId(ids.next).disabled = st.page >= last;
    };
    byId(ids.prev).addEventListener("click", () => { if (st.page > 1) { st.page -= 1; loader(st.page); } });
    byId(ids.next).addEventListener("click", () => { if (st.page * pageSize < st.total) { st.page += 1; loader(st.page); } });
    return { st, draw, reset() { st.page = 1; } };
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
    const reason = String(values.reason ?? "").trim();
    if (!reason) return { error: "reason_required" };
    return {
      reason,
      config: {
        min_version_code: n.minVersionCode, latest_version_code: n.minVersionCode,
        min_build_ios: n.minBuildIos, latest_build_ios: n.minBuildIos,
      },
    };
  }

  // Builds in use (config.get `builds`) that a minimum would block: an app below a minimum above 0.
  const blocked = (builds, platform, min) => (builds || []).filter((b) => b.platform === platform && min > 0 && Number(b.build) < min);
  const whoText = (b) => [b.installs ? `켠 기기 ${num(b.installs)}` : "", b.players ? `판 한 사람 ${num(b.players)}` : ""].filter(Boolean).join(" · ");

  function summary(config, reason) {
    const builds = state.config?.builds || [];
    const hit = [["Android", "android", config.min_version_code], ["iOS", "ios", config.min_build_ios]]
      .flatMap(([name, platform, min]) => blocked(builds, platform, min).map((b) => `${name} 빌드 ${b.build} (${whoText(b) || "기록 없음"})`));
    return [
      `Android 최소 빌드 ${config.min_version_code}${config.min_version_code ? "" : " (끔)"}`,
      `iOS 최소 빌드 ${config.min_build_ios}${config.min_build_ios ? "" : " (끔)"}`,
      `막히는 빌드: ${hit.length ? hit.join(", ") : "없음 (지금 쓰는 빌드 기준)"}`,
      `변경 이유: ${reason}`,
    ].join("\n");
  }

  // The builds in use per store, each marked with what the number in the box would do to it (redrawn as it is typed).
  function renderBuilds() {
    const fields = byId("tenkeyConfigForm").elements;
    const builds = state.config?.builds || [];
    for (const store of STORES) {
      const min = Number(fields[store.field].value) || 0;
      const rows = builds.filter((b) => b.platform === store.platform).map((b) => {
        const stop = min > 0 && Number(b.build) < min;
        return `<tr><td>빌드 ${esc(b.build)}</td><td class="tk-num">${esc(num(b.installs))}</td><td class="tk-num">${esc(num(b.players))}</td>
          <td><span class="tk-gate ${stop ? "is-blocked" : "is-open"}">${stop ? "막힘 · 업데이트 창" : "그대로 플레이"}</span></td></tr>`;
      });
      byId(store.body).innerHTML = rows.join("") || `<tr><td colspan="4">최근 기록이 없습니다.</td></tr>`;
    }
  }

  function renderLinks(config) {
    const links = config.links || {};
    const android = byId("tenkeyLinkAndroid");
    const ios = byId("tenkeyLinkIos");
    const androidUrl = links.android || config.store_url_android || "";
    const iosUrl = links.ios || config.store_url_ios || "";
    android.textContent = androidUrl ? "Google Play" : "없음";
    android.href = androidUrl || "#";
    android.title = androidUrl;
    ios.textContent = !iosUrl ? "없음" : links.ios_official ? "App Store" : /testflight\.apple\.com/.test(iosUrl) ? "TestFlight 공개 링크" : "App Store";
    ios.href = iosUrl || "#";
    ios.title = iosUrl;
    byId("tenkeyLinkIosNote").textContent = links.ios_official
      ? "App Store에 나온 것을 서버가 찾아 저절로 바꾼 링크입니다."
      : `App Store에 나오면 저절로 바뀝니다${links.ios_checked_at ? ` · 마지막 확인 ${time(links.ios_checked_at)} (아직 없음)` : ""}.`;
  }

  function fillForm(config) {
    const fields = byId("tenkeyConfigForm").elements;
    fields.minVersionCode.value = config.min_version_code ?? 0;
    fields.minBuildIos.value = config.min_build_ios ?? 0;
    renderLinks(config);
    renderBuilds();
  }

  async function loadConfig() {
    setMessage(PAGE_MESSAGE, "10KEY 설정을 불러오는 중입니다...");
    try {
      state.config = (await call("config.get", {})).data || {};
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
      if (!await root.ConsoleApp.confirmChange("10KEY 강제 업데이트 변경", summary(config, reason))) return;
      setMessage(FORM_MESSAGE, "저장하는 중입니다...");
      const result = await call("config.set", { config, reason }, form);
      state.config = result.data?.config || { ...state.config, ...config };
      fillForm(state.config);
      form.elements.reason.value = "";
      setMessage(FORM_MESSAGE, "");
      setMessage(PAGE_MESSAGE, "강제 업데이트 번호를 저장했습니다. 다음에 앱을 켤 때부터 적용됩니다.");
    } catch (error) {
      report(FORM_MESSAGE, error);
    } finally {
      finishRequest();
    }
  }

  function mountConfig() {
    if (!state.bound) {
      state.bound = true;
      const form = byId("tenkeyConfigForm");
      form.addEventListener("submit", submitConfig);
      form.addEventListener("input", (event) => { if (NUMBER_FIELDS.includes(event.target?.name)) renderBuilds(); });
    }
    loadConfig();
  }

  root.ConsoleTenkey = {
    mountConfig, validate,
    call, report, setMessage, errorText, pager, askReason,
    fmt: { esc, num, time, shortTime, dayText, duration, bytes, pct, platformName },
  };
})(window);
