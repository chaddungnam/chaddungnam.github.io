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

  function init(documentRef) {
    var saved = "";
    try {
      saved = root.localStorage.getItem("house_duck_theme") || "";
    } catch (_error) {
      saved = "";
    }
    applyTheme(documentRef, saved);
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
    documentRef.querySelectorAll(".mirror-body iframe").forEach(function (frame) {
      var width = Number(frame.getAttribute("width"));
      var height = Number(frame.getAttribute("height"));
      if (width > 0 && height > 0) frame.style.aspectRatio = width + " / " + height;
    });
  }

  var api = { resolveTheme: resolveTheme, init: init };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", function () { init(root.document); }, { once: true });
    else init(root.document);
  }
})(typeof window !== "undefined" ? window : null);
