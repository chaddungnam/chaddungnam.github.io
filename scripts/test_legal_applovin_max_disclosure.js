#!/usr/bin/env node

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoDir = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(repoDir, file), "utf8");
}

const localeCopy = {
  ko: {
    planned: /AppLovin MAX[^<]*(?:도입 준비 중|준비)/,
    noCurrentTransfer: /현재[^<]*AppLovin MAX[^<]*(?:정보 전송|전송)[^<]*(?:하지 않습니다|없습니다)/,
    beforeActivation: /활성화 전[^<]*(?:수신자|데이터|국가|근거|권리)[^<]*(?:동의|non-child|아동 아님|판정)/,
  },
  en: {
    planned: /AppLovin MAX[^<]*(?:preparation|planned|not yet active)/i,
    noCurrentTransfer: /currently[^<]*not[^<]*(?:send|transmit|share)[^<]*AppLovin MAX/i,
    beforeActivation: /before activation[^<]*(?:recipient|data|countries|basis|rights)[^<]*(?:consent|non-child|child eligibility)/i,
  },
  de: {
    planned: /AppLovin MAX[^<]*(?:Vorbereitung|geplant|noch nicht aktiv)/i,
    noCurrentTransfer: /derzeit[^<]*keine[^<]*(?:Übermittlung|Weitergabe)[^<]*AppLovin MAX/i,
    beforeActivation: /vor der Aktivierung[^<]*(?:Empfänger|Daten|Länder|Rechtsgrundlage|Rechte)[^<]*(?:Einwilligung|Non-Child|Kind)/i,
  },
  ja: {
    planned: /AppLovin MAX[^<]*(?:導入準備中|予定|まだ有効ではありません)/,
    noCurrentTransfer: /現在[^<]*AppLovin MAX[^<]*(?:送信|提供)[^<]*(?:していません|ありません)/,
    beforeActivation: /有効化前[^<]*(?:受領者|データ|国|根拠|権利)[^<]*(?:同意|non-child|子どもではない|判定)/,
  },
};

test("privacy pages disclose planned AppLovin MAX without presenting it as live", () => {
  for (const [locale, copy] of Object.entries(localeCopy)) {
    const privacy = read(`privacy/${locale}.html`);
    const section4 = privacy.slice(
      privacy.indexOf('id="section-4"'),
      privacy.indexOf('id="section-5"'),
    );
    const section8Start = privacy.indexOf('id="section-8"');
    const section9Start = privacy.indexOf('id="section-9"');
    const appLovinIndex = privacy.indexOf("AppLovin MAX");

    assert.equal(section4.includes("AppLovin"), false, `${locale}: AppLovin must not be mixed into the live recipient table yet`);
    assert.ok(appLovinIndex > section8Start && appLovinIndex < section9Start, `${locale}: AppLovin MAX notice must live in the ad/analytics choice section`);
    assert.match(privacy, /https:\/\/legal\.applovin\.com\/privacy\//, `${locale}: AppLovin official privacy link required`);
    assert.match(privacy, copy.planned, `${locale}: AppLovin MAX must be described as planned/preparation`);
    assert.match(privacy, copy.noCurrentTransfer, `${locale}: current non-transmission must be explicit`);
    assert.match(privacy, copy.beforeActivation, `${locale}: activation prerequisites must mention recipient/data/country/basis/rights plus consent/non-child gate`);
    assert.doesNotMatch(privacy, /AppLovin MAX[^<]*(?:currently serves|currently sends|currently transmits|현재 제공|현재 사용|ist derzeit aktiv|配信中)/i, `${locale}: must not imply MAX is live`);
  }
});
