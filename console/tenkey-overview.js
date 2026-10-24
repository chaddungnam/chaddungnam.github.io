// 10key Survival: 한눈 요약. One tenkey-admin call ("overview.get", always 90 days) feeds six number tiles, six charts and
// a few sentences, in the same frame as the Quirky Ball overview (the ov-* styles). Days are Berlin dates (the server's
// day). The numbers come from the app's daily ping (Android / iOS players with a guest account), so web (CrazyGames) is not in
// them; the unfinished "today" is shown but not compared as a trend.
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

  function chip(current, previous, goodWhenUp = true) {
    if (!Number.isFinite(Number(previous)) || Number(previous) === 0 && Number(current) === 0) return '<span class="ov-chip" data-tone="quiet">변화 없음</span>';
    const diff = Number(current) - Number(previous);
    if (diff === 0) return '<span class="ov-chip" data-tone="quiet">같음</span>';
    const up = diff > 0;
    const tone = up === goodWhenUp ? "good" : "bad";
    return `<span class="ov-chip" data-tone="${tone}"><span aria-hidden="true">${up ? "▲" : "▼"}</span>${esc(num(Math.abs(diff)))}</span>`;
  }
  function spark(rows, k) {
    const values = rows.map((r) => Number(r[k] || 0));
    if (!values.some((v) => v > 0)) return '<div class="ov-spark is-empty" aria-hidden="true"></div>';
    const max = niceMax(Math.max(...values));
    const tips = rows.map((r, i) => tip(dayLabel(r.day), [["값", num(values[i])]]));
    return `<div class="ov-spark"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="ov-area" d="${linePath(values, max)} L${((values.length - 0.5) / values.length * 100).toFixed(2)} 100 L${(0.5 / values.length * 100).toFixed(2)} 100 Z"></path><path class="ov-line" d="${linePath(values, max)}" vector-effect="non-scaling-stroke"></path></svg>${hits(tips)}</div>`;
  }
  function tile(label, value, chipHtml, sparkHtml, rows, help) {
    const body = rows.map(([name, v]) => `<span class="ov-row"><span class="ov-row-name">${esc(name)}</span><b class="ov-row-value${v === "—" ? " is-empty" : ""}">${esc(v)}</b></span>`).join("");
    return `<article class="ov-kpi" tabindex="0" data-tip-group aria-label="${esc(`${label} ${value}`)}">
      <div class="ov-kpi-top" data-tip="${tip(label, [], help)}"><h3 class="ov-kpi-label">${esc(label)}</h3><p class="ov-kpi-main"><strong class="ov-kpi-value">${esc(value)}</strong>${chipHtml}</p></div>${sparkHtml}<div class="ov-kpi-rows">${body}</div></article>`;
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
    const dau = rows.map((r) => Number(r.dau || 0));
    const retText = (r) => (r && Number(r.cohort) > 0 ? pct(r.back, r.cohort) : "—");
    const retRow = (r) => (r && Number(r.cohort) > 0 ? `${pct(r.back, r.cohort)} (${num(r.back)}/${num(r.cohort)})` : "표본 없음");
    const week = (k) => sum(all, k, 7);
    const month = (k) => sum(all, k, 30);

    byId("tenkeyOverviewKpis").innerHTML = [
      tile("접속자 (DAU)", num(active.d1), chip(active.d1, active.d1_prev), spark(rows, "dau"),
        [["어제", num(active.d1_prev)], ["7일 활성", num(active.d7)], ["30일 활성", num(active.d30)]],
        "앱을 연 기기 수. 하루에 한 번 보내는 신호를 세고, 오늘(베를린 시간)은 아직 끝나지 않은 날입니다."),
      tile("신규 설치", num(fresh.d1), chip(fresh.d1, fresh.d1_prev), spark(rows, "new_installs"),
        [["7일", num(fresh.d7)], ["30일", num(fresh.d30)], ["지금까지", num(fresh.all)]],
        "이 기기에서 처음 신호를 받은 날 기준. 앱을 지우고 다시 깔면 새 설치로 셉니다."),
      tile("플레이 횟수", num(runs.d1), chip(runs.d1, runs.d1_prev), spark(rows, "runs"),
        [["7일", num(runs.d7)], ["30일", num(runs.d30)], ["접속자당 (7일)", Number(active.d7) > 0 ? (Number(runs.d7) / Number(active.d7)).toFixed(1) : "—"]],
        "앱이 알려준 판 수의 증가분(열 때 값과 닫을 때 값의 차이). 강제 종료된 날은 적게 잡힙니다."),
      tile("신규 계정", num(rows.at(-1)?.new_accounts), chip(rows.at(-1)?.new_accounts, rows.at(-2)?.new_accounts), spark(rows, "new_accounts"),
        [["7일", num(week("new_accounts"))], ["30일", num(month("new_accounts"))], ["전체 계정", num(totals.accounts)]],
        "앱에서 닉네임을 정해 서버에 만든 계정 (웹 CrazyGames 로그인은 계정이 아닌 플레이어로만 셉니다)."),
      tile("크래시", num(totals.crash_times_24h), '<span class="ov-chip" data-tone="quiet">24시간</span>', spark(rows, "crashes"),
        [["7일", num(week("crashes"))], ["30일", num(month("crashes"))], ["접속자 대비 (7일)", Number(active.d7) > 0 ? pct(week("crashes"), active.d7) : "—"]],
        "최근 24시간의 크래시·멈춤·오류 보고 (같은 오류 합산). 홈 키나 최근 앱에서 끈 것은 세지 않습니다."),
      tile("복귀율", retText(ret.d1), "", '<div class="ov-spark is-empty" aria-hidden="true"></div>',
        [["D1", retRow(ret.d1)], ["D7", retRow(ret.d7)], ["D30", retRow(ret.d30)]],
        "설치한 다음 날(D1)·7일 뒤·30일 뒤에 다시 연 기기의 비율. 설치 직후 며칠은 아직 셀 수 없어 표본이 비어 있습니다."),
    ].join("");

    const dauTips = rows.map((r) => tip(dayLabel(r.day), [["접속자", `${num(r.dau)}명`], ["신규 설치", `${num(r.new_installs)}명`], ["플레이", `${num(r.runs)}회`]]));
    const dauLine = lineChart(rows, "dau", dauTips);
    const newCols = columns(rows.map((r) => Number(r.new_installs || 0)), rows.map((r) => tip(dayLabel(r.day), [["신규 설치", `${num(r.new_installs)}명`], ["신규 계정", `${num(r.new_accounts)}명`]])));
    const runCols = columns(rows.map((r) => Number(r.runs || 0)), rows.map((r) => tip(dayLabel(r.day), [["플레이", `${num(r.runs)}회`], ["서버에 남은 기록(신기록)", `${num(r.stored_runs)}회`]])));
    const crashCols = columns(rows.map((r) => Number(r.crashes || 0)), rows.map((r) => tip(dayLabel(r.day), [["크래시", `${num(r.crashes)}건`]])), "is-v2");
    const buyCols = columns(rows.map((r) => Number(r.purchases || 0)), rows.map((r) => tip(dayLabel(r.day), [["결제 완료", `${num(r.purchases)}건`]])));
    const activeTotal = (data.platforms || []).reduce((s, r) => s + r.n, 0);
    const distCard = `<article class="ov-card"><header class="ov-card-head"><h3>누가 쓰나 (7일 활성 설치)</h3></header><div class="overview-drill-body" style="padding:0">${distribution("플랫폼", data.platforms || [], activeTotal, T.fmt.platformName)}${distribution("앱 버전", data.versions || [], activeTotal)}${distribution("언어 (30일)", data.langs || [], 0, (k) => ({ ko: "한국어", en: "영어", "?": "기록 없음" })[k] || k)}</div></article>`;
    byId("tenkeyOverviewCharts").innerHTML = [
      card("접속자 (DAU)", key("", "area", "하루 접속 기기"), dauLine.plot, rows, true, waiting),
      card("신규 설치", key("", "bar", "처음 신호를 받은 기기"), newCols.plot, rows, true, waiting),
      card("플레이 횟수", key("", "bar", "앱이 알려준 판 수"), runCols.plot, rows, true, waiting),
      distCard,
      card("크래시", key("is-v2", "bar", "보고 + 반복 횟수"), crashCols.plot, rows, false, ""),
      card("결제 완료", key("", "bar", "스토어 확인된 구매"), buyCols.plot, rows, false, ""),
    ].join("");

    const lines = noSignal
      ? [["", "아직 앱이 보낸 접속 신호가 없어요. 신호를 보내는 빌드가 스토어에 나가면 접속자·신규·플레이가 채워집니다."]]
      : [
        [Number(active.d1) >= Number(active.d1_prev) ? "up" : "down", `오늘 접속 ${num(active.d1)}명 (어제 하루 ${num(active.d1_prev)}명)`],
        ["", `최근 7일 활성 ${num(active.d7)}명 · 신규 설치 ${num(fresh.d7)}명 · 플레이 ${num(runs.d7)}회`],
        [Number(totals.crash_times_24h) > 0 ? "down" : "", Number(totals.crash_times_24h) > 0 ? `최근 24시간 크래시 ${num(totals.crash_times_24h)}건` : "최근 24시간 크래시 없음"],
      ];
    byId("tenkeyOverviewSummary").innerHTML = lines.map(([dir, text]) => `<li${dir ? ` data-direction="${dir}"` : ""}>${esc(text)}</li>`).join("");

    byId("tenkeyOverviewServer").innerHTML = [
      ["플레이어 (서버)", num(totals.players)], ["정지", num(totals.banned)], ["서버에 남은 판", num(totals.stored_runs)],
      ["게시 중 공지", num(totals.notices_live)], ["30일 결제", num(totals.purchases_30d)],
      ["10KEY 표 크기", bytes(totals.tenkey_bytes)], ["공용 DB 전체", `${bytes(totals.db_bytes)} / 500 MB`],
    ].map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("");
    byId("tenkeyOverviewNotes").innerHTML = [
      "접속자는 Android·iOS 앱에서 게스트 계정을 만든 플레이어가 하루 한 번 보내는 신호(무작위 설치 번호, 플랫폼, 버전, 언어)로 셉니다. 계정 번호나 기기 이름은 받지 않습니다.",
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
