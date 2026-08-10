#!/usr/bin/env node

const assert = require("node:assert/strict");
const { buildPostCards } = require("../assets/brand-site.js");

const posts = [{
  title: "한국어 제목",
  summary: "한국어 요약",
  image: "https://blog.kakaocdn.net/post.png",
  published_at: "2026-08-09T07:32:44.000Z",
  url: "https://houseduck.in/blog/kr/post/",
  localized: {
    de: {
      title: "Deutscher Titel",
      summary: "Deutsche Zusammenfassung",
      url: "https://houseduck.in/blog/de/post/",
    },
  },
}];

const germanCards = buildPostCards(posts, "de");
assert.match(germanCards, /Deutscher Titel/);
assert.match(germanCards, /Deutsche Zusammenfassung/);
assert.match(germanCards, /href="https:\/\/houseduck\.in\/blog\/de\/post\/"/);
assert.match(germanCards, /class="post-preview-image"/);

const sixCards = buildPostCards(Array.from({ length: 7 }, (_value, index) => ({
  title: `글 ${index + 1}`,
  summary: `요약 ${index + 1}`,
  image: "https://blog.kakaocdn.net/post.png",
  published_at: "2026-08-09T07:32:44.000Z",
  url: `https://houseduck.in/blog/kr/post-${index + 1}/`,
})), "ko");
assert.equal((sixCards.match(/<article /g) || []).length, 6, "home should show two rows of six latest posts");

const safeCards = buildPostCards([{
  title: '<img src=x onerror="alert(1)">',
  summary: "<script>alert(1)</script>",
  image: 'x" onerror="alert(1)',
  url: "https://houseduck.in/blog/kr/safe/",
  published_at: "invalid",
}], "ko");
assert.doesNotMatch(safeCards, /<script|<img src=x|javascript:/i);
assert.match(safeCards, /&lt;img/);

console.log("brand feed renderer: PASS");
