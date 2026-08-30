# House Duck Playable Lab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the localized House Duck home pages around verified Quirky Ball 1.1.0 gameplay while preserving every published legal and support route.

**Architecture:** Keep the current static GitHub Pages architecture and existing selectors used by feed sync and QA. Replace only the four localized home documents and the shared home CSS/JavaScript, then validate behavior with Playwright and the repository contract scripts.

**Tech Stack:** Static HTML, native CSS, vanilla JavaScript, Playwright, existing GitHub Pages workflow.

## Global Constraints

- Light mode only; no new runtime dependency or build step.
- Exactly two projects and three YouTube cards.
- Project K release timing is undecided.
- Preserve `/terms/`, `/privacy/`, `/support/`, `/impressum/` and every existing localized home link.
- Reduced motion, keyboard focus, 390px mobile layout, and no horizontal overflow are required.
- Do not present 1.1.1 development captures as the released 1.1.0 build.

---

### Task 1: Lock the public contract

**Files:**
- Modify: `tests/public-site.spec.js`

- [ ] Add a browser test that asserts the four home pages expose the exact existing localized legal/support links.
- [ ] Add a browser test that requires a visible `Quirky Ball 1.1.0` hero, one prominent real gameplay video, moving launch marbles, a rapid shot burst, exactly two projects, and three equal-height YouTube cards.
- [ ] Run the two tests and confirm the new hero test fails against the current design while the route contract passes.

### Task 2: Build the localized playable-lab home

**Files:**
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `assets/studio-home.css`
- Modify: `assets/studio-home.js`

- [ ] Replace the studio-first opening with the Quirky Ball 1.1.0 release chamber and translated copy.
- [ ] Keep existing feed, project, video, mascot, and navigation data attributes so automation continues to work.
- [ ] Recompose the two project sections and three-card YouTube section without adding a new section or dependency.
- [ ] Make the existing canvas fill the hero atmosphere, improve its initial burst and impact rendering, and retain reduced-motion behavior.
- [ ] Run the targeted tests until they pass.

### Task 3: Visual and route verification

**Files:**
- Modify only if a reproduced defect requires it.

- [ ] Capture desktop and 390px mobile screenshots from final local code after motion settles.
- [ ] Inspect Korean, English, German, and Japanese home pages for clipping, hierarchy, video playback, and exact legal/support links.
- [ ] Run `bash scripts/check_public_repo.sh --all`, `bash scripts/check_brand_site.sh`, `npm run test:e2e`, and `git diff --check`.
- [ ] Fix only reproduced defects and rerun the failed check.

### Task 4: Deploy and verify live

**Files:**
- No additional source files unless deployment reveals a defect.

- [ ] After the four-hour work gate, fetch remote YouTube-sync changes and integrate without discarding work.
- [ ] Commit and push the verified redesign.
- [ ] Confirm the Pages workflow succeeds.
- [ ] Capture the live desktop and mobile result in Aside and recheck the fixed routes.

