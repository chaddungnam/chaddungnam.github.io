import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://houseduck.in";
const BLOG_ORIGIN = "https://blog.houseduck.in";
const LOCALES = {
  kr: { lang: "ko", label: "한국어", back: "모든 포스트", noteTitle: "한국어 원문", note: "이 페이지는 House Duck이 작성한 원문입니다.", original: "티스토리에서 보기", auto: false },
  en: { lang: "en", label: "English", back: "All posts", noteTitle: "Automatic translation", note: "This page was automatically translated from Korean and may contain unnatural wording.", original: "Read the Korean original", auto: true },
  de: { lang: "de", label: "Deutsch", back: "Alle Beiträge", noteTitle: "Automatische Übersetzung", note: "Diese Seite wurde automatisch aus dem Koreanischen übersetzt und kann unnatürliche Formulierungen enthalten.", original: "Koreanisches Original lesen", auto: true },
  ja: { lang: "ja", label: "日本語", back: "すべての記事", noteTitle: "自動翻訳", note: "このページは韓国語から自動翻訳されているため、不自然な表現が含まれる場合があります。", original: "韓国語の原文を読む", auto: true },
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

function sanitizeHtml(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "")
    .replaceAll("https://houseduck.tistory.com", BLOG_ORIGIN);
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

export function parseRss(xml) {
  return Array.from(String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi), (match) => {
    const block = match[1];
    const title = textOnly(tagValue(block, "title"));
    const sourceLink = textOnly(tagValue(block, "link"));
    const bodyHtml = sanitizeHtml(tagValue(block, "description"));
    const imageMatch = bodyHtml.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    const publishedAt = new Date(textOnly(tagValue(block, "pubDate")));
    return {
      title,
      slug: safeSlug(sourceLink, title),
      originalUrl: sourceLink.replace("https://houseduck.tistory.com", BLOG_ORIGIN),
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
  return `<!doctype html>
<html lang="${copy.lang}" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(content.summary)}">
  <meta name="theme-color" content="#0d1525">
  <link rel="canonical" href="${canonical}">
${alternateLinks(post, availableLocales)}
  <link rel="stylesheet" href="/assets/site-fonts.css">
  <link rel="stylesheet" href="/assets/blog-mirror.css">
  <script defer src="/assets/blog-mirror.js"></script>
  <title>${escapeHtml(content.title)} — House Duck Blog</title>
</head>
<body>
  <a class="skip-link" href="#post-content">Skip to content</a>
  <header class="mirror-header"><a class="mirror-brand" href="/"><img src="/assets/house-duck-logo.png" alt="" width="512" height="512"><img src="/assets/house-duck-wordmark.png" alt="House Duck" width="1694" height="394"></a><nav><a href="/blog/${locale}/">Blog</a><button type="button" data-theme-toggle aria-label="Switch color theme">☾</button></nav></header>
  <main class="mirror-main" id="post-content">
    <a class="mirror-back" href="/blog/${locale}/">← ${copy.back}</a>
    <article>
      <header class="mirror-post-header"><p>HOUSE DUCK · ${translatedLabel}</p><h1>${escapeHtml(content.title)}</h1><time datetime="${post.publishedAt.toISOString()}">${escapeHtml(localizedDate(post.publishedAt, locale))}</time></header>
      <aside class="mirror-note"><strong>${copy.noteTitle}</strong><span>${copy.note} <a href="${escapeHtml(originalViewUrl(post.originalUrl))}">${copy.original}</a></span></aside>
      <div class="mirror-body">${content.body_html}</div>
    </article>
  </main>
  <footer class="mirror-footer">© <span data-current-year>2026</span> House Duck.</footer>
</body>
</html>\n`;
}

function renderIndexPage(posts, locale) {
  const copy = LOCALES[locale];
  const cards = posts.map(({ post, content }) => `<article><a href="/blog/${locale}/${encodeURIComponent(post.slug)}/">${post.image ? `<img src="${escapeHtml(post.image)}" alt="" loading="lazy">` : ""}<div><time datetime="${post.publishedAt.toISOString()}">${escapeHtml(localizedDate(post.publishedAt, locale))}</time><h2>${escapeHtml(content.title)}</h2><p>${escapeHtml(content.summary)}</p></div></a></article>`).join("\n");
  const alternates = Object.entries(LOCALES).map(([key, value]) => `<link rel="alternate" hreflang="${value.lang}" href="${SITE_ORIGIN}/blog/${key}/">`).join("");
  return `<!doctype html>
<html lang="${copy.lang}" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d1525"><link rel="canonical" href="${SITE_ORIGIN}/blog/${locale}/">${alternates}<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/blog/kr/"><link rel="stylesheet" href="/assets/site-fonts.css"><link rel="stylesheet" href="/assets/blog-mirror.css"><script defer src="/assets/blog-mirror.js"></script><title>House Duck Blog — ${copy.label}</title></head><body><header class="mirror-header"><a class="mirror-brand" href="/"><img src="/assets/house-duck-logo.png" alt="" width="512" height="512"><img src="/assets/house-duck-wordmark.png" alt="House Duck" width="1694" height="394"></a><nav><button type="button" data-theme-toggle aria-label="Switch color theme">☾</button></nav></header><main class="mirror-index"><p>HOUSE DUCK · ${copy.label.toUpperCase()}</p><h1>Build notes.</h1><nav class="mirror-locales">${Object.entries(LOCALES).map(([key, value]) => `<a href="/blog/${key}/"${key === locale ? ' aria-current="page"' : ""}>${value.label}</a>`).join("")}</nav><section class="mirror-grid">${cards}</section></main><footer class="mirror-footer">© <span data-current-year>2026</span> House Duck.</footer></body></html>\n`;
}

export function buildTranslationSource(posts) {
  return {
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
  return {
    kr: { title: post.title, summary: post.summary, body_html: post.bodyHtml },
    ...(cached?.source_hash === post.sourceHash
      ? Object.fromEntries(Object.keys(LOCALES).flatMap((locale) => cached[locale] ? [[locale, cached[locale]]] : []))
      : {}),
  };
}

export async function syncFromXml(xml, options) {
  const outRoot = path.resolve(options.outRoot);
  const now = options.now || new Date().toISOString();
  const posts = parseRss(xml).sort((a, b) => b.publishedAt - a.publishedAt);
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
    const availableLocales = Object.keys(LOCALES).filter((locale) => {
      const content = localizedContent[locale];
      return content && content.title && content.body_html;
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
  for (const locale of Object.keys(LOCALES)) {
    const directory = path.join(outRoot, "blog", locale);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), renderIndexPage(localeIndexes[locale], locale));
    sitemapUrls.push({ loc: `${SITE_ORIGIN}/blog/${locale}/`, lastmod: now.slice(0, 10) });
  }
  await writeFile(path.join(outRoot, "assets", "blog-locales.js"), `window.HOUSE_DUCK_BLOG_LOCALES=${JSON.stringify(localeManifest)};\n`);
  // ponytail: RSS is the archive source for now; add a manifest only if Tistory starts dropping older posts.
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
  if (sourceOut) {
    await writeFile(path.resolve(sourceOut), `${JSON.stringify(buildTranslationSource(posts), null, 2)}\n`);
  }
  await syncFromXml(xml, { outRoot, translations });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runCli();
}
