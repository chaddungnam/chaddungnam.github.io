// 10key Survival: the "해금 · 테스트" panel of the player detail (hard-mode round, 2026-11-08, docs/design/hard_mode.md §1 / §12 / §13).
// 1) INVINCIBLE (god mode): one red switch + reason + confirm, like the ranking ban.
// 2) The 16 unlock steps in the order a player meets them; each is a three-way switch (자동 / 켜짐 / 꺼짐):
//    자동 = the game's own rule (default for everyone), 켜짐 = forced open, 꺼짐 = forced shut. "여기까지 켜기" turns this
//    row and every row above it on; "모두 자동" clears every override. Legal, age, region, demo and build blocks still win.
// Calls (tenkey-admin): unlocks.set {player_id, step, state, reason}, unlocks.upto {player_id, step, reason}, god.set {player_id, on, reason}.
// players.get v2 supplies unlocks {step: 'on'|'off'} (missing = auto), god_mode, hard_ready, best hard level.
(function attachConsoleTenkeyUnlocks(root) {
  const T = root.ConsoleTenkey;
  const { esc } = T.fmt;

  const HARD_SHOW_LEVEL = 20;  // HardMode.SHOW_LEVEL in the game
  const HARD_PACK_LEVEL = 5;   // best hard level that shows the breakthrough pack
  const STATES = [["auto", "자동"], ["on", "켜짐"], ["off", "꺼짐"]];

  // id, name, what it opens (plain words), the game's own rule. `answer(info)` = the rule's answer now, when the console can know it.
  const STEPS = [
    { id: "tab_research", name: "강화 탭", opens: "UPGRADE 탭이 열려 부품으로 능력을 올릴 수 있음", rule: "1판을 마치면 열림" },
    { id: "tab_ranking", name: "랭킹 탭", opens: "RANKING 탭이 열려 순위표를 볼 수 있음", rule: "2판을 마치면 열림" },
    { id: "quests", name: "퀘스트", opens: "퀘스트 상자와 퀘스트 창이 보임", rule: "2판을 마치고 계정이 있으면 열림" },
    { id: "tab_shop", name: "상점 탭", opens: "SHOP 탭이 열림", rule: "3판을 마치면 열림" },
    { id: "tab_modules", name: "모듈 탭", opens: "MODULES 탭이 열려 모듈을 모으고 볼 수 있음", rule: "4판을 마치면 열림 (별도 차단 사유가 있으면 그게 우선)" },
    { id: "home_friends", name: "친구", opens: "홈의 FRIENDS 버튼이 열림", rule: "4판을 마치면 열림" },
    { id: "home_mailbox", name: "우편함", opens: "홈의 MAILBOX 버튼이 열려 보상 우편을 받을 수 있음", rule: "4판을 마치면 열림" },
    { id: "purchase", name: "구매", opens: "젬 창과 팩에서 키를 살 수 있음 (켜짐 = 서버 결제가 닫혀 있어도 이 계정은 구매 가능, 테스트 구매자)", rule: "스토어 결제가 가능한 앱이고 서버 결제 스위치가 켜져 있으면 열림" },
    { id: "discount", name: "할인", opens: "돌파 팩의 72시간 -40% 할인 창이 열림 (켜짐 = 지금 바로 창을 엶)", rule: "서버가 할인 창을 열어 준 동안만 열림" },
    { id: "upgrade_robot", name: "강화 · 로봇 탭", opens: "UPGRADE 안의 ROBOT 탭이 열림", rule: "로봇을 맛보았거나 영구 해금되면 열림" },
    { id: "hard_card", name: "하드 카드 보임", opens: "홈 2쪽 · UPGRADE · SHOP에 하드 모드 카드가 보임 (보이기만 하고 시작은 못 함)", rule: `일반 모드 최고 레벨이 ${HARD_SHOW_LEVEL} 이상이면 보임`,
      answer: (i) => (i.bestLevel == null ? "" : i.bestLevel >= HARD_SHOW_LEVEL ? `지금: 보임 (최고 Lv ${i.bestLevel})` : `지금: 숨김 (최고 Lv ${i.bestLevel})`) },
    { id: "hard_play", name: "하드 플레이", opens: "하드 모드 판을 시작할 수 있음 (앱 전용)", rule: "서버 하드 공개 스위치가 켜져 있고 조건을 채워야 열림 (지금은 서버가 닫혀 있어 콘솔로 연 계정만 플레이)",
      answer: (i) => (i.hardReady == null ? "" : i.hardReady ? "지금: 플레이 조건은 채움 (서버 공개는 닫힘)" : "지금: 플레이 조건 미충족") },
    { id: "hard_upgrade", name: "하드 강화", opens: "하드 전용 강화 탭에서 부품으로 구매할 수 있음", rule: "하드 플레이가 열려 있으면 열림" },
    { id: "hard_pack", name: "하드 돌파 팩", opens: "하드 돌파 팩 카드가 보임", rule: `하드 최고 레벨 ${HARD_PACK_LEVEL} 이상이고 하드 플레이가 열려 있으면 보임`,
      answer: (i) => (i.bestHard == null ? "" : i.bestHard >= HARD_PACK_LEVEL ? `지금: 레벨 조건 채움 (하드 최고 Lv ${i.bestHard})` : `지금: 레벨 조건 미충족 (하드 최고 Lv ${i.bestHard})`) },
    { id: "hard_ranking", name: "하드 랭킹", opens: "RANKING의 하드 탭이 열림 (순위표 자체는 나중에 생김)", rule: "하드 플레이가 열려 있으면 열림" },
    { id: "hard_sale", name: "하드 구매 카드", opens: "하드 모드 구매 카드가 보임 (아직 만들지 않음, 지금은 켜도 안 보임)", rule: "서버 하드 판매 스위치가 켜지면 보임 (지금 꺼짐)" },
  ];
  const STEP_IDS = STEPS.map((s) => s.id);
  const stateName = (s) => (STATES.find((x) => x[0] === s) || STATES[0])[1];

  // players.get v2 answer -> what the panel needs. Missing keys (old server) = all auto, god off.
  function read(d) {
    const levels = (d.bests || []).map((b) => Number(b.level)).filter((n) => Number.isFinite(n));
    const raw = d.unlocks || d.player?.unlocks || {};
    const unlocks = {};
    STEP_IDS.forEach((id) => { unlocks[id] = raw[id] === "on" || raw[id] === "off" ? raw[id] : "auto"; });
    const hard = d.best_hard_level ?? d.hard_best_level ?? d.player?.best_hard_level;
    return {
      unlocks,
      god: Boolean(d.god_mode ?? d.player?.god_mode),
      hardReady: d.hard_ready ?? d.player?.hard_ready ?? null,
      bestHard: hard == null ? null : Number(hard),
      bestLevel: levels.length ? Math.max(...levels) : null,
      v2: d.unlocks !== undefined || d.god_mode !== undefined,
    };
  }

  const godBadge = (on) => (on ? ' <span class="tk-badge tk-god-badge" data-tone="risk" title="무적 모드: 이 계정의 판은 기록·보상이 반영되지 않음">[무적]</span>' : "");

  function stepRow(step, index, info) {
    const cur = info.unlocks[step.id];
    const answer = step.answer ? step.answer(info) : "";
    const seg = STATES.map(([value, label]) => `<button type="button" class="tk-seg" data-unlock-set="${step.id}" data-state="${value}" aria-pressed="${cur === value}">${label}</button>`).join("");
    return `<li class="tk-unlock-row" data-step="${step.id}" data-current="${cur}">
      <span class="tk-unlock-no">${index + 1}</span>
      <div class="tk-unlock-text"><span><strong>${esc(step.name)}</strong> <code>${esc(step.id)}</code></span>
        <span class="tk-unlock-opens">${esc(step.opens)}</span>
        <span class="tk-unlock-rule">게임 규칙: ${esc(step.rule)}${answer ? ` · ${esc(answer)}` : ""}</span></div>
      <div class="tk-unlock-ctl"><div class="tk-segs" role="group" aria-label="${esc(step.name)} 해금 상태">${seg}</div>
        <button type="button" class="warning-button tk-upto" data-unlock-upto="${step.id}">여기까지 켜기</button></div></li>`;
  }

  function panelMarkup(d, player) {
    const info = read(d);
    const overridden = STEP_IDS.filter((id) => info.unlocks[id] !== "auto").length;
    const hardFacts = `하드 플레이 조건(서버): ${info.hardReady == null ? "—" : info.hardReady ? "충족" : "미충족"} · 하드 최고 레벨: ${info.bestHard == null ? "—" : info.bestHard}`;
    return `<section id="tenkeyPlayerUnlocks" class="tk-section tk-unlock-panel" aria-labelledby="tenkeyUnlockTitle">
      <h3 id="tenkeyUnlockTitle">해금 · 테스트 ${godBadge(info.god)}</h3>
      <p class="tk-sub">이 계정에만 적용되는 테스트용 스위치입니다. 앱을 다시 켜면 반영됩니다. 14세 미만 · 지역 · 웹 · 빌드 차단은 어떤 스위치로도 풀리지 않습니다. 변경은 모두 사유와 함께 감사 기록에 남습니다.${info.v2 ? "" : " (서버가 아직 해금 정보를 보내지 않아 모두 자동으로 보입니다.)"}</p>
      <form id="tenkeyGodForm" class="admin-form impact-form impact-form-critical tk-god-form" data-god="${info.god}">
        <p class="eyebrow">INVINCIBLE · 무적 모드</p>
        <label class="tk-switch"><input type="checkbox" role="switch" name="on" ${info.god ? "checked" : ""}><span class="tk-switch-track" aria-hidden="true"></span><strong>무적 모드 <span id="tenkeyGodState">${info.god ? "켜짐" : "꺼짐"}</span></strong></label>
        <p class="impact-note">켜면 이 계정의 일반·하드 판 모두 생명이 1 아래로 내려가지 않아 판이 끝나지 않습니다(일시정지 → 나가기로 끝냄). 대신 랭킹 · 젬 · 부품 · 경험치 · 퀘스트 · 기록은 서버에 반영되지 않습니다. 앱 화면에는 빨간 [무적] 표시가 뜹니다. 다음 판부터 적용됩니다.</p>
        <label>사유 (감사 기록용)<input name="reason" maxlength="300" required placeholder="예: 하드 모드 보스전 테스트"></label>
        <p id="tenkeyGodMessage" class="dashboard-message" role="status" aria-live="polite"></p>
        <div class="tk-actions"><button class="danger-button" type="submit" id="tenkeyGodApply" disabled>${info.god ? "무적 모드 끄기" : "무적 모드 켜기"}</button></div>
      </form>
      <h4 class="tk-unlock-head">해금 단계 (플레이어가 만나는 순서) <span class="tk-sub">${esc(hardFacts)}</span></h4>
      <p class="tk-sub">자동 = 게임의 원래 규칙을 따름 (기본값). 켜짐 = 조건과 상관없이 엶. 꺼짐 = 조건을 채웠어도 닫음. 회색 글씨는 게임 규칙입니다.</p>
      <ol class="tk-unlock-list">${STEPS.map((s, i) => stepRow(s, i, info)).join("")}</ol>
      <p id="tenkeyUnlockMessage" class="dashboard-message" role="status" aria-live="polite"></p>
      <div class="tk-actions"><button type="button" class="warning-button" id="tenkeyUnlockAll" ${overridden ? "" : "disabled"}>모두 자동${overridden ? ` (${overridden}개 되돌림)` : ""}</button></div>
    </section>`;
  }

  // ctx = { player, data(), reload() }. Binds the panel after the detail was drawn.
  function bind(ctx) {
    const host = document.getElementById("tenkeyPlayerUnlocks");
    if (!host) return;
    const { player } = ctx;
    const who = player.name || player.id;
    const info = () => read(ctx.data());
    const msg = (text, error = false) => T.setMessage("tenkeyUnlockMessage", text, error);
    const stepOf = (id) => STEPS.find((s) => s.id === id);
    const busy = (on) => host.querySelectorAll("button, input").forEach((el) => { el.disabled = on ? true : el.disabled; });

    async function write(label, run) {
      busy(true);
      try {
        await run();
        await ctx.reload();
        T.setMessage("tenkeyPlayerMessage", label);
      } catch (error) {
        T.report("tenkeyUnlockMessage", error);
        busy(false);
        await ctx.reload().catch(() => {});
      }
    }

    host.querySelectorAll("[data-unlock-set]").forEach((button) => button.addEventListener("click", async () => {
      const step = stepOf(button.dataset.unlockSet);
      const state = button.dataset.state;
      const from = info().unlocks[step.id];
      if (state === from) return;
      const reason = await T.askReason("해금 단계 변경", `${who}\n${step.name} (${step.id}): ${stateName(from)} → ${stateName(state)}\n사유를 감사 기록에 남깁니다.`);
      if (!reason) return;
      await write(`${step.name}: ${stateName(state)}(으)로 바꿨습니다.`, () => T.call("unlocks.set", { player_id: player.id, step: step.id, state, reason }, host));
    }));

    host.querySelectorAll("[data-unlock-upto]").forEach((button) => button.addEventListener("click", async () => {
      const step = stepOf(button.dataset.unlockUpto);
      const n = STEP_IDS.indexOf(step.id) + 1;
      const reason = await T.askReason("여기까지 켜기", `${who}\n1번부터 ${n}번 ${step.name}까지 ${n}개 단계를 모두 켜짐으로 바꿉니다.\n사유를 감사 기록에 남깁니다.`);
      if (!reason) return;
      await write(`1번부터 ${n}번(${step.name})까지 켰습니다.`, () => T.call("unlocks.upto", { player_id: player.id, step: step.id, reason }, host));
    }));

    byIdOn("tenkeyUnlockAll", async () => {
      const set = info().unlocks;
      const todo = STEP_IDS.filter((id) => set[id] !== "auto");
      if (!todo.length) return;
      const reason = await T.askReason("모두 자동", `${who}\n켜짐/꺼짐으로 바꾼 ${todo.length}개 단계를 모두 자동(게임 규칙)으로 되돌립니다.\n사유를 감사 기록에 남깁니다.`);
      if (!reason) return;
      await write(`${todo.length}개 단계를 자동으로 되돌렸습니다.`, async () => {
        for (const step of todo) await T.call("unlocks.set", { player_id: player.id, step, state: "auto", reason }, host);
      });
    });

    const form = document.getElementById("tenkeyGodForm");
    const sync = () => {
      const want = form.elements.on.checked;
      document.getElementById("tenkeyGodState").textContent = want ? "켜짐" : "꺼짐";
      document.getElementById("tenkeyGodApply").disabled = want === (form.dataset.god === "true");
    };
    form.elements.on.addEventListener("change", sync);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const on = form.elements.on.checked;
      const reason = form.elements.reason.value.trim();
      if (!await root.ConsoleApp.confirmChange(on ? "무적 모드 켜기" : "무적 모드 끄기", `${who}\n${on ? "다음 판부터 판이 끝나지 않고, 그 판의 랭킹 · 보상 · 기록은 서버에 반영되지 않습니다." : "다음 판부터 일반 판으로 돌아옵니다."}\n사유: ${reason}`)) return;
      T.setMessage("tenkeyGodMessage", "처리하는 중입니다...");
      try {
        await T.call("god.set", { player_id: player.id, on, reason }, form);
        await ctx.reload();
        T.setMessage("tenkeyPlayerMessage", on ? "무적 모드를 켰습니다." : "무적 모드를 껐습니다.");
      } catch (error) {
        T.report("tenkeyGodMessage", error);
      }
    });

    function byIdOn(id, fn) { document.getElementById(id).addEventListener("click", fn); }
  }

  T.unlocks = { STEPS, panelMarkup, bind, godBadge, read };
})(window);
