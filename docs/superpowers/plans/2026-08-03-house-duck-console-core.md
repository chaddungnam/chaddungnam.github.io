# House Duck Console Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Pulse를 통합 콘솔로 옮기고 Google 허용 계정과 서버 질문 인증 뒤 기간별 플레이어를 검색·정렬할 수 있게 한다.

**Architecture:** GitHub Pages의 정적 `/console/` 셸이 Google ID 토큰과 30분 관리자 티켓을 보관하고 Supabase Edge Function만 호출한다. 기존 분석 함수는 공용 관리자 검증을 재사용하며, 기간별 플레이어는 계정과 분리된 분석 이벤트를 억지 연결하지 않고 `game_records.played_at` 기준 서버 RPC로 집계한다.

**Tech Stack:** HTML/CSS/vanilla JavaScript, Node.js 26 assertions, Deno 2.9 tests, Supabase Edge Functions/Postgres, Google Identity Services

## Global Constraints

- 정답 평문·해시, `service_role`, Gmail 토큰, 사용자 데이터는 공개 `site_repo`에 넣지 않는다.
- 기존 Google client ID, `verifyGoogleIdToken()`, Pulse 모델과 CSS를 재사용한다.
- `admin-auth`와 `analytics-dashboard`는 Google ID 토큰을 자체 검증하므로 기존 Pulse와 같이 `--no-verify-jwt`로 배포한다. Supabase 게이트웨이 검사를 끈 대신 함수 내부 Google 검증·이메일 허용표·관리자 티켓을 모두 통과해야 한다.
- 외부 프런트엔드 프레임워크와 새 npm 의존성을 추가하지 않는다.
- Project K와 구매는 실제 연결처럼 꾸미지 않고 `준비 중`·`결제 미연동`으로 표시한다.
- 분석 플레이어는 `user_id`당 한 행이며 동명이인은 표시 코드로 구분한다.
- Quirky Ball의 현재 더러운 작업 폴더를 직접 수정하지 않고 실행 시 별도 git worktree를 사용한다.
- Supabase migration 파일은 `supabase migration new`로만 생성하고 CLI가 반환한 실제 경로를 사용한다.

---

## Repository Map

- Site root: `/Users/junheechoi/projects/houseduck/quirky-ball/site_repo`
- Game/backend root: `/Users/junheechoi/projects/houseduck/quirky-ball`
- Design source: `site_repo/docs/superpowers/specs/2026-08-03-house-duck-console-design.md`

### Files created or changed

- Create `site_repo/console/index.html`: 공통 셸과 분석·플레이어·운영·구매·CS·감사 화면 컨테이너
- Create `site_repo/console/styles.css`: 기존 Pulse 시각 언어와 콘솔 내비게이션·표·반응형 스타일
- Create `site_repo/console/auth.js`: Google ID와 질문 인증, 관리자 티켓 수명주기
- Create `site_repo/console/api.js`: 인증 헤더를 붙이는 Edge Function 요청 한 곳
- Create `site_repo/console/model.js`: 라우팅·플레이어 중복 제거·정렬 표시의 순수 함수
- Create `site_repo/console/analytics.js`: 기존 Pulse 렌더링과 기간별 플레이어 표
- Create `site_repo/console/app.js`: 라우터, 프로젝트 선택, 공통 셸 제어
- Modify `site_repo/analytics/index.html`: 콘솔 분석 경로 연결
- Modify `site_repo/analytics/app.js`: 렌더링 코드를 콘솔 모듈로 이관한 뒤 레거시 실행 제거
- Reuse `site_repo/analytics/pulse-model.js`: Pulse 판정 정본
- Create `site_repo/scripts/test_console_model.js`: 프런트 순수 함수 계약
- Create `site_repo/scripts/check_house_duck_console.sh`: 공개 파일·인증·경로 계약
- Modify `site_repo/scripts/check_analytics_dashboard.sh`: 새 콘솔 경로와 이중 인증 검사
- Create `quirky-ball/supabase/functions/_shared/admin_access.ts`: 관리자 티켓 서명·검증
- Create `quirky-ball/supabase/functions/_shared/admin_access_test.ts`: 티켓 단위 테스트
- Create `quirky-ball/supabase/functions/admin-auth/index.ts`: 질문 인증과 티켓 발급
- Modify `quirky-ball/supabase/functions/analytics-dashboard/index.ts`: 관리자 티켓 필수화와 기간 플레이어 응답
- Create via CLI `quirky-ball/supabase/migrations/*_house_duck_console_auth.sql`: 인증 실패 제한과 기간 플레이어 RPC

## Interfaces

```ts
type AdminTicketClaims = {
  sub: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

normalizeChallenge(value: string): string
issueAdminTicket(identity: {sub: string; email: string}, secret: string, now: number): Promise<string>
verifyAdminTicket(ticket: string, secret: string, identity: {sub: string; email: string}, now: number): Promise<AdminTicketClaims | null>
```

```js
window.ConsoleAuth = {
  initialize({ clientId, authUrl }),
  unlock(answer),
  headers(),
  isUnlocked(),
  logout(),
};

window.ConsoleModel = {
  routeFromHash(hash),
  dedupePlayers(rows),
  playerDisplayName(player),
};
```

The `analytics-dashboard` response adds:

```ts
type PeriodPlayer = {
  userId: string;
  nickname: string;
  displayCode: string;
  country: string;
  accountType: string;
  gamesPlayed: number;
  bestScore: number;
  bestLevel: number;
  latestPlayedAt: string;
  gems: number;
  stamina: number;
  breakthroughTickets: number;
  speedBoostTickets: number;
};
```

### Task 1: Add server-side administrator tickets

**Files:**
- Create: `supabase/functions/_shared/admin_access.ts`
- Test: `supabase/functions/_shared/admin_access_test.ts`
- Create: CLI-generated `supabase/migrations/*_house_duck_console_auth.sql`
- Create: `supabase/functions/admin-auth/index.ts`

**Interfaces:**
- Consumes: `verifyGoogleIdToken(token)` and `analytics_admins.email`
- Produces: `issueAdminTicket()`, `verifyAdminTicket()`, `POST /functions/v1/admin-auth`

- [ ] **Step 1: Create the migration through the CLI**

Run from the Quirky Ball worktree:

```bash
supabase migration new house_duck_console_auth
```

Expected: one empty migration path whose filename ends in `_house_duck_console_auth.sql` printed by the CLI. Record that exact path in the task notes and use it for the remaining steps.

- [ ] **Step 2: Write failing Deno ticket tests**

Create assertions covering normalization, valid signature, expiry, changed email, changed Google subject, and altered payload:

```ts
Deno.test("admin ticket is bound to Google identity and expiry", async () => {
  const identity = { sub: "google-1", email: "owner@example.com" };
  const ticket = await issueAdminTicket(identity, "test-secret", 1_000);
  assert(await verifyAdminTicket(ticket, "test-secret", identity, 1_001));
  assertEquals(await verifyAdminTicket(ticket, "test-secret", { ...identity, sub: "google-2" }, 1_001), null);
  assertEquals(await verifyAdminTicket(ticket, "test-secret", identity, 2_801), null);
});
```

- [ ] **Step 3: Run the test and confirm failure**

Run:

```bash
deno test supabase/functions/_shared/admin_access_test.ts
```

Expected: FAIL because `admin_access.ts` does not exist.

- [ ] **Step 4: Implement the minimum ticket utility**

Use Web Crypto HMAC-SHA256, base64url encoding, a 1,800-second TTL, `NFKC` + trim normalization, and constant-time byte comparison. Do not add JWT libraries.

```ts
export function normalizeChallenge(value: string): string {
  return value.normalize("NFKC").trim();
}
```

Ticket payload keys must be exactly `sub`, `email`, `iat`, and `exp`.

- [ ] **Step 5: Add the auth-attempt table**

In the CLI-generated migration create `public.admin_auth_attempts` keyed by a SHA-256 Google subject hash with `failure_count`, `window_started_at`, `locked_until`, and `updated_at`. Enable RLS, revoke `PUBLIC`/`anon`/`authenticated`, and grant only `service_role`.

Add indexes only for the primary key; the table has one row per allowed administrator and needs no speculative indexes.

- [ ] **Step 6: Implement `admin-auth`**

The function must:

1. allow only configured origins and `POST`/`OPTIONS`;
2. verify the Google ID token;
3. look up the lowercase email in `analytics_admins`;
4. enforce five failures per 15 minutes;
5. hash the normalized answer and compare with `ADMIN_CHALLENGE_SHA256`;
6. return `{ adminTicket, expiresIn: 1800, email }`;
7. never log the answer or token.

Return stable errors: `invalid_google_identity`, `admin_required`, `challenge_required`, `challenge_invalid`, `challenge_locked`, `server_not_configured`.

- [ ] **Step 7: Run auth tests**

Run:

```bash
deno test supabase/functions/_shared/admin_access_test.ts
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 8: Commit the auth boundary**

```bash
git add supabase/functions/_shared/admin_access.ts supabase/functions/_shared/admin_access_test.ts supabase/functions/admin-auth/index.ts supabase/migrations/*_house_duck_console_auth.sql
git commit -m "feat(admin): add two-step console authentication"
```

### Task 2: Build the static console shell and shared login

**Files:**
- Create: `console/index.html`
- Create: `console/styles.css`
- Create: `console/auth.js`
- Create: `console/api.js`
- Create: `console/model.js`
- Create: `console/app.js`
- Test: `scripts/test_console_model.js`

**Interfaces:**
- Consumes: `POST /functions/v1/admin-auth`
- Produces: `window.ConsoleAuth`, `window.ConsoleAPI`, `window.ConsoleModel`, route containers

- [ ] **Step 1: Write failing route and player identity tests**

```js
assert.deepEqual(model.routeFromHash("#/players/abc"), { page: "player", userId: "abc" });
assert.equal(model.dedupePlayers([{ userId: "1" }, { userId: "1" }, { userId: "2" }]).length, 2);
assert.equal(model.playerDisplayName({ nickname: "Duck", displayCode: "AB12" }), "Duck · AB12");
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
node scripts/test_console_model.js
```

Expected: FAIL because `console/model.js` is missing.

- [ ] **Step 3: Implement the pure model**

Export with the existing browser/Node UMD pattern used by `analytics/pulse-model.js`. Decode route components, reject missing player IDs, and deduplicate only by `userId`; never by nickname.

- [ ] **Step 4: Create the accessible shell markup**

Add a login panel, challenge form, project picker, navigation, view containers, skip link, live status region, and confirmation dialog. Buttons require real `<button>` elements and forms require labels. Project K and Purchases must have explicit inactive copy.

Load scripts from the same origin except Google Identity Services:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
<script src="../analytics/pulse-model.js"></script>
<script src="model.js"></script>
<script src="auth.js"></script>
<script src="api.js"></script>
<script src="analytics.js"></script>
<script src="app.js" defer></script>
```

- [ ] **Step 5: Implement shared auth state**

Store only the Google ID token and opaque admin ticket in `sessionStorage`. Keep the answer in the form value only and clear it in `finally`. `ConsoleAuth.headers()` returns exactly four headers: `apikey` with the existing public publishable key, `Authorization` with the Google ID bearer token, `X-Admin-Session` with the opaque ticket, and JSON `Content-Type`.

Logout clears both values and calls Google disable/revoke APIs when present.

- [ ] **Step 6: Implement a single API wrapper**

`ConsoleAPI.post(functionName, body)` must call only the configured Supabase function origin, attach `ConsoleAuth.headers()`, parse JSON once, and map 401 to full sign-in and 403 `admin_session_required` to the challenge screen.

- [ ] **Step 7: Style the shared shell**

Reuse Pulse colors, fonts, border radii, focus rings, and mobile breakpoints. Keep the first viewport focused on `주의 필요`/analysis rather than generic blank dashboard chrome. At 390px, navigation becomes a horizontal bottom-safe row and tables remain horizontally scrollable.

- [ ] **Step 8: Run frontend contracts**

```bash
node scripts/test_console_model.js
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: all PASS.

- [ ] **Step 9: Commit the console shell**

```bash
git add console scripts/test_console_model.js
git commit -m "feat(console): add unified shell and two-step login"
```

### Task 3: Add exact period-player aggregation

**Files:**
- Modify: CLI-generated `supabase/migrations/*_house_duck_console_auth.sql`
- Modify: `supabase/functions/analytics-dashboard/index.ts`
- Test: `supabase/functions/analytics-dashboard/analytics_logic_test.ts`

**Interfaces:**
- Consumes: `rangeDays` in `{1,7,28}`, `projectKey="quirky_ball"`
- Produces: `periodPlayers: PeriodPlayer[]`, `periodPlayerTotal: number`

- [ ] **Step 1: Add a failing pure aggregation contract**

Add test fixtures with two game rows for one `user_id`, another user with the same nickname, and a user outside the range. Assert one row per user, correct game count and best score, and preservation of both same-nickname users.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
deno test supabase/functions/analytics-dashboard/analytics_logic_test.ts
```

Expected: FAIL because the period-player projection is absent.

- [ ] **Step 3: Add `admin_list_period_players_v1` in the migration**

The service-role-only function accepts range days, search, sort, direction, limit, and offset. It starts from `game_records` in the range, groups by `user_id`, joins `profiles` and `account_states`, and returns one row per user. Validate ranges `{1,7,28}`, sort keys `{latest_played_at,best_score,games_played,nickname,country,gems}`, directions `{asc,desc}`, limit `1..100`, and nonnegative offset before querying.

Use explicit `CASE` ordering or an allowlisted `format('%I', ...)`; never interpolate raw request values.

Revoke execute from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`.

- [ ] **Step 4: Require the admin ticket in analytics**

Update CORS to permit `x-admin-session`. Verify the Google ID first, then verify the ticket with `ADMIN_SESSION_SECRET` and the same Google subject/email. Return `403 admin_session_required` for missing, expired, or mismatched tickets.

Keep `admin-auth` and `analytics-dashboard` deployment on the repository's established `--no-verify-jwt --use-api --project-ref bbgwvpwzkyudbtcgrbtm --yes` path because their `Authorization` header carries a Google ID token, not a Supabase JWT. Never apply this flag to a function that lacks its own complete credential verification.

- [ ] **Step 5: Fetch the period page**

Call `admin_list_period_players_v1` with the dashboard's selected range and a default page of 50. Return the page and total count next to existing Pulse data. Keep raw `analytics_events` server-only.

- [ ] **Step 6: Run Edge tests**

```bash
deno test supabase/functions/_shared/admin_access_test.ts supabase/functions/analytics-dashboard/analytics_logic_test.ts supabase/functions/analytics-dashboard/analytics_time_test.ts
git diff --check
```

Expected: all PASS.

- [ ] **Step 7: Commit the secured analytics response**

```bash
git add supabase/functions/analytics-dashboard supabase/functions/_shared/admin_access.ts supabase/migrations/*_house_duck_console_auth.sql
git commit -m "feat(analytics): add secured period player list"
```

### Task 4: Move Pulse into the console and add player search/sort

**Files:**
- Create: `console/analytics.js`
- Modify: `console/index.html`
- Modify: `console/styles.css`
- Modify: `console/app.js`
- Modify: `analytics/index.html`
- Modify: `analytics/app.js`
- Create: `scripts/check_house_duck_console.sh`
- Modify: `scripts/check_analytics_dashboard.sh`
- Test: `scripts/test_console_model.js`
- Test: `scripts/test_pulse_model.js`

**Interfaces:**
- Consumes: existing Pulse payload plus `periodPlayers`
- Produces: `ConsoleAnalytics.mount()`, `ConsoleAnalytics.load(filters)`, player deep links

- [ ] **Step 1: Extend failing frontend tests**

Assert that query parameters preserve `rangeDays`, `distributionKey`, `sort`, `direction`, and `page`, and that two same-nickname/different-ID rows remain visible.

Also assert that `buildAttentionItems()` projects only existing Pulse warning/error/no-data states into the `주의 필요` list. Do not invent a player-ban heuristic or automatic sanction.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node scripts/test_console_model.js
node scripts/test_pulse_model.js
```

Expected: console test FAIL on missing filter serialization; Pulse test remains PASS.

- [ ] **Step 3: Extract Pulse rendering without changing the model**

Move dashboard fetch/render/event binding from `analytics/app.js` to `console/analytics.js`. Keep `analytics/pulse-model.js` unchanged. Remove direct Google login logic from the renderer; it receives headers from `ConsoleAPI`.

- [ ] **Step 4: Render period players**

Add a search field, sortable headers, page controls, and rows with `nickname · displayCode`. The row link must be:

```js
`#/players/${encodeURIComponent(player.userId)}?return=${encodeURIComponent(currentAnalyticsHash)}`
```

Label the table `기간 내 플레이 기록 계정` and explain that app-only opens can exist outside the table.

Render `주의 필요` above the table from the existing Pulse model outcomes. Each item links to the affected analytics section and shows its source and observation time; an all-clear state is one short line. The Gmail plan may append unanswered-CS items to this same in-memory list later, without adding a second alert system.

- [ ] **Step 5: Add compatibility navigation**

Replace `/analytics/index.html` with a no-secret same-origin redirect to `/console/#/analytics`. Keep `pulse-model.js` at its existing path for tests. Reduce `analytics/app.js` to no executable auth/data logic or remove its script reference entirely.

- [ ] **Step 6: Add static contracts**

`check_house_duck_console.sh` must fail if:

- console files or required route containers are missing;
- the public console contains `ADMIN_CHALLENGE`, `service_role`, Gmail access tokens, or password assignment;
- analytics calls Supabase tables directly;
- Google plus challenge UI is missing;
- Project K/purchase inactive labels are missing.

- [ ] **Step 7: Run the site suite**

```bash
bash scripts/check_house_duck_console.sh
bash scripts/check_analytics_dashboard.sh
node scripts/test_console_model.js
node scripts/test_pulse_model.js
bash scripts/check_brand_site.sh
bash scripts/check_legal_site.sh
node scripts/test_legal_site.js
bash scripts/check_policy_content.sh
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: all PASS.

- [ ] **Step 8: Commit the integrated read-only console**

```bash
git add analytics console scripts/check_house_duck_console.sh scripts/check_analytics_dashboard.sh scripts/test_console_model.js
git commit -m "feat(console): integrate analytics and period players"
```

### Task 5: Browser-review the core without live writes

**Files:**
- Modify only files required by defects found in Task 4

**Interfaces:**
- Consumes: local static server, mock server payloads
- Produces: visually verified read-only console core

- [ ] **Step 1: Start the existing static site locally**

```bash
python3 -m http.server 8000
```

Run it from the site worktree and keep the process retained.

- [ ] **Step 2: Use mocked API payloads for locked/read-only QA**

Open `http://127.0.0.1:8000/console/` and verify 1440×900 and 390×844 layouts. Do not call live player mutation APIs. Check login, challenge, navigation, Pulse, table overflow, search, sort, pagination, deep-link return, keyboard focus, and inactive Project K/purchases.

- [ ] **Step 3: Fix only observed core defects**

For each defect, add one assertion to `test_console_model.js` or `check_house_duck_console.sh`, reproduce the failure, make the smallest fix, and rerun the focused check.

- [ ] **Step 4: Run the full core suite**

Run the Task 4 Step 7 command list again.

Expected: all PASS. Record that real Gmail, live mutation, Android, iOS, and Safari remain outside this core plan.

- [ ] **Step 5: Commit browser fixes if any**

```bash
git add console analytics scripts
git commit -m "fix(console): resolve core browser QA findings"
```

Skip the commit only when there is no diff.
