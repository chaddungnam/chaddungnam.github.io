(function () {
  "use strict";

  function escapeMarkup(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeHttpsUrl(value) {
    try {
      var parsed = new URL(String(value || ""));
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch (_error) {
      return "";
    }
  }

  function buildPostCards(posts, locale) {
    var localeKey = locale === "ko" ? "kr" : locale;
    var dateLocales = { ko: "ko-KR", en: "en-US", de: "de-DE", ja: "ja-JP" };
    return (Array.isArray(posts) ? posts : []).slice(0, 4).map(function (post, index) {
      var localized = post.localized && (post.localized[localeKey] || post.localized.kr) || post;
      var link = safeHttpsUrl(locale === "ko" ? post.original_url : (localized.url || post.url));
      if (!link) return "";
      var image = safeHttpsUrl(post.image);
      var published = new Date(post.published_at);
      var date = Number.isNaN(published.valueOf())
        ? "HOUSE DUCK BLOG"
        : new Intl.DateTimeFormat(dateLocales[locale] || "en-US", { dateStyle: "medium" }).format(published);
      return '<article class="post-preview-card' + (index === 3 ? ' post-preview-card-wide' : '') + '"><a class="post-preview-link" href="' + escapeMarkup(link) + '">' +
        (image ? '<img class="post-preview-image" src="' + escapeMarkup(image) + '" alt="" loading="lazy">' : "") +
        '<div class="post-preview-copy"><small>' + escapeMarkup(date) + '</small><h3>' + escapeMarkup(localized.title) +
        '</h3><p>' + escapeMarkup(localized.summary) + '</p></div></a></article>';
    }).join("");
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { buildPostCards: buildPostCards };
  }
  if (typeof document === "undefined") return;

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
    : "dark";
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
  var controlLabels = {
    ko: {
      themeLight: "라이트 모드로 전환",
      themeDark: "다크 모드로 전환",
      menuOpen: "메뉴 열기",
      menuClose: "메뉴 닫기",
    },
    en: {
      themeLight: "Switch to light mode",
      themeDark: "Switch to dark mode",
      menuOpen: "Open menu",
      menuClose: "Close menu",
    },
    de: {
      themeLight: "Zum hellen Modus wechseln",
      themeDark: "Zum dunklen Modus wechseln",
      menuOpen: "Menü öffnen",
      menuClose: "Menü schließen",
    },
    ja: {
      themeLight: "ライトモードに切り替え",
      themeDark: "ダークモードに切り替え",
      menuOpen: "メニューを開く",
      menuClose: "メニューを閉じる",
    },
  };
  var controlCopy = controlLabels[locale] || controlLabels.en;

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
    function setTheme(theme) {
      root.dataset.theme = theme;
      var themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = theme === "dark" ? "#111315" : "#f8f9fa";
      document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
        button.setAttribute("aria-label", theme === "dark" ? controlCopy.themeLight : controlCopy.themeDark);
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

    document.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var postFeed = document.querySelector("[data-post-feed]");
    var latestGrid = postFeed && postFeed.querySelector('[data-post-panel="latest"] .post-preview-grid');
    if (latestGrid) {
      postFeed.setAttribute("aria-busy", "true");
      fetch("/assets/blog-feed.json", { cache: "no-cache" })
        .then(function (response) {
          if (!response.ok) throw new Error("Blog feed unavailable");
          return response.json();
        })
        .then(function (feed) {
          var cards = buildPostCards(feed.posts, locale);
          if (cards) latestGrid.innerHTML = cards;
        })
        .catch(function () {
          // The authored fallback remains visible while the next sync runs.
        })
        .finally(function () {
          postFeed.removeAttribute("aria-busy");
        });
    }

    var nav = document.querySelector("[data-site-nav]");
    var menuButton = document.querySelector("[data-menu-button]");

    function setMenuState(isOpen) {
      if (!nav || !menuButton) return;
      if (isOpen) nav.classList.add("is-open");
      else nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? controlCopy.menuClose : controlCopy.menuOpen);
    }

    function closeMenu() {
      setMenuState(false);
    }

    if (nav && menuButton) {
      setMenuState(false);
      menuButton.addEventListener("click", function () {
        setMenuState(menuButton.getAttribute("aria-expanded") !== "true");
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
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

    var reducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll("[data-typewriter]").forEach(function (heading) {
      var lines = Array.from(heading.querySelectorAll("[data-type-line]"));
      if (!lines.length || reducedMotion) {
        heading.dataset.typed = "true";
        return;
      }
      var source = lines.map(function (line) { return line.textContent; });
      lines.forEach(function (line) { line.textContent = ""; });
      var lineIndex = 0;
      var characterIndex = 0;

      function typeNextCharacter() {
        if (lineIndex >= lines.length) {
          heading.dataset.typed = "true";
          return;
        }
        if (characterIndex >= source[lineIndex].length) {
          lineIndex += 1;
          characterIndex = 0;
          window.setTimeout(typeNextCharacter, 150);
          return;
        }
        var character = source[lineIndex].charAt(characterIndex);
        lines[lineIndex].textContent += character;
        characterIndex += 1;
        window.setTimeout(typeNextCharacter, /[,.!?。]/.test(character) ? 150 : 38);
      }
      typeNextCharacter();
    });

    function animateIn(node) {
      if (reducedMotion || typeof node.animate !== "function") return;
      node.animate([
        { opacity: .35, filter: "blur(5px)", transform: "translateY(14px)" },
        { opacity: 1, filter: "blur(0)", transform: "translateY(0)" },
      ], { duration: 460, easing: "cubic-bezier(.2,.75,.2,1)", fill: "both" });
    }

    var revealNodes = Array.from(document.querySelectorAll(".reveal"));
    if ("IntersectionObserver" in window) {
      var revealObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animateIn(entry.target);
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8%", threshold: .08 });
      revealNodes.forEach(function (node) { revealObserver.observe(node); });
    } else {
      revealNodes.forEach(animateIn);
    }

    var previews = Array.from(document.querySelectorAll("[data-game-preview]"));
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reducedMotion || saveData) {
      previews.forEach(function (video) {
        video.autoplay = false;
        if (typeof video.pause === "function") video.pause();
      });
    } else if ("IntersectionObserver" in window) {
      var previewObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (!entry.isIntersecting) {
            video.pause();
            return;
          }
          var playback = video.play();
          if (playback && typeof playback.catch === "function") playback.catch(function () {});
        });
      }, { threshold: .2 });
      previews.forEach(function (video) { previewObserver.observe(video); });
    }
  });
}());
