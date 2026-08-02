# House Duck Pulse 쉬운 시각 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오리 캐릭터, 신호등, 네 가지 질문, 압축 흐름 그래프로 Pulse 첫 화면을 즉시 이해되게 만든다.

**Architecture:** 기존 Edge Function 응답은 유지한다. 순수한 판단 계산은 `pulse-model.js`로 분리하고, `app.js`는 계산 결과를 DOM에 그린다. 상세 운영 패널은 기존 렌더 함수를 재사용하되 하나의 접힌 영역으로 이동한다.

**Tech Stack:** 정적 HTML, CSS, 바닐라 JavaScript, Node.js 내장 `assert`, Bash 계약 검사

## Global Constraints

- Google 로그인, 관리자 권한, Supabase Edge Function 요청 계약을 변경하지 않는다.
- 기존 House Duck 팔레트와 반응형 구조를 재사용하며 새 의존성을 추가하지 않는다.
- 표본 30세션 미만은 판단 대기로 표시한다.
- 테스트 광고는 흐름에 포함하고 예상 수익에서는 제외한다.

---

### Task 1: 판단 모델과 회귀 검사

**Files:**
- Create: `analytics/pulse-model.js`
- Create: `scripts/test_pulse_model.js`
- Modify: `scripts/check_analytics_dashboard.sh`

**Interfaces:**
- Consumes: `summary`, `retention`, `adEconomics`, `funnel`, `health`
- Produces: `PulseModel.buildPulseModel(payload)` returning `metrics`, `journey`, `action`, `verdict`

- [ ] **Step 1: Write the failing test**

```javascript
const assert = require("node:assert/strict");
const { buildPulseModel } = require("../analytics/pulse-model.js");
const model = buildPulseModel({
  summary: { sessions: 40, avgGameSeconds: 210, gamesStarted: 20, gameOvers: 15 },
  retention: [{ day: 1, rate: 0.25 }],
  adEconomics: { impressionsPerPlayer: 2 },
  funnel: [{ event: "session_start", users: 10 }, { event: "game_start", users: 8 }, { event: "game_over", users: 6 }, { event: "ad_impression", users: 4 }],
  health: { status: "good", score: 82, summary: "흐름이 안정적입니다." },
});
assert.equal(model.metrics.completion.status, "good");
assert.deepEqual(model.journey.map((step) => step.users), [10, 8, 6, 4]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_pulse_model.js`
Expected: FAIL with `Cannot find module '../analytics/pulse-model.js'`

- [ ] **Step 3: Write minimal implementation**

Implement the UMD-style `buildPulseModel(payload)` pure function and add static contract checks for its script include and required dashboard IDs.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_pulse_model.js && bash scripts/check_analytics_dashboard.sh`
Expected: `pulse model: PASS` and `analytics dashboard contract: PASS`

### Task 2: 첫 화면 재구성 및 시각 검증

**Files:**
- Modify: `analytics/index.html`
- Modify: `analytics/styles.css`
- Modify: `analytics/app.js`

**Interfaces:**
- Consumes: `PulseModel.buildPulseModel(state.payload)`
- Produces: `renderPulseOverview(model)` and existing detailed renderers under `operatorDetails`

- [ ] **Step 1: Extend the failing contract test**

Require `mascotMessage`, `signalLights`, `metricCompletion`, `journeyGraph`, `todayAction`, and `operatorDetails` in `analytics/index.html` and `renderPulseOverview` in `analytics/app.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bash scripts/check_analytics_dashboard.sh`
Expected: FAIL because the new IDs and renderer do not exist.

- [ ] **Step 3: Implement the approved layout**

Replace the eight equal ring cards with four question cards, create the CSS duck and status signal, render the four-step journey, keep the small daily canvas visible, and wrap all detailed panels in `<details id="operatorDetails">`.

- [ ] **Step 4: Verify code and visuals**

Run: `node --check analytics/app.js && node --check analytics/pulse-model.js && node scripts/test_pulse_model.js && bash scripts/check_analytics_dashboard.sh && bash scripts/check_public_repo.sh`
Expected: all commands exit 0 with no secret or direct analytics table access warning.

Open a local HTTP server, inject representative sample data into the dashboard branch, and inspect desktop 1280×900 plus mobile 390×844 captures for clipping, contrast, hierarchy, and collapsed detail state.
