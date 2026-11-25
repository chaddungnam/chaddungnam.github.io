// 10key Survival: 경제 흐름 (owner 2026-11-24 night: "경제흐름, 진행하고"). Where gems / scrap / parts come from and where they go,
// day by day, and how much the active accounts hold: the server's own ledgers (economy v2: the server owns app accounts'
// balances), test accounts and the 11-24 admin clawback left out. Read through tenkey-console-stats economy.get
// (tenkey.admin_economy_flow_v1). For long-term balancing: if gems keep coming in faster than they go out, prices lose meaning.
(function attachConsoleTenkeyEconomy(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, days: 14, data: null };

  const CUR = { gems: "젬", scrap: "스크랩", parts: "부품" };
  // The ledgers' reason words in plain Korean (unknown ones stay as they are).
  const REASON = {
    play: "플레이 중 주움", starter: "시작 선물", daily: "출석", daily_set: "출석 30회 보너스", quest: "퀘스트", purchase: "스토어 구매",
    mail: "메일 보상", best: "최고 기록", escape: "탈출", open: "상자", run: "판 보상", rune_dupe: "겹친 모듈 분해", revive: "부활",
    module_box: "모듈 상자", unlock: "해금", upgrade: "강화", scrap_pack: "스크랩 팩", shop: "상점", rune_box: "모듈 상자",
    runes_parts: "모듈 조각", rune_bought: "모듈 구매", rune_free: "무료 모듈", quest_rare_box: "퀘스트 희귀 상자", hard: "하드 모드",
    daily_x2: "오늘의 찬스 (2·3번째 판 부품)", robot: "로봇 강화", gift: "친구 선물", friend: "친구", refund: "환불 회수", ad: "광고", season: "시즌 보상", title: "칭호",
  };
  const reasonName = (r) => REASON[r] || r;

  function chart(days) {
    const max = Math.max(1, ...days.map((d) => Math.max(Number(d.gems_in || 0), Number(d.gems_out || 0))));
    const cols = days.map((d) => {
      const inn = Number(d.gems_in || 0), out = Number(d.gems_out || 0), bought = Number(d.gems_bought || 0);
      const tip = `${d.day}\n생긴 젬 ${num(inn)} (구매 ${num(bought)})\n쓴 젬 ${num(out)}\n움직인 계정 ${num(d.accounts)}`;
      return `<div class="tk-econ-col" title="${esc(tip)}" tabindex="0" aria-label="${esc(tip.replaceAll("\n", ", "))}">
        <span class="tk-econ-up" style="height:${(inn / max * 100).toFixed(1)}%"><span class="tk-econ-bought" style="height:${inn ? (bought / inn * 100).toFixed(1) : 0}%"></span></span>
        <span class="tk-econ-down" style="height:${(out / max * 100).toFixed(1)}%"></span>
        <small>${esc(String(d.day).slice(5).replace("-", "."))}</small></div>`;
    }).join("");
    return `<div class="tk-econ-legend"><span><i class="is-in"></i>생긴 젬</span><span><i class="is-bought"></i>그중 구매</span><span><i class="is-out"></i>쓴 젬</span><span>세로 최대 ${esc(num(max))}</span></div><div class="tk-econ-cols">${cols}</div>`;
  }

  function reasons(list) {
    return ["gems", "scrap", "parts"].map((cur) => {
      const part = (kind) => list.filter((r) => r.currency === cur && r.kind === kind);
      const total = (rows) => rows.reduce((t, r) => t + Number(r.amount || 0), 0);
      const table = (rows, title) => {
        const sum = total(rows);
        return `<div class="tk-econ-side"><h4>${esc(title)} <span>${esc(num(sum))}</span></h4>${rows.length ? `<ul>${rows.map((r) => `<li><span>${esc(reasonName(r.reason))}</span><b>${esc(num(r.amount))}</b><small>${esc(sum ? Math.round(r.amount / sum * 100) : 0)}% · ${esc(num(r.accounts))}명 · ${esc(num(r.events))}번</small></li>`).join("")}</ul>` : '<p class="tk-sub">기록 없음</p>'}</div>`;
      };
      return `<article class="tk-econ-cur"><h3>${esc(CUR[cur])}</h3><div class="tk-econ-pair">${table(part("grant"), "생김")}${table(part("spend"), "씀")}</div></article>`;
    }).join("");
  }

  function render() {
    const d = state.data || {};
    const days = d.days || [];
    const sum = (k) => days.reduce((t, r) => t + Number(r[k] || 0), 0);
    const gIn = sum("gems_in"), gOut = sum("gems_out"), bought = sum("gems_bought");
    const card = (label, value, note, tone = "neutral") => `<article data-tone="${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small class="tk-sub">${esc(note)}</small></article>`;
    byId("tenkeyEconSummary").innerHTML = [
      card(`생긴 젬 (${state.days}일)`, num(gIn), `구매 ${num(bought)} · 플레이 등 ${num(gIn - bought)}`, "good"),
      card(`쓴 젬 (${state.days}일)`, num(gOut), gIn ? `생긴 것의 ${Math.round(gOut / gIn * 100)}%` : "—", "watch"),
      card("젬 순증", `${gIn - gOut >= 0 ? "+" : ""}${num(gIn - gOut)}`, gIn - gOut > 0 ? "쌓이는 중" : "줄어드는 중", gIn - gOut > 0 ? "risk" : "good"),
      card("스크랩 순증", `${sum("scrap_in") - sum("scrap_out") >= 0 ? "+" : ""}${num(sum("scrap_in") - sum("scrap_out"))}`, `생김 ${num(sum("scrap_in"))} · 씀 ${num(sum("scrap_out"))}`),
      card("부품 순증", `${sum("parts_in") - sum("parts_out") >= 0 ? "+" : ""}${num(sum("parts_in") - sum("parts_out"))}`, `생김 ${num(sum("parts_in"))} · 씀 ${num(sum("parts_out"))}`),
    ].join("");
    byId("tenkeyEconChart").innerHTML = days.length ? chart(days) : '<p class="empty-panel">기록이 없습니다.</p>';
    byId("tenkeyEconReasons").innerHTML = reasons(d.reasons || []);
    const bal = new Map((d.balances || []).map((b) => [b.currency, b]));
    byId("tenkeyEconBalances").innerHTML = ["gems", "scrap", "parts"].map((cur) => {
      const b = bal.get(cur);
      return `<div><dt>${esc(CUR[cur])} 보유 (계정 ${esc(num(b?.accounts || 0))})</dt><dd>${b ? `평균 ${esc(num(b.avg))} · 중앙 ${esc(num(Math.round(b.median)))} · 상위 10% ${esc(num(Math.round(b.p90)))} · 최대 ${esc(num(b.max))}` : "—"}</dd></div>`;
    }).join("");
  }

  async function load() {
    T.setMessage("tenkeyEconMessage", "불러오는 중입니다...");
    try {
      state.data = await T.stats("economy.get", { days: state.days });
      render();
      T.setMessage("tenkeyEconMessage", `베를린 날짜 ${state.data.first_day} ~ ${state.data.today} · 장부 기준이라 앱이 아직 못 보낸 기록은 빠질 수 있습니다.`);
    } catch (error) {
      T.report("tenkeyEconMessage", error);
    }
  }

  function mountEconomy() {
    if (!state.bound) {
      state.bound = true;
      byId("tenkeyEconomyView").addEventListener("click", (event) => {
        const b = event.target.closest("[data-tk-econ-days]");
        if (!b) return;
        state.days = Number(b.dataset.tkEconDays);
        document.querySelectorAll("[data-tk-econ-days]").forEach((x) => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); });
        load();
      });
    }
    load();
  }

  T.mountEconomy = mountEconomy;
})(window);
