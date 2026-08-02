#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dashboard_dir="$repo_dir/analytics"
function_file="$(cd "$repo_dir/.." && pwd)/supabase/functions/analytics-dashboard/index.ts"
migration_dir="$(cd "$repo_dir/.." && pwd)/supabase/migrations"

test -f "$dashboard_dir/index.html"
test -f "$dashboard_dir/styles.css"
test -f "$dashboard_dir/app.js"
test -f "$function_file"
test -n "$(rg -l 'analytics_admins' "$migration_dir" | head -1)"

rg -q 'signInWithPassword' "$dashboard_dir/app.js"
rg -q 'resetPasswordForEmail' "$dashboard_dir/app.js"
rg -q 'updateUser' "$dashboard_dir/app.js"
rg -q 'PASSWORD_RECOVERY' "$dashboard_dir/app.js"
rg -q 'functions\.invoke\("analytics-dashboard"' "$dashboard_dir/app.js"
rg -q 'analytics-dashboard' "$dashboard_dir/app.js"
rg -q 'auth\.getUser' "$function_file"
rg -q 'SUPABASE_SERVICE_ROLE_KEY' "$function_file"
rg -q 'analytics_admins' "$function_file"

if rg -n -i 'service_role|secret_key|password\s*=' "$dashboard_dir"; then
  echo "dashboard contains a server credential or password" >&2
  exit 1
fi

if rg -n "from\\([\"']analytics_events[\"']\\)" "$dashboard_dir"; then
  echo "dashboard must not query analytics_events directly" >&2
  exit 1
fi

echo "analytics dashboard contract: PASS"
