/* Quirky Ball product page: the same scroll tone and section rail as the House Duck home,
   the phone loop that plays while visible, and a YouTube trailer that loads only on click. */
(function () {
  "use strict";

  function setupTone() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-tone]"));
    var links = Array.prototype.slice.call(document.querySelectorAll(".section-rail a"));
    if (!sections.length) return;
    var scheduled = false;
    function update() {
      scheduled = false;
      var centre = window.innerHeight * 0.5;
      var closest = sections[0];
      var distance = Infinity;
      sections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        var inside = rect.top <= centre && rect.bottom >= centre;
        var next = inside ? 0 : Math.min(Math.abs(rect.top - centre), Math.abs(rect.bottom - centre));
        if (next < distance) { closest = section; distance = next; }
      });
      document.body.style.setProperty("--studio-tone", closest.dataset.tone);
      var active = closest.dataset.rail || closest.id;
      links.forEach(function (link) {
        if (link.hash === "#" + active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
    function request() {
      if (!scheduled) { scheduled = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
  }

  function setupLoop() {
    var video = document.querySelector("[data-qb-loop]");
    if (!video || !("IntersectionObserver" in window)) return;
    video.muted = true;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { video.pause(); return; }
        if (video.dataset.userPaused === "true") return;
        var playback = video.play();
        if (playback && typeof playback.catch === "function") playback.catch(function () {});
      });
    }, { threshold: 0.15 }).observe(video);
  }

  function setupTrailer() {
    document.querySelectorAll("[data-qb-youtube]").forEach(function (card) {
      card.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
        event.preventDefault();
        var player = document.createElement("div");
        player.className = card.className;
        var frame = document.createElement("iframe");
        frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(card.dataset.qbYoutube) + "?autoplay=1&rel=0&playsinline=1";
        frame.title = card.dataset.qbTitle || "YouTube";
        frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        player.appendChild(frame);
        var caption = card.lastElementChild;
        if (caption) player.appendChild(caption.cloneNode(true));
        card.replaceWith(player);
        frame.focus();
      });
    });
  }

  function init() {
    setupTone();
    setupLoop();
    setupTrailer();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
