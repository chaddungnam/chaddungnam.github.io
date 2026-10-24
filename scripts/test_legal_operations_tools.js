#!/usr/bin/env node
// Section 14 of the shared House Duck Privacy Policy (2026-10-20): Google refused the OAuth brand verification of the
// console's consent screen because /privacy/ did not describe the app's use of Google user data. Section 14 covers
// support email, the staff-only operations console with Google sign-in and its Gmail access (gmail.modify), with the
// Limited Use statement, in every legal language; Changes moved to section 15.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(repoDir, file), "utf8");
const POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";
const LIMITED_USE = {
  en: "House Duck’s use and transfer to any other app of information received from Google APIs will adhere to the "
    + `<a href="${POLICY_URL}" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.`,
  ko: /House Duck이 Google API로부터 받은 정보를 사용하고 다른 앱으로 전송하는 것은 제한된 사용\(Limited Use\) 요건을 포함한 <a href="[^"]+"[^>]*>Google API 서비스 사용자 데이터 정책<\/a>을 준수합니다\./,
  de: /Die Nutzung und Übertragung von Informationen, die House Duck von Google-APIs erhält, an andere Apps erfolgt gemäß der <a href="[^"]+"[^>]*>Richtlinie zu Nutzerdaten der Google API-Dienste<\/a> \(Google API Services User Data Policy\), einschließlich der Anforderungen zur eingeschränkten Nutzung \(Limited Use\)\./,
};
const TITLES = {
  en: ["14. Support Requests and House Duck’s Operations Tools", "15. Changes"],
  ko: ["14. 고객지원 요청 및 House Duck 운영 도구", "15. 변경"],
  de: ["14. Support-Anfragen und Betriebswerkzeuge von House Duck", "15. Änderungen"],
};

const ids = {};
for (const locale of ["en", "ko", "de"]) {
  const html = read(`privacy/${locale}.html`);
  ids[locale] = (html.match(/id="section-\d+"/g) || []).join(",");
  assert.ok(html.includes(`<h2 id="section-14">${TITLES[locale][0]}</h2>`), `${locale}: section 14 title`);
  assert.ok(html.includes(`<h2 id="section-15">${TITLES[locale][1]}</h2>`), `${locale}: Changes is section 15`);
  const heading13 = locale === "ko" ? "13. 딸깍 서바이벌 (10key Survival)" : "13. 10key Survival";
  assert.ok(html.includes(`<h2 id="section-13">${heading13}</h2>`), `${locale}: 10key Survival stays section 13`);
  const section = html.slice(html.indexOf('<h2 id="section-14">'), html.indexOf('<h2 id="section-15">'));
  if (locale === "en") assert.ok(section.includes(LIMITED_USE.en), "en: Limited Use sentence verbatim");
  else assert.match(section, LIMITED_USE[locale], `${locale}: Limited Use sentence`);
  assert.ok(section.includes(`href="${POLICY_URL}"`), `${locale}: links the Google API Services User Data Policy`);
  for (const fact of ["<code>https://www.googleapis.com/auth/gmail.modify</code>", "support@houseduck.in", "business@houseduck.in",
    "<code>houseduck.in/console/</code>", "Google Workspace", "Gmail", "72", "Supabase"]) {
    assert.ok(section.includes(fact), `${locale}: section 14 names ${fact}`);
  }
  // The console's AI summary is off (the only Gemini key is on the free tier, which may use content to improve Google's
  // products): section 14 must say mail text goes to no AI service, and never name Gemini as a mail recipient.
  assert.ok(section.includes({ en: "mail text is not sent to any AI service", ko: "메일 본문은 어떤 AI 서비스로도 전송되지 않습니다", de: "E-Mail-Texte werden an keinen KI-Dienst gesendet" }[locale]), `${locale}: no mail text to AI`);
  assert.ok(!section.includes("Gemini"), `${locale}: section 14 does not send mail to Gemini`);
  const changes = html.slice(html.indexOf('<h2 id="section-15">'));
  assert.match(changes, /^<h2 id="section-15">[^<]+<\/h2>\n<ul><li>/, `${locale}: section 15 is the change list`);
  // Newest first: v4.3 (10key Survival guest accounts and in-app purchases, October 20, 2026) above the unversioned name
  // update and v4.2 (this section 14) of the same day.
  assert.equal((changes.match(/\(v\d+\.\d+\)/) || [])[0], "(v4.3)", `${locale}: v4.3 is the newest versioned change entry`);
  assert.ok(changes.includes("(v4.2)"), `${locale}: the v4.2 entry for section 14 stays`);
  assert.match(html, /legal-update[^]*<time datetime="2026-10-24">/, `${locale}: last updated 2026-10-24`);
  assert.ok(/Google Workspace ?\(Gmail\)[^<]*Google Identity Services/.test(html.slice(html.indexOf('id="section-4"'), html.indexOf('id="section-5"'))),
    `${locale}: section 4 lists Google Workspace and Google Identity Services`);
  const scope = html.slice(html.indexOf('id="section-1"'), html.indexOf('id="section-2"'));
  assert.match(scope, /14/, `${locale}: section 1 says what section 14 covers`);
}
assert.equal(ids.ko, ids.en, "ko and en have the same section anchors");
assert.equal(ids.de, ids.en, "de and en have the same section anchors");

for (const file of ["privacy/index.html", "quirky-ball/privacy/index.html", "10key/privacy/index.html"]) {
  assert.ok(read(file).includes(LIMITED_USE.en), `${file}: entry page carries section 14`);
}
for (const file of ["index.html", "index_en.html"]) {
  assert.match(read(file), /<a href="privacy\/en\.html#section-14"[^>]*>House Duck Console \(staff only\)<\/a>/, `${file}: footer explains the console`);
}
const cs = read("console/cs.js");
assert.match(cs, /const AI_SUMMARY = false;/, "console: the AI summary stays off");
assert.match(cs, /if \(!AI_SUMMARY\) \{ state\.summaryCache\.set\(cacheKey, local\); return; \}/, "console: no cs-summarize call while it is off");
console.log("privacy section 14 (support and operations tools, Gmail Limited Use): PASS");
