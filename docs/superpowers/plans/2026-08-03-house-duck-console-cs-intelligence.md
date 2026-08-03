# House Duck Console CS Intelligence Implementation Plan

**Goal:** Deliver the approved bounded CS workspace and localized reward-mail templates with
zero-cost-first summaries.

**Architecture:** Reuse Gmail labels as the CS source of truth, browser memory for loaded
metadata and summary cache, the current admin authentication contract for a small Gemini
proxy, and the existing reward broadcast/audit pipeline for localization keys.

## Task 1 — Pure CS intelligence (TDD)

- Add failing Node assertions for PII redaction, 4,000-character bounds, local summaries,
  weekly category/status totals, and week/month/year buckets.
- Add the smallest browser/Node compatible pure module.
- Run the focused test and confirm red then green.

## Task 2 — Bounded kanban and calendar UI (TDD)

- Add contract assertions for kanban/calendar controls, summary region, and internal scrolling.
- Replace the long inquiry list with four bounded columns using the existing 20-thread page.
- Add week/month/year calendar summaries from the same loaded metadata.
- Keep search/filter/pagination and the existing safe thread/reply flow.
- Add a prominent summary block above the thread messages.

## Task 3 — Free AI summary path (TDD)

- Add pure request validation and response parsing tests first.
- Add a protected `cs-summarize` Edge Function that reuses `verifyAdminRequest`.
- Enforce redacted input, 4,000-character maximum, short structured output, and no logging.
- Add browser invocation only on thread open, one memory-cache entry per message ID, with
  deterministic local fallback on every error.
- Deploy only after local tests; set a Gemini key only if it can be created without billing.

## Task 4 — Localized reward templates (TDD)

- Add failing frontend and Edge normalization tests for the seven allowed template keys and
  rejection of raw title/body text.
- Replace title/body inputs with a template selector and fixed preview.
- Generate a Supabase migration through the CLI for `admin_broadcast_reward_mail_v2`.
- Map the selected template to `title_key`/`body_key`, set custom text null, preserve reward,
  expiry, idempotency, and audit behavior.
- Update the admin function RPC mapping and verify tests.

## Task 5 — Verification and release

- Run focused Node/Deno tests, console/public-site scripts, diff checks, and database advisors.
- Serve locally and inspect desktop/mobile CS and Operations routes without sending mail.
- Deploy Edge Functions, migration, and the public site only when all local checks pass.
- Verify the live login, bounded CS route, summary fallback, and reward template UI.
- Record what was not tested: real customer reply, real global broadcast, Android/iOS client.
