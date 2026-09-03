export interface HashtagGenerationParams {
	brandName: string;
	region: string;
	coreFeatures?: string[];
	extractedKeywords?: string[];
	industry?: string;
	address?: string;
}

const MAX_TAGS = 10;
const MIN_TAG_LEN = 2;
const MAX_FEATURE_LEN = 12;

const SCHEMA_STOP_WORDS = new Set(
	[
		'Dermatology',
		'PlasticSurgery',
		'MedicalClinic',
		'MedicalBusiness',
		'MedicalWebPage',
		'Physician',
		'Hospital',
		'Dentist',
		'LocalBusiness',
		'Organization',
		'Person',
		'FAQPage',
		'HowTo',
		'Article',
		'WebSite',
		'WebPage',
		'Clinic',
		'Medical',
		'undefined',
		'null',
		'',
	].map((item) => item.toLowerCase()),
);

const GENERIC_TOKENS = new Set([
	'치료',
	'전문',
	'시술',
	'클리닉',
	'케어',
	'서비스',
	'병원',
	'의원',
	'센터',
	'피부',
	'성형',
]);

const INDUSTRY_RULES: Array<{ test: RegExp; suffix: string }> = [
	{ test: /dermatolog|피부과|피부시술|여드름|리프팅|레이저|흉터/i, suffix: '피부과' },
	{ test: /plastic|성형외과|성형/i, suffix: '성형외과' },
	{ test: /dentist|dental|치과/i, suffix: '치과' },
	{ test: /한의|oriental/i, suffix: '한의원' },
	{ test: /정형|재활|도수|통증/i, suffix: '정형외과' },
	{ test: /안과|ophthalm/i, suffix: '안과' },
	{ test: /이비인후|ent\b/i, suffix: '이비인후과' },
	{ test: /산부인|obgyn|gynecol/i, suffix: '산부인과' },
	{ test: /내과|internal\s*med/i, suffix: '내과' },
	{ test: /변호사|법률|로펌|legal|attorney/i, suffix: '변호사' },
	{ test: /미용실|헤어|헤어샵/i, suffix: '미용실' },
	{ test: /인테리어|리모델링/i, suffix: '인테리어' },
	{ test: /필라테스|피트니스|헬스/i, suffix: '필라테스' },
	{ test: /학원|교육/i, suffix: '학원' },
	{ test: /부동산|real\s*estate/i, suffix: '부동산' },
	{ test: /맛집|식당|레스토랑/i, suffix: '맛집' },
];

/**
 * 특정 업체의 시술/장비 상표명이 아닌, 업종 전반에서 흔히 쓰이는 일반 시술
 * 카테고리 키워드만 정규화한다. 여기에 특정 브랜드·업체의 장비명을 추가하지 말 것 —
 * 그 외 표현은 아래 `featureTokens`의 범용 토큰화(첫 단어/전체 문구) 경로가 처리한다.
 */
const FEATURE_ALIASES: Array<{ test: RegExp; tag: string }> = [
	{ test: /여드름\s*흉터/, tag: '여드름흉터' },
	{ test: /흉터/, tag: '흉터치료' },
	{ test: /리프팅/, tag: '리프팅' },
];

export function stripHashtagPrefix(value: string): string {
	return (value || '').replace(/^#/, '').replace(/\s+/g, '').trim();
}

export function hashtagKey(value: string): string {
	return stripHashtagPrefix(value).toLowerCase();
}

export function isSchemaOrStopwordToken(value: string): boolean {
	const compact = stripHashtagPrefix(value);
	if (!compact) return true;
	const lower = compact.toLowerCase();
	if (SCHEMA_STOP_WORDS.has(lower)) return true;
	if (GENERIC_TOKENS.has(compact)) return true;
	if (/^[A-Z][A-Za-z]+(?:[A-Z][A-Za-z]+)+$/.test(compact)) return true;
	if (/^[A-Za-z]+$/.test(compact) && SCHEMA_STOP_WORDS.has(lower)) return true;
	return false;
}

export function resolveIndustryHashtagSuffix(
	industry: string,
	brandName = '',
	features: string[] = [],
): string {
	const hay = `${industry} ${brandName} ${features.join(' ')}`;
	for (const rule of INDUSTRY_RULES) {
		if (rule.test.test(hay)) return rule.suffix;
	}

	const industryKo = compactToken(industry);
	if (industryKo && /[가-힣]/.test(industryKo) && industryKo.length <= 8 && !isSchemaOrStopwordToken(industryKo)) {
		return industryKo;
	}

	if (/피부과$/.test(brandName)) return '피부과';
	if (/치과$/.test(brandName)) return '치과';
	if (/한의원$/.test(brandName)) return '한의원';
	if (/병원$/.test(brandName)) return '병원';
	if (/의원$/.test(brandName)) return '의원';
	return '';
}

export function toKoreanIndustryLabel(industry: string, brandName = '', features: string[] = []): string {
	const compact = (industry || '').trim();
	if (compact && /[가-힣]/.test(compact) && !isSchemaOrStopwordToken(compact)) return compact;
	return resolveIndustryHashtagSuffix(compact, brandName, features) || compact;
}

export function normalizeHashtagList(values: string[], withHash = true): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const tag = stripHashtagPrefix(raw);
		if (tag.length < MIN_TAG_LEN) continue;
		if (isSchemaOrStopwordToken(tag)) continue;
		const key = hashtagKey(tag);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(withHash ? `#${tag}` : tag);
		if (out.length >= MAX_TAGS) break;
	}
	return out;
}

function compactToken(value: string): string {
	return (value || '').replace(/[^\w가-힣]/g, '').trim();
}

function shortenAdminUnit(token: string): string {
	return token
		.replace(/특별자치시$/, '')
		.replace(/광역시$/, '')
		.replace(/특별시$/, '')
		.replace(/특별자치도$/, '')
		.replace(/광역도$/, '');
}

function parseRegionParts(region: string, address = ''): { city: string; district: string; neighborhood: string } {
	const tokens = (region || '')
		.split(/\s+/)
		.map((part) => shortenAdminUnit(part.trim()))
		.filter(Boolean);

	const city = tokens[0] || '';
	const district = tokens.slice(1).join('') || '';

	const hay = `${region} ${address}`;
	const neighborhoodMatch = hay.match(/([가-힣]{1,6}(?:동|읍|면|가))/);
	const neighborhood = neighborhoodMatch?.[1] || '';
	const skipNeighborhood =
		!neighborhood ||
		neighborhood === city ||
		neighborhood === district ||
		district.includes(neighborhood) ||
		/광역시|특별시|자치시/.test(neighborhood);

	return {
		city,
		district,
		neighborhood: skipNeighborhood ? '' : neighborhood,
	};
}

function featureTokens(feature: string): string[] {
	const raw = (feature || '').trim();
	if (!raw) return [];

	const tokens: string[] = [];
	for (const alias of FEATURE_ALIASES) {
		if (alias.test.test(raw)) tokens.push(alias.tag);
	}

	if (tokens.length === 0) {
		const firstWord = raw.split(/[\s·,/|+]+/).find((part) => compactToken(part).length >= MIN_TAG_LEN);
		if (firstWord) {
			const head = compactToken(firstWord);
			if (head && !GENERIC_TOKENS.has(head) && !isSchemaOrStopwordToken(head)) tokens.push(head);
		}
	}

	const full = compactToken(raw);
	if (
		full &&
		full.length >= MIN_TAG_LEN &&
		full.length <= MAX_FEATURE_LEN &&
		!GENERIC_TOKENS.has(full) &&
		!isSchemaOrStopwordToken(full)
	) {
		tokens.push(full);
	}

	return normalizeHashtagList(tokens, false);
}

function procedureHubTag(city: string, suffix: string): string | null {
	if (!city || !suffix) return null;
	if (suffix === '피부과') return `${city}피부시술`;
	if (suffix === '성형외과') return `${city}성형시술`;
	if (suffix.endsWith('과')) return `${city}${suffix.slice(0, -1)}시술`;
	return null;
}

function pushUnique(target: string[], seen: Set<string>, value: string) {
	const tag = stripHashtagPrefix(value);
	if (tag.length < MIN_TAG_LEN || isSchemaOrStopwordToken(tag)) return;
	const key = hashtagKey(tag);
	if (seen.has(key)) return;
	seen.add(key);
	target.push(tag);
}

export function generateSmartHashtags(params: HashtagGenerationParams): string[] {
	const {
		brandName,
		region,
		coreFeatures = [],
		extractedKeywords = [],
		industry = '',
		address = '',
	} = params;

	const brand = stripHashtagPrefix(brandName);
	const { city, district, neighborhood } = parseRegionParts(region, address);
	const suffix = resolveIndustryHashtagSuffix(industry, brand, [...coreFeatures, ...extractedKeywords]);
	const seen = new Set<string>();
	const rawTags: string[] = [];

	if (brand) pushUnique(rawTags, seen, brand);

	if (city && suffix) {
		pushUnique(rawTags, seen, `${city}${suffix}`);
		if (district) pushUnique(rawTags, seen, `${city}${district}${suffix}`);
		if (neighborhood) pushUnique(rawTags, seen, `${city}${neighborhood}${suffix}`);
	}

	const cityFeatureTags: string[] = [];
	const standaloneTags: string[] = [];
	for (const feature of coreFeatures) {
		for (const token of featureTokens(feature)) {
			if (city) cityFeatureTags.push(`${city}${token}`);
			if (!/(?:치료|시술)$/.test(token)) standaloneTags.push(token);
		}
	}
	for (const tag of cityFeatureTags) {
		pushUnique(rawTags, seen, tag);
		if (rawTags.length >= MAX_TAGS) break;
	}
	for (const tag of standaloneTags) {
		pushUnique(rawTags, seen, tag);
		if (rawTags.length >= MAX_TAGS) break;
	}

	const hub = procedureHubTag(city, suffix);
	if (hub) pushUnique(rawTags, seen, hub);

	for (const keyword of extractedKeywords.slice(0, 6)) {
		const clean = compactToken(keyword);
		if (!clean || clean.length < MIN_TAG_LEN) continue;
		if (brand && hashtagKey(clean) === hashtagKey(brand)) continue;
		pushUnique(rawTags, seen, clean);
		if (rawTags.length >= MAX_TAGS) break;
	}

	return rawTags.slice(0, MAX_TAGS).map((tag) => `#${tag}`);
}
