// 10key Survival launch switch (owner 2026-11-18). Every page that changes at launch reads this one file:
// - at: when the pages switch. Planned for 2026-11-20 00:00 Berlin; on 2026-11-18 the owner chose to publish the launch
//   version right away (18:00 Berlin, = 17:00 UTC) because pre-registration is closed. From then on the pages show the
//   download version ([data-launch]) instead of the pre-registration version ([data-prelaunch]), and the itch.io demo
//   is open to everyone (no pre-registration gate).
// - released: the owner's manual switch (owner 2026-11-19: no automatic switch; the homepage changes only when he says
//   so). false = the 10key pages and the home say "coming soon" (html.tk-stores-wait: [data-store-wait] replaces
//   [data-store-out]) with "coming soon" text instead of store badges, and no sale line. true = official store badges
//   for each store with live:true, "out now", and the sale line until saleTo.
//   Flipped to true on 2026-11-24 (owner: both stores released that morning).
// - stores: App Store link final (owner 2026-11-18), Google Play = the package page. /10key/get/ already acts as
//   launched with stores.*.live (owner 2026-11-19, assets/tenkey-small.js), independent of released.
// - saleTo: the launch sale ($4.99 -> $2.99) ends 11-27 Berlin (Play sale 11-20..11-27); after it the line never shows.
// ?launch=preview shows the launch version now, with both stores and the sale, for review. Loaded without defer in
// <head> so the classes are set before the page draws and before tenkey-page.js checks the itch.io gate.
(function () {
  "use strict";
  var C = window.TENKEY_LAUNCH = {
    at: Date.UTC(2026, 10, 18, 17, 0, 0),
    released: true,
    // iosSale: an App Store discount event is running (owner 2026-11-28, 50% off until 12-31 via the price schedule).
    // Its end date and percentage stay out of the page text on purpose: the badge only says an event is on and the store
    // shows the price. Flip to false when the event ends.
    iosSale: true,
    saleTo: Date.UTC(2026, 10, 27, 23, 0, 0),
    stores: {
      ios: { live: true, url: "https://apps.apple.com/app/10key-survival/id6824972492" },
      android: { live: true, url: "https://play.google.com/store/apps/details?id=com.houseduck.tenkeysurvival" }
    },
    itch: "https://houseduck.itch.io/10key-survival"
  };
  var mode = "";
  try { mode = new URLSearchParams(location.search).get("launch") || ""; } catch (_error) { mode = ""; }
  var now = Date.now();
  C.preview = mode === "preview";
  // ?launch=prereg (the shared pre-registration link of 2026-11-23) was closed on 2026-11-24 (owner): the parameter is
  // ignored, so an old link shows the normal launch version.
  C.prereg = false;
  C.on = !C.prereg && (C.preview || now >= C.at);
  C.sale = !C.prereg && (C.preview || (C.released && now < C.saleTo));
  C.live = function (key) { var st = C.stores[key]; return !!st && (C.preview || (C.on && C.released && st.live)); };
  C.wait = C.on && !C.live("ios") && !C.live("android");
  // Store links say where the visit came from: an App Store campaign link (pt = House Duck provider id, ct = source)
  // and a Google Play utm referrer, so App Store Connect and Play Console can count downloads per source.
  C.storeUrl = function (key, src, medium) {
    src = String(src || "site").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "site";
    if (key === "ios") return C.stores.ios.url + "?pt=129265473&ct=" + src + "&mt=8";
    return C.stores.android.url + "&referrer=" + encodeURIComponent("utm_source=houseduck&utm_medium=" + (medium || "site") + "&utm_campaign=" + src);
  };

  var root = document.documentElement;
  if (C.sale) root.classList.add("tk-sale");
  if (C.iosSale) root.classList.add("tk-ios-sale");
  if (!C.on) return;
  root.classList.add("tk-launch", "tk-itch-open");
  if (C.wait) root.classList.add("tk-stores-wait");

  document.addEventListener("DOMContentLoaded", function () {
    // Official store badges (Apple and Google artwork, unmodified): shown only for a store that is live; a store that
    // is not live yet shows plain "coming soon" text instead of its badge.
    document.querySelectorAll("[data-launch-store]").forEach(function (a) {
      var key = a.getAttribute("data-launch-store");
      var item = a.closest(".tk-badge-item");
      if (C.live(key)) {
        a.href = C.storeUrl(key, a.getAttribute("data-ct"));
        a.target = "_blank";
        a.rel = "noopener";
        a.hidden = false;
        if (item) item.classList.remove("is-soon");
      } else {
        a.removeAttribute("href");
        a.hidden = true;
        if (item) item.classList.add("is-soon");
      }
    });
    // The itch.io demo is no longer a pre-registration perk after launch: every demo link opens itch.io.
    document.querySelectorAll("[data-itch-gate]").forEach(function (link) {
      link.setAttribute("href", C.itch);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      var label = link.querySelector("[data-gate-label]");
      if (label && label.getAttribute("data-unlocked-label")) label.textContent = label.getAttribute("data-unlocked-label");
      var lock = link.querySelector(".tk-lock-icon");
      if (lock) lock.className = "tk-play-icon";
    });
    // Old pre-registration anchors (#prereg, #itch-demo in mails, Shorts and ads) land on the download block.
    if (location.hash === "#prereg" || location.hash === "#itch-demo") {
      var dl = document.getElementById("download");
      if (dl) dl.scrollIntoView({ block: "center" });
    }
  });
})();
