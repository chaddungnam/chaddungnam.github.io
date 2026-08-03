#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
console_dir="$repo_dir/console"

for path in index.html styles.css model.js auth.js api.js app.js; do
  test -f "$console_dir/$path"
done

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

if rg -n -i 'service[_-]?role|admin_challenge|gmail.*access.*token|password\s*=' "$console_dir"; then
  echo "console contains a server secret or secret assignment" >&2
  exit 1
fi

if rg -n '/rest/v1/(analytics_events|account_states|game_records)' "$console_dir"; then
  echo "console must use secured Edge Functions" >&2
  exit 1
fi

echo "House Duck console contract: PASS"
