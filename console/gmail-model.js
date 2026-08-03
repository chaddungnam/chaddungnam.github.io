(function attachGmailModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GmailModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGmailModel() {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

  function decodeBase64Url(value) {
    try {
      const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
      const binary = atob(normalized);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch (_error) {
      return null;
    }
  }

  function encodeBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function headerValue(headers, name) {
    return String((headers || []).find((header) => String(header?.name || "").toLowerCase() === String(name).toLowerCase())?.value || "");
  }

  function mailboxAddress(value) {
    const text = String(value || "").trim();
    return (text.match(/<([^<>]+)>\s*$/)?.[1] || text).trim().toLowerCase();
  }

  function decodedBody(part) {
    const bytes = decodeBase64Url(part?.body?.data);
    return bytes ? decoder.decode(bytes) : "";
  }

  function stripHtml(value) {
    const withoutActive = String(value || "").replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
    if (typeof DOMParser !== "undefined") {
      const document = new DOMParser().parseFromString(withoutActive, "text/html");
      return String(document.body?.textContent || "").replace(/\s+/g, " ").trim();
    }
    return withoutActive.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
  }

  function extractMessageText(payload) {
    const plain = [];
    const html = [];
    (function visit(part) {
      const mimeType = String(part?.mimeType || "").toLowerCase();
      if (part?.body?.data && mimeType === "text/plain") plain.push(decodedBody(part));
      if (part?.body?.data && mimeType === "text/html") html.push(decodedBody(part));
      for (const child of part?.parts || []) visit(child);
    })(payload || {});
    const text = plain.find((value) => value.trim()) || "";
    if (text) return text.replace(/\r\n/g, "\n").trim();
    return stripHtml(html.find((value) => value.trim()) || "");
  }

  function listAttachments(payload) {
    const attachments = [];
    (function visit(part) {
      if (part?.filename && part?.body?.attachmentId) {
        attachments.push({
          filename: String(part.filename),
          mimeType: String(part.mimeType || "application/octet-stream"),
          size: Number(part.body.size || 0),
          attachmentId: String(part.body.attachmentId),
        });
      }
      for (const child of part?.parts || []) visit(child);
    })(payload || {});
    return attachments;
  }

  function safeHeader(value) {
    const result = String(value || "");
    if (!result || /[\r\n]/.test(result)) throw new Error("invalid_header");
    return result;
  }

  function encodedWord(value) {
    const text = safeHeader(value);
    return /^[\x20-\x7e]+$/.test(text) ? text : `=?UTF-8?B?${btoa(String.fromCharCode(...encoder.encode(text)))}?=`;
  }

  function base64Lines(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).match(/.{1,76}/g)?.join("\r\n") || "";
  }

  function buildReplyRaw({ from, to, subject, body, inReplyTo, references, attachments = [] }) {
    const checkedAttachments = Array.isArray(attachments) ? attachments : [];
    let totalBytes = 0;
    for (const attachment of checkedAttachments) {
      if (!(attachment.bytes instanceof Uint8Array)) throw new Error("invalid_attachment");
      if (attachment.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("attachment_too_large");
      totalBytes += attachment.bytes.byteLength;
    }
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("attachments_too_large");

    const lines = [
      `From: ${safeHeader(from)}`,
      `To: ${safeHeader(to)}`,
      `Subject: ${encodedWord(subject)}`,
      "MIME-Version: 1.0",
    ];
    if (inReplyTo) lines.push(`In-Reply-To: ${safeHeader(inReplyTo)}`);
    if (references) lines.push(`References: ${safeHeader(references)}`);
    const textBody = String(body || "").replace(/\r?\n/g, "\r\n");

    if (checkedAttachments.length === 0) {
      lines.push("Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", textBody);
    } else {
      const boundary = `=_HouseDuck_${crypto.randomUUID().replace(/-/g, "")}`;
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", textBody);
      for (const attachment of checkedAttachments) {
        const filename = safeHeader(attachment.filename).replace(/["\\]/g, "_");
        const mimeType = safeHeader(attachment.mimeType || "application/octet-stream");
        lines.push(`--${boundary}`, `Content-Type: ${mimeType}`, "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`, "", base64Lines(attachment.bytes));
      }
      lines.push(`--${boundary}--`);
    }
    return encodeBase64Url(encoder.encode(lines.join("\r\n")));
  }

  function nextStatusLabels(currentLabelIds, targetStatusId, allStatusIds) {
    const current = new Set(currentLabelIds || []);
    return {
      addLabelIds: current.has(targetStatusId) ? [] : [targetStatusId],
      removeLabelIds: (allStatusIds || []).filter((id) => id !== targetStatusId && current.has(id)),
    };
  }

  function extractDisplayCode(text) {
    return String(text || "").match(/\bp[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}\b/i)?.[0].replace(/^P/, "p").toUpperCase().replace(/^P/, "p") || "";
  }

  function csThreadState(thread, statusIds, now = Date.now()) {
    const labels = new Set(thread?.labelIds || []);
    let status = Object.entries(statusIds || {}).find(([, id]) => labels.has(id))?.[0] || "new";
    if (status !== "done" && status !== "new") status = thread?.latestFromSupport ? "waiting_customer" : "needs_reply";
    const urgent = status === "needs_reply" && Number(now) - Number(thread?.latestAt || now) >= 24 * 60 * 60 * 1000;
    return { status, urgent };
  }

  function playerSearchHash(displayCode) {
    return `#/players?query=${encodeURIComponent(displayCode)}&return=${encodeURIComponent("#/cs")}`;
  }

  return {
    decodeBase64Url,
    encodeBase64Url,
    headerValue,
    mailboxAddress,
    extractMessageText,
    listAttachments,
    buildReplyRaw,
    nextStatusLabels,
    extractDisplayCode,
    csThreadState,
    playerSearchHash,
  };
});
