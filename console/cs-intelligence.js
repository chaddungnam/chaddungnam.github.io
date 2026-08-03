(function attachCsIntelligence(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CsIntelligence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCsIntelligence() {
  const CATEGORY_LABELS = { billing: "결제", account: "계정", bug: "버그", other: "기타" };
  const REWARD_TEMPLATES = [
    ["general", "안내 보상"],
    ["compensation", "불편 보상"],
    ["maintenance", "점검 보상"],
    ["welcome", "환영 보상"],
    ["support", "문의 지원 보상"],
    ["update", "업데이트 보상"],
    ["launch", "출시 기념 보상"],
  ].map(([key, label]) => ({ key, label, titleKey: `mail_${key}_title`, bodyKey: `mail_${key}_body`, mailType: key }));

  function redactForSummary(value, limit = 4000) {
    return String(value || "")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[이메일]")
      .replace(/https?:\/\/\S+/gi, "[링크]")
      .replace(/\bp[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}\b/gi, "[플레이어 코드]")
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[식별자]")
      .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, "[전화번호]")
      .replace(/\b\d{12,}\b/g, "[식별자]")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, Math.max(0, Math.min(4000, Number(limit) || 4000)));
  }

  function categoryFor(value) {
    const text = String(value || "").toLowerCase();
    if (/(결제|구매|환불|과금|영수증|payment|purchase|refund|charged|billing)/i.test(text)) return "billing";
    if (/(계정|로그인|연동|비밀번호|닉네임|account|login|sign[ -]?in|password)/i.test(text)) return "account";
    if (/(버그|오류|튕|멈|실행|크래시|안\s*돼|bug|error|crash|freeze|broken)/i.test(text)) return "bug";
    return "other";
  }

  function urgencyFor(value) {
    const text = String(value || "").toLowerCase();
    if (/(환불|중복\s*결제|두\s*번|계정\s*(삭제|도용)|refund|double.?charg|charged twice|hacked|delete account)/i.test(text)) return "high";
    return "normal";
  }

  function localSummary({ subject = "", text = "" } = {}) {
    const safe = redactForSummary(text);
    const summary = (safe.split(/(?<=[.!?。！？요다])\s+|\n+/).find((line) => line.trim().length >= 5) || safe || redactForSummary(subject) || "문의 내용을 확인해 주세요.")
      .trim().slice(0, 180);
    const combined = `${subject}\n${safe}`;
    return { summary, category: categoryFor(combined), urgency: urgencyFor(combined), source: "local" };
  }

  function startOfWeek(value = new Date()) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  }

  function addLocalDays(value, days) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  function dateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function bucketByLocalDate(items) {
    const buckets = new Map();
    for (const item of items || []) {
      const key = dateKey(item.latestAt);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    return buckets;
  }

  function weeklyBrief(items, now = Date.now()) {
    const startDate = startOfWeek(new Date(now));
    const start = startDate.getTime();
    const end = addLocalDays(startDate, 7).getTime();
    const current = (items || []).filter((item) => Number(item.latestAt) >= start && Number(item.latestAt) < end);
    const categories = current.reduce((counts, item) => ({ ...counts, [item.category || "other"]: (counts[item.category || "other"] || 0) + 1 }), {});
    const topCategory = Object.entries(categories).sort((left, right) => right[1] - left[1])[0]?.[0] || "";
    const needsReply = current.filter((item) => item.status === "needs_reply").length;
    const urgent = current.filter((item) => item.urgent).length;
    const headline = current.length
      ? `이번 주 ${CATEGORY_LABELS[topCategory] || "기타"} 문의가 ${categories[topCategory]}건으로 가장 많습니다. 답변 필요 ${needsReply}건${urgent ? `, 긴급 ${urgent}건` : ""}입니다.`
      : "이번 주에 불러온 문의가 없습니다.";
    return { total: current.length, needsReply, urgent, topCategory, headline };
  }

  function monthGrid(value = new Date()) {
    const date = new Date(value);
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const cursor = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addLocalDays(cursor, index));
  }

  function yearMonths(value = new Date()) {
    const date = new Date(value);
    return Array.from({ length: 12 }, (_, month) => new Date(date.getFullYear(), month, 1));
  }

  function rewardTemplates() {
    return REWARD_TEMPLATES.map((template) => ({ ...template }));
  }

  function rewardTemplate(key) {
    const template = REWARD_TEMPLATES.find((value) => value.key === key);
    return template ? { ...template } : null;
  }

  return {
    redactForSummary,
    localSummary,
    weeklyBrief,
    bucketByLocalDate,
    startOfWeek,
    addLocalDays,
    monthGrid,
    yearMonths,
    dateKey,
    rewardTemplates,
    rewardTemplate,
  };
});
