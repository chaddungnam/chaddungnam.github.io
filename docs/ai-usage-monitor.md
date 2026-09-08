# 개인 AI 사용량

- 진입점: `https://houseduck.in/console/#/ai-usage` 또는 콘솔 첫 화면의 AI 사용량.
- 기존 관리자 세션과 서버 허용 목록을 재사용한다. 정적 HTML에는 실제 사용량·비밀키가 없다.
- Mac의 `~/.opencodex/publish_console_usage.py`가 로컬 모니터를 읽고 1분마다 요약을 전송한다.
- LaunchAgent: `com.opencodex.console-usage`. 쓰기 전용 장치 키는 Mac의 권한 0600 설정 파일에만 저장한다.
- Supabase `admin-ai-monitor`가 읽기/쓰기 인증을 분리한다. `admin_ai_monitor` 테이블은 RLS 활성화, 일반 역할 접근 금지, 최신 요약 한 행만 보관한다.
- 데이터는 허용된 숫자·모델명 필드만 저장한다. 3분 넘게 갱신이 없으면 Mac 갱신 지연으로 표시한다. Mac이 꺼져도 마지막 값은 조회할 수 있다.
- `console/ai-usage.html`은 기존 로컬 모니터의 압축형 화면을 재사용한 서버 조회용 사본이다. 수치 의미·화면 변경 시 두 화면을 함께 확인한다.

## 검증

- `node scripts/test_console_regressions.js`, `bash scripts/check_house_duck_console.sh`
- Quirky Ball 저장소: `deno test supabase/functions/admin-ai-monitor/index_test.ts`
- 익명/위조 세션/틀린 장치 키 차단, 장치 키로 읽기 불가, 관리자 읽기, 입력 크기·수집시각·허용 필드 검증.
- DB 일반 역할 읽기/쓰기 거부. RLS 정책 없음 INFO는 서비스 역할 전용 테이블의 의도된 상태다.

## 중지·복구

- Mac 전송 중지: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.opencodex.console-usage.plist`
- 화면은 이 기능의 사이트 커밋을 revert하여 되돌릴 수 있다. 기존 로컬 모니터와 Codex 연결은 유지된다.
- 키 회전은 Mac 장치 키와 DB의 SHA-256 검증값을 함께 교체한다. 공개 소스·로그에는 넣지 않는다.
