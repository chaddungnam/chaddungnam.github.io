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
    const body = form.elements.body;
    const editor = form.querySelector('#announcementDocument');
    const status = form.querySelector('#announcementEditorStatus');
    const count = form.querySelector('#announcementTextCount');
    const imageInput = form.querySelector('#announcementImageInput');
    const sizeSelect = form.querySelector('#announcementTextSize');
    let processing = false;
    let savedRange = null;
    let previewTimer;
    const previewKeys = new WeakMap();
    let pendingFile = null;
    let pendingNode = null;
    let disabledBefore = new Map();

    function message(text, error = false) {
      status.textContent = text;
      status.setAttribute('role', error ? 'alert' : 'status');
      status.classList.toggle('is-error', error);
      if (text) options.onMessage?.(text, error);
    }
    function makeParagraph(block = paragraph()) {
      const node = document.createElement('div');
      node.dataset.paragraph = '';
      node.dataset.size = block.size;
      node.dataset.align = block.align;
      for (const key of ['bold', 'italic', 'underline']) node.dataset[key] = String(block[key]);
      node.textContent = block.text;
      if (!block.text) node.append(document.createElement('br'));
      styleParagraph(node);
      return node;
    }
    function styleParagraph(node) {
      node.style.textAlign = node.dataset.align || 'left';
      node.style.fontWeight = node.dataset.bold === 'true' ? '800' : '400';
      node.style.fontStyle = node.dataset.italic === 'true' ? 'italic' : 'normal';
      node.style.textDecoration = node.dataset.underline === 'true' ? 'underline' : 'none';
    }
    function nodeText(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE || node.matches('[data-link-preview], figure, hr')) return '';
      if (node.tagName === 'BR') return '\n';
      const children = Array.from(node.childNodes);
      if (children.length === 1 && children[0].nodeName === 'BR') return '';
      return children.map((child, index) => {
        const text = nodeText(child);
        return index > 0 && child.nodeType === 1 && ['DIV', 'P'].includes(child.tagName) ? '\n' + text : text;
      }).join('');
    }
    function blocksFromDOM() {
      const blocks = [];
      for (const node of editor.childNodes) {
        if (node.nodeType === 1 && (node.matches('[data-link-preview]') || (node.dataset.editorTail && !nodeText(node)))) continue;
        if (node.nodeType === 1 && node.matches('figure')) {
          if (node.dataset.pending) { blocks.push({type:'pending-image'}); continue; }
          blocks.push({type:'image', path:node.dataset.path, alt:node.querySelector('[data-image-alt]').value, width:Number(node.querySelector('[data-image-width]').value)});
        } else if (node.nodeName === 'HR') blocks.push({type:'divider'});
        else {
          const text = nodeText(node);
          if (node.nodeType === 3 && !text) continue;
          const data = node.dataset || {};
          blocks.push({...paragraph(text), size:SIZES.has(data.size) ? data.size : 'normal', align:ALIGNS.has(data.align) ? data.align : 'left', bold:data.bold === 'true', italic:data.italic === 'true', underline:data.underline === 'true'});
        }
      }
      return blocks;
    }
    function validate(blocks, requireText = true) {
      if (processing || blocks.some(b => b.type === 'pending-image')) return '이미지 처리를 완료하거나 실패한 이미지를 삭제해 주세요.';
      if (blocks.length > LIMITS.blocks) return `문단·이미지·구분선은 총 ${LIMITS.blocks}개까지 넣을 수 있습니다.`;
      if (blocks.filter(b => b.type === 'image').length > LIMITS.images) return `이미지는 최대 ${LIMITS.images}개까지 넣을 수 있습니다.`;
      if (blocks.some(b => b.type === 'image' && codePointLength(b.alt) > 200)) return '이미지 대체 텍스트는 200자까지 입력해 주세요.';
      if (sourceLength(blocks) > LIMITS.text) return `본문·줄바꿈·이미지 대체 텍스트를 합쳐 ${LIMITS.text}자까지 입력할 수 있습니다.`;
      if (requireText && !blocks.some(b => b.type === 'paragraph' && b.text.trim())) return '공지 본문을 입력해 주세요.';
      return '';
    }
    function ensureParagraph() {
      if (editor.childNodes.length && Array.from(editor.childNodes).every(node => node.nodeType === 3 || node.nodeName === 'BR')) {
        const selection = window.getSelection();
        const anchor = selection?.anchorNode, offset = selection?.anchorOffset;
        const node = makeParagraph(); node.replaceChildren(...editor.childNodes); editor.append(node);
        if (anchor && editor.contains(anchor)) { const range = document.createRange(); range.setStart(anchor, Math.min(offset, anchor.textContent.length)); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
      }
    }
    function sync() {
      ensureParagraph();
      const blocks = blocksFromDOM();
      body.value = blocks.filter(b => b.type === 'paragraph').map(b => b.text).join('\n\n');
      count.textContent = `${sourceLength(blocks)} / ${LIMITS.text}자 · 이미지 ${blocks.filter(b => /image$/.test(b.type)).length} / ${LIMITS.images}`;
      editor.setAttribute('aria-invalid', String(Boolean(validate(blocks, false))));
      clearTimeout(previewTimer);
      previewTimer = setTimeout(refreshPreviews, 350);
    }
    function rememberSelection() {
      const selection = window.getSelection();
      if (selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) savedRange = selection.getRangeAt(0).cloneRange();
    }
    function restoreSelection() {
      editor.focus();
      const selection = window.getSelection();
      if (!savedRange || !editor.contains(savedRange.startContainer)) {
        savedRange = document.createRange();
        savedRange.selectNodeContents(editor.lastElementChild || editor);
        savedRange.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    function selectedParagraph() {
      const selection = window.getSelection();
      let node = selection?.anchorNode;
      if (node?.nodeType === 3) node = node.parentElement;
      while (node && node.parentElement !== editor) node = node.parentElement;
      return node && !node.matches('figure, hr, [data-link-preview]') ? node : null;
    }
    function syncToolbar() {
      const node = selectedParagraph();
      sizeSelect.value = node?.dataset.size || 'normal';
      form.querySelectorAll('[data-format]').forEach(control => control.setAttribute('aria-pressed', String(node?.dataset[control.dataset.format] === 'true')));
      form.querySelectorAll('[data-align]').forEach(control => control.setAttribute('aria-pressed', String((node?.dataset.align || 'left') === control.dataset.align)));
    }
    function refreshPreviews() {
      if (!root.NoticeLinks) return;
      editor.querySelectorAll(':scope > [data-link-preview]').forEach(node => { if (!node.previousElementSibling || node.previousElementSibling.matches('figure,hr,[data-link-preview]')) node.remove(); });
      for (const node of Array.from(editor.children)) {
        if (node.matches('figure,hr,[data-link-preview]')) continue;
        const key = (nodeText(node).match(/https:\/\/[^\s<>]+/g) || []).join('\n');
        if (previewKeys.get(node) === key) continue;
        previewKeys.set(node, key);
        if (node.nextElementSibling?.matches('[data-link-preview]')) node.nextElementSibling.remove();
        const preview = document.createElement('div');
        preview.dataset.linkPreview = '';
        preview.contentEditable = 'false';
        root.NoticeLinks.previews(nodeText(node), preview);
        if (preview.childNodes.length) node.after(preview);
      }
    }
    function makeImage(block) {
      const figure = document.createElement('figure');
      figure.contentEditable = 'false';
      figure.dataset.path = block.path;
      const img = document.createElement('img');
      img.src = MEDIA_BASE + block.path;
      img.alt = block.alt;
      img.style.width = `${block.width}%`;
      const fields = document.createElement('div');
      fields.className = 'announcement-media-controls';
      const altLabel = document.createElement('label');
      altLabel.append('대체 텍스트');
      const alt = document.createElement('input');
      alt.dataset.imageAlt = '';
      alt.value = block.alt;
      altLabel.append(alt);
      const widthLabel = document.createElement('label');
      widthLabel.append('너비');
      const width = document.createElement('select');
      width.dataset.imageWidth = '';
      for (const value of WIDTHS) width.add(new Option(`${value}%`, String(value), false, value === block.width));
      widthLabel.append(width);
      const remove = button('이미지 삭제', 'remove');
      remove.addEventListener('click', () => { figure.remove(); sync(); });
      width.addEventListener('change', () => { img.style.width = `${width.value}%`; sync(); });
      alt.addEventListener('input', () => { img.alt = alt.value; sync(); });
      fields.append(altLabel, widthLabel, remove);
      figure.append(img, fields);
      return figure;
    }
    // Insert at the saved caret, retaining both sides of the paragraph and selection replacement.
    function insertMedia(node) {
      restoreSelection();
      const range = window.getSelection().getRangeAt(0);
      range.deleteContents();
      let current = selectedParagraph();
      if (current && current.contains(range.startContainer)) {
        const tailRange = document.createRange();
        tailRange.selectNodeContents(current);
        tailRange.setStart(range.startContainer, range.startOffset);
        const tail = makeParagraph();
        tail.replaceChildren(tailRange.extractContents());
        if (!nodeText(tail)) { tail.dataset.editorTail = 'true'; if (!tail.childNodes.length) tail.append(document.createElement('br')); }
        current.after(node, tail);
        if (!nodeText(current)) current.dataset.editorTail = 'true';
        const next = document.createRange();
        next.selectNodeContents(tail); next.collapse(true); savedRange = next;
      } else {
        const tail = makeParagraph(); tail.dataset.editorTail = 'true';
        range.insertNode(node); node.after(tail);
        const next = document.createRange(); next.selectNodeContents(tail); next.collapse(true); savedRange = next;
      }
      restoreSelection(); sync();
    }
    function setProcessing(value) {
      processing = value;
      form.dataset.editorProcessing = String(value);
      editor.contentEditable = String(!value);
      editor.setAttribute('aria-busy', String(value));
      if (value) {
        disabledBefore = new Map();
        form.querySelectorAll('button,input,select,textarea').forEach(control => { disabledBefore.set(control, control.disabled); control.disabled = true; });
      } else {
        disabledBefore.forEach((disabled, control) => { if (control.isConnected) control.disabled = disabled; });
        disabledBefore.clear();
      }
      options.onBusy?.(value);
    }
    async function uploadPending() {
      if (!pendingNode || !pendingFile || processing) return;
      const node = pendingNode;
      const file = pendingFile;
      setProcessing(true);
      node.textContent = '이미지를 압축하고 업로드하고 있습니다…';
      message('원본은 전송하지 않고 브라우저에서 WebP로 압축합니다.');
      try {
        const compressed = await compress(file);
        const result = await root.ConsoleAPI.post('admin-console', {action:'announcements.media.upload', dataBase64:toBase64(compressed.bytes)});
        if (!IMAGE_PATH.test(String(result?.path || ''))) throw new Error('서버가 올바른 이미지 경로를 반환하지 않았습니다.');
        node.replaceWith(makeImage({type:'image',path:result.path,alt:'',width:100}));
        pendingNode = null; pendingFile = null;
        message(`이미지 업로드 완료: ${byteText(file.size)} → ${byteText(compressed.blob.size)}`);
      } catch(error) {
        node.textContent = error?.message || '이미지 업로드 실패';
        const retry = button('다시 시도', 'retry');
        retry.addEventListener('click', uploadPending);
        const remove = button('이미지 삭제', 'remove');
        remove.addEventListener('click', () => { node.remove(); pendingNode = null; pendingFile = null; sync(); });
        node.append(retry, remove);
        message(`${error?.message || '이미지 업로드 실패'} 본문은 유지됩니다. 다시 시도하거나 이미지를 삭제해 주세요.`, true);
      } finally {
        setProcessing(false); sync(); restoreSelection();
      }
    }
    async function addImages(files) {
      if (processing) return;
      if (pendingNode) { message('실패한 이미지를 먼저 재시도하거나 삭제해 주세요.', true); return; }
      for (const file of files) {
        const blocks = blocksFromDOM();
        if (blocks.filter(b => b.type === 'image').length >= LIMITS.images || blocks.length + 2 > LIMITS.blocks) {
          message('이미지는 최대 8개, 문단·이미지·구분선은 총 60개까지 넣을 수 있습니다.', true); break;
        }
        pendingNode = document.createElement('figure');
        pendingNode.contentEditable = 'false'; pendingNode.dataset.pending = 'true';
        pendingFile = file;
        insertMedia(pendingNode);
        await uploadPending();
        if (pendingNode) break;
      }
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



    function load(notice = {}) {
      if (processing) return false;
      const content = notice.content == null ? null : normalizedContent(notice.content);
      if (notice.content != null && !content) { message('저장된 공지 형식이 올바르지 않아 열지 않았습니다. 원본은 유지됩니다.', true); return false; }
      const blocks = content ? content.blocks : [paragraph(String(notice.body || ''))];
      editor.replaceChildren();
      for (const block of blocks) {
        if (block.type === 'paragraph') editor.append(makeParagraph(block));
        else if (block.type === 'image') editor.append(makeImage(block));
        else { const hr = document.createElement('hr'); hr.contentEditable = 'false'; editor.append(hr); }
      }
      if (!editor.children.length || editor.lastElementChild.matches('figure,hr')) { const tail = makeParagraph(); tail.dataset.editorTail = 'true'; editor.append(tail); }
      savedRange = null; pendingNode = null; pendingFile = null;
      message(''); sync(); refreshPreviews();
      return true;
    }
    function value() {
      const blocks = blocksFromDOM();
      const error = validate(blocks);
      if (error) { message(error, true); editor.focus(); return {error}; }
      const content = {version:1, blocks:blocks.map(contractBlock)};
      if (!normalizedContent(content)) return {error:'공지 형식을 확인해 주세요.'};
      return {body:blocks.filter(b => b.type === 'paragraph').map(b => b.text).join('\n\n'), content};
    }
    editor.addEventListener('input', () => { sync(); rememberSelection(); });
    editor.addEventListener('keyup', () => { rememberSelection(); syncToolbar(); });
    editor.addEventListener('mouseup', () => { rememberSelection(); syncToolbar(); });
    editor.addEventListener('focusout', rememberSelection);
    editor.addEventListener('paste', event => {
      if (event.target !== editor && event.target.closest('figure')) return;
      event.preventDefault();
      if (processing) return;
      rememberSelection();
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
      if (files.length) { addImages(files); return; }
      // Never insert clipboard HTML, remote images, scripts, or inline event handlers.
      const text = event.clipboardData?.getData('text/plain') || '';
      const escaped = document.createElement('span'); escaped.textContent = text;
      document.execCommand('insertHTML', false, escaped.innerHTML.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>'));
      sync(); rememberSelection(); refreshPreviews();
    });
    editor.addEventListener('dragover', event => event.preventDefault());
    editor.addEventListener('drop', event => {
      event.preventDefault();
      // Keep insertion at the last editing caret; never accept HTML dragged from websites.
      addImages(Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/')));
    });
    // Keep toolbar actions anchored to the last document selection, not a file/select control.
    form.querySelector('.announcement-block-toolbar').addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
    form.querySelector('.announcement-block-toolbar').addEventListener('click', event => {
      const control = event.target.closest('[data-format],[data-align]');
      if (!control || processing) return;
      restoreSelection(); const node = selectedParagraph(); if (!node) return;
      if (control.dataset.format) { const key = control.dataset.format; node.dataset[key] = String(node.dataset[key] !== 'true'); }
      if (control.dataset.align) node.dataset.align = control.dataset.align;
      styleParagraph(node); syncToolbar(); sync();
    });
    sizeSelect.addEventListener('change', () => {
      const size = sizeSelect.value;
      restoreSelection(); const node = selectedParagraph(); if (!node) return;
      node.dataset.size = size; sync(); syncToolbar();
    });
    imageInput.addEventListener('change', () => { const files = Array.from(imageInput.files || []); imageInput.value = ''; addImages(files); });
    form.querySelector('[data-add-block="divider"]').addEventListener('click', () => {
      if (processing) return;
      const hr = document.createElement('hr'); hr.contentEditable = 'false'; insertMedia(hr);
    });
    body.required = false;
    load({body:body.value});
    return {value, load, reset:() => load(), isBusy:() => processing, isRich:() => true, limits:LIMITS};
  }

  root.ConsoleAnnouncementEditor = { create, normalizedContent, limits: LIMITS };
})(window);
