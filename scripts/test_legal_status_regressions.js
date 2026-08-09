const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expected = {
  "privacy/ko.html": ["시행 예정일: 2026년 8월 24일", "2026년 8월 24일 시행 예정"],
  "privacy/en.html": ["Planned effective date: August 24, 2026", "Planned for August 24, 2026"],
  "privacy/de.html": ["Geplantes Inkrafttreten: 24. August 2026", "Geplant für den 24. August 2026"],
  "privacy/ja.html": ["発効予定日：2026年8月24日", "2026年8月24日に発効予定"],
};

for (const [file, phrases] of Object.entries(expected)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  for (const phrase of phrases) assert.ok(html.includes(phrase), `${file}: missing ${phrase}`);
  assert.doesNotMatch(html, /1인 사업자|sole proprietor|Einzelunternehmer|個人事業主/, `${file}: unconfirmed business status`);
}

for (const file of ["ko", "en", "de", "ja"].map((locale) => `impressum/${locale}.html`)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(html, /1인 개인사업자|sole proprietorship|Einzelunternehmen|個人事業主/, `${file}: unconfirmed business status`);
}

console.log("legal future-status labels: PASS");
