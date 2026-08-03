#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
console_dir="$repo_dir/console"
legacy_dir="$repo_dir/analytics"
game_dir="$(cd "$repo_dir/.." && pwd)"
if [[ ! -d "$game_dir/supabase" ]]; then
  game_root="$(cd "$(git -C "$repo_dir" rev-parse --git-common-dir)/../.." && pwd)"
  game_worktree="$game_root/.worktrees/$(basename "$repo_dir")"
  game_dir="${HOUSE_DUCK_GAME_DIR:-$game_worktree}"
fi
function_file="$game_dir/supabase/functions/analytics-dashboard/index.ts"
migration_dir="$game_dir/supabase/migrations"

test -f "$legacy_dir/index.html"
test -f "$legacy_dir/pulse-model.js"
test -f "$console_dir/analytics.js"
test -f "$function_file"

rg -q '/console/#/analytics' "$legacy_dir/index.html"
rg -q '../analytics/pulse-model.js' "$console_dir/index.html"
rg -q 'ConsoleAPI.post\("analytics-dashboard"' "$console_dir/analytics.js"
rg -q 'playerQuery' "$console_dir/analytics.js"
rg -q 'playerDeepLink' "$console_dir/analytics.js"
rg -q 'periodPlayersTable' "$console_dir/index.html"
rg -q 'data-range="1"' "$console_dir/index.html"
rg -q 'data-range="7"' "$console_dir/index.html"
rg -q 'data-range="28"' "$console_dir/index.html"
rg -q 'buildAttentionItems' "$console_dir/model.js"
rg -q 'verifyGoogleIdToken' "$function_file"
rg -q 'verifyAdminTicket' "$function_file"
rg -q 'admin_list_period_players_v1' "$function_file"
rg -q 'periodPlayerTotal' "$function_file"
rg -q 'Europe/Berlin' "$(dirname "$function_file")/analytics_time.ts"
rg -q 'admin_list_period_players_v1' "$migration_dir"/*_house_duck_console_auth.sql

if rg -n '/rest/v1/(analytics_events|account_states|game_records)' "$console_dir"; then
  echo "analytics console must use secured Edge Functions" >&2
  exit 1
fi

echo "analytics dashboard contract: PASS"
