#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
console_dir="$repo_dir/console"

for path in index.html styles.css model.js auth.js api.js app.js players.js operations.js audit.js gmail-model.js gmail-api.js cs-templates.js cs.js; do
  test -f "$console_dir/$path"
done
rg -F -q 'https://www.googleapis.com/auth/gmail.modify' "$console_dir/gmail-api.js"
rg -F -q 'window.ConsoleCs.mount()' "$console_dir/app.js"
rg -F -q 'textContent = root.GmailModel.extractMessageText' "$console_dir/cs.js"
rg -F -q 'root.ConsoleApp.confirmChange("답변 발송 최종 확인"' "$console_dir/cs.js"

rg -q 'id="googleButton"' "$console_dir/index.html"
rg -q '내가 처음 한 게임 이름은?' "$console_dir/index.html"
rg -q 'id="challengeForm"' "$console_dir/index.html"
rg -q 'id="consoleApp"' "$console_dir/index.html"
rg -q 'data-route="analytics"' "$console_dir/index.html"
rg -q 'data-route="players"' "$console_dir/index.html"
rg -q 'data-route="operations"' "$console_dir/index.html"
rg -q 'data-route="purchases"' "$console_dir/index.html"
rg -q 'data-route="cs"' "$console_dir/index.html"
rg -q 'data-route="audit"' "$console_dir/index.html"
rg -q 'Project K' "$console_dir/index.html"
rg -q '준비 중' "$console_dir/index.html"
rg -q '결제 미연동' "$console_dir/index.html"
rg -q 'sessionStorage' "$console_dir/auth.js"
rg -q 'X-Admin-Session' "$console_dir/auth.js"
rg -q 'admin-auth' "$console_dir/app.js"
rg -q 'name="reason"' "$console_dir/index.html"
rg -q 'expectedVersion' "$console_dir/players.js"
rg -q 'mutations_enabled' "$console_dir/players.js"
rg -q 'safeConsoleReturnHash' "$console_dir/model.js" "$console_dir/players.js"
rg -q 'pendingRequests' "$console_dir/operations.js"
rg -q 'id="playerDirection"' "$console_dir/index.html"
rg -q 'action: "audit.revert"' "$console_dir/audit.js"
rg -F -q '다음 게임 빌드 연동 후 활성' "$console_dir/index.html"
for action in reward_mail.broadcast min_version.update qa_access.set; do
  rg -F -q "action: \"$action\"" "$console_dir/operations.js"
done

if rg -n -i 'service[_-]?role|admin_challenge|gmail.*access.*token|password\s*=' "$console_dir"; then
  echo "console contains a server secret or secret assignment" >&2
  exit 1
fi

if rg -n 'localStorage|sessionStorage|indexedDB|document\.cookie|console\.(log|warn|error)|/functions/.*gmail' "$console_dir/gmail-api.js" "$console_dir/gmail-model.js"; then
  echo "Gmail token or mail data must stay in browser memory and out of logs/proxies" >&2
  exit 1
fi

if rg -n -P 'https://www\.googleapis\.com/auth/gmail\.(?!modify\b)' "$console_dir/gmail-api.js"; then
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
