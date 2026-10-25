// 10key Survival: 밸런스. Every finished run's short anonymous record (tenkey.run_stats_v1, owner 2026-10-25), read through
// tenkey-admin "balance.get" (tenkey.admin_balance_v1): where and why runs end, how far DRIFT and the robot go, which level-up
// cards are taken and when, the mobs met, per day / build / balance-knob version. Store apps only, keyed by a random install id.
(function attachConsoleTenkeyBalance(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, duration, pct } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, q: { days: 7, build: "", mode: "" } };

  // The game's own Korean words (scripts/i18n: shell.result.cause.*, dig.sk.*, dig.dperk.*, dig.rsk.*, shop.tf.*).
  const CAUSES = { battery: "배터리 방전", mouse: "마우스 포획", durability: "텐키 파손", spacebar: "스페이스바에 깔림", wheel_mouse: "휠 마우스에 치임", clear: "노멀 모드 완주" };
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
  const name = (map, id) => map[id] || id || "기록 없음";

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
  const rowsOf = (list, heads, cells) => list.map((r) => `<tr>${cells(r).map(([v, numeric], i) => `<td data-label="${esc(heads[i])}"${numeric ? ' class="tk-num"' : ""}>${esc(v)}</td>`).join("")}</tr>`).join("");
  const avgLv = (v) => (v === null || v === undefined ? "—" : `Lv ${v}`);

  function render(d) {
    const t = d.total || {};
    const runs = Number(t.runs || 0);
    byId("tenkeyBalanceEmpty").hidden = runs > 0;
    byId("tenkeyBalanceBody").hidden = runs === 0;
    const builds = byId("tenkeyBalanceBuild");
    builds.innerHTML = ['<option value="">전체</option>', ...(d.builds || []).map((b) => `<option value="${esc(b.build)}">빌드 ${esc(b.build)}${b.version ? ` (${esc(b.version)})` : ""}</option>`)].join("");
    builds.value = state.q.build;
    const set = (key, value) => { byId("tenkeyBalanceSummary").querySelector(`[data-tk-summary="${key}"]`).textContent = value; };
    set("runs", num(runs)); set("installs", num(t.installs)); set("time", runs ? duration(t.median_ms) : "—");
    set("level", runs ? `Lv ${t.median_level}` : "—"); set("drift", pct(t.drift, runs)); set("robot", pct(t.robot, runs));
    set("back", num(t.robot_returned)); set("clear", pct(t.cleared, runs));
    set("revive", runs ? `${num(t.revived)} / ${num(t.revive_offered)}` : "—"); set("owned", pct(t.transformer_owned, runs));
    if (!runs) return;
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

  async function load() {
    T.setMessage("tenkeyBalanceMessage", "판 기록을 불러오는 중입니다...");
    try {
      const q = state.q;
      const result = await T.call("balance.get", { days: q.days, build: q.build === "" ? undefined : Number(q.build), mode: q.mode || undefined });
      render(result.data || {});
      T.setMessage("tenkeyBalanceMessage", "");
    } catch (error) {
      T.report("tenkeyBalanceMessage", error);
    }
  }

  function mountBalance() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyBalanceForm").addEventListener("submit", (event) => {
        event.preventDefault();
        state.q = { days: Number(byId("tenkeyBalanceDays").value), build: byId("tenkeyBalanceBuild").value, mode: byId("tenkeyBalanceMode").value };
        load();
      });
    }
    load();
  }

  T.mountBalance = mountBalance;
})(window);
