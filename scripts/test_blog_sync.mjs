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
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}

console.log("blog sync fixture: PASS");
