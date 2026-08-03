const assert = require("node:assert/strict");
const intelligence = require("../console/cs-intelligence.js");

const redacted = intelligence.redactForSummary(`
  홍길동 <player@example.com> / +49 151 12345678
  플레이어 pABCDEFGHJK, 주문 1234567890123456
  https://example.com/ticket/123 화면에서 결제가 두 번 됐어요.
`);
assert.doesNotMatch(redacted, /player@example|151 12345678|pABCDEFGHJK|1234567890123456|https:\/\//i);
assert.match(redacted, /결제가 두 번 됐어요/);
assert.ok(intelligence.redactForSummary("가".repeat(5000)).length <= 4000);

assert.deepEqual(
  intelligence.localSummary({ subject: "결제 취소", text: "상품 결제가 두 번 되었고 환불이 필요합니다." }),
  {
    summary: "상품 결제가 두 번 되었고 환불이 필요합니다.",
    category: "billing",
    urgency: "high",
    source: "local",
  },
);
assert.equal(intelligence.localSummary({ subject: "로그인", text: "계정에 로그인이 안 됩니다." }).category, "account");
assert.equal(intelligence.localSummary({ subject: "튕김", text: "게임 실행 후 계속 튕겨요." }).category, "bug");
assert.ok(intelligence.localSummary({ subject: "문의", text: "안녕하세요.\n\n문의드립니다." }).summary.length > 0);

const monday = Date.parse("2026-08-03T00:00:00+02:00");
const items = [
  { id: "1", latestAt: monday + 1_000, status: "new", category: "bug", urgent: false },
  { id: "2", latestAt: monday + 2_000, status: "needs_reply", category: "bug", urgent: true },
  { id: "3", latestAt: monday + 3_000, status: "waiting_customer", category: "billing", urgent: false },
  { id: "4", latestAt: Date.parse("2026-07-30T12:00:00+02:00"), status: "done", category: "other", urgent: false },
];
const brief = intelligence.weeklyBrief(items, Date.parse("2026-08-05T12:00:00+02:00"));
assert.equal(brief.total, 3);
assert.equal(brief.needsReply, 1);
assert.equal(brief.urgent, 1);
assert.equal(brief.topCategory, "bug");
assert.match(brief.headline, /버그/);

const buckets = intelligence.bucketByLocalDate(items);
assert.equal(buckets.get("2026-08-03").length, 3);
assert.equal(buckets.get("2026-07-30").length, 1);
assert.equal(intelligence.startOfWeek(new Date("2026-08-05T12:00:00+02:00")).getDay(), 1);
assert.equal(intelligence.monthGrid(new Date("2026-08-05T12:00:00+02:00")).length, 42);
assert.equal(intelligence.yearMonths(new Date("2026-08-05T12:00:00+02:00")).length, 12);
assert.equal(intelligence.addLocalDays(new Date(2026, 2, 28, 12), 1).getHours(), 12);

assert.deepEqual(intelligence.rewardTemplate("maintenance"), {
  key: "maintenance",
  label: "점검 보상",
  titleKey: "mail_maintenance_title",
  bodyKey: "mail_maintenance_body",
  mailType: "maintenance",
});
assert.equal(intelligence.rewardTemplate("custom"), null);
assert.equal(intelligence.rewardTemplates().length, 7);

console.log("cs intelligence: PASS");
