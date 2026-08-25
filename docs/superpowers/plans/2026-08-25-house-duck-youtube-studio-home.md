# House Duck YouTube Studio Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the old blog/history-led homepage with a light, scroll-driven game-studio homepage whose complete Quirky mascot, current shooting mechanic, YouTube feed, and two phone-led projects are immediately legible.

**Architecture:** Keep the existing static GitHub Pages structure. Four localized HTML files share one home stylesheet and one small home-only JavaScript file. CSS owns layout and phone overflow; native Canvas owns the lightweight Quirky action; a Node standard-library script converts YouTube Atom into a committed JSON fallback that GitHub Actions refreshes.

**Tech Stack:** Static HTML, CSS, browser Canvas 2D, vanilla JavaScript, Node.js standard library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-25-house-duck-youtube-first-studio-redesign.md`

## Global Constraints

- Preserve every non-home page and the existing shared `brand-site.js` behavior.
- Keep the site light-only and dependency-free.
- Use a newly drawn, fully bounded SVG for the red Quirky; never reuse the cropped preview bitmap.
- Keep phone-stage ancestors vertically visible so each phone top can protrude beyond its project card.
- End the homepage immediately after Quirky Ball, Project K, and the compact legal footer.
- Validate all four languages, desktop and mobile browser layouts, reduced motion, and horizontal overflow.

### Task 1: Lock the new homepage contract with failing checks

**Files:**
- Modify: `scripts/check_brand_site.sh`
- Modify: `scripts/test_public_ui_regressions.js`
- Modify: `tests/public-site.spec.js`
- Add: `scripts/test_studio_home.js`

1. Replace retired manifesto, journal, and history assertions with the hero, YouTube, mechanic, two-project, full-mascot, and home-script contract.
2. Add a small Node check for the exact red-Quirky shooting constants and localized homepage markers.
3. Update Playwright coverage for equal YouTube cards, animated canvas, changing scroll tone, protruding phones, complete mascot bounds, and no horizontal overflow.
4. Run the targeted checks and confirm they fail because the production files do not yet meet the contract.

### Task 2: Build the localized homepage and complete Quirky artwork

**Files:**
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `assets/studio-home.css`
- Add: `assets/red-quirky.svg`

1. Replace the old home body with the compact header, slogan hero, latest YouTube row, Quirky Ball project, Project K project, and legal footer.
2. Draw the complete red Quirky as an inset SVG with its full hex body, face, feet, outline, and spare view-box margin.
3. Make phone shells protrude upward using visible overflow and responsive offsets without clipping media.
4. Apply warm-white, white, pale-blue, and grey scroll sections with smaller base typography and strong English display words.

### Task 3: Add native motion and automatic YouTube refresh

**Files:**
- Add: `assets/studio-home.js`
- Add: `assets/youtube-feed.json`
- Add: `scripts/youtube-sync.mjs`
- Add: `scripts/test_youtube_sync.mjs`
- Add: `.github/workflows/sync-youtube.yml`
- Modify: `scripts/test_deployment_workflows.js`

1. Implement the exact 4.5-turn, 2.25-second, 8-shots-per-second paired red-Quirky canvas action with one bounce and 0.82–0.94 marble shrink range.
2. Move the complete red Quirky down the right rail and fade it before the Quirky Ball section.
3. Switch the page tone by the section nearest the viewport centre and pause canvas/video work off-screen or under reduced motion.
4. Parse and validate YouTube Atom with Node standard library only, retain valid committed JSON on network/parse failure, and schedule the workflow every four hours.
5. Run the new Node checks until they pass.

### Task 4: Verify the production result

**Files:**
- Verify: all files changed above

1. Run the static contract, UI regression, language, feed, deployment-workflow, and Playwright suites.
2. Run `git diff --check` and the public-repository check.
3. Serve the final site locally and inspect it through Aside at desktop width; capture the hero and both phone sections after animations settle.
4. Use browser emulation for the mobile layout and explicitly distinguish it from physical-device proof.
5. Compare every spec item to implementation and verification evidence before reporting completion.
