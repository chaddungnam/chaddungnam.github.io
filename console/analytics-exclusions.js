(function attachAnalyticsExclusions(root) {
  const state = { rows: [], query: "", loading: false, bound: false };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";

  function setMessage(value, error = false) {
    root.ConsoleUiState.setMessage(byId("analyticsExclusionsMessage"), value, error);
    byId("analyticsExclusionsMessage").style.color = error ? "var(--coral)" : "";
  }

  function render() {
    const query = state.query.toLowerCase();
    const rows = state.rows.filter((row) => [row.nickname, row.display_code, row.user_id, row.reason, row.note]
      .some((value) => String(value ?? "").toLowerCase().includes(query)));
    byId("analyticsExclusionsTotal").textContent = `${rows.length}명`;
    byId("analyticsExclusionsTable").innerHTML = rows.length ? rows.map((row) => `<tr>
      <td><strong>${escapeHtml(row.nickname || "이름 없음")}</strong><small>${escapeHtml(row.account_type || "unknown")}</small></td>
      <td><code>${escapeHtml(row.display_code || "—")}</code><small>${escapeHtml(row.user_id)}</small></td>
      <td><span class="analytics-exclusion-badge">로컬/QA 제외</span><small>${escapeHtml(row.reason)}</small></td>
      <td>${escapeHtml(row.note || "—")}</td>
      <td>${escapeHtml(time(row.created_at))}</td>
      <td><a class="player-open-link" href="#/players/${encodeURIComponent(row.user_id)}?return=%23%2Fanalytics-exclusions">플레이어</a></td>
    </tr>`).join("") : '<tr><td class="empty-row" colspan="6">조건과 일치하는 통계 제외 계정이 없습니다.</td></tr>';
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    setMessage("통계 제외 계정을 불러오는 중...");
    try {
      const data = await root.ConsoleAPI.post("admin-console", { action: "analytics_exclusions.list" });
      state.rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];
      render();
      setMessage("분석·기간 플레이어·경제·시즌·속도 집계에서 제외되는 계정입니다. 원본 계정과 기록은 보존됩니다.");
    } catch (error) {
      state.rows = [];
      render();
      setMessage(`통계 제외 목록을 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      state.loading = false;
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    byId("analyticsExclusionsSearchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = byId("analyticsExclusionsSearch").value.trim();
      render();
    });
  }

  function mount() { bind(); load(); }
  root.ConsoleAnalyticsExclusions = { mount, load };
})(window);
