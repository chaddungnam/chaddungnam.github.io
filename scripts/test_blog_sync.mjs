import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let blogSync;
try {
  blogSync = await import("./blog-sync.mjs");
} catch (error) {
  assert.fail(`blog sync module is unavailable: ${error.code || error.message}`);
}

const fixture = await readFile(path.join(here, "fixtures", "tistory-rss.xml"), "utf8");
const outputRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-sync-"));

try {
  const posts = blogSync.parseRss(fixture);
  assert.equal(posts.length, 1);
  assert.deepEqual(
    {
      title: posts[0].title,
      slug: posts[0].slug,
      originalUrl: posts[0].originalUrl,
      image: posts[0].image,
    },
    {
      title: "첫 번째 제작 기록",
      slug: "first-post",
      originalUrl: "https://blog.houseduck.in/entry/first-post",
      image: "https://blog.kakaocdn.net/example.png",
    },
  );
  assert.doesNotMatch(posts[0].bodyHtml, /<script|onerror=/i);

  await blogSync.syncFromXml(fixture, {
    outRoot: outputRoot,
    now: "2026-08-09T08:00:00.000Z",
    translations: {
      posts: {
        "first-post": {
          source_hash: posts[0].sourceHash,
          translation_version: 3,
          en: { title: "The first build log", summary: "The first record of turning an idea into a real product.", body_html: "<p>The first record of turning an idea into a real product.</p>", reviewed: true },
          de: { title: "Der erste Entwicklungsbericht", summary: "Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.", body_html: "<p>Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.</p>", reviewed: true },
          ja: { title: "最初の開発記録", summary: "アイデアを実際の製品にした最初の記録です。", body_html: "<p>アイデアを実際の製品にした最初の記録です。</p>", reviewed: true },
        },
      },
    },
  });

  const feed = JSON.parse(await readFile(path.join(outputRoot, "assets", "blog-feed.json"), "utf8"));
  assert.deepEqual(feed, {
    updated_at: "2026-08-09T08:00:00.000Z",
    posts: [{
      slug: "first-post",
      title: "첫 번째 제작 기록",
      summary: "아이디어를 실제 제품으로 만든 첫 기록입니다.",
      image: "https://blog.kakaocdn.net/example.png",
      published_at: "2026-08-09T07:32:44.000Z",
      url: "https://houseduck.in/blog/kr/first-post/",
      original_url: "https://blog.houseduck.in/entry/first-post",
      localized: {
        kr: {
          title: "첫 번째 제작 기록",
          summary: "아이디어를 실제 제품으로 만든 첫 기록입니다.",
          url: "https://houseduck.in/blog/kr/first-post/",
        },
        en: {
          title: "The first build log",
          summary: "The first record of turning an idea into a real product.",
          url: "https://houseduck.in/blog/en/first-post/",
        },
        de: {
          title: "Der erste Entwicklungsbericht",
          summary: "Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.",
          url: "https://houseduck.in/blog/de/first-post/",
        },
        ja: {
          title: "最初の開発記録",
          summary: "アイデアを実際の製品にした最初の記録です。",
          url: "https://houseduck.in/blog/ja/first-post/",
        },
      },
    }],
  });

  const koreanPage = await readFile(path.join(outputRoot, "blog", "kr", "first-post", "index.html"), "utf8");
  assert.match(koreanPage, /<html lang="ko"/);
  assert.match(koreanPage, /rel="canonical" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  assert.match(koreanPage, /아이디어를 실제 제품으로 만든 첫 기록입니다/);
  assert.match(koreanPage, /한국어 원문/);
  assert.match(koreanPage, /https:\/\/blog\.houseduck\.in\/entry\/first-post\?original=1/);
  assert.doesNotMatch(koreanPage, /<script>alert|onerror=/i);

  const englishPage = await readFile(path.join(outputRoot, "blog", "en", "first-post", "index.html"), "utf8");
  assert.match(englishPage, /<html lang="en"/);
  assert.match(englishPage, /<h1>The first build log<\/h1>/);
  assert.match(englishPage, /This page was automatically translated from Korean/);
  assert.match(englishPage, /hreflang="ko" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  assert.match(englishPage, /hreflang="de" href="https:\/\/houseduck\.in\/blog\/de\/first-post\/"/);
  assert.match(englishPage, /hreflang="x-default" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);

  const pendingRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-pending-"));
  try {
    await blogSync.syncFromXml(fixture, {
      outRoot: pendingRoot,
      translations: { posts: { "first-post": {
        source_hash: posts[0].sourceHash,
        translation_version: 3,
        en: { title: "The first build log", summary: "COOKIE HALLUCINATION SUMMARY", body_html: "<p>COOKIE HALLUCINATION BODY</p>" },
        de: { title: "Der erste Entwicklungsbericht", summary: "Eine geprüfte Zusammenfassung.", summary_reviewed: true, body_html: "<p>HALLUCINATED BODY</p>" },
      } } },
    });
    const pendingPage = await readFile(path.join(pendingRoot, "blog", "en", "first-post", "index.html"), "utf8");
    assert.match(pendingPage, /Full translation under review/);
    assert.match(pendingPage, /This article is being reviewed/);
    assert.doesNotMatch(pendingPage, /COOKIE HALLUCINATION/);
    const reviewedSummaryPage = await readFile(path.join(pendingRoot, "blog", "de", "first-post", "index.html"), "utf8");
    assert.match(reviewedSummaryPage, /Eine geprüfte Zusammenfassung/);
    assert.doesNotMatch(reviewedSummaryPage, /HALLUCINATED BODY/);
  } finally {
    await rm(pendingRoot, { recursive: true, force: true });
  }

  for (const locale of ["kr", "en", "de", "ja"]) {
    const indexPage = await readFile(path.join(outputRoot, "blog", locale, "index.html"), "utf8");
    assert.match(indexPage, new RegExp(`/blog/${locale}/first-post/`));
  }

  const localeManifest = await readFile(path.join(outputRoot, "assets", "blog-locales.js"), "utf8");
  assert.match(localeManifest, /window\.HOUSE_DUCK_BLOG_LOCALES/);
  assert.match(localeManifest, /"de":"https:\/\/houseduck\.in\/blog\/de\/first-post\/"/);

  const blogSitemap = await readFile(path.join(outputRoot, "sitemap-blog.xml"), "utf8");
  for (const locale of ["kr", "en", "de", "ja"]) {
    assert.match(blogSitemap, new RegExp(`https://houseduck\\.in/blog/${locale}/first-post/`));
  }

  const stableRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-stable-"));
  try {
    await blogSync.syncFromXml(fixture, { outRoot: stableRoot });
    const firstFeed = await readFile(path.join(stableRoot, "assets", "blog-feed.json"), "utf8");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await blogSync.syncFromXml(fixture, { outRoot: stableRoot });
    const secondFeed = await readFile(path.join(stableRoot, "assets", "blog-feed.json"), "utf8");
    assert.equal(secondFeed, firstFeed, "unchanged RSS must not create a new generated diff");
  } finally {
    await rm(stableRoot, { recursive: true, force: true });
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

console.log("blog sync fixture: PASS");
