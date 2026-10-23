# chaddungnam.github.io
House Duck와 Quirky Ball의 공개 웹 자산(개인정보처리방침, 이용약관,
고객지원, `app-ads.txt`, House Duck 운영 콘솔 화면)을 GitHub Pages로 호스팅하는 저장소입니다.

이 저장소는 웹사이트처럼 누구나 볼 수 있습니다. 게임 소스, Supabase 키,
비밀번호, 서명 키, 데이터베이스, 사용자 데이터는 넣지 않습니다.

커밋 전에 아래 검사를 실행합니다.

```bash
scripts/check_public_repo.sh
scripts/check_legal_site.sh
scripts/check_house_duck_console.sh
node scripts/test_console_model.js
node scripts/test_gmail_model.js
```

로컬 보호 훅은 이 저장소에 설정되어 있으며, GitHub에서도 같은 검사를
자동 실행합니다. 보안 문제 제보 절차는 `SECURITY.md`를 따릅니다.

## House Duck Console

- 플레이어 검색 → 상세의 `최초 튜토리얼`에서 시작·완료·완료 후 홈 도착을 확인합니다. 기존 Supabase 이벤트를 동일 실행의 계정 생성~최초 홈 방문 구간에 연결하며, 복수 계정의 구간이 겹쳐 식별할 수 없으면 제외합니다. 기록 없음은 미완료 확정이 아니며 Google 광고 전환 수신 여부와 별개입니다. 앱 재배포는 필요하지 않습니다.
- `/console/`은 Google 허용 계정과 서버의 2차 질문 확인을 모두 통과해야 열립니다.
- 재화·점수·운영 변경은 브라우저가 데이터베이스를 직접 쓰지 않고 관리자 Edge Function과 감사 RPC만 사용합니다. 플레이어 수정 플래그의 기본값은 `false`입니다.
- 플레이어 상세의 `감사 기록에서 보기`로 해당 계정의 전체 관리자 변경 이력을 조회합니다. 상세에도 성공·실패와 오류 코드가 표시됩니다. 이 기록은 관리자 지급·조정 이력이며 게임 내 자동 미션 보상의 시도 로그가 아닙니다. 계정 전환·필터 해제·응답 역전은 `node scripts/test_console_audit_navigation.js`로 검증하며 공용 콘솔 검사에도 포함됩니다.
- `/analytics/`는 호환 주소이며 통합 콘솔의 분석 화면으로 이동합니다.
- Gmail CS는 `gmail.modify` 토큰을 CS 화면에서만 요청하고 브라우저 메모리에만 둡니다. 메일·첨부·토큰은 Supabase와 저장소에 복사하지 않습니다. 이 내용은 공용 개인정보처리방침 제14항에 공개되어 있으므로, Gmail·로그인·요약 동작을 바꾸면 제14항(영·한·독)도 함께 고칩니다.
- 구매 화면은 서버에 기록된 구매·환불만 표시하며, 가격이 없으면 `금액 미기록`으로 표시합니다.

### 10key Survival (딸깍 서바이벌)

프로젝트 선택 화면의 `10key Survival` 카드는 House Duck 게임 서버(Supabase `frepunpqswciugwoyvxo`, `console/app.js`의 `HOUSEDUCK_CONFIG`)의 `tenkey-admin` Edge Function만 `ConsoleAPI.postProject("houseduck", "tenkey-admin", ...)`로 부른다. Quirky Ball 클라이언트(`ConsoleAPI.post`)는 그대로다. Comrade(동무와 멋진신세계)는 2026-10-23에 콘솔에서 뺐다(화면만 제거, 서버 데이터·함수는 그대로).

- 화면(왼쪽 메뉴 8개): 한눈 요약(접속자 DAU·신규 설치·플레이 횟수·신규 계정·크래시·복귀율, 7·30·90일, 플랫폼별), 플레이어(검색·목록·상세·랭킹 정지), 크래시(오류 내용·버전·기기·종류로 묶기, 목록, 로그 끝부분), 공지(한·영 필수, 예약·종료·삭제, 앱 안 미리보기), 구매·젬, 랭킹(보드 + 서버가 거른 의심 기록), 앱 설정(강제 업데이트), 감사 기록. 코드는 `console/tenkey*.js`.
- 인증은 Quirky Ball 로그인과 같은 72시간 세션 티켓. 함수는 `ADMIN_SESSION_SECRET`(티켓) 또는 Google ID 토큰을 확인한 뒤 `tenkey.admin_check_v1`(관리자 목록 `hx_admins`)을 통과해야 한다. 서비스 키는 함수 안에만 있고 브라우저에 오지 않는다. 쓰기(정지·공지·앱 설정)는 사유 + `request_id`를 보내고 `tenkey_private.admin_audit`에 남는다.
- 서버 설계: 게임 저장소 `docs/server/tenkey_server.md` §15. 접속자 숫자는 Android·iOS 앱이 하루 한 번 보내는 신호(무작위 설치 번호)로 센다. 웹(CrazyGames)은 식별 번호를 만들지 않는 규칙이라 빠진다.
- 로컬에서 보기: `python3 -m http.server 4173` 후 `tests/console-tenkey.spec.js`가 가짜 서버 응답(`tests/fixtures/console_tenkey_api.js`, 실제 플레이어 아님)으로 모든 화면을 걷는다. `TENKEY_SHOTS=<폴더>`를 주면 화면별 캡처를 남긴다.
- 검사: `scripts/check_house_duck_console.sh`(내부에서 `node scripts/test_tenkey_console.js`), `npx playwright test tests/console-tenkey.spec.js`.

## 법적 문서 문구 수정 방법

- 법적 문서는 영어(기본), 한국어, 독일어로 유지합니다(소유자 2026-10-20: 독일어 복원, GDPR). `ja.html` 법적 주소는 앱이 열 수 있으므로 지우지 않고, 같은 문서의 영어판으로 보내는 작은 리디렉트로 둡니다. 언어 선택 `index.html`은 브라우저 언어 목록에서 영어보다 한국어가 먼저면 `ko.html`, 독일어가 먼저면 `de.html`, 그 밖에는(일본어 포함) `en.html`로 보냅니다. 딸깍 서바이벌(10key Survival) 이용약관은 영어·한국어만 있고, 독일어 페이지는 영어 약관을 연결합니다.
- 개인정보처리방침은 House Duck 공용 `privacy/<언어>.html` 하나이고(딸깍 서바이벌은 제13항, 고객지원 메일·직원 전용 운영 콘솔·Gmail 접근은 모든 게임 공통인 제14항, 변경 이력은 제15항), 이용약관은 게임마다 `quirky-ball/terms/`, `10key/terms/`에 있습니다. 동무(`hexaworld1984/`)는 출시 전까지 자체 방침을 유지합니다. `quirky-ball/privacy/<언어>.html`, `10key/privacy/<언어>.html`은 공용 방침으로 가는 리디렉트입니다.
- 게임 이름(소유자 2026-10-20, 출시 전 변경): 영어·독일어 문서는 `10key Survival`, 한국어 문서는 `딸깍 서바이벌`(문서에서 처음 나올 때 한 번 `(10key Survival)`을 붙임). `10KEY`는 프로젝트 이름일 뿐이며, 설치된 앱과 스토어가 링크하는 주소·파일·앵커(`/10key/`, `#10key`, `#section-13`, `10key/config.json`)는 바꾸지 않습니다. 변경 이력의 이름 변경 줄에만 옛 이름 `10KEY`가 남습니다.
- 스토어·앱·Google이 링크하는 입구 주소(`/privacy/`, `/quirky-ball/privacy/`, `/10key/privacy/`, `/quirky-ball/terms/`, `/10key/terms/`, `/hexaworld1984/privacy/`, `/hexaworld1984/terms/`)는 언어 선택이나 리디렉트가 아니라 영어 문서 전문을 바로 보여 줍니다(2026-10-20, Google OAuth 브랜드 검토에서 언어 선택 화면이 "내용 부족"으로 거절됨). 이 `index.html`은 `python3 scripts/build_legal_entry_pages.py`가 영어 원문에서 만들므로 직접 고치지 않습니다. 영어 원문을 고친 뒤 이 스크립트를 실행하고, `scripts/check_legal_site.sh`는 사본이 원문과 다르면 실패합니다. 브라우저 언어 목록에서 한국어(또는 독일어 문서가 있으면 독일어)가 영어보다 먼저인 사람만 그 언어 문서로 옮기고, `/10key/privacy/`는 제13항에서 열립니다.
- 홈페이지 바닥글의 `House Duck Console (staff only)`는 콘솔의 Google 로그인 용도를 설명하는 제14항으로 연결됩니다.
- 제목·시행일은 `문서 메타데이터 시작/끝`, 본문은 `문서 본문 시작/끝` 주석 안에서만 수정합니다.
- 섹션 제목의 `id="section-..."`는 자동 목차가 사용하므로 지우지 않습니다.
- 색상·간격·모바일·인쇄 모양은 `assets/legal-site.css`, 목차·연도는 `assets/legal-site.js`가 공통 관리합니다.
- 문구 수정 후 `python3 scripts/build_legal_entry_pages.py`, `scripts/check_legal_site.sh`, `scripts/check_policy_content.sh`, `node scripts/test_legal_operations_tools.js`를 실행합니다.

### 공지 블록 편집

`운영 → 게임 공지`는 모드 전환 없는 단일 작성 영역입니다. 글을 쓰다 이미지를 붙여넣거나 파일을 선택하면 커서 위치에 브라우저 압축 WebP를 업로드·삽입합니다. 문단 크기, 굵게·기울임·밑줄, 정렬, 이미지 너비·대체 텍스트를 지원합니다. HTTPS 링크는 작성 영역과 실제 공지 본문에서 카드로 표시하고, YouTube는 썸네일을 표시합니다. 일반 웹에서는 클릭 후에만 개인정보 강화 플레이어를 로드하며 자동 재생하지 않습니다. 앱 embed는 기존 네이티브 링크 제한을 유지하므로 썸네일만 표시하고 외부 재생은 지원하지 않으며, YouTube 링크(썸네일·본문 내 링크 모두)는 네이티브 WebView가 가로채도록 `target=_self`로 렌더링합니다(해당 네이티브 가로채기 자체는 별도로 고치는 중입니다). 기존 일반 텍스트와 v1 공지 콘텐츠는 같은 저장 계약을 유지하며 원격 OG 메타데이터는 수집하지 않습니다. 분류 선택에서 `[공지]`·`[이벤트]`·`[예고]`를 고르며 목록·상세에는 문구와 색상 배지가 함께 표시됩니다. 기존 글의 `수정`으로 분류·본문·날짜를 바꾸고 `삭제`는 사유와 확인란을 거친 뒤 노출을 중지합니다. 삭제된 글의 감사 기록과 공용 이미지는 보관합니다.

- PNG/JPEG/정적 WebP를 브라우저에서 최대 긴 변 1,600px의 WebP로 변환합니다. 목표는 200 KiB, 업로드 상한은 300 KiB입니다. 필요하면 품질과 해상도를 단계적으로 낮춥니다. 큰 원본을 별도로 보관하지 않고 검증된 최종 WebP만 전송합니다. 이미 작고 메타데이터가 없는 정적 WebP는 재압축으로 더 커지지 않도록 그대로 사용합니다.
- 공지당 최대 60블록·이미지 8개를 허용합니다. 본문·문단 구분·이미지 설명을 포함한 원문 한도는 2,000자입니다.
- 서버는 구조화된 문단만 번역하고 이미지 경로·서식은 보존합니다. 이미지는 `announcement-media`의 SHA-256 경로로 중복 저장을 피하며 공개 공지용 자산입니다. 공개 화면은 HTML을 실행하지 않고 텍스트와 허용된 이미지 경로만 렌더링합니다.
- 배포 순서: 게임 서버 저장소의 `20260906120000_rich_announcement_content_and_media.sql`와 `20260906130000_announcement_category_and_soft_delete.sql` 마이그레이션, `admin-console`·`public-notice` Edge Function, 이 웹사이트 순서입니다. 서버 반영 전에는 새 편집기만 먼저 배포하지 않습니다. 기존 앱의 텍스트 폴백은 유지되며 웹뷰에서 서식·이미지를 표시합니다.
- 검사: `node --test tests/notice-content.test.mjs tests/notice-contract.test.mjs`, `node scripts/test_console_regressions.js`, `npx playwright test tests/console-announcement.spec.js tests/console-announcement-editor.spec.js tests/console-announcement-delete.spec.js tests/notice-rich-content.spec.js`.
