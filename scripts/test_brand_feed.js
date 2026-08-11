#!/usr/bin/env node

const assert = require("node:assert/strict");
const { buildPostCards } = require("../assets/brand-site.js");

const posts = [{
  title: "한국어 제목",
  summary: "한국어 요약",
  image: "https://blog.kakaocdn.net/post.png",
  published_at: "2026-08-09T07:32:44.000Z",
  url: "https://houseduck.in/blog/kr/post/",
  original_url: "https://blog.houseduck.in/entry/post",
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

const koreanCards = buildPostCards(posts, "ko");
assert.match(koreanCards, /href="https:\/\/blog\.houseduck\.in\/entry\/post"/);

const homeCards = buildPostCards(Array.from({ length: 7 }, (_value, index) => ({
  title: `글 ${index + 1}`,
  summary: `요약 ${index + 1}`,
  image: "https://blog.kakaocdn.net/post.png",
  published_at: "2026-08-09T07:32:44.000Z",
  url: `https://houseduck.in/blog/kr/post-${index + 1}/`,
  original_url: `https://blog.houseduck.in/entry/post-${index + 1}`,
})), "ko");
assert.equal((homeCards.match(/<article /g) || []).length, 4, "home should show four latest posts");
assert.equal((homeCards.match(/post-preview-card-wide/g) || []).length, 1, "the fourth post should span the full row");

const safeCards = buildPostCards([{
  title: '<img src=x onerror="alert(1)">',
  summary: "<script>alert(1)</script>",
  image: 'x" onerror="alert(1)',
  url: "https://houseduck.in/blog/kr/safe/",
  original_url: "https://blog.houseduck.in/entry/safe/",
  published_at: "invalid",
}], "ko");
assert.doesNotMatch(safeCards, /<script|<img src=x|javascript:/i);
assert.match(safeCards, /&lt;img/);

console.log("brand feed renderer: PASS");
