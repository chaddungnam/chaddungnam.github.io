// 10key Survival: 한눈 요약. One tenkey-admin call ("overview.get", always 90 days) feeds two rows of plain numbers (오늘 /
// 최근 7일, one number per card with one line of words under it), the daily chart of devices that opened the app and, folded away, the other charts.
// Owner 2026-10-25 ("한눈요약 개선처리해줘. 한눈에 안들어옴"): the numbers that matter first, big and in plain Korean; the
// breakdowns live under "그래프 더 보기". Days are Berlin dates (the server's day). Device numbers come from the app's daily ping
// (Android / iOS players with a guest account), so web (CrazyGames) is not in them; the unfinished "today" is shown next to
// yesterday's whole day, never judged up or down (only the 7-day windows get an arrow).
// Owner 2026-10-25 ("테스터가 꽤 많을텐데 0명인건 논리적으로 안맞음"): the closed-test build (1.0.0, 2026-10-22) predates the
// ping, so every count of people is the larger of the ping and the people the game server saw (data.server, a row per player
// and day: sign-in, progress, runs; app and web), and until the first ping arrives the install / play cards use the game
// server's own counts (new players, people whose run reached the server) instead of zeros. Owner the same day ("1주일간 dau
// 퍼센티지로"): the last 7 days, each day's people as a share of the players that existed by the end of that day.
(function attachConsoleTenkeyOverview(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, bytes, pct } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, period: 7, platform: "", data: null, busy: false };
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
    const noSignal = Number(data.new_installs?.all || 0) === 0;
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
    const opened = (k) => Math.max(Number(active[k] || 0), Number(seen[k] || 0));
    const newToday = Number(all.at(-1)?.new_accounts || 0);
    const newYesterday = Number(all.at(-2)?.new_accounts || 0);
    const OPENED_HELP = "게임 서버가 본 사람(로그인·진행 저장·기록 전송, 앱·웹 합산)과 앱이 하루 한 번 보내는 접속 신호 중 큰 쪽. 같은 사람은 한 번만 셉니다.";
    // Each day: people (the larger of the ping and the game server) and the players that existed by the end of it.
    const serverDays = new Map((data.server?.days || []).map((d) => [String(d.day), d]));
    const daily = all.map((r) => {
      const srv = serverDays.get(String(r.day)) || {};
      return { ...r, people: Math.max(Number(r.dau || 0), Number(srv.active || 0)), players: Number(srv.players || 0) };
    });
    const share = (r) => (r.players > 0 ? Math.round(Math.min(r.people, r.players) / r.players * 100) : null);

    byId("tenkeyOverviewNotice").hidden = !noSignal;
    byId("tenkeyOverviewNotice").textContent = noSignal ? "지금 테스트 빌드는 하루 접속 신호를 보내지 않아요. 그래서 사람 수는 게임 서버 기록(로그인·진행 저장·기록 전송)으로 셉니다. 설치 수와 판 수는 신호를 보내는 새 빌드가 나가면 채워집니다." : "";
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
          { help: "앱이 알려준 판 수의 증가분(열 때 값과 닫을 때 값의 차이). 강제 종료된 날은 적게 잡힙니다." }),
      crashes > 0
        ? glance("크래시 (최근 24시간)", num(crashes), "건", `크래시 화면에서 확인${anyPlatform} →`,
          { tone: "risk", href: "#/tenkey-crashes", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산). 홈 키나 최근 앱에서 끈 것은 세지 않습니다." })
        : glance("크래시 (최근 24시간)", "0", "건", `없음${anyPlatform}`, { tone: "good", help: "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산)." }),
    ].join("");
    const peopleWeek = versus(opened("d7"), opened("d7_prev"), "명");
    const installWeek = noSignal ? versus(week("new_accounts"), weekBefore("new_accounts"), "명") : versus(fresh.d7, fresh.d7_prev, "명");
    const buyWeek = versus(week("purchases"), weekBefore("purchases"), "건");
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
      glance("다음 날 다시 온 비율", retRate(ret.d1), Number(ret.d1?.cohort) > 0 ? "%" : "",
        Number(ret.d1?.cohort) > 0 ? `설치한 ${num(ret.d1.cohort)}명 중 ${num(ret.d1.back)}명` : noSignal ? "새 빌드부터 셈" : "아직 셀 수 없음 (설치 이틀 뒤부터)",
        { help: "2~8일 전에 설치한 기기 가운데 설치한 다음 날 앱을 다시 연 비율. 7일 뒤·30일 뒤 비율은 ‘그래프 더 보기’에 있습니다." }),
    ].join("");

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
    const newCols = columns(rows.map((r) => Number(r.new_installs || 0)), rows.map((r) => tip(dayLabel(r.day), [["새로 설치", `${num(r.new_installs)}명`], ["새 계정", `${num(r.new_accounts)}명`]])));
    const runCols = columns(rows.map((r) => Number(r.runs || 0)), rows.map((r) => tip(dayLabel(r.day), [["플레이", `${num(r.runs)}판`], ["서버에 남은 기록(신기록)", `${num(r.stored_runs)}판`]])));
    const crashCols = columns(rows.map((r) => Number(r.crashes || 0)), rows.map((r) => tip(dayLabel(r.day), [["크래시", `${num(r.crashes)}건`]])), "is-v2");
    const buyCols = columns(rows.map((r) => Number(r.purchases || 0)), rows.map((r) => tip(dayLabel(r.day), [["결제 완료", `${num(r.purchases)}건`]])));
    const activeTotal = (data.platforms || []).reduce((s, r) => s + r.n, 0);
    const distCard = `<article class="ov-card"><header class="ov-card-head"><h3>누가 쓰나 (7일 동안 앱을 연 기기)</h3></header><div class="overview-drill-body" style="padding:0">${distribution("플랫폼", data.platforms || [], activeTotal, T.fmt.platformName)}${distribution("앱 버전", data.versions || [], activeTotal)}${distribution("언어 (30일)", data.langs || [], 0, (k) => ({ ko: "한국어", en: "영어", ja: "일본어", de: "독일어", zh_TW: "중국어(번체)", fr: "프랑스어", es: "스페인어", pt: "포르투갈어", "?": "기록 없음" })[k] || k)}</div></article>`;
    const periods = [7, 30, 90].map((d) => `<button class="overview-switch${d === state.period ? " active" : ""}" type="button" data-tk-period="${d}" aria-pressed="${d === state.period}">${d}일</button>`).join("");
    byId("tenkeyOverviewCharts").innerHTML = `<article class="ov-card is-wide">
      <header class="ov-card-head"><h3>날마다 앱을 연 사람</h3><div class="overview-segment" role="group" aria-label="그래프 기간">${periods}</div></header>
      <figure class="ov-figure" tabindex="0" aria-label="날마다 앱을 연 사람"><div class="ov-plot has-y">${dauLine.plot}</div>${xAxis(rows)}</figure></article>`;
    const facts = [
      ["30일 동안 앱을 연 사람", `${num(opened("d30"))}명`], ["지금까지 설치", `${num(fresh.all)}명`], ["전체 계정", `${num(totals.accounts)}개`],
      noSignal ? ["7일 동안 기록을 올린 사람", `${num(played.d7)}명`] : ["7일 동안 플레이", `${num(runs.d7)}판`], ["7일 뒤 다시 온 비율", retRow(ret.d7)], ["30일 뒤 다시 온 비율", retRow(ret.d30)],
    ].map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("");
    byId("tenkeyOverviewMoreCharts").innerHTML = [
      `<div class="lab-facts tk-more-facts">${facts}</div>`,
      card(`새로 설치 (${state.period}일)`, key("", "bar", "처음 신호를 받은 기기"), newCols.plot, rows, true, waiting),
      card(`플레이 (${state.period}일)`, key("", "bar", "앱이 알려준 판 수"), runCols.plot, rows, true, waiting),
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
      "최근 7일 DAU의 %는 그날 앱을 연 사람 ÷ 그날까지 가입한 플레이어 수입니다. 게임은 이번 주 최고 기록을 넘긴 판만 서버에 보내므로, ‘기록을 올린 사람’은 플레이한 사람 전체보다 적습니다.",
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
      const result = await T.call("overview.get", { days: 90, platform: state.platform || undefined });
      state.data = result.data;
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
        if (period) {
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
