(() => {
  "use strict";

  const root = document.documentElement;
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem("house_duck_theme") || "";
  } catch (_error) {
    savedTheme = "";
  }
  const initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "dark";

  function setTheme(theme) {
    root.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#0d1525" : "#f3f1ea";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
    });
  }

  setTheme(initialTheme);
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      setTheme(theme);
      try {
        localStorage.setItem("house_duck_theme", theme);
      } catch (_error) {
        // The control still works when storage is blocked.
      }
    });
  });

  const mobileMenu = document.querySelector(".mobile-menu");
  if (mobileMenu) {
    mobileMenu.addEventListener("click", (event) => {
      if (event.target.closest("a")) mobileMenu.removeAttribute("open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") mobileMenu.removeAttribute("open");
    });
  }

  if (typeof location === "undefined" || typeof navigator === "undefined") return;
  const language = String((navigator.languages && navigator.languages[0]) || navigator.language || "ko").toLowerCase().split("-")[0];
  const locale = { en: "en", de: "de", ja: "ja" }[language];
  const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "")
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "post";
  const localeEntry = window.HOUSE_DUCK_BLOG_LOCALES && window.HOUSE_DUCK_BLOG_LOCALES.posts && window.HOUSE_DUCK_BLOG_LOCALES.posts[slug];
  const translatedUrl = locale && localeEntry && localeEntry[locale];
  const translationLinks = document.querySelectorAll("[data-blog-locale]");
  let availableTranslations = 0;
  translationLinks.forEach((link) => {
    const translatedHref = localeEntry && localeEntry[link.dataset.blogLocale];
    if (!translatedHref) return;
    link.href = translatedHref;
    link.hidden = false;
    availableTranslations += 1;
  });
  const translationSwitcher = document.querySelector("[data-translation-links]");
  if (translationSwitcher && availableTranslations > 0) {
    translationSwitcher.hidden = false;
  }

  const originalRequested = new URLSearchParams(location.search).get("original") === "1";
  const isPublicArticle = document.body.id === "tt-body-page" && /^(?:blog\.houseduck\.in|houseduck\.tistory\.com)$/.test(location.hostname);
  const isPublicIndex = document.body.id === "tt-body-index" && location.pathname === "/" && /^(?:blog\.houseduck\.in|houseduck\.tistory\.com)$/.test(location.hostname);
  const isSearchBot = /bot|crawler|spider|google|bing|yandex|baidu/i.test(navigator.userAgent || "");
  const destination = isPublicArticle ? translatedUrl : (isPublicIndex && locale ? `https://houseduck.in/blog/${locale}/` : "");
  if (destination && !originalRequested && !isSearchBot) {
    location.replace(destination);
  }
})();
