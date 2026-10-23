(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.HouseDuckHome = api;
    if (root.document) root.addEventListener("DOMContentLoaded", api.init);
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const EASE = "cubic-bezier(.2,.7,.2,1)";
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];

  // Ordered-dither threshold in [0,1): Bayer 8x8 with a gentle left-to-right sweep so the reveal reads as a wipe.
  function bayerThreshold(x, y, cols) {
    const cell = BAYER8[(y % 8) * 8 + (x % 8)] / 64;
    const sweep = cols > 1 ? x / (cols - 1) : 0;
    return clamp(cell * .82 + sweep * .18, 0, .999);
  }

  function reducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- YouTube feed (static cards are replaced by assets/youtube-feed.json) ---------- */
  function validVideo(video) {
    return video && /^[A-Za-z0-9_-]{11}$/.test(video.videoId) && typeof video.title === "string" && video.title.trim();
  }

  function renderYouTube(videos) {
    const feed = document.querySelector("[data-youtube-feed]");
    const clean = Array.isArray(videos) ? videos.filter(validVideo).slice(0, 3) : [];
    if (!feed || clean.length !== 3) return;
    const fragment = document.createDocumentFragment();
    for (const video of clean) {
      const link = document.createElement("a");
      const thumb = document.createElement("span");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      link.className = "youtube-card";
      link.dataset.youtubeCard = "";
      link.href = `https://www.youtube.com/watch?v=${video.videoId}`;
      thumb.className = "hd-thumb";
      image.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      image.width = 480;
      image.height = 360;
      image.alt = "";
      image.loading = "lazy";
      title.textContent = video.title.trim();
      thumb.append(image);
      copy.append(title);
      link.append(thumb, copy);
      fragment.append(link);
    }
    feed.replaceChildren(fragment);
    setupAscii();
  }

  function setupYouTube() {
    fetch("assets/youtube-feed.json", { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("feed unavailable")))
      .then((data) => renderYouTube(data.videos))
      .catch(() => {});
  }

  /* ---------- live Quirky Ball version ---------- */
  const LIVE_VERSION = /^\d+(?:\.\d+){1,3}$/;
  const PUBLIC_VERSION_URL = "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1/public-version";

  function applyLiveVersion(version) {
    if (!LIVE_VERSION.test(version)) return;
    for (const node of document.querySelectorAll("[data-live-version]")) node.textContent = version;
  }

  function setupLiveVersion() {
    if (!document.querySelector("[data-live-version]")) return;
    fetch(PUBLIC_VERSION_URL, { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("version unavailable")))
      .then((data) => applyLiveVersion(String(data?.min_version || "").trim()))
      .catch(() => {});
  }

  /* ---------- header pill: night glass over night sections, paper glass over paper sections ---------- */
  function setupHeaderTheme() {
    const header = document.querySelector(".site-header");
    const sections = [...document.querySelectorAll("main [data-theme]")];
    if (!header || !sections.length) return;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const probe = header.getBoundingClientRect();
      const y = probe.top + probe.height / 2;
      // The hero fades to paper once its zoom has ended (.is-entered), so the pill goes light there too.
      const themeOf = (section) => section.classList.contains("hd-hero") && section.classList.contains("is-entered") ? "paper" : section.dataset.theme;
      let theme = themeOf(sections[0]);
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= y && rect.bottom > y) { theme = themeOf(section); break; }
        if (rect.top > y) break;
        theme = themeOf(section);
      }
      if (document.body.dataset.hdTheme !== theme) document.body.dataset.hdTheme = theme;
    };
    const request = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    const hero = document.querySelector(".hd-hero");
    if (hero && "MutationObserver" in window) new MutationObserver(request).observe(hero, { attributes: true, attributeFilter: ["class"] });
    update();
  }

  /* ---------- gameplay video: plays only on screen, never with reduced motion ---------- */
  function setupVideos(reduced) {
    const videos = [...document.querySelectorAll("[data-hero-gameplay]")];
    if (!videos.length) return;
    if (reduced) {
      for (const video of videos) { video.autoplay = false; video.pause(); }
      return;
    }
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.play().catch(() => {});
        else entry.target.pause();
      }
    }, { threshold: .15 });
    for (const video of videos) observer.observe(video);
  }

  /* ---------- realistic buttons: sink while pressed, leave fingerprint smudges where touched ---------- */
  function addSmudge(face, clientX, clientY, bounds) {
    const rect = face.getBoundingClientRect();
    const smudge = document.createElement("i");
    smudge.className = "hd-smudge";
    const bx = bounds?.x || [8, 92];
    const by = bounds?.y || [12, 88];
    const x = Number.isFinite(clientX) ? clamp(((clientX - rect.left) / rect.width) * 100, bx[0], bx[1]) : (bx[0] + bx[1]) / 2 + Math.random() * 10 - 5;
    const y = Number.isFinite(clientY) ? clamp(((clientY - rect.top) / rect.height) * 100, by[0], by[1]) : (by[0] + by[1]) / 2;
    smudge.style.setProperty("--sx", `${x.toFixed(1)}%`);
    smudge.style.setProperty("--sy", `${y.toFixed(1)}%`);
    smudge.style.setProperty("--sr", `${Math.round(Math.random() * 70 - 35)}deg`);
    const old = face.querySelectorAll(".hd-smudge");
    if (old.length > 5) old[0].remove();
    face.append(smudge);
    smudge.addEventListener("animationend", () => smudge.remove(), { once: true });
  }

  function pressable(button, face, onPress, bounds) {
    let down = false;
    const release = () => {
      if (!down) return;
      down = false;
      button.classList.remove("is-down");
    };
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      down = true;
      button.classList.add("is-down");
      addSmudge(face, event.clientX, event.clientY, bounds);
      onPress?.();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("keydown", (event) => {
      if ((event.key !== " " && event.key !== "Enter") || down) return;
      down = true;
      button.classList.add("is-down");
      addSmudge(face, undefined, undefined, bounds);
      onPress?.();
    });
    button.addEventListener("keyup", release);
    button.addEventListener("blur", release);
  }

  function setupPressables() {
    for (const button of document.querySelectorAll("[data-pressable]")) {
      const face = button.querySelector(".hd-btn-face, .hd-keycap-face") || button;
      pressable(button, face);
    }
  }

  /* ---------- 10key keycap toy: the game's own tenkey (KeypadData.KEYS), pre-rendered from its models; scroll digs it ---------- */
  const KEYPAD = [
    { id: "NL", fam: "mod", legend: "nl", col: 0, row: 0 }, { id: "/", fam: "mod", legend: "slash", col: 1, row: 0 },
    { id: "*", fam: "mod", legend: "star", col: 2, row: 0 }, { id: "DEL", fam: "mod", legend: "del", col: 3, row: 0 },
    { id: "7", fam: "1u", legend: "7", col: 0, row: 1 }, { id: "8", fam: "1u", legend: "8", col: 1, row: 1 },
    { id: "9", fam: "1u", legend: "9", col: 2, row: 1 }, { id: "-", fam: "mod", legend: "minus", col: 3, row: 1 },
    { id: "4", fam: "1u", legend: "4", col: 0, row: 2 }, { id: "5", fam: "1u", legend: "5", col: 1, row: 2 },
    { id: "6", fam: "1u", legend: "6", col: 2, row: 2 }, { id: "+", fam: "mod", legend: "plus", col: 3, row: 2 },
    { id: "1", fam: "1u", legend: "1", col: 0, row: 3 }, { id: "2", fam: "1u", legend: "2", col: 1, row: 3 },
    { id: "3", fam: "1u", legend: "3", col: 2, row: 3 }, { id: "ENT", fam: "tall", legend: "ent", col: 3, row: 3, rows: 2 },
    { id: "0", fam: "wide", legend: "0", col: 0, row: 4, cols: 2 }, { id: ".", fam: "mod", legend: "dot", col: 2, row: 4 },
  ];
  // Keypad3D: 0.578 x 0.488 m caps on a 0.60 x 0.51 m pitch; sprites are shot at the dig camera's 68 deg pitch (sin 68 = .927)
  const KEY = { w: .578, d: .488, pitchX: .60, pitchZ: .51, fore: .927 };
  const KEY_FRAMES = { "1u": [.84, .84], mod: [.84, .84], wide: [1.44, .84], tall: [.84, 1.34] };
  const KEY_STATES = ["intact", "crack_1", "crack_2", "crack_3", "broken"];
  const KEY_MEDIA = "assets/media/home/page-";

  function setupKeys(reduced) {
    const section = document.querySelector("[data-tenkey]");
    const field = section?.querySelector("[data-keyfield]");
    const glass = section?.querySelector("[data-glass]");
    const hint = section?.querySelector("[data-key-hint]");
    if (!section || !field || !glass) return;
    const coarse = matchMedia("(pointer: coarse)").matches;
    let scale = 121;
    let offset = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };
    let frame = 0;
    let visible = false;
    let sourced = false;
    let progress = 0;
    let cluster = { top: 0, height: 1 };

    const keys = KEYPAD.map((spec, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hd-key";
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.dataset.key = spec.id;
      button.dataset.fam = spec.fam;
      button.dataset.state = "0";
      const sprite = document.createElement("span");
      sprite.className = "hd-key-sprite";
      const images = KEY_STATES.map((state, s) => {
        const image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        image.dataset.s = String(s);
        if (s === 0) image.src = `${KEY_MEDIA}key-${spec.fam}_${state}.webp`;
        else image.dataset.src = `${KEY_MEDIA}key-${spec.fam}_${state}.webp`;
        sprite.append(image);
        return image;
      });
      const legend = document.createElement("img");
      legend.className = "hd-key-legend";
      legend.alt = "";
      legend.decoding = "async";
      legend.src = `${KEY_MEDIA}legend-${spec.legend}.webp`;
      sprite.append(legend);
      button.append(sprite);
      field.append(button);
      const key = { spec, button, sprite, images, phase: index * 1.7, stagger: ((index * 7 + 3) % KEYPAD.length) / KEYPAD.length, home: { x: 0, y: 0 }, scrollStage: 0, pressStage: 0, state: 0 };
      pressable(button, sprite, () => press(key), { x: [30, 70], y: [20, 56] });
      return key;
    });

    function apply(key) {
      const next = Math.min(4, Math.max(key.scrollStage, key.pressStage));
      if (next === key.state) return;
      const broke = next === 4 && key.state < 4;
      key.state = next;
      key.button.dataset.state = String(next);
      if (broke && !reduced && visible) burst(key);
    }

    function press(key) {
      hint?.classList.add("is-hidden");
      if (key.state >= 4) return;
      key.pressStage = Math.min(4, key.state + 1);
      apply(key);
    }

    function burst(key) {
      const size = KEY_FRAMES["1u"][0] * scale;
      const picks = [1, 2, 3, 4].sort(() => Math.random() - .5).slice(0, 3);
      for (const n of picks) {
        const shard = document.createElement("img");
        shard.className = "hd-shard";
        shard.alt = "";
        shard.src = `${KEY_MEDIA}key-shard_${n}.webp`;
        shard.style.setProperty("--fw", `${size.toFixed(1)}px`);
        shard.style.setProperty("--fh", `${size.toFixed(1)}px`);
        shard.style.setProperty("--x", key.button.style.getPropertyValue("--x"));
        shard.style.setProperty("--y", key.button.style.getPropertyValue("--y"));
        shard.style.setProperty("--dx", `${((Math.random() < .5 ? -1 : 1) * (.25 + Math.random() * .4) * scale).toFixed(1)}px`);
        shard.style.setProperty("--dy", `${(-(.18 + Math.random() * .3) * scale).toFixed(1)}px`);
        shard.style.setProperty("--rot", `${Math.round((Math.random() < .5 ? -1 : 1) * (25 + Math.random() * 70))}deg`);
        shard.addEventListener("animationend", () => shard.remove(), { once: true });
        field.append(shard);
      }
    }

    function loadStates() {
      if (sourced) return;
      sourced = true;
      for (const key of keys) {
        for (const image of key.images) {
          if (image.dataset.src) { image.src = image.dataset.src; image.decode?.().catch(() => {}); }
        }
      }
    }

    function layout() {
      const narrow = innerWidth <= 860;
      scale = narrow ? 92 : clamp(Math.round(innerWidth * .084), 104, 126);
      const sectionRect = section.getBoundingClientRect();
      const glassRect = glass.getBoundingClientRect();
      const width = (3 * KEY.pitchX + KEY.w) * scale;
      const height = (4 * KEY.pitchZ + KEY.d) * KEY.fore * scale;
      let left;
      let top;
      if (narrow) {
        left = (sectionRect.width - width) / 2;
        top = glassRect.bottom - sectionRect.top + 30;
      } else {
        // the keypad stands in the open to the left of the glass; only its last column tucks under the glass edge
        left = Math.max(14, glassRect.left - sectionRect.left - width + Math.min(64, width * .22));
        top = glassRect.top - sectionRect.top + glassRect.height * .5 - height * .5 + 16;
      }
      cluster = { top, height };
      for (const key of keys) {
        const { spec, button } = key;
        const [fw, fh] = KEY_FRAMES[spec.fam];
        button.style.setProperty("--fw", `${(fw * scale).toFixed(1)}px`);
        button.style.setProperty("--fh", `${(fh * scale).toFixed(1)}px`);
        key.home.x = left + (KEY.w / 2 + (spec.col + ((spec.cols || 1) - 1) / 2) * KEY.pitchX) * scale;
        key.home.y = top + (KEY.d / 2 + (spec.row + ((spec.rows || 1) - 1) / 2) * KEY.pitchZ) * KEY.fore * scale;
      }
      if (hint) {
        hint.style.left = `${left + width * .5}px`;
        hint.style.top = `${top + height + 26}px`;
        hint.style.bottom = "auto";
      }
      render(performance.now());
      dig();
    }

    function render(now) {
      const t = now * .001;
      for (const key of keys) {
        const dx = reduced ? 0 : Math.sin(t * .42 + key.phase) * 7 + offset.x;
        const dy = reduced ? 0 : Math.cos(t * .33 + key.phase * 1.3) * 5 + offset.y;
        key.button.style.setProperty("--x", `${(key.home.x + dx).toFixed(2)}px`);
        key.button.style.setProperty("--y", `${(key.home.y + dy).toFixed(2)}px`);
      }
    }

    // Digging by scroll: as the keypad travels up the screen each key cracks 1 -> 2 -> 3 and breaks open, staggered like a run.
    function dig() {
      const rect = section.getBoundingClientRect();
      const keypadTop = rect.top + cluster.top;
      progress = clamp((innerHeight - keypadTop) / (innerHeight + cluster.height), 0, 1);
      for (const key of keys) {
        const t = reduced ? 0 : clamp((progress - .3 - key.stagger * .32) / .28, 0, .999);
        key.scrollStage = Math.floor(t * 5);
        apply(key);
      }
      section.dataset.dig = progress.toFixed(2);
    }

    function tick(now) {
      frame = 0;
      if (!visible || reduced) return;
      offset.x += (target.x - offset.x) * .06;
      offset.y += (target.y - offset.y) * .06;
      render(now);
      frame = requestAnimationFrame(tick);
    }

    function sync() {
      if (visible && !reduced && !frame) frame = requestAnimationFrame(tick);
      if ((!visible || reduced) && frame) { cancelAnimationFrame(frame); frame = 0; }
    }

    if (!coarse) {
      section.addEventListener("pointermove", (event) => {
        const rect = section.getBoundingClientRect();
        target.x = clamp((event.clientX - rect.left - rect.width / 2) * .07, -36, 36);
        target.y = clamp((event.clientY - rect.top - rect.height / 2) * .05, -24, 24);
      }, { passive: true });
      section.addEventListener("pointerleave", () => { target.x = 0; target.y = 0; });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .05 }).observe(section);
      new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadStates(); }, { rootMargin: "900px 0px" }).observe(section);
    } else { visible = true; sync(); loadStates(); }
    let digScheduled = false;
    addEventListener("scroll", () => { if (!digScheduled) { digScheduled = true; requestAnimationFrame(() => { digScheduled = false; dig(); }); } }, { passive: true });
    addEventListener("resize", layout);
    if (document.fonts?.ready) document.fonts.ready.then(layout).catch(() => {});
    layout();
    addEventListener("load", layout, { once: true });
  }

  /* ---------- Quirky Ball: scroll-driven 3D stack ---------- */
  function setupStack(reduced) {
    const track = document.querySelector("[data-stack]");
    const col = track?.querySelector("[data-stack-col]");
    const stage = track?.querySelector("[data-stack-stage]");
    const shots = [...(track?.querySelectorAll("[data-shot]") || [])];
    if (!track || !col || !stage || shots.length < 2 || reduced) return;
    const count = shots.length;
    const indexNodes = [...track.querySelectorAll("[data-stack-index]")];
    const captionNodes = [...track.querySelectorAll("[data-stack-caption]")];
    let position = 0;
    let goal = 0;
    let frame = 0;
    let active = -1;
    const pad = (n) => String(n + 1).padStart(2, "0");

    function readGoal() {
      const rect = col.getBoundingClientRect();
      const travel = Math.max(1, col.offsetHeight - stage.offsetHeight);
      goal = clamp(-rect.top / travel, 0, 1) * (count - 1);
    }

    function paint() {
      const step = shots[0].offsetHeight || 500;
      for (const [index, shot] of shots.entries()) {
        const off = index - position;
        const abs = Math.abs(off);
        if (abs > 2.6) { shot.style.opacity = "0"; shot.style.visibility = "hidden"; continue; }
        const tilt = clamp(off, -1, 1);
        const ty = off * step * .62 + Math.sign(off) * Math.min(abs, 1) * step * .07;
        const tz = -abs * 140;
        const rotate = -tilt * 72;
        const scale = 1 - Math.min(abs, 2) * .04;
        shot.style.visibility = "visible";
        shot.style.opacity = String(abs < 1 ? 1 : clamp(1.18 - abs * .42, 0, 1));
        shot.style.zIndex = String(20 - Math.round(abs * 4));
        shot.style.setProperty("--shade", (Math.min(abs, 1) * .86).toFixed(3));
        if (off > 0) shot.dataset.below = ""; else delete shot.dataset.below;
        shot.style.transform = `translate3d(-50%, calc(-50% + ${ty.toFixed(1)}px), ${tz.toFixed(1)}px) rotateX(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      }
      const next = clamp(Math.round(position), 0, count - 1);
      if (next !== active) {
        active = next;
        for (const node of indexNodes) node.textContent = `${pad(active)} / ${String(count).padStart(2, "0")}`;
        for (const node of captionNodes) node.textContent = shots[active].dataset.caption || "";
        for (const [index, shot] of shots.entries()) shot.classList.toggle("is-active", index === active);
        track.dataset.stackActive = String(active);
      }
    }

    function tick() {
      frame = 0;
      const delta = goal - position;
      if (Math.abs(delta) < .0015) { position = goal; paint(); return; }
      position += delta * .16;
      paint();
      frame = requestAnimationFrame(tick);
    }

    const request = () => { readGoal(); if (!frame) frame = requestAnimationFrame(tick); };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    for (const [index, shot] of shots.entries()) {
      shot.addEventListener("click", () => {
        if (index === active) return;
        const rect = col.getBoundingClientRect();
        const travel = Math.max(1, col.offsetHeight - stage.offsetHeight);
        scrollTo({ top: rect.top + scrollY + (index / (count - 1)) * travel, behavior: "smooth" });
      });
    }
    readGoal();
    position = goal;
    paint();
  }

  /* ---------- lab notes: monospace characters dissolve in Bayer order to reveal each thumbnail ---------- */
  const GLYPHS = "v}[L(^c~|nJ/-i:;<*{dsVpT\"X.=+";

  function asciiReveal(thumb, reduced) {
    if (thumb.dataset.ascii === "on" || reduced) return;
    thumb.dataset.ascii = "on";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    thumb.append(canvas);
    const context = canvas.getContext("2d");
    const cell = { w: 11, h: 15 };
    let cols = 0;
    let rows = 0;
    let glyphs = [];
    let t = 0;
    let animation = null;
    let revealed = false;

    function size() {
      const rect = thumb.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(rect.width / cell.w);
      rows = Math.ceil(rect.height / cell.h);
      glyphs = Array.from({ length: cols * rows }, () => Math.random() < .55 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : " ");
      draw();
    }

    function draw() {
      const width = canvas.width / (Math.min(devicePixelRatio || 1, 2));
      const height = canvas.height / (Math.min(devicePixelRatio || 1, 2));
      context.clearRect(0, 0, width, height);
      if (t >= 1) return;
      context.font = `500 11px ui-monospace, "SF Mono", Menlo, monospace`;
      context.textBaseline = "middle";
      context.textAlign = "center";
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const threshold = bayerThreshold(x, y, cols);
          const gap = t - threshold;
          const px = x * cell.w;
          const py = y * cell.h;
          if (gap < 0) {
            context.fillStyle = "#07091a";
            context.fillRect(px, py, cell.w + .5, cell.h + .5);
            const index = y * cols + x;
            if (Math.random() < .12) glyphs[index] = Math.random() < .55 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : " ";
            const glyph = glyphs[index];
            if (glyph !== " ") {
              context.fillStyle = "rgba(255,255,255,.92)";
              context.fillText(glyph, px + cell.w / 2, py + cell.h / 2 + 1);
            }
          } else if (gap < .08) {
            // A short per-cell veil so the image emerges through a dark lattice; a sparse few cells flash duck yellow.
            const fade = 1 - gap / .08;
            const accent = gap < .03 && (x * 7 + y * 13) % 11 === 0;
            context.fillStyle = accent ? `rgba(245,183,49,${(fade * .95).toFixed(3)})` : `rgba(11,15,42,${(fade * .85).toFixed(3)})`;
            context.fillRect(px, py, cell.w + .5, cell.h + .5);
          }
        }
      }
    }

    function play(from, to, duration, done) {
      if (animation) cancelAnimationFrame(animation);
      const start = performance.now();
      const ease = (p) => 1 - Math.pow(1 - p, 3);
      const step = (now) => {
        const p = clamp((now - start) / duration, 0, 1);
        t = from + (to - from) * ease(p);
        draw();
        if (p < 1) animation = requestAnimationFrame(step);
        else { animation = null; done?.(); }
      };
      animation = requestAnimationFrame(step);
    }

    function reveal() {
      revealed = true;
      play(t, 1, 1300);
    }

    function replay() {
      if (!revealed || animation) return;
      play(1, 0, 360, () => play(0, 1, 1200));
    }

    size();
    if ("ResizeObserver" in window) new ResizeObserver(() => { size(); }).observe(thumb);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setTimeout(reveal, 120);
      }, { threshold: .4 });
      observer.observe(thumb);
    } else reveal();
    const card = thumb.closest(".youtube-card") || thumb;
    card.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") replay(); });
    card.addEventListener("focus", replay);
  }

  function setupAscii() {
    const reduced = reducedMotion();
    for (const card of document.querySelectorAll(".youtube-card")) {
      let thumb = card.querySelector(".hd-thumb");
      if (!thumb) {
        const image = card.querySelector("img");
        if (!image) continue;
        thumb = document.createElement("span");
        thumb.className = "hd-thumb";
        image.replaceWith(thumb);
        thumb.append(image);
      }
      asciiReveal(thumb, reduced);
    }
  }

  /* ---------- farewell: the Comrade poster as a dim ASCII ghost ---------- */
  function setupGhost(reduced) {
    const ghost = document.querySelector("[data-ghost]");
    const canvas = ghost?.querySelector("canvas");
    if (!ghost || !canvas) return;
    const context = canvas.getContext("2d");
    const image = new Image();
    image.decoding = "async";
    const cell = { w: 6, h: 9 };
    const RAMP = " .:-=+*#%@";
    let cells = [];
    let cols = 0;
    let rows = 0;
    let timer = 0;
    let visible = false;

    function sample() {
      const rect = ghost.getBoundingClientRect();
      cols = Math.max(8, Math.round(rect.width / cell.w));
      rows = Math.max(8, Math.round(rect.height / cell.h));
      const probe = document.createElement("canvas");
      probe.width = cols;
      probe.height = rows;
      const pc = probe.getContext("2d", { willReadFrequently: true });
      pc.drawImage(image, 0, 0, cols, rows);
      const data = pc.getImageData(0, 0, cols, rows).data;
      cells = [];
      for (let i = 0; i < cols * rows; i += 1) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const lum = (r * .299 + g * .587 + b * .114) / 255;
        const red = r > 110 && r > g * 1.7 && r > b * 1.7;
        const gold = r > 150 && g > 110 && b < 90 && !red;
        cells.push({ lum, red, gold });
      }
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = `500 9px ui-monospace, "SF Mono", Menlo, monospace`;
      context.textBaseline = "middle";
      context.textAlign = "center";
      draw(false);
    }

    function paintCell(i, jitter) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      const info = cells[i];
      let lum = clamp(info.lum * 1.25, 0, 1);
      if (jitter) lum = clamp(lum + (Math.random() - .5) * .3, 0, 1);
      const glyph = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))];
      context.clearRect(x * cell.w, y * cell.h, cell.w, cell.h);
      if (glyph === " ") return;
      const alpha = .1 + lum * .55;
      context.fillStyle = info.red ? `rgba(236,106,53,${(.25 + lum * .6).toFixed(3)})`
        : info.gold ? `rgba(245,183,49,${(.2 + lum * .55).toFixed(3)})`
          : `rgba(214,222,255,${alpha.toFixed(3)})`;
      context.fillText(glyph, x * cell.w + cell.w / 2, y * cell.h + cell.h / 2 + .5);
    }

    function draw(jitter) {
      for (let i = 0; i < cells.length; i += 1) paintCell(i, jitter);
    }

    function shimmer() {
      if (!visible || reduced) return;
      const count = Math.max(6, Math.round(cells.length * .025));
      for (let n = 0; n < count; n += 1) paintCell(Math.floor(Math.random() * cells.length), true);
      timer = setTimeout(shimmer, 110);
    }

    function sync() {
      clearTimeout(timer);
      timer = 0;
      if (visible && !reduced && cells.length) timer = setTimeout(shimmer, 110);
    }

    image.addEventListener("load", () => {
      try { sample(); } catch (_) { ghost.classList.add("is-fallback"); return; }
      ghost.dataset.ghostReady = "true";
      if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .1 }).observe(ghost);
      else { visible = true; sync(); }
      addEventListener("resize", () => { try { sample(); } catch (_) {} });
    }, { once: true });
    image.addEventListener("error", () => ghost.classList.add("is-fallback"), { once: true });
    image.src = ghost.dataset.ghostSrc;
  }

  function init() {
    const reduced = reducedMotion();
    document.body.dataset.hdMotion = reduced ? "reduce" : "full";
    setupYouTube();
    setupLiveVersion();
    setupHeaderTheme();
    setupVideos(reduced);
    setupPressables();
    setupKeys(reduced);
    setupStack(reduced);
    setupAscii();
    setupGhost(reduced);
  }

  return { init, bayerThreshold, renderYouTube, applyLiveVersion, EASE };
});
