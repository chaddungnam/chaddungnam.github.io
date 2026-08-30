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

content_pages=(
  "index.html"
  "index_en.html"
  "index_de.html"
  "index_ja.html"
  "about/index.html"
  "about/index_en.html"
  "about/index_de.html"
  "about/index_ja.html"
  "quirky-ball/index.html"
  "quirky-ball/index_en.html"
  "quirky-ball/index_de.html"
  "quirky-ball/index_ja.html"
  "project-k/index.html"
  "project-k/index_en.html"
  "project-k/index_de.html"
  "project-k/index_ja.html"
)

redirect_pages=(
  "story/index.html"
  "story/index_en.html"
  "story/index_de.html"
  "story/index_ja.html"
)

for page in "${content_pages[@]}"; do
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

for page in "${redirect_pages[@]}"; do
  test -s "$repo_dir/$page" || fail "$page does not exist"
  require_token "$page" 'data-page="blog-redirect"'
done

for page in index.html about/index.html quirky-ball/index.html project-k/index.html; do
  require_token "$page" "https://blog.houseduck.in/"
done
require_token "index_en.html" 'blog/en/'
require_token "about/index_en.html" 'blog/en/'
require_token "quirky-ball/index_en.html" 'blog/en/'
require_token "project-k/index_en.html" 'blog/en/'
require_token "index_de.html" 'blog/de/'
require_token "about/index_de.html" 'blog/de/'
require_token "quirky-ball/index_de.html" 'blog/de/'
require_token "project-k/index_de.html" 'blog/de/'
require_token "index_ja.html" 'blog/ja/'
require_token "about/index_ja.html" 'blog/ja/'
require_token "quirky-ball/index_ja.html" 'blog/ja/'
require_token "project-k/index_ja.html" 'blog/ja/'

require_token "story/index.html" 'url=https://blog.houseduck.in/'
require_token "story/index_en.html" 'url=https://houseduck.in/blog/en/'
require_token "story/index_de.html" 'url=https://houseduck.in/blog/de/'
require_token "story/index_ja.html" 'url=https://houseduck.in/blog/ja/'

for page in about/index.html about/index_en.html about/index_de.html about/index_ja.html; do
  require_token "$page" 'data-page="about"'
  require_token "$page" 'class="about-timeline"'
  require_token "$page" 'assets/about-site.css'
done

for page in project-k/index.html project-k/index_en.html project-k/index_de.html project-k/index_ja.html; do
  require_token "$page" 'data-page="project-k"'
  require_token "$page" 'class="language-picker"'
  require_token "$page" "data-project-k-asset"
  require_token "$page" "assets/project-k-site.css"
done

for page in index.html index_en.html index_de.html index_ja.html; do
  require_token "$page" 'data-page="studio"'
  require_token "$page" 'data-studio-hero'
  require_token "$page" 'data-youtube-feed'
  require_token "$page" 'data-quirky-mechanic'
  require_token "$page" 'data-project="quirky-ball"'
  require_token "$page" 'data-project="project-k"'
  require_token "$page" 'assets/studio-home.css'
  require_token "$page" 'assets/studio-home.js'
  require_token "$page" 'assets/house-duck-social.jpg'
  require_token "$page" 'assets/red-quirky.svg'
  require_token "$page" 'data-theme="light"'
  reject_token "$page" 'data-theme-toggle'
  require_token "$page" "assets/media/quirky-ball-gameplay.mp4"
  require_token "$page" "assets/media/project-k-highlight.mp4"
  require_token "$page" "https://www.youtube.com/@houseduck_in"
  require_token "$page" "https://blog.houseduck.in/"
  reject_token "$page" 'history-section'
  reject_token "$page" 'journal-section'
  reject_token "$page" '작게 만들더라도 오래 기억되는 게임'
  reject_token "$page" "European Restroom Map"
done

for page in quirky-ball/index.html quirky-ball/index_en.html quirky-ball/index_de.html quirky-ball/index_ja.html; do
  require_token "$page" 'data-page="quirky-ball"'
  require_token "$page" 'data-section="game-loop"'
  require_token "$page" 'data-section="game-features"'
  require_token "$page" 'data-section="gallery"'
  require_token "$page" "assets/quirky-ball-site.css"
  require_token "$page" "assets/media/quirky-ball-showcase.mp4"
  require_token "$page" 'class="marble-rain"'
  require_token "$page" "latest/01-core.png"
  require_token "$page" "latest/04-roulette.png"
done

if grep -Fq 'https://houseduck.in/story/' "$repo_dir/sitemap.xml"; then
  fail "sitemap.xml still publishes founder-story URLs"
fi

require_css_property ".brand-lockup .brand-duck-image" "width: 38px"
require_css_property ".brand-lockup .brand-wordmark-image" "width: 132px"
require_token "assets/studio-home.css" ".project-phone"
require_token "assets/studio-home.css" "overflow: visible"
require_token "assets/studio-home.js" "shotsPerSecond: 18"
test -s "$repo_dir/assets/fonts/Chilgok_Kaj-subset.woff2" || fail "Chilgok subset font is missing"
test "$(wc -c < "$repo_dir/assets/fonts/Chilgok_Kaj-subset.woff2")" -lt 300000 || fail "Chilgok subset font is too large"
require_token "llms.txt" "https://houseduck.in/assets/blog-feed.json"
require_token "llms.txt" "https://blog.houseduck.in/"

for page in index.html index_en.html index_de.html index_ja.html; do
  require_token "$page" 'application/ld+json'
  require_token "$page" 'https://houseduck.in/#organization'
  require_token "$page" '"logo":"https://houseduck.in/assets/house-duck-logo.png"'
  require_token "$page" '"@type":"WebSite"'
done

node "$repo_dir/scripts/test_brand_images.js"
node "$repo_dir/scripts/test_brand_language.js"
node "$repo_dir/scripts/test_brand_catalog.js"
node "$repo_dir/scripts/test_studio_home.js"
node "$repo_dir/scripts/test_default_theme.js"

printf 'brand site contract: PASS\n'
