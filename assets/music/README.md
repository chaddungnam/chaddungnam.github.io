# SOUND LAB soundtrack

The desktop player follows the owner's [YouTube BGM playlist](https://www.youtube.com/playlist?list=PLK7jSNsuc6Po): 26 tracks as of 2026-11-26 (3 from 10key Survival, 4 from Comrade & the Brave New World, 19 from Quirky Ball).

- `playlist.json` holds the playlist order, the titles and the local MP3 for each video. The "Sync House Duck YouTube" workflow (BGM step once a day, 02:47 UTC, or on a manual run) rewrites order and titles from YouTube and keeps the known MP3 paths. `../studio-music.js` keeps the same list as a fallback.
- A new video without a local file is listed as "YouTube only" (disabled) and the workflow logs a warning. To make it playable, add `assets/music/<name>.mp3` and set that video's `src` in `playlist.json` (and the fallback list in `../studio-music.js`).
- Track-to-video match was checked on 2026-11-26 by duration: each file equals the YouTube video length within 0.3 s.
- Quirky Ball and 10key files keep the owner's original 192 kbps MP3 streams (metadata removed, no re-encode). The Comrade files are 192 kbps MP3 encodes of the game's Ogg BGM (`bgm_coup` parade, `bgm_title` Gleicher Wachturm, `bgm_boss` Siberian tiger, `bgm_field` revolution).

The player loads audio only after a manual Play action. No YouTube video, hidden embed, or audio extraction service is used. The owner retains the source-rights evidence; this technical record is not independent license clearance.
