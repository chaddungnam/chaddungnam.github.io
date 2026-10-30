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
      var ok = { ko: 1, en: 1, de: 1, ja: 1 };
      var fromUrl = null;
      var saved = null;
      try { fromUrl = new URLSearchParams(location.search).get("lang"); } catch (_error) { fromUrl = null; }
      try { saved = window.localStorage.getItem("house_duck_site_language"); } catch (_error) { saved = null; }
      var pageLocale = box.getAttribute("data-locale") || "en";
      if (fromUrl && ok[fromUrl]) return fromUrl;
      // A saved ko/en that disagrees with this page means the visitor switched pages on purpose: follow the page.
      if (saved === "de" || saved === "ja") return pageLocale === "ko" ? "ko" : saved;
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
    document.querySelectorAll("[data-prereg-jump]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        box.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        box.classList.remove("tk-flash");
        void box.offsetWidth;
        box.classList.add("tk-flash");
        if (!box.classList.contains("is-done")) window.setTimeout(function () { emailInput.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
        try { history.replaceState(null, "", "#prereg"); } catch (_error) { /* ignore */ }
      });
    });
  }
})();
