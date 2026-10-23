// 10key Survival: 공지. In-game notices live in tenkey.notices; the app reads the active ones through tenkey.notices_v1(lang)
// (priority high first, then newest). This page creates / edits / schedules / ends / deletes them. Times are typed and shown in
// KST (computed by hand, not the admin's browser time zone). Korean and English are both required here so an English device
// never falls back to Korean by accident; the preview shows both as the app would.
(function attachConsoleTenkeyNotices(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const state = { bound: false, notices: new Map() };
  const STATUS = { live: ["게시 중", "good"], scheduled: ["예약", "watch"], ended: ["종료", "quiet"], off: ["꺼짐", "risk"] };
  const KST_OFFSET_MIN = 9 * 60;
  const pad = (n) => String(n).padStart(2, "0");

  function isoToKstInput(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    const s = new Date(date.getTime() + KST_OFFSET_MIN * 60000);
    return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}T${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
  }
  function kstInputToIso(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!m) return "";
    const [y, mo, d, h, mi] = m.slice(1).map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MIN * 60000).toISOString();
  }
  const kstText = (value) => {
    const input = isoToKstInput(value);
    return input ? `${input.replace("T", " ")} KST` : "—";
  };

  function updatePreview() {
    const f = byId("tenkeyNoticeForm").elements;
    const period = `${f.startsAt.value ? f.startsAt.value.replace("T", " ") : "—"} → ${f.endsAt.value ? f.endsAt.value.replace("T", " ") : "계속"} (KST)`;
    const draw = (id, title, body, fallback, note) => {
      const el = byId(id);
      el.classList.toggle("is-fallback", fallback);
      el.innerHTML = `<strong>${esc(title || "(제목 없음)")}</strong><p>${esc(body || "(본문 없음)")}</p><small>${esc(fallback ? "영어가 비어 있어 한국어가 나갑니다 · " : "")}${esc(note)}</small>`;
    };
    draw("tenkeyNoticePreviewKo", f.titleKo.value.trim(), f.bodyKo.value.trim(), false, `우선순위 ${f.priority.value || 0} · ${period}`);
    const enEmpty = !f.titleEn.value.trim() && !f.bodyEn.value.trim();
    draw("tenkeyNoticePreviewEn", f.titleEn.value.trim() || f.titleKo.value.trim(), f.bodyEn.value.trim() || f.bodyKo.value.trim(), enEmpty, `priority ${f.priority.value || 0}`);
  }

  function updateCounters() {
    const form = byId("tenkeyNoticeForm");
    form.querySelectorAll("[data-counter]").forEach((el) => {
      const field = form.elements[el.dataset.counter];
      el.textContent = `${Array.from(field.value).length} / ${field.maxLength}자`;
    });
  }

  function syncSubmitLabel() {
    const form = byId("tenkeyNoticeForm");
    const editing = Boolean(form.elements.noticeId.value);
    const button = form.querySelector("button[type=submit]");
    button.textContent = editing ? button.dataset.editLabel : button.dataset.submitLabel;
    byId("tenkeyNoticeFormTitle").textContent = editing ? `공지 수정 #${form.elements.noticeId.value}` : "공지 작성";
  }

  function resetForm() {
    const form = byId("tenkeyNoticeForm");
    form.reset();
    form.elements.noticeId.value = "";
    form.elements.active.checked = true;
    form.elements.priority.value = 0;
    form.elements.startsAt.value = isoToKstInput(new Date().toISOString());
    syncSubmitLabel();
    updateCounters();
    updatePreview();
    T.setMessage("tenkeyNoticeFormMessage", "");
  }

  function fillForm(notice) {
    const form = byId("tenkeyNoticeForm");
    const f = form.elements;
    f.noticeId.value = notice.id;
    f.titleKo.value = notice.title_ko || "";
    f.titleEn.value = notice.title_en || "";
    f.bodyKo.value = notice.body_ko || "";
    f.bodyEn.value = notice.body_en || "";
    f.priority.value = Number.isInteger(notice.priority) ? notice.priority : 0;
    f.active.checked = notice.active !== false;
    f.startsAt.value = isoToKstInput(notice.starts_at);
    f.endsAt.value = isoToKstInput(notice.ends_at);
    f.reason.value = "";
    syncSubmitLabel();
    updateCounters();
    updatePreview();
    form.scrollIntoView({ block: "start" });
    f.titleKo.focus();
  }

  function rowMarkup(n) {
    const [label, tone] = STATUS[n.status] || [n.status, "quiet"];
    const canEnd = n.status === "live" || n.status === "scheduled";
    const excerpt = Array.from(String(n.body_ko || "").replace(/\s+/g, " ")).slice(0, 110).join("");
    return `<article class="audit-item" data-notice-id="${esc(n.id)}">
      <div><strong>#${esc(n.id)} ${esc(n.title_ko)}${n.title_en ? ` <span class="tk-sub" style="display:inline">/ ${esc(n.title_en)}</span>` : ' <span class="tk-badge" data-tone="watch">영어 없음</span>'}</strong>
      <small>${esc(kstText(n.starts_at))} → ${n.ends_at ? esc(kstText(n.ends_at)) : "계속"} · 우선순위 ${esc(n.priority)}</small></div>
      <p>${esc(excerpt)}</p>
      <div class="audit-meta"><span class="tk-badge" data-tone="${tone}">${esc(label)}</span><small>${esc(n.updated_by || n.created_by || "")}</small></div>
      <div class="tk-actions"><button type="button" class="warning-button" data-edit-notice="${esc(n.id)}">수정</button>${canEnd ? `<button type="button" data-end-notice="${esc(n.id)}">지금 종료</button>` : ""}<button type="button" class="danger-button" data-delete-notice="${esc(n.id)}" aria-label="공지 #${esc(n.id)} 삭제">삭제</button></div>
    </article>`;
  }

  function renderList() {
    const rows = Array.from(state.notices.values());
    byId("tenkeyNoticesTotal").textContent = `${num(rows.length)}건`;
    byId("tenkeyNoticesListing").innerHTML = rows.length ? rows.map(rowMarkup).join("") : '<p class="empty-panel">등록된 공지가 없습니다.</p>';
  }

  async function load() {
    T.setMessage("tenkeyNoticesMessage", "공지 목록을 불러오는 중입니다...");
    try {
      const result = await T.call("notices.list", {});
      state.notices.clear();
      (Array.isArray(result.data) ? result.data : []).forEach((n) => state.notices.set(Number(n.id), n));
      renderList();
      T.setMessage("tenkeyNoticesMessage", "종료는 기록으로 남고 앱에서만 사라지며, 삭제는 되돌릴 수 없습니다. 종료한 공지는 1년 뒤 자동으로 지워집니다.");
    } catch (error) {
      T.report("tenkeyNoticesMessage", error);
    }
  }

  function collect(form) {
    const f = form.elements;
    const startsAt = kstInputToIso(f.startsAt.value);
    const endsAt = f.endsAt.value ? kstInputToIso(f.endsAt.value) : "";
    return {
      reason: f.reason.value.trim(),
      notice: {
        ...(f.noticeId.value ? { id: Number(f.noticeId.value) } : {}),
        title_ko: f.titleKo.value.trim(), title_en: f.titleEn.value.trim(),
        body_ko: f.bodyKo.value.trim(), body_en: f.bodyEn.value.trim(),
        priority: Number(f.priority.value || 0), active: f.active.checked,
        starts_at: startsAt, ends_at: endsAt,
      },
    };
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const finish = root.ConsoleUiState.beginRequest(form);
    if (!finish) return;
    try {
      if (!form.reportValidity()) return;
      const { notice, reason } = collect(form);
      if (!notice.starts_at) { T.setMessage("tenkeyNoticeFormMessage", T.errorText({ message: "invalid_starts_at" }), true); return; }
      if (notice.ends_at && Date.parse(notice.ends_at) <= Date.parse(notice.starts_at)) { T.setMessage("tenkeyNoticeFormMessage", T.errorText({ message: "invalid_ends_at" }), true); return; }
      const scheduled = Date.parse(notice.starts_at) > Date.now();
      const summary = [`제목: ${notice.title_ko} / ${notice.title_en}`, `게시: ${kstText(notice.starts_at)} → ${notice.ends_at ? kstText(notice.ends_at) : "계속"}`,
        scheduled ? "시작 시각 전까지는 앱에 보이지 않습니다 (예약)." : "지금부터 앱에 보입니다.", `켜짐: ${notice.active ? "예" : "아니오"} · 우선순위 ${notice.priority}`, `사유: ${reason}`].join("\n");
      if (!await root.ConsoleApp.confirmChange(notice.id ? `공지 #${notice.id} 수정` : "공지 발행", summary)) return;
      T.setMessage("tenkeyNoticeFormMessage", "저장하는 중입니다...");
      await T.call("notices.save", { notice, reason }, form);
      resetForm();
      await load();
      T.setMessage("tenkeyNoticesMessage", scheduled ? "공지를 예약했습니다." : "공지를 발행했습니다.");
    } catch (error) {
      T.report("tenkeyNoticeFormMessage", error);
    } finally {
      finish();
    }
  }

  async function act(action, id, title, body) {
    const reason = await T.askReason(title, body);
    if (!reason) return;
    try {
      await T.call(action, { id, reason }, byId(`tenkeyNoticesListing`));
      await load();
      T.setMessage("tenkeyNoticesMessage", action === "notices.end" ? "공지를 종료했습니다." : "공지를 삭제했습니다.");
    } catch (error) {
      T.report("tenkeyNoticesMessage", error);
    }
  }

  function mountNotices() {
    if (!state.bound) {
      state.bound = true;
      const form = byId("tenkeyNoticeForm");
      form.addEventListener("submit", submit);
      form.addEventListener("input", () => { updateCounters(); updatePreview(); });
      byId("tenkeyNoticeReset").addEventListener("click", resetForm);
      byId("tenkeyNoticesListing").addEventListener("click", (event) => {
        const edit = event.target.closest("[data-edit-notice]");
        const end = event.target.closest("[data-end-notice]");
        const del = event.target.closest("[data-delete-notice]");
        if (edit) fillForm(state.notices.get(Number(edit.dataset.editNotice)));
        if (end) { const n = state.notices.get(Number(end.dataset.endNotice)); act("notices.end", n.id, `공지 #${n.id} 지금 종료`, `${n.title_ko}\n앱에서 바로 사라집니다 (기록은 남음).`); }
        if (del) { const n = state.notices.get(Number(del.dataset.deleteNotice)); act("notices.delete", n.id, `공지 #${n.id} 삭제`, `${n.title_ko}\n지우면 되돌릴 수 없습니다.`); }
      });
      resetForm();
    }
    load();
  }

  T.mountNotices = mountNotices;
})(window);
