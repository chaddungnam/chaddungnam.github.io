#!/usr/bin/env node

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(repoDir, file), "utf8");
}

const locales = {
  ko: {
    optional: /선택[^<]*(?:Firebase|분석)|Firebase[^<]*선택/,
    settings: /설정[^<]*(?:철회|변경)|(?:철회|변경)[^<]*설정/,
    sameGame: /거절[^<]*게임[^<]*(?:동일|제한)|게임[^<]*(?:동일|제한)[^<]*거절/,
    separate: /광고[^<]*(?:별도|분리)|(?:별도|분리)[^<]*광고/,
    history: /2026년 9월 5일[^<]*(?:Supabase|Firebase)/,
    supabaseRole: /House Duck[^<]*(?:개인정보처리자[^<]*Supabase|Supabase[^<]*개인정보처리자)[^<]*처리수탁자/,
    firebaseId: /앱 인스턴스 ID/,
  },
  en: {
    optional: /optional[^<]*Firebase|Firebase[^<]*optional/i,
    settings: /settings[^<]*(?:withdraw|change)|(?:withdraw|change)[^<]*settings/i,
    sameGame: /declin[^<]*(?:does not restrict|without restricting)[^<]*game|game[^<]*(?:same|restrict)[^<]*declin/i,
    separate: /advertis[^<]*(?:separate|distinct)|(?:separate|distinct)[^<]*advertis/i,
    history: /September 5, 2026[^<]*(?:Supabase|Firebase)/i,
    supabaseRole: /House Duck[^<]*controller[^<]*Supabase[^<]*processor/i,
    firebaseId: /app instance ID/i,
  },
  de: {
    optional: /optional[^<]*Firebase|Firebase[^<]*optional/i,
    settings: /Einstellungen[^<]*(?:widerruf|änder)|(?:widerruf|änder)[^<]*Einstellungen/i,
    sameGame: /Ablehn[^<]*(?:beschränkt|schränkt)[^<]*Spiel|Spiel[^<]*(?:gleich|einschränk)[^<]*Ablehn/i,
    separate: /Werbe[^<]*(?:getrennt|separat)|(?:getrennt|separat)[^<]*Werbe/i,
    history: /5\. September 2026[^<]*(?:Supabase|Firebase)/i,
    supabaseRole: /House Duck[^<]*Verantwortlicher[^<]*Supabase[^<]*Auftragsverarbeiter/i,
    firebaseId: /App-Instanz-ID/i,
  },
  ja: {
    optional: /任意[^<]*Firebase|Firebase[^<]*任意/,
    settings: /設定[^<]*(?:撤回|変更)|(?:撤回|変更)[^<]*設定/,
    sameGame: /拒否[^<]*ゲーム[^<]*(?:同じ|制限)|ゲーム[^<]*(?:同じ|制限)[^<]*拒否/,
    separate: /広告[^<]*(?:別|分離)|(?:別|分離)[^<]*広告/,
    history: /2026年9月5日[^<]*(?:Supabase|Firebase)/,
    supabaseRole: /House Duck[^<]*(?:管理者[^<]*Supabase|Supabase[^<]*管理者)[^<]*処理者/,
    firebaseId: /アプリインスタンスID/,
  },
};

test("localized legal documents distinguish required Supabase operations from optional Firebase Analytics", () => {
  for (const [locale, copy] of Object.entries(locales)) {
    const privacy = read(`privacy/${locale}.html`);
    const terms = read(`quirky-ball/terms/${locale}.html`);
    const privacyText = privacy.replace(/<[^>]+>/g, " ");

    assert.match(privacy, /Supabase \(Supabase Inc\.\)/, `${locale} privacy must identify Supabase`);
    assert.match(privacyText, copy.supabaseRole, `${locale} privacy must state the Supabase processing roles`);
    assert.match(privacy, /https:\/\/supabase\.com\/legal\/customer-resources\/data-processing-addendum/, `${locale} privacy must link the Supabase DPA`);
    assert.match(privacy, /Firebase Analytics/, `${locale} privacy must identify Firebase Analytics separately`);
    assert.match(privacy, copy.optional, `${locale} privacy must say Firebase Analytics is optional`);
    assert.match(privacy, copy.firebaseId, `${locale} privacy must not omit the Firebase app-instance identifier`);
    assert.match(privacy, copy.settings, `${locale} privacy must explain settings withdrawal`);
    assert.match(privacy, /https:\/\/firebase\.google\.com\/support\/privacy/, `${locale} privacy must link to Firebase privacy information`);
    assert.match(privacy, /1\.1\.2[^<]*(?:build\s*)?53/i, `${locale} privacy must scope the controls to app 1.1.2 build 53 or later`);

    assert.match(terms, copy.sameGame, `${locale} terms must say refusal does not restrict the game`);
    assert.match(terms, copy.separate, `${locale} terms must distinguish analytics from ad consent`);
    assert.match(terms, copy.history, `${locale} terms must record the September 5 analytics clarification`);
    assert.match(terms, /1\.1\.2[^<]*(?:build\s*)?53/i, `${locale} terms must scope the controls to app 1.1.2 build 53 or later`);
    assert.match(privacy, copy.history, `${locale} privacy must record the September 5 analytics clarification`);
  }
});

test("legacy Quirky Ball privacy URLs keep routing each language to the shared policy", () => {
  for (const locale of Object.keys(locales)) {
    const legacy = read(`quirky-ball/privacy/${locale}.html`);
    assert.match(legacy, new RegExp(`http-equiv="refresh" content="0;url=/privacy/${locale}\\.html"`, "i"));
    assert.ok(legacy.includes(`href="/privacy/${locale}.html"`), `${locale} legacy page needs an accessible continue link`);
    assert.ok(legacy.includes(`href="https://houseduck.in/privacy/${locale}.html"`), `${locale} legacy page needs the shared canonical URL`);
  }
});
