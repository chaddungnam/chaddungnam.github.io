# House Duck 콘솔 2.0 점검 (2026-09-27)

## 범위와 확인 방법
- 구현 전 점검을 먼저 기록했다. 콘솔 `claude/console-2-0`, 서버 `claude/console-server`의 시작 상태 기준이다.
- 아래 서버 경로는 `qb-console-server/` 기준이다. 마이그레이션 파일 존재는 라이브 적용 증명이 아니다.
- 실제 주소는 Aside로 관리자 프로젝트 선택 화면까지 읽었다. 사용자 데이터는 문서·캡처에 담지 않는다.
- 내부 운영 흐름은 코드와 로컬 목업으로 확인한다. `psql`이 없어 라이브 SQL 조회·적용은 하지 않는다.
- 새 화면은 기존 카드·폼·확인창을 쓰고, 관리자 인증 → Edge Function → 읽기/감사 RPC 경로를 유지한다.

## 기능 대조표 (구현 전)
| 항목 | 서버 근거(파일:줄) | 콘솔 상태와 근거(파일:줄) | 보완 |
|---|---|---|---|
| 연구소 시약·헥스·VIP·방치 | `supabase/migrations/20260908212829_lab_state_foundation_v1.sql:6`, `20260929090300_lab_claim_idle_v4.sql:142` | 부분 · `console/analytics.js:1473` 전체 경제 집계만 있음 | 개인 연구소 카드 |
| 페이즈·스텝 스냅숏 | `supabase/migrations/20260924090000_lab_progress_snapshot_v1.sql:4` | 없음 · `console/players.js:147` 상세는 1.x 재화 중심 | 진행·저장 시각 표시 |
| 튜토리얼 지능 | `supabase/migrations/20260923120914_lab_tutorial_intelligence_v1.sql:8` | 부분 · `console/players.js:161` 최초 튜토리얼 기록만 | 지능 기준과 완료 추정 금지 안내 |
| 런 티켓·원장·결과 보너스·코어 | `supabase/migrations/20260925090300_lab_run_tickets_v1.sql:81`, `20260929090000_lab_play_ledger_v1.sql:30` | 없음 · `console/players.js:147` | 최근 20건·적립 잔액 |
| 런 EXP 이벤트 | `supabase/migrations/20260928090000_liveops_config_public_v1.sql:7` | 없음 · `console/operations.js:47` 설정 요약에 없음 | 기간·배수·대상 미리보기 |
| 2.0 기능 스위치 | `supabase/migrations/20260928090000_liveops_config_public_v1.sql:21` | 부분 · `console/operations.js:58` 친구초대만 | 연구소·이벤트·보스·패스 상태와 조작 |
| 이벤트 시약 우편 | `supabase/migrations/20260929090400_liveops_event_rewards_v1.sql:232` | 부분 · `console/operations.js:325` 1.x 우편만 | 키·시약·수령 기간·미리보기·감사 |
| 파워 랭킹 요약·페이지·스냅숏 | `supabase/migrations/20260925093000_lab_power_ranking_summary_v1.sql:33`, `20260925150000_lab_power_ranking_page_v1.sql:1`, `20260929090200_lab_ranking_snapshot_v1.sql:2` | 없음 · `console/index.html:294` 운영에 없음 | 날짜·상위 N·어제/오늘 비교 |
| 친구 알림 | `supabase/migrations/20260925160000_friend_alert_flags_v1.sql:10` | 없음 · `console/players.js:147` | 개인 미처리 요청·선물 여부 |
| App Store 검증 귀속 | `supabase/migrations/20260929090100_app_store_purchase_binding_v1.sql:3`, `supabase/functions/verify-app-store-purchase/index.ts:47` | 부분 · `console/purchases.js:42` iOS 스토어만 구분 | 귀속·환경 필터, 원본 영수증 제외 |
| VIP1·시즌 유료·스타터팩 v2 | `supabase/migrations/20260929090100_app_store_purchase_binding_v1.sql:33`, `20260919190000_vip1_purchase_v3.sql:1` | 부분 · `console/purchases-model.js:11` 구 상품만 | 상품명·필터·starter_pack 별칭 |
| 환불·권한 | `supabase/migrations/20260903155500_classify_google_play_test_purchases.sql:68` | 있음 · `console/purchases.js:43` 상태·권한 표시 | 기존 표시와 미연동 경고 보존 |
| 튜토리얼 KO/DE·대사 | `scripts/analytics/AnalyticsEventContract.gd:52`, `docs/analytics_dashboard.md:115` | 부분 · `console/index.html:237` 1.x 단계 표 | 버전·언어별 새 도달률·대사 |
| 보너스 제안→요청→지급 | `scripts/analytics/AnalyticsEventContract.gd:65` | 없음 · `console/analytics.js:1473` 경제 집계만 | 단계별 모수·50 미만 표시 |
| 보스 첫 도전·시즌 유료 탭→구매 | `scripts/analytics/AnalyticsEventContract.gd:56`, `:75` | 없음 · `console/analytics.js:1573` 일반 구매 추이 | 설치·버전 단위 관측 한계 표시 |
| 버전별 D1·D7 | `docs/analytics_dashboard.md:100`, `:128` | 부분 · `console/analytics.js:1622` 전체 유지율 | 성숙 코호트 분모 구분 |
| 무결성·신고 | `supabase/migrations/20260925090000_integrity_guard_foundation.sql:69`, `20260924120000_issue_reports_v1.sql:1` | 부분 · 서버 `admin_console_logic.ts:86` 신고 조회만 연결, CS 표시 없음 | 개인 경고·읽기 전용 신고 목록 |

합계: 있음 1, 부분 9, 없음 7. 보완 대상 16개 묶음. 서로 다른 기능을 행 단위로 묶은 수이며 테스트 통과 수가 아니다.

## 화면별 운영 장애
| 화면 | 막히는 곳 | 처리 방침 |
|---|---|---|
| 플레이어 상세 | 1.x 재화와 연구소 지갑이 다름. 오래된 응답이 다른 계정에 붙으면 위험 | 상세와 별도 연구소 조회, 계정/요청 순서 검사. 0과 기록 없음 구분 |
| 운영 | 이벤트를 SQL로만 다룸. 미리보기 없이 전체 우편을 보내기 쉬움 | 설정 조회 실패 시 쓰기 잠금. 켜기는 대상/총량 확인, 끄기는 확인창 한 번 |
| 구매 | iOS 검증 귀속·환경·새 상품 없음. 테스트 결제와 운영 매출 혼동 | 서버에서 환경 필터 후 집계/페이지 처리. 금액 없음은 추정하지 않음 |
| 분석 | 구버전과 2.0 표본 혼합, 첫 시도·구매 전환 정의 불명확 | 버전 분리, 관측 첫 시도 명시. 서로 연결 안 되는 건 수치로 가장하지 않음 |
| 감사 | 기존 성공/실패·전후 값·계정 링크는 있음 | 새 이벤트 조작도 같은 감사 목록에 표시. 되돌리기는 기존 재화만 유지 |
| CS | Gmail 연결 전 게임 내 신고가 안 보임 | Gmail과 별개인 신고 읽기 카드. 응답/사용자 데이터 수정은 하지 않음 |
| 빈 상태·오류 | 표의 빈 행은 있으나 원시 오류 코드가 많음 | 배포 전/조회 실패/기록 없음 분리, 재조회 버튼과 입력 보존 |
| 밀도·모바일 | 접힌 작업 카드와 내부 가로 표가 혼재 | 새 카드도 접기 활용. 360px에서 새 표는 세로 카드로 표시 |
| 느린 조회 | 기존 45초 제한, 분석 집계와 개인 조회 비용 차이 | 새 읽기 분리, 제한 20/50/200건, 로딩 표시와 응답 역전 방지 |

## 구현 시 지킬 계약
- `admin_console_lab_account_facts_v1`은 완료 런 수 집계다. 개인 지갑 조회로 오용하지 않는다. `admin_lab_economy_v1`의 기존 경제 화면은 보존한다.
- 스냅숏은 UTC 매일 02:15 예약이며 pg_cron 설치 시에만 등록된다. 상위 200명 밖/당일 미생성은 순위를 추정하지 않는다.
- 이벤트 우편은 기존 계정에게 즉시 발송하고 수령 기한은 1~30일이다. 미래 자동 발송 예약은 기존 서버에 없다.
- 이벤트 키는 계정당 한 번이다. 끄기는 추가 지급을 멈추며 이미 발송한 우편을 회수하지 않는다.
- 튜토리얼 지능 Lv1 이상만으로 완료를 확정하지 않는다. 보스는 보관된 첫 관측 결과와 실제 생애 첫 도전을 구분한다.
- 분석 원본은 보관 기간 제한이 있다. D1/D7은 설치일/버전 분리, 관측 기간이 끝난 분모만 쓴다.
- 구매 귀속 원본 영수증·거래 식별자는 브라우저에 보내지 않는다. Sandbox는 명시적으로 구분한다.
- 새 SQL은 새 관리자 함수만 추가하며 기존 게임 함수·뷰·정책·기본 플래그를 변경하지 않는다.

## 구현 후 확인 (라이브 반영 아님)
- 보완 16묶음 모두에 화면·관리자 경로를 연결했다. 없음 7 → 신규 연결 7, 부분 9 → 보완 9다.
- 이 중 13묶음은 요청한 조회/조작을 구현했고, 3묶음은 원본 데이터 한계가 남는다: 랭킹(상위 200명 밖), 언어별 튜토리얼(언어 미기록), 보스/시즌 퍼널(생애 첫 도전·정산 귀속 증명 없음).
- 개인 조회·랭킹·퍼널·신고는 `console/lab.js`, 이벤트는 `console/liveops.js`에 묶었다. 기존 경제 분석 함수와 1.x 조작·인증은 유지한다.
- 이벤트 쓰기는 범위 검사·확인창·재시도 요청 ID·설정 잠금·성공/실패 감사 기록을 사용한다. 미리보기 수치는 저장 시점 계정 증가로 달라질 수 있다.
- 시약은 문자열로 받아 큰 정수를 반올림하지 않는다. 영수증 원문·런 티켓 식별자·관리자 비밀은 새 읽기 응답에 넣지 않는다.
- 구매는 서버에서 환경을 필터한 뒤 요약/페이지를 계산한다. 기존 Android 테스트 구매 제외 규칙을 유지한다. 미기록 환경은 Production으로 추정하지 않는다.
- 계측 50 미만·분자>분모·누락 값을 각각 ‘표본 부족’·‘집계 확인 필요’·‘기록 없음’으로 구별한다.
- Aside 로컬 목업에서 운영 미리보기/확인, 취소(쓰기 0회), 구매 Sandbox 필터, 연구소 상세·오류 후 재조회, 랭킹 어제/오늘, 표본 부족, 게임 내 신고를 실제 버튼으로 확인했다.
- 360×800은 Aside 안의 고정 폭 iframe이다. Android/iPhone 기기 결과가 아니다. 새 카드와 구매 표는 문서 폭을 넘기지 않는다.
- 기존 모바일 하단 메뉴의 세로 글자 꺾임과 새로고침 잘림도 Quirky Ball 메뉴가 열린 경우에만 고쳤다. HEXAWORLD 본문·조작은 변경하지 않았다.

## 리드 적용 순서·남은 검증
1. 새 SQL이 참조하는 기존 객체가 먼저 있는지 확인한다: lab_profiles/events, lab_progress_snapshots, lab_run_tickets, lab_play_ledger_v1, lab_core_tunes_v1, integrity_events/holds, lab_ranking_snapshots_v1, app_store_purchase_bindings, 기존 admin/audit/우편 함수.
2. 서버 `supabase/migrations/20260930000100_console_2x_reads.sql` → `20260930000200_console_2x_liveops.sql` → `20260930000300_console_2x_analytics.sql` 순서. 각 파일 **1행부터** `begin … rollback` 확인 SQL과 제거 범위가 있다.
3. `supabase/functions/admin-console/`를 검증·배포한 뒤 콘솔을 반영한다. 새 RPC는 7개이며 서비스 전용 실행 권한만 부여한다. 새 코드 자체가 기존 플래그를 켜거나 우편을 보내지 않는다.
4. 기존 20260929 이벤트 우편·구매·스냅숏 마이그레이션의 적용 여부와 1.1.3 호환성은 별도 리드 판단이다. 이번 작업에서 실행하지 않았다.
5. `psql` 부재로 SQL 실행·실행계획·롤백 결과는 미검증이다. 실제 계정/결제·Gmail 발송·라이브 변경·push도 하지 않았다.
6. 언어별 실측은 앱 이벤트에 locale이 들어온 뒤 가능하다. 생애 첫 보스 도전과 서버 구매 영수증을 잇는 분석도 추가 클라이언트/서버 계약이 필요하다.
7. 로컬 재현: `node scripts/console_2x_fixture.cjs` → Aside에서 `http://127.0.0.1:8765/console/` 또는 `/_qa/360`. 목업 외 API는 연결하지 않는다.
8. 비포 캡처는 시작 커밋 `d9829e6`의 console 파일과 변경 없는 공통 자산, 동일 목업으로 만들었다. 캡처는 `docs/console-2x-captures/`에 있다.

## 우선순위와 실행 순서
| 항목 | 왜 필요한가 | 콘솔 파일 | 서버 파일 | 크기 |
|---|---|---|---|---|
| P0 관리자 계약·감사 | 중복 지급·권한 우회 방지 | `console/model.js` | `admin-console/admin_console_logic.ts`, 새 liveops SQL | 중 |
| P1 연구소·무결성·친구 | CS 원인 확인 | `console/players.js`, 새 `console/lab.js` | 새 reads SQL | 중 |
| P1 이벤트·랭킹 | SQL 없이 운영 판단 | 새 `console/liveops.js`, `console/index.html` | 새 reads/liveops SQL | 중 |
| P1 구매 귀속·환경 | 테스트/실결제 오판 방지 | `console/purchases.js`, `purchases-model.js` | 새 purchases RPC | 소 |
| P1 2.0 분석 | 출시 이후 이탈·보상 확인 | `console/lab.js` | 새 analytics SQL | 중 |
| P2 게임 내 신고 | Gmail과 별개 신고 확인 | `console/lab.js` | 기존 reports.list 재사용 | 소 |
| P1 회귀·화면·인계 | 기존 1.x 유지와 적용 경계 증명 | `scripts/check_house_duck_console.sh`, `scripts/test_console_model.js`, `answer.md` | admin-console 테스트·각 SQL 머리 롤백문 | 중 |
