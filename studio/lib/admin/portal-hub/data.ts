import type {
	GeoEngineRow,
	PortalHubChecklistItem,
	PortalHubCodePreset,
	PortalHubLink,
	PortalHubTabId,
	PortalHubTip,
} from './types';

export const DEFAULT_DOMAIN = 'yourdomain.com';
export const DEFAULT_NAVER_VERIFICATION_CODE = 'YOUR_CODE';

export const PORTAL_HUB_TABS: { id: PortalHubTabId; label: string; shortLabel: string }[] = [
	{ id: 'naver', label: '네이버 등록 (Search Advisor)', shortLabel: '네이버' },
	{ id: 'google', label: '구글 등록 (Search Console)', shortLabel: '구글' },
	{ id: 'kakao', label: '다음 / 카카오 등록', shortLabel: '다음·카카오' },
	{ id: 'geo', label: 'AI 검색 최적화 (GEO 6대 엔진)', shortLabel: 'GEO' },
	{ id: 'presets', label: '통합 코드 프리셋', shortLabel: '코드 프리셋' },
];

/** Replaces `{{domain}}` / `{{naverCode}}` template tokens with live values. */
export function renderTemplate(template: string, values: { domain: string; naverCode?: string }): string {
	const domain = values.domain.trim() || DEFAULT_DOMAIN;
	const naverCode = (values.naverCode ?? '').trim() || DEFAULT_NAVER_VERIFICATION_CODE;
	return template.replaceAll('{{domain}}', domain).replaceAll('{{naverCode}}', naverCode);
}

// ---------------------------------------------------------------------------
// Tab 1 — Naver
// ---------------------------------------------------------------------------

export const NAVER_LINKS: PortalHubLink[] = [
	{ label: '네이버 서치어드바이저 바로가기', url: 'https://searchadvisor.naver.com/' },
];

export const NAVER_CHECKLIST: PortalHubChecklistItem[] = [
	{ id: 'naver-1', label: '웹마스터 도구 로그인 및 사이트 URL 등록' },
	{
		id: 'naver-2',
		label: '사이트 소유확인 (메타태그 삽입)',
		detail: '<head>에 naver-site-verification 메타태그를 삽입하고 소유확인을 완료합니다.',
	},
	{
		id: 'naver-3',
		label: 'robots.txt 수집 설정 검증',
		detail: '수집 허용(User-agent: * / Allow: /) 여부를 확인합니다.',
	},
	{ id: 'naver-4', label: '사이트맵(sitemap.xml) 및 RSS 피드 제출' },
	{ id: 'naver-5', label: "'웹 페이지 수집' 메뉴에서 메인 및 주요 랜딩페이지 즉시 수집 요청" },
];

export const NAVER_TIPS: PortalHubTip[] = [
	{
		title: 'OG / Twitter Card 태그 필수 점검',
		detail: '네이버 뷰·블로그 스크랩 시 썸네일이 정상 노출되도록 Open Graph 및 Twitter Card 태그를 점검하세요.',
	},
	{
		title: '<title> 구조 최적화',
		detail: '"브랜드명 - 핵심 서비스 키워드 1~2개" 형태로 간결하게 구성하세요.',
	},
];

export const NAVER_VERIFICATION_TEMPLATE = '<meta name="naver-site-verification" content="{{naverCode}}" />';
export const NAVER_ROBOTS_SNIPPET = 'User-agent: *\nAllow: /';

// ---------------------------------------------------------------------------
// Tab 2 — Google
// ---------------------------------------------------------------------------

export const GOOGLE_LINKS: PortalHubLink[] = [
	{ label: '구글 서치콘솔 바로가기', url: 'https://search.google.com/search-console' },
];

export const GOOGLE_CHECKLIST: PortalHubChecklistItem[] = [
	{
		id: 'google-1',
		label: '도메인 속성(DNS TXT) 또는 URL 접두사(HTML 메타태그) 인증',
	},
	{ id: 'google-2', label: '사이트맵 제출 (/sitemap.xml)' },
	{ id: 'google-3', label: "'URL 검사' 도구에서 실시간 색인 생성(URL 인덱싱) 요청" },
];

export const GOOGLE_TIPS: PortalHubTip[] = [
	{
		title: 'Schema.org JSON-LD 구조화 데이터 적용',
		detail: 'WebSite, Organization, FAQPage 등 핵심 타입을 페이지에 적용하세요. (프리셋 탭에서 복사 가능)',
	},
	{
		title: 'Core Web Vitals 점검',
		detail: 'LCP 2.5초 이하, CLS 0.1 이하, INP 기준을 준수하세요.',
	},
	{
		title: '모바일 & 보안 프로토콜',
		detail: '모바일 반응형 뷰포트와 HTTPS 보안 프로토콜을 유지하세요.',
	},
];

export const GOOGLE_JSONLD_PREVIEW = `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://{{domain}}",
  "name": "[사이트명]"
}`;

// ---------------------------------------------------------------------------
// Tab 3 — Kakao / Daum
// ---------------------------------------------------------------------------

export const KAKAO_LINKS: PortalHubLink[] = [
	{ label: '다음 검색등록 바로가기', url: 'https://register.search.daum.net/' },
	{ label: '카카오 웹마스터 도구 바로가기', url: 'https://webmaster.daum.net/' },
];

export const KAKAO_CHECKLIST: PortalHubChecklistItem[] = [
	{ id: 'kakao-1', label: '카카오 웹마스터 도구 PIN 인증 및 사이트 소유권 확인' },
	{ id: 'kakao-2', label: '사이트 제목·설명문구·대표 카테고리 설정 후 검색등록 신청' },
	{ id: 'kakao-3', label: '사이트맵 및 RSS 제출' },
];

export const KAKAO_TIPS: PortalHubTip[] = [
	{
		title: '카카오톡 공유 캐시 즉시 갱신',
		detail: '카카오 개발자 도구 > 도구 > 공유 디버거를 활용해 링크 공유 시 썸네일/설명 캐시를 즉시 갱신하세요.',
	},
];

export const KAKAO_DEBUGGER_LINK: PortalHubLink = {
	label: '카카오 공유 디버거 바로가기',
	url: 'https://developers.kakao.com/tool/debugger/sharing',
};

// ---------------------------------------------------------------------------
// Tab 4 — GEO (Generative Engine Optimization)
// ---------------------------------------------------------------------------

export const GEO_ENGINE_TABLE: GeoEngineRow[] = [
	{
		engine: 'ChatGPT (SearchGPT)',
		indexSource: 'Bing Index',
		crawlerBots: 'GPTBot, OAI-SearchBot',
		note: 'Bing Webmaster 등록으로 수집 커버',
	},
	{
		engine: 'Perplexity AI',
		indexSource: '독립 인덱스',
		crawlerBots: 'PerplexityBot',
		note: '명확한 Q&A 형태 데이터 선호',
	},
	{
		engine: 'Google Gemini',
		indexSource: 'Google Index',
		crawlerBots: 'Google-Extended, Googlebot',
		note: 'Search Console 등록 필수',
	},
	{
		engine: 'MS Copilot',
		indexSource: 'Bing Index',
		crawlerBots: 'Bingbot',
		note: 'Bing Webmaster 등록 필수',
	},
	{
		engine: 'Claude',
		indexSource: 'Anthropic 크롤러',
		crawlerBots: 'ClaudeBot',
		note: '팩트 중심 시맨틱 구조 선호',
	},
	{
		engine: 'DeepSeek / Naver CUE:',
		indexSource: '자체 + 시맨틱 파싱',
		crawlerBots: '(공식 UA 미공개)',
		note: '시맨틱 HTML5(<article>, <section>) 및 Schema 중심 수집',
	},
];

export const GEO_ESSENTIAL_LINKS = {
	bing: { label: 'Bing Webmaster Tools 바로가기', url: 'https://www.bing.com/webmasters' } satisfies PortalHubLink,
};

export const GEO_CHECKLIST: PortalHubChecklistItem[] = [
	{
		id: 'geo-1',
		label: 'Bing Webmaster Tools 등록',
		detail: 'ChatGPT / Copilot 노출을 동시에 커버합니다.',
	},
	{
		id: 'geo-2',
		label: 'AI 크롤러 수집 허용 robots.txt 설정',
		detail: 'GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Bingbot을 명시적으로 허용합니다.',
	},
	{
		id: 'geo-3',
		label: 'llms.txt 루트 파일 배포',
		detail: 'AI 에이전트 전용 사이트 요약 파일을 루트 경로에 배포합니다.',
	},
];

// ---------------------------------------------------------------------------
// Tab 5 — Integrated code presets
// ---------------------------------------------------------------------------

export const ROBOTS_TXT_PRESET: PortalHubCodePreset = {
	id: 'robots-txt',
	title: 'robots.txt 표준 프리셋',
	description: 'AI 봇 전용 허용 규칙을 포함한 표준 robots.txt 입니다. 루트 경로(/robots.txt)에 배포하세요.',
	filename: 'robots.txt',
	language: 'text',
	template: `User-agent: *
Allow: /

# Major AI Engine Bots
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: https://{{domain}}/sitemap.xml`,
};

export const LLMS_TXT_PRESET: PortalHubCodePreset = {
	id: 'llms-txt',
	title: 'llms.txt (AI 에이전트 전용 요약 파일)',
	description: 'ChatGPT·Perplexity·Gemini 등 AI 에이전트가 사이트를 빠르게 이해하도록 돕는 요약 파일입니다.',
	filename: 'llms.txt',
	language: 'text',
	template: `# {{domain}}

> AI 검색·에이전트 크롤러(ChatGPT, Perplexity, Gemini, Copilot, Claude)를 위한 사이트 요약입니다.

## About
- Site: https://{{domain}}
- Description: [브랜드/서비스에 대한 한두 문장 요약을 입력하세요]

## Key Pages
- Home: https://{{domain}}/
- Sitemap: https://{{domain}}/sitemap.xml

## Allowed Crawlers
GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot

## Contact
- Email: [contact@{{domain}}]`,
};

export const SCHEMA_JSONLD_PRESET: PortalHubCodePreset = {
	id: 'schema-jsonld',
	title: 'Schema.org JSON-LD (Organization + WebSite)',
	description: '<head> 내부 <script type="application/ld+json">에 삽입하는 기본 구조화 데이터입니다.',
	filename: 'schema.jsonld.html',
	language: 'json',
	template: `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://{{domain}}/#organization",
      "name": "[브랜드명]",
      "url": "https://{{domain}}",
      "logo": "https://{{domain}}/logo.png"
    },
    {
      "@type": "WebSite",
      "@id": "https://{{domain}}/#website",
      "url": "https://{{domain}}",
      "name": "[사이트명]",
      "publisher": { "@id": "https://{{domain}}/#organization" }
    }
  ]
}`,
};

export const CODE_PRESETS: PortalHubCodePreset[] = [ROBOTS_TXT_PRESET, LLMS_TXT_PRESET, SCHEMA_JSONLD_PRESET];

export const ALL_CHECKLIST_ITEMS: PortalHubChecklistItem[] = [
	...NAVER_CHECKLIST,
	...GOOGLE_CHECKLIST,
	...KAKAO_CHECKLIST,
	...GEO_CHECKLIST,
];
