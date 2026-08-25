import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/youtube-sync.mjs");
assert.ok(fs.existsSync(script), "scripts/youtube-sync.mjs must exist");
const { parseYouTubeFeed } = await import(script);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry><yt:videoId>Y6uukWpHU7c</yt:videoId><title>First &amp; best</title><published>2026-08-25T10:00:00+00:00</published></entry>
  <entry><yt:videoId>-OnOWZ6jufM</yt:videoId><title>Second</title><published>2026-08-24T10:00:00+00:00</published></entry>
  <entry><yt:videoId>KySM38fx8Lg</yt:videoId><title>Third</title><published>2026-08-23T10:00:00+00:00</published></entry>
  <entry><yt:videoId>invalid</yt:videoId><title>Skip me</title><published>2026-08-22T10:00:00+00:00</published></entry>
</feed>`;

assert.deepEqual(parseYouTubeFeed(xml), [
  { videoId: "Y6uukWpHU7c", title: "First & best", published: "2026-08-25T10:00:00.000Z" },
  { videoId: "-OnOWZ6jufM", title: "Second", published: "2026-08-24T10:00:00.000Z" },
  { videoId: "KySM38fx8Lg", title: "Third", published: "2026-08-23T10:00:00.000Z" },
]);
assert.throws(() => parseYouTubeFeed("<feed><entry></feed>"), /valid videos/);

console.log("YouTube sync parser: PASS");
