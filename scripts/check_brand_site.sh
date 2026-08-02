#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"

fail() {
  printf 'brand site contract failed: %s\n' "$1" >&2
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
    fail "$file contains forbidden runtime dependency $token"
  fi
}

require_css_property() {
  local selector="$1"
  local property="$2"
  awk -v selector="$selector" -v property="$property" '
    index($0, selector) == 1 { in_rule = 1; next }
    in_rule && index($0, property) { found = 1 }
    in_rule && /}/ { exit }
    END { exit(found ? 0 : 1) }
  ' "$repo_dir/assets/brand-site.css" || fail "$selector must include $property to preserve image proportions"
}

pages=(
  "index.html"
  "index_en.html"
  "quirky-ball/index.html"
  "quirky-ball/index_en.html"
)

for page in "${pages[@]}"; do
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" "assets/brand-site.css"
  require_token "$page" "assets/brand-site.js"
  require_token "$page" 'class="skip-link"'
  require_token "$page" "data-site-nav"
  require_token "$page" "data-menu-button"
  require_token "$page" "data-lang-link"
  require_token "$page" "<main"
  require_token "$page" "privacy/"
  require_token "$page" "terms/"
  require_token "$page" "support"
  require_token "$page" "data-current-year"

  reject_token "$page" "cdn."
  reject_token "$page" "fonts.googleapis.com"
  reject_token "$page" "iconify"
  reject_token "$page" "tailwind"
done

for page in index.html index_en.html; do
  require_token "$page" 'data-page="studio"'
  require_token "$page" 'data-section="featured-game"'
  require_token "$page" 'data-section="studio-values"'
  require_token "$page" "quirky-ball/feature-graphic.png"
  require_token "$page" "quirky-ball/logo.png"
done

for page in quirky-ball/index.html quirky-ball/index_en.html; do
  require_token "$page" 'data-page="quirky-ball"'
  require_token "$page" 'data-section="game-loop"'
  require_token "$page" 'data-section="game-features"'
  require_token "$page" 'data-section="gallery"'
  require_token "$page" "feature-graphic.png"
  require_token "$page" "01_home.png"
  require_token "$page" "07_ranking.png"
done

require_token "index.html" 'href="index_en.html?lang=en"'
require_token "index_en.html" 'href="/?lang=ko"'
require_token "quirky-ball/index.html" 'href="index_en.html?lang=en"'
require_token "quirky-ball/index_en.html" 'href="./?lang=ko"'
require_css_property ".featured-logo" "height: auto;"
require_token "assets/brand-site.css" "@media (min-width: 901px) and (max-height: 820px)"
require_token "assets/brand-site.css" "height: calc(100dvh - 78px);"

printf 'brand site contract: PASS\n'
