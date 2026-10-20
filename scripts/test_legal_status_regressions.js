const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expected = {
  "privacy/ko.html": ["시행일: 2026년 10월 5일", "2026년 10월 5일 시행"],
  "privacy/en.html": ["Effective date: October 5, 2026", "Effective October 5, 2026", "10key Survival additions: October 19, 2026", "Effective October 19, 2026 (v4.1)",
    "10key Survival guest accounts and in-app purchases: October 20, 2026", "Effective October 20, 2026 (v4.3)"],
  "privacy/de.html": ["Inkrafttreten: 5. Oktober 2026", "Wirksam ab 5. Oktober 2026", "Ergänzungen zu 10key Survival: 19. Oktober 2026", "Wirksam ab 19. Oktober 2026 (v4.1)",
    "Gastkonten und In-App-Käufe in 10key Survival: 20. Oktober 2026", "Wirksam ab 20. Oktober 2026 (v4.3)"],
  // 10key Survival terms v1.1 (2026-10-20): guest accounts and in-app purchases on Android / iOS; v1.0 stays in the history.
  "10key/terms/en.html": ["Effective date: October 20, 2026", "Effective October 20, 2026 (v1.1)", "Effective October 19, 2026 (v1.0)"],
  "10key/terms/ko.html": ["시행일: 2026년 10월 20일", "2026년 10월 20일 시행(v1.1)", "2026년 10월 19일 시행(v1.0)"],
};
expected["privacy/ko.html"].push("딸깍 서바이벌 추가분: 2026년 10월 19일", "2026년 10월 19일 시행(v4.1)",
  "딸깍 서바이벌 게스트 계정 및 인앱 구매: 2026년 10월 20일", "2026년 10월 20일 시행(v4.3)");

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
