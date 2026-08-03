# House Duck Console Gmail CS and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `support@houseduck.in` 문의를 통합 콘솔 안에서 안전하게 검색·분류·읽기·첨부 확인·답변하고 완성된 콘솔을 검증·배포한다.

**Architecture:** Google Identity Services token model이 `gmail.modify` 짧은 액세스 토큰을 관리자 브라우저 메모리에만 발급한다. 콘솔은 Gmail REST API를 직접 호출하고 Gmail 라벨을 CS 상태 정본으로 사용하므로 메일·첨부·Gmail token이 Supabase를 통과하지 않는다.

**Tech Stack:** vanilla JavaScript, Google Identity Services, Gmail REST API, Node.js assertions, GitHub Pages, Supabase CLI/Edge Functions

## Global Constraints

- Gmail 메일·첨부파일·access token을 Supabase, 공개 저장소, 로컬 영구 저장소, 로그에 복사하지 않는다.
- Gmail 권한은 CS 화면을 사용자가 열 때만 점진적으로 요청한다.
- HTML 메일을 `innerHTML`로 삽입하지 않고 안전한 텍스트로 표시한다.
- 다른 개인 Gmail 메일은 콘솔 검색·목록에 노출하지 않고 지원 주소 검색 범위만 사용한다.
- 답변 발송은 받는 사람·제목·본문·첨부·발신 별칭을 최종 확인한 뒤 실행한다.
- 실제 메일 발송 QA는 오너가 받을 주소와 발송을 승인한 뒤 한 번만 수행한다.
- Gmail API 설정 중 Google 로그인·2단계 인증·제한 권한 동의만 오너에게 요청하고 나머지는 에이전트가 처리한다.
- Project K는 껍데기만 유지하고 결제 미연동 상태를 바꾸지 않는다.
- Android/iOS 실기기와 APK/AAB 작업은 수행하지 않는다.

---

## Repository Map

- Site root: `/Users/junheechoi/projects/houseduck/quirky-ball/site_repo`
- Game/backend root: `/Users/junheechoi/projects/houseduck/quirky-ball`
- Depends on:
  - `2026-08-03-house-duck-console-core.md`
  - `2026-08-03-house-duck-console-player-operations.md`

### Files created or changed

- Create `site_repo/console/gmail-model.js`: base64url, Gmail payload, MIME, label transition pure functions
- Create `site_repo/console/gmail-api.js`: GIS token and Gmail REST client
- Create `site_repo/console/cs.js`: CS list/thread/reply UI
- Create `site_repo/console/cs-templates.js`: Korean/English/German reply templates
- Modify `site_repo/console/index.html`, `styles.css`, `app.js`, `auth.js`
- Create `site_repo/scripts/test_gmail_model.js`
- Extend `site_repo/scripts/check_house_duck_console.sh`
- Modify `site_repo/README.md` and `SECURITY.md`: private console architecture and token handling
- Modify `.github/workflows/public-site-security.yml`: console checks
- Modify `quirky-ball/docs/tech_stack.md`, `development_policy.md`, `work_history.md`: console/Gmail/admin contracts after implementation

## Interfaces

```js
window.GmailModel = {
  decodeBase64Url(value),
  encodeBase64Url(bytes),
  headerValue(headers, name),
  extractMessageText(payload),
  listAttachments(payload),
  buildReplyRaw({ from, to, subject, body, inReplyTo, references, attachments }),
  nextStatusLabels(currentLabelIds, targetStatusId, allStatusIds),
  extractDisplayCode(text),
};

window.GmailAPI = {
  initialize({ clientId }),
  authorize(),
  disconnect(),
  ensureCsLabels(),
  listSupportThreads({ query, labelIds, pageToken }),
  getThread(threadId),
  setThreadStatus(threadId, status, category),
  getAttachment(messageId, attachmentId),
  sendReply(reply),
};
```

Status label keys are exactly `new`, `needs_reply`, `waiting_customer`, and `done`. Category keys are `billing`, `account`, `bug`, and `other`.

### Task 1: Implement safe Gmail message and MIME primitives

**Files:**
- Create: `console/gmail-model.js`
- Test: `scripts/test_gmail_model.js`

**Interfaces:**
- Consumes: Gmail message payload JSON and reply form values
- Produces: safe text, attachments, RFC 2822 base64url reply, label transitions

- [ ] **Step 1: Write failing message-decoding tests**

Use fixed local fixtures with:

- UTF-8 Korean `text/plain` body;
- HTML-only body containing `<script>` and remote `<img>`;
- multipart body with a screenshot attachment;
- nested multipart alternative;
- malformed base64url.

Assertions:

```js
assert.equal(model.extractMessageText(plainPayload), "게임이 실행되지 않아요.");
assert.doesNotMatch(model.extractMessageText(htmlPayload), /<script|<img/i);
assert.deepEqual(model.listAttachments(multipartPayload), [{
  filename: "screen.png",
  mimeType: "image/png",
  size: 1200,
  attachmentId: "att-1",
}]);
```

- [ ] **Step 2: Write failing MIME/threading tests**

Build a reply with Korean body and one small attachment. Decode the returned raw message and assert `From`, `To`, `Subject`, `In-Reply-To`, `References`, UTF-8 body, multipart boundary, and attachment filename are present. Assert CR/LF in address headers is rejected.

- [ ] **Step 3: Write failing label and display-code tests**

Assert a target status removes all other status label IDs, preserves unrelated category labels, and display codes matching the game's exact public format are extracted without treating arbitrary UUIDs as display codes.

- [ ] **Step 4: Run and confirm failure**

```bash
node scripts/test_gmail_model.js
```

Expected: FAIL because `console/gmail-model.js` is missing.

- [ ] **Step 5: Implement the pure module**

Use `TextEncoder`, `TextDecoder`, `atob`/`btoa`, and recursive Gmail payload traversal. Prefer `text/plain`; for HTML-only bodies parse with `DOMParser` in browsers and strip tags with a conservative fallback in Node tests. Return text only; never return trusted HTML.

Create replies using CRLF, folded-safe fixed headers, base64url encoding, and a random boundary from `crypto.randomUUID()`. Reject attachments above 10 MiB each or 20 MiB total before building MIME.

- [ ] **Step 6: Run primitive tests**

```bash
node scripts/test_gmail_model.js
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit Gmail primitives**

```bash
git add console/gmail-model.js scripts/test_gmail_model.js
git commit -m "feat(cs): add safe Gmail message primitives"
```

### Task 2: Add the browser-only Gmail client

**Files:**
- Create: `console/gmail-api.js`
- Modify: `console/auth.js`
- Test: `scripts/test_gmail_model.js`
- Modify: `scripts/check_house_duck_console.sh`

**Interfaces:**
- Consumes: GIS client ID and `GmailModel`
- Produces: `window.GmailAPI` with in-memory token only

- [ ] **Step 1: Add failing request-shape tests**

Extract `buildGmailRequest()` as a pure helper and assert:

- every URL begins `https://gmail.googleapis.com/gmail/v1/users/me/`;
- bearer token is an argument, never persisted;
- support list query always includes `to:support@houseduck.in`;
- page size is at most 50;
- thread/message IDs are URL encoded.

- [ ] **Step 2: Run and confirm failure**

```bash
node scripts/test_gmail_model.js
```

Expected: FAIL on missing request builder.

- [ ] **Step 3: Initialize incremental Gmail authorization**

Use:

```js
google.accounts.oauth2.initTokenClient({
  client_id: GOOGLE_CLIENT_ID,
  scope: "https://www.googleapis.com/auth/gmail.modify",
  callback: handleGmailToken,
});
```

Request the token only from a user click in the CS view. Keep it in a module variable with `expires_at`; do not use `localStorage`, `sessionStorage`, IndexedDB, cookies, query strings, or Supabase.

- [ ] **Step 4: Implement bounded Gmail REST methods**

Use direct `fetch` for:

- `users.labels.list/create`;
- `users.threads.list/get/modify`;
- `users.messages.attachments.get`;
- `users.messages.send`.

On 401, clear only Gmail state and return `gmail_reconnect_required`; do not log the response body or token.

- [ ] **Step 5: Ensure CS labels idempotently**

List labels once, map exact names, create only missing names, and cache IDs in memory. Never rename or delete existing Gmail labels. Status transitions call `threads.modify` with all other status IDs removed.

- [ ] **Step 6: Implement reply send**

Fetch the latest thread headers, build raw MIME through `GmailModel`, send with both `raw` and `threadId`, and set status to `waiting_customer` only after a successful send response. If the `support@houseduck.in` alias is rejected, return `send_as_rejected` and preserve the draft in memory.

- [ ] **Step 7: Strengthen the public-site scan**

Fail if console files contain Gmail bearer tokens, token-storage keys, `localStorage` for Gmail, mail body logging, `/functions/` Gmail proxy calls, or a scope broader than exact `gmail.modify`.

- [ ] **Step 8: Run client contracts**

```bash
node scripts/test_gmail_model.js
bash scripts/check_house_duck_console.sh
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: PASS.

- [ ] **Step 9: Commit the Gmail client**

```bash
git add console/gmail-api.js console/auth.js scripts/test_gmail_model.js scripts/check_house_duck_console.sh
git commit -m "feat(cs): connect Gmail in browser memory"
```

### Task 3: Build the complete CS workspace

**Files:**
- Create: `console/cs.js`
- Create: `console/cs-templates.js`
- Modify: `console/index.html`
- Modify: `console/styles.css`
- Modify: `console/app.js`
- Test: `scripts/test_gmail_model.js`

**Interfaces:**
- Consumes: `GmailAPI`, `GmailModel`, `ConsoleAPI` player search
- Produces: CS list, thread reader, attachments, labels, reply composer, player deep link

- [ ] **Step 1: Add failing CS state tests**

Assert that:

- an unlabeled support thread becomes `new`;
- an external latest message maps to `needs_reply` unless done;
- a successful outgoing reply maps to `waiting_customer`;
- done removes `INBOX` and can be reopened;
- `needs_reply` older than 24 hours is urgent;
- a detected display code builds a player search deep link.

- [ ] **Step 2: Run and confirm failure**

```bash
node scripts/test_gmail_model.js
```

Expected: FAIL on missing CS state functions.

- [ ] **Step 3: Implement the CS list**

Render status/category/unread/date filters, Gmail query search, result count estimate, pagination, sender, subject, latest time, wait duration, and attachment badge. Fetch thread detail only when selected. Never preload the whole mailbox.

- [ ] **Step 4: Implement the safe thread reader**

Set message content through `textContent`. Do not load remote images. Show attachment metadata and fetch bytes only after a download click. Create Blob URLs for download and revoke each URL after use.

- [ ] **Step 5: Implement status/category controls**

Use real buttons with `aria-pressed`. Apply exactly one status label and at most one category label. `완료` archives by removing `INBOX`; `다시 열기` adds `INBOX` and `needs_reply`.

- [ ] **Step 6: Implement reply composition**

Provide Korean/English/German templates as plain strings with no personal facts. Show from/to/subject/body/attachment review. Require a confirmation dialog immediately before send. Keep draft and attachment bytes in memory until success/cancel/navigation.

- [ ] **Step 7: Link a support case to the player view**

Extract display code from the visible thread in browser memory, call a bounded player search, and show candidates as `nickname · displayCode`. Clicking opens `#/players/{userId}?return=%23%2Fcs` without storing the Gmail thread ID server-side.

- [ ] **Step 8: Style desktop and mobile CS**

Desktop uses three panes only when width permits; tablet/mobile uses list → thread → reply navigation with a visible back button. Keep focus on the opened thread and restore it to the list item when returning.

- [ ] **Step 9: Run CS and site tests**

```bash
node scripts/test_gmail_model.js
node scripts/test_console_model.js
bash scripts/check_house_duck_console.sh
bash scripts/check_analytics_dashboard.sh
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: PASS.

- [ ] **Step 10: Commit the CS workspace**

```bash
git add console/cs.js console/cs-templates.js console/index.html console/styles.css console/app.js scripts/test_gmail_model.js
git commit -m "feat(console): add full Gmail support workspace"
```

### Task 4: Configure Google Gmail access with minimal owner input

**Files:**
- No repository secret files
- Modify only Google Cloud project settings associated with the existing web OAuth client

**Interfaces:**
- Consumes: existing Google OAuth client ID and owner Google account
- Produces: Gmail API enabled, authorized origin, test-user access

- [ ] **Step 1: Open the Google Cloud project for the existing client ID**

Use the authenticated browser session. Confirm the client ID matches the one already used by House Duck Pulse. Do not create a second OAuth client unless the existing project cannot be identified.

- [ ] **Step 2: Enable Gmail API**

In Google Cloud APIs & Services, enable `Gmail API`. Record only the enabled/disabled result in the work log; do not export credentials.

- [ ] **Step 3: Configure the web origin**

Confirm authorized JavaScript origins include:

```text
https://houseduck.in
https://www.houseduck.in
http://localhost:8000
http://127.0.0.1:8000
```

Do not add wildcard origins.

- [ ] **Step 4: Configure audience and scope**

Add only `https://www.googleapis.com/auth/gmail.modify` and the owner's Google account as a test user when the app remains External Testing. Explain Google's warning in one line and ask the owner only to approve the consent/2FA prompt.

- [ ] **Step 5: Verify browser authorization without reading unrelated mail**

Open local `/console/#/cs`, click Gmail connect, and verify the granted scope. Query only `to:support@houseduck.in`; do not run broad inbox searches. Confirm the four status labels can be listed/created.

- [ ] **Step 6: Verify the send-as alias without sending**

Open the existing Gmail `Send mail as` setting in the authenticated browser and confirm `support@houseduck.in` is present and verified. Do not expose the personal Gmail address or App Password in logs/screenshots.

### Task 5: Integrate, document, and run complete QA

**Files:**
- Modify: `site_repo/README.md`
- Modify: `site_repo/SECURITY.md`
- Modify: `site_repo/.github/workflows/public-site-security.yml`
- Modify: `quirky-ball/docs/tech_stack.md`
- Modify: `quirky-ball/docs/development_policy.md`
- Modify: `quirky-ball/docs/work_history.md`
- Modify only defect-related implementation files

**Interfaces:**
- Consumes: all three implementation plans
- Produces: documented, verified release candidate

- [ ] **Step 1: Add repository documentation**

Document `/console/`, its two-step auth, server-only game mutations, browser-only Gmail token, test commands, and the rule that mail/receipts/secrets never enter the public repo. Add the same reusable admin mutation and Gmail boundaries to Quirky Ball canonical policy/tech stack without copying the full design.

- [ ] **Step 2: Expand CI**

Run these in `public-site-security.yml`:

```yaml
- run: bash scripts/check_public_repo.sh --all
- run: bash scripts/check_house_duck_console.sh
- run: bash scripts/check_analytics_dashboard.sh
- run: node scripts/test_console_model.js
- run: node scripts/test_gmail_model.js
- run: node scripts/test_pulse_model.js
```

- [ ] **Step 3: Run complete site validation**

```bash
bash scripts/check_brand_site.sh
bash scripts/check_legal_site.sh
node scripts/test_legal_site.js
bash scripts/check_policy_content.sh
bash scripts/check_house_duck_console.sh
bash scripts/check_analytics_dashboard.sh
node scripts/test_console_model.js
node scripts/test_gmail_model.js
node scripts/test_pulse_model.js
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: all PASS.

- [ ] **Step 4: Run complete backend/client validation**

```bash
deno test --allow-read supabase/functions/_shared/admin_access_test.ts supabase/functions/admin-console/admin_console_logic_test.ts supabase/functions/analytics-dashboard/analytics_logic_test.ts supabase/functions/analytics-dashboard/analytics_time_test.ts
bash scripts_dev/qa/run_qa.sh qa_account_state_conflict_test
bash scripts_dev/qa/run_qa.sh qa_account_overview_contract_test
bash scripts_dev/qa/run_qa.sh qa_supabase_offline_queue_test
bash scripts_dev/qa/run_qa.sh smoke
/Applications/Godot.app/Contents/MacOS/Godot --path . --headless --quit
git diff --check
```

Expected: all PASS and no real save mutation.

- [ ] **Step 5: Browser QA without real game writes**

At 1440×900, 1440×700, and 390×844 verify login, challenge, all routes, search/sort/page, deep links, mutation-disabled state, CS connect/list/thread/labels, attachment download, draft retention, keyboard focus, and no horizontal page overflow. Use test/mocked player data for edit confirmation; do not modify a real player yet.

- [ ] **Step 6: Perform one approved Gmail send test**

Ask the owner for the recipient and explicit approval. Send one message from `support@houseduck.in`, verify it appears in the same Gmail thread and status changes to `사용자 회신 대기`. Do not send if approval or alias verification is missing.

- [ ] **Step 7: Commit integration documentation and fixes**

In each repository, stage only console-related files and inspect `git diff --cached --name-status` before commit.

```bash
git commit -m "docs: record House Duck console operations"
```

Use separate commits if site and game repositories both changed.

### Task 6: Deploy safely and verify live

**Files:**
- No new files unless deployment defects require a narrow fix

**Interfaces:**
- Consumes: verified commits, Supabase credentials already configured on the machine, GitHub Pages main
- Produces: live console and backend with writes disabled by default

- [ ] **Step 1: Check branch and concurrent-work boundaries**

Run in both repositories:

```bash
git status --short
git log -5 --oneline --decorate
git diff --name-only main...HEAD
```

Compare console files with the original dirty Quirky Ball worktree. If paths overlap, do not stash, reset, or overwrite; report the exact overlap. If they do not overlap, cherry-pick feature commits into main while preserving unrelated unstaged changes, then verify staged/index state.

- [ ] **Step 2: Verify Supabase CLI commands before use**

```bash
supabase db --help
supabase functions --help
supabase secrets --help
supabase migration list --linked
```

Expected: CLI is authenticated and the linked project matches `bbgwvpwzkyudbtcgrbtm`. If OAuth/login is requested, ask the owner only to approve it.

- [ ] **Step 3: Set Edge secrets without printing values**

Set `ADMIN_CHALLENGE_SHA256` and a fresh random `ADMIN_SESSION_SECRET` through `supabase secrets set` using environment/stdin-safe input. Never echo the challenge answer, hash, or signing secret. Confirm only secret names through the list command.

- [ ] **Step 4: Apply migrations and verify permissions**

Apply the CLI-generated migrations through the supported linked-project command discovered in Step 2. Re-run `supabase migration list --linked`, security advisors, RLS/GRANT queries, function execute grants, default-false mutation flag, and negative role tests. Stop before any live player write.

- [ ] **Step 5: Deploy Edge Functions in safe order**

Deploy `admin-auth` and `admin-console`, then deploy the updated `analytics-dashboard`. Smoke test missing token, wrong Google account, missing challenge ticket, expired ticket, valid read, and mutations-disabled responses. Never log response payloads containing player rows.

- [ ] **Step 6: Push the public site**

Fast-forward the verified site feature branch into `site_repo/main`, run the complete site validation once more, and push `main`. Do not force push.

- [ ] **Step 7: Verify the live site with cache busting**

Check:

```text
Append the actual short value returned by `git rev-parse --short HEAD` as the `v` query parameter, then open both the console URL and the analytics compatibility URL.
```

Confirm `/analytics/` reaches console analysis, public pages/legal links are unchanged, the deployed asset markers match the commit, unauthorized data calls fail, and valid owner login reaches read-only console.

- [ ] **Step 8: Report exact completion and remaining gates**

Report:

- site commit and game/backend commit;
- migrations and functions deployed;
- Google/Gmail configuration state;
- automated PASS/FAIL counts;
- tested browser sizes;
- real Gmail send result;
- mutation flag state;
- Android/iOS/Safari and real-player mutation coverage explicitly unverified unless separately performed.

Do not enable `admin_player_mutations_enabled` until a compatible Quirky Ball build has passed release QA and the owner explicitly requests live mutation activation.
