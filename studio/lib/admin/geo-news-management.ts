/**
 * Admin "AI GEO & Schema 글로벌 뉴스" — types, mock feed, and filter helpers.
 * Swap point: `studio/lib/admin/geoNewsService.ts`.
 */

export type GeoNewsRegion = 'KR' | 'GLOBAL';
export type GeoNewsCategory = 'GEO' | 'Schema Markup' | 'Search Engine' | 'AI Model';

export type GeoNewsItem = {
	id: string;
	region: GeoNewsRegion;
	category: GeoNewsCategory;
	title: string;
	summary: string;
	sourceName: string;
	sourceUrl: string;
	/** Relative time already formatted for display, e.g. '10분 전'. */
	publishedAt: string;
	tags: string[];
	isBookmarked: boolean;
};

export type GeoNewsFilters = {
	query: string;
	region: 'all' | GeoNewsRegion;
	category: 'all' | GeoNewsCategory;
};

export const CATEGORY_LABEL: Record<GeoNewsCategory, string> = {
	GEO: 'GEO',
	'Schema Markup': '스키마마크업',
	'Search Engine': '구글알고리즘',
	'AI Model': '생성형AI',
};

export const TRENDING_TOPICS = [
	'GEO 최적화',
	'JSON-LD',
	'Core Web Vitals',
	'네이버 AI 검색',
	'SearchGPT',
	'llms.txt',
] as const;

export const MOCK_GEO_NEWS: GeoNewsItem[] = [
	{
		id: 'NEWS-3108',
		region: 'GLOBAL',
		category: 'GEO',
		title: 'How brands win citations in ChatGPT Search and Perplexity',
		summary:
			'ChatGPT Search·Perplexity가 답변에 출처를 붙이는 방식이 정리됐습니다. 엔티티가 분명하고 JSON-LD로 검증된 페이지가 인용될 확률이 높다는 분석입니다.',
		sourceName: 'Search Engine Land',
		sourceUrl: 'https://searchengineland.com/',
		publishedAt: '10분 전',
		tags: ['ChatGPT Search', 'Perplexity', 'GEO'],
		isBookmarked: true,
	},
	{
		id: 'NEWS-3107',
		region: 'KR',
		category: 'Schema Markup',
		title: '의료 사이트 MedicalBusiness 스키마, 국내 병원 도입 가속',
		summary:
			'국내 병의원이 MedicalBusiness·Physician 스키마와 sameAs 그래프를 동시에 심는 사례가 늘고 있습니다. 네이버·구글 모두에서 엔티티 모호성을 줄이는 효과가 보고됐습니다.',
		sourceName: '지디넷코리아',
		sourceUrl: 'https://zdnet.co.kr/',
		publishedAt: '28분 전',
		tags: ['Medical Schema', 'JSON-LD', 'SameAs Graph'],
		isBookmarked: false,
	},
	{
		id: 'NEWS-3106',
		region: 'GLOBAL',
		category: 'Schema Markup',
		title: 'Google updates structured data guidance for Organization sameAs',
		summary:
			'Google Search Central이 Organization sameAs에 공식 소셜·지식패널 URL만 넣으라고 가이드를 보강했습니다. 위키·뉴스 프로필을 무분별하게 나열하면 엔티티가 흐려질 수 있습니다.',
		sourceName: 'Google Search Central',
		sourceUrl: 'https://developers.google.com/search/blog',
		publishedAt: '1시간 전',
		tags: ['JSON-LD', 'SameAs Graph', 'Organization'],
		isBookmarked: false,
	},
	{
		id: 'NEWS-3105',
		region: 'KR',
		category: 'AI Model',
		title: '퍼플렉시티 한국어 인용, 국내 미디어·병원 도메인 비중 확대',
		summary:
			'AI타임스 집계에 따르면 한국어 질의에서 Perplexity 인용이 포털 블로그보다 공식 도메인으로 이동하는 추세입니다. FAQ·HowTo 스키마가 있는 페이지가 자주 언급됩니다.',
		sourceName: 'AI타임스',
		sourceUrl: 'https://www.aitimes.com/',
		publishedAt: '2시간 전',
		tags: ['Perplexity', 'ChatGPT Search', 'GEO'],
		isBookmarked: true,
	},
	{
		id: 'NEWS-3104',
		region: 'GLOBAL',
		category: 'Search Engine',
		title: 'Google SGE / AI Overviews: what still ranks beneath the snapshot',
		summary:
			'AI Overview 아래 유기 결과는 여전히 핵심 웹 지표와 엔티티 권위가 강한 페이지가 차지합니다. 스키마만으로는 부족하고, 원문 근거와 저자 정보가 함께 있어야 합니다.',
		sourceName: 'Search Engine Journal',
		sourceUrl: 'https://www.searchenginejournal.com/',
		publishedAt: '5시간 전',
		tags: ['Google SGE', 'AI Overviews', 'E-E-A-T'],
		isBookmarked: false,
	},
	{
		id: 'NEWS-3103',
		region: 'KR',
		category: 'GEO',
		title: '생성형 검색 최적화(GEO), 국내 대행사 표준 제안서에 포함되기 시작',
		summary:
			'SEO 제안서에 llms.txt·엔티티 팩·스키마 그래프가 기본 항목으로 들어가는 사례가 늘었습니다. 기존 키워드 리포트만으로는 수주가 어려워지는 분위기입니다.',
		sourceName: '디지털투데이',
		sourceUrl: 'https://www.digitaltoday.co.kr/',
		publishedAt: '어제',
		tags: ['GEO', 'llms.txt', 'JSON-LD'],
		isBookmarked: false,
	},
	{
		id: 'NEWS-3102',
		region: 'GLOBAL',
		category: 'AI Model',
		title: 'OpenAI SearchGPT citation patterns favor first-party entity pages',
		summary:
			'SearchGPT 베타 인용은 브랜드 공식 페이지와 명확한 sameAs 연결이 있는 문서를 선호하는 것으로 관측됩니다. 서드파티 리뷰만 있는 브랜드는 답변에서 빠지는 경우가 많습니다.',
		sourceName: 'The Verge',
		sourceUrl: 'https://www.theverge.com/',
		publishedAt: '어제',
		tags: ['SearchGPT', 'ChatGPT Search', 'Entity'],
		isBookmarked: false,
	},
	{
		id: 'NEWS-3101',
		region: 'GLOBAL',
		category: 'Search Engine',
		title: 'August core update notes: helpful content still rewards original reporting',
		summary:
			'8월 코어 업데이트 해설에서 Google은 원문 취재와 저자 신뢰 정보를 다시 강조했습니다. AI 생성 요약만 있는 페이지는 Overview 인용에서도 밀리는 흐름입니다.',
		sourceName: 'Google Search Status',
		sourceUrl: 'https://status.search.google.com/',
		publishedAt: '2일 전',
		tags: ['Google SGE', 'Core Update', 'E-E-A-T'],
		isBookmarked: false,
	},
];

export function cloneGeoNews(source: GeoNewsItem[] = MOCK_GEO_NEWS): GeoNewsItem[] {
	return source.map((item) => ({ ...item, tags: [...item.tags] }));
}

export function filterGeoNews(items: GeoNewsItem[], filters: GeoNewsFilters): GeoNewsItem[] {
	const q = filters.query.trim().toLowerCase();
	return items.filter((item) => {
		if (filters.region !== 'all' && item.region !== filters.region) return false;
		if (filters.category !== 'all' && item.category !== filters.category) return false;
		if (!q) return true;
		const haystack = [item.title, item.summary, item.sourceName, ...item.tags].join(' ').toLowerCase();
		return haystack.includes(q);
	});
}
