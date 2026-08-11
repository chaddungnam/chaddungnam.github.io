import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  assert.equal(blogSync.buildTranslationSource(posts).translation_version, 6);
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

  const failClosedRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-fail-closed-"));
  try {
    const invalidRss = path.join(failClosedRoot, "rss.html");
    const protectedFiles = [
      path.join(failClosedRoot, "source.json"),
      path.join(failClosedRoot, "assets", "blog-feed.json"),
      path.join(failClosedRoot, "blog", "kr", "index.html"),
      path.join(failClosedRoot, "sitemap-blog.xml"),
    ];
    await writeFile(invalidRss, "<!doctype html><title>Temporary upstream error</title>");
    for (const file of protectedFiles) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "preserve me");
    }
    const result = spawnSync(process.execPath, [
      path.join(here, "blog-sync.mjs"),
      "--rss", invalidRss,
      "--out-root", failClosedRoot,
      "--source-out", protectedFiles[0],
    ], { encoding: "utf8" });
    assert.equal(result.status, 1, "CLI must reject an RSS response that parses zero posts");
    assert.match(result.stderr, /zero posts/i);
    for (const file of protectedFiles) assert.equal(await readFile(file, "utf8"), "preserve me");
  } finally {
    await rm(failClosedRoot, { recursive: true, force: true });
  }

  await blogSync.syncFromXml(fixture, {
    outRoot: outputRoot,
    now: "2026-08-09T08:00:00.000Z",
    translations: {
      posts: {
        "first-post": {
          source_hash: posts[0].sourceHash,
          translation_version: 6,
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
  assert.match(koreanPage, /공식 블로그/);
  assert.match(koreanPage, /House Duck Blog에서 읽기/);
  assert.match(koreanPage, /class="mirror-footer site-footer"/);
  assert.match(koreanPage, /href="\/impressum\/ko\.html">Impressum<\/a>/);
  assert.match(koreanPage, /href="mailto:business@houseduck\.in"/);
  assert.match(koreanPage, /https:\/\/blog\.houseduck\.in\/entry\/first-post\?original=1/);
  assert.doesNotMatch(koreanPage, /<script>alert|onerror=/i);

  const englishPage = await readFile(path.join(outputRoot, "blog", "en", "first-post", "index.html"), "utf8");
  assert.match(englishPage, /<html lang="en"/);
  assert.match(englishPage, /<h1>The first build log<\/h1>/);
  assert.match(englishPage, /This page was automatically translated from Korean/);
  assert.match(englishPage, /hreflang="ko" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  assert.match(englishPage, /hreflang="de" href="https:\/\/houseduck\.in\/blog\/de\/first-post\/"/);
  assert.match(englishPage, /hreflang="x-default" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  for (const locale of ["kr", "en", "de", "ja"]) {
    assert.match(englishPage, new RegExp(`<a href="/blog/${locale}/first-post/"`), `post switcher needs ${locale}`);
  }
  assert.match(englishPage, /<a href="\/blog\/en\/first-post\/" aria-current="page">English<\/a>/);
  assert.match(englishPage, /<meta property="og:type" content="article">/);
  assert.match(englishPage, /<meta property="og:title" content="The first build log">/);
  assert.match(englishPage, /<meta property="og:url" content="https:\/\/houseduck\.in\/blog\/en\/first-post\/">/);
  assert.match(englishPage, /<meta property="og:image" content="https:\/\/blog\.kakaocdn\.net\/example\.png">/);
  assert.match(englishPage, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(englishPage, /<meta name="robots" content="max-image-preview:large">/);
  assert.match(englishPage, /type="application\/rss\+xml" title="House Duck Blog"/);
  assert.doesNotMatch(englishPage, /site-fonts\.css/, "translated posts should not download the large display font");
  const jsonLdMatch = englishPage.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(jsonLdMatch, "post needs BlogPosting structured data");
  assert.deepEqual(JSON.parse(jsonLdMatch[1]), {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "The first build log",
    description: "The first record of turning an idea into a real product.",
    datePublished: "2026-08-09T07:32:44.000Z",
    inLanguage: "en",
    mainEntityOfPage: "https://houseduck.in/blog/en/first-post/",
    url: "https://houseduck.in/blog/en/first-post/",
    image: "https://blog.kakaocdn.net/example.png",
    author: { "@type": "Organization", name: "House Duck", url: "https://houseduck.in/" },
    publisher: {
      "@type": "Organization",
      name: "House Duck",
      url: "https://houseduck.in/",
      logo: { "@type": "ImageObject", url: "https://houseduck.in/assets/house-duck-logo.png" },
    },
  });

  const pendingRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-pending-"));
  try {
    const staleEnglishDirectory = path.join(pendingRoot, "blog", "en", "first-post");
    const archivedEnglishPage = path.join(pendingRoot, "blog", "en", "archive-post", "index.html");
    await mkdir(staleEnglishDirectory, { recursive: true });
    await mkdir(path.dirname(archivedEnglishPage), { recursive: true });
    await writeFile(path.join(staleEnglishDirectory, "index.html"), "stale partial translation");
    await writeFile(archivedEnglishPage, "archived translation");
    await blogSync.syncFromXml(fixture, {
      outRoot: pendingRoot,
      translations: { posts: { "first-post": {
        source_hash: posts[0].sourceHash,
        translation_version: 6,
        en: { title: "The first build log", summary: "COOKIE HALLUCINATION SUMMARY", body_html: "<p>COOKIE HALLUCINATION BODY</p>" },
        de: { title: "Der erste Entwicklungsbericht", summary: "Eine geprüfte Zusammenfassung.", summary_reviewed: true, body_html: "<p>HALLUCINATED BODY</p>" },
      } } },
    });
    await assert.rejects(
      readFile(path.join(pendingRoot, "blog", "en", "first-post", "index.html"), "utf8"),
      (error) => error.code === "ENOENT",
      "an unreviewed translation must not publish a partial or Korean fallback article",
    );
    await assert.rejects(
      readFile(path.join(pendingRoot, "blog", "de", "first-post", "index.html"), "utf8"),
      (error) => error.code === "ENOENT",
      "a reviewed summary alone must not publish without a reviewed full body",
    );
    assert.equal(await readFile(archivedEnglishPage, "utf8"), "archived translation", "RSS sync must preserve posts outside the current feed window");
  } finally {
    await rm(pendingRoot, { recursive: true, force: true });
  }

  for (const locale of ["kr", "en", "de", "ja"]) {
    const indexPage = await readFile(path.join(outputRoot, "blog", locale, "index.html"), "utf8");
    assert.match(indexPage, new RegExp(`/blog/${locale}/first-post/`));
    assert.match(indexPage, /<meta name="description" content="[^"]+">/);
    assert.match(indexPage, /<meta name="robots" content="max-image-preview:large">/);
    assert.match(indexPage, /<meta property="og:type" content="website">/);
    assert.match(indexPage, /"@type":"Blog"/);
    assert.match(indexPage, /type="application\/rss\+xml" title="House Duck Blog"/);
    assert.match(indexPage, /loading="eager" fetchpriority="high"/, "the first blog card should be the eager LCP image");
    assert.match(indexPage, /class="mirror-footer site-footer"/);
    assert.match(indexPage, /Impressum/);
    assert.match(indexPage, /business@houseduck\.in/);
    assert.doesNotMatch(indexPage, /site-fonts\.css/);
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

  const archiveRoot = await mkdtemp(path.join(tmpdir(), "house-duck-blog-archive-"));
  try {
    const archiveFixture = fixture.replace("  </channel>", `    <item>
      <title>보존할 이전 제작 기록</title>
      <link>https://houseduck.tistory.com/entry/archive-post</link>
      <description>&lt;p&gt;RSS 범위 밖에서도 검색 가능한 이전 기록입니다.&lt;/p&gt;</description>
      <category>Build Log</category>
      <pubDate>Sat, 8 Aug 2026 16:32:44 +0900</pubDate>
    </item>
  </channel>`);
    const archivePosts = blogSync.parseRss(archiveFixture);
    const archivePost = archivePosts.find((post) => post.slug === "archive-post");
    assert.ok(archivePost, "archive fixture needs the older post");
    const archiveTranslations = {
      posts: {
        "first-post": {
          source_hash: archivePosts.find((post) => post.slug === "first-post").sourceHash,
          translation_version: 6,
          en: { title: "The first build log", summary: "The first record of turning an idea into a real product.", body_html: "<p>The first record of turning an idea into a real product.</p>", reviewed: true },
          de: { title: "Der erste Entwicklungsbericht", summary: "Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.", body_html: "<p>Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.</p>", reviewed: true },
          ja: { title: "最初の開発記録", summary: "アイデアを実際の製品にした最初の記録です。", body_html: "<p>アイデアを実際の製品にした最初の記録です。</p>", reviewed: true },
        },
        "archive-post": {
          source_hash: archivePost.sourceHash,
          translation_version: 6,
          en: { title: "An archived build log", summary: "An older record that remains discoverable outside the RSS window.", body_html: "<p>An older record that remains discoverable outside the RSS window.</p>", reviewed: true },
          de: { title: "Ein archivierter Entwicklungsbericht", summary: "Ein älterer Bericht, der außerhalb des RSS-Fensters auffindbar bleibt.", body_html: "<p>Ein älterer Bericht, der außerhalb des RSS-Fensters auffindbar bleibt.</p>", reviewed: true },
          ja: { title: "保存された開発記録", summary: "RSSの範囲外でも見つけられる過去の記録です。", body_html: "<p>RSSの範囲外でも見つけられる過去の記録です。</p>", reviewed: true },
        },
      },
    };

    await blogSync.syncFromXml(archiveFixture, { outRoot: archiveRoot, translations: archiveTranslations });
    await blogSync.syncFromXml(fixture, { outRoot: archiveRoot });

    const archivedManifest = await readFile(path.join(archiveRoot, "assets", "blog-locales.js"), "utf8");
    const archivedSitemap = await readFile(path.join(archiveRoot, "sitemap-blog.xml"), "utf8");
    for (const locale of ["kr", "en", "de", "ja"]) {
      const archivedIndex = await readFile(path.join(archiveRoot, "blog", locale, "index.html"), "utf8");
      const archivedUrl = `https://houseduck.in/blog/${locale}/archive-post/`;
      assert.match(archivedIndex, new RegExp(`/blog/${locale}/archive-post/`), `${locale} index must retain posts outside the current RSS window`);
      assert.match(archivedManifest, new RegExp(`"${locale}":"${archivedUrl}"`), `${locale} locale manifest must retain posts outside the current RSS window`);
      assert.match(archivedSitemap, new RegExp(archivedUrl), `${locale} sitemap must retain posts outside the current RSS window`);
    }
    for (const locale of ["en", "de", "ja"]) {
      const archivedIndex = await readFile(path.join(archiveRoot, "blog", locale, "index.html"), "utf8");
      assert.doesNotMatch(archivedIndex, new RegExp(`/blog/${locale}/first-post/`), `${locale} index must not resurrect a stale translation for a current RSS post`);
      assert.doesNotMatch(archivedManifest, new RegExp(`"${locale}":"https://houseduck.in/blog/${locale}/first-post/"`), `${locale} locale manifest must drop a stale translation for a current RSS post`);
      assert.doesNotMatch(archivedSitemap, new RegExp(`https://houseduck.in/blog/${locale}/first-post/`), `${locale} sitemap must drop a stale translation for a current RSS post`);
    }

    await rm(path.join(archiveRoot, "blog", "de", "index.html"));
    const protectedManifest = await readFile(path.join(archiveRoot, "assets", "blog-locales.js"), "utf8");
    const protectedSitemap = await readFile(path.join(archiveRoot, "sitemap-blog.xml"), "utf8");
    await assert.rejects(
      blogSync.syncFromXml(fixture, { outRoot: archiveRoot }),
      /incomplete|malformed/i,
      "partial generated discovery state must fail closed instead of dropping archived posts",
    );
    assert.equal(await readFile(path.join(archiveRoot, "assets", "blog-locales.js"), "utf8"), protectedManifest);
    assert.equal(await readFile(path.join(archiveRoot, "sitemap-blog.xml"), "utf8"), protectedSitemap);
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

console.log("blog sync fixture: PASS");
