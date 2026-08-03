(function attachConsoleAnalytics(root) {
const state = {
  payload: null,
  rangeDays: 7,
  distributionKey: "all",
  playerQuery: "",
  playerSort: "latest_played_at",
  playerDirection: "desc",
  playerPage: 1,
  loading: false,
  mounted: false,
};
const byId = (id) => document.getElementById(id);

function setText(id, value) { byId(id).textContent = value; }
function formatNumber(value) { return typeof value === "number" ? value.toLocaleString("ko-KR") : "—"; }
function formatRate(value) { return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—"; }
function formatDecimal(value, digits = 1) { return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function formatCurrency(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
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

function setFiltersDisabled(disabled) {
  document.querySelectorAll(".analytics-toolbar button, .period-players-panel button, .period-players-panel input").forEach((control) => {
    control.disabled = disabled;
  });
  if (!disabled) {
    const totalPages = Math.max(1, Math.ceil(Number(state.payload?.periodPlayerTotal ?? 0) / 50));
    byId("periodPrevious").disabled = !state.payload || state.playerPage <= 1;
    byId("periodNext").disabled = !state.payload || state.playerPage >= totalPages;
  }
}

function readFunctionError(error) {
  if (error?.status === 403) return "추가 관리자 확인이 필요합니다.";
  if (error?.status === 401) return "Google 로그인이 만료되었습니다. 다시 로그인해 주세요.";
  return `지표를 불러오지 못했습니다: ${error?.message ?? "알 수 없는 오류"}`;
}

async function loadDashboard() {
  if (state.loading) return;
  if (!root.ConsoleAuth.isUnlocked()) {
    root.ConsoleAuth.requireChallenge();
    return;
  }
  state.loading = true;
  setFiltersDisabled(true);
  setMessage(`Quirky Ball · 최근 ${state.rangeDays}일 이벤트와 플레이 계정을 집계하는 중...`);
  try {
    const data = await root.ConsoleAPI.post("analytics-dashboard", {
      projectKey: "quirky_ball",
      distributionKey: state.distributionKey,
      rangeDays: state.rangeDays,
      playerQuery: state.playerQuery,
      playerSort: state.playerSort,
      playerDirection: state.playerDirection,
      playerPage: state.playerPage,
    });
    state.payload = data;
    renderDashboard();
    const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "방금";
    setText("dataStatus", `${updated} 기준 · 독일 시간 · ${data.rangeDays ?? state.rangeDays}일 · ${distributionLabel(state.distributionKey)}`);
    setMessage(data?.truncated ? "데이터가 많아 최근 100,000건까지만 표시했습니다." : "원본 이벤트는 브라우저로 내려오지 않고 서버에서 요약됩니다.");
  } catch (error) {
    setMessage(readFunctionError(error), true);
  } finally {
    state.loading = false;
    setFiltersDisabled(false);
  }
}

function renderDashboard() {
  const { summary, retention } = state.payload;
  const pulseModel = window.PulseModel.buildPulseModel(state.payload);
  setText("kpiActive", formatNumber(summary.activeInstallsToday));
  setText("kpiSession", formatDuration(summary.avgSessionSeconds));
  const d7 = retention?.find((item) => item.day === 7)?.rate;
  setText("metricD7", formatRate(d7));
  const adEconomics = state.payload?.adEconomics ?? {};
  setText("kpiRevenue", formatCurrency(adEconomics.estimatedRevenueEur));
  setText("adTotal", `${formatNumber(summary.adImpressions)} 노출 · 테스트 ${formatNumber(adEconomics.testImpressions)}`);
  renderPulseOverview(pulseModel);
  renderPlatformSummary(state.payload?.platforms ?? []);
  renderDailyChart();
  renderHourlyChart();
  renderFunnel();
  renderExitBreakdown();
  renderAds();
  renderAttention(pulseModel);
  renderPeriodPlayers();
  renderDailyTable();
  renderInsight();
}

function formatServerTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function renderAttention(pulseModel) {
  const items = root.ConsoleModel.buildAttentionItems(pulseModel);
  byId("attentionList").innerHTML = items.length === 0
    ? "<p>현재 Pulse 경고가 없습니다.</p>"
    : items.map((item) => `<div class="attention-item" data-severity="${escapeHtml(item.severity)}"><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.source)}</small></div>`).join("");
}

function renderPeriodPlayers() {
  const rows = root.ConsoleModel.dedupePlayers(state.payload?.periodPlayers ?? []);
  const total = Number(state.payload?.periodPlayerTotal ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / 50));
  setText("periodPlayerTotal", `${formatNumber(total)}명`);
  setText("periodPage", `${state.playerPage} / ${totalPages}`);
  byId("periodPrevious").disabled = state.playerPage <= 1;
  byId("periodNext").disabled = state.playerPage >= totalPages;
  byId("periodPlayersTable").innerHTML = rows.length === 0
    ? '<tr><td class="empty-row" colspan="9">이 기간에 조건과 일치하는 플레이 기록 계정이 없습니다.</td></tr>'
    : rows.map((row) => `<tr>
        <td><strong>${escapeHtml(root.ConsoleModel.playerDisplayName(row))}</strong><small>${escapeHtml(row.accountType)}</small></td>
        <td>${escapeHtml(row.country)}</td>
        <td>${formatNumber(row.gamesPlayed)}</td>
        <td>${formatNumber(row.bestScore)}<small>Lv.${formatNumber(row.bestLevel)}</small></td>
        <td>${formatNumber(row.gems)}</td>
        <td>${formatNumber(row.stamina)}</td>
        <td>${formatNumber(row.breakthroughTickets)} · ${formatNumber(row.speedBoostTickets)}</td>
        <td>${escapeHtml(formatServerTime(row.latestPlayedAt))}</td>
        <td><a class="player-open-link" href="${root.ConsoleModel.playerDeepLink(row.userId, root.location.hash)}">바로 처리</a></td>
      </tr>`).join("");
}

function distributionLabel(value) {
  return ({ all: "전체 스토어", google_play: "Google Play", app_store: "iOS", onestore: "원스토어", unknown: "스토어 미지정" })[value] ?? value ?? "전체 스토어";
}

function metricProgress(value, target) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value / target * 100)) : 0;
}

function renderQuestionMetric(key, metric, formattedValue, progress) {
  const card = byId(`metric${key}Card`);
  card.dataset.status = metric.status;
  setText(`metric${key}`, formattedValue);
  setText(`metric${key}Status`, metric.statusLabel);
  byId(`metric${key}Bar`).style.width = `${progress}%`;
}

function renderJourney(journey = []) {
  const icons = { session_start: "↗", game_start: "▶", game_over: "✓", ad_impression: "AD" };
  byId("journeyGraph").innerHTML = journey.map((step, index) => {
    const connector = index === 0 ? "" : `
      <div class="journey-link" style="--journey-progress:${Math.min(100, Math.max(0, (step.rate ?? 0) * 100))}%">
        <div><i style="width:${Math.min(100, Math.max(4, (step.rate ?? 0) * 100))}%"></i></div>
        <small>${step.rate == null ? "연결 없음" : `이전 수 대비 ${formatRate(step.rate)}`}</small>
      </div>`;
    return `${connector}
      <div class="journey-step">
        <div class="journey-bubble"><strong>${formatNumber(step.users)}</strong><small>${icons[step.event] ?? "명"}</small></div>
        <strong>${escapeHtml(step.label)}</strong>
        <small>${escapeHtml(step.description)}</small>
      </div>`;
  }).join("");
}

function renderPulseOverview(model) {
  const card = byId("healthCard");
  card.dataset.status = model.verdict.status;
  setText("healthLabel", model.verdict.label);
  setText("healthScore", model.verdict.score == null ? (model.verdict.status === "insufficient" ? "수집 중" : "카드 기준") : `${model.verdict.score}/100`);
  setText("mascotMessage", model.verdict.summary);
  setText("todayAction", model.action);
  byId("signalLights").querySelectorAll("[data-signal]").forEach((signal) => {
    const active = signal.dataset.signal === model.verdict.status;
    signal.classList.toggle("active", active);
    signal.setAttribute("aria-current", active ? "true" : "false");
  });
  renderQuestionMetric("Duration", model.metrics.duration, formatDuration(model.metrics.duration.value), metricProgress(model.metrics.duration.value, 180));
  renderQuestionMetric("Completion", model.metrics.completion, formatRate(model.metrics.completion.value), metricProgress(model.metrics.completion.value, 0.65));
  renderQuestionMetric("Retention", model.metrics.retention, formatRate(model.metrics.retention.value), metricProgress(model.metrics.retention.value, 0.2));
  renderQuestionMetric("Ads", model.metrics.ads, model.metrics.ads.value == null ? "—" : `${formatDecimal(model.metrics.ads.value)}회`, metricProgress(model.metrics.ads.value, 5));
  renderJourney(model.journey);
}

function renderPlatformSummary(platforms) {
  const economics = state.payload?.adEconomics ?? {};
  setText("revenueNote", economics.estimatedRevenueEur == null ? "스토어별 eCPM 단가를 입력하면 수익 추정이 더 정확해집니다." : `테스트 광고 제외 · 초기 단가 가정 ${formatCurrency(economics.estimatedRevenueEur)}`);
  const element = byId("platformSummary");
  if (!platforms.length) {
    element.innerHTML = '<p class="empty-panel">아직 비교할 광고 데이터가 없습니다.</p>';
    return;
  }
  element.innerHTML = platforms.map((row) => `
    <div class="platform-row">
      <div class="platform-name"><strong>${escapeHtml(distributionLabel(row.distributionKey))}</strong><small>${escapeHtml(row.platform || "플랫폼 미지정")}</small></div>
      <div><span>플레이어</span><strong>${formatNumber(row.activePlayers)}</strong></div>
      <div><span>광고/플레이어</span><strong>${formatDecimal(row.impressionsPerPlayer)}</strong></div>
      <div><span>예상 수익</span><strong>${formatCurrency(row.estimatedRevenueEur)}</strong></div>
    </div>`).join("");
}

function renderDailyChart() {
  const canvas = byId("dailyChart");
  const rows = selectedDays();
  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 154;
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
  const labels = { first_open: "첫 실행", session_start: "세션 시작", game_start: "게임 시작", game_over: "게임 완료", game_exit: "중간 종료", fullscreen_ad_impression: "전체화면 광고", ad_impression: "전체 광고 노출" };
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
    ? '<tr><td class="empty-row" colspan="8">아직 광고 이벤트가 없습니다.</td></tr>'
    : rows.map((row) => `<tr><td><strong>${escapeHtml(row.format)}</strong></td><td>${escapeHtml(row.placement)}</td><td>${formatNumber(row.started)}</td><td>${formatNumber(row.impressions)}</td><td>${formatNumber(row.testImpressions)}</td><td>${formatNumber(row.rewards)}</td><td>${formatNumber(row.dismissed)}</td><td>${formatNumber(row.failed)}</td></tr>`).join("");
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
  const d1 = state.payload?.retention?.find((item) => item.day === 1)?.rate;
  if (!(summary.sessions || summary.installs)) {
    setText("insightText", "아직 수집된 이벤트가 없습니다. 테스트 빌드에서 약관 동의 후 게임을 실행하면 여기에 흐름이 나타납니다.");
    return;
  }
  const timeText = topHour ? `${String(topHour.hour).padStart(2, "0")}시–${String((topHour.hour + 1) % 24).padStart(2, "0")}시` : "—";
  setText("insightText", `가장 많이 시작하는 시간은 ${timeText}입니다. 게임 중 이탈률은 ${formatRate(exitRate)}, D1 유지율은 ${formatRate(d1)}입니다.`);
}

function syncFilterHash() {
  const query = root.ConsoleModel.serializeAnalyticsFilters({
    rangeDays: state.rangeDays,
    distributionKey: state.distributionKey,
    sort: state.playerSort,
    direction: state.playerDirection,
    page: state.playerPage,
    query: state.playerQuery,
  });
  root.history.replaceState(null, "", `#/analytics?${query}`);
}

function readFilterHash() {
  const params = new URLSearchParams((root.location.hash.split("?")[1] || ""));
  const range = Number(params.get("rangeDays"));
  if ([1, 7, 28].includes(range)) state.rangeDays = range;
  const distribution = params.get("distributionKey");
  if (["all", "google_play", "app_store", "onestore"].includes(distribution)) state.distributionKey = distribution;
  const sort = params.get("sort");
  if (["latest_played_at", "best_score", "games_played", "nickname", "country", "gems"].includes(sort)) state.playerSort = sort;
  const direction = params.get("direction");
  if (direction === "asc" || direction === "desc") state.playerDirection = direction;
  const page = Number(params.get("page"));
  if (Number.isInteger(page) && page > 0) state.playerPage = page;
  state.playerQuery = (params.get("query") || "").slice(0, 100);
}

function updateFilterControls() {
  document.querySelectorAll(".range-button").forEach((button) => {
    const active = Number(button.dataset.range) === state.rangeDays;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".distribution-button").forEach((button) => {
    const active = button.dataset.distribution === state.distributionKey;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  byId("periodPlayerSearch").value = state.playerQuery;
  document.querySelectorAll("[data-player-sort]").forEach((button) => {
    button.closest("th").setAttribute("aria-sort", button.dataset.playerSort === state.playerSort ? (state.playerDirection === "asc" ? "ascending" : "descending") : "none");
  });
}

function changeFilters() {
  updateFilterControls();
  syncFilterHash();
  loadDashboard();
}

function bindControls() {
  document.querySelectorAll(".range-button").forEach((button) => button.addEventListener("click", () => {
    state.rangeDays = Number(button.dataset.range);
    state.playerPage = 1;
    changeFilters();
  }));
  document.querySelectorAll(".distribution-button").forEach((button) => button.addEventListener("click", () => {
    state.distributionKey = button.dataset.distribution;
    state.playerPage = 1;
    changeFilters();
  }));
  byId("periodPlayerSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.playerQuery = byId("periodPlayerSearch").value.trim();
    state.playerPage = 1;
    changeFilters();
  });
  byId("periodPlayerReset").addEventListener("click", () => {
    state.playerQuery = "";
    state.playerPage = 1;
    changeFilters();
  });
  document.querySelectorAll("[data-player-sort]").forEach((button) => button.addEventListener("click", () => {
    const nextSort = button.dataset.playerSort;
    state.playerDirection = state.playerSort === nextSort && state.playerDirection === "desc" ? "asc" : "desc";
    state.playerSort = nextSort;
    state.playerPage = 1;
    changeFilters();
  }));
  byId("periodPrevious").addEventListener("click", () => {
    if (state.playerPage > 1) {
      state.playerPage -= 1;
      changeFilters();
    }
  });
  byId("periodNext").addEventListener("click", () => {
    state.playerPage += 1;
    changeFilters();
  });
  let resizeTimer;
  root.addEventListener("resize", () => {
    root.clearTimeout(resizeTimer);
    resizeTimer = root.setTimeout(() => { if (state.payload) renderDailyChart(); }, 120);
  });
}

function mount() {
  if (!state.mounted) {
    readFilterHash();
    bindControls();
    state.mounted = true;
  }
  updateFilterControls();
  loadDashboard();
}

root.ConsoleAnalytics = { mount, load: loadDashboard };
})(window);
