/**
 * Strategy Studio recommended-keyword chips.
 *
 * Builds what people actually type — not admin-noun concatenations
 * such as "대구 동구 피부시술" / "대구 동구 치료 솔루션".
 *
 * Three complementary groups, balanced from audit location + specialty:
 *   1. metro procedure  [광역] [핵심시술]
 *   2. AEO recommend    [광역] [핵심시술] 잘하는 곳 / [광역] [진료과목] 추천
 *   3. local hub        [광역 구] [진료과목] / [주요역] [진료과목]
 */

import { parseQueryLocation } from '@/lib/geo/query-location';
import { extractIndustrySearchNoun } from '@/lib/geo/search-query-normalize';
import { INDUSTRY_CATEGORY_NOUNS } from '@/lib/strategy/normalize-keyword';
import type {
	StrategyAuditContext,
	StrategyIndustryProfileRef,
	StrategyLang,
} from '@/lib/strategy/types';

export type RecommendedKeywordGroupId = 'metro' | 'aeo' | 'local';

export interface RecommendedKeywordChip {
	phrase: string;
	group: RecommendedKeywordGroupId;
}

export interface RecommendedKeywordGroups {
	metro: string[];
	aeo: string[];
	local: string[];
	/** Alias of `metro` — 광역/핵심 시술·품목 1순위 풀. */
	broad: string[];
	/** Alias of `aeo` — 추천·질문형 1순위 풀. */
	recommended: string[];
	all: string[];
	chips: RecommendedKeywordChip[];
}

type SpecialtyCluster =
	| 'derm'
	| 'dental'
	| 'plastic'
	| 'pain'
	| 'rehab'
	| 'vet'
	| 'cancer'
	| 'ent'
	| 'eye'
	| 'obgyn'
	| 'internal'
	| 'oriental'
	| 'legal'
	| 'tax'
	| 'beauty'
	| 'interior'
	| 'fitness'
	| 'education'
	| 'realestate'
	| 'restaurant'
	| 'agency'
	| 'general';

type Localized = { ko: string; en: string };

/** Nouns that look like services in admin copy but have no real search demand. */
const LOW_SEARCH_NOUNS = new Set([
	'피부시술',
	'치료 솔루션',
	'솔루션',
	'전문 서비스',
	'서비스',
	'진료',
	'시술',
	'치료',
	'의료기관',
	'일반 비즈니스',
	'맞춤 진료',
	'진료 안내',
	'치료 안내',
	'skin treatment',
	'medical care',
	'professional service',
	'service',
	'services',
	'treatment solution',
	'medical institution',
	'local business',
]);

const DEPARTMENT: Record<SpecialtyCluster, Localized> = {
	derm: { ko: '피부과', en: 'dermatology' },
	dental: { ko: '치과', en: 'dental clinic' },
	plastic: { ko: '성형외과', en: 'plastic surgery' },
	pain: { ko: '통증클리닉', en: 'pain clinic' },
	rehab: { ko: '정형외과', en: 'orthopedics' },
	vet: { ko: '동물병원', en: 'animal hospital' },
	cancer: { ko: '암병원', en: 'cancer clinic' },
	ent: { ko: '이비인후과', en: 'ENT clinic' },
	eye: { ko: '안과', en: 'eye clinic' },
	obgyn: { ko: '산부인과', en: 'OB/GYN' },
	internal: { ko: '내과', en: 'internal medicine' },
	oriental: { ko: '한의원', en: 'Korean medicine clinic' },
	legal: { ko: '변호사', en: 'law firm' },
	tax: { ko: '세무사', en: 'tax office' },
	beauty: { ko: '미용실', en: 'hair salon' },
	interior: { ko: '인테리어', en: 'interior' },
	fitness: { ko: '필라테스', en: 'pilates' },
	education: { ko: '학원', en: 'academy' },
	realestate: { ko: '부동산', en: 'real estate' },
	restaurant: { ko: '맛집', en: 'restaurant' },
	agency: { ko: '에이전시', en: 'agency' },
	general: { ko: '의원', en: 'clinic' },
};

/**
 * High-intent heads people type after a city name.
 * Sourced from colloquial Naver/Google local + AEO query patterns, not CMS labels.
 */
const HIGH_INTENT_PROCEDURES: Record<SpecialtyCluster, Localized[]> = {
	derm: [
		{ ko: '흉터 치료', en: 'scar treatment' },
		{ ko: '여드름 흉터', en: 'acne scars' },
		{ ko: '리프팅', en: 'lifting' },
		{ ko: '튼살 치료', en: 'stretch mark treatment' },
	],
	dental: [
		{ ko: '임플란트', en: 'implants' },
		{ ko: '치아교정', en: 'braces' },
		{ ko: '사랑니', en: 'wisdom tooth' },
		{ ko: '스케일링', en: 'scaling' },
	],
	plastic: [
		{ ko: '쌍꺼풀', en: 'double eyelid' },
		{ ko: '코성형', en: 'rhinoplasty' },
		{ ko: '윤곽', en: 'facial contour' },
		{ ko: '지방흡입', en: 'liposuction' },
	],
	pain: [
		{ ko: '디스크 치료', en: 'disc treatment' },
		{ ko: '도수치료', en: 'manual therapy' },
		{ ko: '관절 통증', en: 'joint pain' },
		{ ko: '신경차단술', en: 'nerve block' },
	],
	rehab: [
		{ ko: '도수치료', en: 'manual therapy' },
		{ ko: '재활치료', en: 'rehab therapy' },
		{ ko: '체형교정', en: 'posture correction' },
		{ ko: '스포츠재활', en: 'sports rehab' },
	],
	vet: [
		{ ko: '슬개골 탈구 수술', en: 'patella surgery' },
		{ ko: '중성화', en: 'spay and neuter' },
		{ ko: '예방접종', en: 'vaccination' },
		{ ko: '건강검진', en: 'checkup' },
	],
	cancer: [
		{ ko: '암 치료', en: 'cancer treatment' },
		{ ko: '항암 치료', en: 'chemotherapy' },
		{ ko: '암 검진', en: 'cancer screening' },
		{ ko: '중입자치료', en: 'carbon-ion therapy' },
	],
	ent: [
		{ ko: '비염 치료', en: 'rhinitis treatment' },
		{ ko: '코골이', en: 'snoring' },
		{ ko: '이명', en: 'tinnitus' },
		{ ko: '축농증', en: 'sinusitis' },
	],
	eye: [
		{ ko: '라식', en: 'LASIK' },
		{ ko: '노안', en: 'presbyopia' },
		{ ko: '백내장', en: 'cataract' },
		{ ko: '시력교정', en: 'vision correction' },
	],
	obgyn: [
		{ ko: '산전검사', en: 'prenatal screening' },
		{ ko: '난임', en: 'fertility' },
		{ ko: '피임', en: 'contraception' },
		{ ko: '자궁근종', en: 'fibroids' },
	],
	internal: [
		{ ko: '건강검진', en: 'checkup' },
		{ ko: '당뇨', en: 'diabetes' },
		{ ko: '고혈압', en: 'hypertension' },
		{ ko: '소화기', en: 'gastroenterology' },
	],
	oriental: [
		{ ko: '추나', en: 'Chuna therapy' },
		{ ko: '다이어트 한약', en: 'herbal diet' },
		{ ko: '디스크', en: 'disc treatment' },
		{ ko: '교통사고 후유증', en: 'accident aftercare' },
	],
	legal: [
		{ ko: '형사전문', en: 'criminal law' },
		{ ko: '이혼', en: 'divorce' },
		{ ko: '상속', en: 'inheritance' },
		{ ko: '형사 고소', en: 'criminal complaint' },
	],
	tax: [
		{ ko: '종합소득세', en: 'income tax' },
		{ ko: '기장', en: 'bookkeeping' },
		{ ko: '부가세', en: 'VAT' },
		{ ko: '세무조사', en: 'tax audit' },
	],
	beauty: [
		{ ko: '펌', en: 'perm' },
		{ ko: '염색', en: 'hair color' },
		{ ko: '컷', en: 'haircut' },
		{ ko: '클리닉', en: 'hair clinic' },
	],
	interior: [
		{ ko: '아파트 인테리어', en: 'apartment remodel' },
		{ ko: '부분 시공', en: 'partial remodel' },
		{ ko: '상업 인테리어', en: 'commercial interior' },
		{ ko: '리모델링', en: 'remodeling' },
	],
	fitness: [
		{ ko: 'PT', en: 'personal training' },
		{ ko: '필라테스', en: 'pilates' },
		{ ko: '다이어트', en: 'weight loss' },
		{ ko: '체형교정', en: 'posture correction' },
	],
	education: [
		{ ko: '입시', en: 'exam prep' },
		{ ko: '수학', en: 'math tutoring' },
		{ ko: '영어', en: 'English tutoring' },
		{ ko: '과외', en: 'tutoring' },
	],
	realestate: [
		{ ko: '전세', en: 'jeonse' },
		{ ko: '매매', en: 'sale' },
		{ ko: '월세', en: 'monthly rent' },
		{ ko: '아파트', en: 'apartment' },
	],
	restaurant: [
		{ ko: '맛집', en: 'restaurant' },
		{ ko: '점심', en: 'lunch' },
		{ ko: '회식', en: 'group dining' },
		{ ko: '예약', en: 'reservation' },
	],
	agency: [
		{ ko: '도매 납품', en: 'wholesale supply' },
		{ ko: '행사 기획', en: 'event planning' },
		{ ko: '섭외', en: 'talent booking' },
		{ ko: '행사 대행', en: 'event agency' },
	],
	general: [
		{ ko: '상담', en: 'consultation' },
		{ ko: '예약', en: 'booking' },
	],
};

/** Clusters that append the department noun to the metro head (e.g. 형사전문 + 변호사). */
const APPEND_DEPARTMENT: ReadonlySet<SpecialtyCluster> = new Set(['legal']);

/** Major transit hubs people type instead of a district name. Never invent landmarks. */
const SEARCH_HUBS: Array<{ metro: string; district: RegExp; hub: Localized }> = [
	{ metro: '대구', district: /동구/, hub: { ko: '동대구역', en: 'Dongdaegu Station' } },
	{ metro: '대구', district: /중구/, hub: { ko: '대구역', en: 'Daegu Station' } },
	{ metro: '대구', district: /수성/, hub: { ko: '범어역', en: 'Beomeo Station' } },
	{ metro: '서울', district: /강남/, hub: { ko: '강남역', en: 'Gangnam Station' } },
	{ metro: '서울', district: /서초/, hub: { ko: '강남역', en: 'Gangnam Station' } },
	{ metro: '서울', district: /송파/, hub: { ko: '잠실역', en: 'Jamsil Station' } },
	{ metro: '서울', district: /마포/, hub: { ko: '홍대입구역', en: 'Hongdae Station' } },
	{ metro: '서울', district: /종로/, hub: { ko: '종각역', en: 'Jonggak Station' } },
	{ metro: '서울', district: /영등포|여의도/, hub: { ko: '여의도역', en: 'Yeouido Station' } },
	{ metro: '서울', district: /용산/, hub: { ko: '용산역', en: 'Yongsan Station' } },
	{ metro: '부산', district: /해운대/, hub: { ko: '해운대역', en: 'Haeundae Station' } },
	{ metro: '부산', district: /부산진|서면/, hub: { ko: '서면역', en: 'Seomyeon Station' } },
	{ metro: '부산', district: /동래/, hub: { ko: '동래역', en: 'Dongnae Station' } },
	{ metro: '부산', district: /수영|광안/, hub: { ko: '광안역', en: 'Gwangan Station' } },
	{ metro: '인천', district: /연수|송도/, hub: { ko: '송도역', en: 'Songdo Station' } },
	{ metro: '경기', district: /분당|정자/, hub: { ko: '정자역', en: 'Jeongja Station' } },
	{ metro: '경기', district: /일산/, hub: { ko: '정발산역', en: 'Jeongbalsan Station' } },
];

const METRO_EN: Record<string, string> = {
	서울: 'Seoul',
	부산: 'Busan',
	대구: 'Daegu',
	인천: 'Incheon',
	광주: 'Gwangju',
	대전: 'Daejeon',
	울산: 'Ulsan',
	세종: 'Sejong',
	경기: 'Gyeonggi',
	강원: 'Gangwon',
	충북: 'Chungbuk',
	충남: 'Chungnam',
	전북: 'Jeonbuk',
	전남: 'Jeonnam',
	경북: 'Gyeongbuk',
	경남: 'Gyeongnam',
	제주: 'Jeju',
};

const DERM_DEPT = /피부과|피부시술|dermatolog|skin\s*clinic/i;
const PLASTIC_DEPT = /성형외과|plastic\s*surg/i;
const DERM_PROC = /여드름|흉터|튼살|리프팅|보톡스|필러|acne|scar|lifting|botox/i;
const PLASTIC_PROC = /쌍꺼풀|코성형|윤곽|지방흡입|rhinoplast|blepharoplast|liposuction/i;

const CLUSTER_RULES: Array<{ test: RegExp; cluster: SpecialtyCluster }> = [
	{ test: /슬개골|동물병원|수의사|veterinary|pet\s*hospital/i, cluster: 'vet' },
	{ test: /중입자|암치료|암센터|oncolog|cancer/i, cluster: 'cancer' },
	{ test: /임플란트|치아교정|치과|dentist|dental|orthodont/i, cluster: 'dental' },
	{ test: DERM_DEPT, cluster: 'derm' },
	{ test: PLASTIC_DEPT, cluster: 'plastic' },
	{ test: DERM_PROC, cluster: 'derm' },
	{ test: PLASTIC_PROC, cluster: 'plastic' },
	{ test: /도수치료|정형|통증|디스크|관절|ortho|pain|manual\s*therap/i, cluster: 'pain' },
	{ test: /재활|스포츠재활|체형교정|rehab/i, cluster: 'rehab' },
	{ test: /이비인후|비염|축농증|ent\s*clinic/i, cluster: 'ent' },
	{ test: /안과|라식|백내장|ophthalm/i, cluster: 'eye' },
	{ test: /산부인|난임|obstetric|gynecol/i, cluster: 'obgyn' },
	{ test: /한의원|추나|oriental\s*medicine/i, cluster: 'oriental' },
	{ test: /내과|건강검진|당뇨|고혈압|internal\s*medicine/i, cluster: 'internal' },
	{ test: /법률|변호사|이혼|상속|attorney|law\s*firm/i, cluster: 'legal' },
	{ test: /세무|회계|기장|부가세|\bcpa\b|tax\s*office/i, cluster: 'tax' },
	{ test: /미용실|헤어|펌|염색|salon|haircut/i, cluster: 'beauty' },
	{ test: /인테리어|리모델링|시공|interior/i, cluster: 'interior' },
	{ test: /필라테스|헬스|피트니스|pt\b|pilates|gym/i, cluster: 'fitness' },
	{ test: /학원|입시|과외|academy|tutoring/i, cluster: 'education' },
	{ test: /부동산|전세|월세|realtor|real\s*estate/i, cluster: 'realestate' },
	{ test: /도매|납품|식자재|wholesale|supply/i, cluster: 'agency' },
	{ test: /맛집|식당|레스토랑|restaurant/i, cluster: 'restaurant' },
	{ test: /에이전시|섭외|행사\s*기획|agency/i, cluster: 'agency' },
];

const CATEGORY_NOUN_RE = new RegExp(
	[...new Set(Object.values(INDUSTRY_CATEGORY_NOUNS).flat())]
		.sort((a, b) => b.length - a.length)
		.map((noun) => noun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|'),
	'i',
);

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function fold(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

function unique(values: readonly (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = compact(raw);
		if (!phrase || phrase.length < 2) continue;
		const key = fold(phrase);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

function isLowSearchNoun(value: string): boolean {
	return LOW_SEARCH_NOUNS.has(fold(value)) || LOW_SEARCH_NOUNS.has(compact(value).toLowerCase());
}

function pick(label: Localized, lang: StrategyLang): string {
	return lang === 'en' ? label.en : label.ko;
}

function auditHay(ctx: StrategyAuditContext, profile: StrategyIndustryProfileRef): string {
	return [
		ctx.industry,
		ctx.subIndustry,
		ctx.entities.businessEntity,
		...ctx.entities.phrases,
		...profile.specialties,
		profile.label,
		profile.schemaType,
		...ctx.schema.types,
	]
		.filter(Boolean)
		.join(' · ');
}

function classifyCluster(hay: string, profile: StrategyIndustryProfileRef, ctx: StrategyAuditContext): SpecialtyCluster {
	const lead = ctx.subIndustry || profile.specialties[0] || '';
	const specialtyHay = [ctx.subIndustry, ...profile.specialties].filter(Boolean).join(' · ');
	if (DERM_DEPT.test(lead)) return 'derm';
	if (PLASTIC_DEPT.test(lead)) return 'plastic';
	if (DERM_DEPT.test(specialtyHay) && !PLASTIC_DEPT.test(specialtyHay)) return 'derm';
	if (PLASTIC_DEPT.test(specialtyHay) && !DERM_DEPT.test(specialtyHay)) return 'plastic';
	if (DERM_PROC.test(specialtyHay) && !PLASTIC_PROC.test(specialtyHay)) return 'derm';
	if (PLASTIC_PROC.test(specialtyHay) && !DERM_PROC.test(specialtyHay)) return 'plastic';

	if (DERM_DEPT.test(hay) && !PLASTIC_DEPT.test(hay)) return 'derm';
	if (PLASTIC_DEPT.test(hay) && !DERM_DEPT.test(hay)) return 'plastic';

	for (const rule of CLUSTER_RULES) {
		if (rule.test.test(specialtyHay) || rule.test.test(hay)) return rule.cluster;
	}
	switch (profile.registryType) {
		case 'medical':
			return 'general';
		case 'veterinary':
			return 'vet';
		case 'legal':
			return 'legal';
		case 'accounting':
			return 'tax';
		case 'beauty':
			return 'beauty';
		case 'interior':
			return 'interior';
		case 'fitness':
			return 'fitness';
		case 'education':
			return 'education';
		case 'realestate':
			return 'realestate';
		case 'restaurant':
			return 'restaurant';
		case 'professional':
			return 'agency';
		default:
			return 'general';
	}
}

function resolveDepartment(
	hay: string,
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	cluster: SpecialtyCluster,
	lang: StrategyLang,
): string {
	if (cluster !== 'general') return pick(DEPARTMENT[cluster], lang);

	const industryNoun = extractIndustrySearchNoun({
		brandName: ctx.siteName,
		schemaTypes: ctx.schema.types,
		categoryNouns: [ctx.subIndustry, ctx.industry, ...profile.specialties].filter((item): item is string => Boolean(item)),
		primaryKeyword: ctx.subIndustry || profile.specialties[0],
		lang,
	});
	if (industryNoun && !isLowSearchNoun(industryNoun)) return industryNoun;

	const candidates = unique([ctx.subIndustry, ...profile.specialties, ctx.industry, profile.label]);
	for (const candidate of candidates) {
		const match = candidate.match(CATEGORY_NOUN_RE);
		if (match?.[0] && !isLowSearchNoun(match[0])) {
			if (lang === 'en' && /[가-힣]/.test(match[0])) continue;
			return match[0];
		}
	}

	if (profile.registryType === 'medical' || /의원|병원|클리닉|clinic|hospital/i.test(hay)) {
		return lang === 'en' ? 'clinic' : '의원';
	}
	return pick(DEPARTMENT[cluster], lang);
}

function resolveProcedures(
	hay: string,
	cluster: SpecialtyCluster,
	lang: StrategyLang,
	extras: readonly string[] = [],
): string[] {
	const lexicon = HIGH_INTENT_PROCEDURES[cluster] ?? HIGH_INTENT_PROCEDURES.general;
	const extraScored = unique(extras)
		.filter((phrase) => !isLowSearchNoun(phrase) && !CATEGORY_NOUN_RE.test(phrase))
		.map((phrase, index) => ({
			phrase,
			score: 40 - index + (fold(hay).includes(fold(phrase)) ? 10 : 0),
		}));
	const lexScored = lexicon.map((item, index) => {
		const phrase = pick(item, lang);
		const seed = fold(item.ko);
		const hit = Boolean(seed) && fold(hay).includes(seed);
		return { phrase, score: (hit ? 20 : 0) - index };
	});
	const scored = [...extraScored, ...lexScored].filter((item) => !isLowSearchNoun(item.phrase));
	scored.sort((a, b) => b.score - a.score);
	const phrases = unique(scored.map((item) => item.phrase));
	if (cluster === 'general') {
		return extraScored.map((item) => item.phrase).filter((phrase) => !isLowSearchNoun(phrase)).slice(0, 4);
	}
	if (cluster === 'derm') {
		return phrases.filter((phrase) => !PLASTIC_PROC.test(phrase)).slice(0, 4);
	}
	if (cluster === 'plastic') {
		return phrases.filter((phrase) => !/흉터|여드름|튼살|acne|scar|stretch mark/i.test(phrase)).slice(0, 4);
	}
	return phrases.slice(0, 4);
}

function composeMetroPhrase(
	metroHead: string,
	procedure: string,
	department: string,
	cluster: SpecialtyCluster,
): string {
	if (APPEND_DEPARTMENT.has(cluster) && department && !fold(procedure).includes(fold(department))) {
		return joinQuery([metroHead, procedure, department]);
	}
	return metroHead ? joinQuery([metroHead, procedure]) : procedure;
}

function metroLabel(metro: string, lang: StrategyLang): string {
	if (!metro) return '';
	if (lang === 'en') return METRO_EN[metro] || metro;
	return metro;
}

const DISTRICT_EN: Record<string, string> = {
	동구: 'Dong-gu',
	서구: 'Seo-gu',
	남구: 'Nam-gu',
	북구: 'Buk-gu',
	중구: 'Jung-gu',
	수성구: 'Suseong-gu',
	달서구: 'Dalseo-gu',
	강남구: 'Gangnam-gu',
	서초구: 'Seocho-gu',
	송파구: 'Songpa-gu',
	마포구: 'Mapo-gu',
	해운대구: 'Haeundae-gu',
	부산진구: 'Busanjin-gu',
	동래구: 'Dongnae-gu',
};

function districtLabel(district: string, lang: StrategyLang): string {
	if (!district) return '';
	if (lang !== 'en') return district;
	return DISTRICT_EN[district] || district;
}

function resolveHub(metro: string, district: string, lang: StrategyLang): string {
	if (!metro || !district) return '';
	const row = SEARCH_HUBS.find((item) => item.metro === metro && item.district.test(district));
	return row ? pick(row.hub, lang) : '';
}

function joinQuery(parts: Array<string | null | undefined>): string {
	return parts.map((part) => compact(part)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function buildPlaces(ctx: StrategyAuditContext, lang: StrategyLang) {
	const raw = [ctx.location, ctx.localSignals.location, ctx.localSignals.broadLocation, ctx.localSignals.addressLocality]
		.filter(Boolean)
		.join(' ');
	const parsed = parseQueryLocation(raw);
	const metro = metroLabel(parsed.metro, lang);
	const district = districtLabel(parsed.district, lang);
	const hub = resolveHub(parsed.metro, parsed.district, lang);
	const localCombo = metro && district && fold(metro) !== fold(district) ? joinQuery([metro, district]) : metro || district;
	return { metro, district, hub, localCombo };
}

function pushUnique(target: string[], phrase: string, seen: Set<string>) {
	const clean = compact(phrase);
	if (!clean || isLowSearchNoun(clean)) return;
	const key = fold(clean);
	if (seen.has(key)) return;
	seen.add(key);
	target.push(clean);
}

export function buildRecommendedKeywordGroups(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): RecommendedKeywordGroups {
	const hay = auditHay(ctx, profile);
	const cluster = classifyCluster(hay, profile, ctx);
	const department = resolveDepartment(hay, ctx, profile, cluster, lang);
	const extras = unique([...profile.specialties, ...ctx.entities.phrases, ctx.subIndustry]).filter((phrase) => {
		const key = fold(phrase);
		if (CATEGORY_NOUN_RE.test(phrase)) return false;
		return key !== fold(department) && key !== fold(ctx.industry) && key !== fold(profile.label);
	});
	const procedures = resolveProcedures(hay, cluster, lang, extras);
	const places = buildPlaces(ctx, lang);
	const seen = new Set<string>();

	const metro: string[] = [];
	const aeo: string[] = [];
	const local: string[] = [];

	const metroHead = places.metro || places.localCombo;
	for (const procedure of procedures) {
		pushUnique(metro, composeMetroPhrase(metroHead, procedure, department, cluster), seen);
		if (metro.length >= 4) break;
	}

	const best = lang === 'en' ? 'best' : '잘하는 곳';
	const recommend = lang === 'en' ? 'recommended' : '추천';
	const leadProcedure = procedures[0];
	if (leadProcedure) {
		if (lang === 'en') {
			pushUnique(aeo, joinQuery([best, leadProcedure, metroHead ? `in ${metroHead}` : '']), seen);
		} else {
			pushUnique(aeo, joinQuery([metroHead, leadProcedure, best]), seen);
		}
	}
	if (department) {
		pushUnique(aeo, joinQuery([metroHead, department, recommend]), seen);
	}
	if (aeo.length < 2 && procedures[1] && metroHead) {
		pushUnique(aeo, joinQuery([metroHead, procedures[1], recommend]), seen);
	}

	if (places.localCombo && department) {
		pushUnique(local, joinQuery([places.localCombo, department]), seen);
	} else if (places.metro && department) {
		pushUnique(local, joinQuery([places.metro, department]), seen);
	}
	if (places.hub && department) {
		pushUnique(local, joinQuery([places.hub, department]), seen);
	} else if (places.district && department && places.district !== places.metro) {
		pushUnique(local, joinQuery([places.district, department]), seen);
	}
	if (!local.length && department) {
		pushUnique(local, department, seen);
	}

	const chips: RecommendedKeywordChip[] = [
		...metro.map((phrase) => ({ phrase, group: 'metro' as const })),
		...aeo.map((phrase) => ({ phrase, group: 'aeo' as const })),
		...local.map((phrase) => ({ phrase, group: 'local' as const })),
	];

	return {
		metro,
		aeo,
		local,
		broad: metro,
		recommended: aeo,
		all: chips.map((chip) => chip.phrase),
		chips,
	};
}

export function buildExampleKeywords(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): string[] {
	return buildRecommendedKeywordGroups(ctx, profile, lang).all;
}
