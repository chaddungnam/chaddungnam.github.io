(function (root) {
  "use strict";

  function resolveTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function applyTheme(documentRef, theme) {
    var selected = resolveTheme(theme);
    documentRef.documentElement.dataset.theme = selected;
    var color = documentRef.querySelector('meta[name="theme-color"]');
    if (color) color.content = selected === "dark" ? "#0d1525" : "#f3f1ea";
    documentRef.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.textContent = selected === "dark" ? "☀" : "☾";
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
  }

  function hydrateOpenGraphImages(documentRef) {
    documentRef.querySelectorAll('[data-ke-type="opengraph"][data-og-image]').forEach(function (card) {
      var slot = card.querySelector(".og-image");
      if (!slot || slot.tagName === "IMG") return;
      var source;
      try {
        source = new URL(card.dataset.ogImage);
      } catch (_error) {
        return;
      }
      if (source.protocol !== "https:") return;
      var image = documentRef.createElement("img");
      image.src = source.href;
      image.alt = "";
      image.loading = "lazy";
      image.className = "og-image";
      slot.replaceWith(image);
    });
  }

  function init(documentRef) {
    var saved = "";
    try {
      saved = root.localStorage.getItem("house_duck_theme") || "";
    } catch (_error) {
      saved = "";
    }
    applyTheme(documentRef, saved);
    hydrateOpenGraphImages(documentRef);
    documentRef.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var theme = documentRef.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(documentRef, theme);
        try {
          root.localStorage.setItem("house_duck_theme", theme);
        } catch (_error) {
          // Theme switching still works when storage is unavailable.
        }
      });
    });
    documentRef.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  var api = { resolveTheme: resolveTheme, hydrateOpenGraphImages: hydrateOpenGraphImages, init: init };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", function () { init(root.document); }, { once: true });
    else init(root.document);
  }
})(typeof window !== "undefined" ? window : null);
