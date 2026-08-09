# House Duck Global Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Tistory posts as a real home-page feed and zero-fee crawlable Korean, English, German, and Japanese static mirrors while unifying House Duck public-page visuals.

**Architecture:** A scheduled GitHub Action runs a tested RSS synchronizer. The synchronizer writes same-origin feed JSON, sanitized static article mirrors, and sitemap entries; Argos Translate supplies offline translations in automation. Existing shared CSS and JavaScript carry the visual refresh across the home and document pages, while the Tistory skin receives focused typography and injected-widget overrides.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node.js RSS generator, Python Argos Translate adapter in CI, GitHub Actions/Pages, Tistory skin templates

## Global Constraints

- Keep Tistory as the Korean authoring source.
- Use `/blog/kr/`, `/blog/en/`, `/blog/de/`, and `/blog/ja/`; use `ko` only in `lang` and `hreflang` metadata.
- Add no paid API, database, frontend framework, or runtime proxy.
- Preserve legal copy and the unrelated `console/analytics.js` worktree change.
- Respect `prefers-reduced-motion`, keyboard focus, responsive media, and dark/light themes.

---

### Task 1: RSS synchronization contract

**Files:**
- Create: `scripts/blog-sync.mjs`
- Create: `scripts/test_blog_sync.mjs`
- Create: `scripts/fixtures/tistory-rss.xml`
- Create: `assets/blog-feed.json`

**Interfaces:**
- Produces: `parseRss(xml)`, `buildOutputs(posts, translations)`, and CLI options `--rss`, `--out-root`, `--translations`.
- Output feed shape: `{ "updated_at": string, "posts": [{ "slug", "title", "summary", "image", "published_at", "url" }] }`.

- [ ] Write a fixture-driven test that expects one post, a rewritten custom-domain URL, sanitized body, feed JSON, and `/blog/kr/<slug>/index.html`.
- [ ] Run `node scripts/test_blog_sync.mjs` and verify failure because the synchronizer does not exist.
- [ ] Implement the minimum dependency-free XML/entity parser and static-page renderer.
- [ ] Run the test and verify it passes.

### Task 2: Crawlable translations and automation

**Files:**
- Create: `scripts/translate_blog.py`
- Create: `.github/workflows/sync-blog.yml`
- Modify: `scripts/blog-sync.mjs`
- Modify: `sitemap.xml`
- Modify: `robots.txt`

**Interfaces:**
- `translate_blog.py --input <json> --output <json>` returns cached translations keyed by post source hash and locale.
- `blog-sync.mjs --translations <json>` emits `kr`, `en`, `de`, and `ja` mirrors with self canonicals and reciprocal hreflang links.

- [ ] Extend the fixture test to require all four locale pages and sitemap URLs.
- [ ] Run the test and verify failure for missing localized output.
- [ ] Add translation-cache input and localized rendering; keep original text when a test translation is absent only for `kr`.
- [ ] Add an Argos adapter that installs/uses `ko→en`, `en→de`, and `en→ja` packages and preserves the last good cache on failure.
- [ ] Add the scheduled/manual workflow, content-change commit guard, and Pages-compatible permissions.
- [ ] Run fixture tests and a live RSS Korean-only sync; verify output before enabling live translations.

### Task 3: Real home-page feed

**Files:**
- Modify: `assets/brand-site.js`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `scripts/test_brand_catalog.js`

**Interfaces:**
- `renderPostFeed(documentRef, feed, locale)` replaces `[data-post-panel="latest"]` content and links each locale to its mirror.

- [ ] Add a DOM-light test around the feed-to-card renderer using literal feed data and expected locale URLs.
- [ ] Run the test and verify failure because the renderer is absent.
- [ ] Implement same-origin fetch, card rendering, localized dates/labels, and retained error fallback.
- [ ] Run feed and brand tests to green.

### Task 4: Studio motion and document themes

**Files:**
- Modify: `assets/studio-home.css`
- Modify: `assets/legal-site.css`
- Modify: `assets/legal-site.js`
- Modify: `scripts/test_legal_site.js`
- Modify: `scripts/test_brand_catalog.js`

**Interfaces:**
- `legal-site.js` reuses `house_duck_theme` and injects one accessible `[data-theme-toggle]` button into each legal header.

- [ ] Add behavior tests for theme initialization/toggling and existing table-of-contents output.
- [ ] Run tests and verify the new theme contract fails.
- [ ] Enlarge/align the wordmark, add CSS-only ambient motion with reduced-motion fallback, and restyle shared documents with the real logo.
- [ ] Implement the minimal shared legal theme control and run tests to green.

### Task 5: Tistory live reader corrections

**Files:**
- Modify: `tistory-skin/skin.html`
- Modify: `tistory-skin/style.css`
- Modify: `tistory-skin/images/script.js`
- Modify: `scripts/test_tistory_skin.js`

**Interfaces:**
- The skin exposes a localized-mirror notice and original link without redirecting crawlers.
- CSS targets `.tt_box_namecard`, `.tt-comment-cont`, and their native controls in both themes.

- [ ] Add skin tests for practical title sizing, device-language mirror discovery, translation/original controls, and injected widget theme selectors.
- [ ] Run the skin test and verify failure against the current skin.
- [ ] Implement title sizing, namecard/comment overrides, and mirror discovery.
- [ ] Paste updated HTML/CSS/JS through Tistory administration and apply.
- [ ] Verify the live post in desktop/mobile and dark/light modes.

### Task 6: Deployment, Search Console, and full verification

**Files:**
- Modify if generated: `sitemap.xml`, `assets/blog-feed.json`, `blog/**`

**Interfaces:**
- Deployed sitemap URL: `https://houseduck.in/sitemap.xml`.

- [ ] Run `bash scripts/check_public_repo.sh --all`, brand/legal/skin tests, Node syntax checks, XML validation, and `git diff --check`.
- [ ] Commit only scoped files, push `main`, and wait for Pages/security workflows.
- [ ] Verify live home feed, locale mirrors, sitemap, dark/light document pages, and Tistory reader DOM.
- [ ] Open Google Search Console, submit `sitemap.xml` when the authenticated property permits it, and verify the submission state; otherwise provide the exact remaining click path.
