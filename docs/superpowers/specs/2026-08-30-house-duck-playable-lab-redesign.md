# House Duck Playable Lab Redesign

## Goal

Make the first viewport unmistakably read as a professional game-studio site by leading with the released Quirky Ball 1.1.0 gameplay, then showing Project K and the automatically synced YouTube feed.

## Approved direction

- Rebuild the home experience as a light-only "playable lab": warm paper, cobalt UI, signal red, laboratory grid/crosshair details, and a restrained mad-scientist tone.
- Lead with `Quirky Ball 1.1.0` and a large autoplaying, muted, looping gameplay specimen. `Are you ready? / Houseduck.in` becomes a studio signature, not the primary product claim.
- Keep the Quirky loop explicit: `AIM / SHOOT / MERGE / SPEED / ACTION / COMPETE / CONTROL`.
- Keep exactly two projects. Project K remains `출시 예정 미정` or an equivalent undecided date in each locale.
- Keep three equal-height YouTube cards populated from the existing local feed workflow.
- Remove history, journal, and generic studio-manifesto sections from the home page.
- Use native CSS and vanilla JavaScript only. Reuse the existing canvas, media, fonts, cursor, feed, and phone shell patterns.

## Motion

- The opening canvas must already contain moving marbles and a rapid Quirky shot burst on first paint.
- After the staged first-paint burst, the loop mirrors release 1.1.0: 4.5 turns in `1.5 / 1.3` seconds, eight shots per second in opposing pairs, `0.82–0.94` hit shrink, and one wall ricochet.
- Scroll changes the page tone and moves the red Quirky through the page without scroll-jacking.
- Desktop gets a small custom shot cursor and click impact. Touch keeps the native pointer model.
- `prefers-reduced-motion` shows the full content, stops decorative animation, and pauses autoplay video.

## Fixed public contracts

Do not rename, move, remove, or redirect the existing `/terms/`, `/privacy/`, `/support/`, or `/impressum/` routes. Keep the current localized home links:

- Korean: `terms/ko.html`, `privacy/ko.html`, `impressum/ko.html`, `support/`
- English: `terms/en.html`, `privacy/en.html`, `impressum/en.html`, `support/#english`
- German: `terms/de.html`, `privacy/de.html`, `impressum/de.html`, `support/#german`
- Japanese: `terms/ja.html`, `privacy/ja.html`, `impressum/ja.html`, `support/#english`

## Completion evidence

- Playwright desktop and 390px mobile screenshots from the final code.
- Public-route, reduced-motion, keyboard, overflow, autoplay, canvas-motion, and localized-copy checks pass.
- Repository security and brand checks pass.
- GitHub Pages deployment succeeds and the live page is rechecked in Aside.

## Requirement verification matrix

| Requirement | Status | Implementation | Evidence |
|---|---|---|---|
| Product-first game-studio first viewport | 완료 | Four localized home pages + `assets/studio-home.css` | 1440×900 and 390×844 screenshots |
| Exact Quirky Ball 1.1.0 gameplay | 완료 | `assets/media/quirky-ball-gameplay.mp4` | H.264 540×1200, 30fps, release capture hash recorded in task evidence |
| Immediate marbles, shots, cursor, impacts | 완료 | `assets/studio-home.js` | Playwright launch-motion and cursor tests |
| Scroll tone and red Quirky follow | 완료 | `setupToneAndMascot` | Four-section tone/position browser audit |
| Direct FX pause and reduced-motion fallback | 완료 | Motion toggle + media/canvas listeners | Desktop/mobile pause-resume tests |
| YouTube automatic refresh and equal cards | 완료 | Existing four-hour feed workflow + three-card renderer | Current RSS IDs match runtime cards; 20 locale/viewport height checks |
| Exactly two projects; Project K date undecided | 완료 | Four localized home pages | Static contract and browser count |
| Complete phone tops and mascot | 완료 | Overflow-safe phone shells + complete `red-quirky.svg` | 22–65px phone protrusion audit |
| Light-only, selective Chilgok/Do Hyeon/Gungsuh | 완료 | Shared font and studio styles | Static visual contract |
| Published legal/support URLs and contents unchanged | 완료 | Existing route links retained | 13 files hash-identical to `origin/main`; 101-link test |
| 320px through desktop responsiveness | 완료 | Shared responsive styles | 36 locale/viewport overflow checks, plus 15 landscape checks |
| GitHub Pages deployment and live recheck | 부분 완료 | Pending four-hour gate | Not yet pushed |
