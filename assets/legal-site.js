(function (root) {
  "use strict";

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function buildTocEntries(headings) {
    return Array.from(headings || [])
      .map(function (heading) {
        return {
          id: normalizeText(heading && heading.id),
          text: normalizeText(heading && (heading.text || heading.textContent)),
        };
      })
      .filter(function (entry) {
        return entry.id && entry.text;
      });
  }

  function resolveTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function applyTheme(documentRef, theme) {
    var selected = resolveTheme(theme);
    documentRef.documentElement.dataset.theme = selected;
    var language = String(documentRef.documentElement.lang || "en").split("-")[0];
    var labels = {
      ko: { light: "라이트 모드로 전환", dark: "다크 모드로 전환" },
      en: { light: "Switch to light mode", dark: "Switch to dark mode" },
      de: { light: "Zum hellen Modus wechseln", dark: "Zum dunklen Modus wechseln" },
      ja: { light: "ライトモードに切り替え", dark: "ダークモードに切り替え" },
    };
    var copy = labels[language] || labels.en;
    documentRef.querySelectorAll("[data-legal-theme-toggle]").forEach(function (button) {
      button.textContent = selected === "dark" ? "☀" : "☾";
      button.setAttribute("aria-label", selected === "dark" ? copy.light : copy.dark);
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
  }

  function initTheme(documentRef) {
    var headerLinks = documentRef.querySelector(".legal-header-links");
    if (!headerLinks) return;
    var button = documentRef.querySelector("[data-legal-theme-toggle]");
    if (!button) {
      button = documentRef.createElement("button");
      button.type = "button";
      button.className = "legal-theme-toggle";
      button.setAttribute("data-legal-theme-toggle", "");
      headerLinks.appendChild(button);
      button.addEventListener("click", function () {
        var theme = documentRef.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(documentRef, theme);
        try {
          root.localStorage.setItem("house_duck_theme", theme);
        } catch (_error) {
          // The selected theme still applies when storage is unavailable.
        }
      });
    }
    var saved = "";
    try {
      saved = root.localStorage.getItem("house_duck_theme") || "";
    } catch (_error) {
      saved = "";
    }
    applyTheme(documentRef, saved);
  }

  function fillToc(documentRef, entries) {
    documentRef.querySelectorAll("[data-toc-list]").forEach(function (list) {
      list.replaceChildren();
      entries.forEach(function (entry) {
        var item = documentRef.createElement("li");
        var link = documentRef.createElement("a");
        link.href = "#" + entry.id;
        link.textContent = entry.text;
        item.appendChild(link);
        list.appendChild(item);
      });
    });

    documentRef.querySelectorAll("[data-toc-container]").forEach(function (container) {
      container.hidden = entries.length === 0;
    });
  }

  function init(documentRef) {
    initTheme(documentRef);
    documentRef.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var headings = documentRef.querySelectorAll("[data-legal-content] h2[id]");
    fillToc(documentRef, buildTocEntries(headings));
  }

  var api = { buildTocEntries: buildTocEntries, resolveTheme: resolveTheme, init: init };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", function () {
        init(root.document);
      }, { once: true });
    } else {
      init(root.document);
    }
  }
})(typeof window !== "undefined" ? window : null);
