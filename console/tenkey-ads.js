// Owner 2026-11-25 adconsole102: read-only campaign/platform attribution and operator CSV export.
(function attachConsoleTenkeyAds(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  let generation = 0;
  const tableMessage = (text) => { byId("tenkeyAdsTable").innerHTML = `<tr><td colspan="5" class="empty-panel">${esc(text)}</td></tr>`; };

  async function load() {
    const request = ++generation;
    const days = Number(byId("tenkeyAdsDays").value);
    tableMessage("불러오는 중입니다.");
    T.setMessage("tenkeyAdsMessage", "광고 성과를 불러오는 중입니다.");
    try {
      const rows = await T.stats("ads.summary", { days });
      if (request !== generation) return;
      if (!Array.isArray(rows)) throw new Error("집계 응답 형식을 확인해 주세요.");
      byId("tenkeyAdsTable").innerHTML = rows.map((r) => `<tr>
        <td data-label="캠페인">${esc(r.utm_campaign === "(none)" ? "캠페인 표시 없음" : r.utm_campaign)}</td>
        <td data-label="플랫폼">${esc(({ android: "Android", ios: "iOS" })[r.platform] || r.platform)}</td>
        <td class="tk-num" data-label="기록">${esc(num(r.rows))}</td>
        <td class="tk-num" data-label="구매자(닉네임 완료)">${esc(num(r.buyers))}</td>
        <td class="tk-num" data-label="광고 클릭 있음">${esc(num(r.with_gclid))}</td>
      </tr>`).join("");
      if (!rows.length) tableMessage("이 기간에 기록이 없습니다.");
      T.setMessage("tenkeyAdsMessage", `최근 ${days}일 · ${rows.length}개 캠페인·플랫폼 묶음`);
    } catch (error) {
      if (request !== generation) return;
      tableMessage("집계를 불러오지 못했습니다.");
      T.report("tenkeyAdsMessage", error);
    }
  }

  async function download(event) {
    event.preventDefault();
    if (byId("tenkeyAdsDownload").disabled || !byId("tenkeyAdsUploadForm").reportValidity()) return;
    const day = byId("tenkeyAdsSince").value;
    const date = new Date(`${day}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
      T.setMessage("tenkeyAdsUploadMessage", "시작 날짜를 확인해 주세요.", true);
      return;
    }
    const format = event.submitter?.value === "legacy" ? "legacy" : "data_manager";
    byId("tenkeyAdsDownload").disabled = byId("tenkeyAdsLegacy").disabled = true;
    T.setMessage("tenkeyAdsUploadMessage", "업로드 파일을 만드는 중입니다.");
    try {
      const data = await T.stats("ads.upload", { since: `${day}T00:00:00Z`, format });
      if (!data || typeof data.csv !== "string") throw new Error("파일 응답 형식을 확인해 주세요.");
      const url = URL.createObjectURL(new Blob([data.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `10key-buyers-${day}-${format}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      T.setMessage("tenkeyAdsUploadMessage", `${num(data.rows)}건 다운로드함 · Google에 아직 전송하지 않았습니다.`
        + (data.omitted ? ` GBRAID/WBRAID ${num(data.omitted)}건은 전체 클릭용 파일에서 받으세요.` : ""));
    } catch (error) {
      T.report("tenkeyAdsUploadMessage", error);
    } finally {
      byId("tenkeyAdsDownload").disabled = byId("tenkeyAdsLegacy").disabled = false;
    }
  }

  function mountAds() {
    const form = byId("tenkeyAdsForm");
    if (form.dataset.wired !== "1") {
      form.dataset.wired = "1";
      form.addEventListener("submit", (event) => { event.preventDefault(); return load(); });
      byId("tenkeyAdsDays").addEventListener("change", load);
      byId("tenkeyAdsUploadForm").addEventListener("submit", download);
      const today = new Date();
      byId("tenkeyAdsSince").max = today.toISOString().slice(0, 10);
      byId("tenkeyAdsSince").value = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    }
    load();
  }
  T.mountAds = mountAds;
})(window);
