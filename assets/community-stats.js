(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.document) root.addEventListener("DOMContentLoaded", api.init);
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const ENDPOINT = "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1/public-community-stats";
  const copy = {
    ko: { loading: "기록을 불러오는 중…", error: "기록을 불러오지 못했어요. 다시 시도해 주세요.", empty: "첫 번째 실험 기록을 기다리고 있어요." },
    en: { loading: "Loading records…", error: "Records could not be loaded. Please try again.", empty: "Waiting for the first experiment." },
    de: { loading: "Spieldaten werden geladen…", error: "Spieldaten konnten nicht geladen werden. Bitte erneut versuchen.", empty: "Wir warten auf das erste Experiment." },
    ja: { loading: "記録を読み込み中…", error: "記録を読み込めませんでした。もう一度お試しください。", empty: "最初の実験記録を待っています。" },
  };

  function validateStats(data) {
    if (!data || data.window_days !== 28 || data.all_time !== false
      || typeof data.total_score !== "string" || !/^(0|[1-9]\d{0,29})$/.test(data.total_score)
      || !Number.isSafeInteger(data.record_count) || data.record_count < 0
      || typeof data.as_of !== "string" || !Number.isFinite(Date.parse(data.as_of))) {
      throw new Error("Invalid community totals");
    }
    return { total_score: data.total_score, record_count: data.record_count, as_of: data.as_of };
  }

  function digitPlan(value, locale) {
    const formatted = new Intl.NumberFormat(locale).format(BigInt(value));
    let place = 0;
    return [...formatted].reverse().map(char => {
      if (!/\d/.test(char)) return { char };
      const index = place++;
      return { char, steps: 20 + Number(char), delay: Math.min(index * 65, 455), duration: 1050 + Math.min(index * 45, 315) };
    }).reverse();
  }

  function init() {
    const section = document.querySelector("[data-community-stats]");
    if (!section) return;
    const total = section.querySelector("[data-community-total]");
    const count = section.querySelector("[data-community-count]");
    const status = section.querySelector("[data-community-status]");
    const retry = section.querySelector("[data-community-retry]");
    const locale = document.documentElement.lang || "en";
    const text = copy[locale] || copy.en;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let motionPaused = document.documentElement.dataset.motionPaused === "true";
    let visible = false;
    let played = false;
    let reels = [];
    let animations = [];
    let controller;

    function finish() {
      for (const animation of animations) animation.finish();
      animations = [];
      for (const { track, steps } of reels) track.style.transform = `translateY(-${steps}em)`;
      section.classList.remove("is-counting");
    }

    function reveal() {
      if (!visible || played || !reels.length) return;
      played = true;
      if (reduced.matches || motionPaused || !Element.prototype.animate) { finish(); return; }
      section.classList.add("is-counting");
      animations = reels.map(({ track, steps, delay, duration }) => {
        track.style.transform = `translateY(-${steps}em)`;
        return track.animate([
          { transform: "translateY(0)" },
          { transform: `translateY(-${steps}em)` },
        ], { duration, delay, easing: "cubic-bezier(.15,.7,.16,1)", fill: "backwards" });
      });
      Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => section.classList.remove("is-counting"));
    }

    function render(node, value) {
      const formatted = new Intl.NumberFormat(locale).format(BigInt(value));
      node.dataset.value = String(value);
      node.style.setProperty("--counter-characters", String(formatted.length));
      if (node === total) {
        const heading = section.querySelector("h2");
        const words = heading?.querySelectorAll(":scope > span");
        if (words?.length === 2) heading.setAttribute("aria-label", `${words[0].textContent} ${formatted} ${words[1].textContent}`);
      }
      const accessible = document.createElement("span");
      accessible.className = "counter-accessible";
      accessible.textContent = formatted;
      const digits = document.createElement("span");
      digits.className = "counter-digits";
      digits.setAttribute("aria-hidden", "true");
      for (const plan of digitPlan(value, locale)) {
        const slot = document.createElement("span");
        slot.className = plan.steps === undefined ? "counter-separator" : "counter-slot";
        if (plan.steps === undefined) slot.textContent = plan.char;
        else {
          const track = document.createElement("span");
          track.className = "counter-track";
          for (let i = 0; i <= plan.steps; i++) {
            const digit = document.createElement("span");
            digit.textContent = String(i % 10);
            track.append(digit);
          }
          slot.append(track);
          reels.push({ track, ...plan });
        }
        digits.append(slot);
      }
      node.replaceChildren(accessible, digits);
    }

    async function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 8000);
      finish();
      reels = [];
      played = false;
      section.setAttribute("aria-busy", "true");
      section.dataset.statsState = "loading";
      status.hidden = false;
      status.textContent = text.loading;
      retry.hidden = true;
      total.textContent = count.textContent = "—";
      section.querySelector("h2")?.removeAttribute("aria-label");
      delete total.dataset.value;
      delete count.dataset.value;
      try {
        const response = await fetch(ENDPOINT, { cache: "no-store", credentials: "omit", signal: request.signal });
        if (!response.ok) throw new Error("Stats unavailable");
        const data = validateStats(await response.json());
        if (controller !== request) return;
        render(total, data.total_score);
        render(count, data.record_count);
        section.dataset.statsState = data.record_count ? "ready" : "empty";
        section.dataset.statsAsOf = data.as_of;
        status.textContent = data.record_count ? "" : text.empty;
        status.hidden = Boolean(data.record_count);
        reveal();
      } catch (_) {
        if (controller !== request) return;
        section.dataset.statsState = "error";
        status.textContent = text.error;
        status.hidden = false;
        retry.hidden = false;
      } finally {
        clearTimeout(timeout);
        if (controller === request) section.setAttribute("aria-busy", "false");
      }
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible && played) finish();
        else reveal();
      }, { threshold: .2 }).observe(section);
    } else visible = true;
    retry.addEventListener("click", refresh);
    reduced.addEventListener("change", () => { if (reduced.matches && played) finish(); });
    addEventListener("houseduck:motion", event => {
      motionPaused = event.detail.paused;
      if (motionPaused && played) finish();
    });
    addEventListener("pageshow", event => { if (event.persisted) refresh(); });
    refresh();
  }

  return { validateStats, digitPlan, init };
});
