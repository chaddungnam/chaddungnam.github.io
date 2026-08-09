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
          en: { title: "The first build log", summary: "The first record of turning an idea into a real product.", body_html: "<p>The first record of turning an idea into a real product.</p>" },
          de: { title: "Der erste Entwicklungsbericht", summary: "Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.", body_html: "<p>Der erste Bericht über die Umsetzung einer Idee in ein echtes Produkt.</p>" },
          ja: { title: "最初の開発記録", summary: "アイデアを実際の製品にした最初の記録です。", body_html: "<p>アイデアを実際の製品にした最初の記録です。</p>" },
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
    }],
  });

  const koreanPage = await readFile(path.join(outputRoot, "blog", "kr", "first-post", "index.html"), "utf8");
  assert.match(koreanPage, /<html lang="ko"/);
  assert.match(koreanPage, /rel="canonical" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  assert.match(koreanPage, /아이디어를 실제 제품으로 만든 첫 기록입니다/);
  assert.match(koreanPage, /한국어 원문/);
  assert.doesNotMatch(koreanPage, /<script>alert|onerror=/i);

  const englishPage = await readFile(path.join(outputRoot, "blog", "en", "first-post", "index.html"), "utf8");
  assert.match(englishPage, /<html lang="en"/);
  assert.match(englishPage, /<h1>The first build log<\/h1>/);
  assert.match(englishPage, /This page was automatically translated from Korean/);
  assert.match(englishPage, /hreflang="ko" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);
  assert.match(englishPage, /hreflang="de" href="https:\/\/houseduck\.in\/blog\/de\/first-post\/"/);
  assert.match(englishPage, /hreflang="x-default" href="https:\/\/houseduck\.in\/blog\/kr\/first-post\/"/);

  for (const locale of ["kr", "en", "de", "ja"]) {
    const indexPage = await readFile(path.join(outputRoot, "blog", locale, "index.html"), "utf8");
    assert.match(indexPage, new RegExp(`/blog/${locale}/first-post/`));
  }

  const blogSitemap = await readFile(path.join(outputRoot, "sitemap-blog.xml"), "utf8");
  for (const locale of ["kr", "en", "de", "ja"]) {
    assert.match(blogSitemap, new RegExp(`https://houseduck\\.in/blog/${locale}/first-post/`));
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

console.log("blog sync fixture: PASS");
