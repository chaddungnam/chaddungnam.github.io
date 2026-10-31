// Google Ads conversion measurement for the 10key Survival pre-registration (owner 2026-10-30, consent mode 2026-10-31).
// Google consent mode, "advanced" (owner 2026-10-31: "ㅇㅇ", to count more of the pre-registrations that come from ads):
// - not answered yet: the Google tag (AW-18020492251) loads with every storage denied, so it sets and reads no cookie and only
//   sends cookieless signals (the visit from an ad click and a pre-registration). Privacy section 13: legitimate interest.
// - "Allow": ad_storage is granted, so the ad-measurement cookie is used as well (consent). ad_user_data and
//   ad_personalization stay denied: we only count, nothing is used for personalised ads.
// - "Decline" (objection): no further signal on this page, and on later visits nothing from Google loads at all.
// The email address is never sent to Google. The choice is kept in localStorage "hd_ads_consent" ("granted" | "denied")
// and can be changed from the footer link [data-ads-settings]. Privacy policy section 13 ("10key-prereg").
(function () {
  "use strict";

  var TAG = "AW-18020492251";
  var SEND_TO = "AW-18020492251/h5j8CPjd7K4dENvH65BD";
  var KEY = "hd_ads_consent";
  var loaded = false;
  var blocked = false;

  var get = function () { try { return window.localStorage.getItem(KEY); } catch (_error) { return null; } };
  var put = function (v) { try { window.localStorage.setItem(KEY, v); } catch (_error) { /* storage can be blocked */ } };

  function load(granted) {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: granted ? "granted" : "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    window.gtag("set", "ads_data_redaction", false); // keep the ad click id in the cookieless signal, it is what makes it count
    window.gtag("js", new Date());
    window.gtag("config", TAG, { allow_enhanced_conversions: false });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + TAG;
    document.head.appendChild(s);
  }

  function send() {
    if (blocked || !loaded) return;
    window.gtag("event", "conversion", { send_to: SEND_TO });
  }

  var lang = (document.documentElement.lang || "en").slice(0, 2);
  var T = {
    ko: { text: "광고를 보고 온 방문이 사전예약으로 이어지는지 세기 위해 Google 광고 측정 쿠키를 써도 될까요? 이메일 주소는 Google에 보내지 않아요.", yes: "허용", no: "거부", more: "자세히" },
    en: { text: "May we use a Google Ads measurement cookie to count whether visits from our ads lead to pre-registrations? Your email address is never sent to Google.", yes: "Allow", no: "Decline", more: "Details" }
  }[lang === "ko" ? "ko" : "en"];
  var privacy = lang === "ko" ? "/privacy/ko.html#10key-prereg" : "/privacy/en.html#10key-prereg";

  var bar = null;
  function hideBar() { if (bar) { bar.remove(); bar = null; } }
  function showBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "tk-adsbar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", T.more);
    bar.innerHTML = '<p class="tk-adsbar-text"></p><div class="tk-adsbar-actions"><button type="button" class="tk-adsbar-no"></button><button type="button" class="tk-adsbar-yes"></button></div>';
    var p = bar.querySelector(".tk-adsbar-text");
    p.textContent = T.text + " ";
    var a = document.createElement("a");
    a.href = privacy;
    a.textContent = T.more;
    p.appendChild(a);
    bar.querySelector(".tk-adsbar-yes").textContent = T.yes;
    bar.querySelector(".tk-adsbar-no").textContent = T.no;
    bar.querySelector(".tk-adsbar-yes").addEventListener("click", function () {
      put("granted");
      blocked = false;
      hideBar();
      if (loaded) window.gtag("consent", "update", { ad_storage: "granted" });
      else load(true);
    });
    bar.querySelector(".tk-adsbar-no").addEventListener("click", function () {
      var was = get();
      put("denied");
      blocked = true;
      hideBar();
      if (loaded) window.gtag("consent", "update", { ad_storage: "denied" });
      if (was === "granted" && loaded) location.reload(); // drop the tag that already used the cookie
    });
    document.body.appendChild(bar);
  }

  window.hdAds = { conversion: send };

  document.querySelectorAll("[data-ads-settings]").forEach(function (link) {
    link.addEventListener("click", function (event) { event.preventDefault(); showBar(); });
  });

  var choice = get();
  if (choice === "granted") load(true);
  else if (choice === "denied") blocked = true;
  else { load(false); showBar(); }
})();
