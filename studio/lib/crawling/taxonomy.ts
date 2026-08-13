/**
 * 크롤링 수집 분류 체계 (국가 / 지역 / 업종 / 수집 목적)
 * 해외 사이트 수집 확장을 위해 Country 코드를 고정 유니온으로 유지합니다.
 */

export const CRAWL_COUNTRY_CODES = ['KR', 'US', 'JP', 'GLOBAL'] as const;
export type CrawlCountryCode = (typeof CRAWL_COUNTRY_CODES)[number];

export const CRAWL_COUNTRY_OPTIONS: {
	value: CrawlCountryCode;
	label: string;
	flag: string;
}[] = [
	{ value: 'KR', label: '대한민국 (KR)', flag: '🇰🇷' },
	{ value: 'US', label: '미국', flag: '🇺🇸' },
	{ value: 'JP', label: '일본', flag: '🇯🇵' },
	{ value: 'GLOBAL', label: '기타/해외', flag: '🌐' },
];

export const CRAWL_REGION_BY_COUNTRY: Record<CrawlCountryCode, string[]> = {
	KR: ['전국', '서울', '부산', '경기', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'],
	US: ['Nationwide', 'California', 'New York', 'Texas', 'Washington', 'Other'],
	JP: ['全国', '東京都', '大阪府', '神奈川県', '愛知県', '福岡県', 'Other'],
	GLOBAL: ['전체', '기타'],
};

export const CRAWL_INDUSTRY_CODES = [
	'MEDICAL_CLINIC',
	'LODGING_TRAVEL',
	'PROFESSIONAL_LEGAL',
	'MANUFACTURING_B2B',
	'COMMERCE',
	'EDUCATION_WEDDING',
	'OTHER',
] as const;
export type CrawlIndustryCode = (typeof CRAWL_INDUSTRY_CODES)[number];

export const CRAWL_INDUSTRY_LABELS: Record<CrawlIndustryCode, string> = {
	MEDICAL_CLINIC: '의료/클리닉',
	LODGING_TRAVEL: '숙박/여행',
	PROFESSIONAL_LEGAL: '전문직/법률',
	MANUFACTURING_B2B: '제조/B2B',
	COMMERCE: '쇼핑몰/커머스',
	EDUCATION_WEDDING: '교육/웨딩',
	OTHER: '기타',
};

export const CRAWL_TARGET_TAG_CODES = [
	'NEW_PROSPECT',
	'EXISTING_CLIENT',
	'COMPETITOR',
] as const;
export type CrawlTargetTagCode = (typeof CRAWL_TARGET_TAG_CODES)[number];

export const CRAWL_TARGET_TAG_LABELS: Record<CrawlTargetTagCode, string> = {
	NEW_PROSPECT: '신규 영업 대상',
	EXISTING_CLIENT: '기존 고객사',
	COMPETITOR: '경쟁사 분석',
};

export const DEFAULT_CRAWL_COUNTRY: CrawlCountryCode = 'KR';
export const DEFAULT_CRAWL_REGION = '전국';
export const DEFAULT_CRAWL_INDUSTRY: CrawlIndustryCode = 'OTHER';
export const DEFAULT_CRAWL_TARGET_TAG: CrawlTargetTagCode = 'NEW_PROSPECT';

/** 설정 폼 / 리스트 필터 공유용 localStorage 키 */
export const CRAWL_TAXONOMY_STORAGE_KEY = 'admin.crawling.taxonomyDefaults';

export type CrawlTaxonomySelection = {
	country: CrawlCountryCode;
	region: string;
	category: CrawlIndustryCode;
	targetTag: CrawlTargetTagCode;
};

export function getCountryOption(code: CrawlCountryCode) {
	return CRAWL_COUNTRY_OPTIONS.find((o) => o.value === code) ?? CRAWL_COUNTRY_OPTIONS[0];
}

export function formatCountryRegionBadge(
	country: CrawlCountryCode,
	region?: string | null,
): string {
	const { flag } = getCountryOption(country);
	const regionLabel = region?.trim();
	if (!regionLabel || regionLabel === '전국' || regionLabel === 'Nationwide' || regionLabel === '全国' || regionLabel === '전체') {
		return `${flag} ${getCountryOption(country).label.replace(' (KR)', '').replace(' (기본)', '')}`;
	}
	return `${flag} ${regionLabel}`;
}

export function getIndustryLabel(code: string | null | undefined): string {
	if (!code) return CRAWL_INDUSTRY_LABELS.OTHER;
	if (code in CRAWL_INDUSTRY_LABELS) {
		return CRAWL_INDUSTRY_LABELS[code as CrawlIndustryCode];
	}
	return code;
}

export function getTargetTagLabel(code: string | null | undefined): string {
	if (!code) return '';
	if (code in CRAWL_TARGET_TAG_LABELS) {
		return CRAWL_TARGET_TAG_LABELS[code as CrawlTargetTagCode];
	}
	return code;
}

export function regionsForCountry(country: CrawlCountryCode): string[] {
	return CRAWL_REGION_BY_COUNTRY[country] ?? CRAWL_REGION_BY_COUNTRY.GLOBAL;
}

export function normalizeRegionForCountry(
	country: CrawlCountryCode,
	region: string | null | undefined,
): string {
	const list = regionsForCountry(country);
	if (region && list.includes(region)) return region;
	return list[0] ?? DEFAULT_CRAWL_REGION;
}

export function loadTaxonomyDefaults(): CrawlTaxonomySelection {
	const fallback: CrawlTaxonomySelection = {
		country: DEFAULT_CRAWL_COUNTRY,
		region: DEFAULT_CRAWL_REGION,
		category: DEFAULT_CRAWL_INDUSTRY,
		targetTag: DEFAULT_CRAWL_TARGET_TAG,
	};
	if (typeof window === 'undefined') return fallback;
	try {
		const raw = window.localStorage.getItem(CRAWL_TAXONOMY_STORAGE_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw) as Partial<CrawlTaxonomySelection>;
		const country = CRAWL_COUNTRY_CODES.includes(parsed.country as CrawlCountryCode)
			? (parsed.country as CrawlCountryCode)
			: DEFAULT_CRAWL_COUNTRY;
		const category = CRAWL_INDUSTRY_CODES.includes(parsed.category as CrawlIndustryCode)
			? (parsed.category as CrawlIndustryCode)
			: DEFAULT_CRAWL_INDUSTRY;
		const targetTag = CRAWL_TARGET_TAG_CODES.includes(parsed.targetTag as CrawlTargetTagCode)
			? (parsed.targetTag as CrawlTargetTagCode)
			: DEFAULT_CRAWL_TARGET_TAG;
		return {
			country,
			region: normalizeRegionForCountry(country, parsed.region),
			category,
			targetTag,
		};
	} catch {
		return fallback;
	}
}

export function saveTaxonomyDefaults(selection: CrawlTaxonomySelection) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(CRAWL_TAXONOMY_STORAGE_KEY, JSON.stringify(selection));
	} catch {
		/* ignore */
	}
}
