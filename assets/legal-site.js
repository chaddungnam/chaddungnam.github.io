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

  function setupDocumentTools(documentRef) {
    var paper = documentRef.querySelector(".legal-paper");
    var layout = documentRef.querySelector(".legal-layout");
    if (!paper || !layout || documentRef.querySelector(".legal-tools")) return;
    var locale = documentRef.documentElement.lang || "en";
    var labels = {
      ko: ["문서 도구", "문서 인쇄 / PDF", "맨 위로"],
      en: ["Document tools", "Print / save PDF", "Back to top"],
      de: ["Dokumentwerkzeuge", "Drucken / PDF", "Nach oben"],
      ja: ["文書ツール", "印刷 / PDF保存", "先頭へ"]
    }[locale] || ["Document tools", "Print / save PDF", "Back to top"];
    var tools = documentRef.createElement("nav");
    tools.className = "legal-tools";
    tools.setAttribute("aria-label", labels[0]);
    var print = documentRef.createElement("button");
    print.type = "button";
    print.textContent = labels[1];
    print.addEventListener("click", function () { if (root && root.print) root.print(); });
    var top = documentRef.createElement("a");
    top.href = "#legal-content";
    top.textContent = labels[2];
    tools.append(print, top);
    layout.before(tools);
    if (!root || !root.IntersectionObserver) return;
    var links = Array.from(documentRef.querySelectorAll("[data-toc-list] a"));
    var observer = new root.IntersectionObserver(function (entries) {
      entries.filter(function (entry) { return entry.isIntersecting; }).forEach(function (entry) {
        links.forEach(function (link) {
          if (link.getAttribute("href") === "#" + entry.target.id) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-100px 0px -60% 0px", threshold: 0 });
    paper.querySelectorAll("h2[id]").forEach(function (heading) { observer.observe(heading); });
  }

  function init(documentRef) {
    documentRef.documentElement.dataset.theme = "light";
    documentRef.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var headings = documentRef.querySelectorAll("[data-legal-content] h2[id]");
    fillToc(documentRef, buildTocEntries(headings));
    setupDocumentTools(documentRef);
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
