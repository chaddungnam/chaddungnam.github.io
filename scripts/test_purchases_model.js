const assert = require("node:assert/strict");
const model = require("../console/purchases-model.js");

const empty = model.normalize();
assert.equal(empty.connected, false);
assert.deepEqual(empty.purchases, []);
assert.equal(empty.page, 1);
assert.equal(model.formatMoney(1990000, "EUR"), "€1.99");
for (const missing of [null, undefined, "", "  ", false, -1, NaN]) {
  assert.equal(model.formatMoney(missing, "EUR"), "금액 미기록");
}
assert.equal(model.formatMoney(0, "EUR"), "€0.00");
assert.equal(model.formatMoney("1990000", "EUR"), "€1.99");
assert.equal(model.formatRate(0.125), "13%");
assert.equal(model.STATUS_LABELS.refunded, "환불");
assert.equal(model.PRODUCT_LABELS.remove_ads, "광고 제거");
console.log("Purchase console model: PASS");
