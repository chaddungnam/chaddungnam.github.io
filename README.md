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
- Gmail CS는 `gmail.modify` 토큰을 CS 화면에서만 요청하고 브라우저 메모리에만 둡니다. 메일·첨부·토큰은 Supabase와 저장소에 복사하지 않습니다.
- Project K는 준비 중입니다. 구매 화면은 서버에 기록된 구매·환불만 표시하며, 가격이 없으면 `금액 미기록`으로 표시합니다.

## 법적 문서 문구 수정 방법

- 실제 문구는 `quirky-ball/privacy/`, `quirky-ball/terms/`의 각 언어 HTML에 있습니다.
- 제목·시행일은 `문서 메타데이터 시작/끝`, 본문은 `문서 본문 시작/끝` 주석 안에서만 수정합니다.
- 섹션 제목의 `id="section-..."`는 자동 목차가 사용하므로 지우지 않습니다.
- 색상·간격·모바일·인쇄 모양은 `assets/legal-site.css`, 목차·연도는 `assets/legal-site.js`가 공통 관리합니다.
- 문구 수정 후 `scripts/check_legal_site.sh`와 `scripts/check_policy_content.sh`를 실행합니다.

### 공지 블록 편집

`운영 → 게임 공지`는 모드 전환 없는 단일 작성 영역입니다. 글을 쓰다 이미지를 붙여넣거나 파일을 선택하면 커서 위치에 브라우저 압축 WebP를 업로드·삽입합니다. 문단 크기, 굵게·기울임·밑줄, 정렬, 이미지 너비·대체 텍스트를 지원합니다. HTTPS 링크는 작성 영역과 실제 공지 본문에서 카드로 표시하고, YouTube는 썸네일을 표시합니다. 일반 웹에서는 클릭 후에만 개인정보 강화 플레이어를 로드하며 자동 재생하지 않습니다. 앱 embed는 기존 네이티브 링크 제한을 유지하므로 썸네일만 표시하고 외부 재생은 지원하지 않습니다. 기존 일반 텍스트와 v1 공지 콘텐츠는 같은 저장 계약을 유지하며 원격 OG 메타데이터는 수집하지 않습니다. 분류 선택에서 `[공지]`·`[이벤트]`·`[예고]`를 고르며 목록·상세에는 문구와 색상 배지가 함께 표시됩니다. 기존 글의 `수정`으로 분류·본문·날짜를 바꾸고 `삭제`는 사유와 확인란을 거친 뒤 노출을 중지합니다. 삭제된 글의 감사 기록과 공용 이미지는 보관합니다.

- PNG/JPEG/정적 WebP를 브라우저에서 최대 긴 변 1,600px의 WebP로 변환합니다. 목표는 200 KiB, 업로드 상한은 300 KiB입니다. 필요하면 품질과 해상도를 단계적으로 낮춥니다. 큰 원본을 별도로 보관하지 않고 검증된 최종 WebP만 전송합니다. 이미 작고 메타데이터가 없는 정적 WebP는 재압축으로 더 커지지 않도록 그대로 사용합니다.
- 공지당 최대 60블록·이미지 8개를 허용합니다. 본문·문단 구분·이미지 설명을 포함한 원문 한도는 2,000자입니다.
- 서버는 구조화된 문단만 번역하고 이미지 경로·서식은 보존합니다. 이미지는 `announcement-media`의 SHA-256 경로로 중복 저장을 피하며 공개 공지용 자산입니다. 공개 화면은 HTML을 실행하지 않고 텍스트와 허용된 이미지 경로만 렌더링합니다.
- 배포 순서: 게임 서버 저장소의 `20260906120000_rich_announcement_content_and_media.sql`와 `20260906130000_announcement_category_and_soft_delete.sql` 마이그레이션, `admin-console`·`public-notice` Edge Function, 이 웹사이트 순서입니다. 서버 반영 전에는 새 편집기만 먼저 배포하지 않습니다. 기존 앱의 텍스트 폴백은 유지되며 웹뷰에서 서식·이미지를 표시합니다.
- 검사: `node --test tests/notice-content.test.mjs tests/notice-contract.test.mjs`, `node scripts/test_console_regressions.js`, `npx playwright test tests/console-announcement.spec.js tests/console-announcement-editor.spec.js tests/console-announcement-delete.spec.js tests/notice-rich-content.spec.js`.
