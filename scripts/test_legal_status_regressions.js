const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expected = {
  "privacy/ko.html": ["시행일: 2026년 10월 5일", "2026년 10월 5일 시행"],
  "privacy/en.html": ["Effective date: October 5, 2026", "Effective October 5, 2026", "10KEY additions: October 19, 2026", "Effective October 19, 2026 (v4.1)"],
  "10key/terms/en.html": ["Effective date: October 19, 2026", "Effective October 19, 2026 (v1.0)"],
  "10key/terms/ko.html": ["시행일: 2026년 10월 19일", "2026년 10월 19일 시행(v1.0)"],
};
expected["privacy/ko.html"].push("10KEY 추가분: 2026년 10월 19일", "2026년 10월 19일 시행(v4.1)");

for (const [file, phrases] of Object.entries(expected)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  for (const phrase of phrases) assert.ok(html.includes(phrase), `${file}: missing ${phrase}`);
  assert.doesNotMatch(html, /1인 사업자|sole proprietor|Einzelunternehmer|個人事業主/, `${file}: unconfirmed business status`);
}

for (const file of ["ko", "en", "de", "ja"].map((locale) => `impressum/${locale}.html`)) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(html, /1인 개인사업자|sole proprietorship|Einzelunternehmen|個人事業主/, `${file}: unconfirmed business status`);
}

console.log("legal effective-status labels: PASS");
