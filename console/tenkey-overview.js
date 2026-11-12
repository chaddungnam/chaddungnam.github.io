// 10key Survival: 한눈 요약. One tenkey-admin call ("overview.get", always 90 days) feeds two rows of plain numbers (오늘 /
// 최근 7일, one number per card with one line of words under it), the daily chart of devices that opened the app and, folded away, the other charts.
// Owner 2026-10-25 ("한눈요약 개선처리해줘. 한눈에 안들어옴"): the numbers that matter first, big and in plain Korean; the
// breakdowns live under "그래프 더 보기". Days are Berlin dates (the server's day). Device numbers come from the app's daily ping
// (Android / iOS players with a guest account) and, since 2026-10-30, the itch.io web build's anonymous ping (after the Terms +
// Privacy agreement on its title; filter "웹(itch)"); CrazyGames web still sends nothing. The web id is new on every page load
// (the client's STORE_ID switch is off), so on the web filter "people" are visits and there is no return rate. Runs = per
// device and day the larger of the ping counters and the run records (server 20261030150001); the unfinished "today" is
// shown next to yesterday's whole day, never judged up or down (only the 7-day windows get an arrow).
// Owner 2026-10-25 ("테스터가 꽤 많을텐데 0명인건 논리적으로 안맞음"): the closed-test build (1.0.0, 2026-10-22) predates the
// ping, so every count of people is the larger of the ping and the people the game server saw (data.server, a row per player
// and day: sign-in, progress, runs; app and web), and until the first ping arrives the install / play cards use the game
// server's own counts (new players, people whose run reached the server) instead of zeros. Owner the same day ("1주일간 dau
// 퍼센티지로"): the last 7 days, each day's people as a share of the players that existed by the end of that day.
(function attachConsoleTenkeyOverview(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, bytes, pct } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, period: 7, platform: "", data: null, web: null, prereg: null, dau: null, compare: "d1", busy: false };
  const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

  const dayLabel = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? String(iso) : `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. (${WEEKDAY[d.getUTCDay()]})`;
  };
  const shortDay = (iso) => String(iso).slice(5).replace("-", ". ") + ".";
  const niceMax = (value) => {
    if (root.ConsoleModel?.overviewNiceMax) return root.ConsoleModel.overviewNiceMax(value);
    const v = Math.max(1, Number(value) || 0);
    const pow = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 5, 10].map((m) => m * pow).find((m) => m >= v);
  };
  const tip = (title, rows, note = "") => esc([title, ...rows.filter(Boolean).map(([k, v]) => `${k}\t${v}`), note ? `#${note}` : ""].filter(Boolean).join("\n"));
  const sum = (series, key, days) => series.slice(-days).reduce((total, row) => total + Number(row[key] || 0), 0);

  // ── tooltip: hover / focus / tap on any [data-tip] inside the overview ──
  function showTip(target) {
    const box = byId("tenkeyTip");
    const lines = String(target.dataset.tip || "").split("\n").filter(Boolean);
    if (!lines.length) return;
    box.innerHTML = lines.map((line, index) => {
      if (index === 0) return `<span class="ov-tip-title">${esc(line)}</span>`;
      if (line.startsWith("#")) return `<p class="ov-tip-note">${esc(line.slice(1))}</p>`;
      const [name, value] = line.split("\t");
      return `<p class="ov-tip-row"><span>${esc(name)}</span><b>${esc(value ?? "")}</b></p>`;
    }).join("");
    box.hidden = false;
    const rect = target.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - box.offsetWidth / 2, root.innerWidth - box.offsetWidth - margin));
    const above = rect.top - box.offsetHeight - 8;
    box.style.transform = `translate(${Math.round(left)}px, ${Math.round(above > margin ? above : rect.bottom + 8)}px)`;
  }
  function hideTip() { byId("tenkeyTip").hidden = true; }
  function bindTips(container) {
    container.addEventListener("pointerover", (event) => { const t = event.target.closest("[data-tip]"); if (t) showTip(t); else hideTip(); });
    container.addEventListener("pointerleave", hideTip);
    container.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") setTimeout(hideTip, 1800); });
    container.addEventListener("focusin", (event) => { const t = event.target.closest("[data-tip]"); if (t) showTip(t); });
    container.addEventListener("focusout", hideTip);
  }

  // ── pieces of the frame ──
  const GRID = '<path class="ov-grid" d="M0 0 H100 M0 50 H100" vector-effect="non-scaling-stroke"></path><path class="ov-axis" d="M0 100 H100" vector-effect="non-scaling-stroke"></path>';
  const yTicks = (max) => `<span class="ov-ytick" style="top:0%">${esc(num(max))}</span><span class="ov-ytick" style="top:50%">${esc(num(max / 2))}</span>`;
  const hits = (tips) => tips.map((text, i) => `<span class="ov-hit" style="left:${(i * 100 / tips.length).toFixed(3)}%;width:${(100 / tips.length).toFixed(3)}%" data-tip="${text}"></span>`).join("");
  function xAxis(rows) {
    if (!rows.length) return '<div class="ov-xaxis"></div>';
    const marks = rows.length === 1 ? [[50, shortDay(rows[0].day), ""]] : [[0, shortDay(rows[0].day), "start"], [100, shortDay(rows.at(-1).day), "end"]];
    return `<div class="ov-xaxis" aria-hidden="true">${marks.map(([left, text, align]) => `<span style="left:${left}%"${align ? ` data-align="${align}"` : ""}>${esc(text)}</span>`).join("")}</div>`;
  }
  function linePath(values, max) {
    const n = values.length;
    return values.map((v, i) => `${i ? "L" : "M"}${((i + 0.5) / n * 100).toFixed(2)} ${(100 - (Number(v) || 0) / max * 94 - 3).toFixed(2)}`).join(" ");
  }
  function lineChart(rows, key, tips, tone = "") {
    const values = rows.map((r) => Number(r[key] || 0));
    const max = niceMax(Math.max(0, ...values));
    const path = linePath(values, max);
    const n = values.length;
    const area = `${path} L${((n - 0.5) / n * 100).toFixed(2)} 100 L${(0.5 / n * 100).toFixed(2)} 100 Z`;
    const last = values.length ? `<span class="ov-dot is-end" style="left:${((n - 0.5) / n * 100).toFixed(2)}%;top:${(100 - (values.at(-1) || 0) / max * 94 - 3).toFixed(2)}%"></span>` : "";
    return { max, plot: `${yTicks(max)}<div class="ov-plot-inner"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${GRID}<path class="ov-area ${tone}" d="${area}"></path><path class="ov-line ${tone}" d="${path}" vector-effect="non-scaling-stroke"></path></svg>${last}${hits(tips)}</div>` };
  }
  function columns(values, tips, tone = "") {
    const max = niceMax(Math.max(0, ...values));
    const w = 100 / Math.max(1, values.length);
    const cols = values.map((v, i) => `<span class="ov-col" style="left:${(i * w).toFixed(3)}%;width:${w.toFixed(3)}%" data-tip="${tips[i]}">${v > 0 ? `<span class="ov-col-bar" style="height:${Math.max(2, v / max * 100).toFixed(1)}%"></span>` : ""}</span>`).join("");
    return { max, plot: `${yTicks(max)}<div class="ov-plot-inner"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${GRID}</svg><div class="ov-cols ${tone}">${cols}</div></div>` };
  }

  // Several lines on one frame (owner 2026-11-03: "그래프 부족, 한눈에"): each series {key, color, label}, one shared max.
  function multiLine(rows, series, tips) {
    const max = niceMax(Math.max(0, ...series.flatMap((sr) => rows.map((r) => Number(r[sr.key] || 0)))));
    const n = rows.length;
    const paths = series.map((sr) => `<path class="ov-line" style="stroke:${sr.color}" d="${linePath(rows.map((r) => Number(r[sr.key] || 0)), max)}" vector-effect="non-scaling-stroke"></path>`).join("");
    const dots = n ? series.map((sr) => `<span class="ov-dot is-end" style="background:${sr.color};left:${((n - 0.5) / n * 100).toFixed(2)}%;top:${(100 - Number(rows.at(-1)[sr.key] || 0) / max * 94 - 3).toFixed(2)}%"></span>`).join("") : "";
    return { max, plot: `${yTicks(max)}<div class="ov-plot-inner"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${GRID}${paths}</svg>${dots}${hits(tips)}</div>` };
  }
  // Stacked columns: parts [{key, color}] per row.
  function stacked(rows, parts, tips) {
    const totals = rows.map((r) => parts.reduce((t, pt) => t + Number(r[pt.key] || 0), 0));
    const max = niceMax(Math.max(0, ...totals));
    const w = 100 / Math.max(1, rows.length);
    const cols = rows.map((r, i) => {
      const segs = parts.map((pt) => { const v = Number(r[pt.key] || 0); return v > 0 ? `<span style="display:block;height:${(v / totals[i] * 100).toFixed(2)}%;background:${pt.color}"></span>` : ""; }).join("");
      return `<span class="ov-col" style="left:${(i * w).toFixed(3)}%;width:${w.toFixed(3)}%" data-tip="${tips[i]}"><span class="ov-col-bar tk-stack" style="height:${(totals[i] / max * 100).toFixed(2)}%">${segs}</span></span>`;
    }).join("");
    return { max, plot: `${yTicks(max)}<div class="ov-plot-inner"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${GRID}</svg><div class="ov-cols">${cols}</div></div>` };
  }
  const swatch = (color, text) => `<span class="ov-legend-item"><span class="ov-key" data-kind="bar" style="background:${color}" aria-hidden="true"></span>${esc(text)}</span>`;
  const COLOR = { app: "#5b6b8c", web: "#e0864a", pre: "#21aa9b", ko: "#4c5fd5", en: "#21aa9b", ja: "#e0864a", de: "#9aa3b5", zh: "#c94f7c" };
  const LANG = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어(번체)", de: "독일어" };

  const card = (title, legend, body, rows, wide, wait) => `<article class="ov-card${wide ? " is-wide" : ""}">
    <header class="ov-card-head"><h3>${esc(title)}</h3><span class="ov-legend">${legend || ""}</span></header>
    <figure class="ov-figure" tabindex="0" aria-label="${esc(title)}"><div class="ov-plot has-y">${body}${wait ? `<p class="ov-wait">${esc(wait)}</p>` : ""}</div>${xAxis(rows)}</figure></article>`;
  const key = (tone, kind, text) => `<span class="ov-legend-item"><span class="ov-key ${tone}" data-kind="${kind}" aria-hidden="true"></span>${esc(text)}</span>`;

  // One number per card: label, the number with its unit, one line of words (a link when there is something to look at).
  function glance(label, value, unit, note, { tone = "", noteTone = "", help = "", href = "" } = {}) {
    const noteHtml = href
      ? `<a class="tk-glance-note" href="${esc(href)}">${esc(note)}</a>`
      : `<p class="tk-glance-note"${noteTone ? ` data-tone="${noteTone}"` : ""}>${esc(note)}</p>`;
    return `<article class="tk-glance-card"${tone ? ` data-tone="${tone}"` : ""} tabindex="0" data-tip="${tip(label, [], help)}" aria-label="${esc(`${label} ${value}${unit} · ${note}`)}">
      <h4 class="tk-glance-label">${esc(label)}</h4><p class="tk-glance-value"><strong>${esc(value)}</strong>${unit ? `<span>${esc(unit)}</span>` : ""}</p>${noteHtml}</article>`;
  }
  // The 7-day window against the 7 days before it, in words.
  function versus(current, previous, unit, goodWhenUp = true) {
    const diff = Number(current || 0) - Number(previous || 0);
    if (!Number.isFinite(diff) || diff === 0) return { note: "그 전 7일과 같음", noteTone: "" };
    const up = diff > 0;
    return { note: `${up ? "▲" : "▼"} 그 전 7일보다 ${num(Math.abs(diff))}${unit} ${up ? "많음" : "적음"}`, noteTone: up === goodWhenUp ? "good" : "bad" };
  }

  function distribution(title, rows, total, nameOf = (k) => k) {
    if (!rows.length) return `<h4>${esc(title)}</h4><p class="overview-drill-note">아직 기록이 없어요</p>`;
    const max = Math.max(...rows.map((r) => r.n));
    return `<h4>${esc(title)}</h4><ul class="overview-bars">${rows.map((r) => `<li><span class="bar-label">${esc(nameOf(r.key))}</span><span class="bar-track"><span class="bar-fill" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="bar-value">${esc(num(r.n))}${total ? ` · ${esc(pct(r.n, total))}` : ""}</span></li>`).join("")}</ul>`;
  }

  function render(data) {
    const all = data.series || [];
    const rows = all.slice(-state.period);
    const noSignal = state.platform !== "web_itch" && Number(data.new_installs?.all || 0) === 0;  // web: its own numbers only
    const waiting = noSignal ? "앱이 접속 신호를 보내면 채워져요" : "";
    const active = data.active || {};
    const runs = data.runs || {};
    const fresh = data.new_installs || {};
    const ret = data.retention || {};
    const totals = data.totals || {};
    const retRate = (r) => (r && Number(r.cohort) > 0 ? String(Math.round(Number(r.back) / Number(r.cohort) * 1000) / 10) : "—");
    const retRow = (r) => (r && Number(r.cohort) > 0 ? `${pct(r.back, r.cohort)} (${num(r.back)}/${num(r.cohort)}명)` : "아직 셀 수 없음");
    const week = (k) => sum(all, k, 7);
    const weekBefore = (k) => sum(all.slice(0, -7), k, 7);
    const crashes = Number(totals.crash_times_24h || 0);
    const anyPlatform = state.platform ? " (플랫폼 구분 없음)" : "";
    const seen = data.server?.seen || {};
    const played = data.server?.played || {};
    const web = state.platform === "web_itch";  // itch has no accounts: the game server's people are never web visits
    const webActive = (k) => Number(state.web?.active?.[k] || 0);
    // Owner 2026-11-03: itch players sign in too, so in 전체 the people are the accounts the game server saw (app + itch,
    // one per person); the pings stay for the Android / iOS filters. Anonymous itch page loads are shown apart as visits.
    const opened = (k) => (web ? Number(active[k] || 0) : !state.platform && state.web ? Number(seen[k] || 0) : Math.max(Number(active[k] || 0), Number(seen[k] || 0)));
    const newToday = Number(all.at(-1)?.new_accounts || 0);
    const newYesterday = Number(all.at(-2)?.new_accounts || 0);
    const OPENED_HELP = "게임 서버가 본 사람(로그인·진행 저장·기록 전송, 앱·웹 합산)과 앱이 하루 한 번 보내는 접속 신호 중 큰 쪽. 같은 사람은 한 번만 셉니다.";
    // Each day: people (the larger of the ping and the game server) and the players that existed by the end of it.
    const serverDays = new Map((data.server?.days || []).map((d) => [String(d.day), d]));
    // Owner 2026-11-03 ("dau는 이렇게 측정하는게 맞음?"): the itch web id is new on every page load, so in "전체" the web
    // visits used to count as people. With the web numbers loaded beside it, people = Android·iOS only; web visits stand apart.
    const W = !state.platform && state.web ? state.web : null;
    const webDays = new Map((W?.series || []).map((d) => [String(d.day), d]));
    const preDays = new Map((state.prereg?.days || []).map((d) => [String(d.day), d]));
    const dauDays = new Map((state.dau?.days || []).map((d) => [String(d.day), d]));
    const daily = all.map((r) => {
      const srv = serverDays.get(String(r.day)) || {};
      const w = webDays.get(String(r.day)) || {};
      const dp = dauDays.get(String(r.day)) || {};
      const appDau = Math.max(0, Number(r.dau || 0) - Number(w.dau || 0));
      const pr = preDays.get(String(r.day)) || {};
      return { ...r, people: web ? Number(r.dau || 0) : W ? Number(srv.active || 0) : Math.max(Number(r.dau || 0), Number(srv.active || 0)), players: Number(srv.players || 0),
        dau_itch: Number(dp.web_itch || 0), dau_android: Number(dp.android || 0), dau_ios: Number(dp.ios || 0), dau_other: Number(dp.other || 0),
        visits: Number(w.dau || 0), app_new: Math.max(0, Number(r.new_installs || 0) - Number(w.new_installs || 0)), web_runs: Number(w.runs || 0), app_runs: Math.max(0, Number(r.runs || 0) - Number(w.runs || 0)),
        prereg: Number(pr.n || 0), pre_ko: Number(pr.ko || 0), pre_en: Number(pr.en || 0), pre_ja: Number(pr.ja || 0), pre_zh: Number(pr.zh || 0), pre_de: Number(pr.de || 0) };
    });
    const share = (r) => (r.players > 0 ? Math.round(Math.min(r.people, r.players) / r.players * 100) : null);

    byId("tenkeyOverviewNotice").hidden = !noSignal && !web;
    byId("tenkeyOverviewNotice").textContent = web ? "웹(itch)은 게임 페이지를 열 때마다 새 익명 번호를 씁니다. 그래서 ‘앱을 연 사람’은 방문 수, ‘새로 설치’는 새 방문 수이고, 다시 온 비율은 셀 수 없습니다. 판 수는 판마다 오는 기록으로 셉니다."
      : noSignal ? "지금 테스트 빌드는 하루 접속 신호를 보내지 않아요. 그래서 사람 수는 게임 서버 기록(로그인·진행 저장·기록 전송)으로 셉니다. 설치 수와 판 수는 신호를 보내는 새 빌드가 나가면 채워집니다." : "";
    const P = state.prereg;
    const todayRow = daily.at(-1) || {};
    const yRow = daily.at(-2) || {};
    const preCard = P ? glance("사전예약", num(P.d1), "명", `어제 하루 ${num(P.d1_prev)}명 · 총 ${num(P.total)}명`,
      { tone: "good", help: "houseduck.in/10key에서 사전예약을 마친 사람 (테스트 주소 제외). 언어는 가입한 페이지 언어입니다. 나라는 저장하지 않습니다." }) : "";
    // 다음 날 다시 온 비율 without a "전체" frame (a platform filter, or the itch numbers failed to load). Owner 2026-11-12: the install
    // ping's id is new on every itch page load, so it read 0 %. The accounts the game server saw are used instead: of the accounts first
    // seen in the 7 days up to yesterday, how many came back the next day (server admin_dau: new_* / back_*; android / ios split from v2).
    function returnCard() {
      const help = "처음 들어온 계정 가운데 바로 다음 날 다시 들어온 비율 (게임 서버 로그인 기록 기준, 어제까지 7일). 7일 뒤·30일 뒤 비율은 ‘그래프 더 보기’에 있습니다.";
      const days = state.dau?.days || [];
      if (days.length) {
        const split = Object.hasOwn(days[days.length - 1], "new_android");
        const groups = state.platform === "web_itch" ? ["itch"] : state.platform === "android" ? [split ? "android" : "app"] : state.platform === "ios" ? [split ? "ios" : "app"] : ["itch", "app", "other"];
        let n = 0, k = 0;
        for (let back = 1; back <= 7; back++) for (const g of groups) { n += Number(days[days.length - 1 - back]?.[`new_${g}`] || 0); k += Number(days[days.length - 1 - back]?.[`back_${g}`] || 0); }
        const tail = !split && (state.platform === "android" || state.platform === "ios") ? " · Android+iOS 합계" : "";
        return glance("다음 날 다시 온 비율", n > 0 ? String(Math.round(k / n * 1000) / 10) : "—", n > 0 ? "%" : "", n > 0 ? `어제까지 7일 새 계정 ${num(n)}명 중 ${num(k)}명${tail}` : "어제까지 7일 동안 처음 들어온 계정이 없음", { help });
      }
      return glance("다음 날 다시 온 비율", web ? "—" : retRate(ret.d1), !web && Number(ret.d1?.cohort) > 0 ? "%" : "",
        web ? "계정 기록을 불러오지 못함 (익명 번호는 방문마다 바뀌어 셀 수 없음)" : Number(ret.d1?.cohort) > 0 ? `설치한 ${num(ret.d1.cohort)}명 중 ${num(ret.d1.back)}명` : noSignal ? "새 빌드부터 셈" : "아직 셀 수 없음 (설치 이틀 뒤부터)",
        { help: "2~8일 전에 설치한 기기 가운데 설치한 다음 날 앱을 다시 연 비율. 7일 뒤·30일 뒤 비율은 ‘그래프 더 보기’에 있습니다." });
    }
    if (W) {
      byId("tenkeyGlanceToday").classList.add("is-5");
      byId("tenkeyGlanceToday").innerHTML = [
        glance("플레이어 (DAU)", num(opened("d1")), "명", `itch ${num(todayRow.dau_itch)} · 앱 ${num(todayRow.dau_android + todayRow.dau_ios)} · 기타 ${num(todayRow.dau_other)} (어제 ${num(opened("d1_prev"))})`,
          { help: "오늘 게임 서버가 본 계정 수 (로그인·진행 저장·기록 전송). itch와 앱을 합친 한 사람 한 번 기준입니다. 플랫폼은 그날 보낸 판의 플랫폼, 판이 없으면 평소 플랫폼, 그것도 없으면 기타." }),
        glance("웹 방문 (itch)", num(webActive("d1")), "회", `어제 하루 ${num(webActive("d1_prev"))}회 · 사람 수 아님`,
          { help: "itch.io 브라우저 판을 연 횟수 (약관 동의 뒤). 페이지를 열 때마다 새 익명 번호라서 같은 사람이 두 번 열면 2회입니다. 계정 없이 둘러본 사람도 여기에만 들어갑니다." }),
        glance("플레이", num(runs.d1), "판", `앱 ${num(todayRow.app_runs)} · 웹 ${num(todayRow.web_runs)} (어제 ${num(runs.d1_prev)})`,
          { help: "기기·날마다 앱이 알려준 판 수의 증가분과 판마다 오는 기록 중 큰 쪽. 웹(itch)은 판마다 오는 기록으로 셉니다." }),
        preCard || glance("사전예약", "—", "", "불러오지 못함"),
        crashes > 0
          ? glance("크래시 (24시간)", num(crashes), "건", "크래시 화면에서 확인 →", { tone: "risk", href: "#/tenkey-crashes", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산)." })
          : glance("크래시 (24시간)", "0", "건", "없음", { tone: "good", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산)." }),
      ].join("");
    } else {
    byId("tenkeyGlanceToday").classList.remove("is-5");
    byId("tenkeyGlanceToday").innerHTML = [
        glance("앱을 연 사람", num(opened("d1")), "명", `어제 하루 ${num(opened("d1_prev"))}명${anyPlatform}`,
          { help: `오늘 게임에 들어온 사람. ${OPENED_HELP} 오늘은 아직 끝나지 않은 날이라 어제 하루 전체와 나란히만 보여 줍니다.` }),
        noSignal
          ? glance("새 플레이어", num(newToday), "명", `어제 하루 ${num(newYesterday)}명${anyPlatform}`,
            { help: "오늘 게임 서버에 처음 들어온 사람 (새 계정). 설치 수는 접속 신호를 보내는 새 빌드부터 셉니다." })
          : glance("새로 설치", num(fresh.d1), "명", `어제 하루 ${num(fresh.d1_prev)}명`,
            { help: "이 기기에서 처음 신호를 받은 날 기준. 앱을 지우고 다시 깔면 새 설치로 셉니다." }),
        noSignal
          ? glance("기록을 올린 사람", num(played.d1), "명", "판 수는 새 빌드부터 셈",
            { help: "오늘 이번 주 자기 최고 기록을 넘겨 서버에 기록을 올린 사람. 게임은 최고 기록을 넘긴 판만 서버에 보냅니다. 몇 판 했는지는 접속 신호를 보내는 새 빌드부터 셉니다." })
          : glance("플레이", num(runs.d1), "판", `어제 하루 ${num(runs.d1_prev)}판`,
            { help: "기기·날마다 앱이 알려준 판 수의 증가분(열 때 값과 닫을 때 값의 차이)과 판마다 오는 기록 중 큰 쪽. 웹(itch)은 판마다 오는 기록으로 셉니다." }),
        crashes > 0
          ? glance("크래시 (최근 24시간)", num(crashes), "건", `크래시 화면에서 확인${anyPlatform} →`,
            { tone: "risk", href: "#/tenkey-crashes", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산). 홈 키나 최근 앱에서 끈 것은 세지 않습니다." })
          : glance("크래시 (최근 24시간)", "0", "건", `없음${anyPlatform}`, { tone: "good", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산)." }),
      ].join("");
    }
    const peopleWeek = versus(opened("d7"), opened("d7_prev"), "명");
    const installWeek = noSignal ? versus(week("new_accounts"), weekBefore("new_accounts"), "명") : versus(fresh.d7, fresh.d7_prev, "명");
    const buyWeek = versus(week("purchases"), weekBefore("purchases"), "건");
    if (W) {
      // Owner 2026-11-03: 1일 / 3일 / 7일 show exactly that window (today included), each against the N days just before it.
      const N = state.compare === "d3" ? 3 : state.compare === "w" ? 7 : 1;
      const dauRows = state.dau?.days || [];
      const at = (back, key) => Number(dauRows[dauRows.length - 1 - back]?.[key] || 0);
      const uniq = (back) => (N === 1 ? at(back, "all") : at(back, N === 3 ? "u3" : "u7"));
      const vs = (cur, prev, unit) => {
        const diff = Number(cur || 0) - Number(prev || 0);
        if (!diff) return { note: `앞 ${N}일과 같음`, noteTone: "" };
        return { note: `${diff > 0 ? "▲" : "▼"} 앞 ${N}일보다 ${num(Math.abs(diff))}${unit} ${diff > 0 ? "많음" : "적음"}`, noteTone: diff > 0 ? "good" : "bad" };
      };
      const sumN = (rows, key, back) => rows.slice(Math.max(0, rows.length - back - N), rows.length - back).reduce((t, r) => t + Number(r[key] || 0), 0);
      const players = uniq(0), playersPrev = uniq(N);
      const visits = sumN(W.series || [], "dau", 0), visitsPrev = sumN(W.series || [], "dau", N);
      const pre = P ? sumN(P.days || [], "n", 0) : null, prePrev = P ? sumN(P.days || [], "n", N) : null;
      const buys = sumN(all, "purchases", 0), buysPrev = sumN(all, "purchases", N);
      // Next-day return: accounts first seen in the N days ending yesterday, and how many came back the day after.
      const cohort = (back, grp) => {
        let n = 0, k = 0;
        for (let i = 1 + back; i <= N + back; i++) { n += at(i, `new_${grp}`); k += at(i, `back_${grp}`); }
        return { n, k };
      };
      const grp = { itch: cohort(0, "itch"), app: cohort(0, "app"), other: cohort(0, "other") };
      const tot = { n: grp.itch.n + grp.app.n + grp.other.n, k: grp.itch.k + grp.app.k + grp.other.k };
      const prevC = ["itch", "app", "other"].map((g) => cohort(N, g)).reduce((t, c) => ({ n: t.n + c.n, k: t.k + c.k }), { n: 0, k: 0 });
      const rate = (c) => (c.n > 0 ? Math.round(c.k / c.n * 1000) / 10 : null);
      const part = (label, c) => `${label} ${c.n > 0 ? `${rate(c)}% (${num(c.k)}/${num(c.n)})` : "—"}`;
      const span = N === 1 ? "어제" : `${N}일 동안 (어제까지)`;
      byId("tenkeyGlanceWeekTitle").textContent = `최근 ${N}일`;
      const sub = byId("tenkeyGlanceWeekTitle").nextElementSibling;
      if (sub) sub.textContent = `오늘 포함 · 화살표는 바로 앞 ${N}일과 비교`;
      const pc = vs(players, playersPrev, "명"), vc = vs(visits, visitsPrev, "회"), bc = vs(buys, buysPrev, "건");
      const prc = P ? vs(pre, prePrev, "명") : { note: "불러오지 못함", noteTone: "" };
      byId("tenkeyGlanceWeek").classList.add("is-5");
      byId("tenkeyGlanceWeek").innerHTML = [
        glance(`플레이어 (${N}일)`, num(players), "명", pc.note, { noteTone: pc.noteTone, help: `최근 ${N}일(오늘 포함) 동안 게임 서버가 본 계정 수 (itch + 앱, 한 사람 한 번). 앞 ${N}일: ${num(playersPrev)}명.` }),
        glance("웹 방문 (itch)", num(visits), "회", vc.note, { noteTone: vc.noteTone, help: `최근 ${N}일 itch.io 브라우저 판을 연 횟수 (사람 수 아님). 앞 ${N}일: ${num(visitsPrev)}회.` }),
        glance("사전예약", P ? num(pre) : "—", P ? "명" : "", prc.note, { noteTone: prc.noteTone, help: `최근 ${N}일(오늘 포함) 사전예약 수. 앞 ${N}일: ${P ? num(prePrev) : "—"}명.` }),
        glance("결제", num(buys), "건", bc.note, { noteTone: bc.noteTone, help: `최근 ${N}일 스토어가 확인한 구매 (환불·테스트 결제 제외). 앞 ${N}일: ${num(buysPrev)}건.` }),
        glance("다음 날 다시 온 비율", rate(tot) === null ? "—" : String(rate(tot)), rate(tot) === null ? "" : "%", `${part("itch", grp.itch)} · ${part("앱", grp.app)}`,
          { help: `${span} 처음 들어온 계정 가운데 다음 날 다시 들어온 비율 (itch + 앱). 전체 ${num(tot.k)}/${num(tot.n)}명, 기타(판 기록 없는 계정) ${grp.other.n > 0 ? `${rate(grp.other)}%` : "—"}. 앞 ${N}일: ${rate(prevC) === null ? "—" : `${rate(prevC)}%`}. 오늘 다시 온 사람은 하루가 끝날 때까지 늘어납니다.` }),
      ].join("");
    } else {
    byId("tenkeyGlanceWeekTitle").textContent = "최근 7일";
    byId("tenkeyGlanceWeek").classList.remove("is-5");
    byId("tenkeyGlanceWeek").innerHTML = [
        glance("앱을 연 사람", num(opened("d7")), "명", `${peopleWeek.note}${anyPlatform}`,
          { noteTone: peopleWeek.noteTone, help: `최근 7일(오늘 포함) 동안 한 번이라도 게임에 들어온 사람. ${OPENED_HELP}` }),
        noSignal
          ? glance("새 플레이어", num(week("new_accounts")), "명", `${installWeek.note}${anyPlatform}`,
            { noteTone: installWeek.noteTone, help: "최근 7일(오늘 포함) 동안 게임 서버에 처음 들어온 사람 (새 계정)." })
          : glance("새로 설치", num(fresh.d7), "명", installWeek.note,
            { noteTone: installWeek.noteTone, help: "최근 7일(오늘 포함) 동안 처음 신호를 보낸 기기 수." }),
        glance("결제", num(week("purchases")), "건", `${buyWeek.note}${anyPlatform}`,
          { noteTone: buyWeek.noteTone, help: "스토어가 확인한 구매 (환불·테스트 결제 제외). Android와 iOS를 합친 숫자입니다." }),
        returnCard(),
      ].join("");
    }

    const today = String(data.today || all.at(-1)?.day || "");
    byId("tenkeyDauWeek").innerHTML = daily.slice(-7).map((r) => {
      const p = share(r);
      const isToday = String(r.day) === today;
      const text = p === null ? "—" : `${p}%`;
      return `<li class="tk-dau-day${isToday ? " is-today" : ""}${p === null ? " is-empty" : ""}" tabindex="0" style="--share:${p ?? 0}%" aria-label="${esc(`${dayLabel(r.day)} ${num(r.people)}명, 그날까지 가입한 ${num(r.players)}명 중 ${text}`)}"
        data-tip="${tip(dayLabel(r.day), [["앱을 연 사람", `${num(r.people)}명`], ["그날까지 가입한 플레이어", `${num(r.players)}명`], ["비율", text]], isToday ? "오늘은 아직 끝나지 않은 날" : "")}">
        <strong>${esc(text)}</strong><span>${r.players > 0 ? `${esc(num(r.people))} / ${esc(num(r.players))}명` : "가입자 없음"}</span><small>${isToday ? "오늘" : esc(dayLabel(r.day))}</small></li>`;
    }).join("");

    const dailyRows = daily.slice(-state.period);
    const dauTips = dailyRows.map((r) => tip(dayLabel(r.day), [["앱을 연 사람", `${num(r.people)}명`], share(r) === null ? null : ["가입한 플레이어 중", `${share(r)}%`],
      ["새 플레이어", `${num(r.new_accounts)}명`], noSignal ? null : ["플레이", `${num(r.runs)}판`]]));
    const dauLine = lineChart(dailyRows, "people", dauTips);
    const newCols = W
      ? columns(dailyRows.map((r) => r.app_new), dailyRows.map((r) => tip(dayLabel(r.day), [["새로 설치 (앱)", `${num(r.app_new)}명`], ["새 계정", `${num(r.new_accounts)}명`]])))
      : columns(rows.map((r) => Number(r.new_installs || 0)), rows.map((r) => tip(dayLabel(r.day), [["새로 설치", `${num(r.new_installs)}명`], ["새 계정", `${num(r.new_accounts)}명`]])));
    const runCols = W
      ? stacked(dailyRows, [{ key: "app_runs", color: COLOR.app }, { key: "web_runs", color: COLOR.web }], dailyRows.map((r) => tip(dayLabel(r.day), [["플레이", `${num(r.runs)}판`], ["앱", `${num(r.app_runs)}판`], ["웹 (itch)", `${num(r.web_runs)}판`]])))
      : columns(rows.map((r) => Number(r.runs || 0)), rows.map((r) => tip(dayLabel(r.day), [["플레이", `${num(r.runs)}판`], ["서버에 남은 기록(신기록)", `${num(r.stored_runs)}판`]])));
    const crashCols = columns(rows.map((r) => Number(r.crashes || 0)), rows.map((r) => tip(dayLabel(r.day), [["크래시", `${num(r.crashes)}건`]])), "is-v2");
    const buyCols = columns(rows.map((r) => Number(r.purchases || 0)), rows.map((r) => tip(dayLabel(r.day), [["결제 완료", `${num(r.purchases)}건`]])));
    const activeTotal = (data.platforms || []).reduce((s, r) => s + r.n, 0);
    const distCard = `<article class="ov-card"><header class="ov-card-head"><h3>누가 쓰나 (7일 동안 앱을 연 기기)</h3></header><div class="overview-drill-body" style="padding:0">${distribution("플랫폼", data.platforms || [], activeTotal, T.fmt.platformName)}${distribution("앱 버전", data.versions || [], activeTotal)}${distribution("언어 (30일)", data.langs || [], 0, (k) => ({ ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어", "?": "기록 없음 (웹)" })[k] || k)}<p class="overview-drill-note">언어는 앱(Android·iOS)만 보냅니다. 웹(itch) 판은 언어를 보내지 않아 ‘기록 없음 (웹)’으로 모이므로, 이 숫자는 앱 사용자의 언어와 따로 봐야 합니다.</p></div></article>`;
    const periods = [7, 30, 90].map((d) => `<button class="overview-switch${d === state.period ? " active" : ""}" type="button" data-tk-period="${d}" aria-pressed="${d === state.period}">${d}일</button>`).join("");
    // Main chart: app users, web visits and pre-registrations day by day on one frame (each line its own colour).
    const mainSeries = [{ key: "people", color: COLOR.app, label: W ? "플레이어 (DAU)" : "앱을 연 사람" }];
    if (W) mainSeries.push({ key: "visits", color: COLOR.web, label: "웹 방문 (itch)" });
    if (P) mainSeries.push({ key: "prereg", color: COLOR.pre, label: "사전예약" });
    const mainTips = dailyRows.map((r) => tip(dayLabel(r.day), [[mainSeries[0].label, `${num(r.people)}명`], W ? ["웹 방문 (itch)", `${num(r.visits)}회`] : null,
      W ? ["  itch / 앱 / 기타", `${num(r.dau_itch)} / ${num(r.dau_android + r.dau_ios)} / ${num(r.dau_other)}명`] : null,
      P ? ["사전예약", `${num(r.prereg)}명`] : null, ["플레이", `${num(r.runs)}판`], W ? ["  앱 / 웹", `${num(r.app_runs)} / ${num(r.web_runs)}판`] : null,
      ["새 플레이어", `${num(r.new_accounts)}명`]], String(r.day) === today ? "오늘은 아직 끝나지 않은 날" : ""));
    const mainLine = multiLine(dailyRows, mainSeries, mainTips);
    let dauHtml = "";
    if (W && state.dau) {
      const DP = [{ key: "dau_itch", color: COLOR.web, label: "itch" }, { key: "dau_android", color: COLOR.app, label: "Android" }, { key: "dau_ios", color: COLOR.ko, label: "iOS" }, { key: "dau_other", color: COLOR.de, label: "기타" }];
      const dauCols = stacked(dailyRows, DP, dailyRows.map((r) => tip(dayLabel(r.day), [["플레이어 (DAU)", `${num(r.people)}명`], ...DP.map((d) => [d.label, `${num(r[d.key])}명`])], "기타: 로그인·저장만 하고 판을 보내지 않은 계정")));
      dauHtml = `<article class="ov-card is-wide"><header class="ov-card-head"><h3>플레이어 (DAU) 플랫폼별 (${state.period}일)</h3><span class="ov-legend">${DP.map((d) => swatch(d.color, d.label)).join("")}</span></header>
        <figure class="ov-figure" tabindex="0" aria-label="플랫폼별 DAU"><div class="ov-plot has-y">${dauCols.plot}</div>${xAxis(dailyRows)}</figure></article>`;
    }
    let preHtml = "";
    if (P) {
      const loc = P.by_locale || {};
      const locRows = Object.keys(LANG).map((k) => ({ key: k, n: Number(loc[k] || 0) })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n);
      const parts = ["ko", "en", "ja", "zh", "de"].map((k) => ({ key: `pre_${k}`, color: COLOR[k] }));
      const preTips = dailyRows.map((r) => tip(dayLabel(r.day), [["사전예약", `${num(r.prereg)}명`], ...["ko", "en", "ja", "zh", "de"].filter((k) => r[`pre_${k}`] > 0).map((k) => [LANG[k], `${num(r[`pre_${k}`])}명`]),
        W && r.visits > 0 ? ["웹 방문 100회당", `${(r.prereg / r.visits * 100).toFixed(1)}명`] : null]));
      const preCols = stacked(dailyRows, parts, preTips);
      const last = P.last_at ? new Date(P.last_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
      const visit7 = W ? webActive("d7") : 0;
      const facts = [["총 사전예약", `${num(P.total)}명`], ["오늘", `${num(P.d1)}명`], ["최근 7일", `${num(P.d7)}명`], ["마지막 가입", last],
        W ? ["웹 방문 100회당 (7일, 참고)", visit7 > 0 ? `${(P.d7 / visit7 * 100).toFixed(1)}명` : "—"] : null, ["수신 거부", `${num(P.unsubscribed)}명`]]
        .filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
      preHtml = `<article class="ov-card is-wide tk-prereg-card">
        <header class="ov-card-head"><h3>사전예약 (${state.period}일)</h3><span class="ov-legend">${["ko", "en", "ja", "zh", "de"].map((k) => swatch(COLOR[k], LANG[k])).join("")}</span></header>
        <div class="lab-facts tk-more-facts">${facts}</div>
        <figure class="ov-figure" tabindex="0" aria-label="날마다 사전예약"><div class="ov-plot has-y">${preCols.plot}</div>${xAxis(dailyRows)}</figure>
        <div class="overview-drill-body" style="padding:0">${distribution("가입한 페이지 언어 (전체)", locRows, Number(P.total || 0), (k) => LANG[k] || k)}</div>
        <p class="overview-drill-note">‘웹 방문 100회당’은 사전예약 전체(광고·SNS·웹 포함)를 itch 방문 수로 나눈 참고값입니다. 언어는 가입한 페이지 기준입니다. 중국어(번체) 페이지는 11-04에 생겼고, 그 전 대만·홍콩 가입은 영어 페이지에서 받아 영어로 남아 있습니다(나라는 저장하지 않음).</p></article>`;
    }
    byId("tenkeyOverviewCharts").innerHTML = `<article class="ov-card is-wide">
      <header class="ov-card-head"><h3>날마다 한눈에</h3><span class="ov-legend">${mainSeries.map((sr) => swatch(sr.color, sr.label)).join("")}</span><div class="overview-segment" role="group" aria-label="그래프 기간">${periods}</div></header>
      <figure class="ov-figure" tabindex="0" aria-label="날마다 플레이어, 웹 방문, 사전예약"><div class="ov-plot has-y">${mainLine.plot}</div>${xAxis(dailyRows)}</figure></article>${dauHtml}${preHtml}`;
    const facts = [
      ["30일 동안 앱을 연 사람", `${num(opened("d30"))}명`], ["지금까지 설치", W ? `${num(Math.max(0, Number(fresh.all || 0) - Number(state.web?.new_installs?.all || 0)))}명 (앱)` : `${num(fresh.all)}명`], ["전체 계정", `${num(totals.accounts)}개`],
      noSignal ? ["7일 동안 기록을 올린 사람", `${num(played.d7)}명`] : ["7일 동안 플레이", `${num(runs.d7)}판`], ["7일 뒤 다시 온 비율", retRow(ret.d7)], ["30일 뒤 다시 온 비율", retRow(ret.d30)],
    ].map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("");
    byId("tenkeyOverviewMoreCharts").innerHTML = [
      `<div class="lab-facts tk-more-facts">${facts}</div>`,
      card(`새로 설치 (${state.period}일)`, key("", "bar", W ? "앱 기기만 (웹 방문 제외)" : "처음 신호를 받은 기기"), newCols.plot, rows, true, waiting),
      card(`플레이 (${state.period}일)`, W ? swatch(COLOR.app, "앱") + swatch(COLOR.web, "웹 (itch)") : key("", "bar", "신호와 판 기록 중 큰 쪽"), runCols.plot, rows, true, waiting),
      distCard,
      card(`크래시 (${state.period}일)`, key("is-v2", "bar", "보고 + 반복 횟수"), crashCols.plot, rows, false, ""),
      card(`결제 완료 (${state.period}일)`, key("", "bar", "스토어 확인된 구매"), buyCols.plot, rows, false, ""),
    ].join("");

    byId("tenkeyOverviewServer").innerHTML = [
      ["플레이어 (서버)", num(totals.players)], ["정지", num(totals.banned)], ["서버에 남은 판", num(totals.stored_runs)],
      ["게시 중 공지", num(totals.notices_live)], ["30일 결제", num(totals.purchases_30d)],
      ["10KEY 표 크기", bytes(totals.tenkey_bytes)], ["공용 DB 전체", `${bytes(totals.db_bytes)} / 500 MB`],
    ].map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("");
    byId("tenkeyOverviewNotes").innerHTML = [
      "접속자는 Android·iOS 앱에서 게스트 계정을 만든 플레이어가 하루 한 번 보내는 신호(무작위 설치 번호, 플랫폼, 버전, 언어)로 셉니다. 계정 번호나 기기 이름은 받지 않습니다.",
      "이 신호는 10월 23일 이후 빌드부터 보냅니다 (테스트 빌드 1.0.0은 보내지 않음). 그래서 ‘앱을 연 사람’은 게임 서버가 날마다 본 사람(로그인·진행 저장·기록 전송, 앱·웹 합산)과 신호 중 큰 쪽을 보여 주고, 신호가 하나도 없는 동안은 설치·판 수 대신 새 플레이어·기록을 올린 사람을 보여 줍니다. 서버의 날짜별 기록은 10월 22일(테스트 시작)부터 있습니다.",
      "‘전체’ 화면의 플레이어(DAU)는 게임 서버가 그날 본 계정 수입니다 (itch + 앱, 한 사람 한 번, 2026-11-03부터). itch 익명 신호는 페이지를 열 때마다 새 번호라 ‘웹 방문’으로 따로 보여 줍니다 (계정 없이 둘러본 사람 포함). 최근 7일 DAU의 %는 그날 플레이어 ÷ 그날까지 가입한 플레이어 수입니다. 게임은 이번 주 최고 기록을 넘긴 판만 서버에 보내므로, ‘기록을 올린 사람’은 플레이한 사람 전체보다 적습니다.",
      "웹(itch.io)은 첫 화면에서 이용약관·개인정보 처리방침에 동의한 뒤에만 신호(페이지를 열 때마다 새로 만드는 익명 번호, 버전)와 판마다의 기록을 보냅니다. 계정·닉네임은 없습니다. 전체 숫자에도 들어가지만 ‘다시 온 비율’에서는 빠집니다.",
      "웹(CrazyGames)은 로그인하지 않은 사람에게 식별 번호를 만들지 않는 규칙이라 접속자 집계에서 빠집니다. 웹 플레이어는 랭킹 서버에 올라온 사람만 '플레이어'에서 보입니다.",
      "날짜는 베를린 시간 기준(Quirky Ball 한눈 요약과 같음). 14세 미만이나 계정을 만들기 전 사용자는 신호를 보내지 않습니다.",
      "사전예약 숫자는 tenkey-console-stats 함수가 사전예약 표에서 개수만 읽어 옵니다 (주소는 받지 않음, 테스트 주소 제외). 날짜는 베를린 기준이라 다른 보고서와 하루 경계가 다를 수 있습니다.",
      "서버에서 신호 수집을 끄는 스위치: tenkey_private.ops_flags.ping_on (꺼지면 앱이 하루 쉽니다).",
    ].map((t) => `<li>${esc(t)}</li>`).join("");
    byId("tenkeyOverviewStatus").textContent = `집계 ${new Date(data.as_of).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 베를린 ${data.today}`;
  }

  async function load() {
    if (state.busy) return;
    state.busy = true;
    const section = byId("tenkeyOverview");
    section.setAttribute("aria-busy", "true");
    T.setMessage("tenkeyOverviewMessage", "");
    byId("tenkeyOverviewStatus").textContent = "불러오는 중";
    try {
      // The itch web numbers come from tenkey-console-stats ("overview.web"): the deployed tenkey-admin refuses platform
      // web_itch (found 2026-11-03), which also left the 웹(itch) filter empty.
      const webCall = () => root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "overview.web", params: { days: 90 } });
      const [result, webResult, preResult, dauResult] = await Promise.all([
        state.platform === "web_itch" ? webCall() : T.call("overview.get", { days: 90, platform: state.platform || undefined }),
        state.platform ? Promise.resolve(null) : webCall().catch(() => null),
        root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "prereg.get", params: { days: 90 } }).catch(() => null),
        root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "dau.get", params: { days: 90 } }).catch(() => null),
      ]);
      state.dau = dauResult?.data || null;
      state.data = result.data;
      state.web = webResult?.data || null;
      state.prereg = preResult?.data || null;
      render(state.data);
    } catch (error) {
      byId("tenkeyOverviewStatus").textContent = "불러오지 못함";
      T.report("tenkeyOverviewMessage", error);
    } finally {
      section.setAttribute("aria-busy", "false");
      state.busy = false;
    }
  }

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach((button) => {
      const on = button.getAttribute(attr) === String(value);
      button.setAttribute("aria-pressed", String(on));
      button.classList.toggle("active", on);
    });
  }

  function mountOverview() {
    if (!state.bound) {
      state.bound = true;
      const section = byId("tenkeyOverview");
      bindTips(section);
      section.addEventListener("click", (event) => {
        const period = event.target.closest("[data-tk-period]");
        const platform = event.target.closest("[data-tk-platform]");
        const compare = event.target.closest("[data-tk-compare]");
        if (compare) {
          state.compare = compare.dataset.tkCompare;
          setPressed("[data-tk-compare]", "data-tk-compare", state.compare);
          if (state.data) render(state.data);
        } else if (period) {
          state.period = Number(period.dataset.tkPeriod);
          setPressed("[data-tk-period]", "data-tk-period", state.period);
          if (state.data) render(state.data);
        } else if (platform) {
          state.platform = platform.dataset.tkPlatform;
          setPressed("[data-tk-platform]", "data-tk-platform", state.platform);
          load();
        }
      });
      byId("tenkeyOverviewRefresh").addEventListener("click", load);
      setPressed("[data-tk-period]", "data-tk-period", state.period);
      setPressed("[data-tk-platform]", "data-tk-platform", state.platform);
      setPressed("[data-tk-compare]", "data-tk-compare", state.compare);
    }
    load();
    // Owner 2026-10-24: new players show up without a reload. Every minute while the overview is on screen and the tab
    // is visible; stops by itself when the admin leaves the page (the section leaves the layout).
    clearInterval(state.auto);
    state.auto = setInterval(() => {
      const section = byId("tenkeyOverview");
      if (!section || !section.offsetParent) { clearInterval(state.auto); return; }
      if (!document.hidden) load();
    }, 60000);
  }

  T.mountOverview = mountOverview;
})(window);
