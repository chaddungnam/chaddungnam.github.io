(function attachConsoleNotes(root) {
  const state = { rows: [], editing: null, dirty: false, bound: false, requestSeq: 0, loaded: false };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  const time = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const errorText = {
    version_conflict: "다른 창에서 먼저 고친 메모입니다. 지금 쓴 내용을 복사해 두고 새로고침한 뒤 다시 고쳐 주세요.",
    record_not_found: "이미 삭제된 메모입니다. 지금 쓴 내용을 복사해 두고 새 메모로 저장해 주세요.",
    invalid_note: "제목(120자까지), 내용(2만 자까지), 태그(8개·태그당 24자까지)를 확인해 주세요.",
  };

  function setMessage(value, error = false) {
    root.ConsoleUiState.setMessage(byId("notesMessage"), value, error);
    byId("notesMessage").style.color = error ? "var(--coral)" : "";
  }

  function noteMatches(note, query, tag) {
    if (tag && !note.tags.some((item) => item.toLocaleLowerCase("ko-KR") === tag)) return false;
    if (!query) return true;
    return [note.title, note.body, note.tags.join(" ")].join("\n").toLocaleLowerCase("ko-KR").includes(query);
  }

  function renderTagOptions() {
    const select = byId("notesTag");
    const current = select.value;
    const tags = new Map();
    state.rows.forEach((note) => note.tags.forEach((tag) => {
      const key = tag.toLocaleLowerCase("ko-KR");
      if (!tags.has(key)) tags.set(key, tag);
    }));
    select.innerHTML = '<option value="">전체 태그</option>' + [...tags.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "ko-KR"))
      .map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("");
    select.value = tags.has(current) ? current : "";
  }

  function renderList() {
    const query = byId("notesQuery").value.trim().toLocaleLowerCase("ko-KR");
    const tag = byId("notesTag").value;
    const rows = state.rows.filter((note) => noteMatches(note, query, tag));
    const filtered = query || tag;
    byId("notesTotal").textContent = filtered
      ? `${rows.length.toLocaleString("ko-KR")} / ${state.rows.length.toLocaleString("ko-KR")}건`
      : `${state.rows.length.toLocaleString("ko-KR")}건`;
    byId("notesList").innerHTML = rows.length ? rows.map((note) => {
      const edited = note.updated_at && note.updated_at !== note.created_at;
      const badges = [
        note.pinned ? '<span class="player-note-badge player-note-tracked">고정</span>' : "",
        ...note.tags.map((item) => `<span class="player-note-badge">${escapeHtml(item)}</span>`),
      ].join("");
      return `<article class="audit-item note-item" data-note-id="${escapeHtml(note.id)}" data-pinned="${note.pinned}"><div><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(time(note.created_at))} 작성 · ${escapeHtml(note.author)}${edited ? ` · ${escapeHtml(time(note.updated_at))} 수정` : ""}</small></div>${badges ? `<span class="player-note-badges">${badges}</span>` : ""}${note.body.trim() ? `<p class="note-body">${escapeHtml(note.body)}</p>` : ""}<div class="detail-actions"><button type="button" data-note-edit="${escapeHtml(note.id)}">고치기</button></div></article>`;
    }).join("") : `<p class="empty-panel">${state.rows.length ? "검색·태그 조건과 맞는 메모가 없습니다." : "아직 메모가 없습니다. ‘새 메모’로 판단 기록을 남겨 보세요."}</p>`;
  }

  function normalize(row) {
    return {
      id: String(row?.id || ""), title: String(row?.title || ""), body: String(row?.body || ""),
      tags: Array.isArray(row?.tags) ? row.tags.map(String) : [], pinned: row?.pinned === true,
      created_at: row?.created_at || "", updated_at: row?.updated_at || "",
      author: String(row?.author || ""), updated_by: String(row?.updated_by || ""),
    };
  }

  async function load() {
    const requestSeq = ++state.requestSeq;
    const panel = byId("notesList").closest(".panel");
    panel?.setAttribute("aria-busy", "true");
    if (!state.loaded) setMessage("메모를 불러오는 중입니다.");
    try {
      const data = await root.ConsoleAPI.post("admin-console", { action: "notes.list" });
      if (requestSeq !== state.requestSeq) return;
      state.rows = (Array.isArray(data.rows) ? data.rows : []).map(normalize);
      state.loaded = true;
      renderTagOptions();
      renderList();
      setMessage("");
    } catch (error) {
      if (requestSeq !== state.requestSeq) return;
      setMessage(`메모를 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      if (requestSeq === state.requestSeq) panel?.setAttribute("aria-busy", "false");
    }
  }

  function setDirty(value) {
    state.dirty = value;
    byId("noteEditorState").textContent = value
      ? "저장하지 않은 변경이 있습니다 · ‘저장’을 눌러야 서버에 남습니다"
      : "쉼표로 태그 최대 8개 · 태그당 24자 · ‘저장’을 눌러야 서버에 남습니다";
    byId("noteEditorState").dataset.dirty = String(value);
  }

  async function confirmDiscard() {
    if (!state.dirty) return true;
    return root.ConsoleApp.confirmChange("저장하지 않은 메모", "고친 내용이 저장되지 않았습니다. 버리고 넘어갈까요?");
  }

  function openEditor(note) {
    const form = byId("noteEditor");
    state.editing = note ? { id: note.id, updatedAt: note.updated_at, isNew: false } : { id: crypto.randomUUID(), updatedAt: null, isNew: true };
    form.elements.title.value = note?.title || "";
    form.elements.tags.value = (note?.tags || []).join(", ");
    form.elements.body.value = note?.body || "";
    form.elements.pinned.checked = note?.pinned === true;
    byId("noteEditorTitle").textContent = note ? "메모 고치기" : "새 메모";
    byId("noteEditorMeta").textContent = note
      ? `${time(note.created_at)} ${note.author} 작성${note.updated_at !== note.created_at ? ` · 마지막 수정 ${time(note.updated_at)} ${note.updated_by}` : ""}`
      : "줄바꿈은 그대로 보입니다. ‘- ’로 시작하면 목록처럼 읽힙니다.";
    byId("noteDelete").hidden = !note;
    form.hidden = false;
    setDirty(false);
    form.scrollIntoView({ block: "start", behavior: "auto" });
    form.elements.title.focus({ preventScroll: true });
  }

  function closeEditor() {
    byId("noteEditor").hidden = true;
    state.editing = null;
    setDirty(false);
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!state.editing) return;
    const title = form.elements.title.value.trim();
    if (!title) { setMessage("제목을 써 주세요.", true); form.elements.title.focus(); return; }
    const tags = root.ConsoleModel.parsePlayerTags(form.elements.tags.value);
    if (tags.length > 8 || tags.some((tag) => tag.length > 24)) { setMessage(errorText.invalid_note, true); return; }
    const finishRequest = root.ConsoleUiState.beginRequest(form);
    if (!finishRequest) return;
    setMessage("저장하는 중입니다.");
    try {
      const data = await root.ConsoleAPI.post("admin-console", {
        action: "notes.save", noteId: state.editing.id, title, body: form.elements.body.value,
        tags, pinned: form.elements.pinned.checked, expectedUpdatedAt: state.editing.updatedAt,
      });
      const saved = normalize(data.note);
      state.rows = [saved, ...state.rows.filter((note) => note.id !== saved.id)]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.created_at).localeCompare(String(a.created_at)));
      closeEditor();
      renderTagOptions();
      renderList();
      setMessage(`‘${saved.title}’ 메모를 저장했습니다.`);
    } catch (error) {
      setMessage(`저장하지 못했습니다. 쓴 내용은 화면에 그대로 있습니다. ${errorText[error?.message] || error?.message || "알 수 없는 오류"}`, true);
    } finally {
      finishRequest();
    }
  }

  async function remove() {
    if (!state.editing || state.editing.isNew) return;
    const note = state.rows.find((item) => item.id === state.editing.id);
    if (!await root.ConsoleApp.confirmChange("메모 삭제", `‘${note?.title || "이 메모"}’를 지웁니다. 지운 메모는 되돌릴 수 없습니다.`)) return;
    const finishRequest = root.ConsoleUiState.beginRequest(byId("noteEditor"));
    if (!finishRequest) return;
    try {
      await root.ConsoleAPI.post("admin-console", { action: "notes.delete", noteId: state.editing.id });
      state.rows = state.rows.filter((item) => item.id !== state.editing.id);
      closeEditor();
      renderTagOptions();
      renderList();
      setMessage(`‘${note?.title || "메모"}’를 삭제했습니다.`);
    } catch (error) {
      setMessage(`삭제하지 못했습니다: ${error?.message || "알 수 없는 오류"}`, true);
    } finally {
      finishRequest();
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    const form = byId("noteEditor");
    byId("notesFilterForm").addEventListener("submit", (event) => { event.preventDefault(); renderList(); });
    byId("notesQuery").addEventListener("input", renderList);
    byId("notesTag").addEventListener("change", renderList);
    byId("notesNewButton").addEventListener("click", async () => { if (await confirmDiscard()) openEditor(null); });
    byId("noteCancel").addEventListener("click", async () => { if (await confirmDiscard()) closeEditor(); });
    byId("noteDelete").addEventListener("click", remove);
    form.addEventListener("input", () => setDirty(true));
    form.addEventListener("submit", save);
    byId("notesList").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-note-edit]");
      if (!button) return;
      const note = state.rows.find((item) => item.id === button.dataset.noteEdit);
      if (note && await confirmDiscard()) openEditor(note);
    });
    root.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function mount() {
    bind();
    load();
  }

  root.ConsoleNotes = { mount, hasUnsavedChanges: () => state.dirty };
})(window);
