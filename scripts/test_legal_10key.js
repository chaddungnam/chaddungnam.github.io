#!/usr/bin/env node
// 10KEY legal contract (2026-10-19): the shared House Duck Privacy Policy covers 10KEY in section 13, 10KEY has its
// own Terms like Quirky Ball, /10key/privacy/ redirects to that section, and both documents read correctly on every
// platform (CrazyGames first; Google Play, the Apple App Store and Steam later). Terms: English + Korean only; the shared
// privacy policy also has German (owner 2026-10-20), whose section 13 links the English 10KEY Terms.
// Owner decision (22), 2026-10-20: the Android / iOS apps have a House Duck guest account (age question, nickname,
// anonymous Supabase Auth login) and in-app purchases (gem keycaps, Revive Pass); privacy v4.3 and terms v1.1 say so.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(repoDir, file), "utf8");
const exists = (file) => fs.existsSync(path.join(repoDir, file));
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const locales = ["en", "ko"];
const platforms = ["CrazyGames", "Google Play", "App Store", "Steam"];
// Quirky-Ball-only features that must not leak into the 10KEY documents. Gems (gem keycaps / 보석 키캡), the age
// question and the age band became 10KEY features on 2026-10-20 (mobile guest account and shop), so they left this list.
const quirkyOnly = /AdMob|AppLovin|Firebase|Starter|yakwon|약원|Remove Ads|광고 제거|Sign in with Apple|Apple로 로그인|젬|\bUMP\b|\bATT\b|Quick Report|간단하게 제보|연령대|출생 연도/i;

// Store names (owner 2026-10-20, before release): 10key Survival in English and German, 딸깍 서바이벌 in Korean.
// 10KEY was only the project name; URLs, file names and anchors (/10key/, #10key, #section-13) stay as they are.
const HEADING13 = { en: "13. 10key Survival", de: "13. 10key Survival", ko: "13. 딸깍 서바이벌 (10key Survival)" };

function section13(locale) {
  const html = read(`privacy/${locale}.html`);
  const start = html.indexOf(`<h2 id="section-13">${HEADING13[locale]}</h2>`);
  const end = html.indexOf('<h2 id="section-14">');
  assert.ok(start > 0 && end > start, `${locale}: 10KEY is section 13, followed by section 14`);
  return html.slice(start, end);
}

test("the shared privacy policy describes 10KEY in section 13 with the confirmed facts", () => {
  const facts = {
    en: [/offline/, /only on your device or in your browser’s storage/, /does not receive this save/, /weekly board and an all-time board/,
      /separate part \(schema\)/, /without sending an account or player identifier/, /IP address and HTTP request metadata/,
      /today: a CrazyGames account/, /no device identifier is created/, /CrazyGames userId/, /token itself is not stored/,
      /display name \(username\)/, /avatar image/, /depth, scrap, combo, number of skills, how the run ended, game build, platform name and an anti-cheat flag/,
      /Art\. 6\(1\)\(b\)/, /Art\. 6\(1\)\(f\)/, /eu-west-1/, /independent controller/, /loading and gameplay events, sign-in state, the user token and celebration events/,
      /12 weeks/, /35 days/, /90 days/, /6 months \(183 days\)/, /platform username/, /no analytics SDK and no advertising SDK of its own/,
      /no advertising identifiers/, /no payment card data/, /not directed to children under 14/, /permission of a parent or guardian/, /human review/,
      // Android / iOS guest account and in-app purchases (2026-10-20)
      /signs in anonymously at Supabase Auth \(no email address, no password, no phone number\)/, /year and month themselves are not saved and not sent/,
      /Under 14: the app creates no account/, /stored only in the app’s save on your device/, /one-way hash \(SHA-256\) of your login ID/,
      /passes no account identifier to Apple/, /Art\. 6\(1\)\(c\)/, /Google and Apple process in-app purchases/, /Hold to delete account/,
      /unless another House Duck game uses the same login/, /kept without the link to your account/, /Logging out does not delete/,
      /The Android and iOS apps show no ads/, /There is no House Duck account on CrazyGames/],
    ko: [/오프라인/, /기기 또는 브라우저 저장소에만 저장/, /저장 데이터를 받지 않습니다/, /주간 순위표와 전체 기간 순위표/,
      /별도 영역\(스키마\)/, /계정이나 플레이어 식별자를 보내지 않습니다/, /IP 주소와 HTTP 요청 메타데이터/,
      /현재는 CrazyGames 계정/, /기기 식별자도 만들어지지 않습니다/, /CrazyGames userId/, /토큰 자체는 저장하지 않습니다/,
      /표시 이름\(사용자 이름\)/, /아바타 이미지/, /깊이, 스크랩, 콤보, 스킬 수, 플레이가 끝난 원인, 게임 빌드, 플랫폼 이름, 부정행위 방지 표시/,
      /제6조 제1항 b호/, /제6조 제1항 f호/, /eu-west-1/, /독립된 개인정보처리자/, /로딩 및 게임플레이 이벤트, 로그인 상태, 사용자 토큰, 축하 이벤트/,
      /12주/, /35일/, /90일/, /6개월\(183일\)/, /플랫폼 사용자 이름/, /분석 SDK도 광고 SDK도 포함되어 있지 않으며/,
      /광고 식별자를 받지 않습니다/, /결제 카드 정보를 받지 않습니다/, /만 14세 미만/, /부모 또는 보호자의 허락/, /사람의 검토/,
      /Supabase Auth에 익명으로 로그인하고\(이메일 주소, 비밀번호, 전화번호 없음\)/, /해와 달 자체는 저장하지도, 전송하지도 않습니다/,
      /만 14세 미만: 앱은 계정을 만들지 않습니다/, /기기의 앱 저장 데이터에만 보관/, /로그인 ID의 단방향 해시\(SHA-256\)/,
      /Apple에 계정 식별자를 전달하지 않습니다/, /제6조 제1항 c호/, /Google과 Apple ?은 Android 및 iOS 앱의 인앱 구매/, /길게 눌러 계정 삭제/,
      /다른 House Duck 게임이 같은 로그인을 쓰지 않으면/, /계정과의 연결 없이 보관/, /로그아웃해도 당사 서버의 계정 데이터는 삭제되지 않습니다/,
      /Android 및 iOS 앱에는 광고가 없습니다/, /CrazyGames에는 House Duck 계정이 없습니다/],
  };
  for (const locale of locales) {
    const section = section13(locale);
    const plain = text(section);
    for (const fact of facts[locale]) assert.match(plain, fact, `${locale} section 13: ${fact}`);
    for (const platform of platforms) assert.ok(plain.includes(platform), `${locale} section 13 names ${platform} as an example platform`);
    assert.doesNotMatch(plain, quirkyOnly, `${locale} section 13: no Quirky-Ball-only feature`);
    assert.ok(section.includes(`href="/10key/terms/${locale}.html"`), `${locale} section 13 links the 10KEY terms`);
    assert.ok(section.includes("support@houseduck.in"), `${locale} section 13 names the deletion contact`);
  }
});

test("the shared policy scopes sections 2 to 12 to Quirky Ball and the website", () => {
  const scope = {
    en: ["The titles currently covered are the mobile game <strong>Quirky Ball</strong> (Android, iOS) and the arcade game <strong>10key Survival</strong>.",
      "Sections 2 to 12 describe Quirky Ball 2.0.0 and later and the website, unless stated otherwise.",
      "A guest account is created when Quirky Ball is first used.", "are required to provide Quirky Ball."],
    ko: ["현재 본 방침이 적용되는 타이틀은 모바일 게임 <strong>Quirky Ball</strong>(Android, iOS)과 아케이드 게임 <strong>딸깍 서바이벌</strong>(10key Survival)입니다.",
      "제2항부터 제12항까지는 별도의 언급이 없는 한 Quirky Ball 2.0.0 이후 버전과 웹사이트를 기준으로 설명합니다.",
      "Quirky Ball을 처음 이용할 때 게스트 계정이 생성됩니다.", "Quirky Ball을 제공하기 위해서는 게스트 UID,"],
  };
  for (const locale of locales) {
    const html = read(`privacy/${locale}.html`);
    for (const phrase of scope[locale]) assert.ok(html.includes(phrase), `${locale}: ${phrase}`);
    assert.match(html, /datetime="2026-10-25"/, `${locale}: last updated 2026-10-25`);
    assert.equal((html.match(/id="section-15"/g) || []).length, 1, `${locale}: Changes is section 15`);
  }
});

test("the German shared policy has the same section 13 and Quirky Ball scoping", () => {
  const section = section13("de");
  const plain = text(section);
  const facts = [/offline/, /nur auf Ihrem Gerät oder im Speicher Ihres Browsers/, /erhält diesen Spielstand nicht/,
    /Wochenrangliste und eine Rangliste aller Zeiten/, /getrennten Teil \(Schema\)/, /ohne eine Konto- oder Spielerkennung zu senden/,
    /IP-Adresse und HTTP-Anfrage-Metadaten/, /derzeit: ein CrazyGames-Konto/, /keine Gerätekennung/, /CrazyGames-userId/,
    /Token selbst wird nicht gespeichert/, /Anzeigename auf der Plattform \(Benutzername\)/, /Profilbild/,
    /Tiefe, Scrap, Combo, Anzahl der Fähigkeiten, wie der Run endete, Spielversion \(Build\), Name der Plattform und ein Anti-Cheat-Kennzeichen/,
    /Art\. 6 Abs\. 1 Buchst\. b/, /Art\. 6 Abs\. 1 Buchst\. f/, /eu-west-1/, /eigenständig Verantwortliche/,
    /Lade- und Spielereignisse, den Anmeldestatus, das Nutzer-Token und Feier-Ereignisse/, /12 Wochen/, /35 Tagen/, /90 Tagen/,
    /6 Monate \(183 Tage\)/, /Benutzernamen auf der Plattform/, /kein Analyse-SDK und kein eigenes Werbe-SDK/, /keine Werbekennungen/,
    /keine Zahlungskartendaten/, /nicht an Kinder unter 14 Jahren/, /Erlaubnis eines Elternteils/, /menschliche Überprüfung/,
    /meldet sich dann anonym bei Supabase Auth an \(keine E-Mail-Adresse, kein Passwort, keine Telefonnummer\)/,
    /Jahr und Monat selbst werden weder gespeichert noch gesendet/, /Unter 14: Die App legt kein Konto an/,
    /nur im Spielstand der App auf Ihrem Gerät gespeichert/, /Einweg-Hash \(SHA-256\) Ihrer Login-ID/, /übergibt die App Apple keine Kontokennung/,
    /Art\. 6 Abs\. 1 Buchst\. c/, /Google und Apple verarbeiten In-App-Käufe/, /Hold to delete account/,
    /sofern kein anderes House-Duck-Spiel dieselbe Anmeldung verwendet/, /ohne Verbindung zu Ihrem Konto aufbewahrt/,
    /Das Abmelden löscht die Kontodaten auf unserem Server nicht/, /Die Android- und iOS-Apps zeigen keine Werbung/,
    /Auf CrazyGames gibt es kein House-Duck-Konto/];
  for (const fact of facts) assert.match(plain, fact, `de section 13: ${fact}`);
  for (const platform of platforms) assert.ok(plain.includes(platform), `de section 13 names ${platform} as an example platform`);
  assert.doesNotMatch(plain, quirkyOnly, "de section 13: no Quirky-Ball-only feature");
  assert.ok(section.includes('href="/10key/terms/en.html"') && /auf Englisch/.test(plain), "de section 13 links the English 10KEY terms and says so");
  assert.ok(section.includes("support@houseduck.in"), "de section 13 names the deletion contact");
  const html = read("privacy/de.html");
  for (const phrase of ["Die derzeit erfassten Titel sind das Mobile-Spiel <strong>Quirky Ball</strong> (Android, iOS) und das Arcade-Spiel <strong>10key Survival</strong>.",
    "Die Abschnitte 2 bis 12 beschreiben Quirky Ball 2.0.0 und später sowie die Website, sofern nicht anders angegeben.",
    "Ein Gastkonto wird angelegt, wenn Quirky Ball erstmals verwendet wird.", "sind erforderlich, um Quirky Ball bereitzustellen."]) {
    assert.ok(html.includes(phrase), `de: ${phrase}`);
  }
  assert.match(html, /datetime="2026-10-25"/, "de: last updated 2026-10-25");
  const ids = (file) => (read(file).match(/id="section-\d+"/g) || []).join(",");
  assert.equal(ids("privacy/de.html"), ids("privacy/en.html"), "de and en have the same section anchors");
  assert.equal((html.match(/<h3>/g) || []).length, (read("privacy/en.html").match(/<h3>/g) || []).length, "same subsections as en");
});

test("10KEY has its own en/ko Terms in the Quirky Ball structure", () => {
  const titles = {
    en: ["Overview and Acceptance", "The Service", "Accounts and Platforms", "Minors", "Purchases and Refunds", "Ads", "Online Rankings",
      "Fair Play and Prohibited Conduct", "Intellectual Property and Licence", "Statutory Conformity and Rights",
      "Availability and Changes to the Service", "Limitation of Liability", "Termination and Your Data", "Changes to These Terms",
      "Governing Law, Severability and Contact", "Effective Date and Revision History"],
    ko: ["개요 및 동의", "서비스", "계정 및 플랫폼", "미성년자", "구매 및 환불", "광고", "온라인 랭킹", "공정한 플레이 및 금지 행위",
      "지식재산권 및 이용 허락", "법정 적합성 및 권리", "서비스 제공 및 변경", "책임의 제한", "이용 종료 및 데이터", "본 약관의 변경",
      "준거법, 분리 가능성 및 연락처", "시행일 및 개정 이력"],
  };
  const required = {
    en: [/no House Duck account/, /no cash or real-world value and cannot be sold or exchanged for money/, /legitimate refund request/,
      /may show ads \(today on CrazyGames\)/, /remove or refuse records and exclude the player from the rankings/, /Section 327r/,
      /laws of Germany/, /remaining provisions remain in effect/, /remains playable without them/, /Offline play is not affected/,
      /creates a House Duck guest account for you, without an email address or password/, /Players under 14 play without an account/,
      /Google Play Billing on Android and the App Store on iOS/, /Restore purchases/, /Gems are consumable/,
      /cannot be transferred to another account or player/, /Gems already spent are not taken back/, /The Android and iOS apps show no ads/,
      /Hold to delete account/, /Effective October 20, 2026 \(v1\.1\)/],
    ko: [/House Duck 계정은 없습니다/, /현금 또는 현실 세계의 가치가 없으며, 판매하거나 돈으로 교환할 수 없습니다/, /정당한 환불 요청/,
      /광고를 표시할 수 있습니다\(현재 CrazyGames\)/, /기록을 삭제하거나 받지 않고, 해당 플레이어를 랭킹에서 제외/, /제327r조/,
      /독일법/, /나머지 조항은 계속 효력/, /온라인 기능 없이 계속 플레이할 수 있습니다/, /오프라인 플레이에 영향을 주지 않습니다/,
      /이메일 주소나 비밀번호 없이 House Duck 게스트 계정을 만듭니다/, /만 14세 미만은 계정 없이 플레이합니다/,
      /Android에서는 Google Play 결제, iOS에서는 App Store/, /구매 복원/, /보석은 소모성 상품/,
      /다른 계정이나 다른 플레이어에게 넘길 수 없고/, /이미 사용한 보석은 회수하지 않습니다/, /Android 및 iOS 앱에는 광고가 없습니다/,
      /길게 눌러 계정 삭제/, /2026년 10월 20일 시행\(v1\.1\)/],
  };
  for (const locale of locales) {
    const file = `10key/terms/${locale}.html`;
    const html = read(file);
    const plain = text(html);
    titles[locale].forEach((title, index) => {
      assert.ok(html.includes(`<h2 id="section-${index + 1}">${index + 1}. ${title}</h2>`), `${file}: section ${index + 1} ${title}`);
    });
    assert.equal((html.match(/<h2 id="section-/g) || []).length, 16, `${file}: 16 sections`);
    for (const marker of ["<!-- 문서 메타데이터 시작", "<!-- 문서 메타데이터 끝 -->", "<!-- 문서 본문 시작", "<!-- 문서 본문 끝 -->", "data-legal-content", "data-toc-list"]) {
      assert.ok(html.includes(marker), `${file}: ${marker}`);
    }
    assert.ok(html.indexOf("문서 메타데이터 끝") < html.indexOf("문서 본문 시작"), `${file}: metadata before body`);
    assert.match(html, /datetime="2026-10-20"/, `${file}: last updated 2026-10-20 (v1.1: guest accounts and in-app purchases)`);
    for (const platform of platforms) assert.ok(plain.includes(platform), `${file} names ${platform} as an example platform`);
    for (const fact of required[locale]) assert.match(plain, fact, `${file}: ${fact}`);
    assert.doesNotMatch(plain, quirkyOnly, `${file}: no Quirky-Ball-only feature`);
    assert.ok(html.includes(`href="/privacy/${locale}.html#section-13"`), `${file}: links its privacy section`);
    assert.ok(html.includes('href="mailto:support@houseduck.in"'), `${file}: contact`);
    assert.ok(html.includes("Ringstr. 23, 61476 Kronberg im Taunus"), `${file}: operator address`);
  }
});

test("10KEY privacy URLs redirect to the shared policy and the terms selector offers 10KEY", () => {
  for (const locale of locales) {
    const redirect = read(`10key/privacy/${locale}.html`);
    assert.ok(redirect.includes(`http-equiv="refresh" content="0;url=/privacy/${locale}.html#section-13"`), `${locale}: redirect to section 13`);
    assert.ok(redirect.includes(`rel="canonical" href="https://houseduck.in/privacy/${locale}.html"`), `${locale}: shared canonical`);
    assert.ok(redirect.includes(`href="/privacy/${locale}.html#section-13"`), `${locale}: continue link`);
    assert.doesNotMatch(redirect, /data-legal-content/, `${locale}: the old standalone notice is gone`);
    assert.ok(read(`terms/${locale}.html`).includes(`href="../10key/terms/${locale}.html"`), `${locale}: terms selector card`);
  }
  for (const locale of ["de", "ja"]) {
    assert.ok(!exists(`10key/terms/${locale}.html`) && !exists(`10key/privacy/${locale}.html`), `10KEY has no ${locale} legal page`);
  }
  const home = read("10key/index.html");
  assert.match(home, /href="terms\/"/);
  assert.match(home, /href="privacy\/"/);
  const sitemap = read("sitemap.xml");
  assert.ok(!sitemap.includes("https://houseduck.in/10key/privacy/"), "10KEY privacy redirects stay out of the sitemap");
});

test("public pages use the store names; the old name 10KEY appears only in the dated rename log line", () => {
  const pages = ["privacy/en.html", "privacy/ko.html", "privacy/de.html", "privacy/index.html", "quirky-ball/privacy/index.html",
    "10key/privacy/index.html", "10key/privacy/en.html", "10key/privacy/ko.html", "10key/terms/en.html", "10key/terms/ko.html",
    "10key/terms/index.html", "terms/en.html", "terms/ko.html", "terms/de.html", "10key/index.html"];
  const renameLine = /^(Name update October 20, 2026|Namensänderung 20\. Oktober 2026|2026년 10월 20일 명칭 변경) — /;
  for (const file of pages) {
    const html = read(file);
    const korean = /<html lang="ko"/.test(html) && !file.startsWith("10key/index");
    assert.ok(html.includes(korean ? "딸깍 서바이벌" : "10key Survival"), `${file}: names the game by its store name`);
    if (korean) assert.match(text(html), /딸깍 서바이벌 ?\(10key Survival\)/, `${file}: ties the Korean name to 10key Survival`);
    const items = html.split(/<li>/).filter((part) => part.includes("10KEY"));
    assert.ok((html.match(/10KEY/g) || []).length === items.length && items.length <= 1, `${file}: 10KEY at most once, in a list item`);
    for (const item of items) {
      assert.match(text(item), renameLine, `${file}: 10KEY only in the October 20, 2026 rename entry`);
      assert.match(item, /10key Survival/, `${file}: rename entry names the new name`);
    }
  }
  const privacyLogs = { en: "privacy/en.html", ko: "privacy/ko.html", de: "privacy/de.html" };
  for (const file of Object.values(privacyLogs)) assert.equal((read(file).match(/10KEY/g) || []).length, 1, `${file}: one rename entry`);
  const home = read("10key/index.html");
  assert.match(home, /<h1 id="game-title">.*10key Survival.*딸깍 서바이벌.*<\/h1>/, "/10key/ shows both store names");
});

// 2026-10-25: section 13 lists the run record (every finished run, store apps, install ID, 90 days) in every language.
test("section 13 covers the 10key Survival run records in every language", () => {
  for (const [locale, words] of Object.entries({ en: ["<td>Run records</td>", "at most 24 per run", "Run records: deleted after 90 days", "do not send these three"],
    ko: ["<td>판 기록</td>", "한 판에 최대 24장", "판 기록: 90일 후 삭제됩니다", "이 셋을 보내지 않으며"],
    de: ["<td>Run-Protokolle</td>", "höchstens 24 pro Run", "Run-Protokolle: werden nach 90 Tagen gelöscht", "diese drei nicht"] })) {
    const html = fs.readFileSync(path.join(repoDir, "privacy", `${locale}.html`), "utf8");
    const s13 = html.slice(html.indexOf('id="section-13"'), html.indexOf('id="section-14"'));
    for (const w of words) assert.ok(s13.includes(w), `${locale}: ${w}`);
  }
});

// 2026-10-24: section 13 tells visitors about the launch pre-registration on /10key/ (double opt-in, consent, Resend, 30 days).
test("section 13 covers the 10key Survival launch pre-registration in every language", () => {
  for (const [locale, words] of Object.entries({ en: ["Double opt-in", "Art. 6(1)(a) GDPR", "Resend", "30 days"], ko: ["더블 옵트인", "제6조 제1항 a호", "Resend", "30일"], de: ["Double-Opt-in", "Art. 6 Abs. 1 lit. a DSGVO", "Resend", "30 Tagen"] })) {
    const html = fs.readFileSync(path.join(repoDir, "privacy", `${locale}.html`), "utf8");
    const s13 = html.slice(html.indexOf('id="section-13"'), html.indexOf('id="section-14"'));
    assert.match(s13, /id="10key-prereg"/, `${locale}: pre-registration subsection`);
    for (const w of words) assert.ok(s13.includes(w), `${locale}: ${w}`);
  }
});
