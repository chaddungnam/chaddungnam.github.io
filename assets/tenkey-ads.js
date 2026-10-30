// Google Ads conversion measurement for the 10key Survival pre-registration (owner 2026-10-30).
// Nothing from Google loads until the visitor says yes in the small bar at the bottom ("basic" consent: no tag, no cookie,
// no request to Google before that). After yes, the Google tag (AW-18020492251) loads with ad_storage granted and
// ad_user_data / ad_personalization denied (we only count; nothing is used for personalised ads), and a successful
// pre-registration sends the "10key 사전예약" conversion. The email address is never sent to Google.
// The choice is kept in localStorage "hd_ads_consent" ("granted" | "denied") and can be changed from the footer link
// [data-ads-settings]. Privacy policy section 13 ("10key-prereg").
(function () {
  "use strict";

  var TAG = "AW-18020492251";
  var SEND_TO = "AW-18020492251/h5j8CPjd7K4dENvH65BD";
  var KEY = "hd_ads_consent";
  var loaded = false;
  var pending = false;

  var get = function () { try { return window.localStorage.getItem(KEY); } catch (_error) { return null; } };
  var put = function (v) { try { window.localStorage.setItem(KEY, v); } catch (_error) { /* storage can be blocked */ } };

  function load() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    window.gtag("set", "ads_data_redaction", false);
    window.gtag("js", new Date());
    window.gtag("config", TAG, { allow_enhanced_conversions: false });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + TAG;
    document.head.appendChild(s);
    if (pending) { pending = false; send(); }
  }

  function send() {
    if (!loaded) { pending = get() === "granted"; return; }
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
    bar.querySelector(".tk-adsbar-yes").addEventListener("click", function () { put("granted"); hideBar(); load(); });
    bar.querySelector(".tk-adsbar-no").addEventListener("click", function () {
      var was = get();
      put("denied");
      hideBar();
      if (was === "granted" && loaded) location.reload(); // drop the already-loaded tag
    });
    document.body.appendChild(bar);
  }

  window.hdAds = { conversion: send };

  document.querySelectorAll("[data-ads-settings]").forEach(function (link) {
    link.addEventListener("click", function (event) { event.preventDefault(); showBar(); });
  });

  var choice = get();
  if (choice === "granted") load();
  else if (choice !== "denied") showBar();
})();
