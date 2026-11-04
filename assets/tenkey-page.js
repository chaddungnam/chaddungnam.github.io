(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("tk-js");

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_error) { reduceMotion = false; }

  document.querySelectorAll("[data-current-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  // Remember the language the visitor picked, the same key the House Duck home reads.
  document.querySelectorAll("[data-lang-link]").forEach(function (link) {
    link.addEventListener("click", function () {
      try { window.localStorage.setItem("house_duck_site_language", link.getAttribute("data-lang-link")); } catch (_error) { /* storage can be blocked */ }
    });
  });

  // Gameplay loop: plays while it is on screen, pauses off screen, stays a poster for reduced motion, and has a pause button.
  var video = document.querySelector("[data-tk-video]");
  var toggle = document.querySelector("[data-tk-video-toggle]");
  var userPaused = reduceMotion;
  var onScreen = true;

  function setToggle() {
    if (!toggle || !video) return;
    var paused = video.paused;
    toggle.setAttribute("data-state", paused ? "paused" : "playing");
    var label = toggle.getAttribute(paused ? "data-play-label" : "data-pause-label");
    if (label) toggle.setAttribute("aria-label", label);
  }

  function play() {
    var attempt = video.play();
    if (attempt && typeof attempt.catch === "function") attempt.catch(function () { setToggle(); });
  }

  if (video) {
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
    }

    video.addEventListener("play", setToggle);
    video.addEventListener("pause", setToggle);

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (video.paused) {
          userPaused = false;
          play();
        } else {
          userPaused = true;
          video.pause();
        }
      });
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (!onScreen) video.pause();
        else if (!userPaused) play();
      }, { threshold: 0.15 }).observe(video);
    }

    setToggle();
  }

  // Sections fade up once as they arrive.
  var items = document.querySelectorAll(".tk-reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach(function (item) { item.classList.add("is-in"); });
  } else {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        seen.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (item) { seen.observe(item); });
  }
  // Pre-registration (owner 2026-10-24). The form posts text/plain JSON to the tenkey-prereg edge function, so the browser
  // sends no CORS preflight. Single step since 2026-10-30 (owner): submitting IS the pre-registration; the function mails
  // one receipt from support@houseduck.in. Mail language = the House Duck page language the visitor used (owner 10-30):
  // ?lang=ko|en|de|ja (the de/ja home links add it), else the language saved by the site switcher, else this page's.
  // On success the Google Ads conversion is sent through tenkey-ads.js, only if the visitor allowed it there.
  // The submit button ships disabled and is enabled here, so without this script the form can never submit natively (which
  // would put the email in the address bar); a small inline script then says to reload instead.
  // itch.io play is a pre-registration perk (owner 2026-11-03): the itch.io link shows only after a successful sign-up, and
  // this browser remembers it (a re-sign-up with the same email also works: the function answers ok and mails nothing).
  // Until then the gated links ([data-itch-gate]) open a pre-registration popup instead (below).
  var ITCH_URL = "https://houseduck.itch.io/10key-survival";
  var DONE_KEY = "tenkey_prereg_done";
  var unlockItch = function (fresh) {
    root.classList.add("tk-itch-open");
    document.querySelectorAll("[data-itch-unlock]").forEach(function (node) { node.hidden = false; });
    document.querySelectorAll("[data-itch-locked]").forEach(function (node) { node.hidden = true; });
    document.querySelectorAll("[data-itch-gate]").forEach(function (link) {
      link.setAttribute("href", ITCH_URL);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      var label = link.querySelector("[data-gate-label]");
      if (label && label.getAttribute("data-unlocked-label")) label.textContent = label.getAttribute("data-unlocked-label");
      var lock = link.querySelector(".tk-lock-icon");
      if (lock) lock.className = "tk-play-icon";
    });
    if (fresh) { try { window.localStorage.setItem(DONE_KEY, "1"); } catch (_error) { /* storage can be blocked */ } }
  };
  var remembered = false;
  try { remembered = window.localStorage.getItem(DONE_KEY) === "1"; } catch (_error) { remembered = false; }
  if (remembered) unlockItch(false);

  var box = document.querySelector("[data-prereg]");
  var form = box && box.querySelector("[data-prereg-form]");
  if (box && form) {
    var status = box.querySelector("[data-prereg-status]");
    var emailInput = form.querySelector("input[name='email']");
    var consentInput = form.querySelector("input[name='consent']");
    var trap = form.querySelector("input[name='website']");
    var button = form.querySelector("button[type='submit']");
    var msgs = {};
    try { msgs = JSON.parse(box.getAttribute("data-msgs") || "{}"); } catch (_error) { msgs = {}; }
    var sending = false;
    var mailLocale = (function () {
      var ok = { ko: 1, en: 1, de: 1, ja: 1, zh: 1 };
      var fromUrl = null;
      var saved = null;
      try { fromUrl = new URLSearchParams(location.search).get("lang"); } catch (_error) { fromUrl = null; }
      try { saved = window.localStorage.getItem("house_duck_site_language"); } catch (_error) { saved = null; }
      var pageLocale = box.getAttribute("data-locale") || "en";
      if (fromUrl && ok[fromUrl]) return fromUrl;
      // The de/ja/zh pages (owner 2026-11-04) and the ko page always mail in their own language.
      if (pageLocale !== "en") return pageLocale;
      // On the English page a saved de/ja/zh choice still wins (the visitor picked it on the site).
      if (saved === "de" || saved === "ja" || saved === "zh") return saved;
      return pageLocale;
    })();

    var say = function (text, tone) {
      status.textContent = text || "";
      if (tone) status.setAttribute("data-tone", tone); else status.removeAttribute("data-tone");
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending) return;
      var email = String(emailInput.value || "").trim();
      var looksRight = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) && email.length <= 254;
      emailInput.setAttribute("aria-invalid", looksRight ? "false" : "true");
      if (!looksRight) { say(msgs.invalid, "err"); emailInput.focus(); return; }
      if (!consentInput.checked) { say(msgs.consent, "err"); consentInput.focus(); return; }
      sending = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      say(msgs.sending);
      fetch(box.getAttribute("data-endpoint"), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ v: 1, action: "signup", email: email, locale: mailLocale, consent: box.getAttribute("data-consent-version"), hp: trap ? trap.value : "" })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, data: data }; });
      }).then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          box.classList.add("is-done");
          say(msgs.ok, "ok");
          unlockItch(true);
          try { if (window.hdAds) window.hdAds.conversion(); } catch (_error) { /* measurement must never break the form */ }
          return;
        }
        var code = r.data && r.data.error;
        if (code === "invalid_email") { emailInput.setAttribute("aria-invalid", "true"); say(msgs.invalid, "err"); }
        else if (code === "consent_required") say(msgs.consent, "err");
        else if (code === "busy") say(msgs.busy, "err");
        else say(msgs.error, "err");
      }).catch(function () {
        say(msgs.error, "err");
      }).then(function () {
        sending = false;
        button.disabled = false;
        button.removeAttribute("aria-busy");
      });
    });

    button.disabled = false;
    box.setAttribute("data-ready", "");

    // Every "pre-register" link lands on the card and puts the cursor in the email box.
    var jumpToForm = function () {
      box.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      box.classList.remove("tk-flash");
      void box.offsetWidth;
      box.classList.add("tk-flash");
      if (!box.classList.contains("is-done")) window.setTimeout(function () { emailInput.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
      try { history.replaceState(null, "", location.pathname + location.search + "#prereg"); } catch (_error) { /* ignore */ }
    };
    document.querySelectorAll("[data-prereg-jump]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        jumpToForm();
      });
    });

    // Before sign-up the itch.io demo buttons and menu open a short popup (owner 2026-11-03, ko/en/de/ja): pre-registering
    // unlocks the demo on itch.io; its button goes to the form. The home's demo buttons land here with #itch-demo.
    var GATE_TEXT = {
      ko: { title: "itch.io 데모는 사전예약 특전이에요", body: "사전예약을 하면 itch.io에서 데모(레벨 15까지)를 플레이할 수 있어요. 이메일만 남기면 플레이 링크가 바로 떠요. PC에서 플레이하는 걸 권장해요.", go: "사전예약하러 가기", close: "닫기", paid: "정식판은 유료 앱이고 인앱 구매가 있어요. itch.io 데모는 무료예요." },
      en: { title: "The itch.io demo is a pre-registration perk", body: "Pre-register and you can play the demo (up to level 15) on itch.io. Leave your email and the play link appears right away. Best played on a PC.", go: "Go to pre-registration", close: "Close", paid: "The full game is a paid app with in-app purchases. The itch.io demo is free." },
      de: { title: "Die itch.io-Demo gibt es mit der Vorregistrierung", body: "Wenn du dich vorregistrierst, kannst du die Demo (bis Level 15) auf itch.io spielen. Gib deine E-Mail-Adresse ein, dann erscheint sofort der Link zum Spielen. Am besten am PC spielen.", go: "Zur Vorregistrierung", close: "Schließen", paid: "Die Vollversion ist eine kostenpflichtige App mit In-App-Käufen. Die itch.io-Demo ist kostenlos." },
      zh: { title: "itch.io 試玩版是事前預約特典", body: "完成事前預約，就能在 itch.io 試玩（最多到第 15 關）。留下電子郵件，遊玩連結馬上出現。建議用 PC 遊玩。", go: "前往事前預約", close: "關閉", paid: "正式版是付費 App，含 App 內購買。itch.io 試玩版免費。" },
      ja: { title: "itch.ioのデモは事前登録の特典です", body: "事前登録すると、itch.ioでデモ（レベル15まで）をプレイできます。メールアドレスを登録すると、すぐにプレイリンクが表示されます。PCでのプレイをおすすめします。", go: "事前登録へ進む", close: "閉じる", paid: "製品版は有料アプリ（アプリ内課金あり）です。itch.ioのデモは無料です。" }
    };
    var gate = null;
    var openGate = function () {
      if (!gate) {
        var t = GATE_TEXT[mailLocale] || GATE_TEXT.en;
        gate = document.createElement("dialog");
        gate.className = "tk-gate";
        gate.setAttribute("aria-labelledby", "tk-gate-title");
        gate.setAttribute("data-itch-popup", "");
        gate.lang = mailLocale;
        gate.innerHTML = '<span class="tk-lock-icon" aria-hidden="true"></span><h2 id="tk-gate-title"></h2><p></p><p class="tk-gate-paid"></p><div class="tk-gate-actions"><button class="tk-key" type="button" data-gate-go><span class="tk-key-face"></span></button><button class="tk-gate-close" type="button" data-gate-close></button></div>';
        gate.querySelector("h2").textContent = t.title;
        gate.querySelector("p").textContent = t.body;
        gate.querySelector(".tk-gate-paid").textContent = t.paid;
        gate.querySelector("[data-gate-go] .tk-key-face").textContent = t.go;
        gate.querySelector("[data-gate-close]").textContent = t.close;
        gate.querySelector("[data-gate-go]").addEventListener("click", function () { gate.close(); jumpToForm(); });
        gate.querySelector("[data-gate-close]").addEventListener("click", function () { gate.close(); });
        gate.addEventListener("click", function (event) { if (event.target === gate) gate.close(); });
        document.body.appendChild(gate);
      }
      if (typeof gate.showModal === "function") gate.showModal(); else jumpToForm();
    };
    document.querySelectorAll("[data-itch-gate]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (root.classList.contains("tk-itch-open")) return; // unlocked: the link opens itch.io
        event.preventDefault();
        openGate();
      });
    });
    if (location.hash === "#itch-demo" && !root.classList.contains("tk-itch-open")) openGate();
  }
})();
