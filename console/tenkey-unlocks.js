// 10key Survival: the "해금 · 테스트" panel of the player detail (hard-mode round, 2026-11-08, docs/design/hard_mode.md §1 / §12 / §13).
// 1) INVINCIBLE (god mode): one red switch + reason + confirm, like the ranking ban.
// 2) Checkpoint (owner 2026-11-19 item 7): per mode (일반 / 하드) the level every run starts at: 자동 (the records) / 레벨 1 / 8 / 15부터.
// 3) The 17 unlock steps in the order a player meets them; each is a three-way switch (자동 / 켜짐 / 꺼짐):
//    자동 = the game's own rule (default for everyone), 켜짐 = forced open, 꺼짐 = forced shut. Steps 1-6 are ONE row, "기본 탭 (1~6)"
//    (owner 2026-11-19 item 9), one switch for all six. "여기까지 켜기" turns this row and every row above it on; "모두 자동" clears
//    every override. Legal, age, region, demo and build blocks still win. The texts follow the game code of 2026-11-19.
// Calls (tenkey-admin): unlocks.set {player_id, step, state, reason}, unlocks.many {player_id, steps, state, reason} (an older
// tenkey-admin without it: six unlocks.set), unlocks.upto {player_id, step, reason}, god.set {player_id, on, reason},
// checkpoint.set {player_id, mode, level (1 / 8 / 15, null = 자동), reason}.
// players.get v2 supplies unlocks {step: 'on'|'off'} (missing = auto), god_mode, hard_ready, best hard level, checkpoint {mode: level},
// checkpoint_best {classic, hard} (20261119160000; missing = the checkpoint rows are read-only).
(function attachConsoleTenkeyUnlocks(root) {
  const T = root.ConsoleTenkey;
  const { esc } = T.fmt;

  const HARD_SHOW_LEVEL = 7;   // HardMode.PEEK_LEVEL in the game (8 until 2026-11-16: the locked card shows once the normal best level REACHED Lv 7)
  const HARD_PACK_LEVEL = 5;   // HardMode.PACK_LEVEL: best hard level that shows the breakthrough pack
  const CHECKPOINT_LEVELS = [8, 15];  // Checkpoint.LEVELS in the game: a best level of 8 starts at 8, of 15 at 15
  const STATES = [["auto", "자동"], ["on", "켜짐"], ["off", "꺼짐"]];
  const CP_CHOICES = [["auto", "자동"], ["1", "레벨 1부터"], ["8", "레벨 8부터"], ["15", "레벨 15부터"]];
  const CP_MODES = [["classic", "일반 모드"], ["hard", "하드 모드"]];

  // id, name, what the player sees when it is open, when the game opens it. `answer(info)` = the rule's answer now, when the console can know it.
  const STEPS = [
    { id: "tab_research", name: "UPGRADE 탭", opens: "", rule: "" },
    { id: "tab_ranking", name: "RANKING 탭", opens: "", rule: "" },
    { id: "quests", name: "퀘스트", opens: "", rule: "" },
    { id: "tab_shop", name: "SHOP 탭", opens: "", rule: "" },
    { id: "tab_modules", name: "MODULES 탭", opens: "", rule: "" },
    { id: "home_friends", name: "친구", opens: "", rule: "" },
    { id: "home_mailbox", name: "우편함", opens: "홈에 MAILBOX 버튼이 생겨 운영 우편과 보상을 받음", rule: "4판을 마치고, MODULES 탭이 열려 있고, 로그인한 계정이면 열림 (웹 데모 · 14세 미만은 안 열림)" },
    { id: "purchase", name: "구매", opens: "SHOP · 보석 창 · 팩의 결제 키를 눌러 실제 결제를 할 수 있음 (꺼짐 = 이 계정만 결제 막힘)", rule: "스토어 결제가 되는 앱이면 처음부터 열림 (웹은 결제 없음, 켜짐으로도 안 열림)" },
    { id: "discount", name: "할인", opens: "로봇 팩 할인가(보석 499 → 299)와 하드 돌파 팩 할인가가 보임 (켜짐 = 지금 바로 할인가, 꺼짐 = 정가만)", rule: "판에서 로봇을 얻으면 72시간 로봇 팩 할인, 하드 돌파 팩은 처음 보인 뒤 7일 할인 (한 번만)" },
    { id: "upgrade_robot", name: "UPGRADE · ROBOT 탭", opens: "UPGRADE 안에 ROBOT 탭이 생겨 로봇 능력을 강화함", rule: "판에서 로봇을 한 번 얻었거나 로봇을 영구 해금하면 열림" },
    { id: "hard_card", name: "하드 카드 보임", opens: "홈 2쪽 · UPGRADE · SHOP에 하드 모드 카드가 보임 (보이기만 함, 시작은 하드 플레이)", rule: `일반 모드 최고 레벨이 ${HARD_SHOW_LEVEL} 이상이면 보임 (앱만)`,
      answer: (i) => (i.bestLevel == null ? "" : i.bestLevel >= HARD_SHOW_LEVEL ? `지금: 보임 (최고 Lv ${i.bestLevel})` : `지금: 숨김 (최고 Lv ${i.bestLevel})`) },
    { id: "hard_play", name: "하드 플레이", opens: "하드 카드를 눌러 하드 모드 판을 시작할 수 있음", rule: "하드 모드를 산 계정만 (결제는 언제든, 보석 299는 일반 30레벨 달성 뒤). 지금은 판매가 닫혀 있어 여기서 켠 계정만 플레이 (앱만, 14세 미만 불가)",
      answer: (i) => (i.hardReady == null ? "" : i.hardReady ? "지금: 일반 30레벨 달성 (보석 구매 가능)" : "지금: 일반 30레벨 미달성 (보석 구매 잠김, 결제는 가능)") },
    { id: "hard_upgrade", name: "하드 강화", opens: "UPGRADE의 HARD 탭에서 부품으로 하드 전용 강화를 삼", rule: "하드 플레이가 열린 계정이면 열림" },
    { id: "hard_pack", name: "하드 돌파 팩", opens: "SHOP에 하드 돌파 팩 카드가 보임", rule: `하드 판 최고 레벨 ${HARD_PACK_LEVEL} 이상이고 하드 플레이가 열려 있으면 보임`,
      answer: (i) => (i.bestHard == null ? "" : i.bestHard >= HARD_PACK_LEVEL ? `지금: 레벨 조건 채움 (하드 최고 Lv ${i.bestHard})` : `지금: 레벨 조건 미충족 (하드 최고 Lv ${i.bestHard})`) },
    { id: "hard_ranking", name: "하드 랭킹", opens: "RANKING 위에 [NORMAL] [HARD] 줄이 생겨 하드 순위를 봄", rule: "하드 플레이가 열린 계정이면 열림 (앱만)" },
    { id: "hard_sale", name: "하드 구매 카드", opens: "SHOP에 하드 모드 해금 카드가 보임 (누르면 소개 화면과 보석 299 / 결제 키)", rule: "서버 하드 판매 스위치가 켜지면 보임 (지금 꺼짐). 이미 산 계정은 늘 보임" },
    { id: "shop_test", name: "상점 테스트", opens: "판매 중인 팩 카드가 레벨과 상관없이 다 보이고, 할인이 있는 팩은 정가 키와 할인가 키가 둘 다 보임 (정가 구매 테스트용, 앱만)", rule: "기본 꺼짐. 심사 중인 빌드(서버 review_build_ios / _android)와 관리자 실험 모드 계정은 저절로 켜짐" },
  ];
  // Steps 1-6 as one row (the server keeps one row per step; one call sets all six).
  const BASIC = STEPS.slice(0, 6).map((s) => s.id);
  const BASIC_OPENS = "UPGRADE · RANKING · SHOP · MODULES 탭, 퀘스트 창, 홈 FRIENDS 버튼을 한 번에 엶 / 닫음";
  const BASIC_RULE = "SHOP은 처음부터 · UPGRADE는 1판 후 · RANKING과 퀘스트는 2판 후 (퀘스트는 계정 필요) · MODULES와 FRIENDS는 4판 후 (모듈 상자를 샀으면 MODULES는 바로; FRIENDS는 로그인 필요). 14세 미만 · 상자 금지 지역 · 웹 데모는 MODULES가 켜짐으로도 안 열림";
  const STEP_IDS = STEPS.map((s) => s.id);
  const stateName = (s) => (STATES.find((x) => x[0] === s) || STATES[0])[1];

  // The start level a best level gives (Checkpoint.level_for): 1, 8 or 15.
  const levelFor = (best) => CHECKPOINT_LEVELS.reduce((out, n) => (best >= n ? n : out), 1);

  // players.get v2 answer -> what the panel needs. Missing keys (old server) = all auto, god off, checkpoint read-only.
  function read(d) {
    const levels = (d.bests || []).map((b) => Number(b.level)).filter((n) => Number.isFinite(n));
    const raw = d.unlocks || d.player?.unlocks || {};
    const unlocks = {};
    STEP_IDS.forEach((id) => { unlocks[id] = raw[id] === "on" || raw[id] === "off" ? raw[id] : "auto"; });
    const hard = d.best_hard_level ?? d.hard_best_level ?? d.player?.best_hard_level;
    const bestLevel = levels.length ? Math.max(...levels) : null;
    const cpRaw = d.checkpoint && typeof d.checkpoint === "object" ? d.checkpoint : {};
    const cpBest = d.checkpoint_best && typeof d.checkpoint_best === "object" ? d.checkpoint_best : {};
    const checkpoint = {};
    const best = { classic: Number(cpBest.classic ?? bestLevel ?? 0) || 0, hard: Number(cpBest.hard ?? hard ?? 0) || 0 };
    CP_MODES.forEach(([mode]) => { const n = Number(cpRaw[mode]); checkpoint[mode] = [1, 8, 15].includes(n) ? String(n) : "auto"; });
    return {
      unlocks,
      god: Boolean(d.god_mode ?? d.player?.god_mode),
      hardReady: d.hard_ready ?? d.player?.hard_ready ?? null,
      bestHard: hard == null ? null : Number(hard),
      bestLevel,
      v2: d.unlocks !== undefined || d.god_mode !== undefined,
      checkpoint,
      cpBest: best,
      cpLive: d.checkpoint !== undefined,
    };
  }

  const godBadge = (on) => (on ? ' <span class="tk-badge tk-god-badge" data-tone="risk" title="무적 모드: 이 계정의 판은 기록·보상이 반영되지 않음">[무적]</span>' : "");

  const segs = (attrs, cur, choices, label, disabled = false) => `<div class="tk-segs" role="group" aria-label="${esc(label)}">${choices.map(([value, text]) =>
    `<button type="button" class="tk-seg" ${attrs} data-state="${value}" aria-pressed="${cur === value}"${disabled ? " disabled" : ""}>${text}</button>`).join("")}</div>`;

  function row({ key, no, name, code, opens, rule, cur, ctl }) {
    return `<li class="tk-unlock-row" data-step="${key}" data-current="${cur}">
      <span class="tk-unlock-no"${String(no).length > 2 ? " data-wide" : ""}>${no}</span>
      <div class="tk-unlock-text"><span><strong>${esc(name)}</strong>${code ? ` <code>${esc(code)}</code>` : ""}</span>
        <span class="tk-unlock-opens">${esc(opens)}</span>
        <span class="tk-unlock-rule">게임 규칙: ${esc(rule)}</span></div>
      <div class="tk-unlock-ctl">${ctl}</div></li>`;
  }

  function basicRow(info) {
    const states = BASIC.map((id) => info.unlocks[id]);
    const cur = states.every((s) => s === states[0]) ? states[0] : "mixed";
    const mix = cur === "mixed" ? ` · 지금: 섞임 (${STATES.map(([v, t]) => `${t} ${states.filter((s) => s === v).length}`).join(" · ")})` : "";
    return row({ key: "basic", no: "1~6", name: "기본 탭 (1~6)", code: "", opens: BASIC_OPENS, rule: BASIC_RULE + mix, cur,
      ctl: segs("data-unlock-many", cur, STATES, "기본 탭 1~6 해금 상태") });
  }

  function stepRow(step, index, info) {
    const cur = info.unlocks[step.id];
    const answer = step.answer ? step.answer(info) : "";
    return row({ key: step.id, no: index + 1, name: step.name, code: step.id, opens: step.opens, rule: step.rule + (answer ? ` · ${answer}` : ""), cur,
      ctl: segs(`data-unlock-set="${step.id}"`, cur, STATES, `${step.name} 해금 상태`)
        + `<button type="button" class="warning-button tk-upto" data-unlock-upto="${step.id}">여기까지 켜기</button>` });
  }

  // "지금: 레벨 8부터 (자동 · 최고 Lv 12)"
  function cpNow(info, mode) {
    const best = info.cpBest[mode];
    const set = info.checkpoint[mode];
    const start = set === "auto" ? levelFor(best) : Number(set);
    return `지금: 레벨 ${start}부터 (${set === "auto" ? "자동" : "콘솔 설정"} · 최고 Lv ${best})`;
  }

  function cpRow([mode, name], info) {
    const cur = info.checkpoint[mode];
    const rule = `${mode === "hard" ? "하드 판" : "일반 판"} 최고 레벨이 8 이상이면 레벨 8부터, 15 이상이면 레벨 15부터 · ${cpNow(info, mode)}`;
    return `<li class="tk-unlock-row tk-cp-row" data-cp="${mode}" data-current="${cur === "auto" ? "auto" : "on"}">
      <div class="tk-unlock-text"><span><strong>${esc(name)}</strong></span>
        <span class="tk-unlock-rule">자동 규칙: ${esc(rule)}</span></div>
      <div class="tk-unlock-ctl">${segs(`data-cp-set="${mode}"`, cur, CP_CHOICES, `${name} 체크포인트`, !info.cpLive)}</div></li>`;
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
      ${T.watch.reviewPanelMarkup(player)}
      <h4 class="tk-unlock-head" id="tenkeyCheckpointHead">체크포인트 (판 시작 레벨)</h4>
      <p class="tk-sub">판을 몇 레벨에서 시작할지 정합니다. 자동 = 그 모드 최고 레벨로 정함. 레벨 8 · 15부터 시작하는 판은 시작할 때 "체크포인트!" 띠가 뜹니다. 다음 판부터 적용되고, 웹 데모 빌드는 늘 레벨 1부터입니다.${info.cpLive ? "" : " (서버 반영 전이라 아직 바꿀 수 없습니다.)"}</p>
      <ul class="tk-unlock-list" aria-labelledby="tenkeyCheckpointHead">${CP_MODES.map((m) => cpRow(m, info)).join("")}</ul>
      <h4 class="tk-unlock-head">해금 단계 (플레이어가 만나는 순서) <span class="tk-sub">${esc(hardFacts)}</span></h4>
      <p class="tk-sub">자동 = 게임의 원래 규칙을 따름 (기본값). 켜짐 = 조건과 상관없이 엶. 꺼짐 = 조건을 채웠어도 닫음. 회색 글씨는 게임 규칙입니다. 관리자 실험 모드 계정은 모든 단계가 켜짐으로 동작합니다.</p>
      <ol class="tk-unlock-list">${basicRow(info)}${STEPS.slice(6).map((s, i) => stepRow(s, i + 6, info)).join("")}</ol>
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

    host.querySelectorAll("[data-unlock-many]").forEach((button) => button.addEventListener("click", async () => {
      const state = button.dataset.state;
      const set = info().unlocks;
      if (BASIC.every((id) => set[id] === state)) return;
      const reason = await T.askReason("기본 탭 (1~6) 변경", `${who}\n기본 탭 6개 (${STEPS.slice(0, 6).map((s) => s.name).join(", ")})를 모두 ${stateName(state)}(으)로 바꿉니다.\n사유를 감사 기록에 남깁니다.`);
      if (!reason) return;
      await write(`기본 탭 (1~6): ${stateName(state)}(으)로 바꿨습니다.`, async () => {
        try {
          await T.call("unlocks.many", { player_id: player.id, steps: BASIC, state, reason }, host);
        } catch (error) {
          if (error?.message !== "unknown_action") throw error;
          for (const step of BASIC) await T.call("unlocks.set", { player_id: player.id, step, state, reason }, host);  // tenkey-admin before 11-19
        }
      });
    }));

    host.querySelectorAll("[data-cp-set]").forEach((button) => button.addEventListener("click", async () => {
      const mode = button.dataset.cpSet;
      const value = button.dataset.state;
      const now = info();
      if (!now.cpLive || now.checkpoint[mode] === value) return;
      const name = CP_MODES.find((m) => m[0] === mode)[1];
      const label = (v) => (CP_CHOICES.find((c) => c[0] === v) || CP_CHOICES[0])[1];
      const reason = await T.askReason("체크포인트 변경", `${who}\n${name} 체크포인트: ${label(now.checkpoint[mode])} → ${label(value)}\n다음 판부터 적용됩니다. 사유를 감사 기록에 남깁니다.`);
      if (!reason) return;
      await write(`${name} 체크포인트: ${label(value)}(으)로 바꿨습니다.`,
        () => T.call("checkpoint.set", { player_id: player.id, mode, level: value === "auto" ? null : Number(value), reason }, host));
    }));

    host.querySelectorAll("[data-unlock-upto]").forEach((button) => button.addEventListener("click", async () => {
      const step = stepOf(button.dataset.unlockUpto);
      const n = STEP_IDS.indexOf(step.id) + 1;
      const reason = await T.askReason("여기까지 켜기", `${who}\n기본 탭 (1~6)부터 ${n}번 ${step.name}까지 ${n}개 단계를 모두 켜짐으로 바꿉니다.\n사유를 감사 기록에 남깁니다.`);
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

    T.watch.bindReview(ctx);
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

  T.unlocks = { STEPS, BASIC, panelMarkup, bind, godBadge, read };
})(window);
