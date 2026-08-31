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

- [x] Add a Node assertion that fails until `play/quirky-ball/` contains exactly the ten expected filenames and each SHA-256 matches the source snapshot.
- [x] Add the assertion to `scripts/check_brand_site.sh` and run `node scripts/test_playable_phone.js`; confirm the missing-snapshot failure.
- [x] Copy the ten files without altering the source export.
- [x] Narrow the public-repo ZIP rule to allow only the two expected playable ZIP paths at their exact hashes; keep every other ZIP blocked.
- [x] Run `node scripts/test_playable_phone.js` and `bash scripts/check_public_repo.sh`; confirm both pass.
- [x] Commit: `feat: add verified quirky ball web snapshot`.

## Task 2: Replace the incorrect mascot with the game-authentic Quirky

**Files:**
- Modify: `scripts/test_studio_home.js`
- Modify: `assets/red-quirky.svg`

- [x] Change the static mascot contract to reject legs, gradients, and a toothy grin while requiring a red hex body, navy outline, raised offset pupils, angled brows, and asymmetric smirk.
- [x] Run `node scripts/test_studio_home.js`; confirm it fails against the current asset.
- [x] Redraw the existing 240×260 SVG from `scripts/Marble.gd` proportions and colors, with no appendages.
- [x] Run `node scripts/test_studio_home.js`; confirm it passes.
- [x] Commit: `fix: use the authentic quirky character`.

## Task 3: Add the lazy playable-phone state machine

**Files:**
- Modify: `scripts/test_playable_phone.js`
- Modify: `tests/public-site.spec.js`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`
- Modify: `assets/studio-home.js`

- [x] Extend static assertions so each home has one player hook and localized PLAY/LOADING/READY/ERROR/EXIT/RETRY strings, references `play/quirky-ball/`, and contains no static iframe.
- [x] Add browser tests proving: zero playable requests before click; one iframe after click; LOADING→READY; EXIT removes the iframe, restores video, and returns focus; timeout exposes RETRY; reduced-motion still permits PLAY.
- [x] Run the targeted static/browser tests and confirm the expected player-hook failures.
- [x] Replace only the main hero-phone link in all four home pages with the shared player container. Use these labels:
  - KO: `지금 플레이`, `게임 불러오는 중…`, `플레이 준비 완료`, `종료`, `다시 시도`
  - EN: `Play now`, `Loading game…`, `Ready to play`, `Exit`, `Retry`
  - DE: `Jetzt spielen`, `Spiel wird geladen…`, `Spiel bereit`, `Beenden`, `Erneut versuchen`
  - JA: `今すぐプレイ`, `ゲームを読み込み中…`, `プレイ準備完了`, `終了`, `再試行`
- [x] Add one `setupPlayablePhone()` to the existing JS: create the iframe on PLAY, poll the existing first-frame/game-ready flags, stop at a bounded timeout, remove the runtime on EXIT/error, ignore stale callbacks, and emit one `houseduck:playable` active-state event.
- [x] Pause the hero video, canvas loop, and decorative cursor while active; restore the user's prior FX choice on EXIT.
- [x] Run the targeted tests and confirm they pass.
- [x] Commit: `feat: play quirky ball inside the hero phone`.

## Task 4: Finish the visual, responsive, and motion polish

**Files:**
- Modify: `tests/public-site.spec.js`
- Modify: `assets/studio-home.css`
- Modify: `assets/studio-home.js`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `index_de.html`
- Modify: `index_ja.html`

- [x] Add browser assertions for all four locales at 390×844: phone top within the first viewport, no horizontal overflow, readout/signature after the phone, body text at least 16px, and stable phone geometry while playing.
- [x] Add tests proving the custom cursor is scoped to the hero visual, canvas frames stop offscreen/FX-OFF/playing and resume without a catch-up burst, and reduced-motion has no ambient entrance motion.
- [x] Run the targeted tests and confirm the expected layout/motion failures.
- [x] Reorder the mobile hero through CSS grid areas so title→phone→supporting copy/readout is visible in the first screen.
- [x] Add the smallest necessary CSS for player overlays, clear state hierarchy, one-shot transform/opacity entrance, 2–3px fine-pointer hover only, 16px body copy, a calmer copy safe-zone, corrected mascot scale, and tighter Project K-to-footer spacing.
- [x] Cancel/restart the existing canvas RAF instead of scheduling frames while inactive; keep the current launch density and preserve the scroll-following Quirky with reduced interference.
- [x] Update the shared CSS/JS cache-bust query to `20260831-playable` on all four homes.
- [x] Run the targeted tests and confirm they pass.
- [x] Commit: `style: polish the playable studio home`.

## Task 5: Verify, compare, deploy, and canary

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-house-duck-playable-phone-implementation.md`
- Update: external design-audit report and screenshots (not deployed)

- [ ] Record final dirty-state evidence for both repositories; confirm the game repository was not modified by this task. **차단:** task 시작 전부터 ledger baseline `44a86bd`/`607e…`와 달랐고, task 중에도 외부 작업으로 HEAD/status가 계속 변경되어 동일성 증명을 할 수 없었다. 이 task는 game repo 파일을 편집하지 않았다.
- [x] Run `bash scripts/check_brand_site.sh`, the full Playwright public-site suite, and syntax/static checks from a fresh command.
- [x] Confirm `git diff --exit-code b9445c3 -- terms privacy impressum support quirky-ball project-k` and compare local legal/support route hashes to the live pre-deploy hashes.
- [x] Capture same-viewport desktop and 390×844 mobile after screenshots in Aside after animations settle; compare them with the saved before captures.
- [x] Verify the real iframe sets both readiness flags and receives pointer input; explicitly leave real-iPhone Safari feel as unverified unless a physical device is available.
- [x] Push `main`, wait for security/browser/Pages workflows, then verify the deployed home and legal/support hashes in Aside.
- [x] Update the design-audit findings, requirement matrix, and this plan's checkboxes with exact evidence.
- [x] Commit any evidence-only documentation update and push it after the deployed result is stable.

## Final requirement matrix (2026-08-31)

| Requirement | Result | Implementation | Evidence |
|---|---|---|---|
| Immutable ten-file Godot snapshot | 완료 | `play/quirky-ball/`, `scripts/test_playable_phone.js` | Fresh brand/static PASS; all ten SHA-256 values match |
| Website iframe avoids false YouTube Playables environment | 완료 | `play/quirky-ball-site/index.html`, four localized homes | Aside local/live: `inEnv=false`, both readiness flags true |
| PLAY is lazy and EXIT/RETRY/reduced-motion work | 완료 | `assets/studio-home.js`, `tests/public-site.spec.js` | Pre-click iframe/resources 0; full E2E 91 passed, 3 skipped |
| 390×844 layout, copy size, controls, stable phone | 완료 | `assets/studio-home.css`, hardened browser assertions | Fresh top-aligned capture: 390×844, `scrollY=0`, phone top 233.78px, overflow 0; EXIT ≥44px |
| Correct Quirky mascot and calmer visual hierarchy | 완료 | `assets/red-quirky.svg`, home CSS | Before/after screenshots and static contract PASS |
| Protected legal/support/detail routes unchanged | 완료 | 적용 제외 (content-frozen) | `git diff --exit-code b9445c3 ...` PASS; pre/post live SHA-256 match |
| GitHub deployment and live canary | 완료 | `main` at `e61994f` | Three workflows success; 10m12s canary, 11 checks, no alerts |
| Separate duplicate/stale/access-exception browser branches | 부분 완료 | Shared state machine guards exist | Happy path/timeout/full suite pass; no dedicated forced-branch tests (accepted minor) |
| Real iPhone Safari touch feel | 차단 | 적용 없음 | Physical iPhone unavailable; browser mobile emulation is not device proof |
| Ledger game-repo baseline equality | 차단 | 적용 없음 | Baseline already mismatched before Task 5 and changed concurrently; game repo untouched by this task |
