const SUPABASE_URL = "https://bbgwvpwzkyudbtcgrbtm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6yAW6MvHsXS9xv8kzu2YKA_D23JWWQ4";
const ANALYTICS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/analytics-dashboard`;
const GOOGLE_CLIENT_ID = "557794340183-s188b070e7f543o5f9nm3pfi408ma4kh.apps.googleusercontent.com";
const GOOGLE_TOKEN_STORAGE_KEY = "quirky_ball_google_id_token";

const state = {
  payload: null,
  rangeDays: 28,
  loading: false,
  googleIdToken: window.sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY) ?? "",
  googleEmail: "",
};
const byId = (id) => document.getElementById(id);

function setText(id, value) { byId(id).textContent = value; }
function formatNumber(value) { return typeof value === "number" ? value.toLocaleString("ko-KR") : "—"; }
function formatRate(value) { return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—"; }
function formatDuration(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return remainder ? `${minutes}분 ${remainder}초` : `${minutes}분`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
}
function selectedDays() {
  return (state.payload?.daily ?? []).slice(-state.rangeDays);
}
function setMessage(message, error = false) {
  const element = byId("dashboardMessage");
  element.textContent = message;
  element.style.color = error ? "var(--coral)" : "";
}

async function readFunctionError(error) {
  const status = error?.status;
  if (status === 403) return "로그인은 되었지만 이 계정은 대시보드 권한이 없습니다.";
  if (status === 401) return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
  return `지표를 불러오지 못했습니다: ${error?.message ?? "알 수 없는 오류"}`;
}

async function loadDashboard() {
  if (state.loading) return;
  if (!state.googleIdToken) return;
  state.loading = true;
  setMessage("최근 28일 이벤트를 안전하게 집계하는 중...");
  try {
    const response = await fetch(ANALYTICS_FUNCTION_URL, {
      method: "POST",
      headers: {
        ["api" + "key"]: SUPABASE_PUBLISHABLE_KEY,
        ["Author" + "ization"]: "Bearer " + state.googleIdToken,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error ?? "analytics_request_failed");
      error.status = response.status;
      throw error;
    }
    state.payload = data;
    renderDashboard();
    const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "방금";
    setText("dataStatus", `${updated} 기준 · 최근 28일`);
    setMessage(data?.truncated ? "데이터가 많아 최근 100,000건까지만 표시했습니다." : "원본 이벤트는 브라우저로 내려오지 않고 서버에서 요약됩니다.");
  } catch (error) {
    const message = await readFunctionError(error);
    if (error?.status === 401 || error?.status === 403) {
      clearGoogleSession();
      setText("loginMessage", message);
    } else {
      setMessage(message, true);
    }
  } finally {
    state.loading = false;
  }
}

function renderDashboard() {
  const { summary, retention } = state.payload;
  setText("kpiActive", formatNumber(summary.activeInstallsToday));
  setText("kpiInstalls", formatNumber(summary.installs));
  setText("kpiSession", formatDuration(summary.avgSessionSeconds));
  setText("kpiGame", formatDuration(summary.avgGameSeconds));
  setText("kpiExit", formatRate(summary.exitRate));
  const d1 = retention?.find((item) => item.day === 1)?.rate;
  const d7 = retention?.find((item) => item.day === 7)?.rate;
  setText("kpiRetention", `${formatRate(d1)} / ${formatRate(d7)}`);
  setText("adTotal", `${formatNumber(summary.adImpressions)} 노출`);
  renderDailyChart();
  renderHourlyChart();
  renderFunnel();
  renderExitBreakdown();
  renderAds();
  renderDailyTable();
  renderInsight();
}

function renderDailyChart() {
  const canvas = byId("dailyChart");
  const rows = selectedDays();
  const width = canvas.clientWidth || 800;
  const height = 240;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = "10px system-ui, sans-serif";
  context.fillStyle = "#9da2b1";

  const values = rows.flatMap((row) => [row.activeInstalls, row.gameOvers]);
  const max = Math.max(1, ...values);
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 30;
  const chartHeight = height - top - bottom;
  const groupWidth = (width - left - right) / Math.max(1, rows.length);
  const barWidth = Math.max(2, Math.min(12, groupWidth * .28));

  context.strokeStyle = "#eee9df";
  context.lineWidth = 1;
  for (let line = 0; line <= 4; line += 1) {
    const y = top + chartHeight - (chartHeight * line / 4);
    context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
    context.fillText(Math.round(max * line / 4).toLocaleString("ko-KR"), 0, y - 4);
  }

  rows.forEach((row, index) => {
    const x = left + index * groupWidth + groupWidth / 2;
    const tealHeight = chartHeight * row.activeInstalls / max;
    const coralHeight = chartHeight * row.gameOvers / max;
    context.fillStyle = "#42bdb0";
    context.fillRect(x - barWidth - 1, top + chartHeight - tealHeight, barWidth, tealHeight);
    context.fillStyle = "#ee6f5e";
    context.fillRect(x + 1, top + chartHeight - coralHeight, barWidth, coralHeight);
    if (index % Math.max(1, Math.ceil(rows.length / 7)) === 0 || index === rows.length - 1) {
      context.fillStyle = "#9da2b1";
      context.textAlign = "center";
      context.fillText(row.day.slice(5), x, height - 9);
    }
  });
  context.textAlign = "start";
}

function renderHourlyChart() {
  const rows = state.payload?.hourly ?? [];
  const max = Math.max(1, ...rows.map((row) => row.sessions));
  byId("hourlyChart").innerHTML = rows.map((row) => `
    <div class="hour-column" title="${row.hour}시: ${formatNumber(row.sessions)} 세션">
      <span class="hour-value">${row.sessions || ""}</span>
      <div class="hour-fill" style="height:${Math.max(2, row.sessions / max * 165)}px"></div>
      <span class="hour-label">${String(row.hour).padStart(2, "0")}</span>
    </div>`).join("");
}

function renderFunnel() {
  const labels = { first_open: "첫 실행", session_start: "세션 시작", game_start: "게임 시작", game_over: "게임 완료", ad_impression: "광고 노출", stamina_blocked: "스태미나 부족" };
  const rows = state.payload?.funnel ?? [];
  const first = Math.max(1, rows[0]?.users ?? 0);
  byId("funnelChart").innerHTML = rows.map((row) => `
    <div class="funnel-row">
      <span class="funnel-label">${labels[row.event] ?? row.event}</span>
      <div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(2, row.users / first * 100)}%"></div></div>
      <span class="funnel-value">${formatNumber(row.users)}</span>
    </div>`).join("");
}

function renderExitBreakdown() {
  const summary = state.payload?.summary ?? {};
  const total = Math.max(1, summary.gamesStarted ?? 0);
  const items = [
    ["정상 게임 완료", summary.gameOvers, "normal"],
    ["게임 중 이탈", summary.midGameExits, "exit"],
    ["강제 종료로 미확인", summary.unobservedGames, "unobserved"],
  ];
  byId("exitBreakdown").innerHTML = items.map(([label, value, color]) => `
    <div class="metric-row">
      <div>
        <div class="metric-row-top"><span>${label}</span><strong>${formatNumber(value)}</strong></div>
        <div class="metric-track"><div class="metric-fill ${color}" style="width:${Math.min(100, (value ?? 0) / total * 100)}%"></div></div>
      </div>
    </div>`).join("");
}

function renderAds() {
  const rows = state.payload?.ads ?? [];
  byId("adsTable").innerHTML = rows.length === 0
    ? '<tr><td class="empty-row" colspan="5">아직 광고 이벤트가 없습니다.</td></tr>'
    : rows.map((row) => `<tr><td><strong>${escapeHtml(row.format)}</strong></td><td>${escapeHtml(row.placement)}</td><td>${formatNumber(row.started)}</td><td>${formatNumber(row.impressions)}</td><td>${formatNumber(row.rewards)}</td></tr>`).join("");
}

function renderDailyTable() {
  const rows = [...selectedDays()].reverse();
  byId("dailyTable").innerHTML = rows.length === 0
    ? '<tr><td class="empty-row" colspan="7">아직 이벤트가 없습니다.</td></tr>'
    : rows.map((row) => `<tr><td><strong>${escapeHtml(row.day)}</strong></td><td>${formatNumber(row.activeInstalls)}</td><td>${formatNumber(row.sessions)}</td><td>${formatNumber(row.gamesStarted)}</td><td>${formatNumber(row.gameOvers)}</td><td>${formatNumber(row.midGameExits + row.unobservedGames)}</td><td>${formatNumber(row.adImpressions)}</td></tr>`).join("");
}

function renderInsight() {
  const summary = state.payload?.summary ?? {};
  const hourly = state.payload?.hourly ?? [];
  const topHour = [...hourly].sort((left, right) => right.sessions - left.sessions)[0];
  const exitRate = summary.gamesStarted ? (summary.midGameExits + summary.unobservedGames) / summary.gamesStarted : null;
  const d1 = summary.retention?.find((item) => item.day === 1)?.rate;
  if (!summary.installs) {
    setText("insightText", "아직 수집된 이벤트가 없습니다. 테스트 빌드에서 약관 동의 후 게임을 실행하면 여기에 흐름이 나타납니다.");
    return;
  }
  const timeText = topHour ? `${String(topHour.hour).padStart(2, "0")}시–${String((topHour.hour + 1) % 24).padStart(2, "0")}시` : "—";
  setText("insightText", `가장 많이 시작하는 시간은 ${timeText}입니다. 게임 중 이탈률은 ${formatRate(exitRate)}, D1 유지율은 ${formatRate(d1)}입니다.`);
}

function decodeGoogleClaims(token) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch (_error) {
    return null;
  }
}

function switchView(email = "") {
  const signedIn = Boolean(state.googleIdToken && email);
  byId("loginPanel").hidden = signedIn;
  byId("dashboard").hidden = !signedIn;
  if (!signedIn) {
    setText("userEmail", "");
    setText("loginMessage", "");
    return;
  }
  state.googleEmail = email;
  setText("userEmail", email);
  loadDashboard();
}

function clearGoogleSession() {
  state.googleIdToken = "";
  state.googleEmail = "";
  window.sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
  window.google?.accounts?.id?.disableAutoSelect?.();
  switchView();
}

function handleGoogleCredential(response) {
  const claims = decodeGoogleClaims(response.credential);
  if (!claims?.email) {
    setText("loginMessage", "Google 계정 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
    return;
  }
  state.googleIdToken = response.credential;
  state.googleEmail = claims.email;
  window.sessionStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, response.credential);
  switchView(claims.email);
}

function waitForGoogleIdentity() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10_000;
    const check = () => {
      if (window.google?.accounts?.id) return resolve();
      if (Date.now() >= deadline) return reject(new Error("google_identity_script_timeout"));
      window.setTimeout(check, 50);
    };
    check();
  });
}

async function initializeGoogleLogin() {
  try {
    await waitForGoogleIdentity();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(byId("googleButton"), {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 360,
    });
  } catch (_error) {
    setText("loginMessage", "Google 로그인 버튼을 불러오지 못했습니다. 공개 주소에서 다시 열어 주세요.");
  }
  const claims = decodeGoogleClaims(state.googleIdToken);
  if (claims?.email && Number(claims.exp) * 1000 > Date.now()) {
    switchView(claims.email);
  } else if (state.googleIdToken) {
    clearGoogleSession();
  }
}

byId("logoutButton").addEventListener("click", clearGoogleSession);
byId("refreshButton").addEventListener("click", loadDashboard);
document.querySelectorAll(".range-button").forEach((button) => button.addEventListener("click", () => {
  state.rangeDays = Number(button.dataset.range);
  document.querySelectorAll(".range-button").forEach((item) => item.classList.toggle("active", item === button));
  if (state.payload) {
    renderDailyChart();
    renderDailyTable();
  }
}));

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { if (state.payload) renderDailyChart(); }, 120);
});

(async () => {
  await initializeGoogleLogin();
})();
