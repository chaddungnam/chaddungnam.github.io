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
