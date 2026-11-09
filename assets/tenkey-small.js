// /10key/prereg/ (confirm or unsubscribe from the pre-registration mail) and /10key/get/ (the one download link of the
// launch mail). Owner 2026-10-24. Language: ?lang=ko|en|de|ja|zh (de/ja since 2026-10-30, zh = Traditional Chinese since 2026-11-04, the mail language), else the
// browser language. Elements carry data-ko/data-en only; de and ja fall back to the English text.
(function () {
  "use strict";

  var ENDPOINT = "https://frepunpqswciugwoyvxo.supabase.co/functions/v1/tenkey-prereg";
  // Flip "live" to true for each store on launch day. Until then /10key/get/ shows the pre-registration page link.
  var STORES = {
    ios: { live: false, url: "https://apps.apple.com/app/id6824972492" },
    android: { live: false, url: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival" }
  };

  var params = new URLSearchParams(location.search);
  var lang = params.get("lang");
  if (lang !== "ko" && lang !== "en" && lang !== "de" && lang !== "ja" && lang !== "zh") {
    var navFull = String(navigator.language || "").toLowerCase();
    var nav = navFull.slice(0, 2);
    lang = nav === "ko" || nav === "de" || nav === "ja" ? nav : /^zh-(tw|hk|mo|hant)/.test(navFull) ? "zh" : "en";
  }
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : lang;
  var ui = lang === "ko" ? "ko" : "en";
  document.querySelectorAll("[data-ko]").forEach(function (node) {
    node.textContent = node.getAttribute("data-" + lang) || node.getAttribute("data-" + ui);
  });
  document.querySelectorAll("[data-href-ko]").forEach(function (node) {
    node.setAttribute("href", node.getAttribute("data-href-" + lang) || node.getAttribute("data-href-" + ui));
  });
  document.querySelectorAll("[data-current-year]").forEach(function (node) { node.textContent = String(new Date().getFullYear()); });

  var T = {
    ko: {
      opening: ["{store} 여는 중…", "자동으로 안 열리면 아래 버튼을 눌러 주세요."],
      working: ["확인하는 중…", "잠시만 기다려 주세요."],
      confirmed: ["사전예약 완료!", "출시되는 날 이 주소로 다운로드 링크를 보내 드릴게요."],
      unsubscribed: ["수신 거부했어요", "이 주소로는 더 이상 사전예약 메일을 보내지 않아요. 남은 정보는 30일 안에 삭제돼요."],
      invalid: ["링크가 맞지 않아요", "이미 처리됐거나 만료된 링크예요. 다시 사전예약하려면 게임 페이지에서 신청해 주세요."],
      error: ["연결에 실패했어요", "잠시 뒤에 이 페이지를 새로고침해 주세요."],
      soon: ["아직 출시 전이에요", "딸깍 서바이벌은 iOS·Android 출시를 준비하고 있어요. 사전예약하면 출시 날 메일로 알려 드려요."],
      pick: ["딸깍 서바이벌 받기", "내 기기의 스토어를 골라 주세요."]
    },
    en: {
      opening: ["Opening {store}…", "If nothing happens, tap the button below."],
      working: ["Checking…", "One moment."],
      confirmed: ["You are pre-registered!", "We will send the download link to this address on launch day."],
      unsubscribed: ["You are unsubscribed", "We will not send pre-registration email to this address again. What is left is deleted within 30 days."],
      invalid: ["This link does not work", "It was already used or has expired. To pre-register again, use the game page."],
      error: ["Connection failed", "Please reload this page in a moment."],
      soon: ["Not out yet", "10key Survival is getting ready for iOS and Android. Pre-register and we will email you on launch day."],
      pick: ["Get 10key Survival", "Pick the store for your device."]
    },
    de: {
      opening: ["{store} wird geöffnet…", "Falls nichts passiert, tippe unten auf den Button."],
      working: ["Wird geprüft…", "Einen Moment bitte."],
      confirmed: ["Sie sind vorregistriert!", "Am Starttag senden wir den Download-Link an diese Adresse."],
      unsubscribed: ["Vorregistrierung storniert", "Wir senden keine Vorregistrierungs-E-Mails mehr an diese Adresse. Die übrigen Daten werden innerhalb von 30 Tagen gelöscht."],
      invalid: ["Dieser Link funktioniert nicht", "Er wurde schon verwendet oder ist abgelaufen. Für eine neue Vorregistrierung nutzen Sie die Spielseite."],
      error: ["Verbindung fehlgeschlagen", "Bitte laden Sie diese Seite gleich neu."],
      soon: ["Noch nicht erschienen", "10key Survival erscheint bald für iOS und Android. Mit einer Vorregistrierung erfahren Sie es am Starttag per E-Mail."],
      pick: ["10key Survival holen", "Wählen Sie den Store für Ihr Gerät."]
    },
    ja: {
      opening: ["{store}を開いています…", "自動で開かない場合は、下のボタンを押してください。"],
      working: ["確認しています…", "少々お待ちください。"],
      confirmed: ["事前登録が完了しました！", "リリース日にこのアドレスへダウンロードリンクをお送りします。"],
      unsubscribed: ["事前登録を取り消しました", "このアドレスには事前登録のメールをお送りしません。残りの情報は30日以内に削除します。"],
      invalid: ["このリンクは使えません", "すでに使われたか、期限が切れています。もう一度事前登録するには、ゲームのページからお申し込みください。"],
      error: ["接続できませんでした", "少し待ってから、このページを再読み込みしてください。"],
      soon: ["まだリリース前です", "10key SurvivalはiOS・Android向けに準備中です。事前登録すると、リリース日にメールでお知らせします。"],
      pick: ["10key Survivalを入手", "お使いの端末のストアを選んでください。"]
    },
    zh: {
      opening: ["正在開啟 {store}…", "如果沒有自動開啟，請點下方按鈕。"],
      working: ["確認中…", "請稍候。"],
      confirmed: ["事前預約完成！", "上市當天會把下載連結寄到這個信箱。"],
      unsubscribed: ["已取消事前預約", "之後不會再寄事前預約相關信件到這個信箱。其餘資料會在 30 天內刪除。"],
      invalid: ["這個連結無法使用", "連結已使用過或已過期。若要重新預約，請到遊戲頁面申請。"],
      error: ["連線失敗", "請稍後重新整理這個頁面。"],
      soon: ["尚未上市", "咔噠求生正在準備 iOS 與 Android 版本。完成事前預約，上市當天就會寄信通知你。"],
      pick: ["取得咔噠求生", "請選擇你裝置的商店。"]
    }
  }[lang];

  var title = document.querySelector("[data-title]");
  var text = document.querySelector("[data-text]");
  var show = function (pair) { title.textContent = pair[0]; text.textContent = pair[1]; document.title = pair[0] + " | 10key Survival"; };
  var reveal = function (sel) { document.querySelectorAll(sel).forEach(function (n) { n.hidden = false; }); };

  var page = document.body.getAttribute("data-small");

  if (page === "prereg") {
    var action = params.get("a");
    var token = params.get("t") || "";
    if ((action !== "confirm" && action !== "unsub") || !/^[0-9a-f-]{36}$/i.test(token)) { show(T.invalid); reveal("[data-show-game]"); return; }
    show(T.working);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ v: 1, action: action === "confirm" ? "confirm" : "unsubscribe", token: token })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, data: data }; });
    }).then(function (r) {
      if (r.status === 200 && r.data.ok) show(action === "confirm" ? T.confirmed : T.unsubscribed);
      else if (r.status === 404 || r.status === 400) show(T.invalid);
      else show(T.error);
      reveal("[data-show-game]");
    }).catch(function () { show(T.error); reveal("[data-show-game]"); });
    return;
  }

  if (page === "get") {
    // One link for ads, the launch mail and the Shorts (owner 2026-11-09). Phones go straight to their store once it is
    // live; a computer gets the store choice (QR code, copy link) and the computer options (itch.io demo, Steam soon).
    // ?preview=pc|ios|android shows the after-launch view without redirecting (local review only).
    var preview = params.get("preview");
    var ua = navigator.userAgent || "";
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    if (preview === "ios") { isIOS = true; isAndroid = false; }
    if (preview === "android") { isIOS = false; isAndroid = true; }
    if (preview === "pc") { isIOS = false; isAndroid = false; }
    var isLive = function (key) { return STORES[key].live || !!preview; };
    // Store links carry where the visit came from (?src=, e.g. ads_kr, mail, shorts; default "get"), so App Store Connect
    // (campaign links, pt = House Duck provider id) and Play Console (utm referrer) can count downloads per source.
    var src = String(params.get("src") || "get").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "get";
    var storeUrl = function (key) {
      if (key === "ios") return "https://apps.apple.com/app/apple-store/id6824972492?pt=129265473&ct=" + src + "&mt=8";
      return STORES.android.url + "&referrer=" + encodeURIComponent("utm_source=houseduck&utm_medium=get&utm_campaign=" + src);
    };
    var mineKey = isIOS ? "ios" : (isAndroid ? "android" : null);
    if (mineKey && isLive(mineKey)) {
      var name = mineKey === "ios" ? "App Store" : "Google Play";
      title.textContent = T.opening[0].replace("{store}", name);
      text.textContent = T.opening[1];
      document.title = name + " | 10key Survival";
      var btn = document.querySelector("[data-store='" + mineKey + "']");
      if (btn) { btn.href = storeUrl(mineKey); btn.hidden = false; }
      if (!preview) location.replace(storeUrl(mineKey));
      return;
    }
    if (!isLive("ios") && !isLive("android")) { show(T.soon); reveal("[data-show-prereg]"); return; }
    // Computer (or a phone whose store is not live yet): the full choice page.
    document.querySelectorAll("[data-get-link='ios'], [data-get-link='android']").forEach(function (a) {
      var key = a.getAttribute("data-get-link");
      a.href = storeUrl(key);
      if (!isLive(key)) a.hidden = true;
    });
    var card = document.querySelector("[data-get-card]");
    if (card) card.hidden = true;
    reveal("[data-get-pc]");
    document.title = (document.querySelector(".tk-get-title") || {}).textContent + " | House Duck";
    document.querySelectorAll("[data-copy-link]").forEach(function (b) {
      b.addEventListener("click", function () {
        var url = b.getAttribute("data-copy-link");
        var face = b.querySelector(".tk-key-face");
        var before = face.textContent;
        var done = function () {
          face.textContent = b.getAttribute("data-done-" + lang) || b.getAttribute("data-done-en");
          window.setTimeout(function () { face.textContent = before; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt("", url); });
        else window.prompt("", url);
      });
    });
  }
})();
