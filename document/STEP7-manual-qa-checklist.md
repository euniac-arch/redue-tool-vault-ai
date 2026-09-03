# STEP 7 — 수동 QA 체크리스트

브라우저 자동화 도구는 이 환경에 없습니다.  
아래 **A. 자동화로 이미 확인하는 것**과 **B. 사람이 브라우저에서 눌러봐야 하는 것**을 나눕니다.

기준일: 2026-08-30  
앱: `studio/` (Next.js)  
기본 경로: `/intelligence`

---

## A. 자동화로 가능한 부분 (브라우저 불필요)

로컬에서 먼저 돌립니다. 실패하면 수동 QA를 시작하지 않습니다.

```bash
cd studio
npm run test:asi
npm run test:score
npx tsx scripts/test-insights-modal-a11y.ts
npx tsx scripts/test-insights-ai-research.ts
npx tsx scripts/test-insights-youtube.ts
npx tsx scripts/test-full-audit-engine.ts
```

| 영역 | 스크립트가 확인하는 것 | 스크립트가 확인하지 않는 것 |
|---|---|---|
| ASI 라우트 / 12 slug | `test-intelligence-nav` — 경로·별칭·breadcrumb | GNB 드롭다운이 실제로 열리는지 |
| ASI API envelope | `test-intelligence-api` / envelope / guard | 네트워크 탭의 실제 왕복, 중복 호출 체감 |
| War Room / Perception / Rec / Evidence / Future 데이터 | 각 `test-intelligence-*` — 스냅샷 형상, SoV, citation | 차트 픽셀, 테이블 가로 스크롤 |
| Abort / stale | `test-intelligence-ui` — `isLive` 계약, 5 대시보드 소스 | Cancel 버튼 클릭, unmount 체감 |
| 모달 a11y 계약 | `test-insights-modal-a11y` — role/aria/훅 재사용 | Tab 순서, 스크린리더 낭독 |
| 점수 무결성 | `test-score` / `test-score-integrity` | 결과 화면 레이아웃 |
| Insights YouTube/리서치 | 파서·쿼터·sanitize | 잠금 모달 / 플레이어 모달 UX |

**자동화로 “통과”해도 수동이 필요한 이유:** 레이아웃, 포커스 링, overflow, 느린 네트워크, 실제 `/api/intelligence` 실패 UI.

---

## B. 수동 테스트가 필요한 부분

### 준비

1. `studio` 개발 서버 실행.
2. Chrome DevTools → 각 뷰포트로 전환 (아래 해상도).
3. ASI 캐시 초기화 (empty 재현용): Application → Session Storage에서 `asi_` 로 시작하는 키 삭제.
4. 성공 재현용: SEO/GEO 진단을 한 번 끝낸 뒤 Intelligence로 진입하거나, 각 페이지 URL 칸에 실제 사이트를 넣고 분석.

### 뷰포트 (필수)

표시: `[ ]` 통과 / `[F]` 실패 + 메모.

| 구분 | 너비 | 확인 |
|---|---|---|
| Desktop | 1440px | `[ ]` |
| Desktop | 1280px | `[ ]` |
| Desktop | 1024px | `[ ]` |
| Tablet | 768px | `[ ]` |
| Mobile | 390px | `[ ]` |
| Mobile | 375px | `[ ]` |

각 너비에서 공통으로:

- `[ ]` 가로 스크롤이 **페이지 전체**에 생기지 않음 (테이블은 카드 안에서만 스크롤 허용)
- `[ ]` GNB / Intelligence 서브내비 / URL 입력 / 분석 버튼이 잘리지 않음
- `[ ]` 본문이 뷰포트 밖으로 밀리지 않음

최소 수동 세트: **1440 + 768 + 390**. 나머지는 회귀나 레이아웃 이슈가 있을 때.

---

## C. 교차 검증 (뷰포트 최소 1440 / 390)

### Navigation

- `[ ]` 헤더 → AI Search Intelligence (또는 해당 GNB) → 12개 자식 링크가 모두 보임
- `[ ]` `/intelligence` 허브 진입 후 도구 카드/링크로 12개 이동
- `[ ]` 서브내비(필러) 전환 시 URL이 아래 12 slug와 일치
- `[ ]` breadcrumb 클릭이 올바른 필러/허브로 이동
- `[ ]` 모바일에서 GNB가 햄버거/오버레이로 열리고, 연 뒤 바깥/닫기로 닫힘

### Modal (Insights — STEP 5)

`/insights` YouTube 탭 / AI 리서치 한도 초과 시.

| 항목 | InsightsAiLockModal | YouTubeModal |
|---|---|---|
| 열릴 때 포커스가 다이얼로그로 이동 | `[ ]` | `[ ]` |
| Tab / Shift+Tab이 모달 안에서만 순환 | `[ ]` | `[ ]` |
| Escape로 닫힘 | `[ ]` | `[ ]` |
| 닫은 뒤 트리거(검색/재생 버튼)로 포커스 복원 | `[ ]` | `[ ]` |
| `role="dialog"` + 제목 낭독(제목이 보임) | `[ ]` | `[ ]` |
| 배경 클릭으로 닫힘, 배경은 스크롤/탭 불가 | `[ ]` | `[ ]` |
| 키보드만으로 닫기·로그인/피드·원문 링크 가능 | `[ ]` | `[ ]` |

### Keyboard / Focus / Escape (ASI)

- `[ ]` URL 입력 → Tab → 분석 → (로딩 중) 취소 버튼까지 포커스 이동
- `[ ]` 포커스 링이 보이며 잘리지 않음
- `[ ]` Escape는 **모달이 없을 때** 분석을 강제 종료하지 않음 (취소는 버튼)
- `[ ]` 필터 칩(Citation / Question intent)에서 ← → 로 이동 (자동화는 로직만 검증)

### Responsive / Overflow

- `[ ]` KPI 5칸(War Room)이 1440에서 한 줄, 390에서 2열 등으로 깨지지 않음
- `[ ]` 긴 URL / 긴 브랜드명이 truncate 되고 레이아웃을 밀지 않음
- `[ ]` 테이블(`AsiDataTable`)은 카드 내부 가로 스크롤만
- `[ ]` sticky 헤더/진단 바가 모달·ASI 크롬을 가리지 않음

### Chart / Table

- `[ ]` Perception 레이더, Recommendation SoV, Agent Readiness 링이 리사이즈 후에도 영역 안에 있음
- `[ ]` 차트 라벨이 겹치거나 잘리지 않음 (390에서 특히)
- `[ ]` War Room 경쟁사 테이블, Competitor 테이블 헤더/숫자 열이 정렬됨
- `[ ]` 같은 스냅샷에서 도구만 바꿔도(brand↔reputation) 차트가 **다시 마운트**되어도 데이터는 캐시로 즉시 표시

### Loading

- `[ ]` 분석 중 `AsiLoadingState` + 버튼이 제출 중 라벨
- `[ ]` **취소**를 누르면 로딩이 끝나고, 이전 성공 결과가 있으면 유지
- `[ ]` 취소를 연달아 눌러도 에러 토스트/깨진 JSON이 없음

### Error / API failure

재현: DevTools → Network → `/api/intelligence`를 Block 하거나 Offline.

- `[ ]` 사용자에게 안전한 문구만 보임 (키 이름, stack, 내부 경로 없음)
- `[ ]` 잘못된 URL(빈 값, `not-a-url`)은 클라이언트 검증 메시지
- `[ ]` 실패 후 다시 분석하면 복구됨

### Empty

재현: 시크릿 창, sessionStorage `asi_*` 삭제, 진단 이력 없이 `/intelligence/war-room` 진입.

- `[ ]` empty 제목/본문이 보이고 차트가 빈 축으로 깨지지 않음
- `[ ]` URL을 넣고 분석하면 empty가 결과로 바뀜

### Slow network

재현: Network → Slow 3G. 분석 클릭.

- `[ ]` 로딩이 유지되고 이중 제출로 결과가 뒤집히지 않음 (나중 요청만 반영)
- `[ ]` 페이지를 떠나면(다른 도구 `key` 전환) 이전 요청이 화면을 덮어쓰지 않음

### Reduced motion

재현: DevTools → Rendering → `prefers-reduced-motion: reduce`.

- `[ ]` 차트/카운트업/호버 scale이 과하게 움직이지 않음
- `[ ]` YouTube 모달 embed가 autoplay하지 않음 (`autoplay=0`)
- `[ ]` 기능(분석, 닫기, 탭)은 그대로 동작

---

## D. AI Intelligence 12개 메뉴

각 행: 진입 → (필요 시) 분석 → 상태 4종 + 모바일(390).

재현 팁

| 상태 | 방법 |
|---|---|
| empty | `asi_*` 세션 삭제 후 해당 URL로 직행, 분석 안 함 |
| loading | Slow 3G + 분석. 취소 버튼 보이는지 확인 |
| success | 유효 URL 분석 또는 직전 진단 URL 시드 |
| error | `/api/intelligence` Block, 또는 잘못된 URL |
| mobile | 390px에서 위 4종 중 success + empty는 필수 |

| # | 메뉴 | 경로 | 진입 | API | loading | success | error | empty | mobile 390 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | War Room | `/intelligence/war-room` | `[ ]` | `[ ]` POST `war-room` | `[ ]` | `[ ]` KPI·테이블·상태 카드 | `[ ]` | `[ ]` | `[ ]` |
| 2 | Brand Perception | `/intelligence/brand-perception` | `[ ]` | `[ ]` POST `brand-perception` | `[ ]` | `[ ]` 레이더/축 | `[ ]` | `[ ]` | `[ ]` |
| 3 | Reputation Radar | `/intelligence/reputation-radar` | `[ ]` | `[ ]` 동일 스냅샷(캐시) | `[ ]` | `[ ]` 레이더 | `[ ]` | `[ ]` | `[ ]` |
| 4 | Brand Snapshot | `/intelligence/brand-snapshot` | `[ ]` | `[ ]` 동일 스냅샷(캐시) | `[ ]` | `[ ]` 스냅샷 카드 | `[ ]` | `[ ]` | `[ ]` |
| 5 | Recommendation Test | `/intelligence/recommendation-test` | `[ ]` | `[ ]` POST `recommendation-test` | `[ ]` | `[ ]` 엔진 답변 | `[ ]` | `[ ]` | `[ ]` |
| 6 | Simulator | `/intelligence/recommendation-simulator` | `[ ]` | `[ ]` 캐시 또는 재분석 | `[ ]` | `[ ]` 시뮬 수치 | `[ ]` | `[ ]` | `[ ]` |
| 7 | Share of Voice | `/intelligence/share-of-voice` | `[ ]` | `[ ]` POST `share-of-voice` | `[ ]` | `[ ]` SoV 차트 | `[ ]` | `[ ]` | `[ ]` |
| 8 | Competitor Analysis | `/intelligence/competitor-analysis` | `[ ]` | `[ ]` 캐시 또는 재분석 | `[ ]` | `[ ]` 테이블 | `[ ]` | `[ ]` | `[ ]` |
| 9 | Citation Explorer | `/intelligence/citation-explorer` | `[ ]` | `[ ]` POST `citation-explorer` | `[ ]` | `[ ]` 필터+목록 | `[ ]` | `[ ]` | `[ ]` |
| 10 | Query Generator | `/intelligence/query-generator` | `[ ]` | `[ ]` 생성 + probe | `[ ]` | `[ ]` 질의/프로브 | `[ ]` | `[ ]` | `[ ]` |
| 11 | Visibility Monitor | `/intelligence/visibility-monitor` | `[ ]` | `[ ]` 캐시 또는 재분석 | `[ ]` | `[ ]` 모니터 | `[ ]` | `[ ]` | `[ ]` |
| 12 | Agent Readiness | `/intelligence/agent-readiness` | `[ ]` | `[ ]` POST `agent-readiness` | `[ ]` | `[ ]` 링+목록 | `[ ]` | `[ ]` | `[ ]` |

추가 (12 메뉴와 연결)

- `[ ]` `#2–4` Perception 3툴은 **같은 캐시**를 쓰므로 한 번 성공 후 전환 시 불필요한 재호출이 없어야 함 (Network 확인)
- `[ ]` `#5–8` Recommendation도 도구 `key` 전환 시 abort되고, SoV만 `share-of-voice`를 침
- `[ ]` `#10` Query Generator: 생성(analyze)과 프로브가 동시에 돌지 않음. 취소 시 둘 다 멈춤
- `[ ]` Evidence → Recommendation Test로 `?q=` 핸드오프 시 해당 질의로 한 번 더 호출

허브

- `[ ]` `/intelligence` 진입, 12 도구로 빠지는 링크, 모바일에서 카드가 겹치지 않음

---

## E. 권장 수동 순서 (약 40–60분)

1. 자동화 그룹 A 실행.
2. 1440: 허브 → 12 메뉴 클릭만 (진입 + 캐시/시드 success).
3. 시크릿: empty 12개 중 **필러 대표 5개** (war-room, brand-perception, recommendation-test, citation-explorer, agent-readiness).
4. Network Block: 위 5개에서 error 문구.
5. Slow 3G: war-room에서 loading + 취소 + 도구 전환 stale 없음.
6. 390: 같은 5개 success + GNB + 테이블 overflow.
7. `/insights`: Lock modal + YouTube modal 키보드 세트.
8. reduced-motion: war-room + YouTube 모달.

기록: 실패한 항목은 경로 / 뷰포트 / 재현 3줄만 남깁니다. API 키·응답 원문은 적지 않습니다.
