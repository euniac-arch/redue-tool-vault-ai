import {
	classifyIndustry,
	type IndustryType,
} from '@/lib/registry/universalIndustryRegistry';
import type {
	IndustryMatch,
	IndustryRelevance,
	NormalizedKeyword,
	SearchIntentId,
	StrategyIndustryProfileRef,
	StrategyLang,
} from '@/lib/strategy/types';

/** Metro / province tokens — shared GEO vocabulary, not a site-specific list. */
const METRO_TOKENS = [
	'서울',
	'부산',
	'대구',
	'인천',
	'광주',
	'대전',
	'울산',
	'세종',
	'경기',
	'강원',
	'충북',
	'충남',
	'전북',
	'전남',
	'경북',
	'경남',
	'제주',
	'seoul',
	'busan',
	'daegu',
	'incheon',
] as const;

/** District / neighborhood tokens. Ambiguous 구 names stay districts, not cities. */
const DISTRICT_TOKENS = [
	'동구',
	'서구',
	'남구',
	'북구',
	'중구',
	'수성구',
	'달서구',
	'달성군',
	'강남구',
	'서초구',
	'송파구',
	'마포구',
	'해운대구',
	'수성',
	'달서',
	'달성',
	'강남',
	'서초',
	'송파',
	'해운대',
	'수성동',
] as const;

/**
 * Category nouns keyed by registry vertical.
 * This is profile lexicon, not `if (dermatology)` — leftover tokens become Service.
 */
export const INDUSTRY_CATEGORY_NOUNS: Record<Exclude<IndustryType, 'general'>, readonly string[]> = {
	medical: [
		'성형외과',
		'정형외과',
		'산부인과',
		'이비인후과',
		'재활의학과',
		'통증의학과',
		'피부과',
		'소아과',
		'한의원',
		'치과',
		'내과',
		'안과',
		'한방',
		'병원',
		'의원',
		'클리닉',
		'의료기관',
		'hospital',
		'clinic',
		'dermatology',
	],
	legal: ['법률사무소', '법무법인', '변호사', '로펌', '법무사', 'attorney', 'lawyer'],
	accounting: ['세무사무소', '회계사무소', '세무사', '회계사', '세무', '회계', 'cpa'],
	beauty: ['피부관리실', '미용실', '헤어샵', '네일샵', '에스테틱', 'salon'],
	interior: ['인테리어', '리모델링', '시공'],
	fitness: ['헬스클럽', '필라테스', '피트니스', '헬스장', '요가원', 'gym'],
	veterinary: ['동물병원', '수의사', '펫케어'],
	education: ['입시학원', '보습학원', '학원', '과외'],
	realestate: ['공인중개사', '부동산중개', '부동산'],
	restaurant: ['레스토랑', '맛집', '식당', '외식', '카페', 'restaurant'],
	professional: ['컨설팅', '에이전시', '연구소', 'saas'],
};

const PROBLEM_ACTIONS = [
	'치료',
	'고민',
	'해결',
	'증상',
	'통증',
	'개선',
	'완화',
	'비용',
	'후기',
	'treatment',
	'pain',
	'scar',
	'fix',
] as const;

const INTENT_MARKERS: Array<{ id: SearchIntentId; label: string; pattern: RegExp }> = [
	{
		id: 'aiRecommendation',
		label: 'ai',
		pattern: /추천해(?:줘|주세요)?|알려줘|어떤\s*게\s*좋|ai\s*추천|챗\s*gpt|chatgpt|제미니|gemini|퍼플렉시티|perplexity/i,
	},
	{
		id: 'recommendation',
		label: 'recommend',
		pattern: /추천|잘하는|베스트|best|recommend/i,
	},
	{
		id: 'comparison',
		label: 'compare',
		pattern: /비교|versus|\bvs\b|어디가\s*더|차이/i,
	},
	{
		id: 'list',
		label: 'list',
		pattern: /순위|리스트|모음|top\s*\d|베스트\s*\d|\d+\s*곳/i,
	},
	{
		id: 'naturalLanguage',
		label: 'nl',
		pattern: /어떻게|무엇을|뭐가|어떤|할까요|좋은지|해야\s*하|고르/i,
	},
];

const STOP_MARKERS = [
	...PROBLEM_ACTIONS,
	'추천해줘',
	'알려줘',
	'추천',
	'잘하는',
	'베스트',
	'비교',
	'순위',
	'리스트',
	'모음',
	'어떻게',
	'무엇을',
	'뭐가',
	'어떤',
	'vs',
	'best',
	'recommend',
] as const;

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function squeeze(value: string): string {
	return value.replace(/\s+/g, '');
}

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = compact(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

function consumeLongest(source: string, dictionary: readonly string[]): { hits: string[]; rest: string } {
	let rest = source;
	const hits: string[] = [];
	const sorted = [...dictionary].sort((a, b) => b.length - a.length);
	let changed = true;
	while (changed && rest) {
		changed = false;
		for (const token of sorted) {
			const idx = rest.toLowerCase().indexOf(token.toLowerCase());
			if (idx === -1) continue;
			hits.push(rest.slice(idx, idx + token.length));
			rest = rest.slice(0, idx) + rest.slice(idx + token.length);
			changed = true;
			break;
		}
	}
	return { hits, rest };
}

function allCategoryNouns(): string[] {
	return unique(Object.values(INDUSTRY_CATEGORY_NOUNS).flat());
}

function verticalForNoun(noun: string): IndustryType | null {
	const key = noun.toLowerCase();
	for (const [type, nouns] of Object.entries(INDUSTRY_CATEGORY_NOUNS) as Array<
		[Exclude<IndustryType, 'general'>, readonly string[]]
	>) {
		if (nouns.some((item) => item.toLowerCase() === key)) return type;
	}
	return null;
}

function isMetro(token: string): boolean {
	return METRO_TOKENS.some((item) => item.toLowerCase() === token.toLowerCase());
}

function isDistrict(token: string): boolean {
	if (isMetro(token)) return false;
	return DISTRICT_TOKENS.some((item) => item.toLowerCase() === token.toLowerCase()) || /[가-힣]{1,4}(구|군)$/.test(token);
}

export function normalizeKeyword(raw: string): NormalizedKeyword {
	const query = compact(raw);
	const packed = squeeze(query);
	const locationDict = [...METRO_TOKENS, ...DISTRICT_TOKENS];
	const locPass = consumeLongest(packed, locationDict);
	const catPass = consumeLongest(locPass.rest, allCategoryNouns());
	const markerPass = consumeLongest(catPass.rest, STOP_MARKERS);

	const industryNoun = catPass.hits[0] || null;
	const classified = classifyIndustry(query);
	const industryType = industryNoun
		? verticalForNoun(industryNoun)
		: classified.type !== 'general'
			? classified.type
			: null;

	const leftoverPacked = markerPass.rest;
	const leftoverSpaced = query
		.split(/\s+/)
		.filter((token) => {
			const t = token.toLowerCase();
			if (locationDict.some((loc) => loc.toLowerCase() === t)) return false;
			if (allCategoryNouns().some((noun) => noun.toLowerCase() === t)) return false;
			if (STOP_MARKERS.some((mark) => mark.toLowerCase() === t)) return false;
			return Boolean(t);
		});

	const leftover = leftoverSpaced.length ? leftoverSpaced.join(' ') : leftoverPacked;
	const hasProblemAction = PROBLEM_ACTIONS.some((action) => packed.toLowerCase().includes(action.toLowerCase()));
	const problem = hasProblemAction && leftover ? leftover : null;
	const service = !problem && leftover ? leftover : null;

	const intentMarkers = unique(
		INTENT_MARKERS.filter((marker) => marker.pattern.test(query)).map((marker) => marker.label),
	);

	return {
		raw: query,
		location: unique(locPass.hits),
		industry: industryNoun,
		industryType,
		service,
		problem,
		intentMarkers,
	};
}

export function detectIntentsFromNormalized(parsed: NormalizedKeyword): SearchIntentId[] {
	const intents: SearchIntentId[] = [];
	if (parsed.location.length) intents.push('local');
	if (parsed.industry && !parsed.service) intents.push('category');
	if (parsed.service) intents.push('service');
	if (parsed.problem) intents.push('problem');
	for (const marker of INTENT_MARKERS) {
		if (marker.pattern.test(parsed.raw) && !intents.includes(marker.id)) {
			intents.push(marker.id);
		}
	}
	return intents;
}

export function hasDistrictLocation(parsed: NormalizedKeyword): boolean {
	return parsed.location.some((token) => isDistrict(token));
}

export function locationLabel(parsed: NormalizedKeyword): string {
	return parsed.location.join(' ');
}

export function focusPhrase(parsed: NormalizedKeyword): string {
	return parsed.problem || parsed.service || parsed.industry || parsed.raw;
}

export function matchIndustry(
	parsed: NormalizedKeyword,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): IndustryMatch {
	const auditType = profile.registryType;
	const keywordType = parsed.industryType;
	const specialtyHit = profile.specialties.some((item) => {
		const phrase = compact(item);
		if (!phrase) return false;
		return squeeze(parsed.raw).includes(squeeze(phrase)) || Boolean(parsed.industry && squeeze(parsed.industry) === squeeze(phrase));
	});

	let relevance: IndustryRelevance = 'medium';
	let note =
		lang === 'en'
			? 'The query does not name a conflicting industry. Relatedness stays medium until a category noun appears.'
			: '키워드에 상충하는 업종 명사가 없어 관련성을 중간으로 둡니다.';

	if (specialtyHit || (keywordType && keywordType === auditType && keywordType !== 'general')) {
		relevance = 'high';
		note =
			lang === 'en'
				? 'The query’s category matches the audit industry profile.'
				: '검색어의 업종 신호가 진단 업종 프로필과 맞습니다.';
	} else if (keywordType && keywordType !== 'general' && keywordType !== auditType) {
		relevance = 'low';
		note =
			lang === 'en'
				? `The query leans ${keywordType}, while this audit is ${auditType}. Strategy may not apply cleanly.`
				: `검색어는 ${keywordType} 신호이고 진단 업종은 ${auditType}입니다. 전략 적용 전에 공략 키워드를 확인하세요.`;
	} else if (parsed.service || parsed.problem) {
		relevance = 'medium';
		note =
			lang === 'en'
				? 'The leftover token is treated as a service or problem, not a new industry.'
				: '남은 토큰은 새 업종이 아니라 서비스 또는 문제로 해석합니다.';
	}

	return {
		auditType,
		keywordType,
		relevance,
		note,
	};
}
