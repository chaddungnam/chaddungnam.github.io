(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.HouseDuckStudioMusic = api;
    if (root.document) root.addEventListener("DOMContentLoaded", api.init);
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
  const PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLK7jSNsuc6Po";
  // Order and titles follow the YouTube BGM playlist. The sync workflow rewrites assets/music/playlist.json
  // (scripts/music-playlist-sync.mjs); this built-in copy is only the fallback when that file cannot be read.
  const PLAYLIST_JSON = "assets/music/playlist.json";
  const TRACKS = [
    ["Yir1vAvPL94", "tenkey_terminal_pursuit", "ターミナル追撃戦(Terminal Pursuit)"],
    ["rwdTvKur46Y", "tenkey_iron_throttle", "めちゃくちゃロボット変身(메차쿠차 로봇 변신)"],
    ["QpojkdI1RNs", "tenkey_against_the_horizon", "地平線を背景に (Against the Horizon)"],
    ["6zm2Ah72x8o", "comrade_parade", "北朝鮮の閲兵式 (Kitachōsen no eppei-shiki)"],
    ["BlSWw3Fec3s", "comrade_watchtower", "Gleicher Wachturm"],
    ["mqZZNvWXhqw", "comrade_siberian_tiger", "シベリアトラと踊る (Shiberiatora to odoru)"],
    ["sGZ5lLg5UUM", "comrade_revolution", "Überwachungsgesellschaft und Revolution (감시사회와 혁명)"],
    ["0s8-0N1a75I", "vip", "Kaufkraft"], ["xLfQ8m6amYU", "mad_0", "マッドサイエンティスト(매드사이언티스트)"],
    ["vwTX66gry2s", "mad_1", "Anger Gene"], ["sIoxKL3onP0", "tutorial_mad_2", "Drift"],
    ["yirCYEZ5G80", "renegade_1", "重力崩壊 (중력붕괴)"], ["5lt4Qe3KZyU", "renegade_2", "고전역학"],
    ["5KyfmlEY_nU", "renegade_3", "뒤틀린 신세계"], ["r-In247veiY", "boss_1", "부활"], ["DPqeKB3IcK8", "boss_2", "위기"],
    ["ldrDWPhk_YM", "boss_3", "차원이동"], ["nP5AVkOdm4c", "anime_ingame_1", "Poison Mushroom"],
    ["vYVu_nhBIwE", "anime_ingame_2", "Quirky Ball"], ["mAixud33jik", "ingame_1", "Escape"],
    ["0cGXOaNRs44", "ingame_2", "Luxusholzsteinberg"], ["7VCaw1GpAtI", "ingame_3", "Schönwald"],
    ["B077dWnlK88", "shop", "研究(Kenkyū)"], ["ZRsUE60CeSY", "outgame_sub", "Heimat"],
    ["QePNVYaXndE", "home_1", "안녕하세요"], ["EI1ifsMSFI4", "home_2", "遊び場(Asobiba)"],
  ].map(([videoId, role, title]) => ({ videoId, role, title, src: `assets/music/${role}.mp3` }));

  function normalizePlaylist(payload) {
    if (!payload || !Array.isArray(payload.tracks)) return null;
    const playable = [];
    const youtubeOnly = [];
    for (const item of payload.tracks) {
      if (!item || !/^[A-Za-z0-9_-]{11}$/.test(item.videoId || "") || !item.title) continue;
      const src = typeof item.src === "string" && /^assets\/music\/[a-z0-9_-]+\.mp3$/.test(item.src) ? item.src : null;
      const track = { videoId: item.videoId, role: src ? src.slice(13, -4) : "", title: String(item.title), src };
      (src ? playable : youtubeOnly).push(track);
    }
    return playable.length ? { playable, youtubeOnly } : null;
  }
  const COPY = {
    ko: { toggle: "음악", title: "SOUND LAB", close: "닫기", play: "재생", pause: "일시정지", stop: "정지", previous: "이전", next: "다음", loop: "플레이리스트 반복", shuffle: "셔플", volume: "볼륨", ready: "재생 버튼을 누르면 BGM이 시작됩니다.", loading: "BGM을 준비하는 중…", playing: "재생 중", paused: "일시정지됨", stopped: "정지됨", error: "이 트랙을 재생하지 못했습니다.", retry: "다시 시도", playlist: "원본 플레이리스트 열기", data: "사이트에 포함된 House Duck BGM입니다.", track: "트랙 선택", youtubeOnly: "YouTube에서만" },
    en: { toggle: "Music", title: "SOUND LAB", close: "Close", play: "Play", pause: "Pause", stop: "Stop", previous: "Previous", next: "Next", loop: "Loop playlist", shuffle: "Shuffle", volume: "Volume", ready: "Press Play to start the BGM.", loading: "Preparing the BGM…", playing: "Playing", paused: "Paused", stopped: "Stopped", error: "This track could not be played.", retry: "Retry", playlist: "Open original playlist", data: "House Duck BGM included on this site.", track: "Track", youtubeOnly: "YouTube only" },
    de: { toggle: "Musik", title: "SOUND LAB", close: "Schließen", play: "Wiedergabe", pause: "Pause", stop: "Stopp", previous: "Zurück", next: "Weiter", loop: "Playlist wiederholen", shuffle: "Zufall", volume: "Lautstärke", ready: "Drücken Sie Wiedergabe, um die BGM zu starten.", loading: "BGM wird vorbereitet…", playing: "Wiedergabe läuft", paused: "Pausiert", stopped: "Gestoppt", error: "Dieser Titel konnte nicht abgespielt werden.", retry: "Erneut versuchen", playlist: "Original-Playlist öffnen", data: "House Duck BGM auf dieser Website.", track: "Titel", youtubeOnly: "nur auf YouTube" },
    ja: { toggle: "音楽", title: "SOUND LAB", close: "閉じる", play: "再生", pause: "一時停止", stop: "停止", previous: "前へ", next: "次へ", loop: "プレイリストをリピート", shuffle: "シャッフル", volume: "音量", ready: "再生を押すとBGMが始まります。", loading: "BGMを準備中…", playing: "再生中", paused: "一時停止中", stopped: "停止しました", error: "この曲を再生できませんでした。", retry: "再試行", playlist: "元のプレイリストを開く", data: "このサイトに含まれるHouse Duck BGMです。", track: "トラック", youtubeOnly: "YouTubeのみ" },
  };
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="play"><path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="pause"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true" data-icon="stop"><path d="M6 6h12v12H6z" fill="currentColor"/></svg>',
  };

  function localeFor(document) {
    const lang = String(document?.documentElement?.lang || "en").slice(0, 2).toLowerCase();
    return COPY[lang] ? lang : "en";
  }

  function init() {
    if (typeof document === "undefined" || typeof matchMedia !== "function") return;
    const query = matchMedia(DESKTOP_QUERY);
    let mounted;
    const mount = () => { if (!mounted && query.matches) mounted = createWidget(document, window); };
    const unmount = () => { mounted?.destroy(); mounted = undefined; };
    const sync = () => query.matches ? mount() : unmount();
    if (query.addEventListener) query.addEventListener("change", sync);
    else query.addListener?.(sync);
    sync();
    return () => {
      if (query.removeEventListener) query.removeEventListener("change", sync);
      else query.removeListener?.(sync);
      unmount();
    };
  }

  function createWidget(document, window) {
    const text = COPY[localeFor(document)];
    const root = document.createElement("aside");
    root.className = "studio-music";
    root.dataset.studioMusic = "";
    root.dataset.playback = "stopped";
    const launcher = document.createElement("div");
    launcher.className = "studio-music-launcher";
    const launcherPlay = document.createElement("button");
    launcherPlay.type = "button";
    launcherPlay.className = "studio-music-launcher-play";
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "studio-music-expand studio-music-toggle";
    expand.setAttribute("aria-expanded", "false");
    expand.setAttribute("aria-controls", "studio-music-panel");
    expand.innerHTML = `<span class="studio-music-eq" aria-hidden="true"><i></i><i></i><i></i></span><span>SOUND LAB</span><span>${text.toggle}</span>`;
    launcher.append(launcherPlay, expand);

    const panel = document.createElement("section");
    panel.className = "studio-music-panel";
    panel.id = "studio-music-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", text.title);
    const heading = document.createElement("div");
    heading.className = "studio-music-heading";
    const title = document.createElement("strong");
    title.textContent = text.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "studio-music-close";
    close.innerHTML = "×";
    close.title = text.close;
    close.setAttribute("aria-label", text.close);
    heading.append(title, close);
    const status = document.createElement("p");
    status.className = "studio-music-status";
    status.id = "studio-music-status";
    status.setAttribute("role", "status");
    status.textContent = text.ready;
    expand.setAttribute("aria-describedby", status.id);
    const track = document.createElement("p");
    track.className = "studio-music-track";
    const trackLabel = document.createElement("label");
    trackLabel.className = "studio-music-track-label";
    trackLabel.textContent = text.track;
    const trackSelect = document.createElement("select");
    trackSelect.className = "studio-music-track-select";
    trackSelect.setAttribute("aria-label", text.track);
    let tracks = TRACKS.slice();
    function renderOptions(youtubeOnly = []) {
      const nodes = tracks.map((item, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = item.title;
        return option;
      });
      for (const item of youtubeOnly) {
        const option = document.createElement("option");
        option.value = "";
        option.disabled = true;
        option.textContent = `${item.title} (${text.youtubeOnly})`;
        nodes.push(option);
      }
      trackSelect.replaceChildren(...nodes);
    }
    renderOptions();
    trackLabel.append(trackSelect);
    track.append(trackLabel);
    const controls = document.createElement("div");
    controls.className = "studio-music-controls";
    const makeButton = (label, className, icon, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `studio-music-control ${className}`;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = `${icon}<span>${label}</span>`;
      button.addEventListener("click", action);
      controls.append(button);
      return button;
    };
    const previous = makeButton(text.previous, "studio-music-previous", "", () => move(-1));
    const panelPlay = makeButton(text.play, "studio-music-panel-play", ICON.play, () => togglePlayback());
    const stop = makeButton(text.stop, "studio-music-stop", ICON.stop, () => stopPlayback());
    const next = makeButton(text.next, "studio-music-next", "", () => move(1));
    const options = document.createElement("div");
    options.className = "studio-music-options";
    const makeSwitch = (label, className) => {
      const wrapper = document.createElement("label");
      wrapper.className = "studio-music-switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = className;
      wrapper.append(input, document.createTextNode(label));
      options.append(wrapper);
      return input;
    };
    const loopInput = makeSwitch(text.loop, "studio-music-loop");
    const shuffleInput = makeSwitch(text.shuffle, "studio-music-shuffle");
    const volumeLabel = document.createElement("label");
    volumeLabel.className = "studio-music-volume-label";
    volumeLabel.textContent = text.volume;
    const volume = document.createElement("input");
    volume.type = "range";
    volume.className = "studio-music-volume";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.01";
    volume.value = "0.5";
    volume.setAttribute("aria-label", text.volume);
    volumeLabel.append(volume);
    options.append(volumeLabel);
    const retry = makeButton(text.retry, "studio-music-retry", "", () => playTrack(currentIndex, true));
    retry.hidden = true;
    const playlistLink = document.createElement("a");
    playlistLink.className = "studio-music-playlist-link";
    playlistLink.href = PLAYLIST_URL;
    playlistLink.target = "_blank";
    playlistLink.rel = "noopener noreferrer";
    playlistLink.textContent = text.playlist;
    panel.append(heading, status, track, controls, options, retry, playlistLink);
    root.append(panel, launcher);
    document.body.append(root);

    let audio = document.createElement("audio");
    audio.className = "studio-music-audio";
    audio.preload = "none";
    audio.controls = false;
    audio.setAttribute("aria-hidden", "true");
    audio.tabIndex = -1;
    root.append(audio);
    let state = "stopped";
    let currentIndex = 0;
    let loop = false;
    let shuffle = false;
    let shuffleOrder = [];
    let shufflePosition = -1;
    let generation = 0;
    let audioListenersAttached = false;

    function setButton(button, label, icon) {
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = `${icon}<span>${label}</span>`;
    }

    function setState(nextState) {
      state = nextState;
      const playing = nextState === "playing" || nextState === "loading";
      const launcherLabel = playing ? text.stop : text.play;
      setButton(launcherPlay, launcherLabel, playing ? ICON.stop : ICON.play);
      setButton(panelPlay, nextState === "playing" ? text.pause : text.play, nextState === "playing" ? ICON.pause : ICON.play);
      root.dataset.playback = nextState;
      status.textContent = nextState === "loading" ? text.loading : nextState === "playing" ? text.playing : nextState === "paused" ? text.paused : nextState === "error" ? text.error : nextState === "stopped" ? text.stopped : text.ready;
      retry.hidden = nextState !== "error";
    }

    function updateTrack() {
      trackSelect.value = String(currentIndex);
    }

    function clearShuffle() {
      shuffleOrder = [];
      shufflePosition = -1;
    }

    function shuffledFrom(start) {
      const remaining = tracks.map((_item, index) => index).filter((index) => index !== start);
      for (let index = remaining.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[swap]] = [remaining[swap], remaining[index]];
      }
      return [...remaining, start];
    }

    function ensureAudio() {
      if (!audio) {
        audio = document.createElement("audio");
        audio.preload = "none";
      }
      audio.volume = Number(volume.value);
      if (!audioListenersAttached) {
        audio.addEventListener("play", onPlay);
        audio.addEventListener("playing", onPlaying);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onError);
        audioListenersAttached = true;
      }
      return audio;
    }

    function playTrack(index = currentIndex, reset = true) {
      currentIndex = Math.max(0, Math.min(tracks.length - 1, index));
      updateTrack();
      const node = ensureAudio();
      const token = ++generation;
      const selectedSource = tracks[currentIndex].src;
      const currentSource = node.getAttribute?.("src") || "";
      if (state === "error" || currentSource !== selectedSource) {
        node.setAttribute?.("src", selectedSource);
      }
      if (reset) node.currentTime = 0;
      node.volume = Number(volume.value);
      setState("loading");
      let result;
      try { result = node.play(); } catch (_error) { if (token === generation) setState("error"); return; }
      if (result?.catch) result.catch(() => { if (token === generation && audio === node) setState("error"); });
    }

    function pausePlayback() {
      if (!audio) return;
      generation += 1;
      audio.pause();
      setState("paused");
    }

    function stopPlayback() {
      if (!audio) { setState("stopped"); return; }
      generation += 1;
      audio.pause();
      audio.currentTime = 0;
      setState("stopped");
    }

    function togglePlayback() {
      if (state === "playing" || state === "loading") pausePlayback();
      else playTrack(currentIndex, state !== "paused");
    }

    function nextIndex(direction) {
      if (shuffle) {
        if (!shuffleOrder.length) {
          shuffleOrder = shuffledFrom(currentIndex);
          shuffleOrder.unshift(shuffleOrder.pop());
          shufflePosition = 0;
        }
        const nextPosition = shufflePosition + direction;
        if (nextPosition >= 0 && nextPosition < shuffleOrder.length) { shufflePosition = nextPosition; return shuffleOrder[shufflePosition]; }
        if (direction > 0 && loop) {
          shuffleOrder = shuffledFrom(currentIndex);
          shufflePosition = 0;
          return shuffleOrder[shufflePosition];
        }
        return null;
      }
      const candidate = currentIndex + direction;
      if (candidate >= 0 && candidate < tracks.length) return candidate;
      if (loop) return direction > 0 ? 0 : tracks.length - 1;
      return null;
    }

    function move(direction) {
      const candidate = nextIndex(direction);
      if (candidate == null) { stopPlayback(); return; }
      const shouldPlay = state === "playing" || state === "loading";
      currentIndex = candidate;
      if (!shuffle) clearShuffle();
      updateTrack();
      if (shouldPlay) playTrack(currentIndex, true);
    }

    function onPlay() { if (state === "loading") setState("playing"); }
    function onPlaying() { if (state === "loading" || state === "paused") setState("playing"); }
    function onPause() {
      if (!audio?.paused || audio.ended) return;
      if (state === "playing" || state === "loading") setState("paused");
    }
    function onEnded() {
      if (state !== "playing") return;
      const candidate = nextIndex(1);
      if (candidate == null) { stopPlayback(); return; }
      currentIndex = candidate;
      updateTrack();
      playTrack(currentIndex, true);
    }
    function onError() {
      if (state !== "playing" && state !== "loading") return;
      setState("error");
    }

    function expandPanel() { panel.hidden = false; expand.setAttribute("aria-expanded", "true"); }
    function collapsePanel() { panel.hidden = true; expand.setAttribute("aria-expanded", "false"); expand.focus(); }
    function onPlayable(event) { if (event.detail?.active && (state === "playing" || state === "loading")) pausePlayback(); }
    function destroy() {
      generation += 1;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("playing", onPlaying);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        audio.removeAttribute?.("src");
        audio.load?.();
        audioListenersAttached = false;
        audio = undefined;
      }
      expand.removeEventListener("click", expandPanel);
      close.removeEventListener("click", collapsePanel);
      window.removeEventListener("houseduck:playable", onPlayable);
      root.remove();
    }

    launcherPlay.addEventListener("click", () => state === "playing" || state === "loading" ? stopPlayback() : playTrack(currentIndex, state !== "paused"));
    expand.addEventListener("click", () => panel.hidden ? expandPanel() : collapsePanel());
    close.addEventListener("click", collapsePanel);
    root.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) collapsePanel(); });
    trackSelect.addEventListener("change", () => {
      currentIndex = Number(trackSelect.value) || 0;
      clearShuffle();
      updateTrack();
      if (state === "playing" || state === "loading") playTrack(currentIndex, true);
    });
    loopInput.addEventListener("change", () => { loop = loopInput.checked; });
    shuffleInput.addEventListener("change", () => { shuffle = shuffleInput.checked; clearShuffle(); });
    volume.addEventListener("input", () => { if (audio) audio.volume = Number(volume.value); });
    window.addEventListener("houseduck:playable", onPlayable);
    updateTrack();
    setState("stopped");
    status.textContent = text.ready;

    function applyPlaylist(payload) {
      const list = normalizePlaylist(payload);
      if (!list || !root.isConnected && root.isConnected !== undefined) return false;
      const currentId = tracks[currentIndex]?.videoId;
      tracks = list.playable;
      const kept = tracks.findIndex((item) => item.videoId === currentId);
      currentIndex = kept >= 0 ? kept : 0;
      clearShuffle();
      renderOptions(list.youtubeOnly);
      updateTrack();
      return true;
    }
    const ready = typeof window.fetch === "function"
      ? Promise.resolve()
        .then(() => window.fetch(PLAYLIST_JSON, { cache: "no-cache", credentials: "same-origin" }))
        .then((response) => (response && response.ok ? response.json() : null))
        .then((payload) => applyPlaylist(payload))
        .catch(() => false)
      : Promise.resolve(false);
    return { destroy, ready, applyPlaylist, tracks: () => tracks.slice() };
  }

  return { DESKTOP_QUERY, PLAYLIST_URL, PLAYLIST_JSON, TRACKS, normalizePlaylist, createWidget, init };
});
