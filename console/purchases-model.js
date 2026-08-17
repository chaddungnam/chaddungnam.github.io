(function attachPurchasesModel(root, factory) {
  const model = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  root.ConsolePurchasesModel = model;
})(typeof window === "undefined" ? globalThis : window, function createPurchasesModel() {
  const STATUS_LABELS = {
    pending: "확인 중", purchased: "결제 완료", refunded: "환불",
    chargeback: "결제 취소", cancelled: "취소", revoked: "권한 회수",
  };
  const ENTITLEMENT_LABELS = { none: "없음", active: "활성", partial: "일부 회수", revoked: "회수" };
  const PRODUCT_LABELS = { remove_ads: "광고 제거", elite_package: "엘리트 패키지 (레거시)", yakwon_bundle: "약원 패키지" };
  const REASON_LABELS = {
    customer_request: "고객 요청", unauthorized: "승인하지 않은 결제", minor_purchase: "미성년 결제",
    technical_issue: "기술 문제", duplicate: "중복 결제", suspected_abuse: "반복 이용 검토",
    store_decision: "스토어 결정", other: "기타",
  };

  function normalize(payload) {
    return {
      connected: payload?.connected === true,
      syncStatus: String(payload?.syncStatus || "store_notifications_not_connected"),
      summary: payload?.summary || {},
      purchases: Array.isArray(payload?.purchases) ? payload.purchases : [],
      total: Math.max(0, Number(payload?.total) || 0),
      page: Math.max(1, Number(payload?.page) || 1),
      pageCount: Math.max(1, Number(payload?.pageCount) || 1),
    };
  }

  function formatMoney(micros, currency) {
    if (!Number.isFinite(Number(micros)) || !currency) return "—";
    try { return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(Number(micros) / 1_000_000); }
    catch (_error) { return `${Number(micros) / 1_000_000} ${currency}`; }
  }

  function formatRate(value) {
    const rate = Math.max(0, Number(value) || 0);
    return `${(rate * 100).toFixed(rate > 0 && rate < 0.1 ? 1 : 0)}%`;
  }

  return { STATUS_LABELS, ENTITLEMENT_LABELS, PRODUCT_LABELS, REASON_LABELS, normalize, formatMoney, formatRate };
});
