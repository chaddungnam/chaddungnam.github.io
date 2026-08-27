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

  function setupGameCursor(reducedMotion) {
    if (reducedMotion || matchMedia("(pointer: coarse)").matches) return;
    const cursor = document.createElement("span");
    cursor.className = "game-cursor";
    cursor.dataset.gameCursor = "";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);
    document.body.classList.add("has-game-cursor");
    let x = -100;
    let y = -100;
    let angle = 0;

    addEventListener("pointermove", (event) => {
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance > 2) angle = Math.atan2(event.clientY - y, event.clientX - x) * 180 / Math.PI;
      x = event.clientX;
      y = event.clientY;
      cursor.style.opacity = "1";
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg) translate(-30%, -50%)`;
      cursor.classList.toggle("is-target", Boolean(event.target.closest("a, button, summary")));
    }, { passive: true });
    addEventListener("pointerdown", (event) => {
      const impact = document.createElement("span");
      impact.className = "cursor-impact";
      impact.dataset.cursorImpact = "";
      impact.style.left = `${event.clientX}px`;
      impact.style.top = `${event.clientY}px`;
      document.body.append(impact);
      impact.addEventListener("animationend", () => impact.remove(), { once: true });
    });
    document.documentElement.addEventListener("mouseleave", () => { cursor.style.opacity = "0"; });
  }

  function setupCanvas(reducedMotion) {
    const canvas = document.querySelector("[data-quirky-canvas]");
    const stage = canvas?.closest("[data-quirky-mechanic]");
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d");
    const marbles = [];
    let shots = [];
    let particles = [];
    let width = 0;
    let height = 0;
    let active = true;
    let start = performance.now();
    let previous = start;
    let pairCount = -1;
    let frame = 0;
    let impactCount = 0;

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
        const speed = 17 + index % 4 * 4;
        marbles[index] = {
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance * .68,
          radius: marbles[index]?.radius || 13 + index % 4 * 3,
          color: palette[index % palette.length],
          vx: marbles[index]?.vx || Math.cos(angle + 1.2) * speed,
          vy: marbles[index]?.vy || Math.sin(angle + 1.2) * speed,
          spin: marbles[index]?.spin || angle,
        };
      }
    }

    function emitParticles(x, y, vx, vy, color, count) {
      const heading = Math.atan2(vy, vx);
      for (let index = 0; index < count; index += 1) {
        const spread = (index - (count - 1) / 2) * .27;
        const speed = 55 + index % 3 * 28;
        particles.push({ x, y, vx: Math.cos(heading + spread) * speed, vy: Math.sin(heading + spread) * speed, life: .38, size: 2 + index % 2, color });
      }
      if (particles.length > 100) particles.splice(0, particles.length - 100);
    }

    function spawnPair(rotation, index) {
      for (const angle of shotAngles(rotation, index)) {
        const vx = Math.cos(angle) * 390;
        const vy = Math.sin(angle) * 390;
        shots.push({ x: width / 2, y: height / 2, vx, vy, angle, bounces: 0, hits: new Set() });
        emitParticles(width / 2, height / 2, -vx, -vy, "#ef3f38", 3);
      }
    }

    function launchBurst(rotation) {
      shots = [];
      pairCount = 2;
      for (let index = 0; index < 3; index += 1) spawnPair(rotation + index * .32, index);
    }

    function updateMarbles(delta) {
      for (const marble of marbles) {
        const radius = Math.max(7, marble.radius);
        marble.x += marble.vx * delta;
        marble.y += marble.vy * delta;
        marble.spin += Math.hypot(marble.vx, marble.vy) * delta / radius;
        if (marble.x < radius || marble.x > width - radius) { marble.vx *= -1; marble.x = Math.max(radius, Math.min(width - radius, marble.x)); }
        if (marble.y < radius || marble.y > height - radius) { marble.vy *= -1; marble.y = Math.max(radius, Math.min(height - radius, marble.y)); }
        const speed = Math.hypot(marble.vx, marble.vy);
        if (speed > 82) { marble.vx *= 82 / speed; marble.vy *= 82 / speed; }
      }
    }

    function updateParticles(delta) {
      particles = particles.filter((particle) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= .94;
        particle.vy *= .94;
        particle.life -= delta;
        return particle.life > 0;
      });
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
        for (const [index, marble] of marbles.entries()) {
          if (!shot.hits.has(index) && Math.hypot(shot.x - marble.x, shot.y - marble.y) < marble.radius + 7) {
            shot.hits.add(index);
            marble.radius = shrinkRadius(marble.radius, ((marble.x + marble.y + frame) % 100) / 100);
            marble.vx += shot.vx * .11;
            marble.vy += shot.vy * .11;
            emitParticles(shot.x, shot.y, shot.vx, shot.vy, marble.color, 7);
            impactCount += 1;
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
        const radius = Math.max(7, marble.radius);
        context.beginPath();
        context.arc(marble.x + 2, marble.y + 3, radius, 0, TAU);
        context.fillStyle = "rgba(17,19,25,.12)";
        context.fill();
        context.beginPath();
        context.arc(marble.x, marble.y, radius, 0, TAU);
        context.fillStyle = marble.color;
        context.fill();
        context.strokeStyle = "#172033";
        context.lineWidth = 2;
        context.stroke();
        context.beginPath();
        context.arc(marble.x + Math.cos(marble.spin) * radius * .34, marble.y + Math.sin(marble.spin) * radius * .34, Math.max(2, radius * .16), 0, TAU);
        context.fillStyle = "rgba(255,255,255,.72)";
        context.fill();
      }
      for (const shot of shots) {
        const heading = Math.atan2(shot.vy, shot.vx);
        const trail = context.createLinearGradient(shot.x, shot.y, shot.x - Math.cos(heading) * 34, shot.y - Math.sin(heading) * 34);
        trail.addColorStop(0, "rgba(239,63,56,.85)");
        trail.addColorStop(1, "rgba(239,63,56,0)");
        context.strokeStyle = trail;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(shot.x, shot.y);
        context.lineTo(shot.x - Math.cos(heading) * 34, shot.y - Math.sin(heading) * 34);
        context.stroke();
        context.save();
        context.translate(shot.x, shot.y);
        context.rotate(heading);
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
      for (const particle of particles) {
        context.globalAlpha = Math.min(1, particle.life * 3);
        context.fillStyle = particle.color;
        context.fillRect(particle.x, particle.y, particle.size * 2.5, particle.size);
      }
      context.globalAlpha = 1;
      canvas.dataset.rotation = rotation.toFixed(3);
      canvas.dataset.frame = String(++frame);
      canvas.dataset.marbleState = marbles.slice(0, 4).map((marble) => `${marble.x.toFixed(1)},${marble.y.toFixed(1)}`).join(";");
      canvas.dataset.shotCount = String(shots.length);
      canvas.dataset.impactCount = String(impactCount);
    }

    function tick(now) {
      if (!active) { previous = now; requestAnimationFrame(tick); return; }
      const elapsed = ((now - start) / 1000) % QUIRKY_RULES.eventSeconds;
      if (elapsed < (previous - start) / 1000 % QUIRKY_RULES.eventSeconds) launchBurst(0);
      const rotation = elapsed / QUIRKY_RULES.eventSeconds * QUIRKY_RULES.totalTurns * TAU;
      const nextPair = Math.floor(elapsed / QUIRKY_RULES.pairInterval);
      while (pairCount < nextPair) spawnPair(rotation, ++pairCount);
      const delta = Math.min(.034, (now - previous) / 1000);
      updateMarbles(delta);
      updateShots(delta);
      updateParticles(delta);
      draw(rotation);
      previous = now;
      requestAnimationFrame(tick);
    }

    resize();
    addEventListener("resize", resize);
    if (reducedMotion) { draw(0); return; }
    launchBurst(0);
    if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => { active = entry.isIntersecting; }, { threshold: .05 }).observe(stage);
    requestAnimationFrame(tick);
  }

  function init() {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setupYouTube();
    setupToneAndMascot();
    setupVideos(reducedMotion);
    setupGameCursor(reducedMotion);
    setupCanvas(reducedMotion);
  }

  return { QUIRKY_RULES, shotAngles, shrinkRadius, init };
});
