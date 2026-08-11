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
    documentRef.documentElement.dataset.theme = "light";
    documentRef.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var headings = documentRef.querySelectorAll("[data-legal-content] h2[id]");
    fillToc(documentRef, buildTocEntries(headings));
  }

  var api = { buildTocEntries: buildTocEntries, init: init };

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
