(function attachAnnouncementEditor(root) {
  "use strict";

  const LIMITS = Object.freeze({ blocks: 60, images: 8, text: 2000, inputBytes: 20 * 1024 * 1024, pixels: 40_000_000, edge: 1600, targetBytes: 200 * 1024, hardBytes: 300 * 1024 });
  const SIZES = new Set(["small", "normal", "large", "title"]);
  const ALIGNS = new Set(["left", "center", "right"]);
  const WIDTHS = new Set([50, 75, 100]);
  const IMAGE_PATH = /^[a-f0-9]{64}\.webp$/;
  const MEDIA_BASE = "https://bbgwvpwzkyudbtcgrbtm.supabase.co/storage/v1/object/public/announcement-media/";

  const codePointLength = (value) => Array.from(String(value ?? "")).length;
  const sourceLength = (blocks) => {
    const body = blocks.filter((block) => block.type === "paragraph").map((block) => block.text).join("\n\n");
    return codePointLength(body) + blocks.reduce((sum, block) => sum + (block.type === "image" ? codePointLength(block.alt) : 0), 0);
  };
  const paragraph = (text = "") => ({ type: "paragraph", text, size: "normal", align: "left", bold: false, italic: false, underline: false });
  const button = (text, action, label) => {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = text;
    node.dataset.blockAction = action;
    if (label) node.setAttribute("aria-label", label);
    return node;
  };
  const cloneContent = (content) => ({ version: 1, blocks: content.blocks.map((block) => ({ ...block })) });
  const contractBlock = (block) => {
    if (block.type === "paragraph") return { type: "paragraph", text: block.text, size: block.size, align: block.align, bold: block.bold, italic: block.italic, underline: block.underline };
    if (block.type === "image") return { type: "image", path: block.path, alt: block.alt, width: block.width };
    return { type: "divider" };
  };
  const byteText = (bytes) => {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  };

  function normalizedContent(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.blocks) || value.blocks.length > LIMITS.blocks) return null;
    const blocks = [];
    let images = 0;
    for (const source of value.blocks) {
      if (!source || typeof source !== "object") return null;
      if (source.type === "paragraph") {
        if (typeof source.text !== "string" || !SIZES.has(source.size) || !ALIGNS.has(source.align)
          || typeof source.bold !== "boolean" || typeof source.italic !== "boolean" || typeof source.underline !== "boolean") return null;
        blocks.push({ type: "paragraph", text: source.text, size: source.size, align: source.align, bold: source.bold, italic: source.italic, underline: source.underline });
      } else if (source.type === "image") {
        const width = Number(source.width);
        if (!IMAGE_PATH.test(String(source.path || "")) || typeof source.alt !== "string" || codePointLength(source.alt) > 200 || !WIDTHS.has(width)) return null;
        images += 1;
        blocks.push({ type: "image", path: source.path, alt: source.alt, width });
      } else if (source.type === "divider") {
        blocks.push({ type: "divider" });
      } else return null;
    }
    if (images > LIMITS.images || sourceLength(blocks) > LIMITS.text) return null;
    return { version: 1, blocks };
  }

  function create(form, options = {}) {
    const plainPanel = form.querySelector("#announcementPlainPanel");
    const richPanel = form.querySelector("#announcementRichPanel");
    const body = form.elements.body;
    const richButton = form.querySelector("#announcementRichMode");
    const plainButton = form.querySelector("#announcementPlainMode");
    const blockHost = form.querySelector("#announcementBlocks");
    const preview = form.querySelector("#announcementPreview");
    const status = form.querySelector("#announcementEditorStatus");
    const blockCount = form.querySelector("#announcementBlockCount");
    const textCount = form.querySelector("#announcementTextCount");
    const sizeSelect = form.querySelector("#announcementTextSize");
    const imageInput = form.querySelector("#announcementImageInput");
    let rich = false;
    let blocks = [];
    let selected = -1;
    let processing = false;
    let lastCaret = null;

    function message(value, error = false) {
      status.textContent = value || "";
      status.setAttribute("role", error ? "alert" : "status");
      status.classList.toggle("is-error", error);
      if (typeof options.onMessage === "function" && value) options.onMessage(value, error);
    }

    function textTotal() {
      return sourceLength(blocks);
    }

    function imageTotal() {
      return blocks.filter((block) => block.type === "image" || block.type === "pending-image").length;
    }

    function derivedBody() {
      return blocks.filter((block) => block.type === "paragraph").map((block) => block.text).join("\n\n");
    }

    function syncBodyAndCounts() {
      if (rich) body.value = derivedBody();
      blockCount.textContent = `${blocks.length} / ${LIMITS.blocks} 블록 · 이미지 ${imageTotal()} / ${LIMITS.images}`;
      textCount.textContent = `${textTotal()} / ${LIMITS.text} 소스 글자`;
      const draftError = validateDraft(false);
      body.setCustomValidity(draftError || "");
    }

    function validateDraft(requireText = true) {
      if (!rich) {
        if (codePointLength(body.value.trim()) > LIMITS.text) return `공지 소스는 총 ${LIMITS.text}자까지 입력할 수 있습니다.`;
        return body.value.trim() || !requireText ? "" : "공지 본문을 입력해 주세요.";
      }
      if (blocks.length > LIMITS.blocks) return `블록은 최대 ${LIMITS.blocks}개까지 추가할 수 있습니다.`;
      if (imageTotal() > LIMITS.images) return `이미지는 최대 ${LIMITS.images}개까지 추가할 수 있습니다.`;
      if (blocks.some((block) => block.type === "image" && codePointLength(block.alt) > 200)) return "이미지 대체 텍스트는 200자까지 입력할 수 있습니다.";
      if (textTotal() > LIMITS.text) return `문단 본문·문단 사이 줄바꿈·이미지 대체 텍스트를 합쳐 ${LIMITS.text}자까지 입력할 수 있습니다.`;
      if (blocks.some((block) => block.type === "pending-image")) return "이미지 처리를 완료하거나 해당 블록을 삭제해 주세요.";
      if (requireText && !derivedBody().trim()) return "공지에는 한 글자 이상의 문단이 필요합니다.";
      return "";
    }

    function safeImageUrl(path) {
      return IMAGE_PATH.test(String(path || "")) ? `${MEDIA_BASE}${path}` : "";
    }

    function renderPreview() {
      preview.replaceChildren();
      for (const block of blocks) {
        if (block.type === "paragraph") {
          const node = document.createElement(block.size === "title" ? "h3" : "p");
          node.textContent = block.text || "빈 문단";
          node.dataset.size = block.size;
          node.style.textAlign = block.align;
          node.style.fontWeight = block.bold ? "800" : "400";
          node.style.fontStyle = block.italic ? "italic" : "normal";
          node.style.textDecoration = block.underline ? "underline" : "none";
          preview.append(node);
        } else if (block.type === "divider") {
          preview.append(document.createElement("hr"));
        } else if (block.type === "image") {
          const figure = document.createElement("figure");
          figure.style.width = `${block.width}%`;
          const url = safeImageUrl(block.path);
          if (url) {
            const image = document.createElement("img");
            image.src = url;
            image.alt = block.alt;
            figure.append(image);
          } else {
            const placeholder = document.createElement("span");
            placeholder.textContent = `이미지 · ${block.path}`;
            figure.append(placeholder);
          }
          if (block.alt) {
            const caption = document.createElement("figcaption");
            caption.textContent = block.alt;
            figure.append(caption);
          }
          preview.append(figure);
        }
      }
      if (!blocks.length) {
        const empty = document.createElement("p");
        empty.className = "announcement-preview-empty";
        empty.textContent = "블록을 추가하면 미리보기가 표시됩니다.";
        preview.append(empty);
      }
    }

    function actionRow(index) {
      const actions = document.createElement("div");
      actions.className = "announcement-block-actions";
      const up = button("↑", "up", `${index + 1}번 블록 위로 이동`);
      const down = button("↓", "down", `${index + 1}번 블록 아래로 이동`);
      const remove = button("삭제", "remove", `${index + 1}번 블록 삭제`);
      up.disabled = processing || index === 0;
      down.disabled = processing || index === blocks.length - 1;
      remove.disabled = processing;
      actions.append(up, down, remove);
      return actions;
    }

    function renderBlocks(focusIndex = null) {
      blockHost.replaceChildren();
      blocks.forEach((block, index) => {
        const article = document.createElement("article");
        article.className = "announcement-block";
        article.dataset.blockIndex = String(index);
        article.classList.toggle("is-selected", index === selected);
        article.setAttribute("aria-label", `${index + 1}번 ${block.type === "paragraph" ? "문단" : block.type === "divider" ? "구분선" : "이미지"} 블록`);
        const header = document.createElement("header");
        const label = document.createElement("strong");
        label.textContent = `${index + 1}. ${block.type === "paragraph" ? "문단" : block.type === "divider" ? "구분선" : "이미지"}`;
        header.append(label, actionRow(index));
        article.append(header);

        if (block.type === "paragraph") {
          const input = document.createElement("textarea");
          input.value = block.text;
          input.rows = 3;
          input.dataset.blockText = "";
          input.setAttribute("aria-label", `${index + 1}번 문단 내용`);
          article.append(input);
        } else if (block.type === "divider") {
          const line = document.createElement("hr");
          line.setAttribute("aria-hidden", "true");
          article.append(line);
        } else {
          const grid = document.createElement("div");
          grid.className = "announcement-image-fields";
          if (block.type === "image") {
            const url = safeImageUrl(block.path);
            if (url) {
              const image = document.createElement("img");
              image.src = url;
              image.alt = block.alt;
              grid.append(image);
            }
            const altLabel = document.createElement("label");
            altLabel.append(document.createTextNode("대체 텍스트"));
            const alt = document.createElement("input");
            alt.value = block.alt;
            alt.dataset.imageAlt = "";
            altLabel.append(alt);
            const widthLabel = document.createElement("label");
            widthLabel.append(document.createTextNode("너비"));
            const width = document.createElement("select");
            width.dataset.imageWidth = "";
            [50, 75, 100].forEach((value) => {
              const option = document.createElement("option");
              option.value = String(value);
              option.textContent = `${value}%`;
              option.selected = value === block.width;
              width.append(option);
            });
            widthLabel.append(width);
            grid.append(altLabel, widthLabel);
            const compression = document.createElement("small");
            compression.className = "announcement-compression-result";
            compression.textContent = block.stats || `WebP · ${block.path}`;
            grid.append(compression);
          } else {
            const pending = document.createElement("p");
            pending.className = block.error ? "announcement-upload-error" : "announcement-upload-progress";
            pending.textContent = block.error || "이미지를 WebP로 압축하고 있습니다...";
            grid.append(pending);
            if (block.error) {
              const retry = button("다시 시도", "retry", `${index + 1}번 이미지 다시 처리`);
              retry.className = "editor-retry-button";
              retry.disabled = processing;
              grid.append(retry);
            }
          }
          article.append(grid);
        }
        blockHost.append(article);
      });
      syncBodyAndCounts();
      renderPreview();
      syncToolbar();
      if (focusIndex !== null) {
        const target = blockHost.querySelector(`[data-block-index="${focusIndex}"] textarea, [data-block-index="${focusIndex}"] input`);
        target?.focus();
      }
    }

    function syncToolbar() {
      const block = blocks[selected];
      const enabled = !processing && block?.type === "paragraph";
      sizeSelect.disabled = !enabled;
      if (enabled) sizeSelect.value = block.size;
      form.querySelectorAll("[data-format]").forEach((control) => {
        control.disabled = !enabled;
        control.setAttribute("aria-pressed", enabled && block[control.dataset.format] ? "true" : "false");
      });
      form.querySelectorAll("[data-align]").forEach((control) => {
        control.disabled = !enabled;
        control.setAttribute("aria-pressed", enabled && block.align === control.dataset.align ? "true" : "false");
      });
    }

    function select(index) {
      if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return;
      selected = index;
      blockHost.querySelectorAll(".announcement-block").forEach((node, nodeIndex) => node.classList.toggle("is-selected", nodeIndex === selected));
      syncToolbar();
    }

    function rememberCaret(target) {
      if (!target?.matches("[data-block-text]")) return;
      const index = Number(target.closest("[data-block-index]")?.dataset.blockIndex);
      if (Number.isInteger(index) && Number.isInteger(target.selectionStart)) lastCaret = { index, point: target.selectionStart };
    }

    function splitPoint() {
      const block = blocks[selected];
      if (block?.type !== "paragraph") return null;
      const active = document.activeElement;
      const activeMatches = active?.matches("[data-block-text]") && active.closest("[data-block-index]")?.dataset.blockIndex === String(selected);
      const point = activeMatches && Number.isInteger(active.selectionStart)
        ? active.selectionStart
        : lastCaret?.index === selected ? lastCaret.point : null;
      if (!Number.isInteger(point)) return null;
      const safePoint = Math.max(0, Math.min(block.text.length, point));
      return { before: block.text.slice(0, safePoint), after: block.text.slice(safePoint) };
    }

    function insertAfterSelection(block) {
      const previousBlocks = blocks.map((current) => ({ ...current }));
      const previousSelected = selected;
      const split = splitPoint();
      const insertAt = selected >= 0 ? selected + 1 : blocks.length;
      const extra = split?.after ? 1 : 0;
      if (blocks.length + 1 + extra > LIMITS.blocks) {
        message(`블록은 최대 ${LIMITS.blocks}개까지 추가할 수 있습니다.`, true);
        return -1;
      }
      if (split) blocks[selected].text = split.before;
      blocks.splice(insertAt, 0, block);
      if (split?.after) blocks.splice(insertAt + 1, 0, paragraph(split.after));
      if (sourceLength(blocks) > LIMITS.text) {
        blocks = previousBlocks;
        selected = previousSelected;
        renderBlocks(selected >= 0 ? selected : null);
        message(`문단 분리의 줄바꿈까지 포함해 공지 소스는 ${LIMITS.text}자 이하여야 합니다.`, true);
        return -1;
      }
      selected = insertAt;
      renderBlocks(block.type === "paragraph" ? insertAt : split?.after ? insertAt + 1 : null);
      return insertAt;
    }

    function enterRichMode() {
      if (rich || processing) return;
      const value = body.value;
      blocks = value ? value.split("\n\n").map((text) => paragraph(text)) : [paragraph()];
      selected = 0;
      rich = true;
      plainPanel.hidden = true;
      richPanel.hidden = false;
      richButton.setAttribute("aria-expanded", "true");
      richButton.textContent = "블록 편집 중";
      renderBlocks(0);
      message("블록 편집을 시작했습니다. 선택한 문단 뒤에 이미지나 구분선을 추가할 수 있습니다.");
    }

    function hasRichOnlyData() {
      return blocks.some((block) => block.type !== "paragraph") || blocks.some((block) => block.type === "paragraph" && (block.size !== "normal" || block.align !== "left" || block.bold || block.italic || block.underline));
    }

    function enterPlainMode() {
      if (!rich || processing) return;
      if (hasRichOnlyData() && !root.confirm("이미지·구분선·문단 서식은 일반 텍스트에서 표시되지 않습니다. 일반 텍스트로 전환할까요?")) return;
      body.value = derivedBody();
      rich = false;
      blocks = [];
      selected = -1;
      plainPanel.hidden = false;
      richPanel.hidden = true;
      richButton.setAttribute("aria-expanded", "false");
      richButton.textContent = "블록 편집 사용";
      body.setCustomValidity("");
      body.focus();
      message("일반 텍스트 편집으로 전환했습니다.");
    }

    function setProcessing(value) {
      processing = value;
      form.dataset.editorProcessing = value ? "true" : "false";
      form.querySelectorAll("button, input, select, textarea").forEach((control) => {
        if (control.type !== "hidden") control.disabled = value;
      });
      if (typeof options.onBusy === "function") options.onBusy(value);
      if (rich) renderBlocks();
    }

    function inspectWebp(bytes) {
      const ascii = new TextDecoder("ascii").decode(bytes);
      let animated = ascii.includes("ANIM") || ascii.includes("ANMF");
      let metadata = false;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const name = ascii.slice(offset, offset + 4);
        const size = view.getUint32(offset + 4, true);
        if (name === "ANIM" || name === "ANMF") animated = true;
        if (name === "EXIF" || name === "XMP " || name === "ICCP") metadata = true;
        const next = offset + 8 + size + (size % 2);
        if (next <= offset || next > bytes.length) break;
        offset = next;
      }
      return { animated, metadata };
    }

    function stripWebpMetadata(bytes) {
      if (bytes.length < 12) return bytes;
      const ascii = new TextDecoder("ascii").decode(bytes);
      if (ascii.slice(0, 4) !== "RIFF" || ascii.slice(8, 12) !== "WEBP") return bytes;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const parts = [bytes.slice(0, 12)];
      let offset = 12;
      let changed = false;
      while (offset + 8 <= bytes.length) {
        const name = ascii.slice(offset, offset + 4);
        const size = view.getUint32(offset + 4, true);
        const next = offset + 8 + size + (size % 2);
        if (next <= offset || next > bytes.length) return bytes;
        if (name === "EXIF" || name === "XMP " || name === "ICCP") {
          changed = true;
        } else {
          const part = bytes.slice(offset, next);
          if (name === "VP8X" && size >= 1) {
            const flags = part[8];
            part[8] &= ~0x2c;
            changed ||= flags !== part[8];
          }
          parts.push(part);
        }
        offset = next;
      }
      if (!changed || offset !== bytes.length) return bytes;
      const length = parts.reduce((sum, part) => sum + part.length, 0);
      const output = new Uint8Array(length);
      let cursor = 0;
      parts.forEach((part) => { output.set(part, cursor); cursor += part.length; });
      new DataView(output.buffer).setUint32(4, output.length - 8, true);
      return output;
    }

    async function sniffFile(file) {
      if (!file || file.size < 12) throw new Error("PNG, JPEG 또는 정지 WebP 이미지를 선택해 주세요.");
      if (file.size > LIMITS.inputBytes) throw new Error("원본 이미지는 20 MiB 이하여야 합니다.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const head = new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
      const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const gif = head.startsWith("gif87a") || head.startsWith("gif89a");
      const webp = head.startsWith("riff") && head.slice(8, 12) === "webp";
      const svg = file.type === "image/svg+xml" || /^<\?xml|^<svg|<!doctype\s+svg/.test(head);
      if (svg) throw new Error("SVG는 지원하지 않습니다. PNG, JPEG 또는 정지 WebP를 사용해 주세요.");
      if (gif) throw new Error("움직이는 이미지는 지원하지 않습니다. 정지 PNG, JPEG 또는 WebP를 사용해 주세요.");
      const webpInfo = webp ? inspectWebp(bytes) : { animated: false, metadata: false };
      if (webpInfo.animated) throw new Error("움직이는 WebP는 지원하지 않습니다. 정지 이미지를 사용해 주세요.");
      if (!png && !jpeg && !webp) throw new Error("PNG, JPEG 또는 정지 WebP 이미지를 선택해 주세요.");
      return { bytes, format: webp ? "webp" : png ? "png" : "jpeg", metadata: webpInfo.metadata };
    }

    async function canvasBlob(canvas, quality) {
      const encoded = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("브라우저에서 WebP 압축을 완료하지 못했습니다.")), "image/webp", quality));
      const stripped = stripWebpMetadata(new Uint8Array(await encoded.arrayBuffer()));
      return new Blob([stripped], { type: "image/webp" });
    }

    async function compress(file) {
      const source = await sniffFile(file);
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch (_) {
        throw new Error("손상되었거나 읽을 수 없는 이미지입니다.");
      }
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > LIMITS.pixels) {
        bitmap.close?.();
        throw new Error("이미지 픽셀 수가 너무 큽니다. 4천만 픽셀 이하 이미지를 사용해 주세요.");
      }
      const originalAllowed = source.format === "webp" && !source.metadata
        && Math.max(bitmap.width, bitmap.height) <= LIMITS.edge && source.bytes.length <= LIMITS.hardBytes;
      const startScale = Math.min(1, LIMITS.edge / Math.max(bitmap.width, bitmap.height));
      let width = Math.max(1, Math.round(bitmap.width * startScale));
      let height = Math.max(1, Math.round(bitmap.height * startScale));
      let targetCandidate = null;
      let smallestCandidate = null;
      try {
        for (let resolutionPass = 0; resolutionPass < 9; resolutionPass += 1) {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { alpha: true });
          if (!context) throw new Error("브라우저 이미지 압축 기능을 사용할 수 없습니다.");
          context.drawImage(bitmap, 0, 0, width, height);
          let smallestPass = null;
          for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56, 0.5]) {
            const blob = await canvasBlob(canvas, quality);
            if (!smallestPass || blob.size < smallestPass.size) smallestPass = blob;
            if (!smallestCandidate || blob.size < smallestCandidate.size) smallestCandidate = blob;
            if (blob.size <= LIMITS.targetBytes) {
              targetCandidate = blob;
              break;
            }
          }
          if (targetCandidate) break;
          if (width <= 320 && height <= 320) break;
          const ratio = Math.max(0.62, Math.min(0.86, Math.sqrt(LIMITS.targetBytes / Math.max(1, smallestPass.size)) * 0.93));
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
      } finally {
        bitmap.close?.();
      }
      let chosen = targetCandidate || smallestCandidate;
      if (originalAllowed && (!chosen || source.bytes.length <= chosen.size)) chosen = new Blob([source.bytes], { type: "image/webp" });
      if (!chosen || chosen.size > LIMITS.hardBytes) throw new Error("압축 후에도 300 KiB를 넘습니다. 더 작은 이미지를 사용해 주세요.");
      const output = new Uint8Array(await chosen.arrayBuffer());
      const signature = new TextDecoder("ascii").decode(output.subarray(0, 12));
      if (signature.slice(0, 4) !== "RIFF" || signature.slice(8, 12) !== "WEBP") throw new Error("이 브라우저는 WebP 변환을 지원하지 않습니다.");
      return { blob: chosen, bytes: output };
    }

    function toBase64(bytes) {
      const chunks = [];
      for (let offset = 0; offset < bytes.length; offset += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
      return btoa(chunks.join(""));
    }

    async function processImage(index) {
      const block = blocks[index];
      if (!block || block.type !== "pending-image" || processing) return;
      block.error = "";
      setProcessing(true);
      message("원본은 전송하지 않고 브라우저에서 WebP로 압축하는 중입니다...");
      try {
        const compressed = await compress(block.file);
        message(`WebP ${byteText(compressed.blob.size)}로 압축했습니다. 업로드하는 중입니다...`);
        const result = await root.ConsoleAPI.post("admin-console", { action: "announcements.media.upload", dataBase64: toBase64(compressed.bytes) });
        if (!result || !IMAGE_PATH.test(String(result.path || ""))) throw new Error("서버가 올바른 이미지 경로를 반환하지 않았습니다.");
        const percent = Math.round(Math.abs(1 - compressed.blob.size / block.file.size) * 100);
        const amount = percent === 0 ? "1% 미만" : `${percent}%`;
        const change = compressed.blob.size === block.file.size ? "크기 동일" : compressed.blob.size < block.file.size ? `${amount} 절감` : `${amount} 증가`;
        const uploaded = { type: "image", path: result.path, alt: block.alt || "", width: block.width || 100, stats: `${byteText(block.file.size)} → ${byteText(Number(result.bytes) || compressed.blob.size)} · ${change}` };
        blocks[index] = uploaded;
        selected = index;
        message(`이미지 업로드 완료: ${uploaded.stats}`);
      } catch (error) {
        if (blocks[index]?.type === "pending-image") blocks[index].error = error?.message || "이미지 처리를 완료하지 못했습니다.";
        message(`${error?.message || "이미지 처리를 완료하지 못했습니다."} 원본은 업로드되지 않았고 현재 초안은 유지됩니다.`, true);
      } finally {
        setProcessing(false);
      }
    }

    function addImage(file) {
      if (!file) return;
      if (imageTotal() >= LIMITS.images) {
        message(`이미지는 최대 ${LIMITS.images}개까지 추가할 수 있습니다.`, true);
        return;
      }
      const index = insertAfterSelection({ type: "pending-image", file, alt: "", width: 100, error: "" });
      if (index >= 0) processImage(index);
    }

    function load(notice = {}) {
      if (processing) return false;
      const content = notice.content == null ? null : normalizedContent(notice.content);
      if (notice.content != null && !content) {
        message("저장된 블록 공지 형식이 올바르지 않아 편집 화면을 열지 않았습니다. 원본 데이터는 변경되지 않았습니다.", true);
        return false;
      }
      body.value = String(notice.body || "");
      body.setCustomValidity("");
      if (content) {
        blocks = cloneContent(content).blocks;
        selected = blocks.length ? 0 : -1;
        rich = true;
        plainPanel.hidden = true;
        richPanel.hidden = false;
        richButton.setAttribute("aria-expanded", "true");
        richButton.textContent = "블록 편집 중";
        renderBlocks();
        message("저장된 블록과 서식을 그대로 불러왔습니다.");
      } else {
        rich = false;
        blocks = [];
        selected = -1;
        plainPanel.hidden = false;
        richPanel.hidden = true;
        richButton.setAttribute("aria-expanded", "false");
        richButton.textContent = "블록 편집 사용";
        message("");
      }
      return true;
    }

    function reset() {
      if (processing) return false;
      load({ body: "" });
      return true;
    }

    function value() {
      const error = validateDraft(true);
      body.setCustomValidity(error);
      if (error) return { error };
      const result = { body: rich ? derivedBody() : body.value.trim() };
      if (rich) result.content = { version: 1, blocks: blocks.map(contractBlock) };
      return result;
    }

    richButton.addEventListener("click", enterRichMode);
    plainButton.addEventListener("click", enterPlainMode);
    body.addEventListener("input", () => {
      body.setCustomValidity(codePointLength(body.value.trim()) > LIMITS.text ? `공지 소스는 총 ${LIMITS.text}자까지 입력할 수 있습니다.` : "");
    });
    sizeSelect.addEventListener("change", () => {
      if (blocks[selected]?.type !== "paragraph" || !SIZES.has(sizeSelect.value)) return;
      blocks[selected].size = sizeSelect.value;
      renderBlocks(selected);
    });
    form.querySelector(".announcement-block-toolbar").addEventListener("click", (event) => {
      const format = event.target.closest("[data-format]");
      const align = event.target.closest("[data-align]");
      const block = blocks[selected];
      if (block?.type !== "paragraph") return;
      if (format) block[format.dataset.format] = !block[format.dataset.format];
      if (align && ALIGNS.has(align.dataset.align)) block.align = align.dataset.align;
      if (format || align) renderBlocks(selected);
    });
    form.querySelector(".announcement-addbar").addEventListener("click", (event) => {
      const add = event.target.closest("[data-add-block]")?.dataset.addBlock;
      if (add === "paragraph") insertAfterSelection(paragraph());
      if (add === "divider") insertAfterSelection({ type: "divider" });
    });
    imageInput.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      imageInput.value = "";
      addImage(file);
    });
    blockHost.addEventListener("focusin", (event) => {
      const index = Number(event.target.closest("[data-block-index]")?.dataset.blockIndex);
      if (Number.isInteger(index)) select(index);
      rememberCaret(event.target);
    });
    blockHost.addEventListener("keyup", (event) => rememberCaret(event.target));
    blockHost.addEventListener("click", (event) => rememberCaret(event.target));
    blockHost.addEventListener("select", (event) => rememberCaret(event.target), true);
    blockHost.addEventListener("pointerdown", (event) => {
      const index = Number(event.target.closest("[data-block-index]")?.dataset.blockIndex);
      if (Number.isInteger(index)) select(index);
    });
    blockHost.addEventListener("input", (event) => {
      const index = Number(event.target.closest("[data-block-index]")?.dataset.blockIndex);
      const block = blocks[index];
      if (!block) return;
      if (event.target.matches("[data-block-text]") && block.type === "paragraph") {
        const previous = block.text;
        block.text = event.target.value;
        if (sourceLength(blocks) > LIMITS.text) {
          block.text = previous;
          event.target.value = previous;
          message(`문단 사이 줄바꿈과 이미지 대체 텍스트를 포함해 공지 소스는 ${LIMITS.text}자 이하여야 합니다.`, true);
          return;
        }
        rememberCaret(event.target);
      }
      if (event.target.matches("[data-image-alt]") && block.type === "image") {
        const previous = block.alt;
        block.alt = event.target.value;
        const altTooLong = codePointLength(block.alt) > 200;
        if (altTooLong || sourceLength(blocks) > LIMITS.text) {
          block.alt = previous;
          event.target.value = previous;
          message(altTooLong ? "이미지 대체 텍스트는 200자까지 입력할 수 있습니다." : `문단 본문과 대체 텍스트를 합쳐 공지 소스는 ${LIMITS.text}자 이하여야 합니다.`, true);
          return;
        }
      }
      syncBodyAndCounts();
      renderPreview();
    });
    blockHost.addEventListener("change", (event) => {
      const index = Number(event.target.closest("[data-block-index]")?.dataset.blockIndex);
      const block = blocks[index];
      if (event.target.matches("[data-image-width]") && block?.type === "image") {
        const width = Number(event.target.value);
        if (WIDTHS.has(width)) block.width = width;
        renderPreview();
      }
    });
    blockHost.addEventListener("click", (event) => {
      const control = event.target.closest("[data-block-action]");
      if (!control || processing) return;
      const index = Number(control.closest("[data-block-index]")?.dataset.blockIndex);
      const action = control.dataset.blockAction;
      if (!Number.isInteger(index) || !blocks[index]) return;
      if (action === "remove") {
        blocks.splice(index, 1);
        selected = Math.min(index, blocks.length - 1);
        renderBlocks(selected >= 0 ? selected : null);
      } else if (action === "up" && index > 0) {
        [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
        selected = index - 1;
        renderBlocks(selected);
      } else if (action === "down" && index < blocks.length - 1) {
        [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
        selected = index + 1;
        renderBlocks(selected);
      } else if (action === "retry") processImage(index);
    });

    load({ body: body.value });
    return { value, load, reset, isBusy: () => processing, isRich: () => rich, limits: LIMITS };
  }

  root.ConsoleAnnouncementEditor = { create, normalizedContent, limits: LIMITS };
})(window);
