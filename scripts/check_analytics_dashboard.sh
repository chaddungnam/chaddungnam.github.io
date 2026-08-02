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

rg -q 'google.accounts.id' "$dashboard_dir/app.js"
rg -q 'GOOGLE_CLIENT_ID' "$dashboard_dir/app.js"
if rg -n 'supabaseClient\.auth|signInWithOAuth|signInWithPassword|resetPasswordForEmail|updateUser|PASSWORD_RECOVERY' "$dashboard_dir/app.js"; then
  echo "dashboard must use direct Google identity, not Supabase Auth" >&2
  exit 1
fi
rg -q 'fetch\(ANALYTICS_FUNCTION_URL' "$dashboard_dir/app.js"
rg -q 'analytics-dashboard' "$dashboard_dir/app.js"
rg -q 'projectKey' "$dashboard_dir/app.js"
rg -q 'distributionKey' "$dashboard_dir/app.js"
rg -q 'projectPicker' "$dashboard_dir/index.html"
rg -q 'health' "$dashboard_dir/app.js"
rg -q 'adEconomics' "$dashboard_dir/app.js"
rg -q 'rangeDays: 7' "$dashboard_dir/app.js"
rg -q 'data-range="1"' "$dashboard_dir/index.html"
rg -q 'dailyDetails' "$dashboard_dir/index.html"
rg -q 'pulse-model.js' "$dashboard_dir/index.html"
rg -q 'id="mascotMessage"' "$dashboard_dir/index.html"
rg -q 'id="signalLights"' "$dashboard_dir/index.html"
rg -q 'id="metricCompletion"' "$dashboard_dir/index.html"
rg -q 'id="journeyGraph"' "$dashboard_dir/index.html"
rg -q 'id="todayAction"' "$dashboard_dir/index.html"
rg -q 'id="operatorDetails"' "$dashboard_dir/index.html"
rg -q 'renderPulseOverview' "$dashboard_dir/app.js"
rg -q 'verifyGoogleIdToken' "$function_file"
rg -q 'SUPPORTED_PROJECTS' "$function_file"
rg -q 'invalid_project' "$function_file"
rg -q 'Europe/Berlin' "$(dirname "$function_file")/analytics_time.ts"
rg -q '"android", "ios"' "$function_file"
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
