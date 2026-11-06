const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expected = {
  "privacy/ko.html": ["시행일: 2026년 10월 5일", "2026년 10월 5일 시행"],
  "privacy/en.html": ["Effective date: October 5, 2026", "Effective October 5, 2026", "Effective October 19, 2026 (v4.1)",
    "Effective October 20, 2026 (v4.3)"],
  "privacy/de.html": ["Inkrafttreten: 5. Oktober 2026", "Wirksam ab 5. Oktober 2026", "Wirksam ab 19. Oktober 2026 (v4.1)",
    "Wirksam ab 20. Oktober 2026 (v4.3)"],
  // 10key Survival terms v1.5 (2026-11-03): module boxes, the free daily box and the 30-claims rewards; v1.4 (section 8 daily scrap limit / earnings review / look-alike reverse engineering) and older stay in the history.
  "10key/terms/en.html": ["Effective date: November 4, 2026", "Effective November 4, 2026 (v1.6)", "Effective November 3, 2026 (v1.5)", "Effective November 2, 2026 (v1.4)", "Effective November 1, 2026 (v1.3)", "Effective October 31, 2026 (v1.2)", "Effective October 20, 2026 (v1.1)", "Effective October 19, 2026 (v1.0)"],
  "10key/terms/ko.html": ["시행일: 2026년 11월 4일", "2026년 11월 4일 시행(v1.6)", "2026년 11월 3일 시행(v1.5)", "2026년 11월 2일 시행(v1.4)", "2026년 11월 1일 시행(v1.3)", "2026년 10월 31일 시행(v1.2)", "2026년 10월 20일 시행(v1.1)", "2026년 10월 19일 시행(v1.0)"],
};
expected["privacy/ko.html"].push("2026년 10월 19일 시행(v4.1)", "2026년 10월 20일 시행(v4.3)");

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
