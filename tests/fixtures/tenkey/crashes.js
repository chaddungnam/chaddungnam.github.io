// Local synthetic data only: the 크래시 page's actions (tenkey-admin crashes.list / crashes.groups / crashes.get), joined after
// tests/fixtures/console_tenkey_api.js by tests/fixtures/tenkey_console.cjs.
(function () {
  const crashes = [
    { id: 41, received_at: "2026-10-23T10:12:00+00:00", last_at: "2026-10-23T12:40:00+00:00", repeats: 3, kind: "unclean_exit", platform: "Android", app_version: "1.0.0 a2 i2", os_version: "14", device_model: "SM-S918N", locale: "ko_KR", message: "handle_crash: Program crashed with signal 11", has_log: true, install_short: "9f31a0c2" },
    { id: 40, received_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", repeats: 0, kind: "script_error", platform: "iOS", app_version: "1.0.0 a2 i2", os_version: "17.6", device_model: "iPhone14,5", locale: "en_US", message: "res://scripts/dig/dig_run.gd:212", has_log: false, install_short: null },
    { id: 39, received_at: "2026-10-22T19:30:00+00:00", last_at: "2026-10-22T19:30:00+00:00", repeats: 0, kind: "anr_suspect", platform: "Android", app_version: "1.0.0 a1 i1", os_version: "13", device_model: "Pixel 6a", locale: "ko_KR", message: "anr_suspect", has_log: false, install_short: null },
  ];
  const groups = (by) => ({
    ok: true, by, days: 7,
    rows: by === "kind"
      ? [{ key: "unclean_exit", rows: 3, times: 6, installs: 2, devices: 2, versions: 2, first_at: "2026-10-21T10:00:00+00:00", last_at: "2026-10-23T12:40:00+00:00", sample_id: 41, kinds: ["unclean_exit"], platforms: ["Android"], said: null }, { key: "script_error", rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", sample_id: 40, kinds: ["script_error"], platforms: ["iOS"], said: "Invalid get index 'x'" }]
      : [{ key: crashes[0].message, rows: 3, times: 6, installs: 2, devices: 2, versions: 2, first_at: "2026-10-21T10:00:00+00:00", last_at: "2026-10-23T12:40:00+00:00", sample_id: 41, kinds: ["unclean_exit"], platforms: ["Android"], said: null },
        { key: crashes[1].message, rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-23T08:01:00+00:00", last_at: "2026-10-23T08:01:00+00:00", sample_id: 40, kinds: ["script_error"], platforms: ["iOS"], said: "Invalid get index 'x' (on base: 'Dictionary')." },
        { key: "anr_suspect", rows: 1, times: 1, installs: 0, devices: 1, versions: 1, first_at: "2026-10-22T19:30:00+00:00", last_at: "2026-10-22T19:30:00+00:00", sample_id: 39, kinds: ["anr_suspect"], platforms: ["Android"], said: null }],
  });
  const crashDetail = (id) => {
    const c = crashes.find((x) => x.id === id) || crashes[0];
    return { ok: true, crash: { ...c, build: 2, signature: "9a0b3f", enriched_at: c.has_log ? "2026-10-23T10:12:06+00:00" : null, same_signature_rows: 3,
      detail: { uptime_s: 412, trail: ["start Android 1.0.0 a2 i2", "scene BootScene", "scene TitleScene", "scene DigScene", "bg", "fg"] },
      log_tail: c.has_log ? "Godot Engine v4.7.2.stable.official\nOpenGL API OpenGL ES 3.2\n...\nERROR: Condition \"!is_inside_tree()\" is true.\n   at: get_global_transform (scene/3d/node_3d.cpp:412)\n================================================================\nhandle_crash: Program crashed with signal 11\nEngine version: Godot Engine v4.7.2.stable.official\nDumping the backtrace. Please include this when reporting the bug to the project developer.\n[1] 0x1a2b3c4d" : "" } };
  };

  Object.assign(window.__tkPages = window.__tkPages || {}, {
    "crashes.list": (p) => ({ ok: true, total: crashes.length, rows: crashes.filter((c) => (!p.kind || c.kind === p.kind) && (!p.query || c.message.includes(p.query) || c.device_model.includes(p.query) || c.app_version.includes(p.query))) }),
    "crashes.groups": (p) => groups(p.by),
    "crashes.get": (p) => crashDetail(p.id),
  });
})();
