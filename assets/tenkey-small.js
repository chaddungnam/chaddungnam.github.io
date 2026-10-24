// /10key/prereg/ (confirm or unsubscribe from the pre-registration mail) and /10key/get/ (the one download link of the
// launch mail). Owner 2026-10-24. Language: ?lang=ko|en, else the browser language.
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
  if (lang !== "ko" && lang !== "en") lang = String(navigator.language || "").toLowerCase().indexOf("ko") === 0 ? "ko" : "en";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-ko]").forEach(function (node) {
    node.textContent = node.getAttribute("data-" + lang);
  });
  document.querySelectorAll("[data-href-ko]").forEach(function (node) {
    node.setAttribute("href", node.getAttribute("data-href-" + lang));
  });
  document.querySelectorAll("[data-current-year]").forEach(function (node) { node.textContent = String(new Date().getFullYear()); });

  var T = {
    ko: {
      working: ["확인하는 중…", "잠시만 기다려 주세요."],
      confirmed: ["사전예약 완료!", "출시되는 날 이 주소로 다운로드 링크를 보내 드릴게요."],
      unsubscribed: ["수신 거부했어요", "이 주소로는 더 이상 사전예약 메일을 보내지 않아요. 남은 정보는 30일 안에 삭제돼요."],
      invalid: ["링크가 맞지 않아요", "이미 처리됐거나 만료된 링크예요. 다시 사전예약하려면 게임 페이지에서 신청해 주세요."],
      error: ["연결에 실패했어요", "잠시 뒤에 이 페이지를 새로고침해 주세요."],
      soon: ["아직 출시 전이에요", "딸깍 서바이벌은 iOS·Android 출시를 준비하고 있어요. 사전예약하면 출시 날 메일로 알려 드려요."],
      pick: ["딸깍 서바이벌 받기", "내 기기의 스토어를 골라 주세요."]
    },
    en: {
      working: ["Checking…", "One moment."],
      confirmed: ["You are pre-registered!", "We will send the download link to this address on launch day."],
      unsubscribed: ["You are unsubscribed", "We will not send pre-registration email to this address again. What is left is deleted within 30 days."],
      invalid: ["This link does not work", "It was already used or has expired. To pre-register again, use the game page."],
      error: ["Connection failed", "Please reload this page in a moment."],
      soon: ["Not out yet", "10key Survival is getting ready for iOS and Android. Pre-register and we will email you on launch day."],
      pick: ["Get 10key Survival", "Pick the store for your device."]
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
    var ua = navigator.userAgent || "";
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    var mine = isIOS ? STORES.ios : (isAndroid ? STORES.android : null);
    if (mine && mine.live) { location.replace(mine.url); return; }
    var any = false;
    ["ios", "android"].forEach(function (key) {
      var link = document.querySelector("[data-store='" + key + "']");
      if (link && STORES[key].live) { link.href = STORES[key].url; link.hidden = false; any = true; }
    });
    if (any) show(T.pick);
    else { show(T.soon); reveal("[data-show-prereg]"); }
  }
})();
