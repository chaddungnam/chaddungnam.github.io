# House Duck Blog-First Motion Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dry project-catalog homepage with a compact animated House Duck statement, two real game previews, an immediately following blog feed, and a separate public About timeline.

**Architecture:** Keep the existing static four-locale site and shared CSS/JavaScript. Reuse the console's CSS-drawn `HD` mark, replace the project-catalog generator with two authored game previews, and progressively enhance visible content with native browser animation APIs. Capture Project K from an isolated stable Git worktree and copy only web media into the public repository.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node.js contract tests, Playwright, Godot 4.7 Movie Writer, ffmpeg.

## Global Constraints

- Preserve the exact Korean copy: `AI를 사용하지만, / 사람냄새 나는 게임과 소프트웨어, / 그리고 개발 일기를 보여주는 웹사이트`.
- The speech-bubble tail points toward the iPhone mockup cluster, not the `HD` mark.
- Reuse the console `HD` mark visually; do not add a logo library or framework.
- Show only Quirky Ball and Project K; do not expose non-game apps.
- Keep content visible without JavaScript and show full copy immediately for `prefers-reduced-motion`.
- Do not modify Project K source or the existing dirty `console/analytics.js`.
- Add no frontend dependency.

---

### Task 1: Lock the new homepage and motion contracts

**Files:**
- Modify: `scripts/test_public_ui_regressions.js`
- Modify: `scripts/test_brand_feed.js`
- Modify: `tests/public-site.spec.js`
- Delete: `scripts/test_projects_renderer.js`
- Delete: `scripts/render_projects.js`
- Delete: `assets/projects.json`
- Modify: `.github/workflows/public-site-security.yml`

**Interfaces:**
- Consumes: existing four home files, `assets/brand-site.js`, existing Playwright server.
- Produces: static contracts for `.manifesto-bubble`, `[data-typewriter]`, `.device-stage`, two `[data-game-preview]` videos, `HD` header treatment, and Korean canonical blog links.

- [ ] **Step 1: Replace obsolete project-catalog assertions with the new home contract**

Add a test equivalent to:

```js
test("home leads with the approved statement and two real game previews", () => {
  const expected = {
    "index.html": ["AI를 사용하지만,", "사람냄새 나는 게임과 소프트웨어,", "그리고 개발 일기를 보여주는 웹사이트"],
    "index_en.html": ["We use AI,", "but make games and software that still feel human,", "and show the development journal behind them."],
    "index_de.html": ["Wir nutzen KI,", "entwickeln aber Spiele und Software mit menschlicher Handschrift,", "und zeigen das Entwicklungstagebuch dahinter."],
    "index_ja.html": ["AIを使いながらも、", "人の温度があるゲームとソフトウェア、", "そして開発日記を見せるウェブサイトです。"],
  };
  for (const [file, lines] of Object.entries(expected)) {
    const html = read(file);
    assert.match(html, /class="manifesto-bubble/);
    assert.match(html, /data-typewriter/);
    for (const line of lines) assert.ok(html.includes(line), `${file}: ${line}`);
    assert.equal((html.match(/data-game-preview/g) || []).length, 2, `${file} game previews`);
    assert.doesNotMatch(html, /European Restroom Map|project-compact-grid|PROJECT_CATALOG/);
    assert.ok(html.indexOf("manifesto-bubble") < html.indexOf("data-post-feed"));
  }
});
```

- [ ] **Step 2: Add feed-link and no-JavaScript contracts**

Extend `scripts/test_brand_feed.js` so Korean cards use `original_url` and translated cards keep the localized mirror:

```js
assert.match(koreanCards, /href="https:\/\/blog\.houseduck\.in\/entry\/post"/);
assert.match(germanCards, /href="https:\/\/houseduck\.in\/blog\/de\/post\/"/);
```

Assert the authored statement remains in the HTML source and `.reveal` is not hidden by its default CSS state.

- [ ] **Step 3: Replace the old Playwright phone test**

Test two visible videos, the bubble direction, device hardware details, and the next blog section:

```js
test("home statement points to two playable phone previews", async ({ page }) => {
  await page.goto("/?lang=ko");
  await expect(page.locator(".manifesto-bubble")).toContainText("사람냄새 나는 게임과 소프트웨어");
  await expect(page.locator("[data-game-preview]")).toHaveCount(2);
  await expect(page.locator(".phone-side-button")).toHaveCount(4);
  await expect(page.locator(".phone-home-indicator")).toHaveCount(2);
  await expect(page.locator("[data-section='blog-posts']")).toBeVisible();
});
```

- [ ] **Step 4: Remove the obsolete renderer from CI**

Delete the renderer, its data and test, then remove only this workflow command:

```yaml
node scripts/render_projects.js --check
```

- [ ] **Step 5: Run the targeted tests and confirm RED**

Run:

```bash
node scripts/test_public_ui_regressions.js
node scripts/test_brand_feed.js
npx playwright test tests/public-site.spec.js
```

Expected: failures for missing new homepage markup and the Korean source-link behavior; no parser crash.

---

### Task 2: Build the shared HD mark, statement hero, game previews, and native motion

**Files:**
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `assets/studio-home.css`
- Modify: `assets/brand-site.css`
- Modify: `assets/brand-site.js`
- Modify: `assets/blog-mirror.css`
- Modify: `assets/blog-mirror.js`

**Interfaces:**
- Consumes: `buildPostCards(posts, locale)`, existing menu/theme/language handling, existing Quirky Ball MP4/poster.
- Produces: `typewriterDelay(character): number`, `animateInView(nodes): void`, `managePreviewPlayback(videos): void`, and the two authored phone-preview DOM structures.

- [ ] **Step 1: Make Korean cards use the original Tistory URL**

Change the link selection in `buildPostCards`:

```js
var link = safeHttpsUrl(locale === "ko" ? post.original_url : (localized.url || post.url));
```

Keep the current safe-HTTPS rejection and authored fallback behavior.

- [ ] **Step 2: Add the accessible typewriter helper**

Add and export the punctuation timing function, then type only the visual line nodes:

```js
function typewriterDelay(character) {
  if (character === "," || character === "、") return 180;
  return 40;
}

function runTypewriter(rootNode) {
  if (!rootNode || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var lines = Array.from(rootNode.querySelectorAll("[data-type-line]"));
  var queue = lines.flatMap(function (line, lineIndex) {
    var textValue = line.textContent;
    line.textContent = "";
    return Array.from(textValue).map(function (character) {
      return { line: line, character: character, pause: typewriterDelay(character) };
    }).concat(lineIndex < lines.length - 1 ? [{ pause: 140 }] : []);
  });
  var index = 0;
  function next() {
    var item = queue[index++];
    if (!item) {
      rootNode.dataset.typed = "true";
      return;
    }
    if (item.line) item.line.append(item.character);
    window.setTimeout(next, item.pause);
  }
  next();
}
```

The parent keeps a complete localized `aria-label`, so screen readers do not announce each character.

- [ ] **Step 3: Replace hide-until-intersection with visible-first animation**

Remove the `.js-ready .reveal` rule that sets `opacity: 0` and `transform: translateY(18px)`. Animate visible nodes without changing their resting CSS:

```js
function animateInView(nodes) {
  if (!("IntersectionObserver" in window) || !Element.prototype.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.animate(
        [{ opacity: 0.01, filter: "blur(7px)", transform: "translateY(10px)" }, { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }],
        { duration: 420, easing: "cubic-bezier(.2,.75,.2,1)", fill: "both" }
      );
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -6%", threshold: 0.08 });
  nodes.forEach(function (node) { observer.observe(node); });
}
```

Use the same short keyframes in `assets/blog-mirror.js` for blog cards/article sections.

- [ ] **Step 4: Pause off-screen previews and respect data-saving preferences**

```js
function managePreviewPlayback(videos) {
  var saveData = navigator.connection && navigator.connection.saveData;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (saveData || reduced || !("IntersectionObserver" in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.play().catch(function () {});
      else entry.target.pause();
    });
  }, { threshold: 0.35 });
  videos.forEach(function (video) { observer.observe(video); });
}
```

- [ ] **Step 5: Replace each home body with the approved compact structure**

Use this structure in all four locale files with localized `aria-label`, text and links:

```html
<section class="manifesto-hero container" aria-labelledby="studio-title">
  <div class="manifesto-bubble reveal">
    <h1 id="studio-title" data-typewriter aria-label="AI를 사용하지만, 사람냄새 나는 게임과 소프트웨어, 그리고 개발 일기를 보여주는 웹사이트">
      <span data-type-line>AI를 사용하지만,</span>
      <span data-type-line>사람냄새 나는 게임과 소프트웨어,</span>
      <span data-type-line>그리고 개발 일기를 보여주는 웹사이트</span>
    </h1>
    <span class="type-cursor" aria-hidden="true"></span>
  </div>
  <div class="device-stage reveal" id="games" aria-label="현재 제작 중인 게임">
    <a class="game-device game-device-quirky" href="quirky-ball/?lang=ko">
      <span class="game-device-label">Quirky Ball</span>
      <span class="iphone-shell">
        <span class="phone-side-button phone-side-button-top"></span><span class="phone-side-button phone-side-button-bottom"></span>
        <span class="phone-camera" aria-hidden="true"></span>
        <video data-game-preview autoplay muted loop playsinline preload="metadata" poster="assets/media/quirky-ball-gameplay-poster.jpg"><source src="assets/media/quirky-ball-gameplay.mp4" type="video/mp4"></video>
        <span class="phone-home-indicator" aria-hidden="true"></span>
      </span>
    </a>
    <a class="game-device game-device-k" href="project-k/?lang=ko">
      <span class="game-device-label">Project K</span>
      <span class="iphone-shell">
        <span class="phone-side-button phone-side-button-top"></span><span class="phone-side-button phone-side-button-bottom"></span>
        <span class="phone-camera" aria-hidden="true"></span>
        <video data-game-preview autoplay muted loop playsinline preload="metadata" poster="assets/media/project-k-highlight-poster.jpg"><source src="assets/media/project-k-highlight.mp4" type="video/mp4"></video>
        <span class="phone-home-indicator" aria-hidden="true"></span>
      </span>
    </a>
  </div>
</section>
```

Each phone contains two `.phone-side-button` spans, a camera island, a home indicator, a muted looping inline video, game label, and detail link. Remove the old intro buttons and full project grid.

- [ ] **Step 6: Draw the speech bubble, tail, full iPhone hardware, and HD header mark in CSS**

Use CSS pseudo-elements for the tail and hardware shell. The tail is on `.manifesto-bubble::after`, placed at the right edge on desktop and lower edge on mobile. Replace header imagery visually with:

```css
.brand-lockup::before {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  content: "HD";
  color: var(--paper);
  background: var(--navy);
  border-radius: 14px 14px 14px 5px;
  font-weight: 900;
  transform: rotate(-8deg);
}
.brand-lockup .brand-duck-image,
.brand-lockup .brand-wordmark-image { display: none; }
```

Keep the speech bubble visually restrained: one neutral border, no hand-drawn red outline, no infinite floating animation.

- [ ] **Step 7: Run Task 1 tests and commit**

Run:

```bash
node scripts/test_public_ui_regressions.js
node scripts/test_brand_feed.js
npx playwright test tests/public-site.spec.js
git diff --check
```

Expected: all homepage/feed tests PASS.

Commit only Task 1 and Task 2 files:

```bash
git add .github/workflows/public-site-security.yml index.html index_en.html index_de.html index_ja.html assets/brand-site.css assets/brand-site.js assets/studio-home.css assets/blog-mirror.css assets/blog-mirror.js scripts/test_public_ui_regressions.js scripts/test_brand_feed.js tests/public-site.spec.js scripts/test_projects_renderer.js scripts/render_projects.js assets/projects.json
git commit -m "feat(site): lead with games and development journal"
```

---

### Task 3: Add the four-locale About timeline

**Files:**
- Create: `about/index.html`
- Create: `about/index_en.html`
- Create: `about/index_de.html`
- Create: `about/index_ja.html`
- Create: `assets/about-site.css`
- Modify: `sitemap.xml`
- Modify: `scripts/test_public_ui_regressions.js`
- Modify: `tests/public-site.spec.js`

**Interfaces:**
- Consumes: common header/footer, `.hd-mark` treatment, `.reveal`, theme/language/menu code.
- Produces: `/about/` and three alternate-language pages with four stable `[data-timeline-item]` entries.

- [ ] **Step 1: Add failing About structure tests**

```js
for (const file of ["about/index.html", "about/index_en.html", "about/index_de.html", "about/index_ja.html"]) {
  const html = read(file);
  assert.match(html, /data-page="about"/);
  assert.equal((html.match(/data-timeline-item/g) || []).length, 4);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /hreflang="ko"/);
  assert.doesNotMatch(html, /European Restroom Map|Restroom|Toilet Map/);
}
```

Run `node scripts/test_public_ui_regressions.js`; expect missing-file failure.

- [ ] **Step 2: Create localized About pages**

Use four public milestones only:

1. `2026 · House Duck 1인 스튜디오 시작`
2. `첫 게임 · Quirky Ball 출시 준비`
3. `제작 중 · Project K`
4. `다음 목표 · Quirky Ball 출시 후 실제 지표로 개선`

Translate them naturally for EN/DE/JA, preserve the four-item count, and link each game name to its local detail page. Do not include private, operational or unannounced app information.

- [ ] **Step 3: Add the vertical timeline CSS**

Create one left rule, one active dot per item, compact cards, and mobile-safe spacing. Use `.reveal` for the shared animation and keep the rule/content visible without JavaScript.

- [ ] **Step 4: Add About URLs to the sitemap**

Add four entries with `lastmod` `2026-08-11`, including `/about/`, `/about/index_en.html`, `/about/index_de.html`, and `/about/index_ja.html`.

- [ ] **Step 5: Run and commit**

Run:

```bash
node scripts/test_public_ui_regressions.js
npx playwright test tests/public-site.spec.js
bash scripts/check_public_repo.sh
git diff --check
```

Commit:

```bash
git add about assets/about-site.css sitemap.xml scripts/test_public_ui_regressions.js tests/public-site.spec.js
git commit -m "feat(site): add public House Duck timeline"
```

---

### Task 4: Capture and publish current Project K media

**Files:**
- Create: `assets/media/project-k-highlight.mp4`
- Create: `assets/media/project-k-highlight-poster.jpg`
- Replace: `project-k/media/title.png`
- Replace: `project-k/media/decision.png`
- Replace: `project-k/media/world.png`
- Replace: `project-k/media/farm.png`
- Replace: `project-k/media/dialogue.png`
- Replace: `project-k/media/coronation.png`
- Modify: `project-k/index.html`
- Modify: `project-k/index_en.html`
- Modify: `project-k/index_de.html`
- Modify: `project-k/index_ja.html`
- Modify: `assets/project-k-site.css`
- Modify: `scripts/test_brand_catalog.js`

**Interfaces:**
- Consumes: Project K stable commit `064f492`, `scripts_dev/capture_map_first_loop.tscn`, `scripts_dev/qa_p56_campaign_capture.tscn`, and verified 2026-08-10 QA PNGs.
- Produces: muted 540×1200 H.264 MP4, JPEG poster, six current public screenshots, and updated Project K Open Graph/media markup.

- [ ] **Step 1: Create an isolated Project K capture worktree**

```bash
PK_CAPTURE_DIR=$(mktemp -d /tmp/project-k-web-capture.XXXXXX)
git -C "/Users/junheechoi/projects/houseduck/Project K" worktree add --detach "$PK_CAPTURE_DIR" 064f492
```

Record the resulting path. Never run `git clean` or modify the shared Project K checkout.

- [ ] **Step 2: Record real runtime sequences with Godot Movie Writer**

```bash
PROJECT_K_CAPTURE_LOCALE=ko PROJECT_K_CAPTURE_SIZE=540x1200 \
  /Applications/Godot.app/Contents/MacOS/Godot --path "$PK_CAPTURE_DIR" \
  --write-movie /tmp/project-k-map.avi --fixed-fps 30 \
  res://scripts_dev/capture_map_first_loop.tscn

/Applications/Godot.app/Contents/MacOS/Godot --path "$PK_CAPTURE_DIR" \
  --write-movie /tmp/project-k-war.avi --fixed-fps 30 \
  res://scripts_dev/qa_p56_campaign_capture.tscn
```

Expected: both commands exit 0 and both AVI files contain non-zero video frames.

- [ ] **Step 3: Inspect frame contact sheets and cut the clearest ten seconds**

```bash
ffmpeg -y -i /tmp/project-k-map.avi -vf "fps=2,scale=270:-1,tile=5x4" -frames:v 1 /tmp/project-k-map-sheet.jpg
ffmpeg -y -i /tmp/project-k-war.avi -vf "fps=2,scale=270:-1,tile=5x4" -frames:v 1 /tmp/project-k-war-sheet.jpg
```

Use the sheets to retain map/vehicle/farm movement and war advance. Join the selected actual-runtime segments with 0.12-second `xfade` transitions, scale to 540×1200, remove audio, encode H.264/yuv420p, and stop at 10 seconds. The final ffmpeg invocation must include:

```bash
-vf "scale=540:1200:force_original_aspect_ratio=decrease,pad=540:1200:(ow-iw)/2:(oh-ih)/2:black" \
-t 10 -an -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart
```

Save as `assets/media/project-k-highlight.mp4` and export its strongest frame as `assets/media/project-k-highlight-poster.jpg`.

- [ ] **Step 4: Copy only current verified screenshots**

Map the current QA outputs to the six public filenames:

- `title.png` ← `qa_output/vertical_war_2026-08-09/02_title_new_game_ready.png`
- `decision.png` ← `qa_output/dialogue_stage/07_choice_salute.png`
- `world.png` ← `qa_output/map_first_loop_2026-08-04/1080x2400/ko/01_map_start.png`
- `farm.png` ← `qa_output/map_first_loop_2026-08-04/1080x2400/ko/09_farm_ready.png`
- `dialogue.png` ← `qa_output/dialogue_stage/00_two_actor.png`
- `coronation.png` ← `qa_output/vertical_war_2026-08-09/05_war_units_advance.png`

Copy from the isolated worktree or the unchanged verified QA output; do not edit Project K.

- [ ] **Step 5: Update Project K pages and home media references**

Use the new poster for `og:image`, replace stale captions with accurate current-screen captions, and ensure all four pages say `Blog`, not `Journal`. Keep the in-development status and do not claim release readiness.

- [ ] **Step 6: Validate media and commit**

Run:

```bash
ffprobe -v error -show_entries stream=width,height,duration,codec_name -of json assets/media/project-k-highlight.mp4
node scripts/test_brand_catalog.js
bash scripts/check_brand_site.sh
npx playwright test tests/public-site.spec.js
git diff --check
```

Expected video: H.264, 540×1200, 9.5–10.1 seconds, no audio stream.

Remove the temporary worktree safely:

```bash
git -C "/Users/junheechoi/projects/houseduck/Project K" worktree remove "$PK_CAPTURE_DIR"
```

Commit only site media/pages/tests:

```bash
git add assets/media/project-k-highlight.mp4 assets/media/project-k-highlight-poster.jpg project-k/media project-k/index.html project-k/index_en.html project-k/index_de.html project-k/index_ja.html assets/project-k-site.css scripts/test_brand_catalog.js
git commit -m "feat(site): refresh Project K showcase"
```

---

### Task 5: Full browser QA and deletion-focused polish

**Files:**
- Modify only if a verified defect requires it: `assets/studio-home.css`, `assets/brand-site.css`, `assets/about-site.css`, `assets/project-k-site.css`, `assets/brand-site.js`, `assets/blog-mirror.css`, `assets/blog-mirror.js`, affected HTML/tests.

**Interfaces:**
- Consumes: completed home, About, blog, and Project K media work.
- Produces: verified desktop/mobile/reduced-motion/no-JavaScript behavior with no unrelated changes.

- [ ] **Step 1: Run the complete existing checks**

```bash
bash scripts/check_public_repo.sh
bash scripts/check_brand_site.sh
bash scripts/check_legal_site.sh
node scripts/test_public_ui_regressions.js
node scripts/test_brand_catalog.js
node scripts/test_brand_feed.js
npm run test:blog-security
npm run test:e2e
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 2: Inspect 1440×900 and 390×844 screenshots**

Capture home, About, Quirky Ball, Project K and blog list in Korean and one translated locale. Verify:

- full statement fits and types once;
- bubble tail visibly points to the phone cluster;
- both phones show side buttons, camera island and home indicator;
- blog heading follows within one short scroll;
- no horizontal overflow or blank reveal regions;
- Project K media is current and legible;
- touch targets remain at least 44×44 CSS pixels.

- [ ] **Step 3: Verify fallbacks**

Use Playwright contexts with reduced motion and JavaScript disabled. Abort the blog-feed JSON and both MP4 requests. Confirm full copy, fallback blog card, posters and detail links remain visible.

- [ ] **Step 4: Fix only observed defects and rerun the smallest affected check**

Delete redundant decoration or spacing before adding new elements. Do not alter the console or Project K working tree.

- [ ] **Step 5: Final state audit and commit**

```bash
git status --short
git diff --stat HEAD~3..HEAD
```

Confirm `console/analytics.js` remains the same pre-existing modification and no Project K shared-worktree file changed. Commit any final narrow polish with:

```bash
git add assets/studio-home.css assets/brand-site.css assets/about-site.css assets/project-k-site.css assets/brand-site.js assets/blog-mirror.css assets/blog-mirror.js index.html index_en.html index_de.html index_ja.html about project-k scripts/test_public_ui_regressions.js scripts/test_brand_catalog.js scripts/test_brand_feed.js tests/public-site.spec.js sitemap.xml
git commit -m "fix(site): finish responsive motion polish"
```
