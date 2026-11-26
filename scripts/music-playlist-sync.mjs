// Keeps the SOUND LAB player in step with the owner's YouTube BGM playlist.
// YouTube decides the order and the titles. Audio always comes from files in assets/music:
// no YouTube embed and no audio extraction. A new video without a local file stays in the
// JSON with "src": null (shown as YouTube-only in the player) until its MP3 is added.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLAYLIST_ID = "PLK7jSNsuc6Po";
export const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

export function cleanTitle(raw) {
  return String(raw || "")
    .replace(/^\s*\[BGM\]\s*/i, "")
    .replace(/\s*_\s*(Quirky Ball|Quiry Ball|10key Survival)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function initialData(html) {
  const marker = html.indexOf("ytInitialData");
  if (marker < 0) throw new Error("playlist page has no ytInitialData");
  const start = html.indexOf("{", marker);
  const end = html.indexOf(";</script>", start);
  if (start < 0 || end < 0) throw new Error("playlist page ytInitialData is not readable");
  return JSON.parse(html.slice(start, end));
}

export function parsePlaylistPage(html) {
  const data = initialData(html);
  const items = [];
  const seen = new Set();
  const add = (videoId, title) => {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "") || !title || seen.has(videoId)) return;
    seen.add(videoId);
    items.push({ videoId, youtubeTitle: title });
  };
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const lockup = node.lockupViewModel;
    if (lockup && lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      add(lockup.contentId, lockup.metadata?.lockupMetadataViewModel?.title?.content);
      return;
    }
    const legacy = node.playlistVideoRenderer;
    if (legacy) {
      add(legacy.videoId, legacy.title?.runs?.map((run) => run.text).join("") || legacy.title?.simpleText);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "header" || key === "sidebar") continue;
      walk(node[key]);
    }
  })(data.contents);
  if (!items.length) throw new Error("playlist page lists no videos");
  return items;
}

export function mergePlaylist(previous, items, updated = new Date().toISOString()) {
  const known = new Map((previous?.tracks || []).map((track) => [track.videoId, track]));
  const tracks = items.map(({ videoId, youtubeTitle }) => {
    const old = known.get(videoId);
    return { videoId, title: cleanTitle(youtubeTitle), youtubeTitle, src: old?.src || null };
  });
  return { playlist: PLAYLIST_URL, updated, tracks };
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const input = option("--html");
  const output = option("--out") || "assets/music/playlist.json";
  if (!input) throw new Error("Usage: node scripts/music-playlist-sync.mjs --html playlist.html [--out assets/music/playlist.json]");
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : { tracks: [] };
  const items = parsePlaylistPage(fs.readFileSync(input, "utf8"));
  const sameList = JSON.stringify(previous.tracks?.map((t) => [t.videoId, t.youtubeTitle])) === JSON.stringify(items.map((t) => [t.videoId, t.youtubeTitle]));
  const merged = mergePlaylist(previous, items, sameList && previous.updated ? previous.updated : undefined);
  const missing = merged.tracks.filter((track) => !track.src);
  for (const track of missing) console.log(`::warning::SOUND LAB has no MP3 for "${track.youtubeTitle}" (${track.videoId}); add assets/music/<file>.mp3 and set its src in ${output}`);
  const temporary = `${output}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(merged, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, output);
  console.log(`playlist: ${merged.tracks.length} tracks, ${missing.length} without local audio`);
}
