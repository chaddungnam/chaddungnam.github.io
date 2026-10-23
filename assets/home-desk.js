/* House Duck home hero: the desk at night.
 * Mounts on [data-desk], draws the pixel room (assets/media/home), a live CRT desktop with pop-up
 * windows and the two gameplay videos, and pushes the camera into the screen as the visitor scrolls
 * through .hd-hero. Sets --desk-progress (0..1) and .is-entered on .hd-hero.
 * No libraries. One canvas. Animates only while the hero is on screen. */
(function () {
  'use strict';

  var NIGHT = '#0b0f2a';
  var PAPER = '#efeef2';
  var CRT_BLUE = '#2a4fc4';
  var K = 6;                      // CRT buffer pixels per CRT base pixel
  var LOOP = 22;                  // seconds, one round of the desktop story
  var script = document.currentScript;
  var ASSETS = new URL('media/home/', script ? script.src : location.href).href;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var debug = window.HD_DESK_DEBUG || null;   // desk-test.html only: {t, p}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { v = clamp((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); }

  /* ------------------------------------------------------------------ pixel font 3x5 */
  var FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '010101101101010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010',
    '9': '010101011001110', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010', '-': '000000111000000',
    '/': '001001010100100', ' ': '000000000000000'
  };

  /* bitmaps: one letter per pixel, '.' = transparent */
  var CURSOR = ['B......', 'BB.....', 'BWB....', 'BWWB...', 'BWWWB..', 'BWWWWB.', 'BWWWWWB', 'BWWWBBB', 'BWBWB..', 'BB.BWB.', '...BWB.', '....B..'];
  var ICON_PC = ['GGGGGGGGGG', 'GBBBBBBBBG', 'GBBBBBBBBG', 'GBBBBBBBBG', 'GBBBBBBBBG', 'GGGGGGGGGG', '....GG....', '..GGGGGG..', '..DDDDDD..'];
  var ICON_FOLDER = ['YYYY......', 'YYYYYYYYYY', 'YOOOOOOOOY', 'YOOOOOOOOY', 'YOOOOOOOOY', 'YOOOOOOOOY', 'YYYYYYYYYY'];
  var ICON_DUCK = ['WWWWWWW...', 'W.....WW..', 'W.YYY..W..', 'W.YNY..W..', 'W.YYYO.W..', 'WYYYYY.W..', 'WYYYYY.W..', 'W.YYY..W..', 'W......W..', 'WWWWWWWW..'];
  var ICON_BIN = ['..GGGGGG..', '.GGGGGGGG.', '..G.G.G...', '..G.G.G...', '..G.G.G...', '..G.G.G...', '..GGGGGG..'];
  var ICON_MAIL = ['WWWWWWWWWW', 'WN......NW', 'W.N....N.W', 'W..N..N..W', 'W.N.NN.N.W', 'WN......NW', 'WWWWWWWWWW'];
  var ICON_KEYS = ['CCCCCCCCCC', 'CKKCKKCKKC', 'CCCCCCCCCC', 'CKKCKKCKKC', 'CCCCCCCCCC', 'CKKCKKCGGC', 'CCCCCCCGGC', 'CKKKKKCGGC', 'CCCCCCCCCC'];
  var DUCK_ART = [
    '........XXXXXXX.........',
    '.......X.......X........',
    '......X.........X.......',
    '......X..X......X.......',
    '......X.........XXXX....',
    '......X.........X..X....',
    '.......X........XXX.....',
    '..XXXXXX.......X........',
    '.X............X.........',
    'X..............X........',
    'X...............X.......',
    'X................X......',
    '.X................X.....',
    '..X...............X.....',
    '...X.............X......',
    '....XXXXXXXXXXXXX.......'
  ];
  var PAL = { B: '#2a4fc4', W: '#f4f4f8', G: '#9a9db4', D: '#5a5e78', Y: '#f5b731', O: '#ec6a35', N: '#14162b', C: '#e9e2cf', K: '#9d9684', X: '#f8f8fc' };

  /* ------------------------------------------------------------------ module state */
  var hero, sticky, desk, link, canvas, ctx, buf, bctx, tiny, tctx, tiny2, t2ctx;
  var vidTenkey, vidQuirky;
  var meta = null, baseImg = null, duckImg = null, blinkImg = null, padImg = null, padX = 0, padY = 0;
  var orientation = '';
  var sets = {};                   // orientation -> {meta, base, duck, blink}
  var vw = 0, vh = 0, dpr = 1;
  var running = false, onScreen = false, raf = 0;
  var t0 = performance.now();
  var blinkAt = 0, blinkUntil = 0;
  var lastP = -1, lastLink = '';
  var screenBase = { w: 0, h: 0 };
  var layout = null;

  function orientationFor(w, h) { return w / h < 0.8 ? 'portrait' : 'landscape'; }

  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }

  function loadSet(name) {
    if (sets[name]) return sets[name];
    sets[name] = fetch(ASSETS + 'desk-' + name + '.json').then(function (r) { return r.json(); }).then(function (m) {
      return Promise.all([
        loadImage(ASSETS + 'desk-' + name + '.png'),
        loadImage(ASSETS + m.duck.file),
        m.blink ? loadImage(ASSETS + m.blink.file) : null,
        m.pad ? loadImage(ASSETS + m.pad.file).catch(function () { return null; }) : null
      ]).then(function (imgs) { return { meta: m, base: imgs[0], duck: imgs[1], blink: imgs[2], pad: imgs[3] }; });
    });
    return sets[name];
  }

  function useSet(s) {
    meta = s.meta; baseImg = s.base; duckImg = s.duck; blinkImg = s.blink;
    padImg = s.pad || s.base; padX = s.pad && meta.pad ? meta.pad.x : 0; padY = s.pad && meta.pad ? meta.pad.y : 0;
    var q = meta.screen.quad;
    var qw = (Math.abs(q[1][0] - q[0][0]) + Math.abs(q[2][0] - q[3][0])) / 2;
    var qh = (Math.abs(q[3][1] - q[0][1]) + Math.abs(q[2][1] - q[1][1])) / 2;
    screenBase.w = Math.round(qw * 2); screenBase.h = Math.round(qh * 2);
    buf.width = screenBase.w * K; buf.height = screenBase.h * K;
    layout = makeLayout(screenBase.w, screenBase.h);
  }

  /* ------------------------------------------------------------------ camera */
  function quadCenter(q) { return [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4]; }

  function camera(e) {
    var W = meta.size[0], H = meta.size[1];
    /* landscape ("fit"): the whole scene stays inside the viewport, the padded room fills the rest;
       portrait ("cover"): crop around the focal point */
    var fit = meta.frame === 'fit';
    var s0 = fit ? Math.min(vw / W, vh / H) : Math.max(vw / W, vh / H);
    var cx0 = fit ? W / 2 : clamp(meta.focal.x * W, vw / (2 * s0), W - vw / (2 * s0));
    var cy0 = fit ? H / 2 - 0.03 * vh / s0 : clamp(meta.focal.y * H, vh / (2 * s0), H - vh / (2 * s0));   // fit: a little head room under the fixed header
    var s1 = Math.max(vw / (screenBase.w / 2), vh / (screenBase.h / 2));
    var c1 = quadCenter(meta.screen.quad);
    var s = s0 * Math.pow(s1 / s0, e);
    var X0 = vw / 2 + (c1[0] - cx0) * s0, Y0 = vh / 2 + (c1[1] - cy0) * s0;
    var X = lerp(X0, vw / 2, e), Y = lerp(Y0, vh / 2, e);
    var cx = c1[0] - (X - vw / 2) / s, cy = c1[1] - (Y - vh / 2) / s;
    return { s: s, ox: vw / 2 - cx * s, oy: vh / 2 - cy * s, s1: s1 };
  }

  function screenQuad(cam, e) {
    var q = meta.screen.quad, b = smooth(0.55, 0.95, e);
    var rw = screenBase.w / 2 * cam.s1, rh = screenBase.h / 2 * cam.s1;
    var R = [[vw / 2 - rw / 2, vh / 2 - rh / 2], [vw / 2 + rw / 2, vh / 2 - rh / 2], [vw / 2 + rw / 2, vh / 2 + rh / 2], [vw / 2 - rw / 2, vh / 2 + rh / 2]];
    var out = [];
    for (var i = 0; i < 4; i++) {
      out.push([lerp(cam.ox + q[i][0] * cam.s, R[i][0], b), lerp(cam.oy + q[i][1] * cam.s, R[i][1], b)]);
    }
    return out;
  }

  /* ------------------------------------------------------------------ CRT desktop */
  function makeLayout(bw, bh) {
    var win = [];
    var pad = Math.max(0, Math.floor((bw - 166) / 2));
    win.push({ id: 'duck1', title: 'DUCK.BMP', x: 24 + pad, y: 12, w: 40, h: 34, kind: 'duck', open: 1.4, close: 20.7 });
    win.push({ id: 'duck2', title: 'DUCK.BMP', x: 37 + pad, y: 25, w: 40, h: 34, kind: 'duck', open: 2.4, close: 20.4 });
    win.push({ id: 'duck3', title: 'DUCK.BMP', x: 50 + pad, y: 38, w: 40, h: 34, kind: 'duck', open: 3.4, close: 20.1 });
    win.push({ id: 'tenkey', title: '10KEY.EXE', x: bw - 64, y: 8, w: 58, h: 109, kind: 'tenkey', open: 5.0, close: 21.3 });
    win.push({ id: 'quirky', title: 'QUIRKY.EXE', x: 14, y: Math.min(52, bh - 95), w: 48, h: 93, kind: 'quirky', open: 9.2, close: 19.6 });
    win.push({ id: 'lab', title: 'LAB NOTES', x: Math.floor(bw * 0.34), y: bh - 50, w: 56, h: 40, kind: 'lab', open: 12.6, close: 19.0 });
    win.push({ id: 'mail', title: 'MAIL', x: bw - 76, y: bh - 42, w: 50, h: 28, kind: 'mail', open: 15.0, close: 17.8 });
    var icons = [
      { x: 3, y: 4, art: ICON_PC }, { x: 3, y: 18, art: ICON_FOLDER }, { x: 3, y: 30, art: ICON_DUCK },
      { x: 3, y: 46, art: ICON_KEYS }, { x: 3, y: 60, art: ICON_BIN }
    ];
    var tk = win[3], ml = win[6], lb = win[5];
    var path = [
      [0.0, bw * 0.6, bh * 0.55], [0.6, 9, 36], [1.1, 9, 36], [1.3, 9, 36],
      [4.2, tk.x + 20, tk.y + 30], [4.9, tk.x + 20, tk.y + 30],
      [8.4, 36, 80], [9.1, 36, 80],
      [11.8, lb.x + 28, lb.y + 24], [12.5, lb.x + 28, lb.y + 24],
      [14.8, ml.x + ml.w - 9, ml.y + ml.h - 5], [17.0, ml.x + ml.w - 9, ml.y + ml.h - 5], [17.7, ml.x + ml.w - 9, ml.y + ml.h - 5],
      [18.4, lb.x + lb.w - 4, lb.y + 3], [18.9, lb.x + lb.w - 4, lb.y + 3],
      [19.4, win[4].x + win[4].w - 4, win[4].y + 3], [19.6, win[4].x + win[4].w - 4, win[4].y + 3],
      [20.0, win[2].x + win[2].w - 4, win[2].y + 3], [20.3, win[1].x + win[1].w - 4, win[1].y + 3], [20.6, win[0].x + win[0].w - 4, win[0].y + 3],
      [21.1, tk.x + tk.w - 4, tk.y + 3], [21.3, tk.x + tk.w - 4, tk.y + 3], [22.0, bw * 0.6, bh * 0.55]
    ];
    var clicks = [1.0, 1.2, 4.9, 9.1, 12.5, 17.7, 18.9, 19.6, 20.1, 20.4, 20.7, 21.3];
    return { win: win, icons: icons, path: path, clicks: clicks };
  }

  function px(x, y, w, h, c) { bctx.fillStyle = c; bctx.fillRect(Math.round(x) * K, Math.round(y) * K, Math.round(w) * K, Math.round(h) * K); }

  function bitmap(art, x, y, pal) {
    for (var j = 0; j < art.length; j++) {
      var row = art[j];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch !== '.') px(x + i, y + j, 1, 1, pal[ch] || pal.X || '#fff');
      }
    }
  }

  function text(s, x, y, c) {
    for (var n = 0; n < s.length; n++) {
      var g = FONT[s[n]] || FONT[' '];
      for (var k = 0; k < 15; k++) if (g[k] === '1') px(x + n * 4 + (k % 3), y + Math.floor(k / 3), 1, 1, c);
    }
  }

  function frame3(x, y, w, h, hi, lo) {
    px(x, y, w, 1, hi); px(x, y, 1, h, hi); px(x, y + h - 1, w, 1, lo); px(x + w - 1, y, 1, h, lo);
  }

  function windowChrome(w, active) {
    var x = w.x, y = w.y, ww = w.w, hh = w.h;
    px(x, y, ww, hh, '#c9cbd6');
    px(x - 1, y - 1, ww + 2, hh + 2, '#101a46');
    px(x, y, ww, hh, '#c9cbd6');
    frame3(x, y, ww, hh, '#f2f3f7', '#7d8198');
    px(x + 1, y + 1, ww - 2, 7, active ? '#1f3b9c' : '#6f7490');
    text(w.title, x + 3, y + 2, '#f4f4f8');
    px(x + ww - 7, y + 2, 5, 5, '#d7d8e0');
    px(x + ww - 7, y + 6, 5, 1, '#7d8198'); px(x + ww - 3, y + 2, 1, 5, '#7d8198');
    px(x + ww - 6, y + 3, 1, 1, '#101a46'); px(x + ww - 4, y + 3, 1, 1, '#101a46'); px(x + ww - 5, y + 4, 1, 1, '#101a46');
    px(x + ww - 6, y + 5, 1, 1, '#101a46'); px(x + ww - 4, y + 5, 1, 1, '#101a46');
  }

  function drawVideoInto(video, x, y, w, h, m, fallbackLabel) {
    var ok = video && video.readyState >= 2;
    if (!ok) {
      px(x, y, w, h, '#0e1538');
      text(fallbackLabel, x + Math.floor((w - fallbackLabel.length * 4) / 2), y + Math.floor(h / 2) - 2, '#5a6aa8');
      return;
    }
    var tw = Math.max(1, Math.round(w * m)), th = Math.max(1, Math.round(h * m));
    if (tiny.width !== tw || tiny.height !== th) { tiny.width = tw; tiny.height = th; }
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    var vwid = video.videoWidth || 540, vhei = video.videoHeight || 960;
    var ar = w / h, var2 = vwid / vhei, sx = 0, sy = 0, sw = vwid, sh = vhei;
    if (var2 > ar) { sw = vhei * ar; sx = (vwid - sw) / 2; } else { sh = vwid / ar; sy = (vhei - sh) / 2; }
    tctx.drawImage(video, sx, sy, sw, sh, 0, 0, tw, th);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(tiny, 0, 0, tw, th, x * K, y * K, w * K, h * K);
  }

  function windowBody(w, m) {
    var x = w.x + 1, y = w.y + 9, ww = w.w - 2, hh = w.h - 10;
    if (w.kind === 'duck') {
      px(x, y, ww, hh, '#a9adbf');
      bitmap(DUCK_ART, x + Math.floor((ww - 24) / 2), y + Math.floor((hh - 16) / 2), PAL);
    } else if (w.kind === 'tenkey') {
      drawVideoInto(vidTenkey, x, y, ww, hh, m, '10KEY');
    } else if (w.kind === 'quirky') {
      drawVideoInto(vidQuirky, x, y, ww, hh, m, 'QUIRKY');
    } else if (w.kind === 'lab') {
      px(x, y, ww, hh, '#e6e7ee');
      px(x + 2, y + 2, ww - 4, 20, '#101a46');
      px(x + 4, y + 4, 12, 3, '#2a3a7a'); px(x + 20, y + 6, 24, 2, '#2a3a7a'); px(x + 6, y + 14, 30, 4, '#1b2860');
      var cx = x + Math.floor(ww / 2) - 3, cy = y + 7;
      px(cx, cy, 2, 8, '#e2493b'); px(cx + 2, cy + 1, 2, 6, '#e2493b'); px(cx + 4, cy + 2, 1, 4, '#e2493b'); px(cx + 5, cy + 3, 1, 2, '#e2493b');
      px(x + 3, y + 25, ww - 14, 1, '#7d8198'); px(x + 3, y + 28, ww - 22, 1, '#7d8198');
    } else if (w.kind === 'mail') {
      px(x, y, ww, hh, '#e6e7ee');
      bitmap(ICON_MAIL, x + 3, y + 3, PAL);
      text('NEW MAIL', x + 15, y + 4, '#14162b');
      px(x + ww - 15, y + hh - 8, 12, 6, '#d7d8e0'); frame3(x + ww - 15, y + hh - 8, 12, 6, '#f4f4f8', '#7d8198');
      text('OK', x + ww - 13, y + hh - 7, '#14162b');
    }
  }

  function drawDesktop(t, e, staticFrame) {
    var bw = screenBase.w, bh = screenBase.h;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = CRT_BLUE; bctx.fillRect(0, 0, buf.width, buf.height);
    var ic = layout.icons;
    for (var i = 0; i < ic.length; i++) bitmap(ic[i].art, ic[i].x, ic[i].y, PAL);
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    text(hh + ':' + mm, bw - 22, 3, '#dfe6ff');

    var maxi = smooth(0.35, 0.75, e);           // the 10KEY window grows to full screen while zooming
    var wins = layout.win, top = null;
    for (var n = 0; n < wins.length; n++) {
      var w = wins[n];
      var visible = staticFrame ? (w.id !== 'mail') : (t >= w.open && t < w.close);
      if (w.kind === 'tenkey' && e > 0.3) visible = true;
      w.visible = visible;
      if (visible) top = w;
    }
    for (n = 0; n < wins.length; n++) {
      w = wins[n];
      if (!w.visible || (w.kind === 'tenkey' && maxi > 0)) continue;
      var age = t - w.open;
      if (!staticFrame && age < 0.22 && !(w.kind === 'tenkey' && e > 0.3)) {
        var f = age < 0.11 ? 0.4 : 0.7;
        var gx = Math.round(w.x + w.w * (1 - f) / 2), gy = Math.round(w.y + w.h * (1 - f) / 2);
        px(gx, gy, Math.round(w.w * f), 1, '#e6e7ee'); px(gx, gy + Math.round(w.h * f), Math.round(w.w * f), 1, '#e6e7ee');
        px(gx, gy, 1, Math.round(w.h * f), '#e6e7ee'); px(gx + Math.round(w.w * f), gy, 1, Math.round(w.h * f), '#e6e7ee');
        continue;
      }
      windowChrome(w, w === top);
      windowBody(w, 1);
    }
    var tk = wins[3];
    if (tk.visible && maxi > 0) {
      var mw = { x: Math.round(lerp(tk.x, 0, maxi)), y: Math.round(lerp(tk.y, 0, maxi)), w: Math.round(lerp(tk.w, bw, maxi)), h: Math.round(lerp(tk.h, bh, maxi)), title: tk.title, kind: 'tenkey' };
      var x, y, ww, hh2;
      if (maxi >= 0.999) {
        px(0, 0, bw, 8, '#1f3b9c'); text(tk.title, 2, 2, '#f4f4f8');
        x = 0; y = 8; ww = bw; hh2 = bh - 8;
      } else {
        windowChrome(mw, true);
        x = mw.x + 1; y = mw.y + 9; ww = mw.w - 2; hh2 = mw.h - 10;
      }
      px(x, y, ww, hh2, '#0e1538');
      var vwid = Math.round(hh2 * 9 / 16), vx = x + Math.floor((ww - vwid) / 2);
      var detail = lerp(1, K, smooth(0.45, 0.95, e));
      drawVideoInto(vidTenkey, vx, y, vwid, hh2, detail, '10KEY');
    }
    if (!staticFrame && maxi < 0.2) {
      var c = cursorAt(t);
      bitmap(CURSOR, c[0], c[1], { B: '#101a46', W: '#f8f8fc' });
    }
    /* CRT: soft edge, scanlines */
    bctx.fillStyle = 'rgba(0,0,0,0.16)';
    bctx.fillRect(0, 0, buf.width, 2 * K); bctx.fillRect(0, buf.height - 2 * K, buf.width, 2 * K);
    bctx.fillRect(0, 0, 2 * K, buf.height); bctx.fillRect(buf.width - 2 * K, 0, 2 * K, buf.height);
    if (!reduceMotion.matches) {
      bctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (var yy = K - 1; yy < buf.height; yy += K) bctx.fillRect(0, yy, buf.width, 1);
      bctx.fillStyle = 'rgba(0,0,0,' + (0.015 + 0.02 * Math.abs(Math.sin(performance.now() / 90))).toFixed(3) + ')';
      bctx.fillRect(0, 0, buf.width, buf.height);
    }
  }

  function cursorAt(t) {
    var path = layout.path, a = path[0], b = path[path.length - 1];
    for (var i = 0; i < path.length - 1; i++) {
      if (t >= path[i][0] && t < path[i + 1][0]) { a = path[i]; b = path[i + 1]; break; }
    }
    var u = b[0] === a[0] ? 1 : smooth(a[0], b[0], t);
    var x = Math.round(lerp(a[1], b[1], u)), y = Math.round(lerp(a[2], b[2], u));
    var cl = layout.clicks;
    for (i = 0; i < cl.length; i++) if (t >= cl[i] && t < cl[i] + 0.09) y += 1;
    return [x, y];
  }

  /* ------------------------------------------------------------------ main frame */
  function progress() {
    if (debug && debug.p != null) return clamp(+debug.p, 0, 1);
    if (reduceMotion.matches) return 0;
    var r = hero.getBoundingClientRect();
    var total = r.height - vh;
    if (total <= 1) return 0;
    return clamp(-r.top / total, 0, 1);
  }

  function drawStrips(q) {
    var bw = screenBase.w, bh = screenBase.h;
    var tl = q[0], tr = q[1], br = q[2], bl = q[3];
    ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < bw; i++) {
      var u0 = i / bw, u1 = (i + 1) / bw;
      var ax = lerp(tl[0], tr[0], u0), ay = lerp(tl[1], tr[1], u0);
      var bx = lerp(tl[0], tr[0], u1), by = lerp(tl[1], tr[1], u1);
      var cx = lerp(bl[0], br[0], u0), cy = lerp(bl[1], br[1], u0);
      var ux = bx - ax, uy = by - ay, vx = cx - ax, vy = cy - ay;
      var ul = Math.sqrt(ux * ux + uy * uy) || 1, vl = Math.sqrt(vx * vx + vy * vy) || 1;
      var gu = (ul + 0.75) / ul, gv = (vl + 0.75) / vl;      // slight overlap hides seams
      ctx.setTransform(dpr * ux * gu, dpr * uy * gu, dpr * vx * gv, dpr * vy * gv, dpr * ax, dpr * ay);
      ctx.drawImage(buf, i * K, 0, K, bh * K, 0, 0, 1, 1);
    }
  }

  function draw(now) {
    var t = debug && debug.t != null ? +debug.t : ((now - t0) / 1000) % LOOP;
    var p = progress();
    var e = smooth(0.06, 0.84, p);
    var staticFrame = reduceMotion.matches;
    if (staticFrame) t = 16;
    var cam = camera(e);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var px0 = cam.ox - padX * cam.s, py0 = cam.oy - padY * cam.s;
    var covered = px0 <= 0.5 && py0 <= 0.5 && px0 + padImg.width * cam.s >= vw - 0.5 && py0 + padImg.height * cam.s >= vh - 0.5;
    if (!covered) { ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, vw, vh); }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * cam.ox, dpr * cam.oy);
    ctx.drawImage(padImg, -padX, -padY);

    var q = screenQuad(cam, e);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = meta.screen.fill;
    ctx.beginPath();
    var qc = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
    for (var i = 0; i < 4; i++) {
      var gx = q[i][0] + Math.sign(q[i][0] - qc[0]) * 1.5, gy = q[i][1] + Math.sign(q[i][1] - qc[1]) * 1.5;
      if (i === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
    }
    ctx.closePath(); ctx.fill();

    drawDesktop(t, e, staticFrame);
    drawStrips(q);

    /* duck: breath lift + blink */
    var lift = staticFrame ? 0 : (0.5 - 0.5 * Math.cos(now / 4200 * Math.PI * 2)) * 1.0;
    ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * cam.ox, dpr * (cam.oy - lift * cam.s));
    ctx.drawImage(duckImg, meta.duck.x, meta.duck.y);
    if (!staticFrame && blinkImg) {
      if (now > blinkAt) { blinkUntil = now + 130; blinkAt = now + 2600 + Math.random() * 3600 + (Math.random() < 0.2 ? -2300 : 0); }
      if (now < blinkUntil || (debug && debug.blink)) ctx.drawImage(blinkImg, meta.blink.x, meta.blink.y);
    }

    /* LEDs */
    ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * cam.ox, dpr * cam.oy);
    var leds = meta.leds || [];
    for (i = 0; i < leds.length; i++) {
      var L = leds[i];
      if (!L.blink || staticFrame) continue;
      var on = Math.sin(now / 1000 * 9.7) + Math.sin(now / 1000 * 5.3) > 0.35;
      ctx.fillStyle = on ? L.color : '#3a1c24';
      ctx.fillRect(L.x, L.y, L.w, L.h);
    }

    /* hand-over to the paper page */
    var fade = smooth(0.84, 1, p);  // the 10key section rises over this fade (see .hd-tenkey margin in home.css)
    if (fade > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = fade; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
    }

    /* link over the screen, progress variable, entered flag */
    var lx = Math.max(0, Math.min(q[0][0], q[3][0])), ly = Math.max(0, Math.min(q[0][1], q[1][1]));
    var rx = Math.min(vw, Math.max(q[1][0], q[2][0])), ry = Math.min(vh, Math.max(q[2][1], q[3][1]));
    var ls = Math.round(lx) + ',' + Math.round(ly) + ',' + Math.round(rx - lx) + ',' + Math.round(ry - ly);
    if (ls !== lastLink) {
      lastLink = ls;
      link.style.left = lx + 'px'; link.style.top = ly + 'px'; link.style.width = (rx - lx) + 'px'; link.style.height = (ry - ly) + 'px';
    }
    if (Math.abs(p - lastP) > 0.0005) {
      lastP = p;
      hero.style.setProperty('--desk-progress', p.toFixed(3));
      hero.classList.toggle('is-entered', p >= 0.98);
      hero.classList.toggle('is-zooming', p > 0.06);
    }
    syncVideos(e);
  }

  function syncVideos(e) {
    var tk = layout.win[3], qk = layout.win[4];
    var play = onScreen && running && !reduceMotion.matches && !document.hidden;
    toggleVideo(vidTenkey, play && (tk.visible || e > 0.3));
    toggleVideo(vidQuirky, play && qk.visible && e < 0.5);
  }

  function toggleVideo(v, want) {
    if (!v) return;
    if (want) {
      if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    } else if (!v.paused) v.pause();
  }

  function loop(now) {
    raf = 0;
    if (!running || !meta) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!running) { running = true; if (!raf && meta) raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } syncVideosSafe(); }
  function syncVideosSafe() { if (layout) syncVideos(0); }

  function resize() {
    var r = sticky.getBoundingClientRect();
    vw = Math.round(r.width) || window.innerWidth;
    vh = Math.round(r.height) || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    var o = orientationFor(vw, vh);
    if (o !== orientation) {
      orientation = o;
      loadSet(o).then(function (s) {
        if (orientation !== o) return;
        useSet(s);
        lastLink = ''; lastP = -1;
        if (running && !raf) raf = requestAnimationFrame(loop);
        else if (!running) draw(performance.now());
      }).catch(function (err) { if (window.console) console.error('home-desk: ' + err); });
    } else if (meta) {
      lastLink = '';
      if (!running) draw(performance.now());
    }
  }

  function makeVideo(src, preload) {
    if (!src) return null;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = preload; v.src = src; v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    return v;
  }

  function mount(el) {
    desk = el;
    hero = desk.closest('.hd-hero') || desk.parentElement;
    sticky = desk.closest('.hd-hero-sticky') || hero;
    link = desk.querySelector('.hd-desk-screen-link');
    if (!link) { link = document.createElement('a'); link.className = 'hd-desk-screen-link'; link.href = '#games'; desk.appendChild(link); }
    canvas = document.createElement('canvas');
    canvas.className = 'hd-desk-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    desk.insertBefore(canvas, desk.firstChild);
    ctx = canvas.getContext('2d', { alpha: false });
    buf = document.createElement('canvas'); bctx = buf.getContext('2d', { alpha: false });
    tiny = document.createElement('canvas'); tctx = tiny.getContext('2d', { alpha: false });
    vidTenkey = makeVideo(desk.getAttribute('data-desk-tenkey'), 'auto');
    vidQuirky = makeVideo(desk.getAttribute('data-desk-quirky'), 'none');
    if (vidTenkey) desk.appendChild(vidTenkey);
    if (vidQuirky) desk.appendChild(vidQuirky);
    if (vidQuirky) setTimeout(function () { vidQuirky.preload = 'auto'; vidQuirky.load(); }, 2500);

    var io = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen && !document.hidden) start(); else stop();
    }, { threshold: 0 });
    io.observe(hero);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (onScreen) start(); });
    window.addEventListener('resize', resize);
    reduceMotion.addEventListener && reduceMotion.addEventListener('change', function () { lastP = -1; resize(); });
    resize();
    loadSet(orientationFor(vw, vh) === 'portrait' ? 'landscape' : 'portrait').catch(function () {});
  }

  window.HouseDuckDesk = {
    mount: mount,
    get progress() { return lastP; },
    get orientation() { return orientation; },
    redraw: function () { if (meta) draw(performance.now()); }
  };

  function boot() {
    var el = document.querySelector('[data-desk]');
    if (el && !el.hasAttribute('data-desk-mounted')) { el.setAttribute('data-desk-mounted', ''); mount(el); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
