# House Duck 낮은 화면 히어로·공통 문서 리더 구현 계획

> **실행 규칙:** 작은 테스트 실패를 먼저 만들고, 해당 변경만 구현한 뒤 통과시키며 단계별로 커밋한다.

**목표:** macOS Dock이 보이는 낮은 데스크톱 화면에서도 메인 히어로 전체가 첫 화면에 들어오게 하고, Quirky Ball 법적 문서·계정삭제·고객지원을 공통 브랜드 리더로 통일한다.

**구조:** 기존 정적 HTML 사이트를 유지한다. 메인 히어로는 `assets/brand-site.css`의 높이 전용 미디어 쿼리로 해결하고, 문서 화면은 `assets/legal-site.css`와 `assets/legal-site.js`를 공통 정본으로 사용한다. 실제 정책 문구는 각 언어 HTML 안의 명시된 본문 경계에 그대로 둔다.

**기술:** 정적 HTML5, CSS, 최소 바닐라 JavaScript, Bash 계약 검사, Playwright 브라우저 회귀검사

---

### 작업 1: 낮은 데스크톱 히어로 회귀 계약

**파일:**
- 수정: `scripts/check_brand_site.sh`
- 수정: `assets/brand-site.css`

1. `check_brand_site.sh`에 `901px 이상·820px 이하 높이` 전용 규칙과 `100dvh` 기반 높이 제한을 요구하는 검사를 추가한다.
2. 기존 CSS에서 검사를 실행해 실패를 확인한다.
3. 높이 전용 미디어 쿼리에서 히어로 높이, 제목, 여백, 설명, 버튼, 아트 크기를 함께 줄인다.
4. 계약 검사를 통과시킨다.
5. 로컬 서버의 `2048×684`, `1440×700`, `1440×900`에서 히어로 콘텐츠 하단이 뷰포트 안인지 DOM 좌표로 확인한다.
6. 커밋: `fix: fit studio hero in short desktop viewports`

### 작업 2: 공통 문서 시스템 계약과 자산

**파일:**
- 생성: `scripts/check_legal_site.sh`
- 생성: `assets/legal-site.css`
- 생성: `assets/legal-site.js`

1. 12개 현지화 문서, 3개 언어 선택 페이지, 고객지원에 공통 CSS/JS·건너뛰기 링크·시맨틱 본문 경계가 있어야 한다는 실패 검사를 작성한다.
2. 인라인 `<style>`, 외부 폰트/CDN/프레임워크를 금지하고 루트 호환 리디렉션은 검사 대상에서 제외한다.
3. 빈 공통 CSS/JS 파일만 만든 뒤, 페이지 계약이 계속 실패하는지 확인한다.
4. 공통 CSS에 브랜드 헤더, 문서 히어로, 고정 목차, 흰 종이 본문, 표 스크롤, 언어 칩, 푸터, 모바일, 포커스, 축소 모션, 인쇄 규칙을 구현한다.
5. 공통 JS에는 현재 연도와 `h2[id]` 기반 데스크톱·모바일 목차 생성만 구현한다.
6. 커밋: `feat: add shared legal reader assets`

### 작업 3: 개인정보처리방침·이용약관 8개 페이지 전환

**파일:**
- 수정: `quirky-ball/privacy/{ko,en,de,ja}.html`
- 수정: `quirky-ball/terms/{ko,en,de,ja}.html`

1. 변경 전 `h2`, 문단, 목록, 표 셀 텍스트를 임시 JSON으로 추출한다.
2. 각 페이지의 인라인 스타일을 제거하고 공통 자산을 연결한다.
3. 컴팩트 브랜드 헤더, 언어/문서 링크, 제목·시행일 히어로, 자동 목차 자리, 흰 종이 본문, 관련 문서 푸터를 넣는다.
4. 실제 법률 문구는 `문서 본문 시작/끝` 주석 사이에 그대로 옮기고 모든 `h2`에 안정적인 `id`를 부여한다.
5. 변경 후 같은 텍스트를 추출해 변경 전과 완전 일치하는지 비교한다.
6. 공통 문서 계약과 기존 정책 내용 검사를 통과시킨다.
7. 커밋: `refactor: unify privacy and terms readers`

### 작업 4: 계정삭제·언어 선택·고객지원 전환

**파일:**
- 수정: `quirky-ball/privacy/delete_{ko,en,de,ja}.html`
- 수정: `quirky-ball/privacy/index.html`
- 수정: `quirky-ball/privacy/delete.html`
- 수정: `quirky-ball/terms/index.html`
- 수정: `support/index.html`

1. 변경 전 계정삭제와 고객지원 본문 텍스트를 임시 JSON으로 추출한다.
2. 계정삭제 페이지는 기존 앱 내 3단계를 첫 블록으로, 이메일 요청 CTA를 두 번째 블록으로 시각적으로 구분한다.
3. 언어 선택 페이지는 같은 공통 헤더와 명확한 언어 카드·관련 문서 링크를 사용한다.
4. 고객지원은 이메일 CTA와 FAQ를 같은 문서 폭과 브랜드 규칙으로 전환한다.
5. 변경 전후 실제 본문 텍스트가 일치하는지 비교한다.
6. 공통 문서 계약과 정책 내용 검사를 통과시킨다.
7. 커밋: `refactor: unify deletion support and language pages`

### 작업 5: 브라우저 시각 QA와 전체 회귀검사

**파일:**
- 필요 시 수정: `assets/brand-site.css`
- 필요 시 수정: `assets/legal-site.css`
- 필요 시 수정: `assets/legal-site.js`

1. 한국어 개인정보처리방침, 독일어 이용약관, 한국어 계정삭제, 고객지원을 데스크톱과 `390×844`로 연다.
2. 페이지 전체 가로 넘침, 헤더·목차·표·푸터 겹침, 터치 영역, 문서 링크를 DOM 좌표와 스크린샷으로 확인한다.
3. 모바일 목차 `details`, 키보드 건너뛰기 링크, JS 비활성 시 본문 가독성, 인쇄 미디어 규칙을 확인한다.
4. 다음 전체 검사를 실행한다.
   - `bash scripts/check_brand_site.sh`
   - `bash scripts/check_legal_site.sh`
   - `bash scripts/check_policy_content.sh`
   - `bash scripts/check_public_repo.sh`
   - `bash scripts/check_analytics_dashboard.sh`
   - `node scripts/test_pulse_model.js`
5. `git diff --check`와 비밀정보 검사를 확인한다.
6. 대표 전후 캡처를 시각 산출물 폴더에 보관한다.
7. 커밋: `test: verify responsive public document pages`

### 작업 6: Git 정리와 전달

1. 작업 브랜치의 커밋과 diff를 검토한다.
2. 관련 없는 변경이 없는지 확인한다.
3. main에 반영하고 원격 저장소로 push한다.
4. 무엇을 수정했는지, 무엇은 실제 기기에서 확인하지 못했는지, 이후 문구를 어디서 바꾸는지 비개발자 기준으로 보고한다.
