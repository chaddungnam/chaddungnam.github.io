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
  // Owner 2026-11-24 (both stores released that morning): "사전예약 관련 정보는 내리고, dau 통계도 모바일 (aos ios 기준으로 다시 잡고
  // 보여줄래? itch는 참고그래프로 보이게 별도로 두고". The default view (data-tk-platform "") is now the mobile app: DAU, the 7-day DAU %,
  // the N-day players and the next-day return count Android + iOS accounts only (server tenkey.admin_dau_v3: mobile, u3_mobile /
  // u7_mobile, players_mobile); itch accounts and anonymous itch visits sit in their own reference chart. Pre-registration is gone
  // from the page (closed at launch).
  // Owner 2026-11-24 afternoon ("48명의 유저 근거가 궁금함 ... 논리적으로 전체맥락을 따져서"): the DAU % counts store players only
  // (mobile accounts first seen on / after the launch day, server launch_day), never the closed-test / TestFlight accounts;
  // and ("게임 설치가 곧 결제일텐데, 그거 안잡히는거도 이상하고"): the stores' own sales reports sit beside the in-app 결제
  // (tenkey-console-stats store.get), because the game server never sees a paid download.
  const state = { bound: false, period: 7, platform: "", data: null, web: null, dau: null, store: null, reviews: null, compare: "d1", busy: false };
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
  // Dark console theme, round 2 (owner 2026-11-24): Google's dark palette tones (desaturated for a dark page). Blue = mobile DAU
  // and Android, purple = iOS / App Store, green = installs / Google Play.
  const COLOR = { app: "#8ab4f8", web: "#fcad70", pre: "#81c995", ko: "#c58af9", en: "#81c995", ja: "#fcad70", de: "#9aa0a6", zh: "#ff8bcb" };
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

  // 앱 판매 (스토어 보고서): paid downloads per store day from the stores' own reports, beside the in-app 결제. Until a store
  // can be read it says what is missing (Play: the service account's report access; App Store: an API key).
  const STORE_NAME = { google: "Google Play", apple: "App Store" };
  const STORE_WHY = (note) => {
    const n = String(note || "");
    if (n.startsWith("store_permission")) return `연결 대기: Play Console에서 서비스 계정(${n.split(": ")[1] || "play-purchase-verify"})에 보고서 권한 필요`;
    if (n.startsWith("apple_not_configured")) return "연결 대기: App Store Connect API 키(판매 권한) 필요";
    if (n.startsWith("apple_permission")) return "연결 대기: API 키에 판매(Sales) 권한 필요";
    return n ? `불러오지 못함 (${n})` : "아직 불러오지 않음";
  };
  // Owner 2026-11-25 ("애플 신규유저는 그 판매데이터에 기반하지 말고, 신규 ios 유저 닉네임이 생성되면 그걸로 통계잡으면 되잖아 (aos도
  // 마찬가지고) 실제 구매 기록만 보여주고, 아직 갱신되지 않았지만 신규유저가 잡힘으로써 예상치도 추정해볼 수 있고"): 확정 = the stores' own
  // reports only; 새 유저 = accounts that made their nickname from the launch day (store.get v2 new_accounts, per Pacific day);
  // 예상 = a settled day's confirmed sales, else the larger of what the report has so far and that day's new users. A day is
  // settled per report_days (App Store: noon PT the next day, Google Play: three Pacific days later; hexaworld 20261125160000).
  const STORE_PLAT = { apple: "ios", google: "android" };
  const STORE_USER = { apple: "iOS", google: "Android" };
  function storeEstimate(S) {
    const launch = String(S.launch_pt || "");
    const pToday = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const todayPt = new Date(Date.UTC(pToday.getFullYear(), pToday.getMonth(), pToday.getDate())).toISOString().slice(0, 10);
    const final = new Set((S.report_days || []).filter((r) => r.final).map((r) => `${r.store}|${r.day}`));
    const conf = new Map(), fresh = new Map();
    for (const r of S.days || []) if (r.day >= launch) conf.set(`${r.store}|${r.day}`, (conf.get(`${r.store}|${r.day}`) || 0) + Number(r.app_units || 0));
    for (const r of S.new_accounts || []) for (const k of ["apple", "google"]) fresh.set(`${k}|${r.day}`, Number(r[STORE_PLAT[k]] || 0));
    const days = [];
    if (launch) for (let d = new Date(`${launch}T00:00:00Z`); d.toISOString().slice(0, 10) <= todayPt; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
    const per = {};
    for (const k of ["apple", "google"]) {
      const e = { confirmed: 0, fresh: 0, estimate: 0, pendingFresh: 0, through: "", firstPending: "", byDay: new Map() };
      for (const d of days) {
        const c = conf.get(`${k}|${d}`) || 0, f = fresh.get(`${k}|${d}`) || 0, done = final.has(`${k}|${d}`);
        const est = done ? c : Math.max(c, f);
        e.confirmed += c; e.fresh += f; e.estimate += est;
        if (!done) { e.pendingFresh += f; if (!e.firstPending) e.firstPending = d; } else if (!e.firstPending) e.through = d;
        e.byDay.set(d, { c, f, done, extra: est - c });
      }
      per[k] = e;
    }
    return { launch, days, per };
  }
  function storeCard(S, period) {
    if (!S) return `<article class="ov-card is-wide tk-store-card"><header class="ov-card-head"><h3>앱 판매 (스토어 보고서)</h3></header><p class="overview-drill-note">스토어 보고서를 불러오지 못했습니다.</p></article>`;
    const sync = new Map((S.sync || []).map((x) => [x.store, x]));
    const E = S.launch_pt ? storeEstimate(S) : null;
    const pdays = (() => { const out = []; const end = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })); for (let i = period - 1; i >= 0; i--) { const d = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() - i)); out.push(d.toISOString().slice(0, 10)); } return out; })();
    const byDay = new Map();
    for (const r of S.days || []) { const e = byDay.get(r.day) || { day: r.day, google: 0, apple: 0, iap: 0 }; e[r.store] += Number(r.app_units || 0); e.iap += Number(r.iap_units || 0); byDay.set(r.day, e); }
    const rows = pdays.map((d) => {
      const r = { ...(byDay.get(d) || { day: d, google: 0, apple: 0, iap: 0 }) };
      const a = E?.per.apple.byDay.get(d), g = E?.per.google.byDay.get(d);
      r.extra = (a?.extra || 0) + (g?.extra || 0); r.ios = a?.f || 0; r.android = g?.f || 0; r.wait = Boolean(E && ((a && !a.done) || (g && !g.done)));
      return r;
    });
    const parts = [{ key: "google", color: COLOR.en, label: "Google Play (확정)" }, { key: "apple", color: COLOR.ko, label: "App Store (확정)" }];
    if (E) parts.push({ key: "extra", color: COLOR.de, label: "예상 (보고서 대기)" });
    const cols = stacked(rows, parts, rows.map((r) => tip(dayLabel(r.day), [["확정 판매", `${num(r.google + r.apple)}건`], ["Google Play", `${num(r.google)}건`], ["App Store", `${num(r.apple)}건`],
      E ? ["새 유저 (닉네임)", `Android ${num(r.android)} · iOS ${num(r.ios)}`] : null, E && r.extra ? ["예상 추가 (보고서 대기)", `${num(r.extra)}건`] : null,
      ["인앱 (스토어 보고서)", `${num(r.iap)}건`]], `스토어 날짜 (미국 태평양 시간)${r.wait ? " · 아직 확정 안 된 날" : ""}`)));
    const at = (x) => (x?.synced_at ? new Date(x.synced_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
    const why = (k) => {
      const x = sync.get(k);
      if (x?.ok) return "";
      return String(x?.note || "").startsWith("store_permission") && k === "google" ? "보고서 연결 대기 (권한 부여됨 11-24, Google 쪽 반영 대기)" : STORE_WHY(x?.note);
    };
    let status;
    if (E) {
      const tile = (k) => {
        const e = E.per[k], x = sync.get(k), w = why(k);
        const conf = w ? `확정 — · ${w}` : `확정 ${num(e.confirmed)}건${e.through ? ` · ${shortDay(e.through)}까지 보고서` : " · 아직 확정된 날 없음"}${at(x) ? ` · ${at(x)} 확인` : ""}`;
        const wait = e.firstPending ? `${shortDay(e.firstPending)}부터 보고서 대기 · 그동안 새 ${STORE_USER[k]} 유저 ${num(e.pendingFresh)}명` : "보고서 모두 확정";
        return `<div data-store="${k}"><dt>${esc(STORE_NAME[k])} 예상</dt><dd><span class="tk-store-est">${esc(num(e.estimate))}건</span><span class="tk-sub">${esc(conf)}</span><span class="tk-sub">${esc(wait)}</span><span class="tk-sub">출시 후 새 ${esc(STORE_USER[k])} 유저 ${esc(num(e.fresh))}명 (닉네임 기준)</span></dd></div>`;
      };
      const A = E.per.apple, G = E.per.google;
      status = tile("apple") + tile("google") + `<div data-store="all"><dt>합계 예상</dt><dd><span class="tk-store-est">${esc(num(A.estimate + G.estimate))}건</span><span class="tk-sub">${esc(`확정 ${num(A.confirmed + G.confirmed)}건 · 새 유저 ${num(A.fresh + G.fresh)}명`)}</span><span class="tk-sub">${esc(`출시(베를린 ${shortDay(new Date(Date.parse(`${E.launch}T00:00:00Z`) + 86400000).toISOString().slice(0, 10))}) 이후`)}</span></dd></div>`;
    } else {
      const last = (store) => (S.days || []).filter((r) => r.store === store).map((r) => r.day).sort().at(-1);
      status = ["google", "apple"].map((k) => {
        const x = sync.get(k);
        const total = Number(S.totals?.[`${k}_app`] || 0);
        const v = x?.ok ? `누적 ${num(total)}건 · ${at(x)} 확인${last(k) ? ` (판매 있는 마지막 날 ${shortDay(last(k))})` : " (아직 판매 기록 없음)"}` : why(k);
        return `<div><dt>${esc(STORE_NAME[k])}</dt><dd>${esc(v)}</dd></div>`;
      }).join("");
    }
    const any = rows.some((r) => r.google + r.apple + r.iap + (r.extra || 0) > 0);  // an all-zero chart says nothing: the tiles above do
    return `<article class="ov-card is-wide tk-store-card">
      <header class="ov-card-head"><h3>앱 판매 (스토어 보고서 + 예상, ${period}일)</h3><span class="ov-legend">${parts.map((p) => swatch(p.color, p.label)).join("")}</span></header>
      <div class="lab-facts tk-more-facts">${status}</div>
      ${any ? `<figure class="ov-figure" tabindex="0" aria-label="날마다 앱 판매"><div class="ov-plot has-y">${cols.plot}</div>${xAxis(rows)}</figure>` : ""}
      <p class="overview-drill-note">${E ? "확정은 스토어 보고서에 잡힌 판매만 셉니다. 새 유저는 출시 뒤 Android·iOS 앱에서 닉네임을 새로 만든 계정입니다 (테스트·심사 계정 제외). 예상은 확정된 날은 확정 판매, 보고서가 아직 확정되지 않은 날은 그날 새 유저 수(보고서에 이미 잡힌 게 더 많으면 그 수)로 셉니다. App Store는 다음 날 정오(태평양, 베를린 21시)부터, Google Play는 3일 뒤부터 확정으로 봅니다. 사고 나서 닉네임을 안 만들었거나, 한 사람이 기기를 바꿔 새로 만든 경우는 어긋나므로 추정치입니다. " : ""}유료 앱이라 스토어 다운로드 1건이 곧 판매 1건이고, 날짜는 미국 태평양 날짜입니다. 실시간 확인은 Play Console 주문 관리 · App Store Connect 판매 및 추세.</p></article>`;
  }

  // 스토어 평점·리뷰 (owner 2026-11-24 night, long-term operation): App Store stars per storefront (every rating, from the public
  // lookup), the written reviews of both stores (Play keeps about a week), which ones have no reply yet, and where to answer.
  const STAR = (n) => "★★★★★".slice(0, Math.max(0, Math.min(5, n))) + "☆☆☆☆☆".slice(0, 5 - Math.max(0, Math.min(5, n)));
  const REPLY_URL = { apple: "https://appstoreconnect.apple.com/apps/6824972492/distribution/activity/ios/ratingsResponses",
    google: "https://play.google.com/console/u/0/developers/6859298164484039460/app/4975178648682924098/user-feedback/reviews" };
  // Every review opens its store page, answered or not (owner 2026-11-25: "이미 답했더라도, 스토어 리뷰 페이지 진입가능하게"):
  // Play Console opens the review itself (review-details?reviewId=, checked 11-25), App Store Connect its 평가 및 리뷰 list.
  const reviewUrl = (r) => (r.store === "google" && r.review_id
    ? `${REPLY_URL.google.replace(/\/reviews$/, "/review-details")}?reviewId=${encodeURIComponent(r.review_id)}&corpus=PUBLIC_REVIEWS`
    : REPLY_URL[r.store] || REPLY_URL.google);
  // 나라별 (owner 2026-11-24 night: "스토어 별점리뷰 출시국가별로 모아서"): App Store stars per storefront (every storefront in turn,
  // about a day per round), Google Play's country average once its report is readable, and the written reviews per country.
  const REGION = (() => { try { return new Intl.DisplayNames(["ko"], { type: "region" }); } catch (_e) { return null; } })();
  const LANGN = (() => { try { return new Intl.DisplayNames(["ko"], { type: "language" }); } catch (_e) { return null; } })();
  const placeName = (code) => {
    const c = String(code || "");
    if (c.startsWith("lang:")) return `${(LANGN && c.slice(5) !== "?" ? LANGN.of(c.slice(5)) : c.slice(5)) || c.slice(5)} (언어)`;
    try { return (REGION && /^[A-Z]{2}$/.test(c) ? REGION.of(c) : c) || c; } catch (_e) { return c; }
  };
  function countryTable(R) {
    const byC = new Map();
    const row = (c) => { if (!byC.has(c)) byC.set(c, { c }); return byC.get(c); };
    for (const r of R.ratings || []) Object.assign(row(r.country), r.store === "apple" ? { a: r } : { g: r });
    for (const x of R.countries || []) row(x.country).rv = x;
    const rows = [...byC.values()].sort((x, y) => (Number(y.a?.count || 0) - Number(x.a?.count || 0)) || (Number(y.rv?.reviews || 0) - Number(x.rv?.reviews || 0)) || x.c.localeCompare(y.c));
    if (!rows.length) return `<p class="overview-drill-note">나라별 평점이 아직 없습니다. App Store는 나라마다 차례로 확인 중입니다 (지금까지 ${esc(num(R.checked || 0))}개 나라 확인).</p>`;
    const star = (x) => (x && Number(x.average) > 0 ? `★ ${Number(x.average).toFixed(2)}` : "—");
    return `<div class="table-scroll tk-country-table"><table><thead><tr><th>나라</th><th class="tk-num">App Store 평점</th><th class="tk-num">Google Play 평점</th><th class="tk-num">글 리뷰</th><th class="tk-num">답 안 함</th><th>마지막 리뷰</th></tr></thead><tbody>${rows.map((x) => `<tr>
      <td data-label="나라">${esc(placeName(x.c))}<span class="tk-sub">${esc(x.c.replace("lang:", ""))}</span></td>
      <td data-label="App Store 평점" class="tk-num">${esc(star(x.a))}${x.a ? `<span class="tk-sub">${esc(num(x.a.count))}개${Number(x.a.prev_count ?? x.a.count) < Number(x.a.count) ? ` · +${esc(num(Number(x.a.count) - Number(x.a.prev_count)))}` : ""}</span>` : ""}</td>
      <td data-label="Google Play 평점" class="tk-num">${esc(star(x.g))}</td>
      <td data-label="글 리뷰" class="tk-num">${x.rv ? `${esc(num(x.rv.reviews))}<span class="tk-sub">★ ${esc(Number(x.rv.average).toFixed(1))}</span>` : "—"}</td>
      <td data-label="답 안 함" class="tk-num">${x.rv ? esc(num(x.rv.unanswered)) : "—"}</td>
      <td data-label="마지막 리뷰">${x.rv?.last_at ? esc(new Date(x.rv.last_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })) : "—"}</td></tr>`).join("")}</tbody></table></div>
      <p class="overview-drill-note">App Store는 별점만 준 것까지 포함한 나라별 공개 값이고, 나라마다 차례로 확인합니다 (지금까지 ${esc(num(R.checked || 0))}개 나라 확인, 하루쯤에 한 바퀴). Google Play 나라별 평점은 Play 보고서 권한이 반영되면 채워집니다. 글 리뷰는 App Store는 리뷰를 쓴 나라, Google Play는 리뷰 언어(지역이 붙어 있으면 그 지역)로 묶습니다.</p>`;
  }

  function reviewsCard(R) {
    if (!R) return "";
    const ratings = (R.ratings || []).filter((r) => r.store === "apple");
    const n = ratings.reduce((t, r) => t + Number(r.count || 0), 0);
    const avg = n > 0 ? ratings.reduce((t, r) => t + Number(r.average || 0) * Number(r.count || 0), 0) / n : null;
    const grew = ratings.reduce((t, r) => t + Math.max(0, Number(r.count || 0) - Number(r.prev_count ?? r.count ?? 0)), 0);
    const stat = (store) => (R.stats || []).find((x) => x.store === store) || null;
    const g = stat("google"), a = stat("apple");
    const top = ratings.filter((r) => Number(r.count) > 0).slice(0, 3).map((r) => `${placeName(r.country)} ${Number(r.average).toFixed(1)} (${num(r.count)})`).join(" · ");
    const facts = [
      ["App Store 평점", avg === null ? "아직 평점 없음" : `${avg.toFixed(2)} · ${num(n)}개${grew ? ` (어제보다 +${num(grew)})` : ""}`],
      ["평점 있는 나라", top ? `${num(ratings.filter((r) => Number(r.count) > 0).length)}개 · ${top}` : "아직 없음"],
      ["리뷰 (글)", `App Store ${num(a?.reviews || 0)} · Google Play ${num(g?.reviews || 0)}`],
      ["답 안 한 리뷰", `${num(Number(a?.unanswered || 0) + Number(g?.unanswered || 0))}개`],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    const list = (R.reviews || []).slice(0, 6).map((r) => {
      const where = [r.store === "apple" ? "App Store" : "Google Play", r.territory ? placeName(r.territory) : r.lang ? placeName(`lang:${String(r.lang).split("_")[0]}`) : "", r.app_version, new Date(r.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })].filter(Boolean).join(" · ");
      return `<li class="tk-review"><div class="tk-review-head"><span class="tk-review-stars" aria-label="별 ${esc(r.rating)}개" data-low="${Number(r.rating) <= 2}">${esc(STAR(Number(r.rating)))}</span>
        <span class="tk-sub">${esc(where)}</span>${r.reply ? '<span class="tk-badge" data-tone="good">답함</span>' : ""}<a class="tk-badge" data-tone="${r.reply ? "quiet" : "watch"}" href="${esc(reviewUrl(r))}" target="_blank" rel="noopener">${r.reply ? "스토어에서 보기" : "답하기"}</a></div>
        ${r.title ? `<strong>${esc(r.title)}</strong>` : ""}<p>${esc(r.body || "(내용 없음)")}</p></li>`;
    }).join("");
    const sync = (R.sync || []).filter((x) => !x.ok).map((x) => `${x.store.startsWith("apple") ? "App Store" : "Google Play"} 리뷰를 불러오지 못함 (${x.note || "—"})`).join(" · ");
    return `<article class="ov-card is-wide tk-reviews-card">
      <header class="ov-card-head"><h3>스토어 평점 · 리뷰</h3><span class="ov-legend"><a href="${REPLY_URL.apple}" target="_blank" rel="noopener">App Store Connect</a> · <a href="${REPLY_URL.google}" target="_blank" rel="noopener">Play Console</a></span></header>
      <div class="lab-facts tk-more-facts">${facts}</div>
      <h4 class="tk-card-sub">나라별</h4>
      ${countryTable(R)}
      <h4 class="tk-card-sub">최근 리뷰</h4>
      ${list ? `<ul class="tk-review-list">${list}</ul>` : '<p class="overview-drill-note">아직 글로 쓴 리뷰가 없습니다.</p>'}
      <p class="overview-drill-note">리뷰는 글이 있는 것만 오며, Google Play는 최근 약 1주일 것만 API로 받습니다. 스토어 판매와 함께 3시간마다 새로 읽습니다.${sync ? ` ${esc(sync)}.` : ""}</p></article>`;
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
    // The mobile view (owner 2026-11-24) needs the web numbers (to take itch out of runs and installs) and the account DAU. Without
    // them the page keeps the plain four-card layout. people = mobile accounts (Android + iOS), players = mobile accounts so far.
    const W = !state.platform && state.web && state.dau ? state.web : null;
    const webDays = new Map((W?.series || []).map((d) => [String(d.day), d]));
    const dauDays = new Map((state.dau?.days || []).map((d) => [String(d.day), d]));
    const daily = all.map((r) => {
      const srv = serverDays.get(String(r.day)) || {};
      const w = webDays.get(String(r.day)) || {};
      const dp = dauDays.get(String(r.day)) || {};
      const mobile = Object.hasOwn(dp, "mobile") ? Number(dp.mobile || 0) : Number(dp.android || 0) + Number(dp.ios || 0);
      return { ...r, people: web ? Number(r.dau || 0) : W ? mobile : Math.max(Number(r.dau || 0), Number(srv.active || 0)),
        players: W ? Number(dp.players_mobile || 0) : Number(srv.players || 0),
        dau_itch: Number(dp.web_itch || 0), dau_android: Number(dp.android || 0), dau_ios: Number(dp.ios || 0), dau_other: Number(dp.other || 0),
        new_mobile: Number(dp.new_app || 0), players_itch: Number(dp.players_itch || 0),
        launch: Number(dp.mobile_launch || 0), tester: Number(dp.mobile_tester || 0), players_launch: Number(dp.players_launch || 0),
        visits: Number(w.dau || 0), app_new: Math.max(0, Number(r.new_installs || 0) - Number(w.new_installs || 0)), web_runs: Number(w.runs || 0), app_runs: Math.max(0, Number(r.runs || 0) - Number(w.runs || 0)) };
    });
    const share = (r) => (r.players > 0 ? Math.round(Math.min(r.people, r.players) / r.players * 100) : null);
    // Launch view: before the launch day there were only testers; from it, store players over store players so far.
    const launchDay = String(state.dau?.launch_day || "");
    const launched = (r) => W && launchDay && String(r.day) >= launchDay;
    const launchShare = (r) => (r.players_launch > 0 ? Math.round(Math.min(r.launch, r.players_launch) / r.players_launch * 100) : null);

    byId("tenkeyOverviewNotice").hidden = !noSignal && !web;
    byId("tenkeyOverviewNotice").textContent = web ? "웹(itch)은 게임 페이지를 열 때마다 새 익명 번호를 씁니다. 그래서 ‘앱을 연 사람’은 방문 수, ‘새로 설치’는 새 방문 수입니다. ‘다음 날 다시 온 비율’만은 게임 서버에 로그인한 itch 계정으로 셉니다. 판 수는 판마다 오는 기록으로 셉니다."
      : noSignal ? "지금 테스트 빌드는 하루 접속 신호를 보내지 않아요. 그래서 사람 수는 게임 서버 기록(로그인·진행 저장·기록 전송)으로 셉니다. 설치 수와 판 수는 신호를 보내는 새 빌드가 나가면 채워집니다." : "";
    const todayRow = daily.at(-1) || {};
    const yRow = daily.at(-2) || {};
    const MOBILE_HELP = "모바일 앱(Android·iOS)에서 게임 서버가 본 계정 수 (로그인·진행 저장·기록 전송, 한 사람 한 번). 플랫폼은 그날 보낸 판, 없으면 평소 판, 그것도 없으면 로그인한 기기(앱인지 브라우저인지)로 정합니다. 웹(itch.io·Nekoland·GamePix)은 아래 ‘웹’ 칸에 따로 있습니다.";
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
      byId("tenkeyGlanceToday").classList.remove("is-5");
      byId("tenkeyGlanceToday").innerHTML = [
        glance("모바일 DAU", num(todayRow.people), "명", launchDay ? `출시 후 ${num(todayRow.launch)} · 테스터 ${num(todayRow.tester)} (어제 ${num(yRow.people)})` : `Android ${num(todayRow.dau_android)} · iOS ${num(todayRow.dau_ios)} (어제 ${num(yRow.people)})`,
          { help: `오늘 ${MOBILE_HELP} 출시 후 = ${launchDay || "출시일"}부터 처음 들어온 계정(스토어로 받은 사람), 테스터 = 그 전부터 있던 비공개 테스트·TestFlight 계정. Android ${num(todayRow.dau_android)} · iOS ${num(todayRow.dau_ios)}.` }),
        glance("새로 설치 (앱)", num(todayRow.app_new), "명", `어제 하루 ${num(yRow.app_new)}명 · 판매 수 아님`,
          { help: "Android·iOS 앱이 그 기기에서 처음 접속 신호를 보낸 날 기준 (itch 방문 제외). 지우고 다시 깔거나, 테스터가 깔아도 새 설치로 셉니다. 실제 판매(유료 다운로드)는 아래 ‘앱 판매 (스토어 보고서)’입니다." }),
        glance("플레이 (앱)", num(todayRow.app_runs), "판", `어제 하루 ${num(yRow.app_runs)}판`,
          { help: "Android·iOS 앱의 판 수: 기기·날마다 앱이 알려준 판 수의 증가분과 판마다 오는 기록 중 큰 쪽. itch 판은 빠집니다." }),
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
      const vs = (cur, prev, unit) => {
        const diff = Number(cur || 0) - Number(prev || 0);
        if (!diff) return { note: `앞 ${N}일과 같음`, noteTone: "" };
        return { note: `${diff > 0 ? "▲" : "▼"} 앞 ${N}일보다 ${num(Math.abs(diff))}${unit} ${diff > 0 ? "많음" : "적음"}`, noteTone: diff > 0 ? "good" : "bad" };
      };
      const sumN = (rows, key, back) => rows.slice(Math.max(0, rows.length - back - N), rows.length - back).reduce((t, r) => t + Number(r[key] || 0), 0);
      const mobileUniq = (back) => (N === 1 ? at(back, "mobile") || at(back, "android") + at(back, "ios") : at(back, N === 3 ? "u3_mobile" : "u7_mobile"));
      const players = mobileUniq(0), playersPrev = mobileUniq(N);
      const installs = sumN(daily, "app_new", 0), installsPrev = sumN(daily, "app_new", N);
      const buys = sumN(all, "purchases", 0), buysPrev = sumN(all, "purchases", N);
      // Next-day return: accounts first seen in the N days ending yesterday, and how many came back the day after.
      const cohort = (back, grp) => {
        let n = 0, k = 0;
        for (let i = 1 + back; i <= N + back; i++) { n += at(i, `new_${grp}`); k += at(i, `back_${grp}`); }
        return { n, k };
      };
      const split = Object.hasOwn(dauRows.at(-1) || {}, "new_android");
      const grp = { app: cohort(0, "app"), itch: cohort(0, "itch"), android: split ? cohort(0, "android") : null, ios: split ? cohort(0, "ios") : null };
      const prevApp = cohort(N, "app");
      const rate = (c) => (c.n > 0 ? Math.round(c.k / c.n * 1000) / 10 : null);
      const part = (label, c) => `${label} ${c.n > 0 ? `${rate(c)}% (${num(c.k)}/${num(c.n)})` : "—"}`;
      const span = N === 1 ? "어제" : `${N}일 동안 (어제까지)`;
      byId("tenkeyGlanceWeekTitle").textContent = `최근 ${N}일`;
      const sub = byId("tenkeyGlanceWeekTitle").nextElementSibling;
      if (sub) sub.textContent = `오늘 포함 · 모바일(Android + iOS) · 화살표는 바로 앞 ${N}일과 비교`;
      const pc = vs(players, playersPrev, "명"), ic = vs(installs, installsPrev, "명"), bc = vs(buys, buysPrev, "건");
      byId("tenkeyGlanceWeek").classList.remove("is-5");
      byId("tenkeyGlanceWeek").innerHTML = [
        glance(`모바일 플레이어 (${N}일)`, num(players), "명", pc.note, { noteTone: pc.noteTone, help: `최근 ${N}일(오늘 포함) 동안 ${MOBILE_HELP} 앞 ${N}일: ${num(playersPrev)}명.` }),
        glance("새로 설치 (앱)", num(installs), "명", ic.note, { noteTone: ic.noteTone, help: `최근 ${N}일(오늘 포함) Android·iOS 앱이 처음 접속 신호를 보낸 기기 수 (itch 방문 제외). 앞 ${N}일: ${num(installsPrev)}명.` }),
        glance("인앱 결제", num(buys), "건", bc.note, { noteTone: bc.noteTone, help: `최근 ${N}일 게임 서버가 스토어에서 확인한 인앱 구매 (환불·테스트 결제 제외). 앱 자체 판매(유료 다운로드)는 게임 서버가 볼 수 없어 ‘앱 판매 (스토어 보고서)’에 따로 있습니다. 앞 ${N}일: ${num(buysPrev)}건.` }),
        glance("다음 날 다시 온 비율", rate(grp.app) === null ? "—" : String(rate(grp.app)), rate(grp.app) === null ? "" : "%",
          split ? `${part("Android", grp.android)} · ${part("iOS", grp.ios)}` : `모바일 ${grp.app.n > 0 ? `${num(grp.app.k)}/${num(grp.app.n)}명` : "—"}`,
          { help: `${span} 모바일 앱에서 처음 들어온 계정 가운데 다음 날 다시 들어온 비율. 모바일 ${num(grp.app.k)}/${num(grp.app.n)}명. 앞 ${N}일: ${rate(prevApp) === null ? "—" : `${rate(prevApp)}%`}. 오늘 다시 온 사람은 하루가 끝날 때까지 늘어납니다.` }),
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
    const dauSub = byId("tenkeyDauTitle")?.nextElementSibling;
    if (dauSub) dauSub.textContent = W && launchDay
      ? `출시(${shortDay(launchDay)}) 후 들어온 모바일 계정 중 그날 플레이한 비율 · 출시 전 테스터 계정은 빼고 셈`
      : W ? "그날 모바일 플레이어(계정, Android + iOS) ÷ 그날까지 모바일 앱에서 들어온 계정" : "그날 플레이어(계정) ÷ 그날까지 가입한 플레이어";
    byId("tenkeyDauWeek").innerHTML = daily.slice(-7).map((r) => {
      const isToday = String(r.day) === today;
      if (W && launchDay && !launched(r)) {
        return `<li class="tk-dau-day is-empty${isToday ? " is-today" : ""}" tabindex="0" style="--share:0%" aria-label="${esc(`${dayLabel(r.day)} 출시 전, 테스터 ${num(r.tester)}명`)}"
          data-tip="${tip(dayLabel(r.day), [["출시 전 (테스트 기간)", ""], ["플레이한 테스터 계정", `${num(r.tester)}명`]], "출시 전 날은 비율을 내지 않습니다")}">
          <strong>출시 전</strong><span>테스터 ${esc(num(r.tester))}명</span><small>${isToday ? "오늘" : esc(dayLabel(r.day))}</small></li>`;
      }
      const L = W && launchDay;
      const p = L ? launchShare(r) : share(r);
      const n = L ? r.launch : r.people, d = L ? r.players_launch : r.players;
      const text = p === null ? "—" : `${p}%`;
      return `<li class="tk-dau-day${isToday ? " is-today" : ""}${p === null ? " is-empty" : ""}" tabindex="0" style="--share:${p ?? 0}%" aria-label="${esc(`${dayLabel(r.day)} ${num(n)}명, ${L ? "출시 후 들어온" : "그날까지 가입한"} ${num(d)}명 중 ${text}`)}"
        data-tip="${tip(dayLabel(r.day), L
          ? [["플레이한 출시 후 계정", `${num(r.launch)}명`], ["출시 후 들어온 계정 (그날까지)", `${num(r.players_launch)}명`], ["비율", text], ["참고: 테스터", `${num(r.tester)}명`], ["  Android / iOS (전체)", `${num(r.dau_android)} / ${num(r.dau_ios)}명`]]
          : [[W ? "모바일 플레이어" : "앱을 연 사람", `${num(r.people)}명`], [W ? "그날까지 모바일 계정" : "그날까지 가입한 플레이어", `${num(r.players)}명`], ["비율", text]],
          L && String(r.day) === launchDay ? "출시 첫날은 들어온 사람이 모두 그날 플레이해서 100%에 가깝습니다. 다음 날부터 의미가 있습니다." : isToday ? "오늘은 아직 끝나지 않은 날" : "")}">
        <strong>${esc(text)}</strong><span>${d > 0 ? `${esc(num(n))} / ${esc(num(d))}명` : "가입자 없음"}</span><small>${isToday ? "오늘" : esc(dayLabel(r.day))}</small></li>`;
    }).join("");

    const dailyRows = daily.slice(-state.period);
    const dauTips = dailyRows.map((r) => tip(dayLabel(r.day), [["앱을 연 사람", `${num(r.people)}명`], share(r) === null ? null : ["가입한 플레이어 중", `${share(r)}%`],
      ["새 플레이어", `${num(r.new_accounts)}명`], noSignal ? null : ["플레이", `${num(r.runs)}판`]]));
    const dauLine = lineChart(dailyRows, "people", dauTips);
    const newCols = W
      ? columns(dailyRows.map((r) => r.app_new), dailyRows.map((r) => tip(dayLabel(r.day), [["새로 설치 (앱)", `${num(r.app_new)}명`], ["새 계정", `${num(r.new_accounts)}명`]])))
      : columns(rows.map((r) => Number(r.new_installs || 0)), rows.map((r) => tip(dayLabel(r.day), [["새로 설치", `${num(r.new_installs)}명`], ["새 계정", `${num(r.new_accounts)}명`]])));
    const runCols = W
      ? columns(dailyRows.map((r) => r.app_runs), dailyRows.map((r) => tip(dayLabel(r.day), [["플레이 (앱)", `${num(r.app_runs)}판`], ["참고: itch", `${num(r.web_runs)}판`]])))
      : columns(rows.map((r) => Number(r.runs || 0)), rows.map((r) => tip(dayLabel(r.day), [["플레이", `${num(r.runs)}판`], ["서버에 남은 기록(신기록)", `${num(r.stored_runs)}판`]])));
    const crashCols = columns(rows.map((r) => Number(r.crashes || 0)), rows.map((r) => tip(dayLabel(r.day), [["크래시", `${num(r.crashes)}건`]])), "is-v2");
    const buyCols = columns(rows.map((r) => Number(r.purchases || 0)), rows.map((r) => tip(dayLabel(r.day), [["결제 완료", `${num(r.purchases)}건`]])));
    const activeTotal = (data.platforms || []).reduce((s, r) => s + r.n, 0);
    const distCard = `<article class="ov-card"><header class="ov-card-head"><h3>누가 쓰나 (7일 동안 앱을 연 기기)</h3></header><div class="overview-drill-body" style="padding:0">${distribution("플랫폼", data.platforms || [], activeTotal, T.fmt.platformName)}${distribution("앱 버전", data.versions || [], activeTotal)}${distribution("언어 (30일)", data.langs || [], 0, (k) => ({ ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어", "?": "기록 없음 (웹)" })[k] || k)}<p class="overview-drill-note">언어는 앱(Android·iOS)만 보냅니다. 웹(itch) 판은 언어를 보내지 않아 ‘기록 없음 (웹)’으로 모이므로, 이 숫자는 앱 사용자의 언어와 따로 봐야 합니다.</p></div></article>`;
    const periods = [7, 30, 90].map((d) => `<button class="overview-switch${d === state.period ? " active" : ""}" type="button" data-tk-period="${d}" aria-pressed="${d === state.period}">${d}일</button>`).join("");
    // Main chart. Mobile view: mobile DAU and new app installs (owner 2026-11-24); the plain view: people who opened the app.
    const mainSeries = W
      ? [{ key: "people", color: COLOR.app, label: "모바일 DAU" }, { key: "app_new", color: COLOR.pre, label: "새로 설치 (앱)" }]
      : [{ key: "people", color: COLOR.app, label: "앱을 연 사람" }];
    const mainTips = dailyRows.map((r) => tip(dayLabel(r.day), W
      ? [["모바일 DAU", `${num(r.people)}명`], launchDay ? ["  출시 후 / 테스터", `${num(r.launch)} / ${num(r.tester)}명`] : null, ["  Android / iOS", `${num(r.dau_android)} / ${num(r.dau_ios)}명`], ["새로 설치 (앱)", `${num(r.app_new)}명`],
        ["새 모바일 계정", `${num(r.new_mobile)}명`], ["플레이 (앱)", `${num(r.app_runs)}판`]]
      : [["앱을 연 사람", `${num(r.people)}명`], ["플레이", `${num(r.runs)}판`], ["새 플레이어", `${num(r.new_accounts)}명`]],
      String(r.day) === today ? "오늘은 아직 끝나지 않은 날" : ""));
    const mainLine = multiLine(dailyRows, mainSeries, mainTips);
    let dauHtml = "";
    let itchHtml = "";
    if (W) {
      const DP = [{ key: "dau_android", color: COLOR.app, label: "Android" }, { key: "dau_ios", color: COLOR.ko, label: "iOS" }];
      const dauCols = stacked(dailyRows, DP, dailyRows.map((r) => tip(dayLabel(r.day), [["모바일 DAU", `${num(r.people)}명`], ...DP.map((d) => [d.label, `${num(r[d.key])}명`])])));
      dauHtml = `<article class="ov-card is-wide"><header class="ov-card-head"><h3>모바일 DAU Android · iOS (${state.period}일)</h3><span class="ov-legend">${DP.map((d) => swatch(d.color, d.label)).join("")}</span></header>
        <figure class="ov-figure" tabindex="0" aria-label="모바일 DAU Android, iOS"><div class="ov-plot has-y">${dauCols.plot}</div>${xAxis(dailyRows)}</figure></article>`;
      // Web (owner 2026-11-24 evening: "웹은 itch뿐만 아니라 네코랜드도 있고, gamepix도 ... dau가 의미가 없어서 계산안하고 그냥 오늘
      // 몇명들어왔는지 정도만"): per portal, today's signed-in players and page opens, yesterday beside it. No rate, no chart.
      const dRows = state.dau?.days || [];
      const dToday = dRows.at(-1) || {}, dYest = dRows.at(-2) || {};
      const PORTALS = [["itch.io", "web_itch", "visits_itch"], ["Nekoland", "web_nekoland", "visits_nekoland"], ["GamePix", "web_gamepix", "visits_gamepix"]];
      const tiles = PORTALS.map(([name, acc, vis]) => {
        const opens = Number(dToday[vis] || 0);
        return `<div class="tk-web-tile"><dt>${esc(name)}</dt><dd><strong>${esc(num(dToday[acc] || 0))}</strong><span>명</span></dd>
          <p>${opens > 0 ? `페이지 열림 ${esc(num(opens))}회 · ` : ""}어제 ${esc(num(dYest[acc] || 0))}명</p></div>`;
      }).join("");
      itchHtml = `<article class="ov-card is-wide tk-web-card">
        <header class="ov-card-head"><h3>웹 · 오늘 들어온 사람</h3><span class="ov-legend">참고용 · 모바일 숫자와 따로</span></header>
        <dl class="tk-web-tiles">${tiles}</dl>
        <p class="overview-drill-note">로그인한 계정 수입니다 (베를린 날짜). 웹은 페이지를 열 때마다 새 익명 번호라 DAU나 비율은 내지 않습니다. GamePix는 접속 신호를 보내지 않아 계정만 셉니다.</p></article>`;
    }
    const storeHtml = W ? storeCard(state.store, dailyRows.length) + reviewsCard(state.reviews) : "";
    byId("tenkeyOverviewCharts").innerHTML = `<article class="ov-card is-wide">
      <header class="ov-card-head"><h3>날마다 한눈에</h3><span class="ov-legend">${mainSeries.map((sr) => swatch(sr.color, sr.label)).join("")}</span><div class="overview-segment" role="group" aria-label="그래프 기간">${periods}</div></header>
      <figure class="ov-figure" tabindex="0" aria-label="${esc(`날마다 ${mainSeries.map((sr) => sr.label).join(", ")}`)}"><div class="ov-plot has-y">${mainLine.plot}</div>${xAxis(dailyRows)}</figure></article>${storeHtml}${dauHtml}${itchHtml}`;
    const facts = [
      W ? ["모바일 계정 (지금까지)", `${num(todayRow.players)}명`] : ["30일 동안 앱을 연 사람", `${num(opened("d30"))}명`], ["지금까지 설치", W ? `${num(Math.max(0, Number(fresh.all || 0) - Number(state.web?.new_installs?.all || 0)))}명 (앱)` : `${num(fresh.all)}명`], ["전체 계정", `${num(totals.accounts)}개`],
      noSignal ? ["7일 동안 기록을 올린 사람", `${num(played.d7)}명`] : W ? ["7일 동안 플레이 (앱)", `${num(sum(daily, "app_runs", 7))}판`] : ["7일 동안 플레이", `${num(runs.d7)}판`], ["7일 뒤 다시 온 비율", retRow(ret.d7)], ["30일 뒤 다시 온 비율", retRow(ret.d30)],
    ].map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("");
    byId("tenkeyOverviewMoreCharts").innerHTML = [
      `<div class="lab-facts tk-more-facts">${facts}</div>`,
      card(`새로 설치 (${state.period}일)`, key("", "bar", W ? "앱 기기만 (웹 방문 제외)" : "처음 신호를 받은 기기"), newCols.plot, rows, true, waiting),
      card(`플레이 (${state.period}일)`, W ? key("", "bar", "앱 (Android·iOS)만 · itch는 참고 그래프") : key("", "bar", "신호와 판 기록 중 큰 쪽"), runCols.plot, rows, true, waiting),
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
      "최근 7일 DAU의 %는 출시일(서버 launch_day) 뒤 처음 들어온 모바일 계정(스토어로 받은 사람) 가운데 그날 플레이한 비율입니다. 출시 전 비공개 테스트·TestFlight 계정은 모바일 DAU 숫자에는 들어가지만(테스터로 따로 표시) 비율에서는 빠집니다. 한 사람이 다른 기기에서 로그인 없이 새로 시작하면 계정이 하나 더 생깁니다.",
      "‘모바일’ 화면(기본)의 DAU는 그날 게임 서버가 본 계정 가운데 Android·iOS 앱 계정 수입니다 (한 사람 한 번, 2026-11-24 출시부터 이 기준). 계정의 플랫폼은 그날 보낸 판 → 그날 웹 신호 → 평소 판 → 로그인한 기기(앱/브라우저)·기기 슬롯·스토어 결제 순으로 정합니다. 웹(itch.io·Nekoland·GamePix)은 ‘웹’ 칸에 그날 들어온 계정 수만 보여 줍니다 (DAU·비율은 내지 않음). 게임은 이번 주 최고 기록을 넘긴 판만 서버에 보내므로, ‘기록을 올린 사람’은 플레이한 사람 전체보다 적습니다.",
      "웹(itch.io)은 첫 화면에서 이용약관·개인정보 처리방침에 동의한 뒤에만 신호(페이지를 열 때마다 새로 만드는 익명 번호, 버전)와 판마다의 기록을 보냅니다. 계정·닉네임은 없습니다. 전체 숫자에도 들어갑니다. ‘다시 온 비율’은 익명 번호로는 셀 수 없어 로그인한 계정 기준으로 셉니다.",
      "웹(CrazyGames)은 로그인하지 않은 사람에게 식별 번호를 만들지 않는 규칙이라 접속자 집계에서 빠집니다. 웹 플레이어는 랭킹 서버에 올라온 사람만 '플레이어'에서 보입니다.",
      "날짜는 베를린 시간 기준(Quirky Ball 한눈 요약과 같음). 14세 미만이나 계정을 만들기 전 사용자는 신호를 보내지 않습니다.",
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
      const [result, webResult, dauResult, storeResult, reviewsResult] = await Promise.all([
        state.platform === "web_itch" ? webCall() : T.call("overview.get", { days: 90, platform: state.platform || undefined }),
        state.platform ? Promise.resolve(null) : webCall().catch(() => null),
        root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "dau.get", params: { days: 90 } }).catch(() => null),
        state.platform ? Promise.resolve(null) : root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "store.get", params: { days: 120 } }).catch(() => null),
        state.platform ? Promise.resolve(null) : root.ConsoleAPI.postProject("houseduck", "tenkey-console-stats", { action: "reviews.get", params: { limit: 30 } }).catch(() => null),
      ]);
      state.reviews = reviewsResult?.data || null;
      state.store = storeResult?.data || null;
      state.dau = dauResult?.data || null;
      state.data = result.data;
      state.web = webResult?.data || null;
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
