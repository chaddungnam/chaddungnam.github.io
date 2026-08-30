(function attachPulseModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PulseModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPulseModel() {
  const MIN_DAILY_ACTIVE_PEOPLE = 5;
  const STATUS_LABELS = {
    good: "좋아요",
    watch: "지켜봐요",
    risk: "고쳐야 해요",
    insufficient: "판단 대기",
  };
  const STATUS_SEVERITY = { good: 0, watch: 1, risk: 2 };

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function classify(value, goodAt, watchAt, higherIsBetter = true) {
    if (value == null) return "insufficient";
    if (higherIsBetter) {
      if (value >= goodAt) return "good";
      if (value >= watchAt) return "watch";
      return "risk";
    }
    if (value <= goodAt) return "good";
    if (value <= watchAt) return "watch";
    return "risk";
  }

  function metric(status, value, description) {
    return { status, value, statusLabel: STATUS_LABELS[status], description };
  }

  function eventUsers(funnel, event) {
    return finiteNumber(funnel.find((row) => row?.event === event)?.users) ?? 0;
  }

  function buildJourney(funnel) {
    const definitions = [
      ["first_open", "첫 실행", "처음 앱을 연 사람"],
      ["game_start", "게임 시작", "게임을 시작한 사람"],
      ["game_over", "게임 완료", "끝까지 간 사람"],
    ];
    let previous = null;
    return definitions.map(([event, label, description]) => {
      const users = eventUsers(funnel, event);
      const rate = previous == null ? 1 : previous > 0 ? users / previous : null;
      previous = users;
      return { event, label, description, users, rate };
    });
  }

  function selectAction(metrics, verdictStatus, verdictSummary, isEstimate) {
    let action;
    if (metrics.completion.status === "risk") action = "완료된 판이 적어요. 첫 1분 난이도를 확인해요.";
    else if (metrics.duration.status === "risk") action = "한 판이 너무 빨리 끝나요. 시작 1분의 재미를 확인해요.";
    else if (metrics.retention.status === "risk") action = "다음 날 돌아온 사람이 적어요. 재방문 보상을 확인해요.";
    else if (metrics.ads.status === "risk") action = "강제 전면광고가 많아요. 게임 종료 후 노출 간격을 확인해요.";
    else if (verdictStatus === "risk") action = verdictSummary ?? "종합 상태가 위험해요. 평균 세션과 이탈 기록을 확인해요.";
    else if (Object.values(metrics).some((item) => item.status === "watch")) action = "노란 지표 하나를 골라 7일 변화를 지켜봐요.";
    else if (verdictStatus === "watch") action = "확인되지 않은 지표를 보완하면서 현재 흐름을 유지해요.";
    else action = "전체 흐름이 좋아요. 지금 설정을 유지하며 7일 변화를 봐요.";
    return isEstimate ? `근사 평가: ${action}` : action;
  }

  function buildVerdictSummary(status, metrics, dailyActivePeople, dailyEffectivePeople, sessions, heavyPeople, isEstimate) {
    const people = Number.isInteger(dailyActivePeople) ? String(dailyActivePeople) : dailyActivePeople.toFixed(1);
    const effective = Number.isInteger(dailyEffectivePeople) ? String(dailyEffectivePeople) : dailyEffectivePeople.toFixed(1);
    const sampleText = heavyPeople > 0
      ? `하루 평균 실제 ${people}명, 헤비 ${heavyPeople}명 2배 반영 유효 ${effective}명, 앱 세션 ${sessions}회 기준입니다. `
      : `하루 평균 ${people}명, 앱 세션 ${sessions}회 기준입니다. `;
    const prefix = isEstimate ? `표본이 적은 근사 평가예요. ${sampleText}` : "";
    const messages = {
      risk: {
        completion: "끝까지 플레이하는 비율이 낮아 빨간 신호예요.",
        duration: "한 판이 너무 빨리 끝나서 빨간 신호예요.",
        retention: "다음 날 돌아오는 비율이 낮아 빨간 신호예요.",
        ads: "강제 전면광고가 많아 빨간 신호예요.",
      },
      watch: {
        completion: "끝까지 플레이하는 비율을 조금 더 지켜봐야 해요.",
        duration: "한 판 시간이 조금 짧아 더 지켜봐야 해요.",
        retention: "다음 날 돌아오는 비율을 조금 더 지켜봐야 해요.",
        ads: "강제 전면광고 횟수를 조금 더 지켜봐야 해요.",
      },
    };
    const matchingMetric = Object.entries(metrics).find(([, item]) => item.status === status)?.[0];
    if (matchingMetric && messages[status]?.[matchingMetric]) return prefix + messages[status][matchingMetric];
    if (status === "risk") return prefix + "앱에 머무는 시간이나 이탈 지표에서 위험 신호가 잡혔어요.";
    if (status === "watch" && Object.values(metrics).some((item) => item.status === "insufficient")) return prefix + "아직 확인되지 않은 지표가 있어 노란 신호로 봅니다.";
    if (status === "watch") return prefix + "노란 신호가 있어 7일 변화를 조금 더 봐야 해요.";
    return prefix + "현재 확인된 주요 플레이 흐름은 좋아요.";
  }

  function worstStatus(healthStatus, metrics) {
    const worst = Object.values(metrics).reduce((current, item) => {
      if (!(item.status in STATUS_SEVERITY)) return current;
      return STATUS_SEVERITY[item.status] > STATUS_SEVERITY[current] ? item.status : current;
    }, healthStatus);
    return worst === "good" && Object.values(metrics).some((item) => item.status === "insufficient") ? "watch" : worst;
  }

  function buildPulseModel(payload = {}) {
    const summary = payload.summary ?? {};
    const retention = payload.retention ?? [];
    const economics = payload.adEconomics ?? {};
    const funnel = payload.funnel ?? [];
    const sessions = Math.max(0, finiteNumber(summary.sessions) ?? 0);
    const activePeople = Math.max(0, finiteNumber(summary.installs) ?? finiteNumber(summary.activeInstallsToday) ?? 0);
    const dailyRows = Array.isArray(payload.daily)
      ? payload.daily.filter((row) => finiteNumber(row?.activeInstalls) !== null)
      : [];
    const rangeDays = Math.max(1, finiteNumber(payload.rangeDays) ?? 1);
    const dailyActivePeople = dailyRows.length > 0
      ? dailyRows.reduce((sum, row) => sum + (finiteNumber(row.activeInstalls) ?? 0), 0) / dailyRows.length
      : activePeople / rangeDays;
    const heavyPeople = Math.max(0, finiteNumber(summary.playerSegments?.heavyPeople) ?? 0);
    const dailyEffectivePeople = dailyRows.length > 0
      ? dailyRows.reduce((sum, row) => sum + (finiteNumber(row.weightedPeople) ?? finiteNumber(row.activeInstalls) ?? 0), 0) / dailyRows.length
      : Math.max(0, finiteNumber(summary.playerSegments?.weightedDailyPeople) ?? (activePeople + heavyPeople) / rangeDays);
    const enoughSamples = dailyEffectivePeople >= MIN_DAILY_ACTIVE_PEOPLE;
    const avgGameSeconds = finiteNumber(summary.avgGameSeconds);
    const gamesStarted = Math.max(0, finiteNumber(summary.gamesStarted) ?? 0);
    const gameOvers = Math.max(0, finiteNumber(summary.gameOvers) ?? 0);
    const observedGames = Math.max(0, finiteNumber(summary.observedGames) ?? gamesStarted);
    const completionRate = observedGames > 0 ? gameOvers / observedGames : null;
    const d1Rate = finiteNumber(retention.find((row) => row?.day === 1)?.rate);
    const hasFormatBreakdown = Array.isArray(economics.formatBreakdown);
    const interstitial = hasFormatBreakdown
      ? economics.formatBreakdown.find((row) => row?.format === "interstitial")
      : null;
    const measuredInterstitialRate = finiteNumber(interstitial?.impressionsPerPlayer);
    const adsPerPlayer = measuredInterstitialRate ?? (hasFormatBreakdown && finiteNumber(economics.activePlayers) > 0 ? 0 : null);
    const adsStatus = classify(adsPerPlayer, 1, 2, false);

    const rawMetrics = {
      duration: metric(classify(avgGameSeconds, 180, 60), avgGameSeconds, "평균 한 판 시간"),
      completion: metric(classify(completionRate, 0.65, 0.45), completionRate, "결과가 확인된 판의 완료 비율"),
      retention: metric(classify(d1Rate, 0.2, 0.1), d1Rate, "다음 날 다시 온 사람 비율"),
      ads: metric(adsStatus, adsPerPlayer, "활동 인원당 강제 전면광고"),
    };
    const metrics = rawMetrics;

    const health = payload.health ?? {};
    const healthStatus = ["good", "watch", "risk"].includes(health.status) ? health.status : "good";
    const verdictStatus = worstStatus(healthStatus, metrics);
    const isEstimate = !enoughSamples;
    const verdict = {
      status: verdictStatus,
      label: isEstimate ? `${STATUS_LABELS[verdictStatus]} (근사)` : STATUS_LABELS[verdictStatus],
      score: enoughSamples && verdictStatus === healthStatus && finiteNumber(health.score) != null ? health.score : null,
      summary: buildVerdictSummary(verdictStatus, metrics, dailyActivePeople, dailyEffectivePeople, sessions, heavyPeople, isEstimate),
    };

    return {
      minimumDailyActivePeople: MIN_DAILY_ACTIVE_PEOPLE,
      activePeople,
      dailyActivePeople,
      dailyEffectivePeople,
      heavyPeople,
      confidence: isEstimate ? "estimate" : "standard",
      sessions,
      verdict,
      metrics,
      journey: buildJourney(funnel),
      action: selectAction(metrics, verdict.status, verdict.summary, isEstimate),
    };
  }

  return { MIN_DAILY_ACTIVE_PEOPLE, buildPulseModel };
});
