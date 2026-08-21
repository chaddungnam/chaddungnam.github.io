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
  aiBusy: false,
  mounted: false,
  purchaseSnapshot: undefined,
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

async function loadPurchaseSnapshot() {
  if (state.purchaseSnapshot) return;
  const filters = { action: "purchases.list", rangeDays: 30, platform: "", productId: "", query: "", page: 1, limit: 50 };
  try {
    const [all, cancelled] = await Promise.all([
      root.ConsoleAPI.post("admin-console", { ...filters, status: "" }),
      root.ConsoleAPI.post("admin-console", { ...filters, status: "cancelled" }),
    ]);
    state.purchaseSnapshot = { summary: all?.summary ?? {}, total: all?.total, cancelled: cancelled?.total };
  } catch (_error) {
    state.purchaseSnapshot = null;
  }
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
    const [data] = await Promise.all([
      root.ConsoleAPI.post("analytics-dashboard", {
        projectKey: "quirky_ball",
        distributionKey: state.distributionKey,
        rangeDays: state.rangeDays,
        playerQuery: state.playerQuery,
        playerSort: state.playerSort,
        playerDirection: state.playerDirection,
        playerPage: state.playerPage,
      }),
      loadPurchaseSnapshot(),
    ]);
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
  setText("adTotal", `실광고 ${formatNumber(adEconomics.monetizedImpressions)} · 테스트 ${formatNumber(adEconomics.testImpressions)}`);
  renderPulseOverview(pulseModel);
  renderInsightReasons(pulseModel);
  renderPlatformSummary(state.payload?.platforms ?? []);
  renderDailyChart();
  renderHourlyChart();
  renderFunnel();
  renderExitBreakdown();
  renderAds();
  renderDecisionPanels();
  renderAppStatus();
  renderPurchaseTrend();
  renderChoices();
  renderAttention(pulseModel);
  renderPeriodPlayers();
  renderGameMetrics();
  renderDailyTable();
  renderInsight();
}

function renderChoices() {
  const labels = {
    space: "공간 확보",
    fast_growth: "빠른 성장",
    unstable_growth: "불안정 성장",
    size_restore: "크기 복구",
    all_or_nothing: "모 아니면 도",
    mad_scientist: "매드 사이언티스트",
    blood_game: "피의 게임",
    score_double: "점수 2배",
    roulette_reroll: "룰렛 다시하기",
    bonus: "보너스",
    nothing: "미당첨",
    hard_mode: "하드모드",
    breakthrough: "돌파",
    time_rewind: "처음부터 재시작",
    unknown: "확인 필요",
  };
  const renderRows = (id, rows) => {
    const body = byId(id);
    body.innerHTML = rows.length === 0
      ? '<tr><td class="empty-row" colspan="3">아직 수집된 선택이 없습니다.</td></tr>'
      : rows.map((row) => `<tr><td><strong>${escapeHtml(labels[row.key] ?? row.key)}</strong></td><td>${formatNumber(row.count)}</td><td>${formatRate(row.rate)}</td></tr>`).join("");
  };
  renderRows("growthChoicesTable", state.payload?.choices?.growth ?? []);
  renderRows("rouletteResultsTable", state.payload?.choices?.roulette ?? []);
}

function renderGameMetrics() {
  const current = state.payload?.gameMetrics?.current;
  if (!current) {
    setText("operationsFreshAt", "아직 서버 요약이 없습니다.");
    return;
  }

  const economy = current.economy ?? {};
  const stamina = current.stamina ?? {};
  const seasonPass = current.seasonPass ?? {};
  const ranking = current.ranking ?? {};
  const synced = Number(economy.syncedAccounts ?? 0);
  const profiles = Number(economy.profiles ?? 0);
  const dailyStarts = Number(state.payload?.summary?.gamesStarted ?? 0) / Math.max(1, state.rangeDays);
  const history = state.payload?.gameMetrics?.daily ?? [];
  const previousMedian = history.length > 1 ? Number(history.at(-2)?.payload?.economy?.medianGems) : null;
  const medianChange = Number.isFinite(previousMedian)
    ? ` · 전일 ${Number(economy.medianGems ?? 0) - previousMedian >= 0 ? "+" : ""}${formatNumber(Number(economy.medianGems ?? 0) - previousMedian)}`
    : " · 오늘부터 일별 추적";

  setText("operationsFreshAt", `전체 서버 현재 상태 · ${formatServerTime(history.at(-1)?.refreshed_at)}`);
  setText("opsGemMedian", `중앙값 ${formatNumber(Number(economy.medianGems ?? 0))}젬`);
  setText("opsGemDetail", `상위 10% ${formatNumber(Number(economy.p90Gems ?? 0))}젬${medianChange}`);
  byId("opsGemCoverage").style.width = `${Math.min(100, Number(economy.coverageRate ?? 0) * 100)}%`;

  setText("opsStaminaUse", `하루 ${formatDecimal(dailyStarts)}개`);
  setText("opsStaminaDetail", `0개 계정 ${formatNumber(Number(stamina.zeroAccounts ?? 0))} · 가득 참 ${formatNumber(Number(stamina.fullAccounts ?? 0))}`);
  byId("opsStaminaGauge").style.width = `${synced ? Math.max(0, Math.min(100, (synced - Number(stamina.zeroAccounts ?? 0)) / synced * 100)) : 0}%`;

  setText("opsPassRate", formatRate(Number(seasonPass.completionRate ?? 0)));
  setText("opsPassDetail", `참여 ${formatNumber(Number(seasonPass.participants ?? 0))}명 · 평균 ${formatNumber(Number(seasonPass.averageXp ?? 0))} XP`);
  byId("opsPassGauge").style.width = `${Math.min(100, Number(seasonPass.completionRate ?? 0) * 100)}%`;

  setText("opsRankingPlayers", `${formatNumber(Number(ranking.participants ?? 0))}명`);
  setText("opsRankingDetail", `중앙 ${formatNumber(Number(ranking.medianScore ?? 0))}점 · 상위 10% ${formatNumber(Number(ranking.p90Score ?? 0))}점`);
  byId("opsRankingGauge").style.width = `${profiles ? Math.min(100, Number(ranking.participants ?? 0) / profiles * 100) : 0}%`;
}

function formatServerTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function renderAttention(pulseModel) {
  const items = root.ConsoleModel.buildAttentionItems(pulseModel, state.payload?.generatedAt);
  byId("attentionList").innerHTML = items.length === 0
    ? "<p>현재 Pulse 경고가 없습니다.</p>"
    : items.map((item) => `<a class="attention-item" data-severity="${escapeHtml(item.severity)}" data-attention-target="${escapeHtml(item.targetId)}" href="#/analytics?section=${encodeURIComponent(item.targetId)}"><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.source)} · ${escapeHtml(formatServerTime(item.observedAt))}</small></a>`).join("");
  byId("attentionList").querySelectorAll("[data-attention-target]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    byId(link.dataset.attentionTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
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

function renderInsightReasons(model) {
  const metrics = model.metrics || {};
  const reasons = {
    insight: { title: "오늘의 인사이트 · 판단 근거", body: `현재 인사이트는 ${formatNumber(state.payload?.summary?.sessions)}회 세션, ${formatNumber(state.payload?.summary?.gamesStarted)}회 게임 시작, ${formatRate(metrics.completion?.value)} 완료율을 바탕으로 만든 운영용 요약입니다. 원본 이벤트를 그대로 노출하지 않고 지표 기준으로 설명합니다.` },
    duration: { title: "오래 하나? · 판단 근거", body: `평균 플레이 시간은 ${formatDuration(metrics.duration?.value)}입니다. 기준은 3분이며, ${metrics.duration?.statusLabel || "현재 상태"}로 분류했습니다.` },
    completion: { title: "끝까지 하나? · 판단 근거", body: `게임 완료율은 ${formatRate(metrics.completion?.value)}입니다. 완료 이벤트와 게임 시작 이벤트를 비교해 계산했습니다.` },
    retention: { title: "다시 오나? · 판단 근거", body: `D1 유지율은 ${formatRate(metrics.retention?.value)}입니다. 첫 실행 이후 다음 날 다시 기록된 계정을 기준으로 계산했습니다.` },
    ads: { title: "강제 광고는 적당한가? · 판단 근거", body: `활성 플레이어 1명당 강제 전면광고는 ${metrics.ads?.value == null ? "—" : `${formatDecimal(metrics.ads.value)}회`}입니다. 자발적 보상형·배너·네이티브와 테스트 광고는 이 경고에서 제외합니다.` },
  };
  const open = (key) => {
    const reason = reasons[key];
    if (!reason) return;
    byId("insightReasonTitle").textContent = reason.title;
    byId("insightReasonBody").textContent = reason.body;
    const dialog = byId("insightReasonDialog");
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  document.querySelectorAll("[data-metric-why]").forEach((button) => {
    button.onclick = () => open(button.dataset.metricWhy);
  });
  const insightButton = byId("insightWhyButton");
  if (insightButton) insightButton.onclick = () => open("insight");
}

function renderJourney(journey = []) {
  const icons = { first_open: "↗", game_start: "▶", game_over: "✓" };
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
  renderQuestionMetric("Ads", model.metrics.ads, model.metrics.ads.value == null ? "—" : `${formatDecimal(model.metrics.ads.value)}회`, metricProgress(model.metrics.ads.value, 2));
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
      <div><span>전체 광고/플레이어</span><strong>${formatDecimal(row.impressionsPerPlayer)}</strong></div>
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
    ["게임 중 이탈 (10초 이상)", summary.midGameExits, "exit"],
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

// QB-119 — "광고 표시 실패" 총합만으로는 특정 유저에게 몰린 문제(reason=not_ready가
// 프리로드 타이밍)인지 전반적인 재고 부족(여러 날짜에 고르게 분산)인지 구분할 수
// 없었다. analytics-dashboard가 placement별로 돌려주는 failuresByReason/
// failuresByDay(둘 다 QB-116 RPC 경로가 살아나야 실제 데이터가 쌓인다)를 표로
// 그대로 펼친다.
function formatAdFailureReasons(failuresByReason) {
  const entries = Object.entries(failuresByReason ?? {}).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return "—";
  return entries.map(([reason, count]) => `${escapeHtml(reason)}×${formatNumber(count)}`).join(", ");
}

function formatAdFailureDays(failuresByDay) {
  const entries = Array.isArray(failuresByDay) ? failuresByDay : [];
  if (entries.length === 0) return "—";
  // 최근 날짜가 먼저 보이도록 뒤집는다 — 서버는 오름차순으로 보낸다.
  return entries.slice().reverse().slice(0, 7)
    .map((entry) => `${escapeHtml(String(entry.day).slice(5))}:${formatNumber(entry.count)}`)
    .join(" ");
}

function renderAds() {
  const rows = state.payload?.ads ?? [];
  byId("adsTable").innerHTML = rows.length === 0
    ? '<tr><td class="empty-row" colspan="10">아직 광고 이벤트가 없습니다.</td></tr>'
    : rows.map((row) => `<tr><td><strong>${escapeHtml(row.format)}</strong></td><td>${escapeHtml(row.placement)}</td><td>${formatNumber(row.started)}</td><td>${formatNumber(row.impressions)}</td><td>${formatNumber(row.testImpressions)}</td><td>${formatNumber(row.rewards)}</td><td>${formatNumber(row.dismissed)}</td><td>${formatNumber(row.failed)}</td><td>${formatAdFailureReasons(row.failuresByReason)}</td><td>${formatAdFailureDays(row.failuresByDay)}</td></tr>`).join("");
}

function renderCoverageCards(id, cards) {
  const statusLabels = { available: "수집됨", empty: "데이터 없음", waiting: "계측 대기", error: "조회 실패" };
  byId(id).innerHTML = cards.map((card) => `
    <article class="coverage-card" data-status="${card.status}">
      <div class="coverage-card-top"><span class="coverage-status">${statusLabels[card.status]}</span><strong>${escapeHtml(card.value)}</strong></div>
      <h3>${escapeHtml(card.label)}</h3>
      <small>${escapeHtml(card.detail)}</small>
    </article>`).join("");
}

function renderDecisionPanels() {
  const acquisition = state.payload?.acquisitionQuality;
  if (!acquisition || typeof acquisition !== "object") {
    renderCoverageCards("acquisitionQuality", ["첫 실행", "게임 시작", "시작률", "완료"].map((label) => ({ status: "waiting", label, value: "집계 대기", detail: "서버 집계를 불러오는 중입니다." })));
    setText("acquisitionQualityStatus", "집계 대기");
  } else {
    const firstOpens = Number(acquisition.firstOpens ?? 0);
    const started = Number(acquisition.started ?? 0);
    const completed = Number(acquisition.completed ?? 0);
    const hasNewUsers = firstOpens > 0;
    const status = hasNewUsers ? "available" : "empty";
    renderCoverageCards("acquisitionQuality", [
      { status, label: "첫 실행", value: `${formatNumber(firstOpens)}명`, detail: "선택 기간에 first_open이 기록된 신규 설치" },
      { status, label: "게임 시작", value: `${formatNumber(started)}명`, detail: "같은 신규 설치에서 game_start까지 기록" },
      { status, label: "첫 실행 → 시작", value: formatRate(acquisition.firstOpenToStartRate), detail: "광고 설치 수가 아닌 실제 앱 실행 코호트 기준" },
      { status, label: "첫 실행 → 완료", value: `${formatNumber(completed)}명 · ${formatRate(acquisition.firstOpenToCompleteRate)}`, detail: "같은 신규 설치에서 game_over까지 기록" },
    ]);
    setText("acquisitionQualityStatus", hasNewUsers ? `${formatNumber(firstOpens)}명 코호트` : "신규 없음");
  }

  const economics = state.payload?.adEconomics ?? {};
  const formats = Array.isArray(economics.formatBreakdown) ? economics.formatBreakdown : [];
  const formatLabels = {
    interstitial: ["강제 전면", "게임 종료 후 자동으로 노출되는 광고"],
    rewarded: ["자발적 보상형", "보상을 선택한 플레이어가 보는 광고"],
    banner: ["배너", "화면에 상시·부분 노출되는 광고"],
    native: ["네이티브", "팝업 안에 자연스럽게 표시되는 광고"],
  };
  const formatCards = Object.entries(formatLabels).map(([format, [label, detail]]) => {
    const row = formats.find((item) => item?.format === format);
    const measured = Boolean(row) || Number(economics.impressions ?? 0) === 0;
    return {
      status: measured ? (Number(row?.monetizedImpressions ?? 0) > 0 ? "available" : "empty") : "waiting",
      label,
      value: measured ? `${formatNumber(Number(row?.monetizedImpressions ?? 0))}회` : "집계 대기",
      detail: `${detail} · 활성 플레이어당 ${formatDecimal(row?.impressionsPerPlayer)}회 · 테스트 ${formatNumber(Number(row?.testImpressions ?? 0))}`,
    };
  });
  renderCoverageCards("adFormatSummary", formatCards);
  setText("adFormatStatus", formats.length ? `실광고 ${formatNumber(economics.monetizedImpressions)}회` : "집계 대기");

  const purchaseFunnels = state.payload?.purchaseFunnel;
  const removeAds = Array.isArray(purchaseFunnels) ? purchaseFunnels.find((item) => item?.productId === "remove_ads") : null;
  if (!Array.isArray(purchaseFunnels)) {
    renderCoverageCards("removeAdsFunnel", ["구매 시작", "구매 성공", "시작 → 성공", "구매 실패"].map((label) => ({ status: "waiting", label, value: "집계 대기", detail: "기존 구매 이벤트를 서버에서 묶는 중입니다." })));
    setText("removeAdsFunnelStatus", "집계 대기");
  } else {
    const hasIntent = Number(removeAds?.startedUsers ?? 0) > 0;
    const status = hasIntent ? "available" : "empty";
    renderCoverageCards("removeAdsFunnel", [
      { status, label: "구매 시작", value: `${formatNumber(Number(removeAds?.startedUsers ?? 0))}명`, detail: "remove_ads 구매 버튼을 누른 설치" },
      { status, label: "구매 성공", value: `${formatNumber(Number(removeAds?.succeededUsers ?? 0))}명`, detail: "purchase_succeeded가 기록된 설치" },
      { status, label: "시작 → 성공", value: formatRate(removeAds?.startToSuccessRate), detail: "선택 기간의 고유 설치 기준 전환율" },
      { status, label: "구매 실패", value: `${formatNumber(Number(removeAds?.failedUsers ?? 0))}명 · ${formatNumber(Number(removeAds?.failedEvents ?? 0))}회`, detail: "실패 사용자와 반복 시도 횟수를 함께 표시" },
    ]);
    setText("removeAdsFunnelStatus", hasIntent ? `${formatNumber(removeAds.startedUsers)}명 시작` : "구매 시작 없음");
  }
}

function measuredCard(label, value, detail, hasData, formatter = (count) => `${formatNumber(count)}회`) {
  const measured = hasData && typeof value === "number" && Number.isFinite(value);
  return { status: measured ? "available" : "empty", label, value: measured ? formatter(value) : "데이터 없음", detail };
}

function renderAppStatus() {
  const summary = state.payload?.summary ?? {};
  const ads = state.payload?.ads;
  const hasEvents = Number(summary.installs ?? 0) > 0 || Number(summary.sessions ?? 0) > 0;
  const hasAds = Array.isArray(ads) && ads.length > 0;
  const cards = [
    measuredCard("세션 시작", summary.sessions, "session_start · 고유 세션", hasEvents),
    measuredCard("평균 세션", summary.avgSessionSeconds, "session_end 기반 · 종료 건수는 현재 응답 미제공", hasEvents, formatDuration),
    measuredCard("게임 시작", summary.gamesStarted, "game_start · 10초 미만 즉시 이탈 제외", hasEvents),
    measuredCard("게임 완료", summary.gameOvers, "game_over · 정상 종료", hasEvents),
    measuredCard("광고 노출", summary.adImpressions, "ad_impression · 테스트 광고 포함", hasAds),
    measuredCard("광고 표시 실패", hasAds ? ads.reduce((sum, row) => sum + Number(row.failed ?? 0), 0) : null, "ad_show_failed · 로드 실패는 현재 집계 제외", hasAds),
  ];
  renderCoverageCards("appStatusGrid", cards);
  setText("appStatusTotal", hasEvents ? `${cards.filter((card) => card.status === "available").length} / ${cards.length} 확인` : "데이터 없음");
}

function renderPurchaseTrend() {
  const snapshot = state.purchaseSnapshot;
  if (!snapshot) {
    const status = snapshot === null ? "error" : "waiting";
    renderCoverageCards("purchaseTrend", ["구매 완료", "구매 실패", "사용자 취소", "구매 복원", "환불", "결제 취소(차지백)"].map((label) => ({ status, label, value: status === "error" ? "조회 실패" : "계측 대기", detail: status === "error" ? "구매 서버 기록을 불러오지 못했습니다." : "구매 데이터를 불러오는 중입니다." })));
    setText("purchaseTrendStatus", status === "error" ? "조회 실패" : "불러오는 중");
    return;
  }
  const total = Number(snapshot.total);
  const hasRecords = Number.isFinite(total) && total > 0;
  const summary = snapshot.summary ?? {};
  const recordCard = (label, value, detail) => measuredCard(label, Number(value), detail, hasRecords, (count) => `${formatNumber(count)}건`);
  const cards = [
    recordCard("구매 완료", summary.purchased, "purchase_records · purchased"),
    { status: "waiting", label: "구매 실패", value: "계측 대기", detail: "현재 analytics 응답에 구매 실패 집계가 없습니다." },
    recordCard("사용자 취소", snapshot.cancelled, "purchase_records · cancelled"),
    { status: "waiting", label: "구매 복원", value: "계측 대기", detail: "현재 analytics 응답에 구매 복원 집계가 없습니다." },
    recordCard("환불", summary.refunded, "purchase_records · refunded"),
    recordCard("결제 취소(차지백)", summary.chargebacks, "purchase_records · chargeback"),
  ];
  renderCoverageCards("purchaseTrend", cards);
  setText("purchaseTrendStatus", hasRecords ? `${formatNumber(total)}건 기록` : "데이터 없음");
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
  const acquisition = state.payload?.acquisitionQuality;
  const cohortText = Number(acquisition?.firstOpens ?? 0) > 0
    ? `신규 첫 실행 ${formatNumber(acquisition.firstOpens)}명 중 ${formatNumber(acquisition.started)}명이 게임을 시작했고 ${formatNumber(acquisition.completed)}명이 완료했습니다.`
    : "이 기간에는 신규 첫 실행 코호트가 없습니다.";
  setText("insightText", `${cohortText} 많이 시작하는 시간은 ${timeText}, 전체 게임 중 이탈률은 ${formatRate(exitRate)}, D1 유지율은 ${formatRate(d1)}입니다.`);
}

function setAiMessage(value, error = false) {
  const element = byId("aiBriefMessage");
  element.textContent = value;
  element.style.color = error ? "var(--coral)" : "";
}

function advisorySnapshot() {
  const summary = state.payload?.summary ?? {};
  const retention = state.payload?.retention ?? [];
  const ad = state.payload?.adEconomics ?? {};
  const d1 = retention.find((item) => item.day === 1)?.rate;
  const d7 = retention.find((item) => item.day === 7)?.rate;
  const completion = summary.gamesStarted ? (summary.gameOvers ?? 0) / summary.gamesStarted : null;
  const exitRate = summary.gamesStarted ? ((summary.midGameExits ?? 0) + (summary.unobservedGames ?? 0)) / summary.gamesStarted : null;
  const revenue = Number(ad.estimatedRevenueEur);
  const monthlyRevenue = Number.isFinite(revenue) && state.rangeDays > 0 ? revenue / state.rangeDays * 30 : null;
  const forcedAdsPerPlayer = Number(ad.formatBreakdown?.find((row) => row?.format === "interstitial")?.impressionsPerPlayer);
  return { sessions: Number(summary.sessions ?? 0), gamesStarted: Number(summary.gamesStarted ?? 0), activePlayers: Number(summary.activeInstallsToday ?? 0), duration: Number(summary.avgSessionSeconds), completion, exitRate, d1, d7, adsPerPlayer: Number.isFinite(forcedAdsPerPlayer) ? forcedAdsPerPlayer : null, monthlyRevenue };
}

function fallbackAdvice(snapshot) {
  const money = snapshot.monthlyRevenue == null ? "수익 추정에 필요한 eCPM 또는 광고 수익 데이터가 아직 부족합니다." : `현재 ${state.rangeDays}일 기준을 30일로 환산하면 보수 ${formatCurrency(snapshot.monthlyRevenue * 0.6)} · 기준 ${formatCurrency(snapshot.monthlyRevenue)} · 상향 ${formatCurrency(snapshot.monthlyRevenue * 1.4)}입니다. 실제 수익 보장은 아니며 eCPM과 필레이트에 따라 달라집니다.`;
  const iosReady = snapshot.sessions >= 50 && snapshot.completion >= 0.55 && snapshot.d1 >= 0.2 && snapshot.duration >= 90;
  const ios = iosReady ? "iOS는 소규모 소프트런치를 시작할 수 있습니다. 단, iOS 크래시·결제·개인정보 고지는 별도 실기기 확인 후 열어야 합니다." : `iOS 확장은 아직 보류가 좋습니다. 현재 완료율 ${formatRate(snapshot.completion)}, D1 ${formatRate(snapshot.d1)}, 평균 플레이 ${formatDuration(snapshot.duration)}를 먼저 안정화하세요.`;
  const next = snapshot.completion != null && snapshot.completion < 0.55 ? "차기작보다 Quirky Ball 첫 1분 난이도와 중간 이탈을 먼저 고치는 편이 수익 가능성이 높습니다." : snapshot.adsPerPlayer > 2 ? "강제 전면광고가 많습니다. 노출 간격을 확인한 뒤 선택형 보상 광고와 꾸미기 상품을 중심으로 설계하세요." : "차기작은 짧은 세션의 물리 퍼즐을 유지하되, 수집·꾸미기·주간 목표를 가볍게 더한 반복 구조가 현재 데이터와 가장 잘 맞습니다.";
  return `월 예상 수익\n${money}\n\niOS 확장 판단\n${ios}\n\n차기작 방향\n${next}`;
}

function englishPrompt(snapshot) {
  return `You are a cautious mobile game operations advisor. Use only this aggregated Quirky Ball data: sessions=${snapshot.sessions}, games_started=${snapshot.gamesStarted}, average_session_seconds=${snapshot.duration}, completion_rate=${snapshot.completion}, exit_rate=${snapshot.exitRate}, D1=${snapshot.d1}, D7=${snapshot.d7}, forced_ads_per_active_player=${snapshot.adsPerPlayer}, monthly_ad_revenue_baseline_EUR=${snapshot.monthlyRevenue}. Write concise English advice with exactly three headings: Monthly revenue forecast, iOS expansion decision, Next game direction. Give conservative, actionable recommendations, explicitly say when data is insufficient, never invent metrics, and do not give financial guarantees.`;
}

async function createChromeAdvice(prompt) {
  const api = root.LanguageModel;
  if (!api?.availability || !api?.create) throw new Error("chrome_ai_unavailable");
  const availability = await api.availability();
  if (availability === "unavailable") throw new Error("chrome_ai_unavailable");
  let session;
  try { session = await api.create({ initialPrompts: [{ role: "system", content: "Give evidence-based mobile game operations advice in English." }] }); }
  catch (_error) { session = await api.create(); }
  try { return String(await session.prompt(prompt)).trim(); }
  finally { session.destroy?.(); }
}

async function translateToKorean(text) {
  const api = root.Translator;
  if (!api?.availability || !api?.create) return null;
  const options = { sourceLanguage: "en", targetLanguage: "ko" };
  const availability = await api.availability(options);
  if (availability === "unavailable") return null;
  const translator = await api.create(options);
  try { return String(await translator.translate(text)).trim(); }
  finally { translator.destroy?.(); }
}

async function runAiBrief() {
  if (state.aiBusy || !state.payload) return;
  state.aiBusy = true;
  byId("aiBriefRun").disabled = true;
  setAiMessage("Chrome AI 준비 상태를 확인하는 중...");
  const snapshot = advisorySnapshot();
  const fallback = fallbackAdvice(snapshot);
  try {
    const original = await createChromeAdvice(englishPrompt(snapshot));
    const translated = await translateToKorean(original);
    byId("aiBriefResult").textContent = translated || fallback;
    byId("aiBriefOriginalText").textContent = original;
    byId("aiBriefOriginal").hidden = false;
    byId("aiBriefOriginalText").hidden = true;
    byId("aiBriefOriginal").textContent = "원문 보기";
    setText("aiBriefSource", translated ? "Chrome AI 분석" : "Chrome AI + 기본 번역");
    setAiMessage(translated ? "이 기기에서 분석과 번역을 마쳤습니다." : "영문 분석은 완료했지만 한국어 번역을 지원하지 않아 지표 기반 한국어 요약을 표시합니다.");
  } catch (_error) {
    byId("aiBriefResult").textContent = fallback;
    byId("aiBriefOriginal").hidden = true;
    setText("aiBriefSource", "지표 기반 조언");
    setAiMessage("이 Chrome에서 내장 AI를 사용할 수 없어 비용 없는 지표 기반 조언을 표시합니다.");
  } finally {
    state.aiBusy = false;
    byId("aiBriefRun").disabled = false;
  }
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
  byId("aiBriefRun").addEventListener("click", runAiBrief);
  byId("aiBriefOriginal").addEventListener("click", () => {
    const original = byId("aiBriefOriginalText");
    original.hidden = !original.hidden;
    byId("aiBriefOriginal").textContent = original.hidden ? "원문 보기" : "원문 숨기기";
  });
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
