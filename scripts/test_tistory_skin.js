#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const skinDir = path.join(root, "tistory-skin");
const requiredFiles = [
  "skin.html",
  "style.css",
  "index.xml",
  "images/script.js",
  "images/house-duck-logo.png",
  "images/house-duck-wordmark.png",
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(skinDir, file)), `missing Tistory skin file: ${file}`);
}

const html = fs.readFileSync(path.join(skinDir, "skin.html"), "utf8");
const css = fs.readFileSync(path.join(skinDir, "style.css"), "utf8");
const xml = fs.readFileSync(path.join(skinDir, "index.xml"), "utf8");
const script = fs.readFileSync(path.join(skinDir, "images/script.js"), "utf8");

const requiredTokens = [
  "<s_t3>",
  "[##_body_id_##]",
  "[##_page_title_##]",
  "[##_blog_link_##]",
  "<s_search>",
  "[##_search_name_##]",
  "[##_search_text_##]",
  "[##_search_onclick_submit_##]",
  "[##_category_##]",
  "<s_list>",
  "<s_article_rep>",
  "<s_index_article_rep>",
  "<s_permalink_article_rep>",
  "<s_article_rep_thumbnail>",
  "<s_article_protected>",
  "<s_notice_rep>",
  "<s_page_rep>",
  "<s_tag>",
  "<s_tag_label>",
  "<s_article_related>",
  "<s_article_prev>",
  "<s_article_next>",
  "<s_paging>",
  "<s_rp>",
  "[##_comment_group_##]",
  "<s_guest>",
  "[##_guestbook_group_##]",
  "<s_ad_div>",
];

for (const token of requiredTokens) {
  assert.ok(html.includes(token), `missing Tistory behavior token: ${token}`);
}

assert.match(html, /href="https:\/\/houseduck\.in\/"/, "missing House Duck home link");
assert.match(html, /href="\[##_blog_link_##\]"/, "public navigation must follow Tistory's configured custom Blog domain");
assert.match(html, /name="\[#\#_search_name_##\]"/, "search input must use Tistory's field name");
assert.match(html, /onkey(?:down|press)="[^"]*\[#\#_search_onclick_submit_##\]/, "Enter must submit search");
assert.match(html, /onclick="\[#\#_search_onclick_submit_##\]"/, "search button must submit search");
assert.match(html, /tistory_admin\/lib\/jquery\/jquery-1\.12\.4\.min\.js/, "Tistory controls need the bundled jQuery runtime");
assert.match(html, /aria-label="[^"]+"/, "skin needs accessible control labels");
assert.match(html, /data-theme-toggle/, "skin needs a light and dark mode control");
assert.match(html, /https:\/\/houseduck\.in\/assets\/blog-locales\.js/, "skin needs the generated locale manifest");
assert.match(html, /data-translation-link/, "article needs a visible translated-version link");
assert.match(
  html,
  /https:\/\/houseduck\.in\/tistory-skin\/images\/script\.js/,
  "live Tistory skin should load the repository-managed behavior script"
);
assert.match(html, /images\/house-duck-logo\.png/, "skin must use the House Duck PNG logo");
assert.match(html, /images\/house-duck-wordmark\.png/, "skin must use the House Duck PNG wordmark");
assert.match(html, /<details class="category-menu"[\s\S]*?\[##_category_##\][\s\S]*?<\/details>/, "desktop navigation needs Tistory categories");
assert.equal((html.match(/class="article-index-link"/g) || []).length, 2, "post and notice pages need one compact index link each");
assert.doesNotMatch(html, /class="post-discovery|<s_list_rep>|<small>JOURNAL<\/small>/, "list pages must not duplicate discovery, article cards, or offset the header wordmark");
assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.article-index-link\s*\{[^}]*display:\s*none/, "mobile post pages must start directly with the article");
assert.match(css, /@media\s*\(max-width:/, "skin needs a mobile breakpoint");
assert.match(css, /prefers-reduced-motion/, "skin must respect reduced motion");
assert.match(css, /color-scheme:\s*light dark/, "skin must declare both color schemes");
assert.match(css, /html\[data-theme="dark"\]/, "skin needs an explicit dark theme");
assert.match(css, /\.tt_box_namecard/, "Tistory subscription card needs explicit theme styles");
assert.match(css, /\.tt-comment-cont[\s\S]*\.tt-box-account/, "Tistory comment account fields need explicit theme styles");
assert.match(css, /\.article-header h1\s*\{[^}]*font-size:\s*clamp\(2\.35rem,\s*5vw,\s*4\.8rem\)/, "desktop article titles must stay practical");
assert.match(xml, /<contentWidth>760<\/contentWidth>/, "editor width must match article measure");
assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket)\b/, "skin script must not make remote requests");
assert.match(script, /house_duck_theme/, "theme choice must persist between visits");
assert.match(script, /HOUSE_DUCK_BLOG_LOCALES/, "skin must route readers through the generated locale manifest");
assert.match(script, /original/, "Korean original view must bypass automatic redirection");

const assetReferences = [...html.matchAll(/(?:href|src)="\.\/([^"?#]+)"/g)].map((match) => match[1]);
for (const asset of assetReferences) {
  assert.ok(fs.existsSync(path.join(skinDir, asset)), `unresolved skin asset: ${asset}`);
}

console.log("Tistory skin contract: PASS");
