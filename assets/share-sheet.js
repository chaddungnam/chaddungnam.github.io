/* House Duck share sheet (owner 2026-11-06). One small script for every "share" key on the site.
 *
 *   <div class="hd-share-row" data-share-row hidden>
 *     <button type="button" data-share-open>Share</button>
 *     <button type="button" data-share-copy>Copy link</button>
 *     <span role="status" data-share-status></span>
 *   </div>
 *
 * Share key: the phone's own share sheet with the picture + text + link when the browser can send files, else text + link,
 * else this page's own sheet (X, Threads, copy text and link, save the picture, the phone share key when there is one).
 * In the KakaoTalk / Instagram / Facebook in-app browsers the sheet opens first with "copy" in front and a long-press hint
 * on the picture. KakaoTalk's own share button needs a Kakao JS app key and is not used: on phones Kakao is one entry of
 * the phone share sheet. The row stays hidden until this script runs, so no key is ever dead. */
(function () {
  "use strict";
  var ORIGIN = "https://houseduck.in";
  var LANG = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  var PATH = { ko: "/10key/", en: "/10key/index_en.html", de: "/10key/index_de.html", ja: "/10key/index_ja.html", zh: "/10key/index_zh.html" };
  var IMAGE = {};
  ["ko", "en", "de", "ja", "zh"].forEach(function (l) { IMAGE[l] = "/assets/media/share/tenkey-share-" + l + ".png"; });
  var STR = {
    ko: { title: "공유하기", intro: "딸깍 서바이벌을 친구에게 알려 주세요.", phone: "휴대폰 공유창", x: "X에 올리기", threads: "Threads에 올리기", copyAll: "글과 링크 복사", copyLink: "링크 복사", save: "그림 저장", hint: "그림을 길게 눌러 저장하세요.", inapp: "이 앱 안에서는 복사가 가장 확실해요. 복사한 뒤 카카오톡이나 인스타그램에 붙여 넣으세요.", copied: "복사됨", copiedMsg: "복사했어요.", fail: "복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요.", close: "닫기", imgAlt: "딸깍 서바이벌 공유 그림: 3D 키보드 위의 텐키와 마우스", text: "딸깍 서바이벌: 살아 있는 텐키가 되어 끝없는 키보드를 파고 내려가는 게임이에요. 지금 사전예약 중!" },
    en: { title: "Share", intro: "Tell a friend about 10key Survival.", phone: "Phone share sheet", x: "Post on X", threads: "Post on Threads", copyAll: "Copy text and link", copyLink: "Copy link", save: "Save picture", hint: "Press and hold the picture to save it.", inapp: "Copying works best inside this app. Copy, then paste it into KakaoTalk or Instagram.", copied: "Copied", copiedMsg: "Copied.", fail: "Could not copy. Press and hold the address above to copy it.", close: "Close", imgAlt: "10key Survival share picture: the numpad and the mouse on a 3D keyboard", text: "10key Survival: a game where you dig down an endless keyboard as a living numpad. Pre-registration is open!" },
    de: { title: "Teilen", intro: "Erzähl einem Freund von 10key Survival.", phone: "Teilen-Menü des Handys", x: "Auf X posten", threads: "Auf Threads posten", copyAll: "Text und Link kopieren", copyLink: "Link kopieren", save: "Bild speichern", hint: "Bild lange drücken, um es zu speichern.", inapp: "In dieser App klappt Kopieren am besten. Kopieren und dann in KakaoTalk oder Instagram einfügen.", copied: "Kopiert", copiedMsg: "Kopiert.", fail: "Kopieren hat nicht geklappt. Die Adresse oben lange drücken und kopieren.", close: "Schließen", imgAlt: "10key-Survival-Teilen-Bild: der Ziffernblock und die Maus auf einer 3D-Tastatur", text: "10key Survival: Du gräbst dich als lebendiger Ziffernblock durch eine endlose Tastatur. Die Vorregistrierung läuft!" },
    ja: { title: "シェア", intro: "10key Survivalを友だちに教えよう。", phone: "スマホの共有メニュー", x: "Xに投稿", threads: "Threadsに投稿", copyAll: "文とリンクをコピー", copyLink: "リンクをコピー", save: "画像を保存", hint: "画像を長押しして保存してください。", inapp: "このアプリ内ではコピーが確実です。コピーして、KakaoTalkやInstagramに貼り付けてください。", copied: "コピーしました", copiedMsg: "コピーしました。", fail: "コピーできませんでした。上のアドレスを長押ししてコピーしてください。", close: "閉じる", imgAlt: "10key Survivalのシェア画像：3Dキーボードの上のテンキとマウス", text: "10key Survival：生きたテンキになって、終わりのないキーボードを掘り進むゲーム。事前登録受付中！" },
    zh: { title: "分享", intro: "把《咔噠求生》介紹給朋友。", phone: "手機分享選單", x: "發佈到 X", threads: "發佈到 Threads", copyAll: "複製文字與連結", copyLink: "複製連結", save: "儲存圖片", hint: "長按圖片即可儲存。", inapp: "在這個 App 內複製最穩。複製後貼到 KakaoTalk 或 Instagram。", copied: "已複製", copiedMsg: "已複製。", fail: "複製失敗。請長按上方網址手動複製。", close: "關閉", imgAlt: "《咔噠求生》分享圖片：3D 鍵盤上的數字鍵與滑鼠", text: "《咔噠求生》（10key Survival）：化身活生生的數字鍵盤，挖穿無盡的鍵盤。現正事前預約中！" }
  };
  var T = STR[LANG] || STR.en;
  var UA = navigator.userAgent || "";
  var IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB/i.test(UA);
  var IS_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var URL_ = ORIGIN + (PATH[LANG] || PATH.en);
  var IMG_URL = IMAGE[LANG] || IMAGE.en;
  var dlg = null, opener = null, fileP = null, copyTimer = 0;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  /* the picture as a File for navigator.share; started early (hover / touch / focus) so the click itself never waits */
  function loadFile() {
    if (!fileP) {
      fileP = fetch(IMG_URL).then(function (r) { if (!r.ok) throw new Error("img"); return r.blob(); })
        .then(function (b) { return new File([b], "10key-survival.png", { type: "image/png" }); })
        .catch(function () { fileP = null; return null; });
    }
    return fileP;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = el("textarea", { readonly: "", "aria-hidden": "true", tabindex: "-1" });
    ta.value = text; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); return ok;
  }

  /* a button shows "복사됨" for 2 s after a copy; a polite live region says it too */
  function flash(btn, statusEl, ok) {
    var label = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", label);
    clearTimeout(btn._t);
    if (ok) { btn.textContent = T.copied; btn.setAttribute("data-state", "copied"); }
    if (statusEl) statusEl.textContent = ok ? T.copiedMsg : T.fail;
    btn._t = setTimeout(function () { btn.textContent = label; btn.removeAttribute("data-state"); if (statusEl) statusEl.textContent = ""; }, 2000);
  }

  function payload() { return { title: document.title, text: T.text, url: URL_ }; }

  function nativeShare() {
    var p = payload();
    if (!navigator.share) return Promise.reject(new Error("no-share"));
    return loadFile().then(function (file) {
      var data = { title: p.title, text: p.text, url: p.url };
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      else if (navigator.canShare && !navigator.canShare(data)) delete data.title;
      return navigator.share(data);
    });
  }

  function openFrom(btn) {
    opener = btn;
    if (!IN_APP && navigator.share) {
      nativeShare().catch(function (err) {
        if (err && err.name === "AbortError") return;      // the person closed the phone's share sheet
        openSheet();
      });
    } else openSheet();
  }

  function buildSheet() {
    var d = el("dialog", { class: "hd-share", "aria-labelledby": "hd-share-title", lang: LANG });
    var head = el("div", { class: "hd-share-head" });
    head.appendChild(el("h2", { id: "hd-share-title" }, T.title));
    var x = el("button", { type: "button", class: "hd-share-x", "aria-label": T.close, "data-share-close": "" });
    x.appendChild(el("span", { "aria-hidden": "true" }));
    head.appendChild(x);
    d.appendChild(head);
    d.appendChild(el("p", { class: "hd-share-intro" }, T.intro));

    var fig = el("figure", { class: "hd-share-pic" });
    var img = el("img", { src: IMG_URL, width: "1200", height: "630", alt: T.imgAlt, decoding: "async" });
    fig.appendChild(img);
    if (IN_APP || IS_IOS) fig.appendChild(el("figcaption", {}, T.hint));
    d.appendChild(fig);
    if (IN_APP) d.appendChild(el("p", { class: "hd-share-inapp" }, T.inapp));

    var addr = el("input", { class: "hd-share-addr", type: "text", readonly: "", value: URL_, "aria-label": T.copyLink });
    addr.addEventListener("focus", function () { addr.select(); });
    d.appendChild(addr);

    var list = el("ul", { class: "hd-share-list" });
    var items = [];
    function add(key, node) { var li = el("li", { "data-k": key }); li.appendChild(node); items.push(li); }
    function btn(label, fn, cls) { var b = el("button", { type: "button", class: "hd-share-item" + (cls ? " " + cls : "") }, label); b.addEventListener("click", function () { fn(b); }); return b; }
    var p = payload();
    var status = el("p", { class: "hd-share-status", role: "status", "aria-live": "polite" });

    add("copyAll", btn(T.copyAll, function (b) { copyText(p.text + "\n" + p.url).then(function (ok) { flash(b, status, ok); if (!ok) addr.select(); }); }, "is-primary"));
    add("copyLink", btn(T.copyLink, function (b) { copyText(p.url).then(function (ok) { flash(b, status, ok); if (!ok) addr.select(); }); }));
    if (navigator.share) add("phone", btn(T.phone, function () { nativeShare().catch(function () {}); }));
    var ax = el("a", { class: "hd-share-item", href: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(p.text) + "&url=" + encodeURIComponent(p.url), target: "_blank", rel: "noopener noreferrer" }, T.x);
    add("x", ax);
    var at = el("a", { class: "hd-share-item", href: "https://www.threads.net/intent/post?text=" + encodeURIComponent(p.text + " " + p.url), target: "_blank", rel: "noopener noreferrer" }, T.threads);
    add("threads", at);
    var sv = el("a", { class: "hd-share-item", href: IMG_URL, download: "10key-survival.png" }, T.save);
    add("save", sv);

    /* in-app browsers: copy first (already first); everywhere else the phone share key leads when there is one */
    if (!IN_APP) {
      var ph = items.filter(function (li) { return li.getAttribute("data-k") === "phone"; })[0];
      if (ph) { items.splice(items.indexOf(ph), 1); items.unshift(ph); ph.firstChild.classList.add("is-primary"); }
      var ca = items.filter(function (li) { return li.getAttribute("data-k") === "copyAll"; })[0];
      if (ph && ca) ca.firstChild.classList.remove("is-primary");
    }
    items.forEach(function (li) { list.appendChild(li); });
    d.appendChild(list);
    d.appendChild(status);

    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-share-close]")) closeSheet(); });
    d.addEventListener("close", function () { if (opener && opener.focus) opener.focus(); });
    document.body.appendChild(d);
    return d;
  }

  function openSheet() {
    if (!dlg) dlg = buildSheet();
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    var first = dlg.querySelector(".hd-share-item"); if (first) first.focus();
  }
  function closeSheet() { if (!dlg) return; if (typeof dlg.close === "function") dlg.close(); else { dlg.removeAttribute("open"); if (opener) opener.focus(); } }

  function init() {
    var rows = document.querySelectorAll("[data-share-row]");
    if (!rows.length) return;
    rows.forEach(function (row) {
      var status = row.querySelector("[data-share-status]");
      var open = row.querySelector("[data-share-open]");
      var copy = row.querySelector("[data-share-copy]");
      if (open) {
        open.addEventListener("click", function () { openFrom(open); });
        ["pointerenter", "touchstart", "focus"].forEach(function (t) { open.addEventListener(t, function () { if (navigator.share && !IN_APP) loadFile(); }, { once: true, passive: true }); });
      }
      if (copy) copy.addEventListener("click", function () { copyText(URL_).then(function (ok) { flash(copy, status, ok); }); });
      row.hidden = false;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
