import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const decode = (text) => text
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'");

function tag(entry, name) {
  return decode(entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() || "");
}

export function parseYouTubeFeed(xml) {
  const videos = [];
  for (const match of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)) {
    const videoId = tag(match[1], "yt:videoId");
    const title = tag(match[1], "title");
    const published = new Date(tag(match[1], "published"));
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !title || Number.isNaN(published.valueOf())) continue;
    videos.push({ videoId, title, published: published.toISOString() });
    if (videos.length === 3) break;
  }
  if (videos.length !== 3) throw new Error("YouTube feed must contain three valid videos");
  return videos;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const input = option("--rss");
  const output = option("--out");
  if (!input || !output) throw new Error("Usage: node scripts/youtube-sync.mjs --rss feed.xml --out assets/youtube-feed.json");
  const videos = parseYouTubeFeed(fs.readFileSync(input, "utf8"));
  const payload = JSON.stringify({ channel: "https://www.youtube.com/@houseduck_in", updated: videos[0].published, videos }, null, 2) + "\n";
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  fs.writeFileSync(temporary, payload, "utf8");
  fs.renameSync(temporary, output);
}
