(function attachNoticeContent(root) {
  "use strict";
  const MEDIA_BASE = "https://bbgwvpwzkyudbtcgrbtm.supabase.co/storage/v1/object/public/announcement-media/";
  const sizes = new Set(["small", "normal", "large", "title"]);
  const aligns = new Set(["left", "center", "right"]);
  const widths = new Set([50, 75, 100]);

  // Treat content as data, never markup. Validate the entire document before loading assets.
  function valid(content) {
    if (content?.version !== 1 || !Array.isArray(content.blocks)
      || !content.blocks.length || content.blocks.length > 60) return false;
    let images = 0;
    let textLength = 0;
    let paragraphs = 0;
    const textParts = [];
    for (const block of content.blocks) {
      if (!block || typeof block !== "object") return false;
      if (block.type === "paragraph") {
        if (typeof block.text !== "string" || !sizes.has(block.size) || !aligns.has(block.align)
          || ["bold", "italic", "underline"].some((key) => typeof block[key] !== "boolean")) return false;
        textLength += Array.from(block.text).length;
        paragraphs += 1;
        textParts.push(block.text);
      } else if (block.type === "image") {
        if (++images > 8 || typeof block.path !== "string" || !/^[a-f0-9]{64}\.webp$/.test(block.path)
          || typeof block.alt !== "string" || Array.from(block.alt).length > 2000 || !widths.has(block.width)) return false;
        textLength += Array.from(block.alt).length;
      } else if (block.type !== "divider") return false;
    }
    const joinedBody = paragraphs ? textParts.join("\n\n") : content.blocks.filter((block) => block.type === "image" && block.alt).map((block) => block.alt).join("\n\n");
    const separators = paragraphs ? Math.max(0, paragraphs - 1) * 2 : Math.max(0, content.blocks.filter((block) => block.type === "image" && block.alt).length - 1) * 2;
    return Boolean(joinedBody.trim()) && textLength + separators <= 12000;
  }

  function render(container, content, fallback) {
    container.replaceChildren();
    container.classList.remove("notice-rich-content");
    if (!valid(content)) {
      if (root.NoticeLinks) root.NoticeLinks.render(fallback, container);
      else container.textContent = String(fallback ?? "");
      return false;
    }
    container.classList.add("notice-rich-content");
    const document = container.ownerDocument;
    for (const block of content.blocks) {
      if (block.type === "divider") {
        container.append(document.createElement("hr"));
      } else if (block.type === "paragraph") {
        const paragraph = document.createElement(block.size === "title" ? "h2" : "p");
        paragraph.className = `notice-paragraph notice-size-${block.size} notice-align-${block.align}`;
        paragraph.classList.toggle("notice-bold", block.bold);
        paragraph.classList.toggle("notice-italic", block.italic);
        paragraph.classList.toggle("notice-underline", block.underline);
        container.append(paragraph);
        if (root.NoticeLinks) root.NoticeLinks.render(block.text, paragraph);
        else paragraph.textContent = block.text;
      } else {
        const figure = document.createElement("figure");
        figure.className = `notice-image notice-width-${block.width}`;
        const image = document.createElement("img");
        image.alt = block.alt;
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.src = MEDIA_BASE + block.path;
        image.addEventListener("error", () => {
          image.hidden = true;
          figure.classList.add("notice-image-unavailable");
          const replacement = document.createElement("p");
          // Accessible description remains available even offline; no arbitrary fallback URL.
          replacement.textContent = block.alt || "Image unavailable";
          figure.append(replacement);
        }, { once: true });
        figure.append(image);
        container.append(figure);
      }
    }
    return true;
  }

  root.HouseDuckNoticeContent = Object.freeze({ render, valid });
})(window);
