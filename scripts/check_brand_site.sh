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
  "index_de.html"
  "index_ja.html"
  "quirky-ball/index.html"
  "quirky-ball/index_en.html"
  "quirky-ball/index_de.html"
  "quirky-ball/index_ja.html"
  "project-k/index.html"
  "project-k/index_en.html"
  "project-k/index_de.html"
  "project-k/index_ja.html"
  "story/index.html"
  "story/index_en.html"
  "story/index_de.html"
  "story/index_ja.html"
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

for page in project-k/index.html project-k/index_en.html project-k/index_de.html project-k/index_ja.html; do
  require_token "$page" 'data-page="project-k"'
  require_token "$page" 'class="language-picker"'
  require_token "$page" "data-project-k-asset"
  require_token "$page" "assets/project-k-site.css"
done

for page in index.html index_en.html index_de.html index_ja.html; do
  require_token "$page" 'data-page="studio"'
  require_token "$page" 'data-section="games-catalog"'
  require_token "$page" 'data-section="studio-values"'
  require_token "$page" "quirky-ball/store/feature-graphic.png"
  require_token "$page" "quirky-ball/store/01-core.png"
  require_token "$page" "quirky-ball/logo.png"
  require_token "$page" "project-k/media/decision.png"
  require_token "$page" "story/"
done

for page in quirky-ball/index.html quirky-ball/index_en.html quirky-ball/index_de.html quirky-ball/index_ja.html; do
  require_token "$page" 'data-page="quirky-ball"'
  require_token "$page" 'data-section="game-loop"'
  require_token "$page" 'data-section="game-features"'
  require_token "$page" 'data-section="gallery"'
  require_token "$page" "store/feature-graphic.png"
  require_token "$page" "store/01-core.png"
  require_token "$page" "store/08-ranking.png"
done

for page in story/index.html story/index_en.html story/index_de.html story/index_ja.html; do
  require_token "$page" 'data-page="story"'
  require_token "$page" 'class="story-timeline"'
  require_token "$page" 'class="story-quote reveal"'
  require_token "$page" "project-k/media/decision.png"
done

require_css_property ".featured-logo" "height: auto;"
require_token "assets/brand-site.css" "@media (min-width: 901px) and (max-height: 980px)"
require_token "assets/brand-site.css" "height: calc(100dvh - 78px);"

node "$repo_dir/scripts/test_brand_images.js"
node "$repo_dir/scripts/test_brand_language.js"
node "$repo_dir/scripts/test_brand_catalog.js"

printf 'brand site contract: PASS\n'
