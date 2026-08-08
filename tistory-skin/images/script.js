(() => {
  "use strict";

  const root = document.documentElement;
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem("house_duck_theme") || "";
  } catch (_error) {
    savedTheme = "";
  }
  const initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "dark";

  function setTheme(theme) {
    root.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#0d1525" : "#f3f1ea";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
    });
  }

  setTheme(initialTheme);
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      setTheme(theme);
      try {
        localStorage.setItem("house_duck_theme", theme);
      } catch (_error) {
        // The control still works when storage is blocked.
      }
    });
  });

  document.querySelectorAll("[data-post-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.postTab;
      document.querySelectorAll("[data-post-tab]").forEach((tab) => {
        tab.setAttribute("aria-selected", String(tab === button));
      });
      document.querySelectorAll("[data-post-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.postPanel !== selected;
      });
    });
  });

  document.querySelectorAll(".post-discovery-grid").forEach((grid) => {
    if (!grid.querySelector(".discovery-card")) {
      grid.innerHTML = '<p class="post-discovery-empty">글이 게시되면 이곳에 미리보기 이미지와 함께 표시됩니다.</p>';
    }
  });

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
