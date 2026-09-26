import type { SchemaJsonLdConfig } from '@/lib/schema/jsonld';

export const REDUE_SITE_ORIGIN = 'https://reduegeo.com';

/** Canonical homepage. Matches `og:url`. */
export const REDUE_SITE_CANONICAL = `${REDUE_SITE_ORIGIN}/`;

export const REDUE_OG_IMAGE_PATH = '/images/og-image.png';
export const REDUE_OG_IMAGE_WIDTH = 1200;
export const REDUE_OG_IMAGE_HEIGHT = 630;
export const REDUE_OG_IMAGE_ALT = 'RedueGEO — AI가 인용하는 검색 최적화 스튜디오';

/** 네이버 서치어드바이저 설명 권장 80자 이내. meta description · og:description · twitter:description */
export const REDUE_META_DESCRIPTION_KO =
	'ChatGPT·Perplexity 등 AI 검색 인용을 위한 GEO 진단 및 SEO·스키마 최적화 솔루션, RedueGEO.';

export const REDUE_META_DESCRIPTION_EN =
	'RedueGEO diagnoses and repairs GEO, SEO, schema, and E-E-A-T so ChatGPT, Perplexity, and Gemini cite your website as a source.';

export const REDUE_META_TITLE = 'RedueGEO | AI 검색 최적화(GEO) & SEO 스튜디오';

/**
 * 푸터(`landing.footer.legal`)에 공개된 사업자 정보와 동일하게 유지합니다.
 * 더미 번호(`+82-10-0000-0000`)는 화면에 없으므로 JSON-LD에 넣지 않습니다.
 */
export const REDUE_BUSINESS_NAP = {
	/** 푸터 유선 상담 번호와 동일. 바뀌면 푸터 문구와 함께 수정 */
	telephone: '010-3210-9801',
	/** 푸터 고객센터 이메일과 동일 */
	email: 'contact@redue.kr',
	/** 푸터 사업장 소재지와 동일 */
	streetAddress: '구평동 서포로 30번길 이편한세상사하1차 102동 2803호',
	addressLocality: '사하구',
	addressRegion: 'Busan',
	/** TODO: 실제 정보 입력 필요 — 우편번호 (푸터에 없음) */
	postalCode: '',
};

/**
 * 대표자 Person 노드. 푸터 대표자명 "박성준"과 동일한 인물입니다.
 */
export const REDUE_FOUNDER = {
	name: '박성준 (Sung Joon Park)',
	jobTitle: 'CEO & Principal GEO/SEO Engineer',
	description: '15년 이상의 웹 퍼블리싱 및 AI 검색 최적화(GEO), 프론트엔드 아키텍처 전문가',
	/** TODO: 실제 정보 입력 필요 — 출신 학교·기관 */
	alumniOf: '',
	/** TODO: 실제 정보 입력 필요 — 대표자 프로필 URL */
	url: '',
	/** TODO: 실제 정보 입력 필요 — 링크드인 등 개인 공식 프로필 */
	sameAs: [] as string[],
	knowsAbout: [
		'Generative Engine Optimization (GEO)',
		'Search Engine Optimization (SEO)',
		'Schema.org Markup',
		'Web Publishing',
		'Perplexity & ChatGPT Search Citation',
	],
};

/** 홈 FAQ. 한국어 UI(`landing.story.faq.items`)와 JSON-LD FAQPage가 이 배열과 글자 단위로 같아야 합니다. */
export const REDUE_HOME_FAQS = [
	{
		question: '기존 홈페이지를 새로 만들어야 하나요?',
		answer:
			'아닙니다. 기존 사이트를 새로 구축하거나 디자인을 바꿀 필요 없이, 사이트의 코드(메타데이터, 스키마 마크업, robots/llms.txt)에 AI 검색엔진 수집 규격을 주입하는 방식으로 안전하게 작업됩니다.',
	},
	{
		question: '작업 후 바로 ChatGPT나 Perplexity에 반영되나요?',
		answer:
			'작업 즉시 구글·네이버 및 AI 검색 로봇(OAI-SearchBot, PerplexityBot)에 수집을 요청하며, 검색엔진 크롤링 주기와 지식그래프 갱신에 따라 통상 1~2주 내외로 점진 반영됩니다.',
	},
	{
		question: '그누보드, 워드프레스 등 어떤 홈페이지에도 적용 가능한가요?',
		answer:
			'네, 그누보드, 워드프레스, 아임웹, 카페24는 물론 React, Next.js, 순수 HTML/PHP 등 웹 표준을 따르는 모든 웹사이트에 100% 적용 가능합니다.',
	},
	{
		question: 'AI 검색 1위 추천이 100% 보장되나요?',
		answer:
			'AI 검색 알고리즘 특성상 100% 순위를 인위적으로 보장할 수는 없습니다. 하지만 AI가 출처를 탐색할 때 가장 신뢰할 수 있는 공식 데이터(지식그래프, 스키마, E-E-A-T)를 완벽하게 제공하여 브랜드가 인용(Citation)될 확률을 극대화합니다.',
	},
	{
		question: '19만 원(스피드 셋업)과 49만 원(GEO 프로)의 차이는 무엇인가요?',
		answer:
			'스피드 셋업은 엔티티/기본 스키마와 /llms.txt 기본 정비입니다. GEO 프로는 대화형 FAQPage 5종(초안 + 사이트 기본 UI 반영), 대표자 지식그래프(신규 상세 페이지 신설은 별도), 지도 연동 점검, 그리고 작업 완료 직후 + 2주차 실측 인용 검증(총 2회) 리포트가 포함됩니다.',
	},
] as const;

/**
 * Organization.sameAs. 빈 문자열은 스키마에서 제거됩니다.
 */
// TODO: 실제 정보 입력 필요
export const REDUE_OFFICIAL_CHANNELS = {
	instagram: 'https://www.instagram.com/redueai',
	youtube: 'https://www.youtube.com/@redueai',
	/** TODO: 실제 정보 입력 필요 */
	linkedin: '',
	/** TODO: 실제 정보 입력 필요 */
	facebook: '',
	/** TODO: 실제 정보 입력 필요 — 공식 블로그 */
	naverBlog: '',
	/** TODO: 실제 정보 입력 필요 */
	naverCafe: '',
	/** TODO: 실제 정보 입력 필요 — 네이버 플레이스 */
	naverPlace: '',
};

/**
 * Runtime config for this Next.js app.
 * Empty channel / founder slots are filtered out — never invent 홍길동 or dummy URLs.
 *
 * Customer-site example (clinic):
 *
 * ```ts
 * const clinicSchema: SchemaJsonLdConfig = {
 *   name: '서초내과의원',
 *   url: 'https://clinic.example.com',
 *   logo: 'https://clinic.example.com/logo.png',
 *   description: '서초 소재 내과 의원',
 *   telephone: '02-555-1212',
 *   address: {
 *     streetAddress: '서울 서초구 서초대로 10',
 *     addressLocality: '서초구',
 *     addressRegion: '서울특별시',
 *   },
 *   channels: {
 *     naverBlog: 'https://blog.naver.com/seocho',
 *     naverCafe: 'https://cafe.naver.com/seocho',
 *     naverPlace: 'https://map.naver.com/p/entry/place/123',
 *     instagram: 'https://www.instagram.com/seocho',
 *     youtube: 'https://www.youtube.com/@seocho',
 *     facebook: '',
 *   },
 *   founder: {
 *     name: '김원장',
 *     jobTitle: '대표원장',
 *     sameAs: ['https://www.linkedin.com/in/example'],
 *     alumniOf: '서울대학교 의과대학',
 *     knowsAbout: ['내과', '건강검진'],
 *   },
 * };
 * ```
 */
export const REDUE_SITE_SCHEMA: SchemaJsonLdConfig = {
	name: 'REDUE AI SEO & GEO Studio',
	url: REDUE_SITE_ORIGIN,
	/**
	 * TODO: 실제 정보 입력 필요 — 전용 `/logo.png`가 저장소에 없습니다.
	 * 404 로고 URL은 지식패널에 넣지 않고, 실제로 서빙되는 OG 이미지를 사용합니다.
	 */
	logo: `${REDUE_SITE_ORIGIN}${REDUE_OG_IMAGE_PATH}`,
	description: REDUE_META_DESCRIPTION_KO,
	orgTypes: ['Organization', 'LocalBusiness'],
	inLanguage: 'ko-KR',
	pageUrl: REDUE_SITE_CANONICAL,
	pageName: 'REDUE AI SEO & GEO Studio',
	personId: `${REDUE_SITE_ORIGIN}/#author`,
	pageType: 'WebPage',
	telephone: REDUE_BUSINESS_NAP.telephone,
	email: REDUE_BUSINESS_NAP.email,
	contactUrl: `${REDUE_SITE_ORIGIN}/contact`,
	address: {
		streetAddress: REDUE_BUSINESS_NAP.streetAddress,
		addressLocality: REDUE_BUSINESS_NAP.addressLocality,
		addressRegion: REDUE_BUSINESS_NAP.addressRegion,
		postalCode: REDUE_BUSINESS_NAP.postalCode,
		addressCountry: 'KR',
	},
	searchUrlTemplate: `${REDUE_SITE_ORIGIN}/prompts?q={search_term_string}`,
	breadcrumbs: [{ name: '홈', url: REDUE_SITE_CANONICAL }],
	channels: {
		instagram: REDUE_OFFICIAL_CHANNELS.instagram,
		youtube: REDUE_OFFICIAL_CHANNELS.youtube,
		linkedin: REDUE_OFFICIAL_CHANNELS.linkedin,
		facebook: REDUE_OFFICIAL_CHANNELS.facebook,
		naverBlog: REDUE_OFFICIAL_CHANNELS.naverBlog,
		naverCafe: REDUE_OFFICIAL_CHANNELS.naverCafe,
		naverPlace: REDUE_OFFICIAL_CHANNELS.naverPlace,
	},
	founder: {
		name: REDUE_FOUNDER.name,
		jobTitle: REDUE_FOUNDER.jobTitle,
		description: REDUE_FOUNDER.description,
		alumniOf: REDUE_FOUNDER.alumniOf,
		url: REDUE_FOUNDER.url,
		sameAs: REDUE_FOUNDER.sameAs,
		knowsAbout: REDUE_FOUNDER.knowsAbout,
	},
	about: {
		name: 'REDUE AI SEO & GEO Studio 소개',
		url: REDUE_SITE_CANONICAL,
		description:
			'생성형 AI 검색엔진(ChatGPT Search, Perplexity, Gemini) 및 전통 검색엔진(구글, 네이버)에 완벽 대응하는 차세대 SEO & GEO 정밀 진단 및 지식그래프 최적화 솔루션',
	},
	faqs: REDUE_HOME_FAQS.map((item) => ({ question: item.question, answer: item.answer })),
};
