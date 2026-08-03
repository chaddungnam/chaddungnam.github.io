# House Duck Console Player Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quirky Ball 플레이어 재화와 점수를 콘솔에서 검색·수정하되 실행 중인 오래된 클라이언트가 관리자 값을 덮어쓰지 못하게 한다.

**Architecture:** 계정 상태 저장을 버전 비교 RPC로 중앙화하고 관리자 수정도 같은 행 잠금·버전 증가를 사용한다. `admin-console` Edge Function이 허용된 읽기·명령만 service role로 호출하며 모든 성공·실패와 되돌리기를 감사 행으로 남긴다.

**Tech Stack:** Godot 4.7/GDScript, Supabase Postgres/RLS/RPC/Edge Functions, Deno tests, vanilla JavaScript console UI

## Global Constraints

- 실제 `user://save_data.json`을 사용하는 QA를 실행하지 않는다. `scripts_dev/qa/run_qa.sh` 격리 러너를 사용한다.
- 현재 더러운 Quirky Ball 작업 폴더를 직접 수정하지 않고 별도 worktree에서 작업한다.
- 재화·점수 변경은 음수, 타입 오염, 예상 버전 불일치, 빈 사유를 서버에서 거부한다.
- 원본 경쟁 기록은 삭제하지 않고 보정·제외 메타데이터와 감사를 남긴다.
- 새 앱의 버전 충돌 계약이 배포되기 전까지 실제 수정 UI는 서버 기능 플래그로 비활성화한다.
- `SECURITY DEFINER`는 `search_path=''`, 명시적 객체명, 실행권한 회수와 service-role/authenticated 최소 grant를 한 묶음으로 적용한다.
- `admin-console`은 Google ID 토큰과 관리자 티켓을 자체 검증하므로 기존 Pulse와 동일한 `--no-verify-jwt` 배포 경로만 사용한다.
- 복구 코드, 토큰, 메일, receipt는 운영 응답과 감사 데이터에 넣지 않는다.
- Supabase migration 파일은 `supabase migration new`로 생성한 실제 경로만 사용한다.

---

## Repository Map

- Site root: `/Users/junheechoi/projects/houseduck/quirky-ball/site_repo`
- Game/backend root: `/Users/junheechoi/projects/houseduck/quirky-ball`
- Depends on: `2026-08-03-house-duck-console-core.md`

### Files created or changed

- Create via CLI `supabase/migrations/*_house_duck_console_player_operations.sql`: optimistic save, audit, player mutation, score correction, feature flag
- Modify `scripts/backend/AccountService.gd`: `save_my_account_state_v2` 호출과 충돌 재조회
- Modify `scripts/SupabaseClient.gd`: account state RPC route constants only if required
- Modify `scripts_dev/qa/quirky_ball/qa_account_overview_contract_test.gd`: conflict payload sanitization
- Create `scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.gd`
- Create `scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.tscn`
- Modify `scripts_dev/qa/smoke.list` only if the new suite is release-critical and runtime is short
- Create `supabase/functions/admin-console/admin_console_logic.ts`: input allowlists and mutation payload normalization
- Create `supabase/functions/admin-console/admin_console_logic_test.ts`: pure request tests
- Create `supabase/functions/admin-console/index.ts`: secured player read/write endpoint
- Create `site_repo/console/players.js`: player list, detail, timeline, edits
- Create `site_repo/console/operations.js`: notices, mail, version, QA access
- Create `site_repo/console/audit.js`: audit list and inverse action
- Modify `site_repo/console/index.html`, `styles.css`, `app.js`, `api.js`
- Extend `site_repo/scripts/test_console_model.js` and `check_house_duck_console.sh`

## Interfaces

```sql
save_my_account_state_v2(p_expected_version bigint, p_state jsonb)
  returns jsonb -- {ok, conflict, state_version, state}

admin_mutate_player_v1(
  p_user_id uuid,
  p_expected_version bigint,
  p_changes jsonb,
  p_reason text,
  p_request_id uuid,
  p_actor_email text,
  p_reverts_action_id uuid default null
) returns jsonb

admin_correct_game_record_v1(
  p_record_id bigint,
  p_score integer,
  p_level integer,
  p_excluded boolean,
  p_replacement_best_score integer,
  p_replacement_best_level integer,
  p_reason text,
  p_request_id uuid,
  p_actor_email text
) returns jsonb
```

```ts
type AdminConsoleRequest =
  | { action: "players.list"; rangeDays: 1 | 7 | 28 | 0; query: string; sort: PlayerSort; direction: "asc" | "desc"; page: number }
  | { action: "players.get"; userId: string }
  | { action: "players.mutate"; userId: string; expectedVersion: number; changes: PlayerChanges; reason: string; requestId: string }
  | { action: "scores.correct"; recordId: number; score: number; level: number; excluded: boolean; replacementBestScore: number; replacementBestLevel: number; reason: string; requestId: string }
  | { action: "audit.list"; userId?: string; page: number }
  | { action: "audit.revert"; actionId: string; expectedVersion: number; reason: string; requestId: string }
  | { action: "operations.get"; userId?: string }
  | { action: "announcements.publish"; body: string; startsAt: string; endsAt: string | null; reason: string; requestId: string }
  | { action: "reward_mail.broadcast"; title: string; body: string; reward: RewardPayload; expiresAt: string; reason: string; requestId: string }
  | { action: "min_version.update"; minVersion: string; minVersionCode: number; reason: string; requestId: string }
  | { action: "qa_access.set"; userId: string; shopControlsEnabled: boolean; reason: string; requestId: string };
```

Allowed `PlayerChanges` keys are exactly `gems`, `stamina`, `stamina_max`, `breakthrough_tickets`, and `speed_boost_tickets`.

### Task 1: Add optimistic account-state persistence

**Files:**
- Create: CLI-generated `supabase/migrations/*_house_duck_console_player_operations.sql`
- Modify: `scripts/backend/AccountService.gd`
- Test: `scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.gd`
- Test scene: `scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.tscn`
- Modify test: `scripts_dev/qa/quirky_ball/qa_account_overview_contract_test.gd`

**Interfaces:**
- Consumes: current `_account_state_version`, `GameState._snapshot_account_scope()`
- Produces: `save_my_account_state_v2`, `AccountService.sanitize_account_save_result(raw)`

- [ ] **Step 1: Create the migration through the CLI**

```bash
supabase migration new house_duck_console_player_operations
```

Expected: the CLI prints one exact migration file. Use that path in all later commands and commits.

- [ ] **Step 2: Write the failing GDScript conflict test**

Build a fake host whose `_request_code()` returns this first response:

```gdscript
{
  "ok": false,
  "conflict": true,
  "state_version": 8,
  "state": {"gems": 90}
}
```

Assert that the service does not mark the stale hash synced, replaces `_account_state_version` with `8`, requests a fresh overview exactly once, and never enqueues the request.

- [ ] **Step 3: Run the new suite and verify it fails**

```bash
bash scripts_dev/qa/run_qa.sh qa_account_state_conflict_test
```

Expected: FAIL because the scene or sanitizer does not exist.

- [ ] **Step 4: Add `save_my_account_state_v2`**

The SQL function must:

1. derive `v_user := auth.uid()` and reject null;
2. validate `p_state` is an object and within the current account state byte ceiling;
3. lock the user's `account_states` row;
4. insert version `1` only when expected version is `0` and no row exists;
5. update only when current version equals `p_expected_version`;
6. return `{ok:false, conflict:true, state_version, state}` without changing data on mismatch;
7. return the new version on success.

Revoke execute from `PUBLIC`/`anon`, grant `authenticated`, and check `auth.uid()` inside the body.

- [ ] **Step 5: Route AccountService uploads through the RPC**

Replace the direct `POST /account_states?on_conflict=user_id` call with:

```gdscript
var path := "%s/rpc/save_my_account_state_v2" % _m._REST_PATH
var body := JSON.stringify({
  "p_expected_version": _m._account_state_version,
  "p_state": snap,
})
```

Do not increment the local version before the response. On success, take the returned version. On conflict, apply no stale hash, set the returned version, mark fetch incomplete, and call `_fetch_account_state()`.

- [ ] **Step 6: Add pure result sanitization**

`sanitize_account_save_result(raw)` unwraps a PostgREST array, accepts booleans and nonnegative versions, and returns `{}` for malformed payloads. Extend the overview contract test with success, conflict, and malformed cases.

- [ ] **Step 7: Run focused account QA**

```bash
bash scripts_dev/qa/run_qa.sh qa_account_state_conflict_test
bash scripts_dev/qa/run_qa.sh qa_account_overview_contract_test
bash scripts_dev/qa/run_qa.sh qa_supabase_offline_queue_test
git diff --check
```

Expected: all PASS and the real save hash unchanged.

- [ ] **Step 8: Commit optimistic persistence**

```bash
git add supabase/migrations/*_house_duck_console_player_operations.sql scripts/backend/AccountService.gd scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.gd scripts_dev/qa/quirky_ball/qa_account_state_conflict_test.tscn scripts_dev/qa/quirky_ball/qa_account_overview_contract_test.gd
git commit -m "feat(account): reject stale state uploads"
```

### Task 2: Add auditable player and score mutations

**Files:**
- Modify: CLI-generated `supabase/migrations/*_house_duck_console_player_operations.sql`
- Test: `supabase/functions/admin-console/admin_console_logic_test.ts`
- Create: `supabase/functions/admin-console/admin_console_logic.ts`

**Interfaces:**
- Consumes: `save_my_account_state_v2`, existing `broadcast_reward_mail`, `app_config`, `qa_user_access`, and the game notice read contract
- Produces: audit table, player mutation RPC, score correction RPC, four live-operations RPCs, admin feature flag

- [ ] **Step 1: Write failing mutation-normalization tests**

```ts
Deno.test("player changes use a fixed nonnegative integer allowlist", () => {
  assertEquals(normalizePlayerChanges({ gems: 12, stamina: 3 }), { gems: 12, stamina: 3 });
  assertThrows(() => normalizePlayerChanges({ recovery_code: "secret" }));
  assertThrows(() => normalizePlayerChanges({ gems: -1 }));
});
```

Also reject empty changes, blank reason, invalid UUID, score above the documented integer ceiling, and an unknown action.

Add fixtures for all five live-operation actions. Reject blank notices/mail/version, invalid time windows, unknown reward keys, negative rewards, non-integer version codes, and QA changes without a valid user UUID.

- [ ] **Step 2: Run tests and confirm failure**

```bash
deno test supabase/functions/admin-console/admin_console_logic_test.ts
```

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the pure allowlists**

Export `normalizeRequest()`, `normalizePlayerChanges()`, `normalizeReason()`, and `normalizePagination()`. Keep validation independent from Deno environment and Supabase client so it runs without network permissions.

- [ ] **Step 4: Add the audit table**

Create `public.admin_action_audit` with UUID primary key/request ID unique, action type, actor email, target user, reason, before/after JSON, expected/result version, success, error code, reverts action ID, and timestamps. Enable RLS, revoke all browser roles, grant service role only. Never store recovery code, tokens, Gmail content, or receipt data.

- [ ] **Step 5: Add mutation enablement**

Add `admin_player_mutations_enabled=false` to the private `app_config` source and expose only the boolean through the existing public config projection. The Edge Function must refuse writes with `mutations_disabled` while false.

- [ ] **Step 6: Add `admin_mutate_player_v1`**

The service-role-only function locks `account_states`, checks expected version, changes only the five allowlisted integer keys, enforces `0 <= stamina <= stamina_max`, increments version once, and writes one audit row in the same transaction. Repeated `p_request_id` returns the original result without applying twice.

- [ ] **Step 7: Add score correction metadata and RPC**

Add nullable `admin_excluded_at`, `admin_excluded_reason`, and `admin_corrected_at` to active and archive game-record tables. Update current/previous leaderboard views and archive copy SQL so excluded records never rank and exclusion survives archival.

`admin_correct_game_record_v1` must lock the target record and account state, update the selected score/level/exclusion, require explicit replacement best score/level when touching the current best, update `profiles` and account-state best fields together, increment state version, and write the audit row atomically.

- [ ] **Step 8: Normalize the announcement read contract**

Before writing the migration, inspect the linked `public.announcements` columns read-only and compare them with `Notice.gd`'s current `id`, `body`, and `created_at` expectation. Preserve those columns and add only `starts_at timestamptz not null default now()`, nullable `ends_at timestamptz`, and `active boolean not null default true`, with `ends_at > starts_at` when present.

Add or update the authenticated read RPC used by the game so it returns only active rows whose window contains `now()`. Do not expose console-only audit fields to the client.

- [ ] **Step 9: Add four audited live-operation RPCs**

Add service-role-only functions:

```sql
admin_publish_announcement_v1(p_body text, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_request_id uuid, p_actor_email text) returns jsonb
admin_broadcast_reward_mail_v1(p_title text, p_body text, p_reward jsonb, p_expires_at timestamptz, p_reason text, p_request_id uuid, p_actor_email text) returns jsonb
admin_update_min_version_v1(p_min_version text, p_min_version_code integer, p_reason text, p_request_id uuid, p_actor_email text) returns jsonb
admin_set_qa_access_v1(p_user_id uuid, p_shop_controls_enabled boolean, p_reason text, p_request_id uuid, p_actor_email text) returns jsonb
```

The mail wrapper reuses the existing `broadcast_reward_mail` validation and insert path. The version function changes only `min_version` and `min_version_code` in one transaction. The QA function upserts only `shop_controls_enabled`. Every function validates the reason and request ID, is idempotent by `p_request_id`, and writes the same audit table in the same transaction.

- [ ] **Step 10: Add SQL contract assertions to the Deno test**

Read the migration text with `Deno.readTextFile()` and assert it contains RLS enablement, `search_path = ''`, explicit revokes, request ID uniqueness, expected-version comparison, audit insertion, exclusion filtering, the default-false feature flag, active announcement windows, and all four live-operation RPC names.

- [ ] **Step 11: Run mutation tests**

```bash
deno test --allow-read supabase/functions/admin-console/admin_console_logic_test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 12: Commit mutation contracts**

```bash
git add supabase/migrations/*_house_duck_console_player_operations.sql supabase/functions/admin-console/admin_console_logic.ts supabase/functions/admin-console/admin_console_logic_test.ts
git commit -m "feat(admin): add auditable player corrections"
```

### Task 3: Expose the secured admin-console API

**Files:**
- Create: `supabase/functions/admin-console/index.ts`
- Modify: `supabase/functions/_shared/admin_access.ts`
- Test: `supabase/functions/admin-console/admin_console_logic_test.ts`

**Interfaces:**
- Consumes: validated `AdminConsoleRequest`, administrator identity, service-role-only RPCs
- Produces: `POST /functions/v1/admin-console`

- [ ] **Step 1: Add failing dispatch tests**

Test that each action maps to exactly one named read/RPC, writes require nonempty reason and request ID, and read actions never receive mutation fields.

- [ ] **Step 2: Run and confirm failure**

```bash
deno test supabase/functions/admin-console/admin_console_logic_test.ts
```

Expected: FAIL on missing action dispatch.

- [ ] **Step 3: Implement read actions**

Implement `players.list`, `players.get`, `audit.list`, and `operations.get` with bounded page size 50. `players.get` returns profile, account state summary, recent game records, live-ops summary, audit rows, and the current `stateVersion`; `operations.get` returns current notices, reward-mail summary counts, both minimum-version values, and QA access. Exclude recovery code, mail bodies for other users, tokens, and receipts from every select list.

- [ ] **Step 4: Implement write actions**

Before player/score writes, read `admin_player_mutations_enabled`; live operations remain available independently. Dispatch each write to exactly one of the six service-role RPCs defined in Task 2. Pass the verified Google email as actor and return stable errors: `mutations_disabled`, `version_conflict`, `invalid_change`, `record_not_found`, `request_already_applied`, `admin_write_failed`.

- [ ] **Step 5: Require the shared admin ticket**

Reuse `verifyAdminRequest()` from `_shared/admin_access.ts`; do not copy Google or HMAC logic. Allow only `POST`/`OPTIONS` and configured origins. Include `x-admin-session` in CORS.

- [ ] **Step 6: Run Edge contracts**

```bash
deno test --allow-read supabase/functions/_shared/admin_access_test.ts supabase/functions/admin-console/admin_console_logic_test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit the admin endpoint**

```bash
git add supabase/functions/admin-console supabase/functions/_shared/admin_access.ts
git commit -m "feat(admin): expose secured player operations API"
```

### Task 4: Build player, operation, and audit views

**Files:**
- Create: `site_repo/console/players.js`
- Create: `site_repo/console/operations.js`
- Create: `site_repo/console/audit.js`
- Modify: `site_repo/console/index.html`
- Modify: `site_repo/console/styles.css`
- Modify: `site_repo/console/app.js`
- Modify: `site_repo/console/api.js`
- Test: `site_repo/scripts/test_console_model.js`
- Modify: `site_repo/scripts/check_house_duck_console.sh`

**Interfaces:**
- Consumes: `admin-console` read/write actions
- Produces: searchable player view, detail/timeline, guarded edits, live operations, audit/revert

- [ ] **Step 1: Write failing UI-model tests**

Add pure tests for:

```js
assert.deepEqual(model.diffPlayerChanges({ gems: 10 }, { gems: 12 }), { gems: { before: 10, after: 12 } });
assert.equal(model.canSubmitMutation({ reason: "", changes: { gems: 12 } }), false);
assert.equal(model.canSubmitMutation({ reason: "CS 보상", changes: { gems: 12 } }), true);
```

Also assert that mutation controls are disabled when `mutationsEnabled` is false or `stateVersion` is missing.

- [ ] **Step 2: Run and confirm failure**

```bash
node scripts/test_console_model.js
```

Expected: FAIL on missing mutation helpers.

- [ ] **Step 3: Implement the player list and detail**

Use server search/sort/page parameters. Preserve query state in the hash. Display `nickname · displayCode`, user ID copy button, range activity, economy, score records, timeline, and CS search link. Do not merge users by nickname.

- [ ] **Step 4: Implement guarded economy edits**

Use a modal showing current value, new value, delta, reason, and expected version. Generate `requestId` with `crypto.randomUUID()`. Require final confirmation. On conflict, close no data, reload the player, and explain that the server value changed.

- [ ] **Step 5: Implement score correction**

Show each record's timestamp, score, level, exclusion status, and source. Editing current best requires replacement best score/level fields. Use explicit `기록 제외` and `복구` controls; never label record deletion.

- [ ] **Step 6: Implement operations and audit**

Connect Operations to `operations.get` and the four live-operation write actions. Provide notice preview and active window, validated reward-mail composition, minimum-version/current-code comparison, and per-player QA access. Every submit shows the exact change and requires a reason plus final confirmation. Audit shows before/after, actor, reason, time, result, and a `되돌리기` action for reversible player mutations that creates a new inverse request; announcement and broadcast-mail sends are not labeled reversible.

- [ ] **Step 7: Update static security checks**

Require reason fields, expected version, mutation flag copy, audit view, all four live-operation action names, no direct `/rest/v1/account_states` or `/rest/v1/game_records` frontend calls, and no destructive delete copy.

- [ ] **Step 8: Run the site suite**

```bash
node scripts/test_console_model.js
bash scripts/check_house_duck_console.sh
bash scripts/check_analytics_dashboard.sh
node scripts/test_pulse_model.js
bash scripts/check_public_repo.sh --all
git diff --check
```

Expected: all PASS.

- [ ] **Step 9: Commit player operations UI**

```bash
git add console scripts/test_console_model.js scripts/check_house_duck_console.sh
git commit -m "feat(console): add guarded player operations"
```

### Task 5: Verify account safety before enabling writes

**Files:**
- Modify only files required by test findings
- Modify `docs/work_history.md` after successful verification

**Interfaces:**
- Consumes: migration, Edge Function, client conflict handling, console UI
- Produces: verified disabled-by-default mutation path

- [ ] **Step 1: Run focused Quirky Ball QA**

```bash
bash scripts_dev/qa/run_qa.sh qa_account_state_conflict_test
bash scripts_dev/qa/run_qa.sh qa_account_overview_contract_test
bash scripts_dev/qa/run_qa.sh qa_supabase_offline_queue_test
bash scripts_dev/qa/run_qa.sh qa_authenticated_services_gate_test
/Applications/Godot.app/Contents/MacOS/Godot --path . --headless --quit
git diff --check
```

Expected: all focused suites PASS, no parse errors, and real save unchanged.

- [ ] **Step 2: Run backend contracts**

```bash
deno test --allow-read supabase/functions/_shared/admin_access_test.ts supabase/functions/admin-console/admin_console_logic_test.ts supabase/functions/analytics-dashboard/analytics_logic_test.ts supabase/functions/analytics-dashboard/analytics_time_test.ts
supabase migration list --local
git diff --check
```

Expected: tests PASS and both new migrations are listed locally.

- [ ] **Step 3: Run the complete non-device regression once**

```bash
bash scripts_dev/qa/run_qa.sh smoke
```

Expected: PASS. Do not call this Android/iOS proof.

- [ ] **Step 4: Confirm the feature flag remains false**

Inspect the migration and live/staging config response. Expected: `admin_player_mutations_enabled=false`. The UI must show read-only values and explain that the next compatible game build is required.

- [ ] **Step 5: Record work history**

Add one dated line describing the optimistic state contract, admin audit/mutation boundary, QA counts, and unverified device coverage. Do not edit unrelated user changes in the dirty main worktree; apply the documentation change only in the feature worktree and resolve at merge time.

- [ ] **Step 6: Commit verification docs**

```bash
git add docs/work_history.md
git commit -m "docs: record console player operations verification"
```

Skip only if the same information is already part of the implementation commit without unrelated changes.
