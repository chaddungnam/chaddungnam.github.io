(function attachNoticeLinks(root) {
  "use strict";
  const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const MAX_PREVIEWS = 12;

  function parse(raw) {
    // Reject credentials, escaped authorities, controls and non-public/ambiguous hosts.
    if (!/^https:\/\//i.test(raw) || /[\\\u0000-\u0020\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(raw)
      || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password || url.port
        || url.hostname.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)) return null;
      let id = null;
      if (url.hostname === "youtu.be") id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      if (YOUTUBE_HOSTS.has(url.hostname)) {
        if (url.pathname === "/watch") id = url.searchParams.get("v");
        else id = url.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      }
      if (!VIDEO_ID.test(id || "")) id = null;
      return { url, id, key: id ? `youtube:${id}` : url.href };
    } catch (_) { return null; }
  }

  function links(text) {
    const found = [];
    // Keep punctuation outside links while preserving balanced URL parentheses.
    const pattern = /(^|[\s([{<>"'“‘])https:\/\/[^\s<>"'”’]+/giu;
    for (const match of text.matchAll(pattern)) {
      const start = match.index + match[1].length;
      let raw = match[0].slice(match[1].length).replace(/[.,;:!?。，、；：！？]+$/u, "");
      for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
        while (raw.endsWith(close) && raw.split(close).length > raw.split(open).length) raw = raw.slice(0, -1);
      }
      const parsed = parse(raw);
      if (parsed) found.push({ ...parsed, start, raw });
    }
    return found;
  }

  function anchor(document, href, text) {
    const element = document.createElement("a");
    element.href = href;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
    element.textContent = text;
    return element;
  }

  function card(link, container) {
    const document = container.ownerDocument;
    const preview = document.createElement("span");
    preview.className = "notice-link-preview";
    preview.dataset.noticeLinkKey = link.key;
    if (link.id) {
      const poster = anchor(document, link.url.href, "");
      poster.className = "notice-link-poster";
      poster.setAttribute("aria-label", "YouTube: " + link.url.href);
      const image = document.createElement("img");
      image.alt = "YouTube";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.src = `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`;
      image.addEventListener("error", () => {
        image.hidden = true;
        poster.classList.add("notice-link-thumbnail-unavailable");
      }, { once: true });
      const play = document.createElement("span");
      play.className = "notice-link-play";
      play.textContent = "▶";
      play.setAttribute("aria-hidden", "true");
      poster.append(image, play);
      // Native notice views use ?embed and currently allow only houseduck.in navigation.
      // Do not attempt an iframe there. Keep a normal link, subject to native policy.
      // No autoplay and no YouTube player request until an unmodified user click.
      const embedded = new URLSearchParams(document.defaultView.location.search).has("embed");
      if (!embedded) poster.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const frame = document.createElement("iframe");
        frame.className = "notice-link-player";
        frame.title = "YouTube video";
        frame.src = `https://www.youtube-nocookie.com/embed/${link.id}?playsinline=1`;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        poster.replaceWith(frame);
        // The original URL below remains available if embedding is unavailable.
      });
      preview.append(poster);
    }
    const destination = anchor(document, link.url.href, "");
    destination.className = "notice-link-destination";
    const domain = document.createElement("strong");
    domain.textContent = link.id ? "YouTube" : link.url.hostname;
    const address = document.createElement("span");
    address.textContent = link.url.href;
    destination.append(domain, address);
    preview.append(destination);
    return preview;
  }

  function appendPreviews(found, container) {
    const scope = container.closest(".notice-rich-content") || container;
    const existing = [...scope.querySelectorAll(".notice-link-preview")];
    const seen = new Set(existing.map((node) => node.dataset.noticeLinkKey));
    for (const link of found) {
      if (seen.has(link.key) || seen.size >= MAX_PREVIEWS) continue;
      seen.add(link.key);
      container.append(card(link, container));
    }
  }

  // Both APIs append only. Callers own clearing/replacing their preview container.
  function previews(text, container) { appendPreviews(links(String(text ?? "")), container); }
  function render(text, container) {
    text = String(text ?? "");
    const found = links(text);
    let offset = 0;
    for (const link of found) {
      container.append(container.ownerDocument.createTextNode(text.slice(offset, link.start)));
      const inline = anchor(container.ownerDocument, link.url.href, link.raw);
      inline.className = "notice-inline-link";
      container.append(inline);
      offset = link.start + link.raw.length;
    }
    container.append(container.ownerDocument.createTextNode(text.slice(offset)));
    appendPreviews(found, container);
  }
  root.NoticeLinks = Object.freeze({ render, previews });
})(window);
