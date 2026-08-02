(function () {
  "use strict";

  var root = document.documentElement;
  var requestedLanguage = new URLSearchParams(window.location.search).get("lang");
  var locale = root.dataset.locale || "en";

  if (requestedLanguage === "ko" || requestedLanguage === "en") {
    try {
      window.localStorage.setItem("house_duck_site_language", requestedLanguage);
    } catch (_error) {
      // The page remains usable when storage is blocked.
    }
  }

  if (locale === "ko" && requestedLanguage !== "ko") {
    var savedLanguage = "";
    try {
      savedLanguage = window.localStorage.getItem("house_duck_site_language") || "";
    } catch (_error) {
      savedLanguage = "";
    }

    var browserLanguage = String(
      (navigator.languages && navigator.languages[0]) || navigator.language || "en"
    ).toLowerCase();

    if (savedLanguage === "en" || (!savedLanguage && browserLanguage.indexOf("ko") !== 0)) {
      window.location.replace(root.dataset.englishUrl || "index_en.html");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    root.classList.add("js-ready");

    document.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var nav = document.querySelector("[data-site-nav]");
    var menuButton = document.querySelector("[data-menu-button]");

    function closeMenu() {
      if (!nav || !menuButton) return;
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }

    if (nav && menuButton) {
      menuButton.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeMenu();
          menuButton.focus();
        }
      });

      window.addEventListener("resize", function () {
        if (window.innerWidth > 720) closeMenu();
      });
    }

    document.querySelectorAll("[data-lang-link]").forEach(function (link) {
      link.addEventListener("click", function () {
        try {
          window.localStorage.setItem("house_duck_site_language", link.dataset.langLink || "en");
        } catch (_error) {
          // The link itself still changes language.
        }
      });
    });

    var revealNodes = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) {
      revealNodes.forEach(function (node) { node.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

    revealNodes.forEach(function (node) { observer.observe(node); });
  });
}());
