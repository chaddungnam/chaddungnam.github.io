(function (root) {
  "use strict";

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

  function recoverImageAltText(documentRef) {
    documentRef.querySelectorAll(".mirror-body img").forEach(function (image) {
      if (image.getAttribute("alt")) return;
      var figure = image.closest("figure");
      var caption = figure && figure.querySelector("figcaption");
      var alt = String(image.dataset.alt || (figure && figure.dataset.alt) || (caption && caption.textContent) || "").trim();
      if (alt) image.setAttribute("alt", alt);
      image.decoding = "async";
    });
  }

  function init(documentRef) {
    documentRef.documentElement.dataset.theme = "light";
    var color = documentRef.querySelector('meta[name="theme-color"]');
    if (color) color.content = "#f8f9fa";
    hydrateOpenGraphImages(documentRef);
    recoverImageAltText(documentRef);
    documentRef.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var reducedMotion = typeof root.matchMedia === "function" && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    documentRef.querySelectorAll("[data-typewriter]").forEach(function (dialogue) {
      var lines = Array.from(dialogue.querySelectorAll("[data-type-line]"));
      if (!lines.length || reducedMotion) {
        dialogue.dataset.typed = "true";
        return;
      }
      var source = lines.map(function (line) { return line.textContent; });
      lines.forEach(function (line) { line.textContent = ""; });
      var lineIndex = 0;
      var characterIndex = 0;
      function typeNextCharacter() {
        if (lineIndex >= lines.length) {
          dialogue.dataset.typed = "true";
          return;
        }
        if (characterIndex >= source[lineIndex].length) {
          lineIndex += 1;
          characterIndex = 0;
          root.setTimeout(typeNextCharacter, 150);
          return;
        }
        var character = source[lineIndex].charAt(characterIndex);
        lines[lineIndex].textContent += character;
        characterIndex += 1;
        root.setTimeout(typeNextCharacter, /[,.!?。]/.test(character) ? 150 : 38);
      }
      typeNextCharacter();
    });

    var previewNodes = Array.from(documentRef.querySelectorAll("[data-preview-type]"));
    function typePreview(node) {
      var source = node.textContent;
      if (!source || reducedMotion) {
        node.dataset.typed = "true";
        return;
      }
      node.setAttribute("aria-label", source);
      node.textContent = "";
      var index = 0;
      function next() {
        if (index >= source.length) {
          node.dataset.typed = "true";
          node.removeAttribute("aria-label");
          return;
        }
        var character = source.charAt(index);
        node.textContent += character;
        index += 1;
        root.setTimeout(next, /[,.!?。]/.test(character) ? 24 : 8);
      }
      next();
    }
    if (typeof root.IntersectionObserver === "function") {
      var observer = new root.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          typePreview(entry.target);
        });
      }, { rootMargin: "0px 0px 8%", threshold: .05 });
      previewNodes.forEach(function (node) { observer.observe(node); });
    } else {
      previewNodes.forEach(typePreview);
    }

    var previews = Array.from(documentRef.querySelectorAll("[data-game-preview]"));
    var saveData = root.navigator && root.navigator.connection && root.navigator.connection.saveData;
    if (reducedMotion || saveData) {
      previews.forEach(function (video) { video.autoplay = false; if (typeof video.pause === "function") video.pause(); });
    } else {
      previews.forEach(function (video) {
        var playback = typeof video.play === "function" && video.play();
        if (playback && typeof playback.catch === "function") playback.catch(function () {});
      });
    }
  }

  var api = { hydrateOpenGraphImages: hydrateOpenGraphImages, recoverImageAltText: recoverImageAltText, init: init };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", function () { init(root.document); }, { once: true });
    else init(root.document);
  }
})(typeof window !== "undefined" ? window : null);
