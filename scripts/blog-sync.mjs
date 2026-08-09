import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://houseduck.in";
const BLOG_ORIGIN = "https://blog.houseduck.in";

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
    };
  }).filter((post) => post.title && post.originalUrl);
}

function renderKoreanPage(post) {
  const canonical = `${SITE_ORIGIN}/blog/kr/${encodeURIComponent(post.slug)}/`;
  const published = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(post.publishedAt);
  return `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(post.summary)}">
  <meta name="theme-color" content="#0d1525">
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="/assets/site-fonts.css">
  <link rel="stylesheet" href="/assets/blog-mirror.css">
  <script defer src="/assets/blog-mirror.js"></script>
  <title>${escapeHtml(post.title)} — House Duck Blog</title>
</head>
<body>
  <a class="skip-link" href="#post-content">본문으로 건너뛰기</a>
  <header class="mirror-header"><a class="mirror-brand" href="/"><img src="/assets/house-duck-logo.png" alt="" width="512" height="512"><img src="/assets/house-duck-wordmark.png" alt="House Duck" width="1694" height="394"></a><nav><a href="/blog/kr/">Blog</a><button type="button" data-theme-toggle aria-label="라이트 모드로 전환">☾</button></nav></header>
  <main class="mirror-main" id="post-content">
    <a class="mirror-back" href="/blog/kr/">← 모든 포스트</a>
    <article>
      <header class="mirror-post-header"><p>HOUSE DUCK · KOREAN ORIGINAL</p><h1>${escapeHtml(post.title)}</h1><time datetime="${post.publishedAt.toISOString()}">${escapeHtml(published)}</time></header>
      <aside class="mirror-note"><strong>한국어 원문</strong><span>이 페이지는 House Duck이 작성한 원문입니다. <a href="${escapeHtml(post.originalUrl)}">티스토리에서 보기</a></span></aside>
      <div class="mirror-body">${post.bodyHtml}</div>
    </article>
  </main>
  <footer class="mirror-footer">© <span data-current-year>2026</span> House Duck.</footer>
</body>
</html>\n`;
}

export async function syncFromXml(xml, options) {
  const outRoot = path.resolve(options.outRoot);
  const now = options.now || new Date().toISOString();
  const posts = parseRss(xml).sort((a, b) => b.publishedAt - a.publishedAt);
  const feed = {
    updated_at: now,
    posts: posts.slice(0, 12).map((post) => ({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      image: post.image,
      published_at: post.publishedAt.toISOString(),
      url: `${SITE_ORIGIN}/blog/kr/${encodeURIComponent(post.slug)}/`,
      original_url: post.originalUrl,
    })),
  };

  await mkdir(path.join(outRoot, "assets"), { recursive: true });
  await writeFile(path.join(outRoot, "assets", "blog-feed.json"), `${JSON.stringify(feed, null, 2)}\n`);
  for (const post of posts) {
    const directory = path.join(outRoot, "blog", "kr", post.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), renderKoreanPage(post));
  }
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
  const xml = rssFile
    ? await readFile(path.resolve(rssFile), "utf8")
    : await fetch(rssUrl).then((response) => {
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
      return response.text();
    });
  await syncFromXml(xml, { outRoot });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runCli();
}
