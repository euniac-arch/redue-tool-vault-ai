import type { CheerioAPI } from 'cheerio';
import { dedupeRepeatedPhrase, extractOfficialBrandName } from '@/lib/audit/brand-name';
import {
	extractJsonLdScriptBodies,
	normalizeSchemaType,
	sanitizeJsonLdRaw,
} from '@/lib/audit/parser';

/** @deprecated Prefer industryType; kept for backward-compatible stored reports. */
export type SiteVertical = 'dental' | 'medical' | 'local' | 'b2b';

export type IndustryType = 'MEDICAL' | 'LOCAL_STORE' | 'B2B_MFG' | 'GENERAL';

export interface SiteMetadata {
	domain: string;
	brandName: string;
	/** Display / answer template alias — same as primaryKeyword when available. */
	category: string;
	/** Core procedure / product / service phrase used in natural queries. */
	primaryKeyword: string;
	industryType: IndustryType;
	/**
	 * Detailed locality when available (e.g. "부산 센텀").
	 * Kept for chips / evidence; queries prefer broadLocation.
	 */
	location: string;
	/** Metro / province-level geo target (e.g. "부산", "서울"). */
	broadLocation: string;
	/** @deprecated Derived from industryType for older UI paths. */
	vertical: SiteVertical;
	targetUrl: string;
}

type AuditLang = 'ko' | 'en';

/** Metro cities + provinces — preferred for citywide GEO queries. */
const BROAD_LOCATIONS = [
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
] as const;

/** District / neighborhood → parent metro (광역 추정). */
const DISTRICT_TO_BROAD: Record<string, string> = {
	강남: '서울',
	서초: '서울',
	송파: '서울',
	마포: '서울',
	여의도: '서울',
	홍대: '서울',
	잠실: '서울',
	중구: '서울',
	종로: '서울',
	영등포: '서울',
	노원: '서울',
	강서: '서울',
	관악: '서울',
	동작: '서울',
	성동: '서울',
	광진: '서울',
	용산: '서울',
	은평: '서울',
	양천: '서울',
	구로: '서울',
	금천: '서울',
	동대문: '서울',
	중랑: '서울',
	성북: '서울',
	강북: '서울',
	도봉: '서울',
	센텀: '부산',
	해운대: '부산',
	광안리: '부산',
	서면: '부산',
	연산: '부산',
	동래: '부산',
	남포: '부산',
	기장: '부산',
	수영: '부산',
	사상: '부산',
	사하: '부산',
	분당: '경기',
	판교: '경기',
	일산: '경기',
	동탄: '경기',
	수원: '경기',
	성남: '경기',
	용인: '경기',
	고양: '경기',
	평택: '경기',
	안산: '경기',
	안양: '경기',
	부천: '경기',
	남양주: '경기',
	화성: '경기',
	시흥: '경기',
	파주: '경기',
	의정부: '경기',
	김포: '경기',
	광명: '경기',
	군포: '경기',
	하남: '경기',
	오산: '경기',
	이천: '경기',
	양주: '경기',
	구리: '경기',
	안성: '경기',
	여주: '경기',
	창원: '경남',
	김해: '경남',
	청주: '충북',
	천안: '충남',
	전주: '전북',
	포항: '경북',
};

/** All locality tokens used for detailed `location` chips. */
const KR_REGIONS = [
	...BROAD_LOCATIONS,
	...Object.keys(DISTRICT_TO_BROAD),
] as const;

const EN_BROAD: Record<string, string> = {
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

const EN_CITIES =
	/\b(Seoul|Busan|Daegu|Incheon|Gwangju|Daejeon|Ulsan|Jeju|Suwon|Seongnam|Yongin|Goyang|Bundang|Gangnam|Songpa|Mapo|Haeundae|Centum|Pusan)\b/gi;

const EN_CITY_TO_BROAD: Record<string, string> = {
	seoul: 'Seoul',
	busan: 'Busan',
	pusan: 'Busan',
	daegu: 'Daegu',
	incheon: 'Incheon',
	gwangju: 'Gwangju',
	daejeon: 'Daejeon',
	ulsan: 'Ulsan',
	jeju: 'Jeju',
	suwon: 'Gyeonggi',
	seongnam: 'Gyeonggi',
	yongin: 'Gyeonggi',
	goyang: 'Gyeonggi',
	bundang: 'Gyeonggi',
	gangnam: 'Seoul',
	songpa: 'Seoul',
	mapo: 'Seoul',
	haeundae: 'Busan',
	centum: 'Busan',
};

/** Specific procedure / product phrases — checked before broad industry labels. */
type KeywordRule = {
	pattern: RegExp;
	ko: string;
	en: string;
	industry: IndustryType;
	/** Medical subtype for natural query phrasing. */
	medicalKind?: 'dental' | 'derm' | 'plastic' | 'vet' | 'clinic';
};

const PRIMARY_KEYWORD_RULES: KeywordRule[] = [
	// —— procedures first ——
	{ pattern: /울쎄라|울세라|ulthera|ultherapy/i, ko: '울쎄라/리프팅', en: 'Ultherapy/lifting', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /슈링크|therage|써마지|thermage|인모드|inmode/i, ko: '리프팅/피부시술', en: 'skin lifting', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /보톡스|botox/i, ko: '보톡스', en: 'Botox', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /필러|filler/i, ko: '필러', en: 'filler', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /레이저토닝|피코|레이저\s*시술|laser\s*toning/i, ko: '레이저 시술', en: 'laser treatment', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /임플란트|implant/i, ko: '임플란트', en: 'implants', industry: 'MEDICAL', medicalKind: 'dental' },
	{ pattern: /치아교정|교정치료|orthodont/i, ko: '치아교정', en: 'orthodontics', industry: 'MEDICAL', medicalKind: 'dental' },
	{ pattern: /라미네이트|라미네이팅|laminate|veneer/i, ko: '치아 라미네이트', en: 'dental veneers', industry: 'MEDICAL', medicalKind: 'dental' },
	{ pattern: /쌍꺼풀|눈성형|코성형|윤곽|지방흡입|rhinoplast|blepharoplast|liposuction/i, ko: '성형 시술', en: 'cosmetic surgery', industry: 'MEDICAL', medicalKind: 'plastic' },
	// —— industry nouns ——
	{ pattern: /피부과|dermatolog|skin\s*clinic/i, ko: '피부과', en: 'dermatology', industry: 'MEDICAL', medicalKind: 'derm' },
	{ pattern: /성형외과|성형|plastic\s*surg/i, ko: '성형외과', en: 'plastic surgery', industry: 'MEDICAL', medicalKind: 'plastic' },
	{ pattern: /치과|dentist|dental\b/i, ko: '치과', en: 'dental clinic', industry: 'MEDICAL', medicalKind: 'dental' },
	{ pattern: /동물병원|반려동물\s*병원|수의사|veterinary|animal\s*hospital|pet\s*clinic/i, ko: '반려동물 병원', en: 'pet hospital', industry: 'MEDICAL', medicalKind: 'vet' },
	{ pattern: /한의원|한방|oriental\s*medicine|korean\s*medicine/i, ko: '한의원', en: 'Korean medicine clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /안과|ophthalm|eye\s*clinic/i, ko: '안과', en: 'eye clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /이비인후|ent\s*clinic/i, ko: '이비인후과', en: 'ENT clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /산부인|obstetric|gynecol/i, ko: '산부인과', en: 'OB/GYN', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /정형외과|orthopedic/i, ko: '정형외과', en: 'orthopedics', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /중입자|암치료|암센터|탄소이온|carbon.?ion|proton.?therap|cancer\s*(clinic|center|treatment)/i, ko: '암치료 클리닉', en: 'cancer clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	{ pattern: /병원|의원|클리닉|clinic|hospital|medical/i, ko: '병원', en: 'clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	// —— B2B / manufacturing ——
	{ pattern: /냉동식품|냉동\s*제조|frozen\s*food/i, ko: '냉동식품 제조', en: 'frozen food manufacturing', industry: 'B2B_MFG' },
	{ pattern: /HACCP|식품\s*제조|식품공장|food\s*manufact/i, ko: 'HACCP 식품 제조', en: 'HACCP food manufacturing', industry: 'B2B_MFG' },
	{ pattern: /OEM|ODM|주문자\s*생산/i, ko: 'OEM/ODM 제조', en: 'OEM/ODM manufacturing', industry: 'B2B_MFG' },
	{ pattern: /제조|공장|manufactur|factory/i, ko: '제조', en: 'manufacturing', industry: 'B2B_MFG' },
	{ pattern: /웹디자인|홈페이지\s*제작|웹사이트\s*제작|web\s*design|website\s*design/i, ko: '웹디자인', en: 'web design', industry: 'B2B_MFG' },
	{ pattern: /마케팅|광고대행|performance\s*marketing|digital\s*marketing/i, ko: '디지털 마케팅', en: 'digital marketing', industry: 'B2B_MFG' },
	{ pattern: /법률|변호사|법무|law\s*firm|attorney|legal\s*service/i, ko: '법률 자문', en: 'legal services', industry: 'B2B_MFG' },
	{ pattern: /세무|회계|tax\s*service|accounting|cpa/i, ko: '세무/회계', en: 'tax & accounting', industry: 'B2B_MFG' },
	{ pattern: /SaaS|소프트웨어|플랫폼|software|B2B/i, ko: 'B2B 솔루션', en: 'B2B solution', industry: 'B2B_MFG' },
	// —— local B2C ——
	{ pattern: /부동산|부동산중개|real\s*estate/i, ko: '부동산', en: 'real estate', industry: 'LOCAL_STORE' },
	{ pattern: /카페|맛집|음식점|레스토랑|restaurant|cafe/i, ko: '맛집/카페', en: 'restaurant/cafe', industry: 'LOCAL_STORE' },
	{ pattern: /학원|어학원|academy|tutoring/i, ko: '학원', en: 'academy', industry: 'LOCAL_STORE' },
	{ pattern: /인테리어|interior\s*design/i, ko: '인테리어', en: 'interior design', industry: 'LOCAL_STORE' },
	{ pattern: /미용|헤어|네일|뷰티|salon|beauty/i, ko: '뷰티/미용', en: 'beauty/salon', industry: 'LOCAL_STORE' },
];

const SCHEMA_INDUSTRY: Record<string, { ko: string; en: string; industry: IndustryType; medicalKind?: KeywordRule['medicalKind'] }> = {
	Dentist: { ko: '치과', en: 'dental clinic', industry: 'MEDICAL', medicalKind: 'dental' },
	MedicalClinic: { ko: '의원', en: 'medical clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	Physician: { ko: '병원', en: 'physician practice', industry: 'MEDICAL', medicalKind: 'clinic' },
	Hospital: { ko: '병원', en: 'hospital', industry: 'MEDICAL', medicalKind: 'clinic' },
	VeterinaryCare: { ko: '반려동물 병원', en: 'pet hospital', industry: 'MEDICAL', medicalKind: 'vet' },
	Pharmacy: { ko: '약국', en: 'pharmacy', industry: 'MEDICAL', medicalKind: 'clinic' },
	BeautySalon: { ko: '뷰티 살롱', en: 'beauty salon', industry: 'LOCAL_STORE' },
	HairSalon: { ko: '헤어 살롱', en: 'hair salon', industry: 'LOCAL_STORE' },
	Restaurant: { ko: '맛집', en: 'restaurant', industry: 'LOCAL_STORE' },
	CafeOrCoffeeShop: { ko: '카페', en: 'cafe', industry: 'LOCAL_STORE' },
	RealEstateAgent: { ko: '부동산', en: 'real estate', industry: 'LOCAL_STORE' },
	Store: { ko: '매장', en: 'store', industry: 'LOCAL_STORE' },
	LocalBusiness: { ko: '동네 업체', en: 'local business', industry: 'LOCAL_STORE' },
	Attorney: { ko: '법률 자문', en: 'law firm', industry: 'B2B_MFG' },
	LegalService: { ko: '법률 자문', en: 'legal services', industry: 'B2B_MFG' },
	AccountingService: { ko: '세무/회계', en: 'accounting', industry: 'B2B_MFG' },
	SoftwareApplication: { ko: '소프트웨어', en: 'software', industry: 'B2B_MFG' },
	Product: { ko: '제품 제조', en: 'product manufacturing', industry: 'B2B_MFG' },
};

const TITLE_SPLIT = /\s*[|\-–—·•\/]\s*/;
const GENERIC_KEYWORDS = new Set([
	'전문 서비스',
	'professional services',
	'서비스',
	'service',
	'services',
	'업체',
	'사이트',
	'홈페이지',
	'공식',
	'official',
	'welcome',
	'지역 비즈니스',
	'local business',
	'동네 추천',
	'local recommendation',
	'믿을 만한 곳',
	'trusted provider',
]);

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function typeList(node: Record<string, unknown>): string[] {
	return asArray(node['@type'])
		.filter((t): t is string => typeof t === 'string')
		.map(normalizeSchemaType)
		.filter(Boolean);
}

function hasType(node: Record<string, unknown>, type: string): boolean {
	const want = normalizeSchemaType(type);
	return typeList(node).some((t) => t === want);
}

function cleanText(value: unknown, max = 120): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function domainFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '');
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function brandFromDomain(domain: string): string {
	const base = domain.split('.')[0] || domain;
	return base.charAt(0).toUpperCase() + base.slice(1);
}

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		value.forEach((item) => flattenJsonLd(item, out));
		return;
	}
	if (typeof value !== 'object') return;
	const obj = value as Record<string, unknown>;
	const graph = obj['@graph'];
	if (graph != null) {
		flattenJsonLd(graph, out);
		if (typeList(obj).length === 0) return;
	}
	out.push(obj);
}

function readNodes($: CheerioAPI, rawHtml?: string): Record<string, unknown>[] {
	const nodes: Record<string, unknown>[] = [];
	let bodies = extractJsonLdScriptBodies(rawHtml ?? '');
	if (bodies.length === 0) {
		const fromDom: string[] = [];
		$('script').each((_, el) => {
			const type = (($(el).attr('type') || '') + '').toLowerCase();
			if (!type.includes('ld+json')) return;
			const body = sanitizeJsonLdRaw($(el).contents().text() || $(el).html() || '');
			if (body) fromDom.push(body);
		});
		bodies = fromDom;
	}

	for (const raw of bodies) {
		try {
			flattenJsonLd(JSON.parse(raw), nodes);
		} catch {
			/* ignore invalid blocks */
		}
	}
	return nodes;
}

function addressParts(node: Record<string, unknown>): string[] {
	const address = node.address;
	if (!address) return [];
	if (typeof address === 'string') return [cleanText(address, 80)];
	if (typeof address !== 'object' || Array.isArray(address)) {
		return asArray(address)
			.map((item) => (typeof item === 'string' ? cleanText(item, 80) : ''))
			.filter(Boolean);
	}
	const obj = address as Record<string, unknown>;
	return [obj.addressLocality, obj.addressRegion, obj.addressCountry, obj.streetAddress]
		.map((v) => cleanText(v, 40))
		.filter(Boolean);
}

function extractLocationFromText(corpus: string): string {
	const hits: string[] = [];
	for (const region of KR_REGIONS) {
		if (corpus.includes(region) && !hits.includes(region)) hits.push(region);
		if (hits.length >= 2) break;
	}
	if (hits.length) return hits.join(' ');

	const en = corpus.match(EN_CITIES);
	if (en?.length) {
		const unique = Array.from(new Set(en.map((c) => c[0]!.toUpperCase() + c.slice(1).toLowerCase())));
		return unique.slice(0, 2).join(' ');
	}
	return '';
}

/**
 * Prefer metro/province tokens. If only a district is found (센텀, 강남…),
 * map it up the geo hierarchy to the parent city/province.
 */
function extractBroadLocation(corpus: string, detailedLocation = ''): string {
	for (const city of BROAD_LOCATIONS) {
		if (corpus.includes(city) || detailedLocation.includes(city)) return city;
	}

	const districtKeys = Object.keys(DISTRICT_TO_BROAD).sort((a, b) => b.length - a.length);
	for (const district of districtKeys) {
		if (corpus.includes(district) || detailedLocation.includes(district)) {
			return DISTRICT_TO_BROAD[district]!;
		}
	}

	const en = corpus.match(EN_CITIES);
	if (en?.length) {
		const key = en[0]!.toLowerCase();
		return EN_CITY_TO_BROAD[key] || en[0]![0]!.toUpperCase() + en[0]!.slice(1).toLowerCase();
	}

	return '';
}

function broadLocationLabel(broad: string, lang: AuditLang): string {
	if (!broad) return '';
	if (lang === 'en') return EN_BROAD[broad] || broad;
	return broad;
}

function cleanBrandCandidate(raw: string, domain: string): string {
	let text = cleanText(raw, 80);
	if (!text) return '';

	const parts = text.split(TITLE_SPLIT).map((p) => p.trim()).filter(Boolean);
	if (parts.length >= 2) {
		const first = parts[0]!;
		const looksBrand = first.length <= 28 && !/추천|잘하는|베스트|best|official/i.test(first);
		if (looksBrand) text = first;
	}

	const host = domain.replace(/\./g, '\\.');
	text = text.replace(new RegExp(host, 'ig'), '').replace(/\s+/g, ' ').trim();
	return text.slice(0, 40);
}

function collectHeadings($: CheerioAPI, selector: string, max = 6): string[] {
	const out: string[] = [];
	$(selector).each((_, el) => {
		if (out.length >= max) return false;
		const text = cleanText($(el).text(), 100);
		if (text) out.push(text);
	});
	return out;
}

function matchKeywordRule(corpus: string): KeywordRule | null {
	for (const rule of PRIMARY_KEYWORD_RULES) {
		if (rule.pattern.test(corpus)) return rule;
	}
	return null;
}

function matchSchemaKeyword(
	types: string[],
	lang: AuditLang,
): { keyword: string; industry: IndustryType; medicalKind?: KeywordRule['medicalKind'] } | null {
	for (const type of types) {
		const short = type.includes('/') ? type.split('/').pop()! : type;
		const mapped = SCHEMA_INDUSTRY[short];
		if (mapped) {
			return {
				keyword: lang === 'ko' ? mapped.ko : mapped.en,
				industry: mapped.industry,
				medicalKind: mapped.medicalKind,
			};
		}
	}
	return null;
}

/** Pull a concrete noun phrase from title/H1 segments when lexicon misses. */
function inferKeywordFromSegments(segments: string[], brandName: string, lang: AuditLang): string {
	const brandNorm = brandName.replace(/\s+/g, '').toLowerCase();
	for (const seg of segments) {
		const cleaned = cleanText(seg, 40);
		if (!cleaned || cleaned.length < 2) continue;
		const norm = cleaned.replace(/\s+/g, '').toLowerCase();
		if (brandNorm && (norm === brandNorm || brandNorm.includes(norm) || norm.includes(brandNorm))) continue;
		if (GENERIC_KEYWORDS.has(cleaned.toLowerCase())) continue;
		if (extractLocationFromText(cleaned) === cleaned) continue;
		if (/^(home|메인|소개|about|contact|문의)$/i.test(cleaned)) continue;
		// Prefer segments that look like service nouns (Hangul compound or short EN phrase)
		if (/[가-힣]{2,}/.test(cleaned) || /^[A-Za-z][A-Za-z0-9 &\-/]{2,30}$/.test(cleaned)) {
			return cleaned;
		}
	}
	return lang === 'ko' ? '' : '';
}

function industryToVertical(industry: IndustryType, medicalKind?: KeywordRule['medicalKind']): SiteVertical {
	if (industry === 'MEDICAL') return medicalKind === 'dental' ? 'dental' : 'medical';
	if (industry === 'LOCAL_STORE') return 'local';
	if (industry === 'B2B_MFG') return 'b2b';
	return 'b2b';
}

function normalizeLegacyMeta(meta: SiteMetadata): SiteMetadata {
	const industry: IndustryType =
		meta.industryType ||
		(meta.vertical === 'dental' || meta.vertical === 'medical'
			? 'MEDICAL'
			: meta.vertical === 'local'
				? 'LOCAL_STORE'
				: meta.vertical === 'b2b'
					? 'B2B_MFG'
					: 'GENERAL');
	const primaryKeyword = meta.primaryKeyword || meta.category || '';
	const broadLocation =
		meta.broadLocation ||
		extractBroadLocation(`${meta.location} ${meta.brandName} ${primaryKeyword}`, meta.location);
	return {
		...meta,
		industryType: industry,
		primaryKeyword,
		category: meta.category || primaryKeyword,
		broadLocation,
		vertical: meta.vertical || industryToVertical(industry),
	};
}

/** Fills missing fields on legacy stored reports (broadLocation, industryType…). */
export function resolveSiteMetadata(meta: SiteMetadata): SiteMetadata {
	return normalizeLegacyMeta(meta);
}

/**
 * Extracts brand / primaryKeyword / location / industryType from live HTML + JSON-LD.
 * Deterministic heuristics only — no LLM.
 */
export function extractSiteMetadata(
	$: CheerioAPI,
	pageUrl: string,
	lang: AuditLang = 'ko',
	rawHtml?: string,
): SiteMetadata {
	const domain = domainFromUrl(pageUrl);
	const title = cleanText($('title').first().text(), 160);
	const metaDescription = cleanText($('meta[name="description"]').attr('content'), 240);
	const ogTitle = cleanText($('meta[property="og:title"]').attr('content'), 160);
	const ogSiteName = cleanText($('meta[property="og:site_name"]').attr('content'), 80);
	const ogDescription = cleanText($('meta[property="og:description"]').attr('content'), 240);
	const h1List = collectHeadings($, 'h1', 3);
	const h2List = collectHeadings($, 'h2', 8);
	const h1 = h1List[0] || '';

	const nodes = readNodes($, rawHtml);
	const orgLike = nodes.filter(
		(n) =>
			hasType(n, 'Organization') ||
			hasType(n, 'LocalBusiness') ||
			Object.keys(SCHEMA_INDUSTRY).some((t) => hasType(n, t)),
	);

	const schemaNames = orgLike.map((n) => cleanText(n.name, 80)).filter(Boolean);
	const schemaDescriptions = orgLike.map((n) => cleanText(n.description, 200)).filter(Boolean);
	const schemaKnowsAbout = orgLike.flatMap((n) =>
		asArray(n.knowsAbout)
			.map((v) => cleanText(v, 60))
			.filter(Boolean),
	);
	const schemaSpecialties = orgLike.flatMap((n) =>
		asArray(n.medicalSpecialty ?? n.specialty)
			.map((v) =>
				cleanText(
					typeof v === 'object' && v && 'name' in (v as object) ? (v as { name: unknown }).name : v,
					60,
				),
			)
			.filter(Boolean),
	);
	const schemaTypes = Array.from(new Set(orgLike.flatMap((n) => typeList(n))));

	const schemaAddress = orgLike.flatMap(addressParts);
	const schemaLocation = schemaAddress.slice(0, 2).join(' ') || extractLocationFromText(schemaAddress.join(' '));

	const corpus = [
		title,
		ogTitle,
		ogDescription,
		metaDescription,
		...h1List,
		...h2List,
		...schemaDescriptions,
		...schemaKnowsAbout,
		...schemaSpecialties,
		...schemaTypes,
	].join(' ');

	// Unique brand candidates first — joining identical schema/og/title values then
	// stripping separators was producing "Brand Brand" site names.
	const brandSourceParts: string[] = [];
	const seenBrandNorm = new Set<string>();
	for (const part of [schemaNames[0], ogSiteName, ogTitle, title, h1]) {
		const cleaned = cleanText(part, 80);
		if (!cleaned) continue;
		const norm = cleaned.replace(/\s+/g, '').toLowerCase();
		if (seenBrandNorm.has(norm)) continue;
		seenBrandNorm.add(norm);
		brandSourceParts.push(cleaned);
	}
	const brandName = dedupeRepeatedPhrase(
		extractOfficialBrandName(
			brandSourceParts.join(' | '),
			domain,
			cleanBrandCandidate(schemaNames[0] || '', domain) ||
				cleanBrandCandidate(ogSiteName, domain) ||
				undefined,
		),
	);

	const textRule = matchKeywordRule(corpus);
	const schemaHit = matchSchemaKeyword(schemaTypes, lang);

	let primaryKeyword = '';
	let industryType: IndustryType = 'GENERAL';
	let medicalKind: KeywordRule['medicalKind'] | undefined;

	if (textRule) {
		primaryKeyword = lang === 'ko' ? textRule.ko : textRule.en;
		industryType = textRule.industry;
		medicalKind = textRule.medicalKind;
	} else if (schemaHit) {
		primaryKeyword = schemaHit.keyword;
		industryType = schemaHit.industry;
		medicalKind = schemaHit.medicalKind;
	} else {
		const segments = [
			...title.split(TITLE_SPLIT),
			...ogTitle.split(TITLE_SPLIT),
			...h1List,
			...h2List.slice(0, 3),
			...schemaKnowsAbout,
			...schemaSpecialties,
		];
		primaryKeyword = inferKeywordFromSegments(segments, brandName, lang);
		if (schemaLocation || extractLocationFromText(corpus)) industryType = 'LOCAL_STORE';
		else industryType = primaryKeyword ? 'GENERAL' : 'GENERAL';
	}

	// Prefer procedure keyword over broad clinic label when both appear
	if (textRule?.medicalKind && schemaHit && textRule.industry === 'MEDICAL') {
		primaryKeyword = lang === 'ko' ? textRule.ko : textRule.en;
		industryType = 'MEDICAL';
		medicalKind = textRule.medicalKind;
	}

	const location =
		cleanText(schemaLocation, 40) ||
		extractLocationFromText([title, ogTitle, metaDescription, h1, corpus].join(' '));

	const geoCorpus = [title, ogTitle, metaDescription, h1, schemaAddress.join(' '), corpus, location].join(' ');
	const broadLocation = extractBroadLocation(geoCorpus, location);

	if (!primaryKeyword) {
		primaryKeyword = location || broadLocation
			? lang === 'ko'
				? '동네 추천'
				: 'local recommendation'
			: lang === 'ko'
				? '믿을 만한 곳'
				: 'trusted provider';
		if (industryType === 'GENERAL' && (location || broadLocation)) industryType = 'LOCAL_STORE';
	}

	if (GENERIC_KEYWORDS.has(primaryKeyword.toLowerCase()) || primaryKeyword === '전문 서비스') {
		primaryKeyword = lang === 'ko' ? '믿을 만한 곳' : 'trusted provider';
	}

	// Prefer citywide-friendly derm phrasing when lifting/skin signals exist
	if (
		lang === 'ko' &&
		industryType === 'MEDICAL' &&
		medicalKind === 'derm' &&
		/리프팅|울쎄라|보톡스|필러|레이저/.test(primaryKeyword) &&
		!/피부과/.test(primaryKeyword)
	) {
		primaryKeyword = /울쎄라|리프팅/.test(primaryKeyword) ? '피부과/리프팅' : `피부과/${primaryKeyword}`;
	}

	return {
		domain,
		brandName,
		category: primaryKeyword,
		primaryKeyword,
		industryType,
		location,
		broadLocation,
		vertical: industryToVertical(industryType, medicalKind),
		targetUrl: pageUrl,
	};
}

export function fallbackSiteMetadata(pageUrl: string, lang: AuditLang = 'ko'): SiteMetadata {
	const domain = domainFromUrl(pageUrl);
	const primaryKeyword = lang === 'ko' ? '믿을 만한 곳' : 'trusted provider';
	return {
		domain,
		brandName: brandFromDomain(domain),
		category: primaryKeyword,
		primaryKeyword,
		industryType: 'GENERAL',
		location: '',
		broadLocation: '',
		vertical: 'b2b',
		targetUrl: pageUrl,
	};
}

function detectMedicalKind(keyword: string): KeywordRule['medicalKind'] {
	if (/치과|임플란트|치아|dental|implant|orthodont/i.test(keyword)) return 'dental';
	if (/피부|울쎄라|보톡스|필러|리프팅|레이저|derma|ulthera|botox|filler/i.test(keyword)) return 'derm';
	if (/성형|plastic|cosmetic surg/i.test(keyword)) return 'plastic';
	if (/동물|반려|vet|pet\s*hospital/i.test(keyword)) return 'vet';
	if (/의원|병원|클리닉|clinic|hospital|한의|안과|산부인|정형/i.test(keyword)) return 'clinic';
	return undefined;
}

function safePrimaryKeyword(raw: string): string {
	const keyword = (raw || '').trim();
	if (!keyword || GENERIC_KEYWORDS.has(keyword.toLowerCase()) || keyword === '전문 서비스') return '';
	return keyword;
}

/**
 * Citywide / metro-target conversational query for ChatGPT · Perplexity.
 * Uses broadLocation (부산, 서울…) so clients see metro-scale GEO upside.
 */
export function generateBroadQuery(data: {
	broadLocation: string;
	brandName: string;
	primaryKeyword: string;
	industryType: string;
}): string {
	const loc = data.broadLocation.trim() ? `${data.broadLocation.trim()} 전체에서 ` : '';
	const keyword = safePrimaryKeyword(data.primaryKeyword);
	const industry = data.industryType;
	const kind = detectMedicalKind(keyword);

	// Dental first — never route implants to a "피부과" template
	if (
		(industry === 'MEDICAL' && kind === 'dental') ||
		kind === 'dental' ||
		/치과|임플란트/.test(keyword)
	) {
		return `${loc}임플란트 잘하고 과잉진료 없는 추천 치과 알려줘. 가장 신뢰할 수 있는 병원 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (industry === 'MEDICAL' && kind === 'plastic') {
		const focus = keyword || '성형';
		return `${loc}${focus} 과잉진료 없고 후기 좋은 추천 성형외과 알려줘. 믿을 만한 추천 병원 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (industry === 'MEDICAL' && kind === 'vet') {
		const focus = keyword || '반려동물 병원';
		return `${loc}${focus} 후기 좋고 믿을 수 있는 추천 동물병원 알려줘. 가장 신뢰할 수 있는 곳 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Dermatology / aesthetic skin clinics
	if (kind === 'derm' || /피부과|울쎄라|리프팅|보톡스|필러/.test(keyword)) {
		const focus = keyword || '피부과';
		return `${loc}${focus} 과잉진료 없고 후기 좋은 추천 피부과 알려줘. 믿을 만한 추천 병원 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (/성형/.test(keyword)) {
		return `${loc}${keyword} 과잉진료 없고 후기 좋은 추천 성형외과 알려줘. 믿을 만한 추천 병원 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (industry === 'MEDICAL' || kind === 'clinic' || /의원|병원|클리닉/.test(keyword)) {
		const focus = keyword || '병원';
		return `${loc}${focus} 과잉진료 없고 후기 좋은 추천 병원 알려줘. 믿을 만한 추천 병원 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (industry === 'LOCAL_STORE') {
		const focus = keyword || '업체';
		return `${loc}${focus} 가장 만족도 높은 추천 업체 알려줘. 믿고 방문할 만한 대표 사이트 어디야?`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (industry === 'B2B_MFG') {
		const focus = keyword || '외주';
		return `${focus} 전문으로 가장 평가 좋은 대표 기업/공장 추천해줘. 믿을 수 있는 곳 알려줘.`
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (keyword) {
		return `${loc}${keyword} 관련해서 가장 평가 좋은 대표 추천 사이트나 업체 알려줘.`
			.replace(/\s+/g, ' ')
			.trim();
	}
	return `${loc}가장 평가 좋은 대표 추천 사이트나 업체 알려줘.`.replace(/\s+/g, ' ').trim();
}

/** @deprecated Prefer generateBroadQuery — kept as a thin alias. */
export function generateNaturalQuery(data: {
	location: string;
	brandName: string;
	primaryKeyword: string;
	industryType: string;
	broadLocation?: string;
}): string {
	return generateBroadQuery({
		broadLocation: data.broadLocation || extractBroadLocation(data.location, data.location),
		brandName: data.brandName,
		primaryKeyword: data.primaryKeyword,
		industryType: data.industryType,
	});
}

function generateBroadQueryEn(data: {
	broadLocation: string;
	primaryKeyword: string;
	industryType: IndustryType;
}): string {
	const city = data.broadLocation.trim();
	const loc = city ? `across ${city} ` : '';
	const keyword = safePrimaryKeyword(data.primaryKeyword);
	const kind = detectMedicalKind(keyword);

	if (data.industryType === 'MEDICAL' && (kind === 'dental' || /dental|implant/i.test(keyword))) {
		return `Across ${city || 'the area'}, recommend a dental clinic that’s great at implants with no overtreatment. Which hospital is most trustworthy?`
			.replace(/\s+/g, ' ')
			.trim();
	}
	if (data.industryType === 'MEDICAL' || kind === 'derm' || kind === 'clinic') {
		const focus = keyword || 'dermatology';
		return `${loc}${focus} — recommend a clinic with great reviews and no upselling. Which hospital should I trust?`
			.replace(/\s+/g, ' ')
			.trim();
	}
	if (data.industryType === 'LOCAL_STORE') {
		const focus = keyword || 'business';
		return `${loc}which ${focus} has the highest satisfaction? What’s the most trusted site to visit?`
			.replace(/\s+/g, ' ')
			.trim();
	}
	if (data.industryType === 'B2B_MFG') {
		const focus = keyword || 'manufacturing';
		return `Recommend the best-rated ${focus} company/factory. Which one can I trust?`.replace(/\s+/g, ' ').trim();
	}
	if (keyword) {
		return `${loc}recommend the best-rated site or company for ${keyword}.`.replace(/\s+/g, ' ').trim();
	}
	return `Recommend the best-rated site or company I can trust.`;
}

/** Builds a metro-scale AI-search user query from extracted site metadata. */
export function generateUserQuery(meta: SiteMetadata, lang: AuditLang = 'ko'): string {
	const m = normalizeLegacyMeta(meta);
	const broad = broadLocationLabel(m.broadLocation, lang);
	if (lang === 'en') {
		return generateBroadQueryEn({
			broadLocation: broad,
			primaryKeyword: m.primaryKeyword,
			industryType: m.industryType,
		});
	}
	return generateBroadQuery({
		broadLocation: m.broadLocation,
		brandName: m.brandName,
		primaryKeyword: m.primaryKeyword,
		industryType: m.industryType,
	});
}

export function locationLabel(meta: SiteMetadata, lang: AuditLang = 'ko'): string {
	const m = normalizeLegacyMeta(meta);
	if (m.broadLocation.trim()) return broadLocationLabel(m.broadLocation, lang);
	if (m.location.trim()) {
		const broad = extractBroadLocation(m.location, m.location);
		if (broad) return broadLocationLabel(broad, lang);
		return m.location.trim();
	}
	return lang === 'ko' ? '해당' : 'this';
}
