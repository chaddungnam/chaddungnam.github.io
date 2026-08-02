#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'legal site contract failed: %s\n' "$1" >&2
  exit 1
}

require_token() {
  local file="$1"
  local token="$2"
  grep -Fq "$token" "$repo_dir/$file" || fail "$file is missing $token"
}

reject_token() {
  local file="$1"
  local token="$2"
  if grep -Fiq "$token" "$repo_dir/$file"; then
    fail "$file contains forbidden token $token"
  fi
}

test -s "$repo_dir/assets/legal-site.css" || fail "assets/legal-site.css does not exist"
test -s "$repo_dir/assets/legal-site.js" || fail "assets/legal-site.js does not exist"

localized_pages=()
for locale in ko en de ja; do
  localized_pages+=(
    "quirky-ball/privacy/$locale.html"
    "quirky-ball/terms/$locale.html"
    "quirky-ball/privacy/delete_$locale.html"
  )
done

selector_pages=(
  "quirky-ball/privacy/index.html"
  "quirky-ball/privacy/delete.html"
  "quirky-ball/terms/index.html"
)

for page in "${localized_pages[@]}" "${selector_pages[@]}" "support/index.html"; do
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" "/assets/legal-site.css"
  require_token "$page" "/assets/legal-site.js"
  require_token "$page" 'class="skip-link"'
  require_token "$page" "<main"
  require_token "$page" "data-current-year"
  reject_token "$page" "<style"
  reject_token "$page" "fonts.googleapis.com"
  reject_token "$page" "cdn."
  reject_token "$page" "tailwind"
  reject_token "$page" "iconify"
done

for page in "${localized_pages[@]}" "support/index.html"; do
  require_token "$page" "문서 본문 시작"
  require_token "$page" "문서 본문 끝"
  require_token "$page" "data-legal-content"
done

for page in "${localized_pages[@]}"; do
  require_token "$page" "data-toc-list"
done

printf 'legal site contract: PASS\n'
