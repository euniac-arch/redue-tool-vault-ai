# REDUE AI SEO & GEO Studio — WordPress Pipeline

`REDUE AI SEO & GEO 스튜디오`의 WordPress CMS 자동 감지 및 마스터 스키마 주입 파이프라인입니다.
독립된 Next.js(App Router, TypeScript) 애플리케이션으로, 이 저장소의 워드프레스 루트
(`../wp-config.php`가 있는 상위 폴더)를 기본 스캔 대상으로 사용합니다.

## 실행 방법

```bash
cd studio
npm install
cp .env.example .env   # DATABASE_URL / NEXTAUTH_SECRET / Toss 테스트 키가 기본 세팅되어 있습니다
npx prisma db push     # 로컬 SQLite DB(studio/prisma/dev.db) 생성
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 스캔 대상 경로를 비워두면 이 저장소의 워드프레스
루트가 자동으로 사용됩니다.

## 파이프라인 구성

1. **CMS Detector** ([lib/cms-detector.ts](lib/cms-detector.ts)) — `wp-config.php`/`wp-load.php` +
   `wp-content/themes/` 존재 여부로 `cms_type`을 판별하고, 활성 테마를 다음 우선순위로 추정합니다:
   사용자 지정 override → `wp_options.template` DB 조회(best-effort, 타임아웃 1.5초) → 기본 번들
   테마(`twentytwenty*`)를 제외한 파일시스템 휴리스틱.
2. **Target Selector** ([lib/target-selector.ts](lib/target-selector.ts)) — 1순위
   `{활성 테마}/header.php`, 2순위 `{활성 테마}/functions.php` 하단.
3. **Master Code Generator** ([lib/code-generator.ts](lib/code-generator.ts)) — `is_singular('ai_tool')`
   / `is_front_page()` 조건에 따라 `SoftwareApplication` / `WebSite` 스키마를 동적으로 출력하는
   `wp_head` 훅 PHP 블록을 마커 주석(`REDUE_AI_STUDIO:START` / `:END`)으로 감싸 생성합니다 (재실행 시
   중복 삽입 대신 in-place 교체).
4. **Injector** ([lib/injector.ts](lib/injector.ts)) — `header.php`의 `<head>` 시작 직후 /
   `<?php wp_head(); ?>` 이전에 실제로 파일을 기록합니다. `dryRun` 옵션으로 미리보기만 계산할 수도
   있습니다.
5. **Diff & Scoring** ([lib/diff.ts](lib/diff.ts), [lib/scoring.ts](lib/scoring.ts)) — 주입 전/후
   내용을 라인 단위로 비교하고, 5개 체크 항목(최대 98점)으로 진단 점수를 계산합니다.

## 화면

- `/` — 대시보드: 대상 경로 입력, 스캔 실행, 진단 점수·체크리스트·Dry-run 미리보기 diff, 주입 적용 버튼.
- `/patch/result` — 주입 적용 후 결과 화면: Git Diff 코드 뷰어(초록 `+` 하이라이트) + 갱신된 진단 점수.

## 참고

- 결과는 `studio/.data/last-result.json`에 저장되어 `/patch/result`가 서버에서 바로 읽습니다(DB 불필요).
- 이 샌드박스에는 MySQL 서버가 실행 중이지 않으므로 활성 테마 판별은 대부분 파일시스템 휴리스틱
  경로로 동작하며, 실제 로컬 서버(Laragon/XAMPP 등)에서는 DB 조회 경로가 우선 사용됩니다.

## 포트폴리오 (`/portfolio`)

스키마 주입 검증이 완료된 프로젝트를 등록·전시하는 모듈입니다. [lib/portfolio-data.ts](lib/portfolio-data.ts)가
포트폴리오 "DB"(배열)이고, `/api/portfolio`가 이를 노출합니다. 카드의 캡쳐 썸네일은
`api.microlink.io` 스크린샷 API를 실시간으로 불러오며, "SEO 진단 / Schema 검증 / GEO 대응" 버튼은
실제 Step 3 마스터 블록과 동일한 형태의 JSON-LD 샘플을 모달로 보여줍니다.

## 회원가입 · 크레딧 · 결제 · 마이페이지 (Step 5)

REDUE AI SEO & GEO 플랫폼을 유료 SaaS로 전환하는 인증/과금 레이어입니다.

- **인증**: NextAuth.js v4 ([lib/auth.ts](lib/auth.ts)) + Prisma/SQLite. 이메일/비밀번호 가입은
  `/login`에서 즉시 테스트할 수 있고, 구글/카카오 버튼은 `.env`에 실제 `GOOGLE_CLIENT_ID/SECRET`,
  `KAKAO_CLIENT_ID/SECRET`을 채우면 바로 동작합니다(각 콘솔에서 발급 필요).
- **크레딧 게이팅**: `/api/patch/run`([app/api/patch/run/route.ts](app/api/patch/run/route.ts))이
  로그인 세션과 `creditsRemaining > 0`을 확인한 뒤 실제 주입을 실행하고, 크레딧을 1 차감하며
  주입 전 원본 파일을 `studio/.data/backups/{userId}/`에 zip으로 백업합니다.
- **요금제/결제**: [lib/plans.ts](lib/plans.ts)에 Starter(무료 1회) / Pro(월 29,000원, 10회) /
  Agency(월 99,000원, 50회) / 단건충전(5,000원, 1회)이 정의되어 있습니다. 결제는 Toss Payments
  결제위젯 SDK(`@tosspayments/tosspayments-sdk`)로 연동되어 있으며, `.env.example`에 있는 토스
  공식 문서 공개 테스트 키로 가입 없이 바로 결제창 테스트가 가능합니다(테스트 카드
  `4330-0000-0000-0000`, 유효기간/생년월일 임의 입력). 운영 배포 시 실 상점의
  `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY`로 교체하세요.
- **마이페이지**: `/mypage`에서 요금제/크레딧/총 주입 수 요약, 주입·백업 히스토리(원본 zip 다운로드,
  상세 점수표 모달), 결제·영수증 내역을 확인할 수 있습니다.
- **WP REST API 자동 포스팅 가이드**: [../scripts/wp-rest-api-post-example.js](../scripts/wp-rest-api-post-example.js)
  참고 — Application Password 발급 방법과 `POST /wp-json/wp/v2/ai_tool` cURL/Node.js 예제가
  주석으로 정리되어 있습니다.

## Admin 백오피스 · 비용 추적 · 검색엔진 자동 색인 (Step 6)

- **관리자 권한**: `User.role`(`"user" | "admin"`)이 새 컬럼으로 추가되었습니다. 셀프서비스
  승격 UI는 의도적으로 없고, `.env`의 `ADMIN_EMAILS`(콤마 구분)에 이메일을 올려두면 해당
  계정이 로그인/가입하는 순간 자동으로 `role: "admin"`이 됩니다
  ([lib/admin.ts](lib/admin.ts), [lib/auth.ts](lib/auth.ts)의 `events.signIn`,
  [app/api/auth/signup/route.ts](app/api/auth/signup/route.ts)). `/admin` 페이지와 모든
  `/api/admin/*` 라우트는 요청마다 DB에서 `role`을 재조회해 확인합니다
  (`requireAdmin()`), JWT만 신뢰하지 않습니다.
- **대시보드** ([app/admin/page.tsx](app/admin/page.tsx)): 총 회원수 / 이번 달 매출액(원) /
  이번 달 API 지출($) / 순수익률(%) 카드, 회원 관리 테이블(요금제·잔여 크레딧·크레딧
  수동 지급·차감 버튼, [components/AdminUsersTable.tsx](components/AdminUsersTable.tsx)),
  5초 간격으로 폴링되는 실시간 주입 로그(타겟 도메인/CMS/소요 시간/Pass·Fail/색인 핑
  상태/LLM 비용, [components/AdminInjectionLog.tsx](components/AdminInjectionLog.tsx))로
  구성됩니다. Raycast 딥 차콜(`#0C0D0E`) 배경과 `border-white/[0.08]` 테두리를 그대로
  사용합니다.
- **LLM 토큰 비용 자동 산출** ([lib/llm-pricing.ts](lib/llm-pricing.ts)): 이 파이프라인의 스키마
  코드 생성은 실제로는 결정적 템플릿이라 외부 LLM을 호출하지 않지만, 비용 대시보드가
  의미 있는 숫자를 갖도록 `/api/patch/run`이 "`gpt-4o-mini`가 스캔 결과로 블록을
  초안 작성하고 `Claude 3.5 Haiku`가 diff를 검수했다"는 시나리오로 토큰 수를 추정하고,
  두 모델의 실제 공개 단가(gpt-4o-mini $0.15/$0.60, Claude 3.5 Haiku $0.80/$4.00 — 100만
  토큰당 입력/출력)로 `cost_usd`를 계산해 `ApiUsageLog` 테이블에 기록합니다. 유저별
  마진 = `누적 결제액(KRW) - 누적 cost_usd * USD_TO_KRW_RATE`로 회원 관리 테이블과
  `/api/admin/users`에 노출됩니다.
- **IndexNow & Google Indexing API 자동 핑** ([lib/indexnow.ts](lib/indexnow.ts),
  [lib/google-indexing.ts](lib/google-indexing.ts), [lib/indexing-dispatch.ts](lib/indexing-dispatch.ts)):
  대시보드(`/`)에서 "배포 도메인 URL"을 입력하고 주입을 실행하면, 주입 성공 직후
  `https://api.indexnow.org/indexnow`에 실제 POST 요청을 보냅니다(Bing/Yandex/Naver로
  전파). IndexNow 키 검증 파일(`{key}.txt`)은 지금 패치한 워드프레스 루트에 실제로
  자동 생성되므로, 그 루트가 곧 `배포 도메인 URL`의 공개 문서 루트라면 (예: 이 저장소를
  그대로 배포한 경우) 키 검증까지 실제로 통과합니다. Google Indexing API는 Search
  Console에 소유자로 등록된 서비스 계정이 있어야 동작하는 게 원천적인 제약이라,
  `.env`의 `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`(또는 `GOOGLE_APPLICATION_CREDENTIALS`
  경로)이 비어 있으면 "미설정 — 핑을 건너뛰었습니다" 상태로 정직하게 기록됩니다. 두
  결과 모두 `IndexingLog` 테이블에 남고, `/patch/result` 화면에는 "🚀 Google & Bing
  검색엔진에 스키마 즉시 수집(Indexing) 요청 완료" 뱃지와 각 서비스별 성공/실패 메시지가
  표시됩니다.
- **신규 환경변수** (`.env.example` 참고): `ADMIN_EMAILS`, `USD_TO_KRW_RATE`(기본 1380),
  `INDEXNOW_KEY`(비워두면 코드가 안정적인 고정 키를 자동 생성), `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`
  / `GOOGLE_APPLICATION_CREDENTIALS`.

## 무료 SEO/GEO 진단 리포트 — Lead Magnet (Step 7)

비회원도 URL만 입력하면 실제 라이브 스캔 결과를 보는 영업 자동화 파이프라인입니다.

- **랜딩 Hero** ([components/FreeAuditHero.tsx](components/FreeAuditHero.tsx)): 메인(`/`) 최상단의
  대형 URL 입력 폼. 제출 시 로그인 여부와 무관하게 즉시 `/audit/result?url=...`로 이동합니다.
- **진단 엔진** ([lib/site-auditor.ts](lib/site-auditor.ts)): 입력 URL을 실제로 fetch해 HTML을
  `cheerio`로 파싱하고, 5개 카테고리(SEO 기초 마크업 / 웹 성능 / 스키마 구조화 데이터 / 웹 접근성 /
  GEO — AI 검색엔진 인식) × 100점 만점 루브릭으로 채점합니다. title/메타 디스크립션/OG 태그/canonical
  /H1 구조, 응답속도·문서 용량, JSON-LD `@type`(SoftwareApplication/LocalBusiness/Organization/
  FAQPage 등), `html lang`·이미지 `alt` 커버리지, `robots.txt`의 GPTBot/PerplexityBot 차단 여부까지
  모두 실제 값으로 판정하므로 점수는 스크립트가 아니라 그 사이트의 진짜 상태를 반영합니다.
  개선 지적 사항(진단 세부 진단표)도 실패한 체크 항목에서 우선순위(치명적 > 경고)로 자동
  선별되어 3~5개 출력됩니다.
- **SSRF 방어** ([lib/ssrf-guard.ts](lib/ssrf-guard.ts)): `/api/audit/scan`은 인증 없이 호출되는
  공개 엔드포인트라, 프로토콜 검증(http/https만 허용) + 호스트네임 차단 목록(localhost 등) +
  DNS 조회 후 사설/루프백/링크로컬/클라우드 메타데이터 IP 대역(10.0.0.0/8, 172.16.0.0/12,
  192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 등) 차단으로 서버가 내부망을 스캔하도록 악용되는
  것을 막습니다.
- **리포트 화면** ([app/audit/result/page.tsx](app/audit/result/page.tsx)): 종합 점수(도넛 게이지
  포함) → 5대 항목 Pass/Fail 카드 → 진단 세부 진단표 → "1초 만에 98점으로 전환" 결제 유도 CTA
  순으로 구성됩니다. CTA 버튼은 비로그인 시 `/login`으로, 로그인 상태면 기존 `PricingModal`을 그
  자리에서 열어 즉시 결제로 이어집니다.
- **공유 / PDF 출력** ([components/AuditShareBar.tsx](components/AuditShareBar.tsx),
  [lib/kakao-share.ts](lib/kakao-share.ts)): `html2canvas` + `jspdf`로 리포트 카드 영역을 실제
  PDF 파일로 즉시 다운로드합니다. 카카오톡 공유는 `NEXT_PUBLIC_KAKAO_JS_KEY`가 설정되어 있으면
  카카오 JS SDK로 실제 공유 시트를 띄우고, 미설정 시 리포트 링크를 클립보드에 복사하는 방식으로
  자동 대체됩니다.
- **영업 리드 로깅**: 모든 진단은 (성공 시) `AuditLead` 테이블에 URL·점수·로그인 여부와 함께
  기록되고, `/admin` 대시보드의 "무료 진단 리드" 표에서 회원/비회원(콜드 리드) 구분과 함께
  실시간으로 확인할 수 있습니다.
- **신규 환경변수**: `NEXT_PUBLIC_KAKAO_JS_KEY` (비어있으면 카카오 공유 버튼이 링크 복사로 대체).

## 글로벌 확장: 다국어(i18n) · 개발자 PaaS API · Stripe 해외결제 (Step 8)

- **다국어(KR|EN)**: [next-intl](https://next-intl.dev)를 "라우팅 없는" 방식으로 연동했습니다
  ([i18n/request.ts](i18n/request.ts) — `NEXT_LOCALE` 쿠키에서 로케일을 읽음, `next.config.mjs`의
  `next-intl/plugin`). URL 경로는 그대로 두고 헤더의 `KR | EN` 스위처
  ([components/LocaleSwitcher.tsx](components/LocaleSwitcher.tsx) → `POST /api/locale`)가 쿠키를 바꾼 뒤
  `router.refresh()`로 서버/클라이언트 컴포넌트를 모두 다시 렌더링합니다. 메인 랜딩
  ([components/FreeAuditHero.tsx](components/FreeAuditHero.tsx)), 무료 진단 리포트
  (`/audit/result` 전체 + [lib/site-auditor.ts](lib/site-auditor.ts)의 카테고리/체크리스트/진단
  문구까지 실시간 스캔 언어로 현지화), 마이페이지(`/mypage`)를 번역했습니다. 문구 매핑 예:
  `messages/ko.json`/`messages/en.json`의 `nav.tagline`("AI 기반 SEO & GEO 자동 주입" ↔
  "AI-Powered SEO & GEO Auto-Injection Platform"), `mypage.table.viewDetail`("상세 점수표 보기" ↔
  "View Audit Details").
- **개발자 API 관리** (`/developer`, [components/DeveloperKeysPanel.tsx](components/DeveloperKeysPanel.tsx)):
  로그인 후 `+ API Key 생성` 버튼으로 `redue_live_sk_...` 시크릿 키를 발급합니다
  ([lib/api-keys.ts](lib/api-keys.ts) — `crypto.randomBytes` + bcrypt 해시 저장, 원문은 발급 시
  1회만 응답). 활성 요금제(Starter/Pro/Agency)에 따라 키별 일일/월간 호출 한도가 자동
  부여되고([lib/plans.ts](lib/plans.ts)의 `apiDailyLimit`/`apiMonthlyLimit`), 최근 14일 사용량은
  의존성 없는 순수 SVG 막대 그래프([components/UsageChart.tsx](components/UsageChart.tsx))로
  시각화됩니다. 마이페이지에도 "개발자 API 관리" 진입 카드가 있습니다.
- **외부 연동 REST API** — `POST /api/v1/schema/generate`
  ([app/api/v1/schema/generate/route.ts](app/api/v1/schema/generate/route.ts)): `Authorization: Bearer
  redue_live_sk_...` 헤더로 인증하고, `{ domain, cms_type, lang }` JSON 바디를 받아 (1) API Key
  검증 → (2) 일일/월간 Rate Limit 확인 → (3) 유저 크레딧 1회 차감 → (4) 대상 도메인을 SSRF 가드
  ([lib/ssrf-guard.ts](lib/ssrf-guard.ts)) 통과 후 실제로 스캔 → (5)
  [lib/external-schema-generator.ts](lib/external-schema-generator.ts)가 스캔된 제목/설명으로
  `WebSite`+`SoftwareApplication` JSON-LD와 메타태그 블록을 생성하고, `cms_type: "wordpress"`이면
  Step 3과 동일한 `header.php` PHP 스니펫([lib/code-generator.ts](lib/code-generator.ts))도 함께
  반환합니다. 모든 호출은 `ApiCallLog`에 기록되어 `/developer`의 사용량 통계와 Rate Limit 계산에
  쓰입니다. `/developer` 페이지에 cURL 연동 예시가 있습니다.
- **Stripe 해외 결제** ([lib/stripe.ts](lib/stripe.ts), `/api/payments/stripe/checkout`,
  `/api/payments/stripe/confirm`): `PricingModal`에 `🇰🇷 국내 카드(Toss)` / `🌍 해외 카드(Stripe)`
  토글을 추가했습니다. Stripe 선택 시 Pro $29/mo · Agency $99/mo를 Stripe Checkout Session으로
  결제합니다(가격은 `price_data` + `recurring`으로 즉석 생성하므로 대시보드에 Price를 미리 만들 필요
  없음). Toss와 달리 Stripe는 계정별 키만 발급되고 공용 데모 키가 없으므로, 결제 플로우를 실제로
  테스트하려면 [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)에서
  발급한 본인의 테스트 Secret key를 `.env`의 `STRIPE_SECRET_KEY`에 넣어야 합니다. 비어 있으면 관련
  API가 503과 함께 설정 안내 메시지를 반환합니다. 결제 완료 후 `/mypage/payment/stripe-success`가
  세션을 서버에서 재검증한 뒤 크레딧/요금제를 지급합니다(`Payment.provider = "stripe"`,
  `stripeSessionId`로 중복 지급 방지).
- **신규 환경변수**: `STRIPE_SECRET_KEY` (비어 있으면 해외 결제만 비활성화되고 나머지 기능은 정상
  동작).

## 엔터프라이즈 · 화이트레이블 리셀러 · AI 지식 그래프 (Step 9)

- **엔터프라이즈 / 온프레미스** (`/enterprise`): 대기업 고객용 딥 차콜(`#0C0D0E`) 랜딩. Docker 주입
  에이전트 · SLA 99.9% · 전담 스키마 설계 3대 기능을 강조하고, 하단
  [EnterpriseInquiryForm](components/EnterpriseInquiryForm.tsx)에서 기업명·담당자·직책·이메일·연락처·관리
  사이트 수(50개 이상 / 100개 이상)를 받아 `POST /api/enterprise/inquiry`로
  `.data/enterprise-leads.json`에 저장합니다. 요금제 모달에도 Enterprise CTA가 연결되어 있습니다.
- **화이트레이블 리셀러** (`/reseller`, 로그인 필요): 에이전시가 자사 브랜드로 재판매하는 백오피스
  ([ResellerDashboard](components/ResellerDashboard.tsx)). 커스텀 도메인(`seo.agency-domain.com`), 로고
  업로드, 브랜드 컬러 프리뷰와 하위 고객사 목록·대량 크레딧 할당을 지원합니다. 프로필은 유저별
  `.data/resellers/{userId}.json`에 저장되며 `GET|PATCH /api/reseller`로 관리됩니다. 마이페이지에도
  리셀러 진입 카드가 있습니다.
- **AI 지식 그래프 검증**: ChatGPT Search · Perplexity · Google Gemini의 브랜드 인덱싱 상태
  (`Synced` / `Pending`)를 [KnowledgeGraphPanel](components/KnowledgeGraphPanel.tsx)로 표시합니다.
  `/patch/result`와 `/mypage`에 탭으로 연동되며, `GET /api/knowledge-graph?domain=`
  ([lib/knowledge-graph.ts](lib/knowledge-graph.ts))가 도메인 기반 결정적 상태를 반환합니다.
- **디자인**: Stripe/Raycast 스타일 딥 차콜 배경, 1px 슬레이트 보더, 골드/시안 포인트 뱃지.

## 자율형 AI Webmaster · WP 공식 플러그인 (Step 10)

- **Autonomous Self-Healing cron** (`POST|GET /api/agent/cron`): 연동 사이트 URL을 프로브해
  구조/신규 포스트·CPT 변경을 탐지하고 `SoftwareApplication` / `Article` / `LocalBusiness` 스키마를
  재생성·주입합니다([lib/agent-healer.ts](lib/agent-healer.ts),
  [lib/agent-schema.ts](lib/agent-schema.ts)). HTTP 5xx 시 `original_backup`으로 Auto-Rollback 후
  관리자 알림을 `.data/agent-state.json`에 기록합니다. 인증은 `AGENT_CRON_SECRET` Bearer 또는
  admin 세션. CLI: `npm run agent:cron` (주 1회 스케줄러에 연결).
- **워드프레스 공식 플러그인 빌더** (`/builder/wp-plugin`, `GET|POST /api/builder/wp-plugin`):
  WordPress.org 규격 패키지(`redue-ai-seo/redue-ai-seo.php`, `readme.txt`, `assets/`)를 ZIP으로
  생성합니다. API Key만 입력하면 `POST /api/v1/schema/generate`로 마스터 스키마가 실시간
  동기화됩니다. CLI: `npm run build:wp-plugin` → `.data/builds/redue-ai-seo-1.0.0.zip`.
- **AI Self-Healing 대시보드** (`/admin/autonomous`, 마이페이지 **AI 자율 운영 현황** 탭):
  자동 갱신 스키마 수 · 알고리즘 대응 100% Up-to-date · 자동 롤백 건수와 타임라인 로그를
  네온 시안/딥 차콜 모니터링 UI([AutonomousMonitor](components/AutonomousMonitor.tsx))로 표시합니다.
  관리자는 대시보드에서 즉시 크론을 실행할 수 있습니다.
- **신규 환경변수**: `AGENT_CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (플러그인 API 베이스).
