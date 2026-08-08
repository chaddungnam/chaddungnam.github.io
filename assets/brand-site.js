(function () {
  "use strict";

  var root = document.documentElement;
  var supportedLanguages = ["ko", "en", "de", "ja"];
  var savedTheme = "";

  try {
    savedTheme = window.localStorage.getItem("house_duck_theme") || "";
  } catch (_error) {
    savedTheme = "";
  }

  var initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.dataset.theme = initialTheme;

  function normalizeLanguage(value) {
    var language = String(value || "").toLowerCase().split("-")[0];
    return supportedLanguages.indexOf(language) >= 0 ? language : "";
  }

  function languageFile(language) {
    return language === "ko" ? "index.html" : "index_" + language + ".html";
  }

  var requestedLanguage = normalizeLanguage(
    new URLSearchParams(window.location.search).get("lang")
  );
  var locale = normalizeLanguage(root.dataset.locale) || "en";

  if (requestedLanguage) {
    try {
      window.localStorage.setItem("house_duck_site_language", requestedLanguage);
    } catch (_error) {
      // The page remains usable when storage is blocked.
    }
  }

  var savedLanguage = "";
  try {
    savedLanguage = normalizeLanguage(
      window.localStorage.getItem("house_duck_site_language")
    );
  } catch (_error) {
    savedLanguage = "";
  }

  var browserLanguages = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || "en"];
  var browserLanguage = "";
  for (var languageIndex = 0; languageIndex < browserLanguages.length; languageIndex += 1) {
    browserLanguage = normalizeLanguage(browserLanguages[languageIndex]);
    if (browserLanguage) break;
  }

  var targetLanguage = requestedLanguage || savedLanguage || browserLanguage || "en";
  if (targetLanguage !== locale) {
    window.location.replace(languageFile(targetLanguage));
  }

  document.addEventListener("DOMContentLoaded", function () {
    root.classList.add("js-ready");

    function setTheme(theme) {
      root.dataset.theme = theme;
      var themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = theme === "dark" ? "#111a2b" : "#f7f3e8";
      document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
        button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
        button.setAttribute("aria-pressed", String(theme === "dark"));
      });
    }

    setTheme(initialTheme);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        try {
          window.localStorage.setItem("house_duck_theme", nextTheme);
        } catch (_error) {
          // Theme switching still works when storage is blocked.
        }
      });
    });

    document.querySelectorAll("[data-post-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        var selected = button.dataset.postTab;
        document.querySelectorAll("[data-post-tab]").forEach(function (tab) {
          tab.setAttribute("aria-selected", String(tab === button));
        });
        document.querySelectorAll("[data-post-panel]").forEach(function (panel) {
          panel.hidden = panel.dataset.postPanel !== selected;
        });
      });
    });

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
