# House Duck Playable Phone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incorrect Quirky artwork, make the verified Quirky Ball Godot export playable inside the home-page iPhone, and raise the home page's visual and motion quality without changing legal, support, or project-detail routes.

**Architecture:** Keep the existing static site and shared `studio-home` CSS/JS. Copy one immutable, hash-checked Godot export under `play/quirky-ball/`; create its iframe only after an explicit PLAY action; use the export's existing same-origin readiness flags for LOADING/READY/ERROR/EXIT states. Reuse the current video, canvas, localization, and FX controls, pausing ambient effects only while the playable owns attention.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Godot Web export, Node assertion scripts, Playwright, GitHub Pages.

## Global Constraints

- Treat `/Users/junheechoi/projects/houseduck/quirky-ball/캡쳐비디오유튜브/YouTube_Playable_Final/` as read-only source material.
- Preserve `/terms`, `/privacy`, `/impressum`, `/support`, and both project-detail routes byte-for-byte.
- Do not request the PCK, WASM, or iframe before an explicit PLAY action.
- Keep all four home languages feature-equivalent and retain two equal YouTube cards plus two project sections.
- Keep reduced-motion, keyboard focus, minimum 44px controls, and an error/retry path.
- Add no dependency, build framework, analytics event, or game-code change.

---

## Task 1: Lock the immutable playable snapshot

**Files:**
- Create: `scripts/test_playable_phone.js`
- Modify: `scripts/check_brand_site.sh`
- Modify: `scripts/check_public_repo.sh`
- Create: `play/quirky-ball/` (ten copied export files)

- [ ] Add a Node assertion that fails until `play/quirky-ball/` contains exactly the ten expected filenames and each SHA-256 matches the source snapshot.
- [ ] Add the assertion to `scripts/check_brand_site.sh` and run `node scripts/test_playable_phone.js`; confirm the missing-snapshot failure.
- [ ] Copy the ten files without altering the source export.
- [ ] Narrow the public-repo ZIP rule to allow only the two expected playable ZIP paths at their exact hashes; keep every other ZIP blocked.
- [ ] Run `node scripts/test_playable_phone.js` and `bash scripts/check_public_repo.sh`; confirm both pass.
- [ ] Commit: `feat: add verified quirky ball web snapshot`.

## Task 2: Replace the incorrect mascot with the game-authentic Quirky

**Files:**
- Modify: `scripts/test_studio_home.js`
- Modify: `assets/red-quirky.svg`

- [ ] Change the static mascot contract to reject legs, gradients, and a toothy grin while requiring a red hex body, navy outline, raised offset pupils, angled brows, and asymmetric smirk.
- [ ] Run `node scripts/test_studio_home.js`; confirm it fails against the current asset.
- [ ] Redraw the existing 240×260 SVG from `scripts/Marble.gd` proportions and colors, with no appendages.
- [ ] Run `node scripts/test_studio_home.js`; confirm it passes.
- [ ] Commit: `fix: use the authentic quirky character`.

## Task 3: Add the lazy playable-phone state machine

**Files:**
- Modify: `scripts/test_playable_phone.js`
- Modify: `tests/public-site.spec.js`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `assets/studio-home.js`

- [ ] Extend static assertions so each home has one player hook and localized PLAY/LOADING/READY/ERROR/EXIT/RETRY strings, references `play/quirky-ball/`, and contains no static iframe.
- [ ] Add browser tests proving: zero playable requests before click; one iframe after click; LOADING→READY; EXIT removes the iframe, restores video, and returns focus; timeout exposes RETRY; reduced-motion still permits PLAY.
- [ ] Run the targeted static/browser tests and confirm the expected player-hook failures.
- [ ] Replace only the main hero-phone link in all four home pages with the shared player container. Use these labels:
  - KO: `지금 플레이`, `게임 불러오는 중…`, `플레이 준비 완료`, `종료`, `다시 시도`
  - EN: `Play now`, `Loading game…`, `Ready to play`, `Exit`, `Retry`
  - DE: `Jetzt spielen`, `Spiel wird geladen…`, `Spiel bereit`, `Beenden`, `Erneut versuchen`
  - JA: `今すぐプレイ`, `ゲームを読み込み中…`, `プレイ準備完了`, `終了`, `再試行`
- [ ] Add one `setupPlayablePhone()` to the existing JS: create the iframe on PLAY, poll the existing first-frame/game-ready flags, stop at a bounded timeout, remove the runtime on EXIT/error, ignore stale callbacks, and emit one `houseduck:playable` active-state event.
- [ ] Pause the hero video, canvas loop, and decorative cursor while active; restore the user's prior FX choice on EXIT.
- [ ] Run the targeted tests and confirm they pass.
- [ ] Commit: `feat: play quirky ball inside the hero phone`.

## Task 4: Finish the visual, responsive, and motion polish

**Files:**
- Modify: `tests/public-site.spec.js`
- Modify: `assets/studio-home.css`
- Modify: `assets/studio-home.js`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`

- [ ] Add browser assertions for all four locales at 390×844: phone top within the first viewport, no horizontal overflow, readout/signature after the phone, body text at least 16px, and stable phone geometry while playing.
- [ ] Add tests proving the custom cursor is scoped to the hero visual, canvas frames stop offscreen/FX-OFF/playing and resume without a catch-up burst, and reduced-motion has no ambient entrance motion.
- [ ] Run the targeted tests and confirm the expected layout/motion failures.
- [ ] Reorder the mobile hero through CSS grid areas so title→phone→supporting copy/readout is visible in the first screen.
- [ ] Add the smallest necessary CSS for player overlays, clear state hierarchy, one-shot transform/opacity entrance, 2–3px fine-pointer hover only, 16px body copy, a calmer copy safe-zone, corrected mascot scale, and tighter Project K-to-footer spacing.
- [ ] Cancel/restart the existing canvas RAF instead of scheduling frames while inactive; keep the current launch density and preserve the scroll-following Quirky with reduced interference.
- [ ] Update the shared CSS/JS cache-bust query to `20260831-playable` on all four homes.
- [ ] Run the targeted tests and confirm they pass.
- [ ] Commit: `style: polish the playable studio home`.

## Task 5: Verify, compare, deploy, and canary

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-house-duck-playable-phone-implementation.md`
- Update: external design-audit report and screenshots (not deployed)

- [ ] Record final dirty-state evidence for both repositories; confirm the game repository was not modified by this task.
- [ ] Run `bash scripts/check_brand_site.sh`, the full Playwright public-site suite, and syntax/static checks from a fresh command.
- [ ] Confirm `git diff --exit-code b9445c3 -- terms privacy impressum support quirky-ball project-k` and compare local legal/support route hashes to the live pre-deploy hashes.
- [ ] Capture same-viewport desktop and 390×844 mobile after screenshots in Aside after animations settle; compare them with the saved before captures.
- [ ] Verify the real iframe sets both readiness flags and receives pointer input; explicitly leave real-iPhone Safari feel as unverified unless a physical device is available.
- [ ] Push `main`, wait for security/browser/Pages workflows, then verify the deployed home and legal/support hashes in Aside.
- [ ] Update the design-audit findings, requirement matrix, and this plan's checkboxes with exact evidence.
- [ ] Commit any evidence-only documentation update and push it after the deployed result is stable.
