# Task 3 report — lazy playable-phone state machine

## RED

Commands:

```sh
node scripts/test_playable_phone.js
npx playwright test tests/public-site.spec.js --project=desktop-chromium --grep 'playable phone|reduced motion still permits explicit playable'
```

Expected failures confirmed before implementation:

- Static: exit 1, `AssertionError: index.html must have one playable phone` (`0 !== 1`).
- Browser: 3 failed; each timed out waiting for the missing `[data-playable-phone]` / `[data-playable-launch]` hook.

## GREEN

Commands:

```sh
node scripts/test_playable_phone.js
npx playwright test tests/public-site.spec.js --grep 'playable phone|reduced motion still permits explicit playable'
node scripts/test_studio_home.js
npx playwright test tests/public-site.spec.js --project=desktop-chromium --grep 'all localized home pages fit|home opens on|home reads as|home desktop removes|home reduced motion holds|home lets visitors pause'
git diff --check
```

Results:

- Playable snapshot/static contract: PASS; all 10 immutable snapshot hashes still match.
- Playable browser tests: 6 passed across desktop and mobile Chromium, using a same-origin stub and no 26MB runtime download.
- Existing studio-home contract: PASS.
- Related existing home regressions: 6 passed on desktop Chromium.
- Whitespace check: exit 0.

## State machine and cleanup self-review

- `idle → loading → ready` requires both same-origin readiness flags. Timeout and access exceptions move to `error`.
- The default timeout is 25 seconds; a positive numeric `data-playable-timeout` only shortens tests when explicitly supplied.
- PLAY creates the only iframe. Loading/ready ignore duplicate starts. A generation token and cleared timer make EXIT/error callbacks stale and harmless.
- EXIT/error remove the iframe, unhide the hero video, emit `{ active: false }`, restore the retained manual FX state, and focus the shared PLAY/RETRY button.
- One `houseduck:playable` event type pauses/resumes video, canvas, and decorative cursor. Reduced-motion still allows explicit PLAY.
- Native `hidden`, `aria-live`, and `aria-busy` expose UI state. The video also gets a temporary inline `display: none` because the existing `.hero-phone video { display: block }` rule overrides the native hidden rendering; Task 4 owns final styling.
- All four homes contain one hook, no static iframe, localized UI/iframe labels, and the same `play/quirky-ball/index.html` source.

## Changed files

- `assets/studio-home.js`
- `index.html`
- `index_en.html`
- `index_de.html`
- `index_ja.html`
- `scripts/test_playable_phone.js`
- `tests/public-site.spec.js`
- `.superpowers/sdd/2026-08-31-house-duck-playable-phone-implementation/task-3-report.md`

## Commit

`feat: play quirky ball inside the hero phone`

## Not verified here

- Real 26MB Godot runtime startup, live deployment, final player styling, matched before/after screenshots, and real-device input are intentionally left to the later integration/visual tasks.
