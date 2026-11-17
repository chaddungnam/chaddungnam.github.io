// 10key Survival: 밸런스. Every finished run's short anonymous record (tenkey.run_stats_v1, owner 2026-10-25) and its timeline
// (run_trace_v1), read through tenkey-console-stats "balance.v4" (owner 2026-11-17: "클라이언트에 밸런스 기록, 어느 숫자를 바꿔야 하는지
// 보이게"); a server without it answers unknown_action and tenkey-admin "balance.get" (admin_balance_v3) is read as before: where and
// why runs end, how far DRIFT and the robot go, which level-up cards are taken and when, the mobs met, per day / build / knob
// version, and from v4 the account-growth bands, level bands, offered vs picked cards, idle time and the run counters, with a
// "여기 보기" mark where the reading guide (docs/server/tenkey_server.md 25) says to look. The device filter starts on 앱 (TK-482:
// the web demo ends at Lv 8, so its runs never steer the main curve; they are listed apart). Keyed by a random install id.
// Below it the four server balance values (tenkey-admin config.get "balance" / knobs.set): store apps take them at launch
// and use them from the next run; each save is a new version the runs above are split by.
(function attachConsoleTenkeyBalance(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, duration, pct, time } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, q: { days: 7, build: "", mode: "", platform: "app" } };
  const KNOBS = ["xp_scale", "mouse_pace", "battery_drain_scale", "robot_power_scale"];
  const KNOB_NAMES = { xp_scale: "경험치 배율", mouse_pace: "마우스 속도", battery_drain_scale: "배터리 소모 배율", robot_power_scale: "로봇 공격력" };

  // The game's own Korean words (scripts/i18n: shell.result.cause.*, dig.sk.*, dig.dperk.*, dig.rsk.*, shop.tf.*).
  const CAUSES = { battery: "배터리 방전", mouse: "마우스 포획", durability: "텐키 파손", spacebar: "스페이스바에 깔림", wheel_mouse: "휠 마우스에 치임", clear: "노멀 모드 완주", quit: "스스로 그만둠", demo_end: "체험판 끝", app_closed: "앱을 닫음" };
  // owner 2026-11-12: "드리프트가 된적이있는데 기록되지 않았고": the web demo's runs are counted too now, and every row says where it was played.
  const PLATFORMS = { android: "Android", ios: "iOS", web_itch: "웹 체험판 (itch)", web_gamepix: "웹 (GamePix)", windows: "PC (Windows)", macos: "PC (Mac)", linux: "PC (Linux)" };
  const CRISES = { numlock: "NUM LOCK 철창", mouse: "마우스", wheel_mouse: "휠 마우스", spacebar: "스페이스바" };
  const CHANCE = { f: "골든 피버", d: "DRIFT", t: "로봇 변신" };
  const NOT_YET = "아직 받은 기록 없음 · 앱 다음 빌드부터 집계";
  // Hard mode meter slots, in the order of scripts/data/hard_meter_data.gd (SRC_NAMES / REF_NAMES / DMG_NAMES).
  const LOST = ["시간 소모", "칸 이동", "집게 조임", "키보드 내려치기", "보스 충격파", "거인 주먹", "DEL 다이너마이트", "트랜지스터", "로봇 텐키 던지기", "고양이 앞발", "NUM LOCK 철창 시간 초과", "임플란트 대가", "기타"];
  const REFILL = ["건전지", "상자", "카드", "탈출 보상", "클립", "수리 키트", "완충", "저장", "부활", "기타"];
  const DEALT = ["클릭", "스크롤", "레이저", "더블클릭", "커서 자국", "우클릭 메뉴", "로봇 펀치", "로봇 쿵 밟기", "폭발", "기타"];
  const FORMS = { tenkey: "텐키 그대로", drift: "DRIFT", robot: "로봇" };
  const MOBS = { mouse: "마우스", wheel_mouse: "휠 마우스", spacebar: "스페이스바" };
  const CARDS = {
    dash: "돌진", overclock: "오버클럭", recharge: "충전", shock: "충격파", laser: "레이저", turbo: "터보", eco: "절전", bomb: "폭탄", goldrush: "골드 러시",
    nitro: "니트로", drift_blast: "드리프트 폭발", grip: "그립", chain: "연속 드리프트", rainbow_trail: "무지개 자국",
    rocket_punch: "로켓 펀치", robo_laser: "로봇 레이저", robo_dash: "로봇 돌진", stomp: "쿵 밟기", barrier: "배리어",
    drift: "DRIFT 카드", transform: "로봇 변신 카드", fever: "골든 피버 카드",
    battery: "배터리 충전", scrap: "고철", repair: "텐키 수리", powersave: "절전 모드",
  };
  const KINDS = { n: "새 스킬", u: "스킬 강화", p: "DRIFT·로봇 능력", d: "DRIFT", t: "로봇 변신", f: "골든 피버", c: "즉시 효과" };
  // DigBalCount names (scripts/dig/dig_bal_count.gd callers); a name not listed shows as the game wrote it.
  const COUNTERS = { keys_broken: "부순 키", numlock_seen: "NUM LOCK 철창이 나온 횟수", numlock_caught: "NUM LOCK 철창에 갇힌 횟수", numlock_caught_in_drift: "DRIFT 중 철창에 갇힌 횟수",
    drift_time: "DRIFT로 보낸 시간(초)", robot_time: "로봇으로 보낸 시간(초)", drift_break_turn: "DRIFT 회전으로 부순 키", robot_break: "로봇이 부순 키", xp_robot: "로봇이 얻은 경험치",
    life_drain: "생명줄: 시간이 지나 닳음", life_hurt: "생명줄: 맞아서 닳음", life_grab: "생명줄: 집게에 잡혀 닳음", life_cage: "생명줄: NUM LOCK 철창에서 닳음" };
  // One line under each panel: what it is built from and how long the server keeps that (keep.get; never a number written here).
  const KEEP_LINES = [["tenkeyBalanceWhere", "판 기록 (앱·웹 체험판이 판마다 보냄)", "run_stats"], ["tenkeyBalanceLevels", "판 기록의 끝난 레벨·이유", "run_stats"],
    ["tenkeyBalanceForms", "판 기록의 끝날 때 모습, DRIFT·로봇이 된 레벨", "run_stats"], ["tenkeyBalanceCards", "판 기록의 고른 카드 (한 판 24장까지)", "run_stats"],
    ["tenkeyBalanceMobs", "판 기록의 만난 적", "run_stats"], ["tenkeyBalanceTrace", "판 흐름 기록의 위기·카드 룰렛", "run_trace"],
    ["tenkeyBalanceReach", "판 기록의 레벨 시간, 없으면 판 흐름 기록의 레벨업 시각", "run_trace"], ["tenkeyBalanceAcct", "판 흐름 기록의 판 시작 때 계정 강화 정도", "run_trace"],
    ["tenkeyBalanceBands", "판 흐름 기록의 레벨 구간별 시간·피해", "run_trace"], ["tenkeyBalanceOffers", "판 흐름 기록의 나온 카드·손 놓은 시간", "run_trace"],
    ["tenkeyBalanceCounters", "판 흐름 기록의 판 안 숫자", "run_trace"], ["tenkeyBalanceDaily", "판 기록의 날짜·빌드·조정값 번호", "run_stats"],
    ["tenkeyBalanceHard", "판 흐름 기록의 하드 모드 측정값", "run_trace"]];
  const name = (map, id) => map[id] || id || "기록 없음";
  // "여기 보기": the reading guide's thresholds (tenkey_server.md 25), shown next to the number they are about.
  const look = (why) => `<span class="tk-badge tk-look" data-tone="risk">여기 보기</span><span class="tk-sub">${esc(why)}</span>`;

  function bars(rows, total, label, extra = () => "") {
    if (!rows.length) return '<p class="overview-drill-note">아직 기록이 없습니다.</p>';
    const max = Math.max(...rows.map((r) => Number(r.n)));
    return `<ul class="overview-bars">${rows.map((r) => `<li><span class="bar-label">${esc(label(r))}</span><span class="bar-track"><span class="bar-fill" style="width:${(Number(r.n) / max * 100).toFixed(1)}%"></span></span><span class="bar-value">${esc(num(r.n))} · ${esc(pct(r.n, total))}${esc(extra(r))}</span></li>`).join("")}</ul>`;
  }
  // Level 1..60 (60 = 60 and up) in steps of five, so a 30-level run reads as one short list.
  function levelSteps(levels) {
    const steps = new Map();
    for (const l of levels) {
      const from = Math.floor((Number(l.lv) - 1) / 5) * 5 + 1;
      steps.set(from, (steps.get(from) || 0) + Number(l.n));
    }
    return [...steps].sort((a, b) => a[0] - b[0]).map(([from, n]) => ({ n, label: from >= 56 ? "Lv 56 이상" : `Lv ${from}–${from + 4}` }));
  }
  // Each cell carries its column's name, so a phone can stack a wide row as "name: value" lines (.tk-stack).
  // A cell is [value, numeric, extra]: extra is markup this file builds (the "여기 보기" mark), added after the escaped value.
  const rowsOf = (list, heads, cells) => list.map((r) => `<tr>${cells(r).map(([v, numeric, extra], i) => `<td data-label="${esc(heads[i])}"${numeric ? ' class="tk-num"' : ""}>${esc(v)}${extra || ""}</td>`).join("")}</tr>`).join("");
  const avgLv = (v) => (v === null || v === undefined ? "—" : `Lv ${v}`);

  const lineRows = (arr, names) => (arr || []).map((v, i) => ({ n: Number(v), label: names[i] || `#${i}` })).filter((r) => r.n > 0);
  const sumOf = (rows) => rows.reduce((a, r) => a + r.n, 0);
  const emptyRow = (cols) => `<tr><td colspan="${cols}" class="empty-panel">이 기간에 기록이 없습니다.</td></tr>`;
  const topCard = (d, kind) => (d.skills || []).filter((x) => x.kind === kind).sort((a, b) => Number(b.runs) - Number(a.runs))[0];

  // Which device the runs were played on, and whether a hard run exists at all (these ignore the device / mode filters).
  function renderWhere(d) {
    byId("tenkeyBalanceWhere").hidden = !d.platforms;
    if (!d.platforms) return;
    byId("tenkeyBalancePlatforms").innerHTML = d.platforms.length ? rowsOf(d.platforms, ["기기", "판", "기기 수", "DRIFT까지 간 판", "평균 끝 레벨"], (p) => [[name(PLATFORMS, p.platform)], [num(p.runs), true], [num(p.installs), true], [`${num(p.drift)} · ${pct(p.drift, p.runs)}`, true], [avgLv(p.avg_level), true]]) : emptyRow(5);
    const mode = (m) => (d.modes || []).find((x) => x.mode === m);
    byId("tenkeyBalanceModes").textContent = `노멀 모드 ${num(mode("classic")?.runs || 0)}판 · ${mode("hard") ? `하드 모드 ${num(mode("hard").runs)}판` : "하드모드 판 없음"}`;
    const web = d.platforms.filter((p) => String(p.platform).startsWith("web")).reduce((n, p) => n + Number(p.runs || 0), 0);
    byId("tenkeyBalanceWebApart").textContent = state.q.platform === "app" && web > 0 ? `웹 체험판 ${num(web)}판은 따로 셉니다: 이 표 아래 숫자에는 들어가지 않습니다 (체험판은 Lv 8에서 끝남).` : "";
  }

  // Crises met and the chance cards (GOLDEN FEVER / DRIFT / robot), from the run timeline the apps and the web demo send.
  function renderTrace(d) {
    const tr = d.trace;
    byId("tenkeyBalanceTrace").hidden = !tr;
    if (!tr) return;
    const n = Number(tr.runs);
    byId("tenkeyBalanceTraceNote").textContent = n ? `상세 기록(판의 시간 흐름)을 보낸 ${num(n)}판 기준 · 위 판 기록과는 따로 모입니다.` : "이 조건에서 상세 기록을 보낸 판이 아직 없습니다.";
    byId("tenkeyBalanceCrises").innerHTML = bars((tr.crises || []).map((c) => ({ n: c.runs, id: c.id, times: c.n })), n, (r) => name(CRISES, r.id), (r) => ` · 모두 ${num(r.times)}번`);
    const cards = (tr.cards || []).filter((c) => CHANCE[c.kind]);
    byId("tenkeyBalanceChance").innerHTML = cards.length ? rowsOf(cards, ["카드", "나온 횟수", "성공 횟수", "성공 비율", "고를 때 평균 레벨"], (c) => [[CHANCE[c.kind]], [num(c.offered), true], [num(c.won), true], [pct(c.won, c.offered), true], [avgLv(topCard(d, c.kind)?.avg_pick_level), true]]) : emptyRow(5);
    const f = tr.form_s || {};
    byId("tenkeyBalanceFormTime").textContent = n ? `한 판에서 평균 DRIFT ${num(f.drift)}초 · 로봇 ${num(f.robot)}초 · 골든 피버 ${num(f.fever)}초` : "";
  }

  // How long a level takes to reach and how long a run stays DRIFT / robot: only the builds that send level times.
  function renderReach(d) {
    byId("tenkeyBalanceReach").hidden = !d.reach;
    if (!d.reach) return;
    const has = d.reach.length > 0;
    const from = d.reach_src === "trace" ? "판 흐름 기록의 레벨업 시각 기준 (판 기록에 레벨 시간이 없는 빌드)" : `레벨 시간을 보낸 ${num(d.times?.n)}판 기준`;
    byId("tenkeyBalanceReachNote").textContent = has ? `${from} · DRIFT 평균 ${duration(d.times?.drift_ms)} · 로봇 평균 ${duration(d.times?.robot_ms)}` : NOT_YET;
    // How long a level holds the player (the next level's median minus this one's); far above both neighbours = "여기 보기".
    const at = new Map(d.reach.map((r) => [Number(r.lv), Number(r.median_ms)]));
    const stay = (lv) => (at.has(lv) && at.has(lv + 1) ? at.get(lv + 1) - at.get(lv) : null);
    const slow = (lv) => { const s = stay(lv), a = stay(lv - 1), b = stay(lv + 1); return s !== null && a !== null && b !== null && s > 2 * Math.max(1, (a + b) / 2); };
    const shown = d.reach.filter((r) => Number(r.lv) % 5 === 0 || Number(r.lv) <= 3 || slow(Number(r.lv)));
    byId("tenkeyBalanceReachRows").innerHTML = has ? rowsOf(shown, ["레벨", "도착한 판", "가운데 값", "느린 쪽 10%", "다음 레벨까지"], (r) => [[`Lv ${r.lv}`], [num(r.n), true], [duration(r.median_ms), true], [duration(r.p90_ms), true],
      [stay(Number(r.lv)) === null ? "—" : duration(stay(Number(r.lv))), true, slow(Number(r.lv)) ? look("이 레벨에 앞뒤 레벨보다 두 배 넘게 머묾") : ""]]) : emptyRow(5);
  }

  // Hard mode (apps only): its own run records and the meter every hard run carries.
  function renderHard(d) {
    const h = d.hard;
    byId("tenkeyBalanceHard").hidden = !h;
    if (!h) return;
    const stored = Number((d.modes || []).find((m) => m.mode === "hard")?.runs || 0);
    const none = Number(h.runs) === 0 && stored === 0;
    byId("tenkeyBalanceHardEmpty").hidden = !none;
    byId("tenkeyBalanceHardBody").hidden = none;
    if (none) return;
    byId("tenkeyBalanceHardNote").textContent = `하드 모드 ${num(stored)}판 기록 · 상세 기록을 보낸 ${num(h.runs)}판 (기기 ${num(h.installs)}) · 그중 측정값이 있는 판 ${num(h.with_meter)}`;
    byId("tenkeyBalanceBosses").innerHTML = rowsOf(h.bosses || [], ["보스", "만난 횟수", "이긴 횟수", "이긴 비율", "한 번에 걸린 시간"], (b) => [[`Lv ${b.lv} 보스`], [num(b.met), true], [num(b.won), true], [pct(b.won, b.met), true], [Number(b.met) > 0 ? duration(Number(b.sec) / Number(b.met) * 1000) : "—", true]]);
    const m = h.meter || {};
    const meter = (id, arr, names) => { const rows = lineRows(arr, names); byId(id).innerHTML = Number(h.with_meter) ? bars(rows, sumOf(rows), (r) => r.label) : `<p class="overview-drill-note">${NOT_YET}</p>`; };
    meter("tenkeyBalanceLostBat", m.lb, LOST); meter("tenkeyBalanceLostDur", m.ld, LOST);
    meter("tenkeyBalanceRefillBat", m.rb, REFILL); meter("tenkeyBalanceRefillDur", m.rd, REFILL); meter("tenkeyBalanceDealt", m.dm, DEALT);
    const cl = m.cl || [];
    byId("tenkeyBalanceClamp").textContent = Number(cl[0]) > 0 ? `집게에 잡힌 ${num(cl[0])}번 중 ${num(cl[1])}번 스스로 빠져나옴 · 한 번에 평균 ${num(Math.round(Number(cl[4]) / Number(cl[0]) * 10) / 10)}초 잡혀 있음` : "";
  }

  // balance.v4 only (tenkey.admin_balance_v4, hexaworld 20261117130200): each panel stays hidden while the server does not send its
  // list ([] = sent, nothing yet = NOT_YET). acct band = the sum of the account's upgrade tiers (160 = UpgradeStageData.TOTAL_TIERS,
  // all done; 'none' = a build before acct); bands 0..4 = Lv 1-6 / 7-13 / 14-19 / 20-29 / 30+, each an average over the runs that
  // reached it; counters = {name: sum} over counter_runs runs (the runs that sent them).
  const ACCT = { none: "모름 (강화 정도를 보내기 전 빌드)", 0: "강화 안 한 계정 (강화 합 0)", "1-9": "강화 합 1–9", "10-24": "강화 합 10–24", "25-39": "강화 합 25–39",
    "40-159": "강화 합 40–159", "160+": "모두 강화한 계정 (강화 합 160)" };
  const BANDS = ["Lv 1–6", "Lv 7–13", "Lv 14–19", "Lv 20–29", "Lv 30 이상"];
  function renderV4(d) {
    const panel = (id, list) => { byId(id).hidden = list === undefined || list === null; return Array.isArray(list) ? list : []; };
    const acct = panel("tenkeyBalanceAcct", d.acct);
    byId("tenkeyBalanceAcctRows").innerHTML = acct.some((r) => r.band !== "none") ? rowsOf(acct, ["강화 정도", "판", "평균 끝 레벨", "한 판 길이 (가운데)"],
      (r) => [[ACCT[r.band] || String(r.band ?? "—")], [num(r.runs), true], [avgLv(r.avg_lv), true], [r.median_ms == null ? "—" : duration(r.median_ms), true]]) : `<tr><td colspan="4" class="empty-panel">${NOT_YET}</td></tr>`;
    // start = runs by the level they began at (tenkey.admin_balance_v5, hexaworld draft 20261117170000, cqa1117): hidden while the
    // server sends no list, and while every run began at Lv 1 (nothing to tell apart yet)
    const start = panel("tenkeyBalanceStart", d.start);
    if (!start.some((r) => Number(r.start) > 1)) byId("tenkeyBalanceStart").hidden = true;
    byId("tenkeyBalanceStartRows").innerHTML = rowsOf(start, ["시작 레벨", "판", "평균 끝 레벨", "한 판 길이 (가운데)", "끝까지 깬 판"],
      (r) => [[Number(r.start) > 1 ? `Lv ${r.start}에서 시작` : "Lv 1부터"], [num(r.runs), true], [avgLv(r.avg_lv), true], [r.median_ms == null ? "—" : duration(r.median_ms), true], [num(r.cleared), true]]);
    const bands = panel("tenkeyBalanceBands", d.bands);
    byId("tenkeyBalanceBandRows").innerHTML = bands.length ? rowsOf(bands, ["구간", "지나간 판", "머문 시간 (평균)", "부순 키 (판당)", "받은 피해 (판당)", "부활"],
      (r) => [[BANDS[r.band] || `구간 ${r.band}`], [num(r.runs), true], [r.secs == null ? "—" : duration(Number(r.secs) * 1000), true], [r.keys == null ? "—" : num(r.keys), true], [r.dmg == null ? "—" : `${num(r.dmg)}%`, true], [num(r.revives), true]]) : emptyRow(6);
    const offers = d.offers === undefined && d.idle === undefined ? null : d.offers || [];
    const shown = panel("tenkeyBalanceOffersPanel", offers);
    byId("tenkeyBalanceOffers").innerHTML = shown.length ? rowsOf([...shown].sort((a, b) => Number(b.offered) - Number(a.offered)), ["카드", "나온 횟수", "고른 횟수", "고른 비율"], (r) => {
      const low = Number(r.offered) >= 10 && Number(r.picked) / Number(r.offered) < 0.15;
      return [[name(CARDS, r.skill)], [num(r.offered), true], [num(r.picked), true], [pct(r.picked, r.offered), true, low ? look("1/3보다 한참 낮음") : ""]];
    }) : emptyRow(4);
    const idle = d.idle || null;
    const n = Number(idle?.runs || 0);
    byId("tenkeyBalanceIdle").innerHTML = n ? `<dl class="tk-detail-grid">${[
      ["상세 기록을 보낸 판", num(n), ""], ["판 시간 중 손 놓은 비율", `${num(idle.idle_share_pct)}%`, Number(idle.idle_share_pct) > 10 ? look("10%를 넘음") : ""],
      ["30초 넘게 손 놓은 판", `${num(idle.long_idle_runs)} · ${pct(idle.long_idle_runs, n)}`, Number(idle.long_idle_runs) / n > 0.25 ? look("네 판에 한 판 넘게") : ""],
      ["가장 길게 손 놓은 시간 (가운데)", idle.p50_longest_s == null ? "—" : duration(Number(idle.p50_longest_s) * 1000), ""],
    ].map(([k, v, extra]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${extra}</dd></div>`).join("")}</dl>` : `<p class="overview-drill-note">${NOT_YET}</p>`;
    const list = d.counters && typeof d.counters === "object" ? Object.entries(d.counters).map(([key, sum]) => ({ key, sum })).sort((a, b) => Number(b.sum) - Number(a.sum)) : d.counters;
    const counters = panel("tenkeyBalanceCountersPanel", list);
    const runs = Number(d.counter_runs || 0);
    byId("tenkeyBalanceCounters").innerHTML = counters.length ? rowsOf(counters, ["센 것", "센 판", "모두", "판당"],
      (r) => [[name(COUNTERS, r.key)], [num(runs), true], [num(r.sum), true], [runs > 0 ? num(Math.round(Number(r.sum) / runs * 10) / 10) : "—", true]]) : emptyRow(4);
  }

  // Where the numbers came from: the newest record of each table and how many rows the server holds in all (v4 tables: the whole
  // table, not this filter), or which server answered.
  function renderFresh(d) {
    const parts = [];
    const t = d.tables && typeof d.tables === "object" ? d.tables : null;
    if (t) parts.push(`마지막으로 받은 판 기록 ${time(t.run_stats?.last_received_at)} · 판 흐름 기록 ${time(t.run_trace?.last_received_at)} · 서버에 남아 있는 줄 (기간·조건과 상관없이 모두): 판 기록 ${num(t.run_stats?.rows)}, 판 흐름 기록 ${num(t.run_trace?.rows)}.`);
    if (d._src === "v4+v3") parts.push("계정 강화 정도·레벨 구간·나온 카드·손 놓은 시간·센 것 표는 아직 빌드·모드를 가리지 않은 값입니다.");
    if (d._src === "v3") parts.push("서버가 아직 이전 버전이라 계정 강화 정도·레벨 구간·나온 카드·손 놓은 시간·센 것 표는 빠졌습니다.");
    byId("tenkeyBalanceFresh").hidden = !parts.length;
    byId("tenkeyBalanceFresh").textContent = parts.join(" ");
  }

  function render(d) {
    renderWhere(d); renderHard(d); renderFresh(d);
    const t = d.total || {};
    const runs = Number(t.runs || 0);
    byId("tenkeyBalanceEmpty").hidden = runs > 0;
    byId("tenkeyBalanceBody").hidden = runs === 0;
    const fever = topCard(d, "f");
    const builds = byId("tenkeyBalanceBuild");
    builds.innerHTML = ['<option value="">전체</option>', ...(d.builds || []).map((b) => `<option value="${esc(b.build)}">빌드 ${esc(b.build)}${b.version ? ` (${esc(b.version)})` : ""}</option>`)].join("");
    builds.value = state.q.build;
    const set = (key, value) => { byId("tenkeyBalanceSummary").querySelector(`[data-tk-summary="${key}"]`).textContent = value; };
    set("runs", num(runs)); set("installs", num(t.installs)); set("time", runs ? duration(t.median_ms) : "—");
    set("level", runs ? `Lv ${t.median_level}` : "—"); set("drift", pct(t.drift, runs)); set("robot", pct(t.robot, runs));
    set("back", num(t.robot_returned)); set("clear", pct(t.cleared, runs));
    set("revive", runs ? `${num(t.revived)} / ${num(t.revive_offered)}` : "—"); set("owned", pct(t.transformer_owned, runs));
    set("fever", runs ? pct(fever?.runs || 0, runs) : "—");
    if (!runs) return;
    renderTrace(d); renderReach(d); renderV4(d);
    byId("tenkeyBalanceLevels").innerHTML = bars(levelSteps(d.levels || []), runs, (r) => r.label);
    byId("tenkeyBalanceCauses").innerHTML = bars(d.causes || [], runs, (r) => name(CAUSES, r.cause), (r) => ` · 평균 Lv ${r.avg_level}`);
    byId("tenkeyBalanceForms").innerHTML = bars(d.forms || [], runs, (r) => name(FORMS, r.form));
    byId("tenkeyBalanceDriftLv").innerHTML = bars(d.drift_levels || [], t.drift, (r) => `Lv ${r.lv}`);
    byId("tenkeyBalanceRobotLv").innerHTML = bars(d.robot_levels || [], t.robot, (r) => `Lv ${r.lv}`);
    const cards = d.skills || [];
    byId("tenkeyBalanceAvg").textContent = `전체 판의 평균 끝 레벨 Lv ${t.avg_level}`;
    byId("tenkeyBalanceCards").innerHTML = cards.length ? rowsOf(cards, ["카드", "종류", "고른 판 · 비율", "고른 횟수", "고를 때 평균 레벨", "그 판의 평균 끝 레벨"], (s) => [[name(CARDS, s.skill)], [KINDS[s.kind] || s.kind], [`${num(s.runs)} · ${pct(s.runs, runs)}`, true], [num(s.picks), true], [avgLv(s.avg_pick_level), true], [avgLv(s.avg_end_level), true]])
      : '<tr><td colspan="6" class="empty-panel">이 기간에 고른 카드가 없습니다.</td></tr>';
    const mobs = (d.encounters || []).filter((e) => Number(e.met) > 0);
    byId("tenkeyBalanceMobs").innerHTML = mobs.length ? rowsOf(mobs, ["적", "만난 판 · 비율", "만난 횟수", "이긴 횟수", "이긴 비율"], (e) => [[name(MOBS, e.id)], [`${num(e.runs)} · ${pct(e.runs, runs)}`, true], [num(e.met), true], [num(e.won), true], [pct(e.won, e.met), true]])
      : '<tr><td colspan="5" class="empty-panel">이 기간에 만난 적이 없습니다.</td></tr>';
    byId("tenkeyBalanceDaily").innerHTML = rowsOf([...(d.daily || [])].reverse(), ["날짜", "판", "기기", "평균 끝 레벨"], (r) => [[r.day], [num(r.runs), true], [num(r.installs), true], [avgLv(r.avg_level), true]]);
    byId("tenkeyBalanceBuilds").innerHTML = rowsOf(d.builds || [], ["빌드", "버전", "판", "평균 끝 레벨"], (b) => [[`빌드 ${b.build}`], [b.version || "—"], [num(b.runs), true], [avgLv(b.avg_level), true]]);
    const knobs = d.knobs || [];
    byId("tenkeyBalanceKnobPanel").hidden = !knobs.some((k) => Number(k.kv) > 0);
    byId("tenkeyBalanceKnobs").innerHTML = rowsOf(knobs, ["조정값", "판", "평균 끝 레벨"], (k) => [[Number(k.kv) > 0 ? `${k.kv}번` : "게임 기본값"], [num(k.runs), true], [avgLv(k.avg_level), true]]);
  }

  // balance.v4 first; unknown_action = a server without it -> balance.get (v3). When v4 does not echo a build / mode filter it was
  // sent, v3 answers the filtered numbers and v4 keeps only its own new lists (renderFresh says they are unfiltered).
  async function fetchBalance(q) {
    const params = { days: q.days, platform: q.platform || undefined, build: q.build === "" ? undefined : Number(q.build), mode: q.mode || undefined };
    let v4 = null;
    try {
      v4 = (await T.stats("balance.v4", params)) || {};
    } catch (error) {
      if (error?.message !== "unknown_action") throw error;
      return { ...((await T.call("balance.get", params)).data || {}), _src: "v3" };
    }
    if ((params.build === undefined || v4.build != null) && (!params.mode || v4.mode != null)) return { ...v4, _src: "v4" };
    return { ...v4, ...((await T.call("balance.get", params)).data || {}), _src: "v4+v3" };
  }

  async function load() {
    T.setMessage("tenkeyBalanceMessage", "판 기록을 불러오는 중입니다...");
    try {
      render(await fetchBalance(state.q));
      T.setMessage("tenkeyBalanceMessage", "");
    } catch (error) {
      T.report("tenkeyBalanceMessage", error);
    }
  }

  // ── 서버 밸런스 조정값 ──
  function fillKnobs(b) {
    const form = byId("tenkeyKnobForm");
    for (const k of KNOBS) form.elements[k].value = Number(b?.[k] ?? 1).toFixed(2);
    const ver = Number(b?.ver || 0);
    byId("tenkeyKnobVersion").textContent = ver > 0
      ? `지금 조정값 ${ver}번 · ${time(b.updated_at)}${b.updated_by ? ` · ${b.updated_by}` : ""}`
      : "아직 바꾼 적 없음: 모두 게임에 들어 있는 값 (1.00)";
  }

  async function loadKnobs() {
    try {
      fillKnobs((await T.call("config.get", {})).data?.balance);
      T.setMessage("tenkeyKnobMessage", "");
    } catch (error) {
      T.report("tenkeyKnobMessage", error);
    }
  }

  async function submitKnobs(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const knobs = Object.fromEntries(KNOBS.map((k) => [k, Math.round(Number(form.elements[k].value) * 100) / 100]));
      if (Object.values(knobs).some((v) => !Number.isFinite(v) || v < 0.7 || v > 1.3)) {
        T.setMessage("tenkeyKnobMessage", T.errorText({ message: "invalid_knob_value" }), true);
        return;
      }
      const reason = form.elements.reason.value.trim();
      const lines = KNOBS.map((k) => `${KNOB_NAMES[k]} ${knobs[k].toFixed(2)}`);
      if (!await root.ConsoleApp.confirmChange("10KEY 밸런스 조정값 변경", [...lines, "스토어 앱이 다음에 켤 때 받아 그다음 판부터 씁니다.", `변경 이유: ${reason}`].join("\n"))) return;
      T.setMessage("tenkeyKnobMessage", "저장하는 중입니다...");
      const result = await T.call("knobs.set", { knobs, reason }, form);
      const d = result.data || {};
      fillKnobs({ ...d.balance, updated_at: new Date().toISOString() });
      form.elements.reason.value = "";
      T.setMessage("tenkeyKnobMessage", d.unchanged ? "지금 값과 같아서 그대로 두었습니다." : `조정값 ${d.balance?.ver}번으로 저장했습니다. 스토어 앱은 다음에 켤 때 받아 그다음 판부터 씁니다.`);
    } catch (error) {
      T.report("tenkeyKnobMessage", error);
    } finally {
      finish();
    }
  }

  function mountBalance() {
    if (!state.bound) {
      state.bound = true;
      for (const [id, what, tbl] of KEEP_LINES) {
        const box = byId(id)?.closest(".panel");
        if (box && !box.querySelector(":scope > .tk-keep-line")) box.insertAdjacentHTML("beforeend", `<p class="tk-keep-line">모으는 것: ${esc(what)} · 서버 보관 <span data-tk-keep="${tbl}">—</span></p>`);
      }
      byId("tenkeyKnobForm").addEventListener("submit", submitKnobs);
      byId("tenkeyKnobDefaults").addEventListener("click", () => { for (const k of KNOBS) byId("tenkeyKnobForm").elements[k].value = "1.00"; });
      byId("tenkeyBalanceForm").addEventListener("submit", (event) => {
        event.preventDefault();
        state.q = { days: Number(byId("tenkeyBalanceDays").value), build: byId("tenkeyBalanceBuild").value, mode: byId("tenkeyBalanceMode").value, platform: byId("tenkeyBalancePlatform").value };
        load();
      });
    }
    T.fillKeep(byId("tenkeyBalanceView"));
    load();
    loadKnobs();
  }

  T.mountBalance = mountBalance;
  T.gameNames = { cards: CARDS, crises: CRISES };  // the issue page puts trail steps ("pick laser", "crisis numlock") in the game's words
})(window);
