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
assert.match(css, /#tt-body-page #main-content \.article-body img:not\(\.og-image\)\s*\{[^}]*display:\s*block[^}]*width:\s*auto[^}]*max-width:\s*min\(100%,\s*400px\)[^}]*margin:\s*0 auto/s, "the 400px no-upscale rule must outrank Tistory's forced full-width image CSS");

const requiredTokens = [
  "<s_t3>",
  "[##_body_id_##]",
  "[##_page_title_##]",
  "[##_blog_link_##]",
  "<s_search>",
  "[##_search_name_##]",
  "[##_search_text_##]",
  "[##_search_onclick_submit_##]",
  "[##_category_list_##]",
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
assert.match(html, /<html lang="ko" data-theme="light">/, "skin must paint light before JavaScript");
assert.doesNotMatch(html, /data-theme-toggle/, "skin must not expose a removed dark-mode control");
assert.match(html, /class="journal-hero manifesto-hero shell"/, "Blog home needs the shared speech-bubble composition");
assert.match(html, /class="manifesto-bubble journal-bubble"/, "Blog statement needs a speech bubble");
assert.equal((html.match(/data-game-preview/g) || []).length, 2, "Blog home needs two live game previews");
assert.match(html, /House Duck's Blog,/, "Blog statement needs the approved Blog opening");
assert.match(html, /메인 페이지 보러가기/, "Blog speech bubble needs a direct route back to House Duck");
assert.match(html, /name="robots" content="max-image-preview:large"/, "skin should allow large image previews in search");
assert.doesNotMatch(html, /<meta name="description" content="\[##_desc_##\]">/, "Tistory should own the per-page description meta tag");
assert.match(html, /https:\/\/houseduck\.in\/assets\/blog-locales\.js/, "skin needs the generated locale manifest");
assert.match(html, /data-translation-links/, "article needs a translated-version language switcher");
assert.match(html, /data-article-toc/, "articles need a generated table of contents");
for (const locale of ["en", "de", "ja"]) {
  assert.match(html, new RegExp(`data-blog-locale="${locale}"`), `article needs a ${locale} translation link`);
}
assert.match(html, /src="https:\/\/houseduck\.in\/tistory-skin\/images\/script\.js\?v=1\.3\.4"/, "the managed skin should load a cache-busted House Duck behavior script");
assert.match(html, /images\/house-duck-logo\.png/, "skin must use the House Duck PNG logo");
assert.match(html, /https:\/\/houseduck\.in\/assets\/house-duck-wordmark\.png/, "skin must use the hosted Montserrat House Duck wordmark");
assert.doesNotMatch(html, /<nav class="desktop-nav"[\s\S]*?class="category-menu"/, "desktop categories should not expand inside the top navigation");
assert.match(html, /<aside class="category-dock"[\s\S]*?\[##_category_list_##\][\s\S]*?<\/aside>/, "desktop categories need a floating semantic list");
assert.match(html, /<aside class="category-dock"[\s\S]*?<details open>/, "desktop categories should be expanded by default");
assert.equal((html.match(/\[##_category_##\]/g) || []).length, 0, "Tistory's legacy GIF category tree must not be rendered");
assert.equal((html.match(/\[##_category_list_##\]/g) || []).length, 2, "desktop and mobile each need Tistory's semantic expanded list");
assert.equal((html.match(/data-category-list/g) || []).length, 2, "both category surfaces need the shared list styling hook");
assert.doesNotMatch(html, /category-tags-link|전체 태그/, "the category dock must not repeat the tag index");
assert.match(html, /<p class="eyebrow">01 · BLOG<\/p>/, "Blog index needs the shared editorial section number");
assert.match(html, /class="footer-brand-images"/, "Blog footer should reuse the House Duck footer lockup");
assert.match(html, /href="https:\/\/houseduck\.in\/impressum\/ko\.html"[^>]*>Impressum<\/a>/, "Blog footer needs an Impressum link");
assert.match(html, /href="mailto:business@houseduck\.in"/, "Blog footer needs the business inquiry address");
assert.match(html, /href="https:\/\/houseduck\.in\/terms\/ko\.html"[^>]*>이용약관<\/a>/, "Blog footer must open the common project selector");
assert.ok((html.match(/data-preview-type/g) || []).length >= 4, "Blog titles and summaries need the fast preview typer");
assert.equal((html.match(/class="article-breadcrumb"/g) || []).length, 2, "post and notice pages need one compact breadcrumb each");
assert.doesNotMatch(html, /class="post-discovery|<s_list_rep>|<small>JOURNAL<\/small>/, "list pages must not duplicate discovery, article cards, or offset the header wordmark");
assert.match(css, /\.article-breadcrumb\s*\{[^}]*display:\s*flex[^}]*font-size:\s*\.72rem/, "post breadcrumbs must stay compact and visible");
assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.article-breadcrumb\s*\{\s*display:\s*none;\s*\}/, "mobile articles must start at the title instead of repeating breadcrumbs");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\] > a\s*\{[^}]*grid-template-columns:\s*96px minmax\(0,\s*1fr\)\s*!important/s, "mobile link previews must override Tistory's desktop card width");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\] p\.og-desc\s*\{\s*display:\s*none\s*!important;\s*\}/, "mobile link previews must hide clipped descriptions");
assert.match(css, /@media\s*\(max-width:/, "skin needs a mobile breakpoint");
assert.match(css, /prefers-reduced-motion/, "skin must respect reduced motion");
assert.match(css, /color-scheme:\s*light/, "skin must declare the single supported color scheme");
assert.doesNotMatch(css, /html\[data-theme="dark"\]/, "skin must not retain a dark theme branch");
assert.match(css, /\.article-toc\s*\{/, "article table of contents needs compact styling");
assert.match(css, /\.article-toc \.toc-children\s*\{/, "article subheadings need a nested list style");
assert.match(css, /\.category-dock\s*\{[^}]*position:\s*fixed/s, "desktop categories need to float beside the page");
assert.match(css, /\.page-number > span\s*\{[^}]*display:\s*contents/, "Tistory paging spans must not render a box inside the circular control");
assert.match(css, /\.page-number:has\(\.selected\),\s*\.page-number\.selected\s*\{/, "the selected paging state must style the whole circular control");
assert.doesNotMatch(css, /animation-timeline:\s*view\(\)/, "Blog cards must not dim while entering the viewport");
assert.doesNotMatch(css, /#09111f/i, "Blog footer must not keep the old navy background");
assert.match(css, /#tt-body-page \.revenue_unit_wrap\s*\{/, "native top and bottom ads need bounded article spacing");
assert.match(css, /#tt-body-page \.revenue_unit_wrap\s*\{[^}]*border-top:\s*1px[^}]*\}/, "empty native ads must render one divider instead of a doubled border");
assert.doesNotMatch(css, /#tt-body-page \.revenue_unit_wrap\s*\{[^}]*border-block:/, "native ad edges must not collapse into two adjacent lines");
assert.match(css, /\.site-footer nav a\s*\{[^}]*text-transform:\s*none/, "footer contact text must preserve the lowercase email address");
assert.match(css, /\.tt_box_namecard/, "Tistory subscription card needs explicit theme styles");
assert.match(css, /\.tt-comment-cont[\s\S]*\.tt-box-account/, "Tistory comment account fields need explicit theme styles");
assert.match(css, /\.article-header h1\s*\{[^}]*font-size:\s*clamp\(1\.9rem,\s*3\.2vw,\s*3rem\)/, "desktop article titles must stay bounded while using the editorial display scale");
assert.match(css, /\.journal-hero\s*\{[^}]*--studio-bg:\s*var\(--cream\)/, "Blog hero must map the shared studio colors");
assert.match(html, /href="https:\/\/houseduck\.in\/assets\/studio-home\.css\?v=1\.3\.4"/, "Blog speech bubble must reuse the cache-busted shared studio motion");
assert.doesNotMatch(css, /\.journal-bubble\s*\{[^}]*animation:/, "Blog speech bubble must not override the shared motion");
assert.doesNotMatch(css, /studio-bubble-float/, "Blog speech bubble text must not move with the shell");
assert.match(css, /\.collection-head h2\s*\{[^}]*font-size:\s*clamp\(1\.7rem,\s*2\.6vw,\s*2\.4rem\)/, "Blog collection heading must keep a compact editorial scale");
assert.match(css, /\.card-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/, "Blog card media must use a compact preview ratio");
assert.match(css, /\.header-inner\s*\{[^}]*min-height:\s*60px/, "skin header must match the compact House Duck chrome");
assert.match(css, /\.brand-duck-image\s*\{[^}]*width:\s*32px[^}]*height:\s*32px/, "skin must keep the compact duck logo");
assert.match(css, /\.brand-wordmark-image\s*\{[^}]*width:\s*124px/, "skin must keep the Montserrat wordmark compact");
assert.match(css, /\.article-cover\s*\{[^}]*width:\s*min\(100%,\s*500px\)[^}]*aspect-ratio:\s*16\s*\/\s*9/, "article cover must remain a bounded editorial preview");
assert.match(css, /\.category-dock-panel\s*\{[^}]*backdrop-filter:\s*blur\(22px\)/, "desktop categories need a readable glass surface over game previews");
assert.match(css, /\.article-cover\s*\{[^}]*background:\s*#000/, "portrait article covers need black letterboxing");
assert.match(css, /\.article-cover img\s*\{[^}]*height:\s*100%[^}]*object-fit:\s*contain/, "article covers must show the full image without stretching");
assert.match(css, /\.article-body \.another_category\s*\{[^}]*display:\s*none\s*!important/, "Tistory's duplicate raw category table must stay hidden");
assert.match(css, /\.article-body\s*\{[^}]*font-family:\s*-apple-system[^}]*font-size:\s*clamp\(1rem,\s*1\.1vw,\s*1\.075rem\)/, "article body must use compact sans-serif typography");
assert.match(css, /\.article-body figure[^{}]*\{[^}]*display:\s*block[^}]*width:\s*100%[^}]*margin:\s*2\.2em 0[^}]*transform:\s*none/, "article media must keep a safe left-aligned width");
assert.doesNotMatch(css, /\.article-body figure[^{}]*\{[^}]*margin:\s*2\.4em 50%/, "article media must not collapse under Tistory's display-table rule");
assert.match(css, /\[data-og-image=""\][^{}]*> a\s*\{[^}]*grid-template-columns:\s*1fr/, "link previews without an image must not reserve a blank column");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\] > a/, "link preview reset must outrank Tistory's page-level CSS");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\]\[data-og-image=""\] > a\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/, "empty link cards must also outrank the page-level grid reset");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\] p\.og-title/, "link preview titles must outrank Tistory's page-level typography");
assert.match(css, /#tt-body-page \.article-body figure\[data-ke-type="opengraph"\] p\.og-host[^{]*\{[^}]*position:\s*static\s*!important/, "link preview hosts must not overlap the description");
assert.match(css, /\.article-body pre\s*\{[^}]*color:\s*var\(--code-text\)[^}]*background:\s*var\(--code-bg\)/, "code blocks need a dedicated high-contrast palette");
assert.match(css, /\.tt-comment-cont \.tt-area-write\s*\{[^}]*align-items:\s*flex-start[^}]*padding:\s*20px/, "comment editor needs a compact card layout");
assert.match(css, /#tt-body-page \.tt-comment-cont \.tt-area-write\s*\{[^}]*display:\s*grid\s*!important[^}]*grid-template-columns:\s*44px minmax\(0,\s*1fr\)/, "comment editor reset must prevent the avatar strip");
assert.match(xml, /<contentWidth>760<\/contentWidth>/, "editor width must match article measure");
assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket)\b/, "skin script must not make remote requests");
assert.doesNotMatch(script, /house_duck_theme/, "skin must not read or persist a removed theme choice");
assert.match(script, /https:\/\/houseduck\.in\/tistory-skin\/style\.css\?v=1\.3\.4/, "the live skin must receive a cache-busted managed stylesheet without a manual admin upload");
assert.match(script, /\[data-theme-toggle\][\s\S]*\.remove\(\)/, "the live skin must remove the retired control from older uploaded HTML");
assert.match(script, /data-typewriter/, "Blog statement needs game-style text output");
assert.match(script, /data-game-preview/, "Blog previews need reduced-motion playback control");
assert.match(script, /HOUSE_DUCK_BLOG_LOCALES/, "skin must route readers through the generated locale manifest");
assert.match(script, /original/, "Korean original view must bypass automatic redirection");
assert.match(script, /data-alt|figcaption/, "skin script should recover useful image alt text");
assert.match(script, /article-section-/, "skin script should anchor article headings for the table of contents");

const assetReferences = [...html.matchAll(/(?:href|src)="\.\/([^"?#]+)"/g)].map((match) => match[1]);
for (const asset of assetReferences) {
  assert.ok(fs.existsSync(path.join(skinDir, asset)), `unresolved skin asset: ${asset}`);
}

console.log("Tistory skin contract: PASS");
