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
require_token "assets/legal-site.css" 'color-scheme: light'
reject_token "assets/legal-site.css" 'html[data-theme="dark"]'
require_token "assets/legal-site.css" '/assets/house-duck-logo.png'

# Legal documents are English (main version) + Korean + German (owner 2026-10-20: German back for GDPR after the
# 2026-10-19 en + ko change). The ja legal URLs stay alive as redirect stubs to the matching English page (the live
# Quirky Ball app opens them). 10KEY Terms exist in en + ko only. The Impressum keeps all four languages.
legal_locales=(en ko de)
dropped_locales=(ja)
tenkey_locales=(en ko)

localized_pages=()
for locale in "${legal_locales[@]}"; do
  localized_pages+=(
    "privacy/$locale.html"
    "quirky-ball/terms/$locale.html"
    "quirky-ball/privacy/delete_$locale.html"
  )
done
for locale in "${tenkey_locales[@]}"; do
  localized_pages+=("10key/terms/$locale.html")
done
for locale in ko en de ja; do
  localized_pages+=("impressum/$locale.html")
done

selector_pages=(
  "privacy/index.html"
  "quirky-ball/privacy/index.html"
  "quirky-ball/privacy/delete.html"
  "quirky-ball/terms/index.html"
  "10key/privacy/index.html"
  "10key/terms/index.html"
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

for locale in "${legal_locales[@]}"; do
  redirect="quirky-ball/privacy/$locale.html"
  test -s "$repo_dir/$redirect" || fail "$redirect does not exist"
  require_token "$redirect" 'http-equiv="refresh"'
  require_token "$redirect" "/privacy/$locale.html"
  require_token "$redirect" "https://houseduck.in/privacy/$locale.html"
  reject_token "$redirect" "data-legal-content"
done
for locale in "${tenkey_locales[@]}"; do
  redirect="10key/privacy/$locale.html"
  test -s "$repo_dir/$redirect" || fail "$redirect does not exist"
  require_token "$redirect" 'http-equiv="refresh"'
  require_token "$redirect" "/privacy/$locale.html#section-13"
  require_token "$redirect" "https://houseduck.in/privacy/$locale.html"
  reject_token "$redirect" "data-legal-content"
done


# ja legal URLs: redirect stubs to the English document only, never a document of their own.
require_redirect_stub() {
  local page="$1"
  local target="$2"
  test -s "$repo_dir/$page" || fail "$page does not exist (the live app may open it)"
  require_token "$page" "http-equiv=\"refresh\" content=\"0;url=$target\""
  require_token "$page" "rel=\"canonical\" href=\"https://houseduck.in$target\""
  require_token "$page" "href=\"$target\""
  reject_token "$page" "data-legal-content"
  reject_token "$page" "문서 본문 시작"
}

for locale in "${dropped_locales[@]}"; do
  require_redirect_stub "privacy/$locale.html" "/privacy/en.html"
  require_redirect_stub "terms/$locale.html" "/terms/en.html"
  require_redirect_stub "quirky-ball/privacy/$locale.html" "/privacy/en.html"
  require_redirect_stub "quirky-ball/terms/$locale.html" "/quirky-ball/terms/en.html"
  require_redirect_stub "quirky-ball/privacy/delete_$locale.html" "/quirky-ball/privacy/delete_en.html"
  require_redirect_stub "quirky-ball/web/privacy/$locale.html" "/quirky-ball/web/privacy/en.html"
  require_redirect_stub "quirky-ball/web/terms/$locale.html" "/quirky-ball/web/terms/en.html"
done
for locale in de ja; do
  if [[ -e "$repo_dir/10key/terms/$locale.html" || -e "$repo_dir/10key/privacy/$locale.html" ]]; then
    fail "10key Survival has no $locale legal pages"
  fi
done

# German documents are full documents again, not redirect stubs.
for page in "privacy/de.html" "terms/de.html" "quirky-ball/terms/de.html" "quirky-ball/privacy/delete_de.html" \
  "quirky-ball/web/privacy/de.html" "quirky-ball/web/terms/de.html"; do
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" 'lang="de"'
  reject_token "$page" 'http-equiv="refresh"'
done

# Language links: pages with a German version switch between ko / en / de; nobody links ja; 10KEY Terms stay ko / en.
de_family_pages=()
for locale in "${legal_locales[@]}"; do
  de_family_pages+=(
    "privacy/$locale.html" "terms/$locale.html" "quirky-ball/terms/$locale.html" "quirky-ball/privacy/delete_$locale.html"
    "quirky-ball/web/privacy/$locale.html" "quirky-ball/web/terms/$locale.html"
  )
done
for page in "${de_family_pages[@]}"; do
  prefix=""
  case "$page" in */delete_*) prefix="delete_" ;; esac
  for language in ko en de; do
    require_token "$page" "href=\"$prefix$language.html\""
  done
  for dropped in "${dropped_locales[@]}"; do
    reject_token "$page" "href=\"$dropped.html\""
    reject_token "$page" "href=\"delete_$dropped.html\""
  done
done
for locale in "${tenkey_locales[@]}"; do
  for dropped in de ja; do
    reject_token "10key/terms/$locale.html" "href=\"$dropped.html\""
  done
done

# Language choice: ko or de before en in the browser list -> that language, everyone else (ja too) -> English;
# no-JS falls back to en. Pages without a German version pass "" for the German target.
require_language_choice() {
  local page="$1"
  local ko_target="$2"
  local en_target="$3"
  local de_target="$4"
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" '/^ko(?:[-_]|$)/'
  require_token "$page" "location.replace(\"$ko_target\")"
  require_token "$page" "location.replace(\"$en_target\")"
  require_token "$page" "<noscript><meta http-equiv=\"refresh\" content=\"0;url=$en_target\"></noscript>"
  require_token "$page" "href=\"$en_target\""
  if [[ -n "$de_target" ]]; then
    require_token "$page" '/^de(?:[-_]|$)/'
    require_token "$page" "location.replace(\"$de_target\")"
    require_token "$page" "href=\"$de_target\""
  else
    reject_token "$page" '"de"'
    reject_token "$page" 'href="de.html"'
  fi
  local dropped
  for dropped in "${dropped_locales[@]}"; do
    reject_token "$page" "\"$dropped\""
    reject_token "$page" "href=\"$dropped.html\""
    reject_token "$page" "href=\"delete_$dropped.html\""
  done
}

require_language_choice "terms/index.html" "ko.html" "en.html" "de.html"
require_language_choice "quirky-ball/privacy/delete.html" "delete_ko.html" "delete_en.html" "delete_de.html"
require_language_choice "quirky-ball/web/privacy/index.html" "ko.html" "en.html" "de.html"
require_language_choice "quirky-ball/web/terms/index.html" "ko.html" "en.html" "de.html"

# Entry pages (owner/lead 2026-10-20, after Google's OAuth brand review rejected the /privacy/ chooser as "not
# sufficient content"): every URL a store, an app or Google may link shows the full English document text, never only
# a chooser or a redirect. scripts/build_legal_entry_pages.py copies them from the English source; --check fails when
# a copy is out of date. People with JavaScript whose browser lists ko (or de, where it exists) before en are moved to
# that document; everyone else (ja too) stays on English.
python3 -B "$repo_dir/scripts/build_legal_entry_pages.py" --check || fail "legal entry pages are out of date with their English source"

require_entry_page() {
  local page="$1"
  local source="$2"
  local ko_target="$3"
  local de_target="$4"
  local section="$5"
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" "Generated by scripts/build_legal_entry_pages.py from /$source"
  require_token "$page" "<link rel=\"canonical\" href=\"https://houseduck.in/$source\">"
  require_token "$page" "data-legal-content"
  require_token "$page" "문서 본문 시작"
  require_token "$page" '/^ko(?:[-_]|$)/'
  require_token "$page" "location.replace(\"$ko_target\""
  reject_token "$page" 'http-equiv="refresh"'
  reject_token "$page" 'class="language-page"'
  reject_token "$page" 'location.replace("en.html")'
  reject_token "$page" 'class="language-all"'
  if [[ -n "$de_target" ]]; then
    require_token "$page" "location.replace(\"$de_target\""
  else
    reject_token "$page" '/^de(?:[-_]|$)/'
  fi
  if [[ -n "$section" ]]; then
    require_token "$page" "getElementById(\"$section\")"
    require_token "$page" "id=\"$section\""
  fi
  local dropped
  for dropped in "${dropped_locales[@]}"; do
    reject_token "$page" "/^$dropped(?:"
    reject_token "$page" "href=\"$dropped.html\""
  done
}

require_entry_page "privacy/index.html" "privacy/en.html" "/privacy/ko.html" "/privacy/de.html" ""
require_entry_page "quirky-ball/privacy/index.html" "privacy/en.html" "/privacy/ko.html" "/privacy/de.html" ""
require_entry_page "10key/privacy/index.html" "privacy/en.html" "/privacy/ko.html" "/privacy/de.html" "section-13"
require_entry_page "quirky-ball/terms/index.html" "quirky-ball/terms/en.html" "/quirky-ball/terms/ko.html" "/quirky-ball/terms/de.html" ""
require_entry_page "10key/terms/index.html" "10key/terms/en.html" "/10key/terms/ko.html" "" ""
require_entry_page "hexaworld1984/privacy/index.html" "hexaworld1984/privacy/en.html" "/hexaworld1984/privacy/ko.html" "" ""
require_entry_page "hexaworld1984/terms/index.html" "hexaworld1984/terms/en.html" "/hexaworld1984/terms/ko.html" "" ""

for locale in ko en de ja; do
  require_token "impressum/$locale.html" "Junhee Choi"
  require_token "impressum/$locale.html" "House Duck"
  require_token "impressum/$locale.html" "Ringstr. 23"
  require_token "impressum/$locale.html" "support@houseduck.in"
  require_token "impressum/$locale.html" "+82 10 7620 3959"
done

for page in "${localized_pages[@]}" "support/index.html"; do
  require_token "$page" "문서 본문 시작"
  require_token "$page" "문서 본문 끝"
  require_token "$page" "data-legal-content"
done

test -s "$repo_dir/impressum/index.html" || fail "impressum/index.html does not exist"

for page in "${localized_pages[@]}"; do
  require_token "$page" "data-toc-list"
done

for locale in ko en de ja; do
  for language in ko en de ja; do
    require_token "impressum/$locale.html" "$language.html"
  done
done

# HEXAWORLD 1984 ships ko/en only — same generic legal-site contract as the
# locales above, kept as its own block since it does not join the QB/shared
# ko/en/de/ja loops.
hexaworld_localized_pages=()
for locale in ko en; do
  hexaworld_localized_pages+=(
    "hexaworld1984/privacy/$locale.html"
    "hexaworld1984/terms/$locale.html"
    "hexaworld1984/privacy/delete_$locale.html"
    "hexaworld1984/odds/$locale.html"
  )
done

hexaworld_selector_pages=(
  "hexaworld1984/index.html"
  "hexaworld1984/privacy/index.html"
  "hexaworld1984/terms/index.html"
  "hexaworld1984/privacy/delete.html"
  "hexaworld1984/odds/index.html"
)

for page in "${hexaworld_localized_pages[@]}" "${hexaworld_selector_pages[@]}"; do
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

for page in "${hexaworld_localized_pages[@]}"; do
  require_token "$page" "문서 본문 시작"
  require_token "$page" "문서 본문 끝"
  require_token "$page" "data-legal-content"
  require_token "$page" "data-toc-list"
done

printf 'legal site contract (hexaworld1984): PASS\n'

# 10key Survival (딸깍 서바이벌; project name 10KEY, renamed 2026-10-20) follows the Quirky Ball pattern: its own Terms (en/ko, checked with the localized pages above), the shared
# House Duck Privacy Policy (section 13, also in German), and /10key/privacy/ shows that policy opened at section 13.
for locale in "${tenkey_locales[@]}"; do
  require_token "10key/terms/$locale.html" "support@houseduck.in"
  require_token "10key/terms/$locale.html" "/privacy/$locale.html#section-13"
  if [[ "$locale" == ko ]]; then require_token "privacy/$locale.html" 'id="section-13">13. 딸깍 서바이벌 (10key Survival)</h2>'
  else require_token "privacy/$locale.html" 'id="section-13">13. 10key Survival</h2>'; fi
  require_token "privacy/$locale.html" "/10key/terms/$locale.html"
  require_token "terms/$locale.html" "../10key/terms/$locale.html"
done
require_token "privacy/de.html" 'id="section-13">13. 10key Survival</h2>'
require_token "privacy/de.html" "/10key/terms/en.html"
require_token "terms/de.html" "../10key/terms/en.html"
# /10key/ (ko) and /10key/index_en.html are the game's introduction pages (own stylesheet, no legal shell); they keep the legal and support links in the footer.
for page in 10key/index.html 10key/index_en.html; do
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" "/assets/tenkey-page.css"
  require_token "$page" 'class="skip-link"'
  require_token "$page" "<main"
  require_token "$page" "data-current-year"
  require_token "$page" 'href="terms/"'
  require_token "$page" 'href="privacy/"'
  require_token "$page" 'href="/support/'
  reject_token "$page" "<style"
  reject_token "$page" "fonts.googleapis.com"
  reject_token "$page" "cdn."
  reject_token "$page" "tailwind"
  reject_token "$page" "iconify"
done

printf 'legal site contract (10key): PASS\n'

printf 'legal site contract: PASS\n'
