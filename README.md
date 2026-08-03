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

- `/console/`은 Google 허용 계정과 서버의 2차 질문 확인을 모두 통과해야 열립니다.
- 재화·점수·운영 변경은 브라우저가 데이터베이스를 직접 쓰지 않고 관리자 Edge Function과 감사 RPC만 사용합니다. 플레이어 수정 플래그의 기본값은 `false`입니다.
- `/analytics/`는 호환 주소이며 통합 콘솔의 분석 화면으로 이동합니다.
- Gmail CS는 `gmail.modify` 토큰을 CS 화면에서만 요청하고 브라우저 메모리에만 둡니다. 메일·첨부·토큰은 Supabase와 저장소에 복사하지 않습니다.
- Project K와 구매 내역은 실제 연동 전까지 껍데기와 `결제 미연동` 상태만 표시합니다.

## 법적 문서 문구 수정 방법

- 실제 문구는 `quirky-ball/privacy/`, `quirky-ball/terms/`의 각 언어 HTML에 있습니다.
- 제목·시행일은 `문서 메타데이터 시작/끝`, 본문은 `문서 본문 시작/끝` 주석 안에서만 수정합니다.
- 섹션 제목의 `id="section-..."`는 자동 목차가 사용하므로 지우지 않습니다.
- 색상·간격·모바일·인쇄 모양은 `assets/legal-site.css`, 목차·연도는 `assets/legal-site.js`가 공통 관리합니다.
- 문구 수정 후 `scripts/check_legal_site.sh`와 `scripts/check_policy_content.sh`를 실행합니다.
