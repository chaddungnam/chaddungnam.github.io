# House Duck Global Blog Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Tistory source blog, crawlable translated mirrors, House Duck home feed, shared public-page visual system

## Outcome

House Duck keeps Tistory as the Korean writing source while publishing crawlable static mirrors at
`/blog/kr/`, `/blog/en/`, `/blog/de/`, and `/blog/ja/`. New RSS items are synchronized automatically,
translated without a paid API, added to the sitemap, and shown on the House Duck home page.

## Architecture

- Tistory RSS is the content source. A scheduled GitHub Action fetches it instead of making a
  cross-origin browser request.
- A small sync program extracts title, date, summary, body, and first image, rewrites Tistory links to
  `blog.houseduck.in`, and writes `assets/blog-feed.json` plus static article pages.
- Korean pages use the original RSS body. Argos Translate creates English, German, and Japanese text
  offline in GitHub Actions. Existing generated translations are retained when no content changed.
- Every mirror has a self canonical, `hreflang` links (`ko`, `en`, `de`, `ja`, `x-default`), an original
  Korean link, and an automatic-translation warning. `sitemap.xml` lists every mirror.
- The Tistory skin detects a non-Korean device and offers the matching mirror when it exists. It never
  hides the Korean original or redirects search crawlers.

## Public UI

- The home page reads the same-origin feed JSON and renders real recent posts with image, title,
  summary, and date. A visible empty/error state remains when synchronization has not run.
- The studio hero uses restrained CSS motion: moving grid/light, live status pulse, entry sequencing,
  and hover depth. Motion is disabled by `prefers-reduced-motion`.
- The header wordmark is slightly larger and optically centered beside the duck.
- Legal, privacy, Impressum, support, and account-deletion readers share the dark-first House Duck
  palette, real duck logo, theme toggle, compact developer-document styling, responsive tables, and
  existing legal text unchanged.
- Tistory article titles use a practical maximum size. Tistory-injected namecard, subscription, and
  comment controls receive explicit dark/light styles.

## Automation and search

- The sync workflow runs on manual dispatch, relevant pushes, and a regular schedule. A new Tistory
  post appears after the next successful run; scheduled GitHub Actions may start late.
- The workflow commits generated content only when output changed, which triggers the existing Pages
  deployment.
- `robots.txt` advertises `https://houseduck.in/sitemap.xml`; the root RSS alternate remains the
  Tistory feed.
- Google Search Console should submit `https://houseduck.in/sitemap.xml`. RSS submission is optional
  and does not replace the sitemap.

## Failure and quality boundaries

- If RSS fetch or translation fails, the workflow exits without replacing the last good feed.
- Machine translations are visibly labeled and may be less natural than the Korean original.
- Generated HTML strips scripts and inline event handlers before publication.
- No API key, paid translation service, database, CMS, frontend framework, or runtime proxy is added.
- Existing unrelated `console/analytics.js` changes remain untouched.

## Acceptance checks

1. A controlled RSS fixture generates one Korean mirror, three localized mirrors, a feed entry, and
   sitemap URLs with correct canonical and `hreflang` values.
2. The home page replaces its placeholder with feed content and preserves a usable fallback.
3. Tistory article title, namecard, and comments match both themes on desktop and mobile.
4. Shared public documents preserve their body copy and support dark/light theme switching.
5. Reduced-motion, keyboard focus, responsive images, and no horizontal overflow remain intact.
6. Public-repository, brand, legal, skin, JavaScript, XML, and diff checks pass before deployment.
