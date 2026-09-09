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

    assert.match(privacy, /Supabase Pte\. Ltd\./, `${locale} privacy must identify the published Supabase DPA entity`);
    assert.match(privacyText, copy.supabaseRole, `${locale} privacy must state the Supabase processing roles`);
    assert.match(privacy, /https:\/\/supabase\.com\/legal\/customer-resources\/data-processing-addendum/, `${locale} privacy must link the Supabase DPA`);
    assert.match(privacy, /Firebase Analytics/, `${locale} privacy must identify Firebase Analytics separately`);
    assert.match(privacy, copy.optional, `${locale} privacy must say Firebase Analytics is optional`);
    assert.match(privacy, copy.firebaseId, `${locale} privacy must not omit the Firebase app-instance identifier`);
    assert.match(privacy, copy.settings, `${locale} privacy must explain settings withdrawal`);
    assert.match(privacy, /https:\/\/firebase\.google\.com\/support\/privacy/, `${locale} privacy must link to Firebase privacy information`);
    assert.match(privacy, /1\.1\.2[^<]*(?:build\s*)?53/i, `${locale} privacy must identify the legacy Firebase-only release`);

    assert.match(terms, copy.sameGame, `${locale} terms must say refusal does not restrict the game`);
    assert.match(terms, copy.separate, `${locale} terms must distinguish analytics from ad consent`);
    assert.match(terms, copy.history, `${locale} terms must record the September 5 analytics clarification`);
    assert.match(terms, /1\.1\.2[^<]*(?:build\s*)?53/i, `${locale} terms must identify the legacy Firebase-only release`);
    assert.match(privacy, copy.history, `${locale} privacy must record the September 5 analytics clarification`);
  }
});

test("age and combined analytics controls are conditional, not retroactive public-build claims", () => {
  const copy = {
    ko: { scope: /연령 확인[^<]*통합 분석 안내[^<]*표시되는 앱/, noRetro: /기존[^<]*Firebase[^<]*소급[^<]*확대하지/, ttl: /24시간/, age: /14~17/ },
    en: { scope: /app that displays[^<]*age confirmation[^<]*combined analytics notice/i, noRetro: /previous[^<]*Firebase[^<]*not[^<]*retroactively extend/i, ttl: /24 hours/i, age: /14–17/ },
    de: { scope: /App, die[^<]*Altersbestätigung[^<]*gemeinsamen Analysehinweis anzeigt/i, noRetro: /frühere[^<]*Firebase[^<]*nicht rückwirkend erweitert/i, ttl: /24 Stunden/i, age: /14–17/ },
    ja: { scope: /年齢確認[^<]*統合分析の案内[^<]*表示されるアプリ/, noRetro: /以前[^<]*Firebase[^<]*遡及[^<]*拡張しません/, ttl: /24時間/, age: /14～17/ },
  };
  for (const [locale, checks] of Object.entries(copy)) {
    const privacy = read(`privacy/${locale}.html`);
    const terms = read(`quirky-ball/terms/${locale}.html`);
    for (const [name, html] of [["privacy", privacy], ["terms", terms]]) {
      const text = html.replace(/<[^>]+>/g, " ");
      assert.match(text, checks.scope, `${locale} ${name}: scope controls to the displayed notice`);
      assert.match(text, checks.noRetro, `${locale} ${name}: no retroactive expansion of Firebase consent`);
      assert.match(text, checks.age, `${locale} ${name}: explain teen use`);
      assert.match(html, /datetime="2026-09-09"/, `${locale} ${name}: current clarification date`);
    }
    assert.match(privacy, checks.ttl, `${locale}: disclose app-managed pending-event expiry`);
    assert.match(privacy, /0[^<]*14[^<]*18/, `${locale}: disclose local age-band codes`);
    assert.match(privacy, /https:\/\/legal\.applovin\.com\/policies-publishers\//, `${locale}: link activation requirements`);
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
