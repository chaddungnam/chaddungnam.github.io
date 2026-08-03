# House Duck Console CS Intelligence Design

**Date:** 2026-08-03
**Status:** Approved by delegated implementation (owner requested the finished result)
**Scope:** Quirky Ball console CS and reward mail only; Project K remains a shell.

## Outcome

The CS route becomes a bounded operations workspace instead of a vertically growing inbox.
It provides a weekly brief, kanban board, week/month/year calendar, thread summary, and the
existing safe reply flow. Reward broadcasts use a fixed localization template pair instead
of arbitrary title/body text.

## CS information architecture

- A compact weekly brief shows total inquiries, reply backlog, urgent items, and the most
  common category. It is computed locally from Gmail metadata and labels.
- `Kanban` is the default view with four columns: New, Needs reply, Waiting customer, Done.
- Each column has a fixed-height internal scroller. The route itself does not grow with the
  inbox. Gmail pagination remains bounded to 20 threads per request.
- `Calendar` offers week, month, and year views. It summarizes already loaded Gmail metadata
  and provides a date drill-down; it never downloads all message bodies.
- Selecting a card opens the existing thread/reply workspace. The first block is a short
  summary with source badge (`AI` or `local`). Messages remain text-only.
- Cards use one surface and a left status rail, removing the nested beige-box appearance.

## Summary strategy and privacy

1. Opening a thread extracts only the latest external message.
2. The browser removes obvious email addresses, phone numbers, display codes, URLs, and
   long identifiers, then truncates to 4,000 characters.
3. One request per message ID is sent to a protected Supabase Edge Function and cached only
   in JavaScript memory for the tab lifetime.
4. The function reuses the existing Google identity plus House Duck admin ticket checks.
5. Gemini 2.5 Flash-Lite returns a Korean summary, category, and urgency in structured JSON.
   It receives no attachments, previous messages, Gmail IDs, sender address, or player ID.
6. If the key, free quota, network, or model is unavailable, the browser immediately shows
   a deterministic local summary. No paid fallback is configured.
7. The function never logs or stores message content.

## Reward mail localization

- The console accepts one template key from a server whitelist:
  `general`, `compensation`, `maintenance`, `welcome`, `support`, `update`, `launch`.
- Each key maps to fixed `mail_<template>_title` and `mail_<template>_body` keys.
- The database stores localization keys and null custom title/body values.
- The client resolves the selected locale and falls back to English where a newer locale has
  not yet translated a key, matching the existing Localization contract.
- The final confirmation shows the Korean preview and both exact localization keys.
- Existing request-id idempotency, reward validation, expiry limits, and audit recording stay
  unchanged.

## Safety and non-goals

- No real support reply or global reward broadcast is sent during QA.
- No Gmail token, mail body, summary, or attachment is persisted.
- No CRM, database-backed CS mirror, background sync, vector search, or paid AI service.
- No Project K backend/game work.
- Existing customer mail and reward history remain unchanged.

## Acceptance checks

- Pure tests cover redaction, local summary, weekly aggregation, calendar bucketing, and
  localization template whitelisting.
- The console contract rejects arbitrary reward title/body fields.
- The new Edge Function rejects unauthenticated, non-admin, oversized, and unredacted input.
- Desktop and mobile browser QA confirms bounded scrolling, kanban/calendar switching,
  thread summary, focus behavior, and no horizontal overflow.
- Full public-site checks pass before deployment.
