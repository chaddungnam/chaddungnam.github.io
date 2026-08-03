# Quirky Ball Store Assets Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** House Duck 홈과 Quirky Ball 페이지를 최신 공식 스토어 자산으로 교체하고 모든 화면에서 이미지 원본 비율을 보존한다.

**Architecture:** 기존 정적 HTML/CSS 구조를 유지한다. 공식 자산을 `quirky-ball/store/`에 복사하고, 공용 `brand-site.css`의 이미지 컨테이너만 수정한다. JavaScript나 새 의존성은 추가하지 않는다.

**Tech Stack:** HTML, CSS, Bash 계약 검사, Playwright 브라우저 QA

## Global Constraints

- 앱 아이콘은 변경하지 않는다.
- 상위 작업공간 `store_asset/QuirkyBall/Upload`의 승인 자산만 사용한다.
- 이미지의 원본 비율을 보존하고 외부 런타임 의존성을 추가하지 않는다.
- 한국어와 영어 페이지를 함께 갱신한다.

---

### Task 1: 최신 자산 계약 고정

**Files:**
- Modify: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: 현재 홈·게임 페이지와 `assets/brand-site.css`
- Produces: 레거시 경로와 비율 회귀를 실패시키는 `check_brand_site.sh`

- [ ] **Step 1: 실패 테스트 작성**

  최신 `store/` 경로, 8개 공식 스크린샷, 비율 보존 CSS를 요구하고 레거시 파일 참조를 거부한다.

- [ ] **Step 2: RED 확인**

  Run: `bash scripts/check_brand_site.sh`

  Expected: `store/feature-graphic.png` 누락으로 FAIL.

### Task 2: 공식 이미지와 반응형 레이아웃 적용

**Files:**
- Create: `quirky-ball/store/*.png`
- Modify: `index.html`
- Modify: `index_en.html`
- Modify: `quirky-ball/index.html`
- Modify: `quirky-ball/index_en.html`
- Modify: `assets/brand-site.css`

**Interfaces:**
- Consumes: Task 1의 자산·비율 계약
- Produces: 실제 스토어 이미지 기반 홈 히어로와 8장 게임 갤러리

- [ ] **Step 1: 공식 자산 복사**

  Feature Graphic과 Phone 8장을 의미가 드러나는 파일명으로 `quirky-ball/store/`에 복사한다.

- [ ] **Step 2: HTML 경로와 대체텍스트 교체**

  홈 대표 이미지와 게임 히어로·갤러리를 새 경로로 바꾼다.

- [ ] **Step 3: CSS 최소 수정**

  홈 히어로는 실제 대표 이미지 카드로 바꾸고, 갤러리는 `height: auto`와 `object-fit: contain`으로 원본 비율을 보존한다.

- [ ] **Step 4: GREEN 확인**

  Run: `bash scripts/check_brand_site.sh`

  Expected: `brand site contract: PASS`.

### Task 3: 브라우저·전체 회귀 검증

**Files:**
- Test: `scripts/check_brand_site.sh`

**Interfaces:**
- Consumes: Task 2의 정적 페이지
- Produces: 대표 해상도 캡처와 전체 사이트 PASS 결과

- [ ] **Step 1: 표시 비율 자동 검사**

  Playwright에서 모든 대표·갤러리 이미지의 `naturalWidth / naturalHeight`와 실제 표시 비율 오차가 1% 미만인지 확인한다.

- [ ] **Step 2: 대표 해상도 캡처**

  1440×900, 1440×760, 390×844에서 홈과 게임 페이지를 캡처한다.

- [ ] **Step 3: 전체 검사 실행**

  Run: `bash scripts/check_brand_site.sh && bash scripts/check_legal_site.sh && node scripts/test_legal_site.js && bash scripts/check_policy_content.sh && bash scripts/check_public_repo.sh && node scripts/test_pulse_model.js`

  Expected: 모두 PASS.

- [ ] **Step 4: 커밋**

  Run: `git add assets/brand-site.css index.html index_en.html quirky-ball scripts/check_brand_site.sh docs/superpowers && git commit -m "fix(site): refresh Quirky Ball store visuals"`
