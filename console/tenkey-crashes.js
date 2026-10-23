// 10key Survival: 크래시. The app (CrashWatch + the daily ops module) reports three kinds: the app died while it was on screen
// ("unclean_exit"), the main loop stalled for 5 s ("anr_suspect") and the first script error of a session ("script_error").
// Leaving the app from the background (home key, app switcher, a call) is never a crash. This page groups the reports by error
// line / app version / device / kind, lists them and shows one report with its trail and the Godot log tail.
(function attachConsoleTenkeyCrashes(root) {
  const T = root.ConsoleTenkey;
  const { esc, num, time, shortTime, platformName } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const KIND_NAMES = { unclean_exit: "화면을 켠 채 꺼짐", anr_suspect: "멈춤 (5초 이상)", script_error: "스크립트 오류" };
  const BY_TITLES = { message: "오류 내용별 묶음", version: "앱 버전별 묶음", device: "기기별 묶음", kind: "종류별 묶음" };
  const state = { bound: false, group: null, groupBy: "message", groups: [] };
  let pager = null;

  const kindName = (kind) => KIND_NAMES[kind] || kind;
  const filters = () => ({
    days: Number(byId("tenkeyCrashDays").value),
    platform: byId("tenkeyCrashPlatform").value || undefined,
    kind: byId("tenkeyCrashKind").value || undefined,
  });

  // A group narrows the list below it: message / version / device text goes into the list search, a kind into the kind filter.
  function groupFilter() {
    if (!state.group) return {};
    if (state.groupBy === "kind") return { kind: state.group };
    const text = state.groupBy === "device" ? String(state.group).split(" / ")[0] : state.group;
    return { query: text.slice(0, 100) };
  }

  function groupRow(g) {
    const selected = state.group === g.key;
    return `<tr data-tk-group="${esc(g.key)}" tabindex="0" aria-selected="${selected}">
      <td class="tk-wrap" data-label="묶음"><strong>${esc(state.groupBy === "kind" ? kindName(g.key) : g.key)}</strong>${g.said && state.groupBy === "message" ? `<span class="tk-sub">${esc(g.said)}</span>` : ""}<span class="tk-sub">${esc((g.kinds || []).map(kindName).join(" · "))} · ${esc((g.platforms || []).map((p) => platformName(String(p).toLowerCase())).join(", "))}</span></td>
      <td class="tk-num" data-label="횟수"><strong>${esc(num(g.times))}</strong></td><td class="tk-num" data-label="보고">${esc(num(g.rows))}</td>
      <td class="tk-num" data-label="설치 수">${esc(g.installs ? num(g.installs) : "—")}</td><td class="tk-num" data-label="기기">${esc(num(g.devices))}</td><td class="tk-num" data-label="버전">${esc(num(g.versions))}</td>
      <td data-label="처음">${esc(time(g.first_at))}</td><td data-label="마지막">${esc(time(g.last_at))}</td></tr>`;
  }

  function crashRow(c) {
    return `<tr data-tk-crash="${esc(c.id)}" tabindex="0" style="cursor:pointer">
      <td data-label="시각">${esc(time(c.received_at))}</td>
      <td data-label="종류"><span class="tk-badge" data-tone="${c.kind === "script_error" ? "watch" : "risk"}">${esc(kindName(c.kind))}</span></td>
      <td class="tk-wrap" data-label="오류 내용">${esc(c.message)}</td>
      <td data-label="버전">${esc(c.app_version || "—")}</td>
      <td data-label="기기 · OS">${esc(c.device_model || "—")}<span class="tk-sub">${esc(platformName(String(c.platform).toLowerCase()))} ${esc(c.os_version || "")}</span></td>
      <td class="tk-num" data-label="횟수">${esc(num(1 + Number(c.repeats || 0)))}</td>
      <td data-label="로그">${c.has_log ? '<span class="tk-badge" data-tone="good">있음</span>' : "—"}</td></tr>`;
  }

  async function loadGroups() {
    state.groupBy = byId("tenkeyCrashBy").value;
    byId("tenkeyCrashGroupsTitle").textContent = BY_TITLES[state.groupBy];
    const f = filters();
    const result = await T.call("crashes.groups", { days: f.days, by: state.groupBy, platform: f.platform, kind: f.kind });
    state.groups = result.data.rows || [];
    byId("tenkeyCrashGroups").innerHTML = state.groups.length
      ? state.groups.map(groupRow).join("")
      : '<tr><td colspan="8" class="empty-panel">이 기간에 보고된 크래시가 없습니다.</td></tr>';
    byId("tenkeyCrashGroupsTotal").textContent = `${num(state.groups.length)}묶음`;
    const set = (name, value) => { byId("tenkeyCrashSummary").querySelector(`[data-crash-summary="${name}"]`).textContent = value; };
    const more = state.groups.length >= 50 ? "+" : "";
    set("rows", `${num(state.groups.reduce((s, g) => s + g.rows, 0))}${more}`);
    set("times", `${num(state.groups.reduce((s, g) => s + g.times, 0))}${more}`);
    set("groups", `${num(state.groups.length)}${more}`);
    set("last", state.groups.length ? shortTime(state.groups.map((g) => g.last_at).sort().at(-1)) : "—");
  }

  async function loadList(page = 1) {
    const f = filters();
    const g = groupFilter();
    const search = byId("tenkeyCrashQuery").value.trim();
    const result = await T.call("crashes.list", { days: f.days, platform: f.platform, kind: g.kind || f.kind, query: g.query || search, page });
    const data = result.data;
    pager.st.page = page;
    pager.st.total = Number(data.total || 0);
    byId("tenkeyCrashTotal").textContent = `${num(data.total)}건${state.group ? " (묶음 선택됨)" : ""}`;
    byId("tenkeyCrashTable").innerHTML = (data.rows || []).length
      ? data.rows.map(crashRow).join("")
      : '<tr><td colspan="7" class="empty-panel">조건에 맞는 크래시가 없습니다.</td></tr>';
    pager.draw();
  }

  async function loadAll() {
    T.setMessage("tenkeyCrashMessage", "크래시를 불러오는 중입니다...");
    byId("tenkeyCrashDetail").hidden = true;
    try {
      await loadGroups();
      await loadList(1);
      T.setMessage("tenkeyCrashMessage", "크래시 보고는 30일, 로그는 7일 보관합니다. 로그가 없는 줄은 앱이 로그 없이 보낸 보고이거나 7일이 지난 것입니다.");
    } catch (error) {
      T.report("tenkeyCrashMessage", error);
    }
  }

  const facts = (items) => `<dl class="tk-detail-grid">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

  function detailMarkup(c) {
    const detail = c.detail || {};
    const trail = Array.isArray(detail.trail) ? detail.trail : [];
    const extra = Object.entries(detail).filter(([k]) => k !== "trail").map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
    return `<div class="panel-heading"><div><p class="eyebrow">CRASH #${esc(c.id)}</p><h2>${esc(kindName(c.kind))}</h2><small class="tk-wrap">${esc(c.message)}</small></div><button id="tenkeyCrashClose" class="text-button" type="button">닫기</button></div>
      ${facts([
        ["받은 시각", time(c.received_at)], ["마지막 반복", time(c.last_at)], ["반복 횟수", `${num(Number(c.repeats || 0))}회 더`], ["같은 묶음 보고", `${num(c.same_signature_rows)}건`],
        ["앱 버전", c.app_version || "—"], ["빌드", c.build ? String(c.build) : "—"], ["플랫폼 · OS", `${platformName(String(c.platform).toLowerCase())} ${c.os_version || ""}`], ["기기", c.device_model || "—"],
        ["언어", c.locale || "—"], ["설치 번호 (앞 8자)", c.install_short || "받지 않음"], ["로그 붙은 시각", c.enriched_at ? time(c.enriched_at) : "—"],
      ])}
      ${extra.length ? `<div class="tk-section"><h3>상세 값</h3>${facts(extra)}</div>` : ""}
      ${trail.length ? `<div class="tk-section"><h3>앱이 남긴 흔적 (오래된 것부터, 마지막 ${trail.length}줄)</h3><ol class="tk-trail">${trail.map((line) => `<li>${esc(line)}</li>`).join("")}</ol></div>` : ""}
      <div class="tk-section"><h3>Godot 로그 끝부분 (앞 세션)</h3>${c.log_tail ? `<pre class="tk-log">${esc(c.log_tail)}</pre>` : '<p class="empty-panel">로그가 없습니다 (앱이 로그 없이 보냈거나 7일이 지나 지워졌습니다).</p>'}</div>`;
  }

  async function openCrash(id) {
    const box = byId("tenkeyCrashDetail");
    try {
      const result = await T.call("crashes.get", { id });
      box.innerHTML = detailMarkup(result.data.crash);
      box.hidden = false;
      byId("tenkeyCrashClose").addEventListener("click", () => { box.hidden = true; });
      box.scrollIntoView({ block: "start", behavior: "auto" });
    } catch (error) {
      T.report("tenkeyCrashMessage", error);
    }
  }

  function bindTableOpen(tbodyId, attr, handler) {
    const body = byId(tbodyId);
    const fire = (event) => {
      const row = event.target.closest(`[${attr}]`);
      if (row) handler(row.getAttribute(attr));
    };
    body.addEventListener("click", fire);
    body.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fire(event); } });
  }

  function mountCrashes() {
    if (!state.bound) {
      state.bound = true;
      pager = T.pager({ prev: "tenkeyCrashPrevious", next: "tenkeyCrashNext", label: "tenkeyCrashPage" }, 50, (page) => loadList(page).catch((e) => T.report("tenkeyCrashMessage", e)));
      byId("tenkeyCrashFilterForm").addEventListener("submit", (event) => {
        event.preventDefault();
        state.group = null;
        loadAll();
      });
      bindTableOpen("tenkeyCrashGroups", "data-tk-group", (key) => {
        state.group = state.group === key ? null : key;
        byId("tenkeyCrashGroups").innerHTML = state.groups.map(groupRow).join("");
        loadList(1).catch((e) => T.report("tenkeyCrashMessage", e));
      });
      bindTableOpen("tenkeyCrashTable", "data-tk-crash", (id) => openCrash(Number(id)));
    }
    loadAll();
  }

  T.mountCrashes = mountCrashes;
})(window);
