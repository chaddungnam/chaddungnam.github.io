(function attachPulseModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PulseModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPulseModel() {
  const MIN_ACTIVE_INSTALLS = 30;
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
      ["first_open", "첫 실행", "처음 앱을 연 설치"],
      ["game_start", "게임 시작", "게임을 시작한 설치"],
      ["game_over", "게임 완료", "끝까지 간 설치"],
    ];
    let previous = null;
    return definitions.map(([event, label, description]) => {
      const users = eventUsers(funnel, event);
      const rate = previous == null ? 1 : previous > 0 ? users / previous : null;
      previous = users;
      return { event, label, description, users, rate };
    });
  }

  function selectAction(metrics, activeInstalls, verdictStatus, verdictSummary) {
    if (activeInstalls < MIN_ACTIVE_INSTALLS) {
      return `판단하려면 기간 내 활동 설치가 ${MIN_ACTIVE_INSTALLS - activeInstalls}개 더 필요해요.`;
    }
    if (metrics.completion.status === "risk") return "완료된 판이 적어요. 첫 1분 난이도를 확인해요.";
    if (metrics.duration.status === "risk") return "한 판이 너무 빨리 끝나요. 시작 1분의 재미를 확인해요.";
    if (metrics.retention.status === "risk") return "다음 날 돌아온 설치가 적어요. 재방문 보상을 확인해요.";
    if (metrics.ads.status === "risk") return "강제 전면광고가 많아요. 게임 종료 후 노출 간격을 확인해요.";
    if (verdictStatus === "risk") return verdictSummary ?? "종합 상태가 위험해요. 평균 세션과 이탈 기록을 확인해요.";
    if (Object.values(metrics).some((item) => item.status === "watch")) return "노란 지표 하나를 골라 7일 변화를 지켜봐요.";
    if (verdictStatus === "watch") return verdictSummary ?? "종합 상태가 노란색이에요. 7일 변화를 지켜봐요.";
    return "전체 흐름이 좋아요. 지금 설정을 유지하며 7일 변화를 봐요.";
  }

  function buildVerdictSummary(status, metrics, activeInstalls, sessions) {
    if (status === "insufficient") return `설치 기준 ${activeInstalls}개에서 앱 세션 ${sessions}회가 기록됐어요. 활동 설치 ${MIN_ACTIVE_INSTALLS}개부터 상태를 판단합니다.`;
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
    if (matchingMetric && messages[status]?.[matchingMetric]) return messages[status][matchingMetric];
    if (status === "risk") return "앱에 머무는 시간이나 이탈 지표에서 위험 신호가 잡혔어요.";
    if (status === "watch") return "노란 신호가 있어 7일 변화를 조금 더 봐야 해요.";
    return "주요 플레이 흐름이 안정적이고 좋아요.";
  }

  function worstStatus(healthStatus, metrics) {
    return Object.values(metrics).reduce((worst, item) => {
      if (!(item.status in STATUS_SEVERITY)) return worst;
      return STATUS_SEVERITY[item.status] > STATUS_SEVERITY[worst] ? item.status : worst;
    }, healthStatus);
  }

  function buildPulseModel(payload = {}) {
    const summary = payload.summary ?? {};
    const retention = payload.retention ?? [];
    const economics = payload.adEconomics ?? {};
    const funnel = payload.funnel ?? [];
    const sessions = Math.max(0, finiteNumber(summary.sessions) ?? 0);
    const activeInstalls = Math.max(0, finiteNumber(summary.installs) ?? finiteNumber(summary.activeInstallsToday) ?? 0);
    const enoughSamples = activeInstalls >= MIN_ACTIVE_INSTALLS;
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
      retention: metric(classify(d1Rate, 0.2, 0.1), d1Rate, "다음 날 다시 온 설치 비율"),
      ads: metric(adsStatus, adsPerPlayer, "활성 설치당 강제 전면광고"),
    };
    const metrics = enoughSamples
      ? rawMetrics
      : Object.fromEntries(Object.entries(rawMetrics).map(([key, item]) => [key, metric("insufficient", item.value, item.description)]));

    const health = payload.health ?? {};
    const healthStatus = ["good", "watch", "risk"].includes(health.status) ? health.status : "watch";
    const verdictStatus = enoughSamples ? worstStatus(healthStatus, metrics) : "insufficient";
    const verdict = {
      status: verdictStatus,
      label: STATUS_LABELS[verdictStatus],
      score: enoughSamples && verdictStatus === healthStatus && finiteNumber(health.score) != null ? health.score : null,
      summary: buildVerdictSummary(verdictStatus, metrics, activeInstalls, sessions),
    };

    return {
      minimumActiveInstalls: MIN_ACTIVE_INSTALLS,
      activeInstalls,
      sessions,
      verdict,
      metrics,
      journey: buildJourney(funnel),
      action: selectAction(metrics, activeInstalls, verdict.status, verdict.summary),
    };
  }

  return { MIN_ACTIVE_INSTALLS, buildPulseModel };
});
