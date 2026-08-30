#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
console_dir="$repo_dir/console"
legacy_dir="$repo_dir/analytics"
game_dir="${HOUSE_DUCK_GAME_DIR:-$(cd "$repo_dir/.." && pwd)}"
if [[ -z "${HOUSE_DUCK_GAME_DIR:-}" && ! -d "$game_dir/supabase" ]]; then
  game_root="$(cd "$(git -C "$repo_dir" rev-parse --git-common-dir)/../.." && pwd)"
  game_worktree="$game_root/.worktrees/$(basename "$repo_dir")"
  game_dir="$game_worktree"
fi
function_file="$game_dir/supabase/functions/analytics-dashboard/index.ts"
migration_dir="$game_dir/supabase/migrations"

if ! command -v rg >/dev/null 2>&1; then
  rg() { grep -E -R "$@"; }
fi

test -f "$legacy_dir/index.html"
test -f "$legacy_dir/pulse-model.js"
test -f "$console_dir/analytics.js"

rg -q '/console/#/analytics' "$legacy_dir/index.html"
rg -q '../analytics/pulse-model.js' "$console_dir/index.html"
rg -q 'ConsoleAPI.post\("analytics-dashboard-v2"' "$console_dir/analytics.js"
rg -q 'playerQuery' "$console_dir/analytics.js"
rg -q 'playerDeepLink' "$console_dir/analytics.js"
rg -q 'periodPlayersTable' "$console_dir/index.html"
rg -q 'operationsPulseTitle' "$console_dir/index.html"
rg -q 'renderGameMetrics' "$console_dir/analytics.js"
rg -q 'data-range="1"' "$console_dir/index.html"
rg -q 'data-range="7"' "$console_dir/index.html"
rg -q 'data-range="28"' "$console_dir/index.html"
rg -q 'buildAttentionItems' "$console_dir/model.js"
if [[ -f "$function_file" && -d "$migration_dir" ]]; then
  rg -q 'verifyAdminTicket' "$function_file"
  rg -q 'admin_list_period_players_v3' "$function_file"
  rg -q 'periodPlayerTotal' "$function_file"
  rg -q 'acquisitionQuality' "$function_file"
  rg -q 'purchaseFunnel' "$function_file"
  rg -q 'purchaseExclusions' "$function_file"
  rg -q 'analytics_install_exclusions' "$function_file"
  rg -q 'admin_analytics_retention_v3' "$function_file"
  rg -q 'ios_purchases_live' "$function_file"
  rg -q 'buildPurchaseFunnels' "$(dirname "$function_file")/analytics_logic.ts"
  rg -q 'partitionPurchaseRows' "$(dirname "$function_file")/analytics_logic.ts"
  rg -q 'formatBreakdown' "$(dirname "$function_file")/analytics_logic.ts"
  rg -q 'refresh_admin_daily_game_metrics' "$function_file"
  rg -q 'admin_daily_game_metrics' "$migration_dir"/*_admin_daily_game_metrics.sql
  rg -q 'Europe/Berlin' "$(dirname "$function_file")/analytics_time.ts"
  rg -q 'admin_list_period_players_v3' "$migration_dir"/*.sql
else
  echo "analytics backend contract: SKIP (set HOUSE_DUCK_GAME_DIR to verify)"
fi

if rg -n '/rest/v1/(analytics_events|account_states|game_records)' "$console_dir"; then
  echo "analytics console must use secured Edge Functions" >&2
  exit 1
fi

echo "analytics dashboard contract: PASS"
