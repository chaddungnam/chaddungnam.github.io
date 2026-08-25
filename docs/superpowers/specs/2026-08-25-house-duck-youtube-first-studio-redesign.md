# House Duck YouTube 중심 스튜디오 홈 설계

## 목표

`houseduck.in` 홈을 블로그·연혁 중심 페이지에서 YouTube와 두 게임만 선명하게 보여주는 라이트 모드 게임 스튜디오 페이지로 바꾼다. 한국어·영어·독일어·일본어 홈은 같은 구조와 기능을 함께 적용한다.

검토 시안은 Superdesign의 `House Duck — 한독 게임 인덱스` v4이다.

- Draft: `c1126565-1858-4a8e-97af-e82b5bc0056e`
- Preview: https://p.superdesign.dev/draft/c1126565-1858-4a8e-97af-e82b5bc0056e

## 범위

- 대상: `index.html`, `index_en.html`, `index_de.html`, `index_ja.html`
- 공통 홈 CSS와 기존 바닐라 JavaScript
- 최신 YouTube 영상 3개 자동 동기화
- Quirky Ball의 실제 규칙을 반영한 HTML 슈팅 연출과 두 프로젝트의 기존 세로 MP4·포스터 사용
- 데스크톱과 모바일의 자연스러운 세로 스크롤 및 약한 스크롤 반응

이번 작업에서 하지 않는 일:

- 게임 소스, 게임 상세 페이지, 블로그 미러, 콘솔 수정
- 다크 모드 추가
- 가로 스크롤, 스크롤 위치 탈취, WebGL, 새 프론트엔드 프레임워크
- YouTube 업로드 자동화 또는 YouTube Data API 키 사용
- 법적 문서 내용 변경

## 홈 정보 구조

홈은 아래 순서만 사용한다.

1. 공통 헤더
2. B안 히어로와 Quirky Ball 슈팅 기믹 캔버스
3. 같은 크기의 최신 YouTube 영상 카드 3개
4. Quirky Ball 프로젝트와 재생 중인 아이폰 목업
5. Project K 프로젝트와 재생 중인 아이폰 목업
6. 최소 법적 푸터

블로그 카드, 연혁, 별도 About 유도, `작게 만들더라도, 오래 기억되는 게임을.` 문구와 후속 소개 섹션은 홈에서 제거한다. Project K 다음에는 새 홍보 섹션 없이 푸터가 바로 나온다. Blog는 푸터의 작은 보조 링크로만 유지한다.

## 시각·타이포그래피

### 헤더와 히어로

- 헤더에는 기존 공식 오리 로고와 House Duck 워드마크를 한 번만 사용한다.
- 히어로 내부의 중복 대형 로고 행은 넣지 않는다.
- 라이트 캔버스, 검정 텍스트, House Duck 노랑과 절제된 파랑을 쓴다.
- 주요 제목은 Montserrat, 본문은 OS 기본 한글 산세리프를 기본으로 한다.
- 배경의 매우 큰 영문은 낮은 대비의 도형처럼만 사용하고 읽어야 하는 본문을 가리지 않는다.
- 오른쪽 빈 공간에는 새 라이브러리 없이 Canvas 2D로 Quirky Ball 구슬과 붉은 쿼키 슈팅을 보여준다.
- 붉은 쿼키는 잘린 제품 이미지 대신 실제 게임의 육각형 몸·얼굴 비율을 따라 양발까지 포함한 완전한 SVG로 다시 그린다. 도형은 viewBox 가장자리에서 충분히 안쪽에 둔다.

Canvas 연출은 실제 게임 규칙을 축약해 반복한다.

- 붉은 쿼키: 2.25초 동안 4.5회 회전하며 아래로 이동
- 발사: 육각 모서리에서 서로 반대 방향의 쌍발을 0.25초마다 발사해 총 초당 8발
- 탄환: 각진 붉은 볼트와 분리 잔광, 구슬 관통, 벽에서 한 번 반사 뒤 다음 벽에서 제거
- 피격: 실제 레벨 색상과 원·타원 비율을 쓴 구슬이 기존 크기의 82~94%로 줄어듦
- 한 번의 짧은 이벤트 뒤 휴지 구간을 두고 반복하며, 본문 위를 가리지 않음

히어로 제목은 모든 언어에서 다음 영문을 유지한다.

> Made in Germany, from South Korea.

설명은 언어별로 같은 의미를 전달한다.

| 언어 | 설명 |
| --- | --- |
| KO | 기술과 속도의 강국 한국에서 온 인재가 품질의 나라 독일에서 소프트웨어를 만듭니다. |
| EN | Talent from South Korea, a country of technology and speed, builds software in Germany, a country known for quality. |
| DE | Ein Talent aus Südkorea, dem Land der Technologie und Geschwindigkeit, entwickelt Software in Deutschland, dem Land der Qualität. |
| JA | 技術とスピードの国・韓国から来た人材が、品質の国・ドイツでソフトウェアを作ります。 |

### 게임별 글꼴

- Quirky Ball의 `AIM / SHOOT / MERGE`와 행동 키워드는 기존 Do Hyeon을 선택적으로 사용한다.
- 칠곡할매 권안자체는 웹 사용 허용 범위를 확인한 원본 WOFF를 그대로 사용하고 칠곡군 출처를 함께 둔다. 사람 냄새가 필요한 설명과 상태 문구에만 제한한다.
- Project K의 `미분류 계획서` 같은 카테고리 한 줄은 `Gungsuh/GungSeo/Batang` 시스템 폴백만 사용한다. 재배포 허용 파일을 확인하지 못한 궁서체 파일은 저장소에 넣지 않는다.

## YouTube 자동 갱신

### 데이터 흐름

채널 ID `UCVeNEKtmPXkSUuTslQKUKbw`의 공개 Atom 피드를 사용한다.

`https://www.youtube.com/feeds/videos.xml?channel_id=UCVeNEKtmPXkSUuTslQKUKbw`

1. 별도 GitHub Actions 워크플로가 4시간마다 피드를 한 번 내려받는다.
2. Node 24 표준 기능만 쓰는 작은 동기화 스크립트가 최신 3개의 영상 ID, 제목, 게시 시각을 검증한다.
3. 검증된 결과만 `assets/youtube-feed.json`에 원자적으로 교체하고 커밋한다.
4. 홈 전용 `assets/studio-home.js`가 로컬 JSON을 읽어 네 언어 홈의 카드 3개를 갱신한다.
5. 썸네일과 영상 링크는 검증된 영상 ID로 각각 `i.ytimg.com`과 `youtube.com/watch` URL을 만든다.

블로그 동기화 워크플로에는 결합하지 않는다. 번역 API나 Tistory 장애가 YouTube 갱신을 막지 않도록 YouTube 워크플로 하나만 별도로 둔다. 새 npm 패키지는 추가하지 않는다.

### 실패 처리

- 네트워크 실패, 잘못된 XML, 영상 ID·제목·날짜 누락 시 워크플로는 실패하고 기존 JSON을 덮어쓰지 않는다.
- 브라우저에서 JSON 로드가 실패하면 HTML에 들어 있는 마지막 정상 카드 3개를 그대로 유지한다.
- 공개 피드에 영상이 3개보다 적으면 검증 실패로 처리하고 마지막 정상 카드 3개를 유지한다.
- RSS에 없는 영상 길이는 표시하지 않는다. 카드 메타데이터는 게시일만 사용한다.
- 카드 3개는 같은 썸네일 비율과 본문 최소 높이를 사용해 데스크톱에서 같은 크기로 정렬한다.

## 프로젝트 영역

### Quirky Ball

- 설명은 드래그·드롭 게임이 아니라 `AIM / SHOOT / MERGE / SPEED / ACTION / COMPETE / CONTROL`을 중심으로 쓴다.
- 기존 18초 `assets/media/quirky-ball-gameplay.mp4`는 실제 플레이 목업에 유지한다. 현재 붉은 회전 슈팅과 조준 슈팅 규칙은 히어로 HTML Canvas에서 별도로 정확하게 보여준다.
- 목업은 카메라 필, 측면 버튼, 둥근 화면, 홈 인디케이터를 포함한다.
- 목업 상단은 카드 경계보다 약 36px(모바일)~60px(데스크톱) 올라오고, 하단과 키워드 띠는 카드 안에 남는다.

### Project K

- 기존 `assets/media/project-k-highlight.mp4`와 포스터를 같은 계열의 아이폰 목업 안에 넣는다.
- 카테고리 한 줄에만 궁서 계열을 사용하고 나머지는 공통 타이포그래피를 따른다.
- 출시 상태는 다음처럼 번역한다.

| 언어 | 상태 |
| --- | --- |
| KO | 출시 예정 미정 |
| EN | Release date TBD |
| DE | Veröffentlichungstermin offen |
| JA | 発売時期未定 |

두 영상은 `autoplay muted loop playsinline`과 포스터를 사용한다. 자동 재생이 막히거나 파일이 실패하면 포스터가 남아야 한다. 화면 밖 영상은 IntersectionObserver로 일시 정지하고 다시 들어오면 재생을 시도해 불필요한 재생을 줄인다.

## 스크롤과 반응형

- 페이지는 데스크톱과 모바일 모두 브라우저 기본 세로 스크롤을 사용한다.
- 진입 요소는 짧은 투명도·클립·세로 이동으로 한 번만 나타난다.
- 히어로 배경 영문과 아이폰 목업에는 작은 깊이 이동만 적용한다.
- 붉은 쿼키는 히어로 오른쪽에서 시작해 스크롤을 따라 내려오고 Quirky Ball 카드에 도달하기 전에 사라진다. 콘텐츠와 링크 클릭은 막지 않는다.
- 화면 중앙의 콘텐츠에 따라 배경을 웜화이트 → 화이트 → Quirky 진행 블루 → Project K 웜그레이로 전환한다.
- JavaScript가 없어도 모든 텍스트, 포스터, 링크가 처음부터 보인다.
- `prefers-reduced-motion`에서는 캔버스를 정지 화면으로 두고, 붉은 쿼키 동행·진입 효과·패럴랙스·자동 재생을 끈 뒤 포스터를 우선한다.
- 390px에서 가로 넘침이 없어야 하며 링크·언어 버튼의 터치 영역은 최소 44px이다.

## 구현 경계

- 홈 전용 배치는 기존 `assets/studio-home.css`에서 교체한다.
- 공통 메뉴·언어는 기존 `assets/brand-site.js`를 유지하고, 홈 전용 Canvas·스크롤·YouTube 피드만 `assets/studio-home.js`에 둔다.
- 기존 로고, Montserrat, Do Hyeon, 게임 포스터와 두 프로젝트 MP4를 재사용하고, 칠곡할매 권안자체 WOFF와 완전한 붉은 쿼키 SVG만 추가한다.
- 삭제된 홈 구조를 위한 새 컴포넌트나 호환 레이어는 남기지 않는다.
- Tailwind, Iconify CDN이나 모션 라이브러리는 제품 코드에 추가하지 않는다. 승인 시안의 외형만 기존 정적 HTML/CSS/JS로 옮긴다.

## 검증과 완료 게이트

| 요구사항 | 구현 근거 | 검증 근거 |
| --- | --- | --- |
| B안 히어로와 중복 로고 제거 | 네 언어 홈, `studio-home.css` | 1440×900·390×844 스크린샷 |
| 실제 규칙 기반 Quirky 슈팅 | Canvas 2D와 완전한 붉은 쿼키 SVG | 발사 주기·쌍발·1회 반사·축소 검사, 프레임 변화 확인 |
| 최신 영상 3개 자동 갱신 | YouTube 워크플로, 동기화 스크립트, JSON, `brand-site.js` | 정상·잘못된 피드 실행 검사와 카드 DOM 검사 |
| 같은 크기의 영상 카드 | 공통 카드 CSS | 데스크톱 카드 높이 비교 |
| 상단이 돌출된 두 아이폰 목업의 실제 영상 | 기존 실제 플레이 MP4 2개·홈 마크업 | 36~60px 돌출, 재생 속성, 포스터, 화면 밖 정지, 브라우저 화면 |
| Quirky Ball 행동 키워드 | 네 언어 프로젝트 문구 | 텍스트 회귀 검사 |
| Project K 출시 미정 | 네 언어 프로젝트 문구 | 텍스트 회귀 검사 |
| 연혁·마지막 문구 제거 | 네 언어 홈 | 금지 문구·섹션 부재 검사 |
| 쿼키 동행·배경 전환·모션 축소 | CSS와 `brand-site.js` | 구간별 색상, 콘텐츠 비가림, 모바일 오버플로·reduced-motion 검사 |

기존 정적 검사와 `npm run test:e2e`를 실행하고, Aside에서 로컬 최종 코드를 데스크톱 1440×900과 모바일 390×844로 확인한다. 비포 화면은 현재 라이브 홈 캡처를 사용하며 애프터 화면은 최종 코드에서 새로 캡처한다. 실제 iPhone 기기 확인을 하지 않았다면 브라우저 모바일 에뮬레이션과 구분해 보고한다.

모든 필수 항목이 `완료`이고 테스트와 애프터 캡처가 있을 때만 전체 완료로 판정한다.
