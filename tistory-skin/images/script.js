(() => {
  "use strict";

  const root = document.documentElement;
  let savedTheme = "";
  let cookieTheme = "";
  try {
    cookieTheme = String(document.cookie || "").match(/(?:^|;\s*)house_duck_theme=(light|dark)(?:;|$)/)?.[1] || "";
  } catch (_error) {
    // Opaque preview documents can deny cookie reads.
  }

  function saveSharedTheme(theme) {
    try {
      document.cookie = `house_duck_theme=${theme}; Domain=houseduck.in; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    } catch (_error) {
      // Local storage remains available when cookies are blocked.
    }
  }

  try {
    savedTheme = localStorage.getItem("house_duck_theme") || "";
  } catch (_error) {
    savedTheme = "";
  }
  const initialTheme = cookieTheme || (savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark");
  if (!cookieTheme && (savedTheme === "light" || savedTheme === "dark")) saveSharedTheme(savedTheme);

  function setTheme(theme) {
    root.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#111315" : "#f8f9fa";
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
      saveSharedTheme(theme);
    });
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  document.querySelectorAll("[data-category-list] .link_tit").forEach((link) => {
    const label = [...link.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim());
    if (label) label.textContent = "전체 글 ";
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

  document.querySelectorAll(".article-body figure, .article-body .imageblock, .article-body .imagegridblock").forEach((media) => {
    media.style.display = "block";
    media.style.width = "100%";
    media.style.margin = "2.2em 0";
    media.style.transform = "none";
  });

  document.querySelectorAll(".article-body img").forEach((image) => {
    const width = Number(image.getAttribute("width") || image.dataset.originWidth);
    const height = Number(image.getAttribute("height") || image.dataset.originHeight);
    if (width > 0 && height > 0) {
      image.style.width = `min(100%, ${width}px)`;
      image.style.aspectRatio = `${width} / ${height}`;
    }
    if (image.getAttribute("alt")) return;
    const figure = image.closest("figure");
    const caption = figure && figure.querySelector("figcaption");
    const alt = String(image.dataset.alt || (figure && figure.dataset.alt) || (caption && caption.textContent) || "").trim();
    if (alt) image.setAttribute("alt", alt);
    image.decoding = "async";
  });

  const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-typewriter]").forEach((dialogue) => {
    const lines = [...dialogue.querySelectorAll("[data-type-line]")];
    if (!lines.length || reducedMotion) {
      dialogue.dataset.typed = "true";
      return;
    }
    const source = lines.map((line) => line.textContent);
    lines.forEach((line) => { line.textContent = ""; });
    let lineIndex = 0;
    let characterIndex = 0;
    function typeNextCharacter() {
      if (lineIndex >= lines.length) {
        dialogue.dataset.typed = "true";
        return;
      }
      if (characterIndex >= source[lineIndex].length) {
        lineIndex += 1;
        characterIndex = 0;
        window.setTimeout(typeNextCharacter, 150);
        return;
      }
      const character = source[lineIndex].charAt(characterIndex);
      lines[lineIndex].textContent += character;
      characterIndex += 1;
      window.setTimeout(typeNextCharacter, /[,.!?。]/.test(character) ? 150 : 38);
    }
    typeNextCharacter();
  });

  const previewNodes = [...document.querySelectorAll("[data-preview-type]")];
  function typePreview(node) {
    const source = node.textContent;
    if (!source || reducedMotion) {
      node.dataset.typed = "true";
      return;
    }
    node.setAttribute("aria-label", source);
    node.textContent = "";
    let index = 0;
    function next() {
      if (index >= source.length) {
        node.dataset.typed = "true";
        node.removeAttribute("aria-label");
        return;
      }
      const character = source.charAt(index);
      node.textContent += character;
      index += 1;
      window.setTimeout(next, /[,.!?。]/.test(character) ? 24 : 8);
    }
    next();
  }
  if ("IntersectionObserver" in window) {
    const previewObserver = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        previewObserver.unobserve(entry.target);
        typePreview(entry.target);
      });
    }, { rootMargin: "0px 0px 8%", threshold: .05 });
    previewNodes.forEach((node) => previewObserver.observe(node));
  } else {
    previewNodes.forEach(typePreview);
  }

  const previews = [...document.querySelectorAll("[data-game-preview]")];
  if (reducedMotion || navigator.connection?.saveData) {
    previews.forEach((video) => { video.autoplay = false; video.pause?.(); });
  } else {
    previews.forEach((video) => video.play?.().catch?.(() => {}));
  }

  const articleToc = document.querySelector("[data-article-toc]");
  const articleHeadings = [...document.querySelectorAll(".article-body h2, .article-body h3")];
  if (articleToc && articleHeadings.length >= 2) {
    const tocList = articleToc.querySelector("ol");
    const tocLinks = new Map();
    let currentRootItem = null;
    let currentChildList = null;
    articleHeadings.forEach((heading, index) => {
      heading.id ||= `article-section-${index + 1}`;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent.trim().replace(/^\s*(?:[-–—•]\s+|\d+[.)]\s+)/, "");
      item.append(link);
      tocLinks.set(heading.id, link);
      if (heading.tagName === "H3" && currentRootItem) {
        if (!currentChildList) {
          currentChildList = document.createElement("ol");
          currentChildList.className = "toc-children";
          currentRootItem.append(currentChildList);
        }
        currentChildList.append(item);
      } else {
        tocList.append(item);
        currentRootItem = item;
        currentChildList = null;
      }
    });
    articleToc.hidden = false;
    if ("IntersectionObserver" in window) {
      const observer = new window.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          tocLinks.forEach((link) => link.removeAttribute("aria-current"));
          tocLinks.get(entry.target.id)?.setAttribute("aria-current", "location");
        });
      }, { rootMargin: "-111px 0px -70% 0px" });
      articleHeadings.forEach((heading) => observer.observe(heading));
    }
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
  let translationSwitcher = document.querySelector("[data-translation-links]");
  if (!translationSwitcher) {
    const legacyLink = document.querySelector("[data-translation-link]");
    const legacyContainer = document.querySelector(".translation-note span");
    if (legacyLink && legacyContainer) {
      [["en", "English"], ["de", "Deutsch"], ["ja", "日本語"]].forEach(([key, label], index) => {
        const link = index === 0 ? legacyLink : document.createElement("a");
        link.dataset.blogLocale = key;
        link.textContent = label;
        link.hidden = true;
        if (index > 0) legacyContainer.append(link);
      });
      translationSwitcher = legacyContainer;
    }
  }
  const translationLinks = document.querySelectorAll("[data-blog-locale]");
  let availableTranslations = 0;
  translationLinks.forEach((link) => {
    const translatedHref = localeEntry && localeEntry[link.dataset.blogLocale];
    if (!translatedHref) return;
    link.href = translatedHref;
    link.hidden = false;
    availableTranslations += 1;
  });
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
