# House Duck playable phone design

## Goal

Replace the incorrect smiling, legged website mascot with the current Quirky Ball character and let visitors launch the real Godot HTML5 build inside the main iPhone mockup without slowing every first visit.

## Source of truth

- Playable snapshot: `/Users/junheechoi/projects/houseduck/quirky-ball/캡쳐비디오유튜브/YouTube_Playable_Final/`
- Character geometry and face: `scripts/Marble.gd`, especially `JOKER_COLOR`, `draw_joker_gloss`, and `draw_joker_face`
- The game repository is read-only for this site task. Existing dirty changes there must not be modified, staged, or cleaned.
- The public-site repository receives a copied, immutable playable snapshot so later game work cannot silently change the deployed site.

## Chosen interaction

The hero phone keeps its lightweight gameplay poster/video on initial load. A localized `PLAY` control replaces the video with a same-origin iframe only after an explicit click or tap. The iframe runs the real Godot build within the phone screen; the surrounding phone shell and protruding top remain part of the website.

The active player provides a small localized exit control. Exiting removes the iframe and restores the poster/video, releasing the large game runtime. If the build does not reach its existing `__quirkyBallPlayablesGameReady` signal within a bounded wait, the phone returns to a clear retry state and keeps the Google Play link available.

## Character correction

`assets/red-quirky.svg` is redrawn from the current `Marble.gd` proportions: red hexagonal shell, navy ink outline, upper-left gloss, four-white eyes with raised outward pupils, angled brows, and an asymmetric smirk. Decorative feet, toothy grin, gradient body, and the previous unrelated mascot anatomy are removed. The corrected asset continues to serve the hero and scroll-follow decoration.

## Files and routing

- Copy the ten-file Godot export to `play/quirky-ball/` without altering its runtime files.
- Update all four localized home pages with the same player hooks and localized accessible labels.
- Reuse `assets/studio-home.js` for the minimum player state machine and `assets/studio-home.css` for phone/player presentation.
- Do not rename, redirect, edit, or remove `/terms/`, `/privacy/`, `/impressum/`, or `/support/`.
- The lower Quirky Ball project phone remains a lightweight looping video; only the main hero phone becomes playable.

## Loading and safety behavior

1. Initial page load requests no PCK, WASM, or iframe document.
2. User activates `PLAY`; the page creates the iframe and displays a loading state.
3. The parent observes the same-origin readiness flag already exposed by the build.
4. Ready state exposes the playable canvas and keeps keyboard/touch input inside the phone.
5. Exit or a load failure removes the iframe and returns to the video state.
6. Reduced-motion preference still disables decorative site VFX but does not block an explicitly launched game.

## Verification gates

- Test-first regression: no playable network request before activation; click inserts one iframe at `play/quirky-ball-site/index.html`; exit removes it.
- Local browser proof that the iframe reaches both first-frame and game-ready flags and accepts a real pointer/touch sequence.
- Corrected mascot dimensions and visual screenshot comparison against the running Godot build.
- Korean, English, German, and Japanese desktop plus 390 px mobile checks for clipping and horizontal overflow.
- Existing full public-site test suite, repository/security checks, link checks, and `git diff --check` pass.
- Before/after screenshots use matching viewport sizes.
- Live Pages, security, and browser-QA workflows pass after deployment.
- Live fixed-route responses for terms, privacy, Impressum, and support remain byte-identical to their pre-change hashes.

## Explicit boundaries

This integrates the existing playable; it does not change game logic, regenerate the Godot export, add analytics, or claim real-device input parity. Real iPhone Safari play feel remains a separate verification boundary unless a device is connected during this task.

## Approved homepage polish extension

The playable integration also resolves the seven rendered-home findings recorded in the 2026-08-31 design audit:

- Preserve the existing shot rate and game energy while protecting the hero copy from shot trails and impact clutter.
- On 390 px mobile, bring the hero phone top into the first 844 px viewport; move secondary readout/signature content below the playable rather than removing it.
- Raise meaningful hero and project body copy to at least 16 px. Labels and specimen metadata may remain smaller.
- Replace constant decorative-only motion with a short staged hero entrance plus explicit `PLAY`, `LOADING`, `READY`, `ERROR`, and `EXIT` feedback. Animate only transform and opacity and keep reduced-motion behavior.
- End the Project K zone after one deliberate breathing interval instead of leaving a second empty viewport before the footer.
- Keep the existing three equal YouTube cards, project ordering, localized text, and two-project limit.
- Treat the Quirky Ball and Project K detail pages as visual references; do not redesign them in this pass.
