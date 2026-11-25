// 10key Survival: 퀘스트 밸런스 (questmon102, owner 2026-11-25).
// Read-only. tenkey-console-stats "quest.balance" -> tenkey.admin_quest_balance_v1.
// Per quest: offered / finished / claimed, claim %, gems, a day trend. Plus gems per UTC day (cap watch)
// and a never-finished row. Counts only; no player id.
(function attachConsoleTenkeyQuests(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const pct = (v) => (v == null || v === "" ? "\u2014" : num(v) + "%");
  const kindName = (k) => ({ daily: "\uc77c\uc77c", weekly: "\uc8fc\uac04", daily_bonus: "\uc77c\uc77c \ubcf4\ub108\uc2a4", weekly_bonus: "\uc8fc\uac04 \ubcf4\ub108\uc2a4" }[k] || k || "\u2014");

  function bars(trend) {
    const rows = Array.isArray(trend) ? trend : [];
    const max = Math.max(1, ...rows.map((d) => Number(d.claimed) || 0));
    return '<span class="tk-qbars" title="\uc218\ub839">' + rows.map((d) => {
      const h = Math.max(1, Math.round(((Number(d.claimed) || 0) / max) * 18));
      const on = (Number(d.claimed) || 0) > 0 ? " is-on" : "";
      return '<i class="' + on.trim() + '" style="height:' + h + 'px" title="' + esc(d.day) + " \uc218\ub839 " + esc(num(d.claimed)) + " \uc82c " + esc(num(d.gems)) + '"></i>';
    }).join("") + "</span>";
  }

  function render(d) {
    const quests = Array.isArray(d && d.quests) ? d.quests : [];
    const gems = Array.isArray(d && d.gems_by_day) ? d.gems_by_day : [];
    const never = Array.isArray(d && d.never_finished) ? d.never_finished : [];
    const gemSum = gems.reduce((s, row) => s + (Number(row.gems) || 0), 0);
    const offered = quests.reduce((s, row) => s + (Number(row.offered) || 0), 0);
    const finished = quests.reduce((s, row) => s + (Number(row.finished) || 0), 0);
    const claimed = quests.reduce((s, row) => s + (Number(row.claimed) || 0), 0);
    const sum = byId("tenkeyQuestSummary");
    sum.querySelector("[data-quest-summary=quests]").textContent = num(quests.length);
    sum.querySelector("[data-quest-summary=offered]").textContent = num(offered);
    sum.querySelector("[data-quest-summary=finished]").textContent = num(finished);
    sum.querySelector("[data-quest-summary=claimed]").textContent = num(claimed);
    sum.querySelector("[data-quest-summary=gems]").textContent = num(gemSum);
    sum.querySelector("[data-quest-summary=never]").textContent = num(never.length);
    byId("tenkeyQuestTable").innerHTML = quests.map((q) => "<tr>"
      + '<td data-label="\ud018\uc2a4\ud2b8"><code>' + esc(q.quest) + "</code></td>"
      + '<td data-label="\uc885\ub958">' + esc(kindName(q.kind)) + "</td>"
      + '<td class="tk-num" data-label="\uc81c\uacf5">' + esc(num(q.offered)) + "</td>"
      + '<td class="tk-num" data-label="\uc644\ub8cc">' + esc(num(q.finished)) + "</td>"
      + '<td class="tk-num" data-label="\uc218\ub839">' + esc(num(q.claimed)) + "</td>"
      + '<td class="tk-num" data-label="\uc218\ub839\ub960">' + esc(pct(q.claim_pct)) + "</td>"
      + '<td class="tk-num" data-label="\uc82c">' + esc(num(q.gems)) + "</td>"
      + '<td data-label="\ucd94\uc138">' + bars(q.trend) + "</td>"
      + "</tr>").join("") || '<tr><td colspan="8" class="empty-panel">\uc774 \uae30\uac04\uc5d0 \uc9d1\uacc4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \ub864\uc624\ubc84 \uae30\ub85d\uc740 \ub2e4\uc74c \ube4c\ub4dc\ubd80\ud130 \uc313\uc785\ub2c8\ub2e4.</td></tr>';
    const watch = '<span class="tk-badge" data-tone="risk">\ud3c9\uc18c\uc758 2\ubc30 \uc774\uc0c1</span>';
    byId("tenkeyQuestGems").innerHTML = gems.map((row) => "<tr>"
      + '<td data-label="\ub0a0">' + esc(row.day) + "</td>"
      + '<td class="tk-num" data-label="\uc82c">' + esc(num(row.gems)) + "</td>"
      + '<td data-label="\uac10\uc2dc">' + (row.cap_watch ? watch : "\u2014") + "</td>"
      + "</tr>").join("") || '<tr><td colspan="3" class="empty-panel">\uc82c \uc9c0\uae09\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</td></tr>';
    const box = byId("tenkeyQuestNever");
    if (!never.length) {
      box.hidden = true;
      box.innerHTML = "";
    } else {
      box.hidden = false;
      box.innerHTML = '<p class="eyebrow">NEVER FINISHED</p><h2>\uc81c\uacf5\ub410\ub294\ub370 \ud55c \ubc88\ub3c4 \uc644\ub8cc\ub418\uc9c0 \uc54a\uc74c</h2><p>'
        + never.map((id) => "<code>" + esc(id) + "</code>").join(" ") + "</p>";
    }
  }

  async function load() {
    const days = Number(byId("tenkeyQuestDays").value) || 14;
    T.setMessage("tenkeyQuestMessage", "\ud018\uc2a4\ud2b8 \ubc38\ub7f0\uc2a4\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4...");
    try {
      render(await T.stats("quest.balance", { days }));
      T.setMessage("tenkeyQuestMessage", new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + " \uae30\uc900 \u00b7 \ucd5c\uadfc " + days + "\uc77c");
    } catch (error) {
      T.report("tenkeyQuestMessage", error);
    }
  }

  function mountQuests() {
    const form = byId("tenkeyQuestForm");
    if (form.dataset.wired !== "1") {
      form.dataset.wired = "1";
      form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
    }
    load();
  }

  T.mountQuests = mountQuests;
})(window);
