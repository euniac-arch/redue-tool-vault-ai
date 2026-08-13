/**
 * SEO 이슈별 상세 해결 가이드 (UI·AI 폴백·API 공용)
 * Ported from redue-seo-inspector-ai/src/engines/issueSolutionGuide.js
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CMS_PLATFORM: Record<string, { label: string; file: string; injection: string; adminPath: string }> = {
  cafe24: {
    label: 'Cafe24',
    file: 'layout/basic/layout.html',
    injection: '<head> 태그 직후',
    adminPath: '쇼핑몰관리 → 디자인 → HTML/CSS 편집',
  },
  gnuboard: {
    label: 'Gnuboard / YoungCart',
    file: 'theme/{테마명}/head.sub.php',
    injection: '첫 <?php 직후 — v30 Precision Canonical & Full-Document Defer Master Engine (exact canonical + head/body defer + Article/FAQ/Person)',
    adminPath: 'FTP — head.sub.php에 주입 (head.php는 레이아웃, 일반 주입 주의)',
  },
  nextjs: {
    label: 'Next.js',
    file: 'app/layout.tsx (또는 pages/_document.tsx)',
    injection: 'metadata export 또는 <head> 내부',
    adminPath: '프로젝트 레포에서 layout.tsx 수정 후 배포',
  },
  wordpress: {
    label: 'WordPress',
    file: 'wp-content/themes/{theme}/header.php',
    injection: 'wp_head() 직전 또는 </head> 직전',
    adminPath: '외모 → 테마 파일 편집 (header.php) 또는 Yoast/RankMath',
  },
  react: {
    label: 'React',
    file: 'public/index.html',
    injection: '<head> 내부',
    adminPath: 'CRA/Vite public/index.html 또는 react-helmet',
  },
  laravel: {
    label: 'Laravel',
    file: 'resources/views/layouts/app.blade.php',
    injection: '@section 또는 <head> 내부',
    adminPath: 'Blade 레이아웃 파일 수정',
  },
  custom: {
    label: 'Custom HTML/PHP',
    file: 'head.php / header.html / index.html',
    injection: '</head> 직전 또는 공통 헤더 include',
    adminPath: 'FTP 또는 호스팅 파일 관리자',
  },
};

export const GUIDES: Record<string, any> = {
  NOT_HTTPS: {
    summary: '사이트가 HTTP로 제공되어 브라우저 보안 경고·검색 순위·결제 신뢰도에 불리합니다.',
    impact:
      'Google은 HTTPS를 순위 신호로 사용하며, Chrome은 HTTP 페이지에 "주의 요함"을 표시합니다. 이커머스에서는 전환율 하락으로 이어집니다.',
    difficulty: 'medium',
    steps: [
      {
        title: 'SSL 인증서 발급·적용',
        detail:
          'Cafe24는 무료 SSL(Let\'s Encrypt)을 제공합니다. 호스팅 관리자 → SSL/TLS → 인증서 발급 후 적용하세요. 자체 서버는 Certbot 또는 클라우드 LB SSL을 사용합니다.',
      },
      {
        title: 'HTTP → HTTPS 301 리다이렉트',
        detail:
          '모든 http:// 요청을 https://로 영구(301) 리다이렉트합니다. nginx: return 301 https://$host$request_uri; Apache: RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
      },
      {
        title: '내부 링크·리소스 URL 정리',
        detail:
          'CSS/JS/이미지·내부 링크를 // 또는 https:// 절대경로로 통일합니다. og:url, canonical도 https 버전으로 맞춥니다.',
      },
    ],
    verify: [
      'http:// 접속 시 https://로 자동 이동하는지 확인',
      'Chrome 주소창 자물쇠(보안 연결) 표시 확인',
      'Search Console URL 검사에서 HTTPS URL 등록',
    ],
    cmsNotes: {
      cafe24: '쇼핑몰관리 → 기본설정 → 쇼핑몰 URL을 https://로 변경하고 SSL 적용 메뉴에서 활성화하세요.',
      gnuboard: 'config.php의 G5_URL, data/dbconfig.php 도메인을 https로 맞춘 뒤 서버 301 설정을 추가하세요.',
    },
    hasCode: false,
  },
  CANONICAL_MISSING: {
    summary: '페이지마다 정본(canonical) URL이 없어 중복·파라미터 URL이 검색 색인을 분산시킵니다.',
    impact:
      '검색엔진이 www/non-www, http/https, ?sort= 등 여러 URL을 같은 콘텐츠로 인식해 SEO 점수가 나뉩니다. 진단봇이 First Chunk만 파싱하면 하단 canonical을 놓칩니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'Crawler-Optimized Hardcoded Canonical (head.sub.php)',
        detail:
          '<meta charset> 바로 직후에 canonical+og:url을 배치하세요. https://대표도메인 고정, REQUEST_URI+SCRIPT_NAME 이중 감지, bo_table/wr_id 등 허용 쿼리만 유지합니다.',
      },
      {
        title: '서브페이지·게시판 고유 URL 보장',
        detail: '302.php·101.php·board.php?bo_table=… 는 절대 루트(/)로 붕괴시키지 않습니다. 메인은 path가 /|/index.php 이고 허용 쿼리가 비어 있을 때만 / 입니다.',
      },
      {
        title: '페이지네이션·필터 URL 처리',
        detail: '목록 2페이지 등은 self-canonical 또는 rel=prev/next 전략을 정해 일관되게 적용합니다.',
      },
    ],
    verify: [
      'View Source 상단(charset 직후)에서 <link rel="canonical">·og:url 존재·HTTPS 절대 URL 확인',
      '진단봇/외부 감사에서 Canonical URL 정합성 Pass',
    ],
    hasCode: true,
  },
  CANONICAL_RELATIVE_PATH: {
    summary: 'Canonical이 상대경로로 되어 있어 검색엔진이 정본 URL을 잘못 해석할 수 있습니다.',
    impact: '상대경로 canonical은 크롤러마다 해석이 달라져 정규화 신호가 약해집니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'HTTPS 절대 URL로 교체 (Charset-After)',
        detail: 'href="https://도메인/경로/" 형식으로 변경하고 <meta charset> 직후에 배치합니다. REQUEST_URI+SCRIPT_NAME으로 현재 경로를 조합하세요.',
      },
    ],
    verify: ['canonical href가 https://로 시작하는지, charset 직후인지 확인'],
    hasCode: true,
  },
  TITLE_MISSING: {
    summary: '<title> 태그가 없거나 비어 있어 검색 결과 제목이 자동 생성됩니다.',
    impact: '검색 스니펫 품질·CTR이 떨어지고, 페이지 주제 신호가 약해집니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '페이지별 고유 Title 작성',
        detail: '브랜드명만 반복하지 말고 "주요 키워드 | 브랜드" 형식으로 30~60자 내 작성합니다.',
      },
      {
        title: '템플릿에 Title 변수 연결',
        detail: '상품명·카테고리·페이지 제목 변수를 title 태그에 출력하도록 CMS 템플릿을 수정합니다.',
      },
    ],
    verify: ['각 URL View Source에서 title이 고유한지 확인', 'Search Console 성과에서 노출 쿼리와 title 일치 여부'],
    hasCode: true,
  },
  TITLE_LENGTH_SUBOPTIMAL: {
    summary: 'Title이 너무 짧거나(브랜드명만) 길어 검색 결과에서 잘리거나 키워드 신호가 약합니다.',
    impact: '4자 "브랜드명만" title은 어떤 검색어로도 노출되기 어렵습니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '키워드·차별점 반영',
        detail: '예: "프리미엄 굴·수산물 유통 50년 | 삼삼물산" — 품목·강점·지역 키워드를 포함합니다.',
      },
      {
        title: '페이지 유형별 패턴 정의',
        detail: '홈/카테고리/상품/회사소개마다 title 패턴을 문서화하고 템플릿에 적용합니다.',
      },
    ],
    verify: ['title 길이 30~60자', '페이지마다 title 중복 없음'],
    hasCode: true,
  },
  META_DESC_MISSING: {
    summary: 'Meta Description이 없어 검색 결과 설명이 자동 추출됩니다.',
    impact: 'CTR 저하 및 검색 의도와 맞지 않는 스니펫이 노출될 수 있습니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '80~160자 설명 작성',
        detail: '페이지 내용을 요약하고 행동 유도 문구(문의, 구매 등)를 자연스럽게 포함합니다.',
      },
      {
        title: '중복 description 제거',
        detail: '전 페이지 동일 description은 피하고, 상품/카테고리별 고유 설명을 사용합니다.',
      },
    ],
    verify: ['<meta name="description" content="..."> 존재', '길이 80자 이상'],
    hasCode: true,
  },
  META_DESC_LENGTH_SUBOPTIMAL: {
    summary: 'Meta Description이 너무 짧아 검색 스니펫 활용도가 낮습니다.',
    impact: '브랜드명만 반복하면 검색 사용자에게 가치 proposition이 전달되지 않습니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '품목·USP 포함 설명 확장',
        detail: '제품군, 배송·품질 강점, 대상 고객을 2~3문장으로 작성합니다.',
      },
    ],
    verify: ['description 80~160자', '홈/상품/소개 페이지별 고유 여부'],
    hasCode: true,
  },
  H1_MISSING: {
    summary: '페이지에 H1이 없어 주제 계층 신호가 약합니다.',
    impact: '접근성·SEO 모두에서 페이지 주제 파악이 어렵습니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '페이지당 H1 1개 배치',
        detail: '본문 최상단에 페이지 주제를 나타내는 H1을 추가합니다. 로고만 H1으로 쓰지 마세요.',
      },
      {
        title: 'H2/H3로 섹션 구조화',
        detail: 'H1 아래 콘텐츠를 H2(섹션), H3(하위)로 논리적으로 나눕니다.',
      },
    ],
    verify: ['페이지당 H1 1개', 'H1 텍스트가 페이지 주제와 일치'],
    hasCode: false,
  },
  H1_MULTIPLE: {
    summary: 'H1이 2개 이상이면 검색엔진이 대표 주제를 혼동합니다.',
    impact: '브랜드명 H1 중복은 키워드 신호를 약화시킵니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '대표 H1 하나만 유지',
        detail: '로고/배너의 H1은 div 또는 p로 변경하고, 본문 제목만 H1으로 둡니다.',
      },
      {
        title: '부제목은 H2로 변경',
        detail: '두 번째 H1을 H2로 낮추어 heading 계층을 정리합니다.',
      },
    ],
    verify: ['document.querySelectorAll("h1").length === 1'],
    hasCode: false,
  },
  SCHEMA_MISSING: {
    summary: 'JSON-LD 구조화 데이터가 없어 리치 결과·AI 인용 기회를 놓칩니다.',
    impact: 'Product/Offer는 쇼핑 검색, Organization은 브랜드 신뢰, FAQPage는 AI 답변 인용에 유리합니다.',
    difficulty: 'medium',
    steps: [
      {
        title: '페이지 유형에 맞는 Schema 선택',
        detail: '홈/회사소개 → Organization, 상품 → Product+Offer, FAQ → FAQPage, 블로그 → Article',
      },
      {
        title: 'JSON-LD 스크립트 삽입',
        detail: '<script type="application/ld+json"> { "@context": "https://schema.org", ... } </script>를 head 또는 body에 추가',
      },
      {
        title: 'Google Rich Results Test 검증',
        detail: 'https://search.google.com/test/rich-results 에 URL 입력 후 오류 수정',
      },
    ],
    verify: ['Rich Results Test 통과', '필수 필드(name, url, offers 등) 포함'],
    hasCode: true,
  },
  ARTICLE_DATE_MISSING: {
    summary: 'Article/NewsArticle에 datePublished·dateModified가 없어 리치 결과·GEO 감점(빨간불)이 발생합니다.',
    impact: '날짜 필드는 Article 필수 속성이며, AI·검색엔진이 콘텐츠 신선도를 판단하는 핵심 신호입니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'v15 Schema Date Auto-Fix 주입',
        detail:
          'PHP Universal(Type A) 또는 head.sub.php 하이브리드 엔진이 datePublished(연초 ISO)·dateModified(현재 ISO 8601)를 자동 보완합니다. File Patch 원클릭 주입을 권장합니다.',
      },
      {
        title: '실제 게시일이 있으면 바인딩',
        detail:
          "$GLOBALS['schema_article'] = ['type'=>'NewsArticle','headline'=>'…','datePublished'=>'2024-03-15T09:00:00+09:00']; 형태로 실제 일시를 넘기면 자동값이 덮어씌워집니다.",
      },
    ],
    verify: [
      'View Source JSON-LD에 datePublished·dateModified ISO 8601 존재',
      'Rich Results Test Article 오류 없음',
    ],
    hasCode: true,
  },
  RENDER_BLOCKING: {
    summary: 'async/defer 없는 외부 <script src>가 렌더링을 차단해 성능·CWV 감점이 발생합니다.',
    impact: '동기 스크립트는 HTML 파싱을 멈추고 LCP를 악화시키며, 감사의 render-blocking 체크가 Fail/Warn이 됩니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'Crawler-Optimized Canonical & Schema Engine (head.sub.php)',
        detail:
          '그누보드/영카트 감지 시 head.sub.php 첫 <?php 직후에 Crawler-Optimized Canonical 엔진을 삽입합니다. REQUEST_URI+SCRIPT_NAME 이중 경로·HTTPS 강제·G5_URL·$config[cf_title]·$g5_head_title를 자동 감지하고, ob_start()로 중복 canonical/og:url을 청소한 뒤 <meta charset> 바로 직후(Charset-After First-Chunk)에 1쌍만 재주입하며(없으면 <head> 직후 → </head> 직전), redue_dynamic_schema_controller()는 static $executed로 1회만 실행됩니다. exact 서브페이지 canonical·script defer·Article/NewsArticle(보도·뉴스 게시판 자동 승격)·FAQ/Person은 유지됩니다.',
      },
      {
        title: '클라이언트 Defer 보강(선택)',
        detail: 'redue-dom-defer-engine은 MutationObserver로 동적 삽입 스크립트도 계속 감시합니다. 앱 부트스트랩·모듈 로더는 type="module" 또는 명시적 async/defer로 관리하세요.',
      },
    ],
    verify: [
      'View Source에서 script[src]:not([async]):not([defer]) 가 0에 수렴',
      'PageSpeed Insights 렌더 차단 리소스 경고 완화',
    ],
    hasCode: true,
  },
  IMAGE_ALT: {
    summary: '이미지 alt 속성이 비어 있거나 누락되어 접근성·이미지 SEO 커버리지가 Fail입니다.',
    impact: '스크린리더·이미지 검색·AI 비전 파서가 의미를 읽지 못해 접근성 점수와 GEO 커버리지가 하락합니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'v14 JS Alt Auto-Fixer 주입',
        detail:
          '공통 헤더(</head> 직전)에 REDUE Alt Auto-Fixer를 주입하면 렌더 시 빈/누락 alt가 사이트명 기반으로 자동 보완됩니다. File Patch 탭의 원클릭 주입으로 적용하세요.',
      },
      {
        title: '핵심 이미지는 의미 있는 alt 수동 보강',
        detail: '로고·히어로·상품 이미지는 자동 보완 후에도 콘텐츠에 맞는 구체적 alt로 교체하는 것이 이상적입니다.',
      },
    ],
    verify: [
      'document.querySelectorAll("img:not([alt]), img[alt=\'\']").length === 0',
      '재진단 시 이미지 alt 커버리지 Pass',
    ],
    hasCode: true,
  },
  OG_INCOMPLETE: {
    summary: 'OpenGraph 메타 태그가 불완전해 SNS 공유 미리보기가 깨집니다.',
    impact: '카카오·페이스북·링크드인 공유 시 클릭률이 낮아집니다.',
    difficulty: 'easy',
    steps: [
      {
        title: '필수 OG 4종 설정',
        detail: 'og:title, og:description, og:image(1200×630 권장), og:url을 절대 HTTPS URL로 설정',
      },
      {
        title: 'og:url과 canonical 일치',
        detail: '대표 도메인(https, www 정책)과 동일한 URL을 og:url에 사용합니다.',
      },
    ],
    verify: ['Facebook Sharing Debugger 또는 카카오 링크 미리보기 테스트'],
    hasCode: true,
  },
  TWITTER_CARD_MISSING: {
    summary: 'Twitter/X Card 메타가 없어 트위터 공유 미리보기가 제한됩니다.',
    impact: '소셜 트래픽·브랜드 노출 기회 감소',
    difficulty: 'easy',
    steps: [
      {
        title: 'twitter:card 추가',
        detail: '<meta name="twitter:card" content="summary_large_image"> 및 title, description, image 설정',
      },
    ],
    verify: ['Twitter Card Validator 테스트'],
    hasCode: true,
  },
  SITEMAP_NOT_FOUND: {
    summary: 'sitemap.xml이 없어 검색엔진이 페이지를 발견하기 어렵습니다.',
    impact: '신규·깊은 URL의 색인 지연, 상품 페이지 미색인 가능',
    difficulty: 'medium',
    steps: [
      {
        title: 'sitemap.xml 생성',
        detail: 'Cafe24/WordPress 플러그인 또는 온라인 생성기로 주요 URL 목록 XML 작성. 최대 50,000 URL/파일',
      },
      {
        title: 'robots.txt에 Sitemap 지시',
        detail: 'robots.txt 맨 아래 Sitemap: https://example.com/sitemap.xml 추가',
      },
      {
        title: 'Search Console에 제출',
        detail: 'Google Search Console → Sitemaps → URL 제출 후 색인 상태 모니터링',
      },
    ],
    verify: ['브라우저에서 /sitemap.xml 200 응답', 'robots.txt에 Sitemap 줄 존재'],
    hasCode: false,
  },
  ROBOTS_SITEMAP_MISSING: {
    summary: 'robots.txt에 Sitemap 지시어가 없습니다.',
    impact: '크롤러가 sitemap 위치를 자동으로 찾기 어렵습니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'robots.txt 수정',
        detail: '파일 끝에 Sitemap: https://도메인/sitemap.xml 한 줄 추가',
      },
    ],
    verify: ['https://도메인/robots.txt 에 Sitemap: 줄 확인'],
    hasCode: false,
  },
  GPTBOT_BLOCKED: {
    summary: 'robots.txt가 GPTBot 등 AI 크롤러를 차단하고 있습니다.',
    impact: 'ChatGPT Search, Perplexity 등 AI 검색·답변에서 사이트 인용·추천이 제한됩니다.',
    difficulty: 'easy',
    steps: [
      {
        title: 'AI 크롤러 Allow 규칙 추가',
        detail: 'User-agent: GPTBot / Allow: / (ClaudeBot, PerplexityBot 동일) — 차단 의도가 없다면 허용',
      },
      {
        title: '민감 경로만 Disallow',
        detail: '/admin, /cart 등은 Disallow 유지하고 공개 콘텐츠는 Allow',
      },
    ],
    verify: ['robots.txt에 GPTBot Allow 확인', 'AI 검색에서 브랜드 노출 모니터링'],
    hasCode: true,
  },
  LCP_POOR: {
    summary: 'Largest Contentful Paint(LCP)가 4초를 넘어 Core Web Vitals 기준 미달입니다.',
    impact: 'Google CWV는 순위 신호이며, 느린 LCP는 이탈률 증가로 연결됩니다.',
    difficulty: 'hard',
    steps: [
      {
        title: 'LCP 요소 식별',
        detail: 'Chrome DevTools → Performance 또는 PageSpeed Insights에서 LCP 이미지/텍스트 확인',
      },
      {
        title: '히어로 이미지 최적화',
        detail: 'WebP/AVIF 변환, width/height 명시, fetchpriority="high", CDN 적용',
      },
      {
        title: '렌더 차단 리소스 제거 (v30 Full-Document OB Defer + Static Script Defer)',
        detail:
          'v30 ob_start()가 head+body 전 문서의 sync 외부 script[src]에 defer를 부여하고, 패치 시 addDeferToScriptTagsInSource()가 Gnuboard add_javascript() 인자까지 정적으로 보강합니다. CSS critical 인라인·서드파티 지연 로드를 병행하세요.',
      },
    ],
    verify: ['PageSpeed Insights LCP ≤ 2.5s (Good)', 'Search Console CWV 보고서'],
    hasCode: true,
  },
  LCP_NOT_MEASURED: {
    summary: 'LCP를 측정하지 못했습니다. Playwright 환경 또는 페이지 로드 이슈일 수 있습니다.',
    impact: '성능 병목을 quantified 하지 못해 개선 우선순위 설정이 어렵습니다.',
    difficulty: 'medium',
    steps: [
      {
        title: 'PageSpeed Insights 수동 측정',
        detail: 'https://pagespeed.web.dev/ 에 URL 입력 후 LCP·CLS·INP 확인',
      },
      {
        title: '실 사용자 RUM 설정',
        detail: 'Search Console CWV 또는 web-vitals JS 라이브러리로 필드 데이터 수집',
      },
    ],
    verify: ['PSI 모바일·데스크톱 점수 기록'],
    hasCode: false,
  },
  HSTS_MISSING: {
    summary: 'Strict-Transport-Security 헤더가 없어 HTTPS 적용 후에도 다운그레이드 공격에 취약할 수 있습니다.',
    impact: '브라우저가 HTTP 재접속을 시도할 여지가 남습니다.',
    difficulty: 'medium',
    steps: [
      {
        title: 'HSTS 헤더 추가',
        detail: 'Strict-Transport-Security: max-age=31536000; includeSubDomains — HTTPS 완전 적용 후 설정',
      },
    ],
    verify: ['securityheaders.com 또는 DevTools Network Response Headers'],
    hasCode: false,
  },
};

export function normalizeCmsKey(cmsType: string): string {
  const map: Record<string, string> = {
    Cafe24: 'cafe24',
    Gnuboard: 'gnuboard',
    'Next.js': 'nextjs',
    NextJS: 'nextjs',
    WordPress: 'wordpress',
    React: 'react',
    Laravel: 'laravel',
    'Custom HTML/PHP': 'custom',
    UNKNOWN: 'nextjs',
  };
  return map[cmsType] || 'nextjs';
}

function buildGenericGuide(issue: any) {
  return {
    summary: issue.description || issue.title,
    impact: issue.impactReason || '검색·AI 노출 및 사용자 경험에 부정적 영향이 있을 수 있습니다.',
    difficulty: issue.severity === 'FAIL' ? 'medium' : 'easy',
    steps: [
      {
        title: '현상 확인',
        detail: issue.description || issue.title,
      },
      {
        title: '권장 조치 적용',
        detail: issue.suggestedFix || 'SEO 가이드라인에 맞게 해당 항목을 수정하세요.',
      },
      {
        title: '배포 후 재검증',
        detail: '수정 후 REDUE SEO Inspector로 재진단하거나 Search Console URL 검사를 실행하세요.',
      },
    ],
    verify: ['View Source 또는 DevTools로 수정 반영 확인', '재진단 FAIL → PASS 전환 확인'],
    hasCode: Boolean(issue.cmsCode),
  };
}

export function getIssueSolutionGuide(issueCode: string, cmsType = 'UNKNOWN', issue: any = {}) {
  const base = GUIDES[issueCode] || buildGenericGuide(issue);
  const cmsKey = normalizeCmsKey(cmsType);
  const platform = CMS_PLATFORM[cmsKey] || CMS_PLATFORM.nextjs;
  const cmsNote = base.cmsNotes?.[cmsKey] || null;

  const cmsHowTo = base.hasCode
    ? `${platform.adminPath}에서 ${platform.file} 파일을 열고, ${platform.injection}에 아래 코드를 붙여넣으세요.`
    : cmsNote || `${platform.adminPath}에서 해당 설정을 변경하세요.`;

  return {
    code: issueCode,
    summary: base.summary,
    impact: base.impact,
    difficulty: base.difficulty,
    steps: base.steps,
    verify: base.verify,
    hasCode: base.hasCode,
    cms: {
      key: cmsKey,
      label: platform.label,
      file: platform.file,
      injection: platform.injection,
      adminPath: platform.adminPath,
      howTo: cmsHowTo,
      note: cmsNote,
    },
  };
}

export function formatSuggestedFixFromGuide(guide: { summary: string; steps: { title: string; detail: string }[] }) {
  const stepText = guide.steps
    .map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`)
    .join('\n');
  return `${guide.summary}\n\n[조치 단계]\n${stepText}`;
}
