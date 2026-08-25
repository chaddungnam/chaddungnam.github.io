(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.HouseDuckStudio = api;
    if (root.document) root.addEventListener("DOMContentLoaded", api.init);
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const QUIRKY_RULES = Object.freeze({
    totalTurns: 4.5,
    eventSeconds: 2.25,
    shotsPerSecond: 8,
    pairInterval: 0.25,
    shrinkMin: 0.82,
    shrinkMax: 0.94,
    maxBounces: 1,
  });
  const TAU = Math.PI * 2;
  const palette = ["#ffcd38", "#ff7d64", "#55b8f8", "#48c7a8", "#9667e9", "#f4f0e8"];

  function shotAngles(rotation, pairIndex) {
    const angle = rotation + (pairIndex % 3) * TAU / 3;
    return [angle, angle + Math.PI];
  }

  function shrinkRadius(radius, roll) {
    return radius * (QUIRKY_RULES.shrinkMin + Math.max(0, Math.min(1, roll)) * (QUIRKY_RULES.shrinkMax - QUIRKY_RULES.shrinkMin));
  }

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
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const meta = document.createElement("small");
      const title = document.createElement("strong");
      link.className = "youtube-card";
      link.dataset.youtubeCard = "";
      link.href = `https://www.youtube.com/watch?v=${video.videoId}`;
      image.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      image.width = 480;
      image.height = 360;
      image.alt = "";
      image.loading = "lazy";
      meta.textContent = "HOUSE DUCK · YOUTUBE";
      title.textContent = video.title.trim();
      copy.append(meta, title);
      link.append(image, copy);
      fragment.append(link);
    }
    feed.replaceChildren(fragment);
  }

  function setupYouTube() {
    fetch("assets/youtube-feed.json", { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("feed unavailable")))
      .then((data) => renderYouTube(data.videos))
      .catch(() => {});
  }

  function setupToneAndMascot() {
    const sections = [...document.querySelectorAll("[data-tone]")];
    const mascot = document.querySelector("[data-scroll-quirky]");
    const quirky = document.querySelector('[data-project="quirky-ball"]');
    if (!sections.length) return;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const centre = innerHeight * .5;
      let closest = sections[0];
      let distance = Infinity;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const inside = rect.top <= centre && rect.bottom >= centre;
        const nextDistance = inside ? 0 : Math.min(Math.abs(rect.top - centre), Math.abs(rect.bottom - centre));
        if (nextDistance < distance) { closest = section; distance = nextDistance; }
      }
      document.body.style.setProperty("--studio-tone", closest.dataset.tone);
      document.documentElement.dataset.scrollTone = closest.dataset.tone;
      if (!mascot || !quirky) return;
      const start = innerHeight * .22;
      const end = quirky.offsetTop - innerHeight * .45;
      const progress = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
      mascot.style.opacity = progress > .02 && progress < .92 ? String(Math.min(.96, progress * 2.4)) : "0";
      mascot.style.transform = `translate3d(0, ${progress * Math.min(innerHeight * .48, 410)}px, 0) rotate(${5 - progress * 18}deg)`;
    };
    const requestUpdate = () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    };
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestUpdate);
    update();
  }

  function setupVideos(reducedMotion) {
    const videos = [...document.querySelectorAll("[data-game-preview]")];
    if (reducedMotion) {
      for (const video of videos) { video.autoplay = false; video.pause(); }
      return;
    }
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }
    }, { threshold: .15 });
    for (const video of videos) observer.observe(video);
  }

  function setupCanvas(reducedMotion) {
    const canvas = document.querySelector("[data-quirky-canvas]");
    const stage = canvas?.closest("[data-quirky-mechanic]");
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d");
    const marbles = [];
    let shots = [];
    let width = 0;
    let height = 0;
    let active = true;
    let start = performance.now();
    let previous = start;
    let pairCount = -1;
    let frame = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      for (let index = 0; index < 14; index += 1) {
        const angle = index * 2.39996;
        const distance = Math.min(width, height) * (.28 + (index % 5) * .055);
        marbles[index] = {
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance * .68,
          radius: marbles[index]?.radius || 13 + index % 4 * 3,
          color: palette[index % palette.length],
        };
      }
    }

    function spawnPair(rotation, index) {
      for (const angle of shotAngles(rotation, index)) {
        shots.push({ x: width / 2, y: height / 2, vx: Math.cos(angle) * 330, vy: Math.sin(angle) * 330, angle, bounces: 0 });
      }
    }

    function updateShots(delta) {
      const padding = 8;
      shots = shots.filter((shot) => {
        shot.x += shot.vx * delta;
        shot.y += shot.vy * delta;
        let hitWall = false;
        if (shot.x < padding || shot.x > width - padding) { shot.vx *= -1; shot.x = Math.max(padding, Math.min(width - padding, shot.x)); hitWall = true; }
        if (shot.y < padding || shot.y > height - padding) { shot.vy *= -1; shot.y = Math.max(padding, Math.min(height - padding, shot.y)); hitWall = true; }
        if (hitWall && shot.bounces++ >= QUIRKY_RULES.maxBounces) return false;
        for (const marble of marbles) {
          if (Math.hypot(shot.x - marble.x, shot.y - marble.y) < marble.radius + 6) {
            marble.radius = shrinkRadius(marble.radius, ((marble.x + marble.y + frame) % 100) / 100);
            return false;
          }
        }
        return true;
      });
    }

    function draw(rotation) {
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(17,19,25,.08)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(width / 2, height / 2, Math.min(width, height) * .34, 0, TAU);
      context.stroke();
      for (const marble of marbles) {
        context.beginPath();
        context.arc(marble.x, marble.y, Math.max(7, marble.radius), 0, TAU);
        context.fillStyle = marble.color;
        context.fill();
        context.strokeStyle = "#172033";
        context.lineWidth = 2;
        context.stroke();
      }
      for (const shot of shots) {
        context.save();
        context.translate(shot.x, shot.y);
        context.rotate(Math.atan2(shot.vy, shot.vx));
        context.fillStyle = "#ef3f38";
        context.strokeStyle = "#172033";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(10, 0);
        context.lineTo(-7, -5);
        context.lineTo(-3, 0);
        context.lineTo(-7, 5);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
      }
      canvas.dataset.rotation = rotation.toFixed(3);
      canvas.dataset.frame = String(++frame);
    }

    function tick(now) {
      if (!active) { previous = now; requestAnimationFrame(tick); return; }
      const elapsed = ((now - start) / 1000) % QUIRKY_RULES.eventSeconds;
      if (elapsed < (previous - start) / 1000 % QUIRKY_RULES.eventSeconds) { pairCount = -1; shots = []; }
      const rotation = elapsed / QUIRKY_RULES.eventSeconds * QUIRKY_RULES.totalTurns * TAU;
      const nextPair = Math.floor(elapsed / QUIRKY_RULES.pairInterval);
      while (pairCount < nextPair) spawnPair(rotation, ++pairCount);
      updateShots(Math.min(.034, (now - previous) / 1000));
      draw(rotation);
      previous = now;
      requestAnimationFrame(tick);
    }

    resize();
    addEventListener("resize", resize);
    if (reducedMotion) { draw(0); return; }
    if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => { active = entry.isIntersecting; }, { threshold: .05 }).observe(stage);
    requestAnimationFrame(tick);
  }

  function init() {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setupYouTube();
    setupToneAndMascot();
    setupVideos(reducedMotion);
    setupCanvas(reducedMotion);
  }

  return { QUIRKY_RULES, shotAngles, shrinkRadius, init };
});
