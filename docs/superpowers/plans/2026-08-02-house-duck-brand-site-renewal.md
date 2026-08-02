# House Duck Brand Site Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the House Duck and Quirky Ball Korean/English marketing pages as one premium, brand-first, responsive static site.

**Architecture:** Keep GitHub Pages and semantic static HTML. Four localized pages share one CSS file and one minimal JavaScript file; a shell contract script guards navigation, links, localization parity, accessibility hooks, and the no-CDN requirement.

**Tech Stack:** HTML5, CSS custom properties/Grid/Flexbox, vanilla JavaScript, Bash contract tests, local Montserrat and Do Hyeon fonts.

## Global Constraints

- House Duck is the primary brand; Quirky Ball is the first featured game.
- Reuse local fonts and all existing Quirky Ball marketing images.
- Add no framework, package manager, external CDN, external font, analytics tracker, or secret.
- Do not claim Google Play availability until a real store URL is configured.
- Korean and English pages must have the same information architecture.
- Preserve privacy, terms, support, analytics, CNAME, app-ads.txt, and language redirect behavior.
- Support keyboard focus, reduced motion, and 390px-wide screens without horizontal overflow.

---

### Task 1: Brand-site contract

**Files:**
- Create: `scripts/check_brand_site.sh`
- Modify: none
- Test: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: `index.html`, `index_en.html`, `quirky-ball/index.html`, `quirky-ball/index_en.html`
- Produces: exit code 0 and `brand site contract: PASS` when the four-page contract is complete

- [x] **Step 1: Write the failing contract test**

Create an executable Bash script that, for all four pages, requires `assets/brand-site.css`,
`assets/brand-site.js`, `data-site-nav`, `data-lang-link`, a skip link, `<main`, legal links, and
no `cdn.`, `fonts.googleapis.com`, `iconify`, or `tailwind`. Require House Duck pages to contain
`data-section="featured-game"` and `data-section="studio-values"`; require Quirky Ball pages to
contain `data-section="game-loop"`, `data-section="game-features"`, and `data-section="gallery"`.
Use `grep -Fq` for literal contracts and print one clear failure message per missing token.

- [x] **Step 2: Run the contract and verify it fails**

Run: `bash scripts/check_brand_site.sh`

Expected: non-zero exit because `assets/brand-site.css` and the new section markers do not exist.

- [x] **Step 3: Commit the red test**

```bash
git add scripts/check_brand_site.sh
git commit -m "test: define House Duck brand site contract"
```

---

### Task 2: Shared brand presentation and behavior

**Files:**
- Create: `assets/brand-site.css`
- Create: `assets/brand-site.js`
- Test: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: semantic class names and data attributes from all four HTML pages
- Produces: shared tokens, navigation, hero, cards, galleries, footer, responsive layout, reduced-motion behavior, language selection persistence, menu state, and current year

- [x] **Step 1: Create the shared CSS**

Define the approved cream/navy/coral/teal/gold tokens, local font stacks, reset, skip link,
sticky navigation, CSS duck mark, editorial hero, CTA, featured-game split card, value cards,
dark section, product hero, three-step loop, feature cards, screenshot frames, closing CTA, and
footer. Add breakpoints at 900px and 640px, `:focus-visible`, `prefers-reduced-motion`, and
`overflow-x: clip` with safe fallback.

- [x] **Step 2: Create the minimal JavaScript**

On `DOMContentLoaded`, set all `[data-current-year]` nodes, mark the document as JavaScript-ready,
toggle `[data-site-nav]` from `[data-menu-button]`, close it after a navigation click or Escape,
and save `house_duck_site_language` when `[data-lang-link]` is clicked. Do not fetch data or load
external scripts.

- [x] **Step 3: Run syntax and contract checks**

Run: `node --check assets/brand-site.js && bash scripts/check_brand_site.sh`

Expected: JavaScript syntax passes; contract still fails because the HTML has not been rebuilt.

- [x] **Step 4: Keep changes for the localized page task**

Do not commit yet because the new assets are intentionally unused until Task 3.

---

### Task 3: House Duck Korean and English home pages

**Files:**
- Modify: `index.html`
- Modify: `index_en.html`
- Create: `assets/brand-site.css`
- Create: `assets/brand-site.js`
- Test: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: shared CSS/JS, `quirky-ball/logo.png`, `quirky-ball/feature-graphic.png`
- Produces: equivalent Korean and English studio home pages

- [x] **Step 1: Rebuild `index.html`**

Use semantic skip link/header/nav/main/footer markup. Include the CSS duck wordmark, visible
language link to `index_en.html?lang=en`, brand hero, featured Quirky Ball card, three studio
principles, Germany-based independent-studio note, support/legal links, and existing non-Korean
browser redirect only when the query does not explicitly select Korean.

- [x] **Step 2: Rebuild `index_en.html` with structural parity**

Use the same classes, section order, data attributes, images, and CTA destinations. Link language
back to `/?lang=ko`. Translate naturally rather than shortening or deleting sections.

- [x] **Step 3: Run the contract and existing public checks**

Run: `node --check assets/brand-site.js && bash scripts/check_brand_site.sh && bash scripts/check_public_repo.sh`

Expected: brand contract still reports only Quirky Ball page gaps; public security check passes.

- [x] **Step 4: Commit the shared system and studio pages**

```bash
git add assets/brand-site.css assets/brand-site.js index.html index_en.html
git commit -m "feat: renew House Duck brand homepage"
```

---

### Task 4: Quirky Ball Korean and English product pages

**Files:**
- Modify: `quirky-ball/index.html`
- Modify: `quirky-ball/index_en.html`
- Test: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: shared brand CSS/JS and local Quirky Ball logo, feature graphic, and screenshots
- Produces: equivalent Korean and English product pages with honest launch status

- [x] **Step 1: Rebuild the Korean product page**

Use the shared navigation, split hero, real logo and feature graphic, `Google Play 출시 준비 중`
status, `DROP / MERGE / OUTSMART` game loop, Joker/Bomb/competition cards, six-image gallery,
House Duck ownership strip, closing status CTA, and legal/support footer. Keep the Google site
verification meta tag and Korean redirect exception for `?lang=ko`.

- [x] **Step 2: Rebuild the English product page**

Mirror the exact structure with natural English copy, `Preparing for Google Play` status, language
link to `./?lang=ko`, and English privacy/terms destinations.

- [x] **Step 3: Run all static contracts**

Run: `node --check assets/brand-site.js && bash scripts/check_brand_site.sh && bash scripts/check_policy_content.sh && bash scripts/check_public_repo.sh && bash scripts/check_analytics_dashboard.sh && node scripts/test_pulse_model.js && git diff --check`

Expected: every command exits 0; output includes `brand site contract: PASS`, public security pass,
analytics dashboard pass, and `pulse model: PASS`.

- [x] **Step 4: Commit the product pages**

```bash
git add quirky-ball/index.html quirky-ball/index_en.html
git commit -m "feat: renew Quirky Ball product page"
```

---

### Task 5: Browser QA, final documentation, and integration

**Files:**
- Modify: `docs/superpowers/plans/2026-08-02-house-duck-brand-site-renewal.md` only to check completed steps
- Test: local HTTP browser at desktop/tablet/mobile sizes

**Interfaces:**
- Consumes: completed static site
- Produces: visual evidence, clean branch, and a merge-ready commit history

- [x] **Step 1: Serve the worktree locally**

Run a local static server rooted at the worktree and open `/`, `/index_en.html`, `/quirky-ball/`,
and `/quirky-ball/index_en.html`.

- [x] **Step 2: Capture and inspect representative viewports**

Check 1440×1000, 768×1024, and 390×844. Measure `scrollWidth <= clientWidth`, inspect the full
desktop page and mobile hero/gallery, and confirm no clipped headings, broken images, or footer gaps.

- [x] **Step 3: Exercise interactions**

Keyboard-tab through the skip link, navigation, CTAs, language, support, and legal links. On mobile,
open/close the navigation, press Escape, and verify reduced-motion CSS is present.

- [x] **Step 4: Run the complete fresh verification suite**

Run: `bash scripts/check_brand_site.sh && bash scripts/check_policy_content.sh && bash scripts/check_public_repo.sh && bash scripts/check_analytics_dashboard.sh && node scripts/test_pulse_model.js && node --check assets/brand-site.js && git diff --check`

Expected: all commands exit 0 with no failures.

- [x] **Step 5: Commit the completed plan record**

```bash
git add docs/superpowers/plans/2026-08-02-house-duck-brand-site-renewal.md
git commit -m "docs: record House Duck site renewal verification"
```

- [x] **Step 6: Integrate without overwriting unrelated work**

Confirm the main checkout's existing analytics changes are preserved. Merge or cherry-pick only
the brand-site branch commits after the main checkout is clean or those unrelated changes have
been committed by their owner. Never reset, stash, or discard them automatically.
