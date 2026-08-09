# Redue AI Tool Vault — WordPress Theme

'전 세계 숨은 AI & 파워 유저 라이프 툴 큐레이션' 사이트를 위한 커스텀 워드프레스 테마입니다.
별도의 헤비한 플러그인 없이 `functions.php`와 템플릿 파일만으로 동작합니다.

## 포함된 기능 (Step 1)

1. **CPT**: `ai_tool` (AI 툴 큐레이션) — `inc/custom-post-types.php`
   - `supports`: title, editor, thumbnail, excerpt
   - `public: true`, `has_archive: true`, rewrite slug: `tool`
2. **Taxonomy**: `tool_category` (툴 카테고리) — `inc/custom-post-types.php`
   - 기본 텀 3개 자동 생성: `seo-marketing`(SEO & 마케팅), `developer-design`(개발자 & 디자이너), `productivity`(생산성 & 라이프)
3. **커스텀 메타박스** (7개 필드, `postmeta` 자동 저장) — `inc/meta-boxes.php`
   - `tool_tagline`, `tool_official_url`, `tool_pricing_type`, `tool_price_amount`, `tool_price_currency`, `tool_operating_system`, `tool_rating_score`
4. **SoftwareApplication JSON-LD** 구조화 데이터 — `inc/schema-jsonld.php`
   - `is_singular('ai_tool')`일 때 `wp_head` 훅으로 `<script type="application/ld+json">` 출력
5. **5개 서브페이지 템플릿**
   - `single-ai_tool.php` — 툴 상세 페이지 (메타 필드 + JSON-LD 연동)
   - `archive-ai_tool.php` — 전체 AI 툴 아카이브
   - `taxonomy-tool_category.php` — 카테고리별 아카이브 (SEO&마케팅 / 개발자&디자이너 / 생산성&라이프)
   - `page-home.php` (Template Name: 홈 (큐레이션 랜딩)) — 카테고리별 추천 큐레이션 홈
   - `page-about.php` (Template Name: 소개 (큐레이션 기준)) — 사이트 소개/선정 기준 페이지

## 포함된 기능 (Step 2)

1. **더미 데이터 자동 생성** — `inc/dummy-data.php`
   - 관리자가 `/wp-admin`에 처음 접속하면(`admin_init`) 대표 AI 툴 5개(Redue SEO Studio, Cursor AI Code Editor, Raycast Command Center, PostHog Product Analytics, v0 by Vercel)를 `ai_tool` 포스트로 자동 등록
   - `redue_tv_dummy_data_seeded` 옵션 플래그 + 포스트 슬러그 존재 여부 이중 체크로 중복 생성 방지
2. **메인 랜딩 페이지** — `front-page.php`
   - Stripe / Raycast 감성의 4열 카드 그리드(`.tool-grid--4col`), 추천 점수 순 "이번 주 추천" 섹션 + 카테고리별 섹션
3. **라이트/다크 호환 카드 · 폼 스타일링** — `style.css`
   - CSS 커스텀 프로퍼티(`--tv-*`) + `prefers-color-scheme: dark` 미디어 쿼리로 라이트/다크 자동 대응
   - 카드: Pure White / Dark Slate 배경, `1px` 미세 테두리, 로고 아바타, 요금제 뱃지(Free/Freemium/Paid 색상 구분), 별점, 카테고리 태그, "상세보기 ➔" CTA
4. **툴 상세 페이지 2열 레이아웃** — `single-ai_tool.php`
   - 좌측 스티키 스펙 사이드바(가격/지원 OS/추천 점수 + 공식 사이트 버튼) + 우측 리뷰 본문 2열 반응형 그리드(`.tool-detail-grid`)
5. **툴 제보 폼 페이지** — `page-submit-tool.php` (Template Name: 툴 제보하기)
   - 툴 이름 / URL / 한 줄 설명 / 제보자 이메일 입력 폼
   - 제출 시 `ai_tool` 포스트를 `pending` 상태로 생성하고, 제보자 이메일은 비공개 메타(`tool_submitter_email`)로 저장 (프론트엔드 미노출)

## 로컬 실행을 위한 다음 단계

이 저장소에는 워드프레스 코어(`/wp-admin`, `/wp-includes` 등)와 `wp-config.php`가 이미 배치되어 있습니다.
사이트를 실제로 구동하려면 로컬 서버 스택(PHP + MySQL/MariaDB + 웹서버)이 필요합니다. 예:

- **Laragon** / **XAMPP** / **Local(WP Engine)** 등에서 이 폴더(`F:\redue-tool-vault-ai`)를 문서 루트(document root)로 지정
- MySQL/MariaDB에 `redue_tool_vault` 데이터베이스 생성 (`wp-config.php`의 DB 접속 정보와 일치해야 함)
- 브라우저에서 사이트에 접속하면 워드프레스 설치 마법사(5분 설치)가 실행됨
- 설치 완료 후 관리자 > 외모 > 테마에서 **Redue AI Tool Vault** 테마 활성화 및 관리자 화면 접속 시 더미 데이터 5건 자동 생성 (`inc/dummy-data.php`)
- 테마가 활성화된 상태에서 메인 도메인으로 접속하면 `front-page.php`가 자동으로 적용되어 4열 카드 그리드 랜딩 페이지가 표시됨 (Settings > Reading 설정과 무관하게 항상 최우선 적용)
- 관리자 > 설정 > 읽기에서 "홈페이지에 표시"를 정적 페이지로 지정하고, "홈" 템플릿을 적용한 페이지를 선택하면 `page-home.php`도 별도로 사용 가능 (카테고리 매거진형 대안 홈)
- "고정 페이지 추가"에서 템플릿을 **툴 제보하기**로 지정하면 `page-submit-tool.php`의 제보 폼 페이지를 사용할 수 있음
- 관리자 > AI 툴 큐레이션 > 새로 추가에서 `ai_tool` 포스트를 등록하면 메타박스와 JSON-LD 스키마가 자동 동작

> 참고: 이 환경에는 PHP/MySQL CLI가 설치되어 있지 않아 로컬 서버 구동은 사용자의 서버 스택 설치가 필요합니다.
