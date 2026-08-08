(() => {
  "use strict";

  const mobileMenu = document.querySelector(".mobile-menu");
  if (mobileMenu) {
    mobileMenu.addEventListener("click", (event) => {
      if (event.target.closest("a")) mobileMenu.removeAttribute("open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") mobileMenu.removeAttribute("open");
    });
  }

  const stream = document.querySelector("#tt-body-index #post-stream");
  if (stream && !stream.querySelector(".post-card")) {
    stream.innerHTML = '<section class="empty-state"><span class="duck-mark" aria-hidden="true"></span><h2>첫 제작 기록을 준비하고 있습니다.</h2><p>House Duck이 만드는 과정이 곧 이곳에 쌓입니다.</p></section>';
  }
})();
