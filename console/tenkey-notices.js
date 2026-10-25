// 10key Survival: 공지. In-game notices live in tenkey.notices; the app reads the active ones through tenkey.notices_v1(lang)
// (priority high first, then newest) in its own language. This page creates / edits / schedules / ends / deletes them. Times
// are typed and shown in KST (computed by hand, not the admin's browser time zone).
// Owner 2026-10-25 ("내가 한국어를 작성하면 나머지도 알아서 번역되게끔 (쿼키볼 공지사항처럼)"): only Korean is typed. The other seven
// game languages come from the same keyless Google translation as Quirky Ball's notices, asked from this browser first (it
// refused the Supabase servers with HTTP 429 on the first live try) and from tenkey-admin (notices.translate) for whatever the
// browser could not get: "번역 미리 보기" fills the preview cards, and publishing translates whatever is still missing first,
// so a notice is never saved half translated. A card can be corrected by hand ("고치기"); a correction is kept while the Korean stays the same,
// and changing the Korean marks the translations as old (they are made again on publish).
(function attachConsoleTenkeyNotices(root) {
  const T = root.ConsoleTenkey;
  const { esc, num } = T.fmt;
  const byId = (id) => document.getElementById(id);
  const LANGS = [["en", "영어"], ["ja", "일본어"], ["de", "독일어"], ["zh_TW", "중국어(번체)"], ["fr", "프랑스어"], ["es", "스페인어"], ["pt", "포르투갈어"]];
  const state = { bound: false, notices: new Map(), tr: emptyTranslations() };
  const STATUS = { live: ["게시 중", "good"], scheduled: ["예약", "watch"], ended: ["종료", "quiet"], off: ["꺼짐", "risk"] };
  const KST_OFFSET_MIN = 9 * 60;
  const pad = (n) => String(n).padStart(2, "0");

  // source = the Korean (title, body) the texts were made for; texts = {lang: {title, body}}; edited = langs fixed by hand.
  function emptyTranslations() { return { source: "", texts: {}, edited: new Set(), editing: "", busy: false }; }

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

  const korean = () => {
    const f = byId("tenkeyNoticeForm").elements;
    return { title: f.titleKo.value.trim(), body: f.bodyKo.value.trim() };
  };
  const sourceKey = ({ title, body }) => JSON.stringify([title, body]);
  const fresh = () => state.tr.source !== "" && state.tr.source === sourceKey(korean());
  const missingLangs = () => LANGS.map(([lang]) => lang).filter((lang) => !fresh() || !state.tr.texts[lang]);

  // The browser's copy of tenkey-admin translate.ts: the game's name becomes each language's store title, House Duck stays in
  // Latin letters, the title is the first line and the body follows, the answer must keep the Korean's lines (text / blank),
  // three tries per language.
  const GTX_URL = "https://translate.googleapis.com/translate_a/single";
  const GTX_TARGET = { en: "en", ja: "ja", de: "de", zh_TW: "zh-TW", fr: "fr", es: "es", pt: "pt" };
  const GAME_NAME = { en: "10key Survival", ja: "ポチサバイバー", de: "Klick-Survival", zh_TW: "咔噠求生", fr: "Clic Survie", es: "Clic Survival", pt: "Clique Survival" };
  const GAME_TOKEN = "TKZQ";
  const textLines = (text) => text.replace(/\r\n?/g, "\n").split("\n");
  const shape = (text) => textLines(text).map((line) => (line.trim() ? "t" : "b")).join("");
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function browserTranslateOne(source, lang) {
    for (const delay of [0, 500, 1500]) {
      if (delay) await pause(delay);
      try {
        const response = await fetch(GTX_URL, {
          method: "POST", credentials: "omit", signal: AbortSignal.timeout(15000),
          body: new URLSearchParams({ client: "gtx", sl: "ko", tl: GTX_TARGET[lang], dt: "t", q: source }),
        });
        const data = await response.json();
        const parts = response.ok && Array.isArray(data?.[0]) ? data[0] : [];
        const out = parts.map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : "")).join("").replaceAll(GAME_TOKEN, GAME_NAME[lang]);
        if (!out || shape(out) !== shape(source)) continue;
        const [first, ...rest] = textLines(out);
        const text = { title: first.trim(), body: rest.join("\n").trim() };
        if (text.title && text.body && text.title.length <= 300 && text.body.length <= 8000) return text;
      } catch { /* the next try */ }
    }
    return null;
  }
  // {lang: {title, body}} for the languages of `langs` the browser got; the others are left out.
  async function browserTranslate({ title, body }, langs) {
    const source = `${title}\n${textLines(body).join("\n")}`.replace(/딸깍\s*서바이벌/g, GAME_TOKEN).replace(/하우스\s*덕/g, "House Duck");
    const done = await Promise.all(langs.map(async (lang) => [lang, await browserTranslateOne(source, lang)]));
    return Object.fromEntries(done.filter(([, text]) => text));
  }

  // Languages a saved notice already has (old rows have only the English columns).
  function savedTexts(notice) {
    const texts = {};
    LANGS.forEach(([lang]) => {
      const t = notice?.translations?.[lang];
      if (t && t.title && t.body) texts[lang] = { title: t.title, body: t.body };
    });
    if (!texts.en && notice?.title_en && notice?.body_en) texts.en = { title: notice.title_en, body: notice.body_en };
    return texts;
  }
  const languageCount = (notice) => 1 + Object.keys(savedTexts(notice)).length;

  function card(lang, name, text, { note = "", edited = false, editable = false, editing = false, old = false } = {}) {
    const badge = edited ? '<span class="tk-badge" data-tone="watch">직접 고침</span>' : "";
    const action = editable ? `<button type="button" class="tenkey-tr-edit" data-tr-toggle="${lang}">${editing ? "고치기 끝" : "고치기"}</button>` : "";
    const body = editing
      ? `<label>제목<input data-tr-lang="${lang}" data-tr-field="title" maxlength="300" value="${esc(text.title)}"></label><label>본문<textarea data-tr-lang="${lang}" data-tr-field="body" maxlength="8000" rows="6">${esc(text.body)}</textarea></label>`
      : `<strong>${esc(text.title || "(제목 없음)")}</strong><p>${esc(text.body || "(본문 없음)")}</p>`;
    return `<article class="tenkey-notice-card${old ? " is-old" : ""}${editing ? " is-editing" : ""}" lang="${esc(lang.replace("_", "-"))}">
      <header class="tenkey-card-head"><span class="tenkey-card-lang">${esc(name)}</span>${badge}${action}</header>${body}${note ? `<small>${esc(note)}</small>` : ""}</article>`;
  }

  function updatePreview() {
    const f = byId("tenkeyNoticeForm").elements;
    const ko = korean();
    const period = `${f.startsAt.value ? f.startsAt.value.replace("T", " ") : "—"} → ${f.endsAt.value ? f.endsAt.value.replace("T", " ") : "계속"} (KST)`;
    const tr = state.tr;
    const isFresh = fresh();
    const done = LANGS.filter(([lang]) => tr.texts[lang]);
    const waiting = LANGS.filter(([lang]) => !tr.texts[lang]);
    const cards = [card("ko", "한국어 (직접 쓴 글)", ko, { note: `우선순위 ${f.priority.value || 0} · ${period}` })];
    done.forEach(([lang, name]) => cards.push(card(lang, name, tr.texts[lang], {
      edited: tr.edited.has(lang), editable: isFresh && !tr.busy, editing: isFresh && tr.editing === lang, old: !isFresh,
    })));
    if (waiting.length) {
      cards.push(`<article class="tenkey-notice-card is-waiting"><header class="tenkey-card-head"><span class="tenkey-card-lang">${esc(waiting.map(([, name]) => name).join(" · "))}</span></header>
        <p>${tr.busy ? "번역하는 중입니다…" : "발행할 때 자동으로 번역됩니다. 먼저 보려면 위의 ‘번역 미리 보기’를 누르세요."}</p></article>`);
    }
    byId("tenkeyNoticePreviews").innerHTML = cards.join("");

    let status;
    if (tr.busy) status = "7개 언어로 번역하는 중입니다…";
    else if (!done.length) status = "다른 언어는 아직 없음 · 발행할 때 자동 번역";
    else if (!isFresh) status = `한국어가 바뀌어 아래 번역은 예전 글입니다 · 발행할 때 다시 번역${tr.edited.size ? " (직접 고친 번역도 다시 만들어짐)" : ""}`;
    else if (waiting.length) status = `${done.length + 1}개 언어 준비 · 나머지 ${waiting.length}개는 발행할 때 자동 번역`;
    else status = `8개 언어 준비 완료${tr.edited.size ? ` · 직접 고친 것 ${tr.edited.size}개` : ""} · 이대로 발행됩니다`;
    byId("tenkeyNoticeTrStatus").textContent = status;
    const button = byId("tenkeyNoticeTranslate");
    button.textContent = isFresh && !waiting.length ? "다시 번역" : "번역 미리 보기";
    button.disabled = tr.busy;
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
    state.tr = emptyTranslations();
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
    f.bodyKo.value = notice.body_ko || "";
    f.priority.value = Number.isInteger(notice.priority) ? notice.priority : 0;
    f.active.checked = notice.active !== false;
    f.startsAt.value = isoToKstInput(notice.starts_at);
    f.endsAt.value = isoToKstInput(notice.ends_at);
    f.reason.value = "";
    state.tr = { ...emptyTranslations(), source: sourceKey(korean()), texts: savedTexts(notice) };
    syncSubmitLabel();
    updateCounters();
    updatePreview();
    form.scrollIntoView({ block: "start" });
    f.titleKo.focus();
  }

  // Fills the preview: the browser first, tenkey-admin for the languages it could not get. keep = the Korean has not changed,
  // so languages already there (loaded or fixed by hand) stay and only the missing ones are taken. Returns false when the
  // Korean changed while translating; throws (keeping what the browser got) when the server fails too.
  async function translate(keep) {
    const ko = korean();
    const key = sourceKey(ko);
    const kept = keep ? state.tr.texts : {};
    state.tr.busy = true;
    state.tr.editing = "";
    updatePreview();
    const store = (got) => {
      const texts = {};
      LANGS.forEach(([lang]) => {
        const t = kept[lang] || got[lang];
        if (t && t.title && t.body) texts[lang] = { title: t.title, body: t.body };
      });
      state.tr = { ...state.tr, source: key, texts, edited: keep ? state.tr.edited : new Set() };
      return LANGS.every(([lang]) => texts[lang]);
    };
    try {
      const got = await browserTranslate(ko, LANGS.map(([lang]) => lang).filter((lang) => !kept[lang]));
      if (sourceKey(korean()) !== key) return false;
      if (store(got)) return true;
      const result = await T.call("notices.translate", { notice: { title_ko: ko.title, body_ko: ko.body } });
      if (sourceKey(korean()) !== key) return false;
      return store({ ...result.data?.translations, ...got });
    } finally {
      state.tr.busy = false;
      updatePreview();
    }
  }

  async function previewTranslations() {
    const form = byId("tenkeyNoticeForm");
    const f = form.elements;
    if (!f.titleKo.reportValidity() || !f.bodyKo.reportValidity()) return;
    const keep = fresh() && missingLangs().length > 0;
    T.setMessage("tenkeyNoticeFormMessage", "");
    try {
      await translate(keep);
    } catch (error) {
      T.report("tenkeyNoticeFormMessage", error);
    }
  }

  function rowMarkup(n) {
    const [label, tone] = STATUS[n.status] || [n.status, "quiet"];
    const canEnd = n.status === "live" || n.status === "scheduled";
    const excerpt = Array.from(String(n.body_ko || "").replace(/\s+/g, " ")).slice(0, 110).join("");
    const langs = languageCount(n);
    const langBadge = langs >= 8
      ? '<span class="tk-badge" data-tone="good">8개 언어</span>'
      : `<span class="tk-badge" data-tone="watch" title="수정에서 다시 발행하면 나머지 언어가 채워집니다">${langs === 1 ? "한국어만" : `${langs}개 언어`}</span>`;
    return `<article class="audit-item" data-notice-id="${esc(n.id)}">
      <div><strong>#${esc(n.id)} ${esc(n.title_ko)} ${langBadge}</strong>
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
    const translations = {};
    LANGS.forEach(([lang]) => {
      const t = state.tr.texts[lang];
      if (t) translations[lang] = { title: t.title.trim(), body: t.body.trim() };
    });
    return {
      reason: f.reason.value.trim(),
      notice: {
        ...(f.noticeId.value ? { id: Number(f.noticeId.value) } : {}),
        title_ko: f.titleKo.value.trim(), body_ko: f.bodyKo.value.trim(), translations,
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
      const starts = kstInputToIso(form.elements.startsAt.value);
      const ends = form.elements.endsAt.value ? kstInputToIso(form.elements.endsAt.value) : "";
      if (!starts) { T.setMessage("tenkeyNoticeFormMessage", T.errorText({ message: "invalid_starts_at" }), true); return; }
      if (ends && Date.parse(ends) <= Date.parse(starts)) { T.setMessage("tenkeyNoticeFormMessage", T.errorText({ message: "invalid_ends_at" }), true); return; }
      if (missingLangs().length) {
        T.setMessage("tenkeyNoticeFormMessage", "다른 언어로 번역하는 중입니다...");
        if (!await translate(fresh())) {
          T.setMessage("tenkeyNoticeFormMessage", "번역을 마치지 못해 아직 발행하지 않았습니다. 다시 눌러 주세요.", true);
          return;
        }
      }
      const blank = LANGS.find(([lang]) => !state.tr.texts[lang]?.title.trim() || !state.tr.texts[lang]?.body.trim());
      if (blank) { T.setMessage("tenkeyNoticeFormMessage", `${blank[1]} 번역의 제목이나 본문이 비어 있습니다. ‘고치기’로 채워 주세요.`, true); return; }
      state.tr.editing = "";
      updatePreview();
      const { notice, reason } = collect(form);
      const scheduled = Date.parse(notice.starts_at) > Date.now();
      const summary = [`제목: ${notice.title_ko}`, `영어 제목: ${notice.translations.en.title}`,
        `언어: 한국어 + 자동 번역 7개${state.tr.edited.size ? ` (직접 고친 것 ${state.tr.edited.size}개)` : ""} · 번역은 아래 미리보기에서 확인`,
        `게시: ${kstText(notice.starts_at)} → ${notice.ends_at ? kstText(notice.ends_at) : "계속"}`,
        scheduled ? "시작 시각 전까지는 앱에 보이지 않습니다 (예약)." : "지금부터 앱에 보입니다.", `켜짐: ${notice.active ? "예" : "아니오"} · 우선순위 ${notice.priority}`, `사유: ${reason}`].join("\n");
      if (!await root.ConsoleApp.confirmChange(notice.id ? `공지 #${notice.id} 수정` : "공지 발행", summary)) return;
      T.setMessage("tenkeyNoticeFormMessage", "저장하는 중입니다...");
      await T.call("notices.save", { notice, reason }, form);
      resetForm();
      await load();
      T.setMessage("tenkeyNoticesMessage", `${scheduled ? "공지를 예약했습니다" : "공지를 발행했습니다"} (8개 언어).`);
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
      form.addEventListener("input", (event) => {
        const field = event.target.closest("[data-tr-lang]");
        if (field) {  // a hand correction of one translation: keep it, do not redraw (the caret stays where it is)
          const text = state.tr.texts[field.dataset.trLang];
          if (text) { text[field.dataset.trField] = field.value; state.tr.edited.add(field.dataset.trLang); }
          return;
        }
        updateCounters();
        updatePreview();
      });
      byId("tenkeyNoticePreviews").addEventListener("click", (event) => {
        const toggle = event.target.closest("[data-tr-toggle]");
        if (!toggle) return;
        const lang = toggle.dataset.trToggle;
        state.tr.editing = state.tr.editing === lang ? "" : lang;
        updatePreview();
        if (state.tr.editing) byId("tenkeyNoticePreviews").querySelector(`[data-tr-lang="${lang}"][data-tr-field="title"]`)?.focus();
      });
      byId("tenkeyNoticeTranslate").addEventListener("click", previewTranslations);
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
