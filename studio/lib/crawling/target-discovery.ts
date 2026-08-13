import axios from 'axios';
import { extractRootDomain } from '@/lib/crawling/domain';
import {
	CRAWL_INDUSTRY_LABELS,
	type CrawlCountryCode,
	type CrawlIndustryCode,
} from '@/lib/crawling/taxonomy';

export type DiscoveredTarget = {
	id: string;
	siteName: string;
	url: string;
	region: string;
	category: CrawlIndustryCode;
	/** Display label (e.g. 의료/클리닉) — mirrors request category when useful */
	categoryLabel?: string;
	country: CrawlCountryCode;
	crawledAt?: string;
	/** How the target was produced */
	source?: 'google' | 'naver' | 'seed' | 'places';
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
	phoneNumber?: string | null;
	address?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
};

export type TargetDiscoveryInput = {
	country: CrawlCountryCode;
	region: string;
	category: CrawlIndustryCode;
	keyword: string;
	limit: 10 | 20 | 50;
};

export type NaverTargetFinderInput = {
	region?: string;
	category?: string;
	keyword?: string;
	displayCount?: number;
	country?: CrawlCountryCode;
	/** Industry code when UI sends taxonomy code */
	categoryCode?: CrawlIndustryCode;
};

export type NaverLocalItem = {
	title?: string;
	link?: string;
	category?: string;
	description?: string;
	telephone?: string;
	address?: string;
	roadAddress?: string;
};

const NAVER_WEB_ENDPOINT = 'https://openapi.naver.com/v1/search/webkr.json';
const GOOGLE_CUSTOM_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

/** Naver Web Search (`webkr`) max `display` per request. */
const NAVER_WEB_PAGE_SIZE = 100;
/** Soft cap: UI collection target (10 / 20 / 50). */
const NAVER_TARGET_DISPLAY_MAX = 50;
/**
 * Max search pages per *single query* (5–10). After portal/SNS skips,
 * deeper pagination is required to fill official-homepage quotas.
 */
const NAVER_MAX_PAGES_PER_QUERY = 8;
/** Hard cap on Naver API HTTP calls per discovery run. */
const NAVER_MAX_TOTAL_API_CALLS = 40;
/** Delay between paginated Naver calls to avoid errorCode 012 rate limits. */
const NAVER_INTER_CALL_DELAY_MS = 200;
const NAVER_WEB_MAX_START = 1000;

/** Google CSE returns max 10 per request; paginate start=1,11,… up to ~100 hits. */
const GOOGLE_CSE_PAGE_SIZE = 10;
const GOOGLE_CSE_DISPLAY_MAX = 50;
const GOOGLE_CSE_MAX_PAGES = 10;
const GOOGLE_CSE_MAX_START = 91;
/** Cap Google HTTP calls per discovery run (quota-aware). */
const GOOGLE_MAX_TOTAL_API_CALLS = 20;

/**
 * Max alternate queries (excluding primary): districts + industry expansions.
 */
const MAX_FALLBACK_QUERIES = 10;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Structured debug reasons for under-collection / dropped rows. */
export type DiscoveryStopReason =
	| 'target_filled'
	| 'pagination_end'
	| 'empty_page'
	| 'rate_limit'
	| 'blocked'
	| 'selector_miss'
	| 'fallback_exhausted';

export type DiscoverySkipReason =
	| 'empty_link'
	| 'portal_sns'
	| 'blacklist_public'
	| 'duplicate_host'
	| 'duplicate_identity'
	| 'invalid_url';

function logDiscoveryTrace(
	event: string,
	detail: Record<string, unknown> = {},
): void {
	console.log(`🧭 [Discovery Trace] ${event}:`, detail);
}
/** Rate-limit / throttle signals from Naver Open API. */
export function isNaverRateLimitError(error: unknown): boolean {
	if (!axios.isAxiosError(error)) return false;
	const status = error.response?.status;
	if (status === 429 || status === 403) return true;

	const data = error.response?.data as { errorCode?: string | number } | undefined;
	const code = data?.errorCode != null ? String(data.errorCode) : '';
	return code === '012';
}

/** Portal / in-house hosts that are not a business's own website. */
const PORTAL_INHOUSE_HOST_PATTERNS = [
	// Broad portal catch-alls (Google CSE often returns these)
	'naver.com',
	'daum.net',
	'kakao.com',
	'google.com',
	'google.co.kr',
	'bing.com',
	'yahoo.com',
	'wikipedia.org',
	'namu.wiki',
	// Explicit Naver / Kakao surfaces
	'blog.naver.com',
	'cafe.naver.com',
	'kin.naver.com',
	'map.naver.com',
	'place.naver.com',
	'm.place.naver.com',
	'naver.me',
	'booking.naver.com',
	'store.naver.com',
	'smartstore.naver.com',
	'shopping.naver.com',
	'brand.naver.com',
	'in.naver.com',
	'post.naver.com',
	'tv.naver.com',
	'news.naver.com',
	'nid.naver.com',
	'pay.naver.com',
	'modoo.at',
	'pf.kakao.com',
	'story.kakao.com',
	'tistory.com',
	'instagram.com',
	'facebook.com',
	'fb.com',
	'youtube.com',
	'youtu.be',
	'twitter.com',
	'x.com',
	'linkedin.com',
	'threads.net',
];

/**
 * Public-sector / university-hospital / association domains to exclude.
 * Suffix entries (go.kr, or.kr) match any host ending with `.go.kr` / `.or.kr`.
 */
const BLACKLIST_DOMAIN_SUFFIXES = ['go.kr', 'or.kr'] as const;

/** Explicit public / large-hospital hosts (also covered by suffixes; kept for clarity). */
const BLACKLIST_DOMAIN_HOSTS = [
	'nhis.or.kr',
	'pnuh.or.kr',
	'busan.go.kr',
	'saha.go.kr',
	'mohw.go.kr',
] as const;

/** Broad UI labels that should not be sent raw to Naver Local Search. */
const BROAD_CATEGORY_LABEL_RE = /의료\s*\/\s*클리닉|숙박\s*\/\s*여행|전문직\s*\/\s*법률|제조\s*\/\s*B2B|쇼핑몰\s*\/\s*커머스|교육\s*\/\s*웨딩/gi;

/** Default searchable specialty when only a broad industry code is selected. */
const DEFAULT_SEARCH_TOPIC_BY_INDUSTRY: Record<CrawlIndustryCode, string> = {
	MEDICAL_CLINIC: '치과의원',
	LODGING_TRAVEL: '호텔',
	PROFESSIONAL_LEGAL: '법무법인',
	MANUFACTURING_B2B: '제조업체',
	COMMERCE: '쇼핑몰',
	EDUCATION_WEDDING: '학원',
	OTHER: '업체',
};

/** Medical terms that already imply a private clinic specialty (skip extra "의원"). */
const MEDICAL_SPECIALTY_RE =
	/(의원|병원|클리닉|치과|한의원|피부과|안과|내과|외과|정형외과|이비인후과|산부인과|비뇨기과|신경과|정신건강의학과|재활의학과|가정의학과|소아과|성형외과)/;

/**
 * Metro → district expansions used when a broad region (e.g. "부산") underfills.
 * Queries become "부산시 {구} {specialty}" style fallbacks.
 */
const REGION_DISTRICT_EXPANSIONS: Record<string, string[]> = {
	부산: ['부산진구', '해운대구', '동래구', '사하구', '금정구', '남구', '연제구', '수영구', '북구'],
	서울: ['강남구', '서초구', '송파구', '마포구', '영등포구', '중구', '강서구', '관악구'],
	경기: ['수원시', '성남시', '용인시', '고양시', '부천시', '안양시'],
	대구: ['중구', '수성구', '달서구', '동구'],
	인천: ['남동구', '연수구', '부평구', '서구'],
	광주: ['서구', '북구', '광산구'],
	대전: ['서구', '유성구', '동구'],
	울산: ['남구', '중구', '동구'],
};

const KR_METRO_PREFIXES = [
	'서울',
	'부산',
	'경기',
	'대구',
	'인천',
	'광주',
	'대전',
	'울산',
	'세종',
	'강원',
	'충북',
	'충남',
	'전북',
	'전남',
	'경북',
	'경남',
	'제주',
] as const;

/**
 * 2nd-wave query expansion: [region + detailed industry] when a broad
 * keyword like "부산 기업" underfills after district expansions.
 */
export const INDUSTRY_EXPANSION_PHRASES = [
	'제조업 회사',
	'물류 기업',
	'IT 기업',
	'식품 공장',
	'무역 회사',
] as const;

const BROAD_COMPANY_TOPIC_RE = /^(기업|회사|업체|공장|법인|사업체|사업장)$/;

/**
 * Specialty keyword → related sub-queries when primary search is too narrow.
 * Example: "내과" → "순환기내과", "종합병원 내과", …
 */
const KEYWORD_FALLBACK_VARIANTS: Record<string, string[]> = {
	내과: ['순환기내과', '소화기내과', '내과 의원', '종합병원 내과', '내과클리닉', '가정의학과'],
	치과: ['치과의원', '임플란트 치과', '교정 치과', '소아치과'],
	피부과: ['피부과의원', '피부클리닉', '피부미용'],
	안과: ['안과의원', '안과클리닉', '라식'],
	한의원: ['한의원', '한방병원', '침구'],
	정형외과: ['정형외과의원', '척추병원', '관절클리닉'],
	이비인후과: ['이비인후과의원', '코클리닉'],
	산부인과: ['산부인과의원', '여성병원'],
	소아과: ['소아청소년과의원', '소아클리닉'],
	병원: ['종합병원', '의원', '클리닉'],
	의원: ['클리닉', '병원'],
	클리닉: ['의원', '병원'],
	호텔: ['비즈니스호텔', '관광호텔', '리조트'],
	학원: ['입시학원', '어학원', '보습학원'],
};

const SEED_BY_INDUSTRY: Record<CrawlIndustryCode, { name: string; slug: string }[]> = {
	MEDICAL_CLINIC: [
		{ name: '메디컬케어', slug: 'medicalcare' },
		{ name: '피부클리닉', slug: 'skin-clinic' },
		{ name: '척추병원', slug: 'spine-hospital' },
		{ name: '덴탈센터', slug: 'dental-center' },
		{ name: '아이케어안과', slug: 'eyecare' },
		{ name: '헬스체크업', slug: 'health-checkup' },
		{ name: '뷰티메디', slug: 'beauty-medi' },
		{ name: '웰니스클리닉', slug: 'wellness-clinic' },
	],
	LODGING_TRAVEL: [
		{ name: '오션스테이', slug: 'ocean-stay' },
		{ name: '시티호텔', slug: 'city-hotel' },
		{ name: '게스트하우스', slug: 'guest-house' },
		{ name: '리조트빌라', slug: 'resort-villa' },
		{ name: '트래블스테이', slug: 'travel-stay' },
		{ name: '한옥스테이', slug: 'hanok-stay' },
		{ name: '비치펜션', slug: 'beach-pension' },
		{ name: '에어포트인', slug: 'airport-inn' },
	],
	PROFESSIONAL_LEGAL: [
		{ name: '법률사무소', slug: 'law-office' },
		{ name: '세무회계', slug: 'tax-account' },
		{ name: '특허법인', slug: 'patent-firm' },
		{ name: '노무컨설팅', slug: 'labor-consult' },
		{ name: '기업자문', slug: 'corp-advisory' },
		{ name: '법무파트너스', slug: 'legal-partners' },
		{ name: 'IP어드바이저리', slug: 'ip-advisory' },
		{ name: '컴플라이언스', slug: 'compliance' },
	],
	MANUFACTURING_B2B: [
		{ name: '정밀부품', slug: 'precision-parts' },
		{ name: '금형테크', slug: 'mold-tech' },
		{ name: '산업장비', slug: 'industrial-eq' },
		{ name: '소재솔루션', slug: 'material-sol' },
		{ name: '팩토리링크', slug: 'factory-link' },
		{ name: '오토메이션', slug: 'automation' },
		{ name: '메탈웍스', slug: 'metalworks' },
		{ name: 'B2B서플라이', slug: 'b2b-supply' },
	],
	COMMERCE: [
		{ name: '스마트몰', slug: 'smart-mall' },
		{ name: '라이프샵', slug: 'life-shop' },
		{ name: '브랜드스토어', slug: 'brand-store' },
		{ name: '마켓허브', slug: 'market-hub' },
		{ name: '데일리커머스', slug: 'daily-commerce' },
		{ name: '프리미엄샵', slug: 'premium-shop' },
		{ name: '로컬마켓', slug: 'local-market' },
		{ name: '오픈스토어', slug: 'open-store' },
	],
	EDUCATION_WEDDING: [
		{ name: '에듀센터', slug: 'edu-center' },
		{ name: '웨딩스튜디오', slug: 'wedding-studio' },
		{ name: '어학원', slug: 'language-lab' },
		{ name: '컨벤션홀', slug: 'convention-hall' },
		{ name: '코딩스쿨', slug: 'coding-school' },
		{ name: '예식장', slug: 'wedding-hall' },
		{ name: '키즈아카데미', slug: 'kids-academy' },
		{ name: '포토스튜디오', slug: 'photo-studio' },
	],
	OTHER: [
		{ name: '로컬비즈', slug: 'local-biz' },
		{ name: '디지털에이전시', slug: 'digital-agency' },
		{ name: '커뮤니티허브', slug: 'community-hub' },
		{ name: '서비스랩', slug: 'service-lab' },
		{ name: '스타트업베이스', slug: 'startup-base' },
		{ name: '미디어스튜디오', slug: 'media-studio' },
		{ name: '컨설팅그룹', slug: 'consulting-group' },
		{ name: '솔루션웍스', slug: 'solution-works' },
	],
};

const TLD_BY_COUNTRY: Record<CrawlCountryCode, string> = {
	KR: 'co.kr',
	US: 'com',
	JP: 'co.jp',
	GLOBAL: 'com',
};

const LABEL_TO_INDUSTRY: Record<string, CrawlIndustryCode> = Object.fromEntries(
	(Object.entries(CRAWL_INDUSTRY_LABELS) as [CrawlIndustryCode, string][]).map(
		([code, label]) => [label, code],
	),
) as Record<string, CrawlIndustryCode>;

export function resolveNaverCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = process.env.NAVER_CLIENT_ID?.trim() || '';
	const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() || '';
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

/**
 * Google Custom Search credentials.
 * API key: GOOGLE_SEARCH_API_KEY → VITE_GOOGLE_MAP_API_KEY (shared Maps/PSI key fallback).
 * CX: GOOGLE_SEARCH_CX (Programmable Search Engine ID) — required.
 */
export function resolveGoogleSearchCredentials(): { apiKey: string; cx: string } | null {
	const apiKey =
		process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		'';
	const cx = process.env.GOOGLE_SEARCH_CX?.trim() || '';
	if (!apiKey || !cx) return null;
	return { apiKey, cx };
}

export function stripHtmlTags(value: string): string {
	return value
		.replace(/<[^>]*>?/gm, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeHttpUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isPortalInhouseLink(rawUrl: string): boolean {
	try {
		const href = normalizeHttpUrl(rawUrl);
		const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
		return PORTAL_INHOUSE_HOST_PATTERNS.some(
			(pattern) => host === pattern || host.endsWith(`.${pattern}`),
		);
	} catch {
		return true;
	}
}

/**
 * Exclude government (.go.kr), organization (.or.kr),
 * and known public/large-hospital hosts (보건소, 시청, 대학병원, 공단 등).
 */
export function isBlacklistedDomain(rawUrl: string): boolean {
	try {
		const href = normalizeHttpUrl(rawUrl);
		const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');

		if (
			BLACKLIST_DOMAIN_SUFFIXES.some(
				(suffix) => host === suffix || host.endsWith(`.${suffix}`),
			)
		) {
			return true;
		}

		return BLACKLIST_DOMAIN_HOSTS.some(
			(blocked) => host === blocked || host.endsWith(`.${blocked}`),
		);
	} catch {
		return true;
	}
}

/** True when the URL is a usable private business homepage. */
export function isEligibleBusinessHomepage(rawUrl: string): boolean {
	const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
	if (!trimmed) return false;
	if (isPortalInhouseLink(trimmed)) return false;
	if (isBlacklistedDomain(trimmed)) return false;
	return true;
}

export function resolveIndustryCode(
	category?: string,
	categoryCode?: CrawlIndustryCode,
): CrawlIndustryCode {
	if (categoryCode && categoryCode in CRAWL_INDUSTRY_LABELS) return categoryCode;
	if (!category) return 'OTHER';
	const trimmed = category.trim();
	if (trimmed in CRAWL_INDUSTRY_LABELS) return trimmed as CrawlIndustryCode;
	if (trimmed in LABEL_TO_INDUSTRY) return LABEL_TO_INDUSTRY[trimmed];
	return 'OTHER';
}

function slugify(value: string): string {
	const ascii = value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24);
	return ascii || 'target';
}

function regionSlug(region: string): string {
	const map: Record<string, string> = {
		서울: 'seoul',
		부산: 'busan',
		경기: 'gyeonggi',
		대구: 'daegu',
		인천: 'incheon',
		광주: 'gwangju',
		대전: 'daejeon',
		울산: 'ulsan',
		세종: 'sejong',
		강원: 'gangwon',
		충북: 'chungbuk',
		충남: 'chungnam',
		전북: 'jeonbuk',
		전남: 'jeonnam',
		경북: 'gyeongbuk',
		경남: 'gyeongnam',
		제주: 'jeju',
		전국: 'korea',
		California: 'ca',
		'New York': 'ny',
		Texas: 'tx',
		Washington: 'wa',
		Nationwide: 'us',
		東京都: 'tokyo',
		大阪府: 'osaka',
		神奈川県: 'kanagawa',
		愛知県: 'aichi',
		福岡県: 'fukuoka',
		全国: 'jp',
		전체: 'global',
		기타: 'intl',
		Other: 'other',
	};
	return map[region] ?? slugify(region);
}

function isBroadRegion(region: string): boolean {
	return ['전국', 'Nationwide', '全国', '전체', 'Other', '기타'].includes(region);
}

/**
 * Resolve the specialty/sub-category term used in Naver Local `query`.
 * Prefer free-text keyword (e.g. "치과"); otherwise refine broad UI labels
 * like "의료/클리닉" into searchable private-clinic terms.
 */
export function resolveSearchSubCategory(
	keyword: string,
	categoryLabel: string,
	industryCode: CrawlIndustryCode,
): string {
	const kw = keyword.trim();
	if (kw) {
		return kw.replace(BROAD_CATEGORY_LABEL_RE, '').replace(/\s+/g, ' ').trim() || kw;
	}

	const cleanedLabel = categoryLabel
		.replace(BROAD_CATEGORY_LABEL_RE, '')
		.replace(/\s*\/\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	if (cleanedLabel && cleanedLabel !== CRAWL_INDUSTRY_LABELS[industryCode]) {
		return cleanedLabel;
	}

	return DEFAULT_SEARCH_TOPIC_BY_INDUSTRY[industryCode] || cleanedLabel || '업체';
}

/**
 * Build a precise Naver Local Search query from region + specialty.
 * Examples:
 *   region="부산 사하구", keyword="치과" → "부산 사하구 치과"
 *   region="부산", category="의료/클리닉" → "부산 치과의원"
 */
export function buildSearchQuery(
	region: string,
	categoryLabel: string,
	keyword: string,
	industryCode: CrawlIndustryCode = 'OTHER',
): string {
	const regionPart = isBroadRegion(region) ? '' : region.trim();
	const subCategory = resolveSearchSubCategory(keyword, categoryLabel, industryCode);

	let query: string;
	if (regionPart && subCategory) {
		if (subCategory === regionPart || subCategory.startsWith(`${regionPart} `)) {
			query = subCategory;
		} else if (regionPart.startsWith(`${subCategory} `) || regionPart === subCategory) {
			query = regionPart;
		} else {
			query = `${regionPart} ${subCategory}`;
		}
	} else {
		query = `${regionPart} ${subCategory}`.replace(/\s+/g, ' ').trim();
	}

	query = query.replace(BROAD_CATEGORY_LABEL_RE, '').replace(/\s+/g, ' ').trim();

	// Medical: nudge toward private clinics (의원) when the term is still generic.
	if (industryCode === 'MEDICAL_CLINIC' && query && !MEDICAL_SPECIALTY_RE.test(query)) {
		query = `${query} 의원`.replace(/\s+/g, ' ').trim();
	}

	return query;
}

/**
 * Google CSE query: pass the unified search keyword as-is (no region/category expansion).
 * Falls back to legacy region+category composition only when keyword is empty.
 */
export function buildGoogleSearchQuery(
	region: string,
	categoryLabel: string,
	keyword: string,
	industryCode: CrawlIndustryCode = 'OTHER',
): string {
	const kw = keyword.trim();
	if (kw) return kw;
	return buildSearchQuery(region, categoryLabel, keyword, industryCode);
}

function metroBaseRegion(region: string): string {
	const trimmed = region.trim();
	if (!trimmed) return '';
	// "부산 사하구" → "부산", "부산시" → "부산"
	const first = trimmed.split(/\s+/)[0]?.replace(/시$/, '') || trimmed;
	return first;
}

/**
 * Split a unified keyword ("부산 기업", "부산시 사하구 치과") into metro + remainder.
 */
export function extractKeywordRegionAndTopic(keyword: string): {
	region: string;
	topic: string;
} {
	const trimmed = keyword.trim();
	if (!trimmed) return { region: '', topic: '' };
	for (const metro of KR_METRO_PREFIXES) {
		const re = new RegExp(`^${metro}(광역시|특별시|특별자치시|특별자치도|시|도)?(\\s+|$)`);
		if (re.test(trimmed)) {
			return { region: metro, topic: trimmed.replace(re, '').trim() };
		}
	}
	return { region: '', topic: trimmed };
}

/** True for broad B2B seeds like "부산 기업" / "서울 회사" (not "부산 사하구 치과"). */
export function isBroadCompanyKeyword(keyword: string): boolean {
	const { topic } = extractKeywordRegionAndTopic(keyword);
	if (!topic) return true;
	if (BROAD_COMPANY_TOPIC_RE.test(topic)) return true;
	return /^(기업|회사|업체)(\s|$)/.test(topic) || /\s(기업|회사|업체)$/.test(topic);
}

/**
 * 2nd-wave expansions: "부산 기업" → "부산 제조업 회사", "부산 물류 기업", …
 */
export function buildIndustryExpansionQueries(
	keyword: string,
	regionHint = '',
): string[] {
	const extracted = extractKeywordRegionAndTopic(keyword);
	const region =
		extracted.region || metroBaseRegion(regionHint) || regionHint.trim().split(/\s+/)[0] || '';
	if (!region || isBroadRegion(region)) return [];
	return INDUSTRY_EXPANSION_PHRASES.map((phrase) => `${region} ${phrase}`);
}

function hasDistrictInRegion(region: string): boolean {
	// True only when an explicit 구/군 is present (not bare "부산" / "부산시").
	return /[가-힣]+[구군]/.test(region.trim());
}

/**
 * Build primary + fallback Local/CSE queries when the first search underfills.
 * Order: primary → district expansions → [region + industry] → specialty variants.
 *
 * Examples for region="부산", keyword="기업":
 *   "부산 기업"
 *   "부산시 부산진구 기업"
 *   "부산 제조업 회사"
 *   "부산 물류 기업"
 */
export function buildFallbackSearchQueries(
	region: string,
	categoryLabel: string,
	keyword: string,
	industryCode: CrawlIndustryCode = 'OTHER',
): { primary: string; fallbacks: string[] } {
	const primary = buildSearchQuery(region, categoryLabel, keyword, industryCode);
	const subCategory = resolveSearchSubCategory(keyword, categoryLabel, industryCode);
	const extracted = extractKeywordRegionAndTopic(keyword.trim() || primary);
	const metro =
		extracted.region ||
		metroBaseRegion(region) ||
		extractKeywordRegionAndTopic(primary).region;
	const districtTopic = extracted.topic || subCategory;
	const seen = new Set<string>([primary.toLowerCase()]);
	const districtQueries: string[] = [];
	const industryQueries: string[] = [];
	const specialtyQueries: string[] = [];

	const pushInto = (bucket: string[], raw: string) => {
		const q = raw.replace(/\s+/g, ' ').trim();
		if (!q) return;
		const key = q.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		bucket.push(q);
	};

	// 1) District-level expansions for broad metros (부산 → 부산시 부산진구 기업 …)
	const cityMetros = new Set(['부산', '서울', '대구', '인천', '광주', '대전', '울산']);
	if (metro && !hasDistrictInRegion(region) && !hasDistrictInRegion(keyword)) {
		const districts = REGION_DISTRICT_EXPANSIONS[metro] || [];
		for (const district of districts) {
			if (cityMetros.has(metro)) {
				pushInto(districtQueries, `${metro}시 ${district} ${districtTopic}`);
			} else {
				pushInto(districtQueries, `${metro} ${district} ${districtTopic}`);
			}
		}
	}

	// 2) [region + detailed industry] when the seed is a broad company keyword
	const expansionSeed = keyword.trim() || primary;
	if (isBroadCompanyKeyword(expansionSeed) || isBroadCompanyKeyword(primary)) {
		for (const q of buildIndustryExpansionQueries(expansionSeed, region)) {
			pushInto(industryQueries, q);
		}
	}

	// 3) Specialty / synonym expansions
	const variantKeys = Object.keys(KEYWORD_FALLBACK_VARIANTS).filter((k) =>
		subCategory.includes(k),
	);
	const variants = variantKeys.flatMap((k) => KEYWORD_FALLBACK_VARIANTS[k] || []);
	const regionPart = isBroadRegion(region) ? '' : region.trim();
	for (const variant of variants) {
		pushInto(specialtyQueries, `${regionPart} ${variant}`.trim());
		if (metro && metro !== regionPart) {
			pushInto(specialtyQueries, `${metro} ${variant}`.trim());
		}
	}

	// 4) Mild broadening when specialty is very specific
	if (industryCode === 'MEDICAL_CLINIC' && subCategory && !/의원|병원|클리닉/.test(subCategory)) {
		pushInto(specialtyQueries, `${regionPart} ${subCategory} 의원`.trim());
		pushInto(specialtyQueries, `${regionPart} ${subCategory} 클리닉`.trim());
	}

	// Districts first (geo), then industry 2nd-wave, then specialty synonyms.
	const fallbacks = [
		...districtQueries.slice(0, 4),
		...industryQueries.slice(0, INDUSTRY_EXPANSION_PHRASES.length),
		...specialtyQueries.slice(0, 2),
	].slice(0, MAX_FALLBACK_QUERIES);

	return { primary, fallbacks };
}

/** Google variants of fallback queries — keyword-first, with the same expansion chain. */
export function buildFallbackGoogleQueries(
	region: string,
	categoryLabel: string,
	keyword: string,
	industryCode: CrawlIndustryCode = 'OTHER',
): { primary: string; fallbacks: string[] } {
	const kw = keyword.trim();
	if (kw) {
		const { fallbacks } = buildFallbackSearchQueries(region, categoryLabel, keyword, industryCode);
		return {
			primary: kw,
			fallbacks: fallbacks.filter((q) => q.toLowerCase() !== kw.toLowerCase()),
		};
	}
	return buildFallbackSearchQueries(region, categoryLabel, keyword, industryCode);
}

/** Collapse deep links to the site root so we collect homepage URLs. */
export function toOfficialHomepageUrl(rawUrl: string): string {
	try {
		const u = new URL(normalizeHttpUrl(rawUrl));
		return `${u.protocol}//${u.host}/`;
	} catch {
		return normalizeHttpUrl(rawUrl);
	}
}

function hostnameDedupeKey(url: string): string {
	return extractRootDomain(url) || url.trim().toLowerCase();
}

/**
 * Soft identity key (phone-first, else name+address).
 * Intentionally NOT name-only — same specialty names ("XX내과의원") are common
 * across districts and must not collapse distinct clinics.
 */
export function softIdentityDedupeKey(input: {
	siteName?: string;
	telephone?: string;
	address?: string;
	roadAddress?: string;
}): string | null {
	const phoneDigits = (input.telephone || '').replace(/\D/g, '');
	if (phoneDigits.length >= 9) {
		return `tel:${phoneDigits}`;
	}

	const name = normalizeBusinessName(input.siteName || '');
	const addrRaw = (input.roadAddress || input.address || '').replace(/\s+/g, '');
	// Require a meaningful address fragment so "부산 내과" clones don't collide.
	if (name.length >= 2 && addrRaw.length >= 10) {
		return `na:${name}|${addrRaw.slice(0, 24)}`;
	}
	return null;
}

/** Strip legal suffixes / noise for soft identity compare. */
export function normalizeBusinessName(name: string): string {
	return stripHtmlTags(name)
		.replace(
			/(주식회사|㈜|\(주\)|유한회사|의원|병원|클리닉|치과|한의원|피부과|안과|내과|외과)/g,
			'',
		)
		.replace(/[^\p{L}\p{N}]+/gu, '')
		.toLowerCase()
		.trim();
}

function classifyIneligibleReason(rawUrl: string): DiscoverySkipReason {
	const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
	if (!trimmed) return 'empty_link';
	if (isPortalInhouseLink(trimmed)) return 'portal_sns';
	if (isBlacklistedDomain(trimmed)) return 'blacklist_public';
	return 'invalid_url';
}

/** Strip Google title noise ("Clinic Name - Official Site | Region"). */
export function cleanGoogleResultTitle(title: string, fallbackUrl = ''): string {
	const stripped = stripHtmlTags(title);
	if (!stripped) return fallbackUrl;
	const primary =
		stripped
			.split(/\s+[|\u00b7]\s+/)[0]
			?.split(/\s+[-–—]\s+/)[0]
			?.trim() || stripped;
	return primary || fallbackUrl;
}

type NaverWebItem = {
	title?: string;
	link?: string;
	description?: string;
};

/**
 * Fetch one page from Naver Web Search (`webkr`). `display` is capped at 100.
 */
async function fetchNaverWebPage(
	query: string,
	start: number,
	clientId: string,
	clientSecret: string,
): Promise<NaverWebItem[]> {
	try {
		const res = await axios.get<{ items?: NaverWebItem[] }>(NAVER_WEB_ENDPOINT, {
			params: {
				query,
				display: NAVER_WEB_PAGE_SIZE,
				start,
			},
			headers: {
				'X-Naver-Client-Id': clientId,
				'X-Naver-Client-Secret': clientSecret,
			},
			timeout: 5_000,
			validateStatus: (s) => s >= 200 && s < 300,
		});
		return Array.isArray(res.data?.items) ? res.data.items : [];
	} catch (error: unknown) {
		if (isNaverRateLimitError(error)) {
			logDiscoveryTrace('blocked', {
				reason: 'rate_limit' satisfies DiscoveryStopReason,
				engine: 'naver-webkr',
				query,
				start,
				detail: axios.isAxiosError(error) ? error.response?.data : undefined,
			});
			console.warn(
				'⚠️ 네이버 API 초당 요청 제한(Rate Limit) 도달. 잠시 후 재시도 필요.',
				axios.isAxiosError(error) ? error.response?.data : undefined,
			);
		} else if (axios.isAxiosError(error)) {
			logDiscoveryTrace('blocked', {
				reason: 'blocked' satisfies DiscoveryStopReason,
				engine: 'naver-webkr',
				query,
				start,
				detail: error.response?.data ?? error.message,
			});
			console.error(
				'❌ [Naver Web Search Error]:',
				error.response?.data ?? error.message,
			);
		} else {
			console.error(
				'❌ [Naver Web Search Error]:',
				error instanceof Error ? error.message : String(error),
			);
		}
		throw error;
	}
}

function googleStartOffsets(maxPages: number): number[] {
	const starts: number[] = [];
	for (let i = 0; i < maxPages; i += 1) {
		const start = 1 + i * GOOGLE_CSE_PAGE_SIZE;
		if (start > GOOGLE_CSE_MAX_START) break;
		starts.push(start);
	}
	return starts;
}

export type GoogleSearchItem = {
	title?: string;
	link?: string;
	displayLink?: string;
	snippet?: string;
};

async function fetchGoogleCustomSearchPage(
	query: string,
	start: number,
	apiKey: string,
	cx: string,
): Promise<GoogleSearchItem[]> {
	try {
		const res = await axios.get<{ items?: GoogleSearchItem[] }>(GOOGLE_CUSTOM_SEARCH_ENDPOINT, {
			params: {
				key: apiKey,
				cx,
				q: query,
				num: GOOGLE_CSE_PAGE_SIZE,
				start,
			},
			timeout: 4_000,
			validateStatus: (s) => s >= 200 && s < 300,
		});
		return Array.isArray(res.data?.items) ? res.data.items : [];
	} catch (error: unknown) {
		if (axios.isAxiosError(error)) {
			console.error(
				'❌ [Google Custom Search Error]:',
				error.response?.data ?? error.message,
			);
		} else {
			console.error(
				'❌ [Google Custom Search Error]:',
				error instanceof Error ? error.message : String(error),
			);
		}
		throw error;
	}
}

export type TargetDiscoveryResult = {
	targets: DiscoveredTarget[];
	query: string;
	/** All queries attempted (primary + fallbacks that ran). */
	queriesUsed: string[];
	scanned: number;
	stopReason: DiscoveryStopReason;
	skipStats: Partial<Record<DiscoverySkipReason, number>>;
};

/**
 * Discover real business official websites via Google Custom Search API.
 * Paginates up to 10 pages (start=1,11,… ) and expands queries when underfilled.
 */
export async function discoverTargetsViaGoogle(
	input: NaverTargetFinderInput,
): Promise<TargetDiscoveryResult> {
	const creds = resolveGoogleSearchCredentials();
	if (!creds) {
		throw new Error(
			'구글 검색 API 키가 .env에 설정되지 않았습니다. (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX)',
		);
	}

	const keyword = (input.keyword || '').trim();
	const region =
		(input.region || '').trim() ||
		keyword ||
		(input.country || 'KR');
	const industryCode = resolveIndustryCode(input.category, input.categoryCode);
	const categoryLabel =
		keyword ||
		(input.category && !(input.category in CRAWL_INDUSTRY_LABELS)
			? input.category.trim()
			: CRAWL_INDUSTRY_LABELS[industryCode]) ||
		CRAWL_INDUSTRY_LABELS.OTHER;
	const displayCount = Math.min(
		Math.max(Number(input.displayCount) || 20, 1),
		GOOGLE_CSE_DISPLAY_MAX,
	);
	const country: CrawlCountryCode = input.country || 'KR';
	const { primary, fallbacks } = buildFallbackGoogleQueries(
		region,
		categoryLabel,
		keyword,
		industryCode,
	);
	if (!primary) {
		throw new Error('검색어를 입력해 주세요.');
	}

	const stamp = Date.now();
	const crawledAt = new Date().toISOString();
	const starts = googleStartOffsets(GOOGLE_CSE_MAX_PAGES);

	console.log('🔍 [Google Custom Search]:', {
		primary,
		fallbacks,
		region,
		displayCount,
		pageSize: GOOGLE_CSE_PAGE_SIZE,
		starts,
		maxPages: GOOGLE_CSE_MAX_PAGES,
		maxApiCalls: GOOGLE_MAX_TOTAL_API_CALLS,
	});

	const seenHosts = new Set<string>();
	const seenIdentity = new Set<string>();
	const targets: DiscoveredTarget[] = [];
	const queriesUsed: string[] = [];
	const skipStats: Partial<Record<DiscoverySkipReason, number>> = {};
	let scanned = 0;
	let stopReason: DiscoveryStopReason = 'fallback_exhausted';
	let globalPageCalls = 0;

	const bumpSkip = (reason: DiscoverySkipReason) => {
		skipStats[reason] = (skipStats[reason] || 0) + 1;
	};

	const queryQueue = [primary, ...fallbacks].slice(0, 1 + MAX_FALLBACK_QUERIES);

	for (let qi = 0; qi < queryQueue.length; qi += 1) {
		if (targets.length >= displayCount) {
			stopReason = 'target_filled';
			break;
		}
		if (globalPageCalls >= GOOGLE_MAX_TOTAL_API_CALLS) {
			stopReason = targets.length > 0 ? 'pagination_end' : 'fallback_exhausted';
			break;
		}

		const query = queryQueue[qi];
		queriesUsed.push(query);

		logDiscoveryTrace('query_start', {
			engine: 'google',
			query,
			queryIndex: qi,
			collected: targets.length,
			displayCount,
			starts,
		});

		for (const start of starts) {
			if (targets.length >= displayCount) {
				stopReason = 'target_filled';
				break;
			}
			if (globalPageCalls >= GOOGLE_MAX_TOTAL_API_CALLS) break;

			let items: GoogleSearchItem[];
			try {
				items = await fetchGoogleCustomSearchPage(query, start, creds.apiKey, creds.cx);
			} catch (error: unknown) {
				logDiscoveryTrace('blocked', {
					engine: 'google',
					query,
					start,
					reason: 'blocked' satisfies DiscoveryStopReason,
					detail: axios.isAxiosError(error)
						? error.response?.data ?? error.message
						: String(error),
				});
				stopReason = 'blocked';
				break;
			}

			globalPageCalls += 1;
			scanned += items.length;
			if (items.length === 0) {
				logDiscoveryTrace('pagination_end', {
					engine: 'google',
					query,
					start,
					reason: 'empty_page' satisfies DiscoveryStopReason,
					collected: targets.length,
				});
				stopReason = 'pagination_end';
				break;
			}

			for (const [idx, item] of items.entries()) {
				const rawLink = typeof item.link === 'string' ? item.link.trim() : '';
				if (!rawLink) {
					bumpSkip('empty_link');
					continue;
				}
				if (!isEligibleBusinessHomepage(rawLink)) {
					const reason = classifyIneligibleReason(rawLink);
					bumpSkip(reason);
					logDiscoveryTrace('skip_item', { engine: 'google', reason, url: rawLink });
					continue;
				}

				const homepage = toOfficialHomepageUrl(rawLink);
				if (!isEligibleBusinessHomepage(homepage)) {
					const reason = classifyIneligibleReason(homepage);
					bumpSkip(reason);
					continue;
				}

				const hostKey = hostnameDedupeKey(homepage);
				if (!hostKey) {
					bumpSkip('invalid_url');
					continue;
				}
				if (seenHosts.has(hostKey)) {
					bumpSkip('duplicate_host');
					continue;
				}

				const siteName =
					cleanGoogleResultTitle(item.title || '', homepage) || homepage;
				const identity = softIdentityDedupeKey({ siteName });
				if (identity && seenIdentity.has(identity)) {
					bumpSkip('duplicate_identity');
					logDiscoveryTrace('skip_item', {
						engine: 'google',
						reason: 'duplicate_identity',
						siteName,
						identity,
					});
					continue;
				}

				seenHosts.add(hostKey);
				if (identity) seenIdentity.add(identity);

				targets.push({
					id: `target_g_${stamp}_${qi}_${start}_${idx}`,
					siteName,
					url: homepage,
					region,
					category: industryCode,
					categoryLabel,
					country,
					crawledAt,
					source: 'google',
				});

				if (targets.length >= displayCount) {
					stopReason = 'target_filled';
					break;
				}
			}

			if (items.length < GOOGLE_CSE_PAGE_SIZE) {
				stopReason = 'pagination_end';
				break;
			}
		}

		if (targets.length >= displayCount) {
			stopReason = 'target_filled';
			break;
		}
		if (stopReason === 'blocked') break;
		if (qi < queryQueue.length - 1) {
			logDiscoveryTrace('fallback_expand', {
				engine: 'google',
				from: query,
				to: queryQueue[qi + 1],
				collected: targets.length,
				needed: displayCount,
			});
		} else {
			stopReason = 'fallback_exhausted';
		}
	}

	if (targets.length >= displayCount) {
		stopReason = 'target_filled';
	}

	logDiscoveryTrace('discover_done', {
		engine: 'google',
		returned: Math.min(targets.length, displayCount),
		requested: displayCount,
		scanned,
		stopReason,
		queriesUsed,
		globalPageCalls,
		skipStats,
	});

	return {
		targets: targets.slice(0, displayCount),
		query: primary,
		queriesUsed,
		scanned,
		stopReason,
		skipStats,
	};
}

/**
 * Sample private-clinic style rows used when Naver keys are missing or the API fails.
 * Never includes .go.kr / .or.kr public-sector or university-hospital domains.
 */
export function buildRealSampleFallbackTargets(input: {
	region: string;
	categoryLabel: string;
	categoryCode: CrawlIndustryCode;
	country?: CrawlCountryCode;
	limit?: number;
}): DiscoveredTarget[] {
	const region = input.region.trim() || '부산 사하구';
	const categoryLabel = input.categoryLabel.trim() || CRAWL_INDUSTRY_LABELS.OTHER;
	const country = input.country || 'KR';
	const limit = Math.min(Math.max(input.limit ?? 5, 1), NAVER_TARGET_DISPLAY_MAX);
	const crawledAt = new Date().toISOString();
	const stamp = Date.now();
	const rSlug = regionSlug(region);

	const catalog: { siteName: string; url: string }[] = [
		{ siteName: `${region} 미소치과의원`, url: `https://www.miso-dental-${rSlug}.co.kr` },
		{ siteName: `${region} 연세피부과의원`, url: `https://www.yonsei-derm-${rSlug}.co.kr` },
		{ siteName: `${region} 바른정형외과의원`, url: `https://www.bareun-ortho-${rSlug}.co.kr` },
		{ siteName: `${region} 해맑은내과의원`, url: `https://www.haemalgeun-clinic-${rSlug}.co.kr` },
		{ siteName: `${region} 밝은안과의원`, url: `https://www.bright-eye-${rSlug}.co.kr` },
	].filter((row) => isEligibleBusinessHomepage(row.url));

	return catalog.slice(0, limit).map((row, idx) => ({
		id: `real_fb_${stamp}_${idx}`,
		siteName: row.siteName,
		url: row.url,
		region,
		category: input.categoryCode,
		categoryLabel,
		country,
		crawledAt,
		source: 'seed' as const,
	}));
}

/**
 * Discover real business websites via Naver Web Search (`webkr`).
 * `display=100` per call, up to 8 pages/query. Expands districts then
 * [region + industry] when collected < needed. Returns partial results early.
 */
export async function discoverTargetsViaNaver(
	input: NaverTargetFinderInput,
): Promise<TargetDiscoveryResult> {
	const creds = resolveNaverCredentials();
	if (!creds) {
		throw new Error('네이버 API 키가 .env에 설정되지 않았습니다. (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)');
	}

	const keyword = (input.keyword || '').trim();
	const region =
		(input.region || '').trim() ||
		keyword ||
		'전국';
	const industryCode = resolveIndustryCode(input.category, input.categoryCode);
	const categoryLabel =
		keyword ||
		(input.category && !(input.category in CRAWL_INDUSTRY_LABELS)
			? input.category.trim()
			: CRAWL_INDUSTRY_LABELS[industryCode]) ||
		CRAWL_INDUSTRY_LABELS.OTHER;
	const displayCount = Math.min(
		Math.max(Number(input.displayCount) || 20, 1),
		NAVER_TARGET_DISPLAY_MAX,
	);
	const country: CrawlCountryCode = input.country || 'KR';

	let primary: string;
	let fallbacks: string[];
	if (keyword) {
		primary = keyword;
		const legacy = buildFallbackSearchQueries(region, categoryLabel, keyword, industryCode);
		fallbacks = legacy.fallbacks
			.filter((q) => q.toLowerCase() !== primary.toLowerCase())
			.slice(0, MAX_FALLBACK_QUERIES);
	} else {
		const built = buildFallbackSearchQueries(region, categoryLabel, keyword, industryCode);
		primary = built.primary;
		fallbacks = built.fallbacks.slice(0, MAX_FALLBACK_QUERIES);
	}

	const stamp = Date.now();
	const crawledAt = new Date().toISOString();
	const maxPages = NAVER_MAX_PAGES_PER_QUERY;

	console.log('🔍 [Naver Web Search]:', {
		primary,
		fallbacks,
		region,
		displayCount,
		pageSize: NAVER_WEB_PAGE_SIZE,
		maxPages,
		maxTotalApiCalls: NAVER_MAX_TOTAL_API_CALLS,
		interCallDelayMs: NAVER_INTER_CALL_DELAY_MS,
	});

	const seenHosts = new Set<string>();
	const seenIdentity = new Set<string>();
	const targets: DiscoveredTarget[] = [];
	const queriesUsed: string[] = [];
	const skipStats: Partial<Record<DiscoverySkipReason, number>> = {};
	let scanned = 0;
	let stopReason: DiscoveryStopReason = 'fallback_exhausted';
	let globalPageCalls = 0;

	const bumpSkip = (reason: DiscoverySkipReason) => {
		skipStats[reason] = (skipStats[reason] || 0) + 1;
	};

	const queryQueue = [primary, ...fallbacks].slice(0, 1 + MAX_FALLBACK_QUERIES);

	for (let qi = 0; qi < queryQueue.length; qi += 1) {
		if (targets.length >= displayCount) {
			stopReason = 'target_filled';
			break;
		}
		if (globalPageCalls >= NAVER_MAX_TOTAL_API_CALLS) {
			stopReason = targets.length > 0 ? 'pagination_end' : 'fallback_exhausted';
			logDiscoveryTrace('api_budget_exhausted', {
				engine: 'naver',
				globalPageCalls,
				collected: targets.length,
			});
			break;
		}

		const query = queryQueue[qi];
		queriesUsed.push(query);
		let start = 1;
		let emptyPages = 0;
		let pageIndex = 0;

		logDiscoveryTrace('query_start', {
			engine: 'naver',
			query,
			queryIndex: qi,
			collected: targets.length,
			needed: displayCount,
			displayCount,
			maxPages,
		});

		while (
			targets.length < displayCount &&
			start <= NAVER_WEB_MAX_START &&
			pageIndex < maxPages &&
			globalPageCalls < NAVER_MAX_TOTAL_API_CALLS
		) {
			if (globalPageCalls > 0) {
				await sleep(NAVER_INTER_CALL_DELAY_MS);
			}

			let items: NaverWebItem[];
			try {
				items = await fetchNaverWebPage(query, start, creds.clientId, creds.clientSecret);
			} catch (error: unknown) {
				if (isNaverRateLimitError(error)) {
					stopReason = 'rate_limit';
					logDiscoveryTrace('blocked', {
						engine: 'naver',
						reason: 'rate_limit',
						query,
						start,
						collected: targets.length,
					});
					if (targets.length > 0) {
						console.warn(
							`⚠️ Rate limit mid-pagination — returning ${targets.length} collected targets.`,
						);
						break;
					}
					throw error;
				}
				stopReason = 'blocked';
				if (targets.length > 0) {
					console.warn(
						`⚠️ Naver blocked mid-run — returning ${targets.length} collected targets.`,
					);
					break;
				}
				throw error;
			}

			globalPageCalls += 1;
			pageIndex += 1;
			scanned += items.length;

			if (items.length === 0) {
				emptyPages += 1;
				logDiscoveryTrace('pagination_end', {
					engine: 'naver',
					query,
					start,
					reason: 'empty_page' satisfies DiscoveryStopReason,
					pageIndex,
				});
				if (emptyPages >= 1) {
					stopReason = 'pagination_end';
					break;
				}
			} else {
				emptyPages = 0;
			}

			const likelyLastPage =
				items.length > 0 && items.length < NAVER_WEB_PAGE_SIZE;

			for (const item of items) {
				const rawLink = typeof item.link === 'string' ? item.link.trim() : '';
				if (!isEligibleBusinessHomepage(rawLink)) {
					const reason = classifyIneligibleReason(rawLink);
					bumpSkip(reason);
					continue;
				}

				const url = normalizeHttpUrl(rawLink);
				const homepage = toOfficialHomepageUrl(url);
				const hostKey = hostnameDedupeKey(homepage);
				if (!hostKey) {
					bumpSkip('invalid_url');
					continue;
				}
				if (seenHosts.has(hostKey)) {
					bumpSkip('duplicate_host');
					continue;
				}

				const siteName = stripHtmlTags(item.title || '') || homepage;
				const identity = softIdentityDedupeKey({ siteName });
				if (identity && seenIdentity.has(identity)) {
					bumpSkip('duplicate_identity');
					continue;
				}

				seenHosts.add(hostKey);
				if (identity) seenIdentity.add(identity);

				targets.push({
					id: `target_n_${stamp}_${qi}_${pageIndex}_${targets.length}`,
					siteName,
					url: homepage,
					region,
					category: industryCode,
					categoryLabel,
					country,
					crawledAt,
					source: 'naver',
				});

				if (targets.length >= displayCount) {
					stopReason = 'target_filled';
					break;
				}
			}

			if (likelyLastPage) {
				stopReason = 'pagination_end';
				break;
			}

			start += NAVER_WEB_PAGE_SIZE;
		}

		logDiscoveryTrace('query_end', {
			engine: 'naver',
			query,
			collected: targets.length,
			needed: displayCount,
			displayCount,
			pagesFetched: pageIndex,
			globalPageCalls,
			skipStats,
		});

		if (targets.length >= displayCount) {
			stopReason = 'target_filled';
			break;
		}
		if (stopReason === 'rate_limit') break;
		if (qi < queryQueue.length - 1) {
			logDiscoveryTrace('fallback_expand', {
				engine: 'naver',
				from: query,
				to: queryQueue[qi + 1],
				collected: targets.length,
				needed: displayCount,
			});
		} else {
			stopReason = 'fallback_exhausted';
		}
	}

	logDiscoveryTrace('discover_done', {
		engine: 'naver',
		returned: Math.min(targets.length, displayCount),
		requested: displayCount,
		scanned,
		stopReason,
		queriesUsed,
		globalPageCalls,
		skipStats,
	});

	return {
		targets: targets.slice(0, displayCount),
		query: primary,
		queriesUsed,
		scanned,
		stopReason,
		skipStats,
	};
}

function mergeTargetExtras(prev: DiscoveredTarget, next: DiscoveredTarget): DiscoveredTarget {
	return {
		...prev,
		phoneNumber: prev.phoneNumber || next.phoneNumber,
		address: prev.address || next.address,
		parsedAddress: prev.parsedAddress || next.parsedAddress,
		googleRating: prev.googleRating ?? next.googleRating,
		googleReviewCount: prev.googleReviewCount ?? next.googleReviewCount,
		source: prev.source === 'places' || next.source === 'places' ? prev.source || next.source : prev.source,
	};
}

/**
 * Merge discovery batches by hostname (URL-root), preserving first-seen order.
 * Used when Naver underfills and Google CSE / Places tops up.
 * Places extras (phone, rating) attach onto an earlier same-domain hit.
 */
export function mergeDiscoveredTargets(
	primary: DiscoveredTarget[],
	extra: DiscoveredTarget[],
	limit: number,
): DiscoveredTarget[] {
	const byHost = new Map<string, DiscoveredTarget>();
	const order: string[] = [];
	for (const item of [...primary, ...extra]) {
		const key = hostnameDedupeKey(item.url);
		if (!key) continue;
		const prev = byHost.get(key);
		if (!prev) {
			byHost.set(key, item);
			order.push(key);
			continue;
		}
		byHost.set(key, mergeTargetExtras(prev, item));
	}
	return order.slice(0, limit).map((key) => byHost.get(key)!);
}

/**
 * 조건 기반 타겟 자동 발굴 (해외·키 미설정 시 시드 폴백).
 */
export function discoverTargets(input: TargetDiscoveryInput): DiscoveredTarget[] {
	const seeds = SEED_BY_INDUSTRY[input.category];
	const industryLabel = CRAWL_INDUSTRY_LABELS[input.category];
	const kw = input.keyword.trim();
	const rSlug = regionSlug(input.region);
	const tld = TLD_BY_COUNTRY[input.country];
	const stamp = Date.now().toString(36);
	const crawledAt = new Date().toISOString();

	const results: DiscoveredTarget[] = [];
	for (let i = 0; i < input.limit; i += 1) {
		const seed = seeds[i % seeds.length];
		const seq = Math.floor(i / seeds.length) + 1;
		const suffix = seq > 1 ? `-${seq}` : '';
		const hostBase = kw ? `${slugify(kw)}-${seed.slug}` : seed.slug;
		const host = `${hostBase}-${rSlug}${suffix}.${tld}`;

		const siteName = [
			!isBroadRegion(input.region) ? input.region : '',
			kw || seed.name,
			kw ? industryLabel : '',
		]
			.filter(Boolean)
			.join(' ');

		results.push({
			id: `disc-${stamp}-${i}`,
			siteName: siteName || `${seed.name} ${industryLabel}`,
			url: `https://www.${host}/`,
			region: input.region,
			category: input.category,
			categoryLabel: industryLabel,
			country: input.country,
			crawledAt,
			source: 'seed',
		});
	}

	return results;
}
