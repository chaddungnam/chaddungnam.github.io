// /10key/share/ — where the itch.io page's COPY LINK key lands (owner 2026-11-06: an itch description runs no script, so
// its copy key opens this page). Shares the itch.io demo link: copy (clipboard, then a select-and-copy fallback), the
// phone share sheet where there is one, X and Threads. Language = tenkey-small.js's (?lang= or the browser), set on <html>.
(function () {
  "use strict";
  var URL_ = "https://houseduck.itch.io/10key-survival";
  var STR = {
    ko: { title: "딸깍 서바이벌 공유하기", intro: "무료 체험판 링크를 복사해서 친구에게 보내 주세요.", addr: "링크", copy: "링크 복사", copied: "복사했어요", fail: "복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요.", phone: "휴대폰 공유창", x: "X에 올리기", threads: "Threads에 올리기", back: "게임으로 돌아가기", text: "딸깍 서바이벌: 살아 있는 텐키가 되어 끝없는 키보드를 파고 내려가는 게임이에요. 브라우저에서 무료 체험판을 해 보세요!" },
    en: { title: "Share 10key Survival", intro: "Copy the link to the free demo and send it to a friend.", addr: "Link", copy: "Copy link", copied: "Copied", fail: "Could not copy. Press and hold the address above to copy it.", phone: "Phone share sheet", x: "Post on X", threads: "Post on Threads", back: "Back to the game", text: "10key Survival: dig down an endless keyboard as a living numpad. Play the free demo in your browser!" },
    de: { title: "10key Survival teilen", intro: "Kopier den Link zur kostenlosen Demo und schick ihn einem Freund.", addr: "Link", copy: "Link kopieren", copied: "Kopiert", fail: "Kopieren hat nicht geklappt. Die Adresse oben lange drücken und kopieren.", phone: "Teilen-Menü des Handys", x: "Auf X posten", threads: "Auf Threads posten", back: "Zurück zum Spiel", text: "10key Survival: Du gräbst dich als lebendiger Ziffernblock durch eine endlose Tastatur. Probier die kostenlose Demo im Browser!" },
    ja: { title: "10key Survivalをシェア", intro: "無料体験版のリンクをコピーして、友だちに送ろう。", addr: "リンク", copy: "リンクをコピー", copied: "コピーしました", fail: "コピーできませんでした。上のアドレスを長押ししてコピーしてください。", phone: "スマホの共有メニュー", x: "Xに投稿", threads: "Threadsに投稿", back: "ゲームに戻る", text: "10key Survival：生きたテンキになって、終わりのないキーボードを掘り進むゲーム。ブラウザで無料デモを遊ぼう！" },
    zh: { title: "分享《咔噠求生》", intro: "複製免費試玩版的連結，傳給朋友吧。", addr: "連結", copy: "複製連結", copied: "已複製", fail: "複製失敗。請長按上方網址手動複製。", phone: "手機分享選單", x: "發佈到 X", threads: "發佈到 Threads", back: "回到遊戲", text: "《咔噠求生》（10key Survival）：化身活生生的數字鍵盤，挖穿無盡的鍵盤。在瀏覽器免費試玩！" }
  };

  function start() {
    var lang = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    var T = STR[lang] || STR.en;
    document.querySelectorAll("[data-share-t]").forEach(function (n) { var v = T[n.getAttribute("data-share-t")]; if (v) n.textContent = v; });
    document.title = T.title + " | House Duck";
    var addr = document.querySelector("[data-share-addr]");
    var status = document.querySelector("[data-share-status]");
    var copy = document.querySelector("[data-share-copy]");
    var phone = document.querySelector("[data-share-phone]");
    var x = document.querySelector("[data-share-x]");
    var threads = document.querySelector("[data-share-threads]");
    x.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(T.text) + "&url=" + encodeURIComponent(URL_);
    threads.href = "https://www.threads.net/intent/post?text=" + encodeURIComponent(T.text + " " + URL_);
    addr.addEventListener("focus", function () { addr.select(); });

    function legacy() {
      addr.focus(); addr.select(); addr.setSelectionRange(0, URL_.length);
      try { return document.execCommand("copy"); } catch (e) { return false; }
    }
    function say(ok) {
      var face = copy.querySelector(".tk-key-face");
      status.textContent = ok ? T.copied : T.fail;
      status.classList.toggle("tk-sr", ok);  // the key itself says "Copied"; only a failure shows its line
      if (ok) { face.textContent = T.copied; clearTimeout(copy._t); copy._t = setTimeout(function () { face.textContent = T.copy; status.textContent = ""; }, 2000); }
      else { addr.focus(); addr.select(); }
    }
    copy.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(URL_).then(function () { say(true); }, function () { say(legacy()); });
      else say(legacy());
    });
    if (navigator.share) {
      phone.hidden = false;
      phone.addEventListener("click", function () { navigator.share({ title: T.title, text: T.text, url: URL_ }).catch(function () {}); });
    }
  }
  // tenkey-small.js (deferred before this one) sets <html lang> first
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
