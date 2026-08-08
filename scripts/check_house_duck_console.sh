#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
console_dir="$repo_dir/console"

if ! command -v rg >/dev/null 2>&1; then
  rg() {
    if [[ " $* " == *" -F "* ]]; then grep -R "$@"; else grep -E -R "$@"; fi
  }
fi

for path in index.html styles.css model.js auth.js api.js app.js players.js operations.js purchases-model.js purchases.js audit.js gmail-model.js gmail-api.js cs-intelligence.js cs-templates.js cs.js; do
  test -f "$console_dir/$path"
done
rg -F -q 'https://www.googleapis.com/auth/gmail.modify' "$console_dir/gmail-api.js"
rg -F -q 'window.ConsoleCs.mount()' "$console_dir/app.js"
rg -F -q 'textContent = root.GmailModel.extractMessageText' "$console_dir/cs.js"
rg -F -q 'root.ConsoleApp.confirmChange("답변 발송 최종 확인"' "$console_dir/cs.js"
rg -F -q 'return { sent, statusUpdated }' "$console_dir/gmail-api.js"

rg -q 'id="googleButton"' "$console_dir/index.html"
rg -q '내가 처음 한 게임 이름은?' "$console_dir/index.html"
rg -q 'id="challengeForm"' "$console_dir/index.html"
rg -q 'id="consoleApp"' "$console_dir/index.html"
rg -q 'data-route="analytics"' "$console_dir/index.html"
rg -q 'data-route="players"' "$console_dir/index.html"
rg -q 'data-route="operations"' "$console_dir/index.html"
rg -q 'data-route="purchases"' "$console_dir/index.html"
rg -q 'id="purchaseFilterForm"' "$console_dir/index.html"
rg -q 'id="purchaseSummary"' "$console_dir/index.html"
rg -q 'id="purchasesTable"' "$console_dir/index.html"
rg -q 'id="purchaseSyncStatus"' "$console_dir/index.html"
rg -F -q 'window.ConsolePurchases.mount()' "$console_dir/app.js"
rg -F -q 'action: "purchases.list"' "$console_dir/purchases.js"
rg -F -q 'rangeDays: Number(byId("purchaseRange").value)' "$console_dir/purchases.js"
rg -q 'data-route="cs"' "$console_dir/index.html"
rg -q 'data-route="audit"' "$console_dir/index.html"
rg -q 'Project K' "$console_dir/index.html"
rg -q '준비 중' "$console_dir/index.html"
rg -q '자동 동기화 미연동' "$console_dir/index.html"
rg -q 'sessionStorage' "$console_dir/auth.js"
rg -q 'X-Admin-Session' "$console_dir/auth.js"
rg -q 'admin-auth' "$console_dir/app.js"
rg -q 'name="reason"' "$console_dir/index.html"
rg -q 'expectedVersion' "$console_dir/players.js"
rg -q 'mutations_enabled' "$console_dir/players.js"
rg -q 'safeConsoleReturnHash' "$console_dir/model.js" "$console_dir/players.js"
rg -q 'pendingRequests' "$console_dir/operations.js"
rg -q 'id="playerDirection"' "$console_dir/index.html"
rg -q 'id="csWeeklyBrief"' "$console_dir/index.html"
rg -q 'data-cs-view="kanban"' "$console_dir/index.html"
rg -q 'data-cs-view="calendar"' "$console_dir/index.html"
rg -q 'id="csKanban"' "$console_dir/index.html"
rg -q 'id="csCalendar"' "$console_dir/index.html"
rg -q 'data-calendar-range="week"' "$console_dir/index.html"
rg -q 'data-calendar-range="month"' "$console_dir/index.html"
rg -q 'data-calendar-range="year"' "$console_dir/index.html"
rg -q 'id="csThreadSummary"' "$console_dir/index.html"
rg -q 'name="templateKey"' "$console_dir/index.html"
rg -q 'overflow-y: auto' "$console_dir/styles.css"
rg -F -q 'max-height: min(62vh, 680px)' "$console_dir/styles.css"
rg -q 'action: "audit.revert"' "$console_dir/audit.js"
rg -F -q '다음 게임 빌드 연동 후 활성' "$console_dir/index.html"
for action in reward_mail.broadcast min_version.update qa_access.set; do
  rg -F -q "action: \"$action\"" "$console_dir/operations.js"
done
if rg -q '제목<input name="title"|본문<textarea name="body" maxlength="800"' "$console_dir/index.html"; then
  echo "reward mail must use fixed localization templates" >&2
  exit 1
fi

if rg -n -i 'service[_-]?role|admin_challenge|gmail.*access.*token|password\s*=' "$console_dir"; then
  echo "console contains a server secret or secret assignment" >&2
  exit 1
fi

if rg -n 'localStorage|sessionStorage|indexedDB|document\.cookie|console\.(log|warn|error)|/functions/.*gmail' "$console_dir/gmail-api.js" "$console_dir/gmail-model.js"; then
  echo "Gmail token or mail data must stay in browser memory and out of logs/proxies" >&2
  exit 1
fi

if rg -n 'https://www\.googleapis\.com/auth/gmail\.' "$console_dir/gmail-api.js" |
  grep -F -v 'https://www.googleapis.com/auth/gmail.modify'; then
  echo "Gmail scope is broader than gmail.modify" >&2
  exit 1
fi

if rg -n '/rest/v1/(analytics_events|account_states|game_records)' "$console_dir"; then
  echo "console must use secured Edge Functions" >&2
  exit 1
fi

if rg -n '기록 삭제|계정 삭제' "$console_dir"; then
  echo "console must use correction/exclusion language, not destructive deletion" >&2
  exit 1
fi

echo "House Duck console contract: PASS"
