import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sanitizeHtmlLibrary from "sanitize-html";

const SITE_ORIGIN = "https://houseduck.in";
const BLOG_ORIGIN = "https://blog.houseduck.in";
const TRANSLATION_PIPELINE_VERSION = 6;
const YOUTUBE_EMBED_HOSTS = new Set(["youtube.com", "www.youtube.com", "www.youtube-nocookie.com"]);
const LOCALES = {
  kr: { lang: "ko", label: "한국어", back: "모든 포스트", heading: "제작 기록", description: "게임과 앱을 만들며 겪은 시행착오와 출시 과정을 기록하는 House Duck 개발 블로그입니다.", skip: "본문으로 건너뛰기", theme: "색상 테마 전환", noteTitle: "공식 블로그", note: "같은 글을", original: "House Duck Blog에서 읽기", auto: false },
  en: { lang: "en", label: "English", back: "All posts", heading: "Build notes", description: "House Duck build notes about making games and apps, including real decisions, mistakes, and release work.", skip: "Skip to content", theme: "Switch color theme", noteTitle: "Automatic translation", note: "This page was automatically translated from Korean and may contain unnatural wording.", original: "Read the Korean original", auto: true },
  de: { lang: "de", label: "Deutsch", back: "Alle Beiträge", heading: "Entwicklungsnotizen", description: "Entwicklungsnotizen von House Duck über Spiele, Apps, Entscheidungen, Fehler und Veröffentlichungen.", skip: "Zum Inhalt springen", theme: "Farbschema wechseln", noteTitle: "Automatische Übersetzung", note: "Diese Seite wurde automatisch aus dem Koreanischen übersetzt und kann unnatürliche Formulierungen enthalten.", original: "Koreanisches Original lesen", auto: true },
  ja: { lang: "ja", label: "日本語", back: "すべての記事", heading: "開発記録", description: "ゲームやアプリを作る中での判断、失敗、改善、リリース過程を記録するHouse Duckの開発ブログです。", skip: "本文へ移動", theme: "カラーテーマを切り替える", noteTitle: "自動翻訳", note: "このページは韓国語から自動翻訳されているため、不自然な表現が含まれる場合があります。", original: "韓国語の原文を読む", auto: true },
};

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  });
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : "";
}

function textOnly(value) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function isSafeYoutubeEmbed(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && YOUTUBE_EMBED_HOSTS.has(url.hostname)
      && /^\/embed\/[A-Za-z0-9_-]{6,}\/?$/.test(url.pathname);
  } catch (_error) {
    return false;
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch (_error) {
    return "";
  }
}

function sanitizeHtml(value) {
  return sanitizeHtmlLibrary(String(value || "").replaceAll("https://houseduck.tistory.com", BLOG_ORIGIN), {
    allowedTags: [
      "a", "b", "blockquote", "br", "code", "del", "details", "div", "em",
      "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
      "i", "iframe", "img", "li", "ol", "p", "pre", "s", "span", "strong", "summary",
      "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      "*": ["class", "data-ke-align", "data-ke-size", "data-ke-style", "data-ke-title", "data-ke-type", "data-ke-url"],
      a: ["href", "rel", "target", "title"],
      figure: ["data-og-image"],
      iframe: ["allow", "allowfullscreen", "class", "frameborder", "height", "loading", "referrerpolicy", "src", "title", "width"],
      img: ["alt", "height", "loading", "src", "title", "width"],
      span: ["data-alt", "data-origin-height", "data-origin-width", "data-phocus", "data-url"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedClasses: {
      "*": ["alignCenter", "alignLeft", "alignRight", "imageblock", "link-og", "og-desc", "og-host", "og-image", "og-link", "og-text", "og-title", "video-landscape", "video-portrait"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { iframe: ["https"], img: ["http", "https"] },
    allowedIframeHostnames: [...YOUTUBE_EMBED_HOSTS],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    nonTextTags: ["script", "style", "textarea", "option", "xmp", "object", "embed", "form", "svg", "math", "template"],
    parseStyleAttributes: false,
    exclusiveFilter: (frame) => frame.tag === "iframe" && !isSafeYoutubeEmbed(frame.attribs?.src),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, alt: attribs.alt || "", loading: attribs.loading || "lazy" },
      }),
      div: (tagName, attribs) => {
        if (!String(attribs.class || "").split(/\s+/).includes("og-image")) return { tagName, attribs };
        const src = safeHttpsUrl(attribs["data-og-image"]);
        return src
          ? { tagName: "img", attribs: { src, alt: "", loading: "lazy", class: "og-image" } }
          : { tagName, attribs: { class: "og-image" } };
      },
      figure: (tagName, attribs) => {
        const { "data-og-image": image, ...rest } = attribs;
        const safeImage = safeHttpsUrl(image);
        return { tagName, attribs: safeImage ? { ...rest, "data-og-image": safeImage } : rest };
      },
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: (() => {
          const hasWidth = /^[1-9]\d{0,3}$/.test(attribs.width || "");
          const hasHeight = /^[1-9]\d{0,3}$/.test(attribs.height || "");
          const priorClass = String(attribs.class || "").split(/\s+/).find((value) => value === "video-portrait" || value === "video-landscape");
          const { width: _width, height: _height, ...rest } = attribs;
          return {
          ...rest,
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
          title: attribs.title || "YouTube video",
          class: hasWidth && hasHeight
            ? Number(attribs.height) > Number(attribs.width) ? "video-portrait" : "video-landscape"
            : priorClass || "video-landscape",
          };
        })(),
      }),
    },
  });
}

function normalizeBlogUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || !["houseduck.tistory.com", "blog.houseduck.in"].includes(url.hostname)) return "";
    url.hostname = "blog.houseduck.in";
    return url.href;
  } catch (_error) {
    return "";
  }
}

function safeSlug(link, title) {
  let raw = "";
  try {
    raw = decodeURIComponent(new URL(link).pathname.split("/").filter(Boolean).at(-1) || "");
  } catch (_error) {
    raw = title;
  }
  const slug = String(raw || title)
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "post";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function parseGeneratedLocaleManifest(source) {
  if (!source) return { posts: {} };
  const match = source.match(/^window\.HOUSE_DUCK_BLOG_LOCALES=(\{[\s\S]*\});\s*$/);
  if (!match) throw new Error("Existing blog locale manifest is malformed; refusing to overwrite archived discovery data");
  const manifest = JSON.parse(match[1]);
  if (!manifest || typeof manifest !== "object" || !manifest.posts || typeof manifest.posts !== "object" || Array.isArray(manifest.posts)) {
    throw new Error("Existing blog locale manifest has an invalid shape; refusing to overwrite archived discovery data");
  }
  return manifest;
}

function parseGeneratedIndexCards(source, locale) {
  if (!source) return [];
  const section = source.match(/<section class="mirror-grid">([\s\S]*?)<\/section>/);
  if (!section) throw new Error(`Existing ${locale} blog index is malformed; refusing to overwrite archived discovery data`);
  return Array.from(section[1].matchAll(/<article>[\s\S]*?<\/article>/g), (match) => {
    const href = match[0].match(new RegExp(`href="/blog/${locale}/([^"/]+)/"`));
    if (!href) return null;
    try {
      return { slug: decodeURIComponent(href[1]), html: match[0] };
    } catch (_error) {
      return null;
    }
  }).filter(Boolean);
}

function parseGeneratedSitemap(source) {
  if (!source) return [];
  const entries = Array.from(source.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g), (match) => ({
    loc: decodeEntities(match[1]),
    lastmod: match[2],
  }));
  if (!source.includes("<urlset") || entries.length === 0) {
    throw new Error("Existing blog sitemap is malformed; refusing to overwrite archived discovery data");
  }
  return entries;
}

function assertGeneratedDiscoveryConsistent(manifest, cardsByLocale, sitemapEntries) {
  const manifestKeys = new Set();
  const manifestUrls = new Set();
  for (const [slug, localeUrls] of Object.entries(manifest.posts)) {
    if (!localeUrls || typeof localeUrls !== "object" || Array.isArray(localeUrls) || Object.keys(localeUrls).length === 0) {
      throw new Error(`Existing discovery data for ${slug} is incomplete; refusing to overwrite archived posts`);
    }
    for (const [locale, url] of Object.entries(localeUrls)) {
      if (!LOCALES[locale]) throw new Error(`Existing discovery data for ${slug} has an unknown locale; refusing to overwrite archived posts`);
      const expectedUrl = `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(slug)}/`;
      if (url !== expectedUrl) throw new Error(`Existing discovery data for ${slug} is malformed; refusing to overwrite archived posts`);
      manifestKeys.add(`${locale}\0${slug}`);
      manifestUrls.add(expectedUrl);
    }
  }

  const cardKeys = new Set();
  for (const [locale, cards] of Object.entries(cardsByLocale)) {
    for (const { slug } of cards) {
      const key = `${locale}\0${slug}`;
      if (cardKeys.has(key) || !manifestKeys.has(key)) {
        throw new Error(`Existing ${locale} blog index is incomplete; refusing to overwrite archived posts`);
      }
      cardKeys.add(key);
    }
  }
  for (const key of manifestKeys) {
    if (!cardKeys.has(key)) throw new Error("Existing blog index is incomplete; refusing to overwrite archived posts");
  }

  const sitemapUrls = new Set();
  const generatedPostPattern = new RegExp(`^${SITE_ORIGIN.replaceAll(".", "\\.")}/blog/(?:${Object.keys(LOCALES).join("|")})/[^/]+/$`);
  for (const { loc } of sitemapEntries) {
    if (sitemapUrls.has(loc)) throw new Error("Existing blog sitemap is malformed; refusing to overwrite archived posts");
    sitemapUrls.add(loc);
    if (generatedPostPattern.test(loc) && !manifestUrls.has(loc)) {
      throw new Error("Existing blog sitemap is incomplete; refusing to overwrite archived posts");
    }
  }
  for (const url of manifestUrls) {
    if (!sitemapUrls.has(url)) throw new Error("Existing blog sitemap is incomplete; refusing to overwrite archived posts");
  }
}

async function readGeneratedDiscoveryState(outRoot, currentSlugs) {
  const manifestSource = await readOptional(path.join(outRoot, "assets", "blog-locales.js"));
  const indexSources = Object.fromEntries(await Promise.all(Object.keys(LOCALES).map(async (locale) => [
    locale,
    await readOptional(path.join(outRoot, "blog", locale, "index.html")),
  ])));
  const sitemapSource = await readOptional(path.join(outRoot, "sitemap-blog.xml"));
  const sources = [manifestSource, sitemapSource, ...Object.values(indexSources)];
  if (sources.some(Boolean) && sources.some((source) => !source)) {
    throw new Error("Existing generated discovery state is incomplete; refusing to overwrite archived posts");
  }
  const manifest = parseGeneratedLocaleManifest(manifestSource);
  const cardsByLocale = Object.fromEntries(Object.entries(indexSources).map(([locale, source]) => [
    locale,
    parseGeneratedIndexCards(source, locale),
  ]));
  const sitemapEntries = parseGeneratedSitemap(sitemapSource);
  if (sources.every(Boolean)) assertGeneratedDiscoveryConsistent(manifest, cardsByLocale, sitemapEntries);
  const sitemapByUrl = new Map(sitemapEntries.map((entry) => [entry.loc, entry]));
  const cardByLocaleAndSlug = Object.fromEntries(Object.entries(cardsByLocale).map(([locale, cards]) => [
    locale,
    new Map(cards.map((card) => [card.slug, card])),
  ]));
  const posts = {};
  const retainedUrls = new Set();

  for (const [slug, localeUrls] of Object.entries(manifest.posts)) {
    if (currentSlugs.has(slug) || !localeUrls || typeof localeUrls !== "object") continue;
    const retainedLocales = {};
    for (const locale of Object.keys(LOCALES)) {
      const expectedUrl = `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(slug)}/`;
      if (localeUrls[locale] !== expectedUrl
        || !cardByLocaleAndSlug[locale].has(slug)
        || !sitemapByUrl.has(expectedUrl)) continue;
      retainedLocales[locale] = expectedUrl;
      retainedUrls.add(expectedUrl);
    }
    if (Object.keys(retainedLocales).length > 0) posts[slug] = retainedLocales;
  }

  return {
    manifest: { posts },
    cardsByLocale: Object.fromEntries(Object.entries(cardsByLocale).map(([locale, cards]) => [
      locale,
      cards.filter(({ slug }) => posts[slug]?.[locale]),
    ])),
    sitemapEntries: sitemapEntries.filter(({ loc }) => retainedUrls.has(loc)),
  };
}

export function parseRss(xml) {
  return Array.from(String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi), (match) => {
    const block = match[1];
    const title = textOnly(tagValue(block, "title"));
    const sourceLink = normalizeBlogUrl(textOnly(tagValue(block, "link")));
    const bodyHtml = sanitizeHtml(tagValue(block, "description"));
    const imageMatch = bodyHtml.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    const publishedAt = new Date(textOnly(tagValue(block, "pubDate")));
    return {
      title,
      slug: safeSlug(sourceLink, title),
      originalUrl: sourceLink,
      bodyHtml,
      summary: textOnly(bodyHtml).slice(0, 180),
      image: imageMatch ? decodeEntities(imageMatch[1]) : "",
      category: textOnly(tagValue(block, "category")),
      publishedAt: Number.isNaN(publishedAt.valueOf()) ? new Date(0) : publishedAt,
      sourceHash: createHash("sha256").update(`${title}\n${bodyHtml}`).digest("hex"),
    };
  }).filter((post) => post.title && post.originalUrl);
}

function alternateLinks(post, availableLocales) {
  const links = availableLocales.map((locale) => {
    const href = `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(post.slug)}/`;
    return `  <link rel="alternate" hreflang="${LOCALES[locale].lang}" href="${href}">`;
  });
  links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/blog/kr/${encodeURIComponent(post.slug)}/">`);
  return links.join("\n");
}

function localizedDate(date, locale) {
  const tags = { kr: "ko-KR", en: "en-US", de: "de-DE", ja: "ja-JP" };
  return new Intl.DateTimeFormat(tags[locale], { dateStyle: "long" }).format(date);
}

function originalViewUrl(value) {
  const url = new URL(value);
  url.searchParams.set("original", "1");
  return url.href;
}

function renderPostPage(post, locale, content, availableLocales) {
  const copy = LOCALES[locale];
  const canonical = `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(post.slug)}/`;
  const translatedLabel = copy.auto ? "AUTOMATIC TRANSLATION" : "KOREAN ORIGINAL";
  const bodyHtml = sanitizeHtml(content.body_html);
  const image = safeHttpsUrl(post.image);
  const ogLocales = { kr: "ko_KR", en: "en_US", de: "de_DE", ja: "ja_JP" };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: content.title,
    description: content.summary,
    datePublished: post.publishedAt.toISOString(),
    inLanguage: copy.lang,
    mainEntityOfPage: canonical,
    url: canonical,
    ...(image ? { image } : {}),
    ...(locale === "kr" && post.category ? { articleSection: post.category } : {}),
    author: { "@type": "Organization", name: "House Duck", url: `${SITE_ORIGIN}/` },
    publisher: {
      "@type": "Organization",
      name: "House Duck",
      url: `${SITE_ORIGIN}/`,
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/assets/house-duck-logo.png` },
    },
  };
  const koreanLabels = { en: "Korean", de: "Koreanisch", ja: "韓国語" };
  const localeLinks = availableLocales.map((key) => `<a href="/blog/${key}/${encodeURIComponent(post.slug)}/"${key === locale ? ' aria-current="page"' : ""}>${key === "kr" && locale !== "kr" ? koreanLabels[locale] : LOCALES[key].label}</a>`).join("");
  return `<!doctype html>
<html lang="${copy.lang}" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(content.summary)}">
  <meta name="robots" content="max-image-preview:large">
  <meta name="theme-color" content="#111315">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="House Duck">
  <meta property="og:title" content="${escapeHtml(content.title)}">
  <meta property="og:description" content="${escapeHtml(content.summary)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${ogLocales[locale]}">
${availableLocales.filter((key) => key !== locale).map((key) => `  <meta property="og:locale:alternate" content="${ogLocales[key]}">`).join("\n")}
  <meta property="article:published_time" content="${post.publishedAt.toISOString()}">
${image ? `  <meta property="og:image" content="${escapeHtml(image)}">` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${escapeHtml(content.title)}">
  <meta name="twitter:description" content="${escapeHtml(content.summary)}">
${image ? `  <meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  <link rel="canonical" href="${canonical}">
${alternateLinks(post, availableLocales)}
  <link rel="alternate" type="application/rss+xml" title="House Duck Blog" href="https://houseduck.tistory.com/rss">
  <link rel="stylesheet" href="/assets/blog-mirror.css">
  <script defer src="/assets/blog-mirror.js"></script>
  <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>
  <title>${escapeHtml(content.title)} — House Duck Blog</title>
</head>
<body>
  <a class="skip-link" href="#post-content">${copy.skip}</a>
  <header class="mirror-header"><a class="mirror-brand" href="/"><img src="/assets/house-duck-logo.png" alt="" width="512" height="512"><img src="/assets/house-duck-wordmark.png" alt="House Duck" width="1694" height="394"></a><nav><a href="/blog/${locale}/">Blog</a><button type="button" data-theme-toggle aria-label="${copy.theme}">☾</button></nav></header>
  <main class="mirror-main" id="post-content">
    <a class="mirror-back" href="/blog/${locale}/">← ${copy.back}</a>
    <article>
      <header class="mirror-post-header"><p>HOUSE DUCK · ${translatedLabel}</p><h1>${escapeHtml(content.title)}</h1><time datetime="${post.publishedAt.toISOString()}">${escapeHtml(localizedDate(post.publishedAt, locale))}</time></header>
      <nav class="mirror-locales mirror-post-locales" aria-label="Language">${localeLinks}</nav>
      <aside class="mirror-note"><strong>${copy.noteTitle}</strong><span>${copy.note} <a href="${escapeHtml(originalViewUrl(post.originalUrl))}">${copy.original}</a></span></aside>
      <div class="mirror-body">${bodyHtml}</div>
    </article>
  </main>
  <footer class="mirror-footer">© <span data-current-year>2026</span> House Duck.</footer>
</body>
</html>\n`;
}

function renderIndexPage(posts, locale, archivedCards = []) {
  const copy = LOCALES[locale];
  const currentCards = posts.map(({ post, content }, index) => `<article><a href="/blog/${locale}/${encodeURIComponent(post.slug)}/">${post.image ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(content.title)}" loading="${index === 0 ? "eager" : "lazy"}"${index === 0 ? ' fetchpriority="high"' : ""}>` : ""}<div><time datetime="${post.publishedAt.toISOString()}">${escapeHtml(localizedDate(post.publishedAt, locale))}</time><h2>${escapeHtml(content.title)}</h2><p>${escapeHtml(content.summary)}</p></div></a></article>`);
  const retainedCards = archivedCards.map(({ html }) => html
    .replace(/\s+fetchpriority="high"/g, "")
    .replace(/loading="eager"/g, 'loading="lazy"'));
  if (currentCards.length === 0 && retainedCards.length > 0) {
    retainedCards[0] = retainedCards[0].replace('loading="lazy"', 'loading="eager" fetchpriority="high"');
  }
  const cards = [...currentCards, ...retainedCards].join("\n");
  const alternates = Object.entries(LOCALES).map(([key, value]) => `<link rel="alternate" hreflang="${value.lang}" href="${SITE_ORIGIN}/blog/${key}/">`).join("");
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "House Duck Blog",
    url: `${SITE_ORIGIN}/blog/${locale}/`,
    inLanguage: copy.lang,
    publisher: { "@type": "Organization", name: "House Duck", url: `${SITE_ORIGIN}/` },
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="${copy.lang}" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(copy.description)}"><meta name="robots" content="max-image-preview:large"><meta name="theme-color" content="#111315"><meta property="og:type" content="website"><meta property="og:site_name" content="House Duck"><meta property="og:title" content="House Duck Blog — ${copy.label}"><meta property="og:description" content="${escapeHtml(copy.description)}"><meta property="og:url" content="${SITE_ORIGIN}/blog/${locale}/"><link rel="canonical" href="${SITE_ORIGIN}/blog/${locale}/">${alternates}<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/blog/kr/"><link rel="alternate" type="application/rss+xml" title="House Duck Blog" href="https://houseduck.tistory.com/rss"><link rel="stylesheet" href="/assets/blog-mirror.css"><script defer src="/assets/blog-mirror.js"></script><script type="application/ld+json">${structuredData}</script><title>House Duck Blog — ${copy.label}</title></head><body><a class="skip-link" href="#blog-content">${copy.skip}</a><header class="mirror-header"><a class="mirror-brand" href="/"><img src="/assets/house-duck-logo.png" alt="" width="512" height="512"><img src="/assets/house-duck-wordmark.png" alt="House Duck" width="1694" height="394"></a><nav><button type="button" data-theme-toggle aria-label="${copy.theme}">☾</button></nav></header><main class="mirror-index" id="blog-content"><p>HOUSE DUCK · ${copy.label.toUpperCase()}</p><h1>${copy.heading}.</h1><nav class="mirror-locales">${Object.entries(LOCALES).map(([key, value]) => `<a href="/blog/${key}/"${key === locale ? ' aria-current="page"' : ""}>${value.label}</a>`).join("")}</nav><section class="mirror-grid">${cards}</section></main><footer class="mirror-footer">© <span data-current-year>2026</span> House Duck.</footer></body></html>\n`;
}

export function buildTranslationSource(posts) {
  return {
    translation_version: TRANSLATION_PIPELINE_VERSION,
    posts: posts.map((post) => ({
      slug: post.slug,
      source_hash: post.sourceHash,
      title: post.title,
      summary: post.summary,
      body_html: post.bodyHtml,
    })),
  };
}

function contentByLocale(post, translations) {
  const cached = translations[post.slug];
  const cacheMatches = cached?.source_hash === post.sourceHash
    && cached?.translation_version === TRANSLATION_PIPELINE_VERSION;
  return {
    kr: { title: post.title, summary: post.summary, body_html: post.bodyHtml, reviewed: true },
    ...(cacheMatches
      ? Object.fromEntries(Object.keys(LOCALES).flatMap((locale) => {
        const content = cached[locale];
        return locale !== "kr" && content?.title && content?.summary && content?.body_html && content?.reviewed === true
          ? [[locale, content]]
          : [];
      }))
      : {}),
  };
}

export async function syncFromXml(xml, options) {
  const outRoot = path.resolve(options.outRoot);
  const posts = parseRss(xml).sort((a, b) => b.publishedAt - a.publishedAt);
  const currentSlugs = new Set(posts.map((post) => post.slug));
  const archivedDiscovery = await readGeneratedDiscoveryState(outRoot, currentSlugs);
  const now = options.now || posts[0]?.publishedAt.toISOString() || new Date(0).toISOString();
  const translations = options.translations?.posts || {};
  const feed = {
    updated_at: now,
    posts: posts.slice(0, 12).map((post) => {
      const localized = Object.fromEntries(Object.entries(contentByLocale(post, translations)).map(([locale, content]) => [locale, {
        title: content.title,
        summary: content.summary,
        url: `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(post.slug)}/`,
      }]));
      return {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        image: post.image,
        published_at: post.publishedAt.toISOString(),
        url: `${SITE_ORIGIN}/blog/kr/${encodeURIComponent(post.slug)}/`,
        original_url: post.originalUrl,
        localized,
      };
    }),
  };

  await mkdir(path.join(outRoot, "assets"), { recursive: true });
  await writeFile(path.join(outRoot, "assets", "blog-feed.json"), `${JSON.stringify(feed, null, 2)}\n`);
  const sitemapUrls = [];
  const localeManifest = { posts: {} };
  const localeIndexes = Object.fromEntries(Object.keys(LOCALES).map((locale) => [locale, []]));
  for (const post of posts) {
    const localizedContent = contentByLocale(post, translations);
    await Promise.all(Object.keys(LOCALES).map((locale) => rm(path.join(outRoot, "blog", locale, post.slug), { recursive: true, force: true })));
    const availableLocales = Object.keys(LOCALES).filter((locale) => {
      const content = localizedContent[locale];
      return content && content.title && content.summary;
    });
    localeManifest.posts[post.slug] = Object.fromEntries(availableLocales.map((locale) => [locale, `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(post.slug)}/`]));
    for (const locale of availableLocales) {
      const directory = path.join(outRoot, "blog", locale, post.slug);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "index.html"), renderPostPage(post, locale, localizedContent[locale], availableLocales));
      localeIndexes[locale].push({ post, content: localizedContent[locale] });
      sitemapUrls.push({ loc: `${SITE_ORIGIN}/blog/${locale}/${encodeURIComponent(post.slug)}/`, lastmod: post.publishedAt.toISOString().slice(0, 10) });
    }
  }
  Object.assign(localeManifest.posts, archivedDiscovery.manifest.posts);
  sitemapUrls.push(...archivedDiscovery.sitemapEntries);
  for (const locale of Object.keys(LOCALES)) {
    const directory = path.join(outRoot, "blog", locale);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), renderIndexPage(localeIndexes[locale], locale, archivedDiscovery.cardsByLocale[locale]));
    sitemapUrls.push({ loc: `${SITE_ORIGIN}/blog/${locale}/`, lastmod: now.slice(0, 10) });
  }
  await writeFile(path.join(outRoot, "assets", "blog-locales.js"), `window.HOUSE_DUCK_BLOG_LOCALES=${JSON.stringify(localeManifest)};\n`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(({ loc, lastmod }) => `  <url><loc>${escapeHtml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  await writeFile(path.join(outRoot, "sitemap-blog.xml"), sitemap);
  return feed;
}

async function runCli() {
  const args = process.argv.slice(2);
  const valueOf = (flag, fallback = "") => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const outRoot = valueOf("--out-root", process.cwd());
  const rssFile = valueOf("--rss");
  const rssUrl = valueOf("--rss-url", "https://houseduck.tistory.com/rss");
  const translationsFile = valueOf("--translations");
  const sourceOut = valueOf("--source-out");
  const xml = rssFile
    ? await readFile(path.resolve(rssFile), "utf8")
    : await fetch(rssUrl).then((response) => {
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
      return response.text();
    });
  let translations = {};
  if (translationsFile) {
    try {
      translations = JSON.parse(await readFile(path.resolve(translationsFile), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const posts = parseRss(xml);
  if (posts.length === 0) throw new Error("RSS parsed zero posts; refusing to overwrite generated blog");
  if (sourceOut) {
    await writeFile(path.resolve(sourceOut), `${JSON.stringify(buildTranslationSource(posts), null, 2)}\n`);
  }
  await syncFromXml(xml, { outRoot, translations });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runCli();
}
