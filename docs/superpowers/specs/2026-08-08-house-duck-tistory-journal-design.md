# House Duck Tistory Journal Design

**Date:** 2026-08-08  
**Status:** Approved direction; written-spec review pending  
**Scope:** `blog.houseduck.in` public skin and House Duck public-site blog links

## Outcome

`blog.houseduck.in` becomes the official House Duck production journal. The blog looks like
part of the House Duck brand while retaining Tistory's native publishing, media, category,
tag, search, pagination, comment, and owner-management behavior.

The first release changes presentation and navigation only. It does not replace the Tistory
editor, add a separate database, generate articles with AI, or implement automatic translation.

## Chosen approach

Use a small custom Tistory skin instead of extending the current sidebar-heavy default skin
or building a separate CMS. The skin follows Tistory's supported file structure and template
substitution system:

- `skin.html` contains semantic page structure and Tistory substitution tags.
- `style.css` contains the responsive House Duck visual system.
- `images/script.js` contains only navigation, search, and progressive-enhancement behavior
  that cannot be handled by HTML and CSS.
- `index.xml` defines skin metadata and safe defaults.
- Preview images represent the uploaded skin in Tistory administration.

No frontend framework, package manager, build step, external font dependency, or runtime API
is introduced.

## Visual direction

- Editorial rather than corporate: warm cream background, near-black type, House Duck yellow
  as a restrained accent, generous whitespace, and large production images.
- Header brand: `HOUSE DUCK · JOURNAL`, with direct links to the House Duck site, projects,
  the journal home, and search.
- Home page: compact journal introduction followed by a responsive card grid. Each card shows
  cover image when present, category, title, summary, publish date, and comment count.
- Article page: approximately 760 px reading measure, strong title hierarchy, optional cover,
  fluid media, styled Markdown output, link cards, YouTube embeds, tags, related posts,
  previous/next navigation, and comments.
- Empty, search, category, tag, protected-post, notice, and page states use the same design.
- Remove calendar, visitor counter, social placeholders, recent-comment clutter, and the
  permanent desktop sidebar.
- Mobile uses one column, touch targets of at least 44 px, no horizontal overflow, and a
  compact navigation drawer. Motion respects `prefers-reduced-motion`.

## Functional behavior

- Tistory remains the only writing engine. Drafting, autosave, image insertion and ordering,
  cover-image selection, tags, Markdown mode, link previews, and YouTube embedding remain
  Tistory editor responsibilities.
- Search submits through Tistory's supported search substitution and works with keyboard
  Enter as well as the visible button.
- Category, tag, archive, notice, protected-post, pagination, related-post, previous/next,
  comment, and guestbook substitutions remain supported even when not visible on the home
  screen.
- Owner-only edit, publish-state, and delete controls remain inside Tistory's admin
  substitution block and are never recreated in custom JavaScript.
- Images and embeds are responsive. The skin does not re-compress uploaded originals because
  storage and delivery are controlled by Tistory.
- The custom domain is canonical. The original `houseduck.tistory.com` address remains a
  platform fallback.

## House Duck site integration

- Replace visible `Story` navigation and calls to action with `Blog` in every supported site
  language.
- Each Blog link opens `https://blog.houseduck.in/` in the same tab because it is part of the
  same House Duck experience.
- Remove founder-story URLs from `sitemap.xml`.
- Replace the old `/story/` landing page with a small accessible redirect/continue page to the
  journal so saved links do not become dead ends. Language-specific old story files receive
  the same treatment.
- Do not modify House Duck Console behavior or the user's existing `console/analytics.js`
  working-tree change.

## Translation boundary

Automatic device-language translation and the Korean-original toggle are deliberately outside
this first skin release. The skin reserves a compact notice position near the article header,
but no translation service or browser-language redirection is added until the stable public
skin is verified. Article URLs never receive language suffixes.

## Failure handling and accessibility

- Content remains readable and navigation remains usable when custom JavaScript fails.
- Missing cover images use a branded CSS placeholder without a broken image request.
- Search has a visible label, focus state, and submit button.
- Images supplied by Tistory retain their editor-provided alternative text; decorative skin
  graphics use empty alternative text.
- Color contrast, keyboard focus, semantic headings, landmarks, and reduced-motion behavior
  are checked before upload.
- If the custom domain certificate is still provisioning, verification continues on the
  original Tistory address and the custom domain is rechecked before completion.

## Acceptance checks

1. Skin package contains the required Tistory files and no unresolved local asset paths.
2. Home, empty-home, article, category, tag, search, archive, notice, protected-post, page,
   pagination, related-post, previous/next, comments, guestbook, and owner-admin blocks are
   present in the template.
3. Search works through Enter and the submit button; category, tag, card, pagination,
   related-post, previous/next, comment, and House Duck links resolve correctly.
4. A non-public test post or preview verifies title, representative image, long Korean text,
   Markdown headings and code, inline images, generic link card, YouTube long-form embed,
   YouTube Shorts embed, tags, and comments without publishing user-facing test content.
5. Desktop and mobile browser checks confirm no horizontal overflow, usable navigation,
   responsive images/embeds, visible keyboard focus, and readable long-form typography.
6. Anonymous inspection confirms owner-only management controls are not exposed.
7. `blog.houseduck.in` DNS resolves to Tistory and HTTPS succeeds after certificate issuance.
8. Every public House Duck `Story` link becomes `Blog`; old story URLs lead to the journal;
   founder-story entries are absent from the sitemap.
9. Existing site QA and `git diff --check` pass, and the pre-existing
   `console/analytics.js` modification remains untouched.

## Non-goals

- Separate CMS, Supabase project, GitHub-backed post database, or custom authentication
- AI writing or automatic story generation
- Video uploads or custom media storage
- Automatic translation in the first release
- Advertising, analytics expansion, newsletter, reactions, or social-login features
