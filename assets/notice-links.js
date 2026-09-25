(function attachNoticeLinks(root) {
  "use strict";
  const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const MAX_PREVIEWS = 12;

  const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  // A leaked literal "&amp;" (or &lt; &gt; &quot; &#39; / numeric refs -- e.g. a URL pasted
  // from HTML source) must resolve to the real character exactly once so the URL and its
  // query string parse correctly: decoded before validation, never re-encoded afterwards,
  // so this never introduces double-escaping either.
  function decodeEntities(value) {
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref) => {
      if (ref[0] === "#") {
        const codePoint = ref[1].toLowerCase() === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole;
      }
      // hasOwnProperty.call, not the newer shorthand: the notices page also loads in the iOS
      // app's WebView, and Quirky Ball ships with min_ios_version 15.0, where the shorthand
      // (WebKit 15.4+) is missing and would throw while rendering a notice.
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, ref.toLowerCase()) ? NAMED_ENTITIES[ref.toLowerCase()] : whole;
    });
  }

  function parse(rawInput) {
    // Reject credentials, escaped authorities, controls and non-public/ambiguous hosts.
    const raw = decodeEntities(rawInput);
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

  // A URL glued straight to preceding text with no space ("영상:https://…") must still linkify;
  // one preceded by a word/URL character, or by a disguised javascript:/vbscript:/data: scheme,
  // must not. Both checks are plain source inspection instead of regex lookbehind because
  // lookbehind only exists in WebKit 16.4+, and this file is loaded by the notices page inside
  // the iOS app's WebView (Quirky Ball's min_ios_version is 15.0) -- there an unsupported regex
  // is a parse error that kills the whole file, silently disabling every notice link.
  const GLUED_TO_TEXT = /(?:^|[\s([{<>"'“‘:：·가-힣])$/u;
  const DISGUISED_SCHEME = /(?:javascript|vbscript|data):$/i;

  function links(text) {
    const found = [];
    // Keep punctuation outside links while preserving balanced URL parentheses.
    const pattern = /https:\/\/[^\s<>"'”’]+/giu;
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const before = text.slice(0, start);
      if (!GLUED_TO_TEXT.test(before) || DISGUISED_SCHEME.test(before)) continue;
      let raw = match[0].replace(/[.,;:!?。，、；：！？]+$/u, "");
      for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
        while (raw.endsWith(close) && raw.split(close).length > raw.split(open).length) raw = raw.slice(0, -1);
      }
      const parsed = parse(raw);
      if (parsed) found.push({ ...parsed, start, raw });
    }
    return found;
  }

  function anchor(document, href, text, selfTarget) {
    const element = document.createElement("a");
    element.href = href;
    element.target = selfTarget ? "_self" : "_blank";
    if (!selfTarget) element.rel = "noopener noreferrer";
    element.textContent = text;
    return element;
  }

  function embeddedApp(doc) {
    return new URLSearchParams(doc.defaultView.location.search).has("embed");
  }

  function isYouTubeUrl(raw) {
    if (!/^https:\/\//i.test(String(raw ?? ""))) return false;
    try {
      const url = new URL(decodeEntities(String(raw)));
      if (url.protocol !== "https:") return false;
      const host = url.hostname.toLowerCase();
      return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
    } catch (_) { return false; }
  }

  function card(link, container) {
    const document = container.ownerDocument;
    const embedded = embeddedApp(document);
    const preview = document.createElement("span");
    preview.className = "notice-link-preview";
    preview.dataset.noticeLinkKey = link.key;
    if (link.id) {
      const poster = anchor(document, link.url.href, "", embedded);
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
      // Native notice views use ?embed and currently allow only houseduck.in navigation. Do not
      // attempt an iframe there. Keep a normal link, target=_self so the native WebView's own
      // navigation handoff can hand YouTube off to the native app (that interception is being
      // fixed separately). No autoplay and no YouTube player request until an unmodified user click.
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
    const destination = anchor(document, link.url.href, "", embedded && Boolean(link.id));
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
    const embedded = embeddedApp(container.ownerDocument);
    let offset = 0;
    for (const link of found) {
      container.append(container.ownerDocument.createTextNode(text.slice(offset, link.start)));
      const inline = anchor(container.ownerDocument, link.url.href, link.raw, embedded && Boolean(link.id));
      inline.className = "notice-inline-link";
      container.append(inline);
      offset = link.start + link.raw.length;
    }
    container.append(container.ownerDocument.createTextNode(text.slice(offset)));
    appendPreviews(found, container);
  }
  root.NoticeLinks = Object.freeze({ render, previews, isYouTubeUrl });
})(window);
