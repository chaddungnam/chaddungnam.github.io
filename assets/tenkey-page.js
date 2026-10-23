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
})();
