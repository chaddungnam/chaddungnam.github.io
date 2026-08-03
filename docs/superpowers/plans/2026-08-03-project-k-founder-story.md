# Project K · Founder Story Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Project K and the House Duck founder story to the public catalog with Korean, English, German, and Japanese pages, automatic device-language routing, a shared header language picker, and distortion-free real game imagery.

**Architecture:** Keep the existing static HTML/CSS/vanilla-JavaScript site. Extend the current `brand-site.js` routing IIFE, reuse `brand-site.css` for House Duck and story surfaces, and add one focused `project-k-site.css` for the game-specific palette. Every localized page remains a complete semantic HTML document so content works without JavaScript.

**Tech Stack:** Static HTML5, CSS, vanilla JavaScript, Node.js standard-library contract tests, existing shell scripts.

## Global Constraints

- Supported marketing locales are exactly `ko`, `en`, `de`, and `ja`; unsupported device languages fall back to English.
- Language priority is URL `?lang=` > saved manual choice > first supported entry in `navigator.languages` > English.
- The shared header language picker appears on home, Quirky Ball, Project K, and founder-story pages.
- Project K public copy uses `풍자 국가경영 시뮬레이션` and `2026년 하반기–2027년 상반기 공개 목표`; it does not advertise `세로형` or an unconfirmed campaign length.
- All Project K visuals come from the real client captures listed in Task 2; no AI-generated people or invented gameplay images.
- Images preserve their intrinsic ratio. Default CSS is `width: 100%; height: auto; object-fit: contain`; framed crops use a fixed wrapper plus `object-fit: cover` only.
- Do not modify legal-policy wording, console, analytics, or the unrelated dirty files in the main worktree.
- Add no framework, package manager, external font, icon library, tracking, or runtime dependency.

---

### Task 1: Four-Language Routing and Header Picker

**Files:**
- Modify: `assets/brand-site.js`
- Modify: `assets/brand-site.css`
- Create: `scripts/test_brand_language.js`
- Modify: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: `<html data-locale="ko|en|de|ja">` and header links carrying `data-lang-link="ko|en|de|ja"`.
- Produces: automatic same-directory routing to `index.html`, `index_en.html`, `index_de.html`, or `index_ja.html`; saved key `house_duck_site_language`; reusable `.language-picker` markup styles.

- [ ] **Step 1: Write the failing language-routing test**

Create a Node `vm` harness that executes `assets/brand-site.js` with stubbed `window`, `document`, `navigator`, and `localStorage`. Assert these exact cases:

```js
assert.equal(run({ locale: "ko", languages: ["de-DE"] }).replace, "index_de.html");
assert.equal(run({ locale: "ko", languages: ["fr-FR", "ja-JP"] }).replace, "index_ja.html");
assert.equal(run({ locale: "ko", languages: ["fr-FR"] }).replace, "index_en.html");
assert.equal(run({ locale: "en", saved: "de", languages: ["ko-KR"] }).replace, "index_de.html");
assert.equal(run({ locale: "de", query: "?lang=ja", saved: "de" }).replace, "index_ja.html");
assert.equal(run({ locale: "ja", query: "?lang=ja" }).replace, "");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/test_brand_language.js`

Expected: FAIL because `de`/`ja` routing and generic locale filenames do not exist in the current script.

- [ ] **Step 3: Implement the minimal locale resolver in the existing IIFE**

Use these internal functions in `assets/brand-site.js`:

```js
var supportedLanguages = ["ko", "en", "de", "ja"];
function normalizeLanguage(value) {
  var language = String(value || "").toLowerCase().split("-")[0];
  return supportedLanguages.indexOf(language) >= 0 ? language : "";
}
function languageFile(language) {
  return language === "ko" ? "index.html" : "index_" + language + ".html";
}
```

Resolve URL, storage, and `navigator.languages` in the global-priority order. Call `window.location.replace(languageFile(target))` only when `target !== document.documentElement.dataset.locale`. Preserve the existing menu, reveal animation, year, and blocked-storage fallbacks.

Style a native `<details class="language-picker">` in the existing header. The summary shows the active two-letter code; its panel contains four ordinary links with `data-lang-link`. Maintain 44px targets, keyboard focus, mobile nav containment, and no JavaScript-only dependency.

- [ ] **Step 4: Run focused and existing tests**

Run:

```bash
node scripts/test_brand_language.js
bash scripts/check_brand_site.sh
```

Expected: language model PASS and existing brand contract PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/brand-site.js assets/brand-site.css scripts/test_brand_language.js scripts/check_brand_site.sh
git commit -m "feat(site): add four-language routing"
```

### Task 2: Project K Real Assets and Localized Detail Pages

**Files:**
- Create: `project-k/media/title.png`
- Create: `project-k/media/coronation.png`
- Create: `project-k/media/decision.png`
- Create: `project-k/media/world.png`
- Create: `project-k/media/farm.png`
- Create: `project-k/media/dialogue.png`
- Create: `project-k/media/README.md`
- Create: `project-k/index.html`
- Create: `project-k/index_en.html`
- Create: `project-k/index_de.html`
- Create: `project-k/index_ja.html`
- Create: `assets/project-k-site.css`
- Create: `scripts/test_brand_catalog.js`

**Interfaces:**
- Consumes: real 720×1280 captures from `/Users/junheechoi/projects/houseduck/Project K/qa_output/`; shared `brand-site.css`, `brand-site.js`, and language-picker contract from Task 1.
- Produces: `/project-k/` in four languages with `data-page="project-k"`, `[data-project-k-asset]` images, genre/release metadata, core-loop sections, and House Duck navigation.

- [ ] **Step 1: Write the failing catalog contract**

Create a Node standard-library test that verifies all four Project K files exist and each contains:

```js
assert.match(html, /data-page="project-k"/);
assert.match(html, /class="language-picker"/);
assert.match(html, /data-project-k-asset/);
assert.match(html, /2026[^<]*(2027|27)/);
assert.doesNotMatch(publicText, /세로형/);
```

Also parse each `[data-project-k-asset]` source and assert the PNG exists, is 720×1280, and the HTML attributes are `width="720" height="1280"`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/test_brand_catalog.js`

Expected: FAIL because `project-k/` does not exist.

- [ ] **Step 3: Copy the approved client captures with provenance**

Copy exactly:

```text
qa_output/release_slice/boot_02_project_k.png                         -> project-k/media/title.png
qa_output/all_content_2026-08-03/04_coronation__02_leader_oath.png  -> project-k/media/coronation.png
qa_output/all_content_2026-08-03/07_meeting__03_stamp.png           -> project-k/media/decision.png
qa_output/all_content_2026-08-03/08_world__02_globe.png             -> project-k/media/world.png
qa_output/all_content_2026-08-03/10_farm__02_interaction.png        -> project-k/media/farm.png
qa_output/all_content_2026-08-03/28_dialogue_showcase__01_two_party.png -> project-k/media/dialogue.png
```

Record source paths, capture date, 720×1280 dimensions, and “real macOS Metal client capture; not Android/iOS device proof” in `project-k/media/README.md`.

- [ ] **Step 4: Build the four semantic Project K pages**

Each page uses the same section order:

```html
<body class="project-k-page" data-page="project-k">
  <header class="site-header project-k-header">
    <a class="brand-lockup" href="../?lang=ko">HOUSE DUCK</a>
  </header>
  <main id="main-content">
    <section class="project-k-hero"><h1>한 번의 결재가 나라를 웃기게도, 위태롭게도 만듭니다.</h1></section>
    <section class="project-k-loop" aria-labelledby="loop-title"><h2 id="loop-title">당신의 선택이 나라의 다음 장면을 만듭니다.</h2></section>
    <section class="project-k-gallery" aria-labelledby="gallery-title"><h2 id="gallery-title">선전 너머의 현장</h2></section>
    <section class="project-k-release" aria-labelledby="release-title"><h2 id="release-title">2026년 하반기–2027년 상반기 공개 목표</h2></section>
  </main>
</body>
```

Use the approved promise “한 번의 결재가 나라를 웃기게도, 위태롭게도 만듭니다.” and natural EN/DE/JA localization. Label the product `Project K · Working title`, status `In development`, genre `Satirical nation-management simulation`, and release window as a target rather than a guarantee.

In `assets/project-k-site.css`, use only charcoal/ink, dark olive, crimson, paper, and gold sampled from the client. Give screenshot frames an explicit 9/16 ratio; never assign unequal width and height directly to the image.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node scripts/test_brand_catalog.js
bash scripts/check_brand_site.sh
```

Expected: catalog and brand contracts PASS.

- [ ] **Step 6: Commit**

```bash
git add project-k assets/project-k-site.css scripts/test_brand_catalog.js scripts/check_brand_site.sh
git commit -m "feat(site): add Project K showcase"
```

### Task 3: Founder Story, Two-Game Home, and Quirky Ball Locales

**Files:**
- Create: `story/index.html`
- Create: `story/index_en.html`
- Create: `story/index_de.html`
- Create: `story/index_ja.html`
- Modify: `index.html`
- Modify: `index_en.html`
- Create: `index_de.html`
- Create: `index_ja.html`
- Modify: `quirky-ball/index.html`
- Modify: `quirky-ball/index_en.html`
- Create: `quirky-ball/index_de.html`
- Create: `quirky-ball/index_ja.html`
- Modify: `assets/brand-site.css`
- Modify: `scripts/test_brand_catalog.js`
- Modify: `sitemap.xml`

**Interfaces:**
- Consumes: shared locale filenames/picker from Task 1 and Project K routes/media from Task 2.
- Produces: four-locale home, Quirky Ball, and founder-story pages; two-game catalog links; localized `hreflang` sets and sitemap entries.

- [ ] **Step 1: Extend the catalog test and verify RED**

For all 16 marketing pages (four locales × home, Quirky Ball, Project K, story), assert:

```js
assert.match(html, /data-locale="(ko|en|de|ja)"/);
assert.equal((html.match(/data-lang-link=/g) || []).length, 4);
assert.match(html, /hreflang="ko"/);
assert.match(html, /hreflang="en"/);
assert.match(html, /hreflang="de"/);
assert.match(html, /hreflang="ja"/);
```

For story pages, assert the localized page preserves the facts `1998`, industrial design, three years of game-company experience, Korea-to-Germany, and House Duck. For home pages, assert links to both `/quirky-ball/` and `/project-k/` plus `/story/`. For every content `<img>`, verify declared dimensions match the PNG header ratio.

Run: `node scripts/test_brand_catalog.js`

Expected: FAIL on missing DE/JA and story documents.

- [ ] **Step 2: Build the four founder-story pages**

Use a typographic editorial structure, not a wall of text:

```html
<section class="story-hero"><h1>게임을 고치던 사람이, 이제 자신의 게임을 만듭니다.</h1></section>
<ol class="story-timeline">
  <li><strong>1998</strong><span>Korea</span></li>
  <li><strong>Design</strong><span>Industrial design</span></li>
  <li><strong>3 years</strong><span>Game companies from N-company to startups</span></li>
  <li><strong>Germany</strong><span>A new language and a new beginning</span></li>
</ol>
<blockquote class="story-quote">서당개도 3년이면 풍월을 읊는다고 했습니다. 저는 그 풍월을 제 게임으로 증명하기로 했습니다.</blockquote>
<section class="story-manifesto"><h2>Small games. Big personality.</h2></section>
```

Use the approved narrative. Describe previous companies collectively without disclosing confidential detail or claiming revenue, investment, or unverified achievements. Translate the Korean proverb by explaining its meaning naturally in EN/DE/JA instead of literal word substitution.

- [ ] **Step 3: Convert the home into a two-game catalog in four locales**

Keep the current House Duck hero. Replace `Featured game` singular framing with a two-card `Our games` catalog: retain the real Quirky Ball store imagery and add a dark Project K card using `project-k/media/decision.png` or `world.png`. Add Story to the main nav and replace the Quirky-only closing CTA with a founder-story CTA.

- [ ] **Step 4: Add German and Japanese Quirky Ball pages and the shared picker**

Translate the current Quirky Ball content without altering gameplay claims. Add the same four-link language picker and four `hreflang` links to all existing and new game-detail pages. Preserve every screenshot’s `1080×1920` attributes and current `height: auto; object-fit: contain` styling.

- [ ] **Step 5: Add responsive story/catalog styles and sitemap entries**

Extend `brand-site.css` with `.games-catalog`, `.project-k-card`, `.story-hero`, `.story-timeline`, `.story-quote`, and mobile rules. Reuse current tokens and breakpoints. Add all canonical localized marketing URLs to `sitemap.xml`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node scripts/test_brand_language.js
node scripts/test_brand_catalog.js
bash scripts/check_brand_site.sh
git diff --check
```

Expected: all PASS with no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add index*.html quirky-ball/index*.html story assets/brand-site.css scripts/test_brand_catalog.js sitemap.xml
git commit -m "feat(site): add founder story and four locales"
```

### Task 4: Responsive Visual QA, Full Regression, and Deployment

**Files:**
- Modify only files implicated by observed QA failures.
- Create screenshots outside Git under `/Users/junheechoi/.codex/visualizations/2026/08/02/019fc214-dc51-7be0-a3da-f35a417742e0/project-k-story-qa/`.

**Interfaces:**
- Consumes: complete static site from Tasks 1–3.
- Produces: screenshot-backed desktop/mobile evidence, clean commit history, updated `main`, and cache-busted live verification.

- [ ] **Step 1: Run a local HTTP server and browser matrix**

Use Chromium/Playwright against the local site. Check home, Quirky Ball, Project K, and story in all four locales at `1440×900`, `1440×760`, and `390×844`.

For every page assert:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Also assert zero page errors/console errors, four visible language options, working mobile menu, and each image’s rendered ratio differs from its natural ratio by less than `0.01` unless it is inside an explicitly cropped frame.

- [ ] **Step 2: Inspect screenshots and fix only observed defects**

Capture representative Korean desktop, German short-height desktop, Japanese mobile, and English Project K/story screens. Inspect typography, screenshot shape, menu containment, heading wrapping, text contrast, and first-viewport composition. Apply the smallest CSS/HTML correction and repeat the failing capture.

- [ ] **Step 3: Run the full repository regression**

Run:

```bash
bash scripts/check_brand_site.sh
bash scripts/check_legal_site.sh
node scripts/test_legal_site.js
bash scripts/check_policy_content.sh
bash scripts/check_public_repo.sh
node scripts/test_pulse_model.js
bash scripts/check_analytics_dashboard.sh
bash scripts/check_house_duck_console.sh
git diff --check
```

Expected: all applicable checks PASS; the analytics backend may retain its documented SKIP when `HOUSE_DUCK_GAME_DIR` is absent.

- [ ] **Step 4: Commit QA-only corrections**

```bash
git add assets/brand-site.css assets/project-k-site.css index*.html quirky-ball/index*.html project-k/index*.html story/index*.html
git commit -m "fix(site): polish responsive catalog pages"
```

Skip this commit when visual QA produces no code changes.

- [ ] **Step 5: Integrate without touching unrelated dirty files**

Confirm the main worktree’s legal-policy edits remain unchanged. Fast-forward `main` to `feat/project-k-story`, rerun the full regression from main, and push `main` to `origin` under the user’s existing Git authorization.

- [ ] **Step 6: Verify the live deployment**

Set `site_commit=$(git rev-parse --short HEAD)` and poll `https://houseduck.in/project-k/?v=$site_commit` plus `https://houseduck.in/story/?v=$site_commit` until the new Project K and story markers appear. Report the deployed commit separately from browser/device coverage. Do not call Chromium evidence Safari, Android, or iOS device proof.
