import type { CheerioAPI } from 'cheerio';
import { dedupeRepeatedPhrase, extractOfficialBrandName } from '@/lib/audit/brand-name';
import { classifyMetaKeywords } from '@/lib/geo/brand-entities';
import {
	extractFooterLegalText,
	extractJsonLdScriptBodies,
	extractNavItems,
	normalizeSchemaType,
	sanitizeJsonLdRaw,
} from '@/lib/audit/parser';
import { extractSiteLogoUrl } from '@/lib/audit/extract-site-logo';
import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { cleanMedicalEntities } from '@/lib/geo/clean-medical-entities';
import { extractCoreSpecialties, filterNavMenuTexts } from '@/lib/geo/core-specialties';
import { formatColloquialLocation } from '@/lib/geo/query-location';
import { buildMedicalSimulatorQuery } from '@/lib/audit/recommended-schemas';
import { buildConversationalQuery, buildSiteEntityProfile } from '@/lib/geo/site-entity';

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
	/** Precise on-page business phrase (e.g. 해외 중입자 치료 상담). */
	businessEntity?: string;
	/** Extra noun phrases from title / meta / body. */
	entityPhrases?: string[];
	/** Need words that actually appear on the page (야간, 상담, 해외…). */
	needSignals?: string[];
	/** Raw `meta[name=keywords]` content, if the page declares it. */
	metaKeywords?: string;
	/** Keywords actually found on the page (meta, schema, title/body phrases). */
	detectedKeywords?: string[];
	/** Brand / person stopwords split from title · name · keywords. */
	brandEntities?: string[];
	/** Remaining category / service nouns after brand-person filtering. */
	serviceKeywords?: string[];
	title?: string;
	metaDescription?: string;
	/** Raw `og:title` for As-Is source audit (P4). */
	ogTitle?: string;
	/** Raw `og:description` for As-Is source audit (P4). */
	ogDescription?: string;
	/** Raw `og:image` used as the MedicalClinic / Organization logo fallback. */
	ogImage?: string;
	/** High-res brand logo (schema → header img → apple-touch-icon → og:image). */
	logoUrl?: string;
	/** JSON-LD `knowsAbout` / specialty terms (P1). */
	schemaKnowsAbout?: string[];
	/** Organization-like JSON-LD @types (P1), e.g. MedicalClinic. */
	schemaEntityTypes?: string[];
	/** Content H2 phrases for As-Is source audit (P5). */
	h2Texts?: string[];
	/** GNB / header nav labels used for specialty ranking. */
	navMenuTexts?: string[];
	/** Ranked 1–3 specialties from title / meta keywords / nav. */
	coreSpecialties?: string[];
	/** Footer / Person-schema representative legal name (홍길동). */
	representativeName?: string;
	/** Footer / Person-schema jobTitle (대표 / 대표이사 / 원장). */
	representativeJobTitle?: string;
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

/** Specific procedure / product phrases — scored by weight (higher wins). */
type KeywordRule = {
	pattern: RegExp;
	ko: string;
	en: string;
	industry: IndustryType;
	/** Medical subtype for natural query phrasing. */
	medicalKind?: 'dental' | 'derm' | 'plastic' | 'vet' | 'clinic';
	/** Higher weight wins when several rules match. Weak wellness terms stay low. */
	weight?: number;
};

/** Direct plastic-surgery terms — required to classify as 의료/성형외과. */
const PLASTIC_STRONG_RE =
	/성형외과|성형수술|성형시술|미용성형|쌍꺼풀|눈성형|코성형|가슴성형|윤곽성형|지방흡입|rhinoplast|blepharoplast|liposuction|plastic\s*surg/i;

const PLASTIC_INDUSTRIAL_RE = /사출성형|가소성형|압출성형|성형품/;

/** Weak wellness/beauty copy that must not trigger 성형외과 by itself. */
const BEAUTY_WEAK_RE = /뷰티웰빙|웰빙센터|뷰티케어|웰빙|케어|뷰티|미용|헤어|네일|salon|beauty/i;

/** General medical context (clinic nouns + non-plastic specialties). */
const GENERAL_MEDICAL_RE =
	/의원|병원|클리닉|clinic|hospital|medical|내과|외과|정형외과|재활의학|재활치료|통증의학|통증클리닉|한의원|치과|피부과|안과|산부인|이비인후/i;

const PRIMARY_KEYWORD_RULES: KeywordRule[] = [
	// —— plastic (strong only; bare 윤곽 / 뷰티 / 케어 never suffice) ——
	{
		pattern: /성형외과|성형수술|성형시술|미용성형|plastic\s*surg/i,
		ko: '성형외과',
		en: 'plastic surgery',
		industry: 'MEDICAL',
		medicalKind: 'plastic',
		weight: 12,
	},
	{
		pattern: /쌍꺼풀|눈성형|코성형|가슴성형|윤곽성형|지방흡입|rhinoplast|blepharoplast|liposuction/i,
		ko: '성형 시술',
		en: 'cosmetic surgery',
		industry: 'MEDICAL',
		medicalKind: 'plastic',
		weight: 11,
	},
	{
		pattern: /성형/,
		ko: '성형외과',
		en: 'plastic surgery',
		industry: 'MEDICAL',
		medicalKind: 'plastic',
		weight: 10,
	},
	// —— derm procedures (보톡스/필러 are derm unless a strong plastic term also hits) ——
	{ pattern: /울쎄라|울세라|ulthera|ultherapy/i, ko: '울쎄라/리프팅', en: 'Ultherapy/lifting', industry: 'MEDICAL', medicalKind: 'derm', weight: 10 },
	{ pattern: /슈링크|therage|써마지|thermage|인모드|inmode/i, ko: '리프팅/피부시술', en: 'skin lifting', industry: 'MEDICAL', medicalKind: 'derm', weight: 9 },
	{ pattern: /보톡스|botox/i, ko: '보톡스', en: 'Botox', industry: 'MEDICAL', medicalKind: 'derm', weight: 8 },
	{ pattern: /필러|filler/i, ko: '필러', en: 'filler', industry: 'MEDICAL', medicalKind: 'derm', weight: 8 },
	{ pattern: /레이저토닝|피코|레이저\s*시술|laser\s*toning/i, ko: '레이저 시술', en: 'laser treatment', industry: 'MEDICAL', medicalKind: 'derm', weight: 8 },
	{ pattern: /임플란트|implant/i, ko: '임플란트', en: 'implants', industry: 'MEDICAL', medicalKind: 'dental', weight: 10 },
	{ pattern: /치아교정|교정치료|orthodont/i, ko: '치아교정', en: 'orthodontics', industry: 'MEDICAL', medicalKind: 'dental', weight: 9 },
	{ pattern: /라미네이트|라미네이팅|laminate|veneer/i, ko: '치아 라미네이트', en: 'dental veneers', industry: 'MEDICAL', medicalKind: 'dental', weight: 9 },
	// —— industry nouns ——
	{ pattern: /피부과|dermatolog|skin\s*clinic/i, ko: '피부과', en: 'dermatology', industry: 'MEDICAL', medicalKind: 'derm', weight: 9 },
	{ pattern: /치과|dentist|dental\b/i, ko: '치과', en: 'dental clinic', industry: 'MEDICAL', medicalKind: 'dental', weight: 9 },
	{ pattern: /동물병원|반려동물\s*병원|수의사|veterinary|animal\s*hospital|pet\s*clinic/i, ko: '반려동물 병원', en: 'pet hospital', industry: 'MEDICAL', medicalKind: 'vet', weight: 9 },
	{ pattern: /한의원|한방|oriental\s*medicine|korean\s*medicine/i, ko: '한의원', en: 'Korean medicine clinic', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /안과|ophthalm|eye\s*clinic/i, ko: '안과', en: 'eye clinic', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /이비인후|ent\s*clinic/i, ko: '이비인후과', en: 'ENT clinic', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /산부인|obstetric|gynecol/i, ko: '산부인과', en: 'OB/GYN', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /정형\s*[·・\/]?\s*통증|통증\s*[·・\/]?\s*정형/i, ko: '정형·통증클리닉', en: 'ortho-pain clinic', industry: 'MEDICAL', medicalKind: 'clinic', weight: 12 },
	{ pattern: /스포츠\s*재활|sports?\s*rehab/i, ko: '스포츠재활', en: 'sports rehab', industry: 'MEDICAL', medicalKind: 'clinic', weight: 11 },
	{ pattern: /도수치료|도수\s*치료|manual\s*therap/i, ko: '도수치료', en: 'manual therapy', industry: 'MEDICAL', medicalKind: 'clinic', weight: 11 },
	{ pattern: /아동\s*발달|소아\s*재활|발달센터|child\s*develop/i, ko: '아동발달센터', en: 'child development center', industry: 'MEDICAL', medicalKind: 'clinic', weight: 11 },
	{ pattern: /정형외과|orthopedic/i, ko: '정형외과', en: 'orthopedics', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /통증의학|통증클리닉/i, ko: '통증의학과', en: 'pain clinic', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /재활의학|재활치료|재활의학과/i, ko: '재활의학과', en: 'rehabilitation', industry: 'MEDICAL', medicalKind: 'clinic', weight: 8 },
	{ pattern: /내과|internal\s*medicine/i, ko: '내과', en: 'internal medicine', industry: 'MEDICAL', medicalKind: 'clinic', weight: 7 },
	{
		pattern: /해외\s*중입자|중입자\s*치료|중입자|탄소이온|carbon.?ion|proton.?therap/i,
		ko: '중입자 치료',
		en: 'carbon-ion therapy',
		industry: 'MEDICAL',
		medicalKind: 'clinic',
		weight: 13,
	},
	{
		pattern: /암치료|암센터|cancer\s*(clinic|center|treatment)/i,
		ko: '암치료',
		en: 'cancer treatment',
		industry: 'MEDICAL',
		medicalKind: 'clinic',
		weight: 8,
	},
	{
		pattern: /병원|의원|클리닉|clinic|hospital|medical/i,
		ko: '일반의원',
		en: 'general clinic',
		industry: 'MEDICAL',
		medicalKind: 'clinic',
		weight: 5,
	},
	// —— B2B / manufacturing ——
	{ pattern: /냉동식품|냉동\s*제조|frozen\s*food/i, ko: '냉동식품 제조', en: 'frozen food manufacturing', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /HACCP|식품\s*제조|식품공장|food\s*manufact/i, ko: 'HACCP 식품 제조', en: 'HACCP food manufacturing', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /OEM|ODM|주문자\s*생산/i, ko: 'OEM/ODM 제조', en: 'OEM/ODM manufacturing', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /제조|공장|manufactur|factory/i, ko: '제조', en: 'manufacturing', industry: 'B2B_MFG', weight: 3 },
	{ pattern: /연예인\s*섭외|섭외\s*에이전시|행사\s*섭외/i, ko: '연예인 섭외', en: 'talent booking', industry: 'B2B_MFG', weight: 8 },
	{ pattern: /행사\s*기획|이벤트\s*기획|event\s*plann/i, ko: '행사 기획', en: 'event planning', industry: 'B2B_MFG', weight: 7 },
	{ pattern: /현장\s*운영|행사\s*운영|event\s*ops/i, ko: '현장 운영', en: 'on-site operations', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /행사\s*대행|이벤트\s*대행|event\s*agenc/i, ko: '행사 대행', en: 'event agency', industry: 'B2B_MFG', weight: 7 },
	{ pattern: /섭외/i, ko: '섭외', en: 'booking', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /에이전시|agency/i, ko: '에이전시', en: 'agency', industry: 'B2B_MFG', weight: 5 },
	{ pattern: /웹디자인|홈페이지\s*제작|웹사이트\s*제작|web\s*design|website\s*design/i, ko: '웹디자인', en: 'web design', industry: 'B2B_MFG', weight: 5 },
	{ pattern: /마케팅|광고대행|performance\s*marketing|digital\s*marketing/i, ko: '디지털 마케팅', en: 'digital marketing', industry: 'B2B_MFG', weight: 5 },
	{ pattern: /법률|변호사|법무|law\s*firm|attorney|legal\s*service/i, ko: '법률 자문', en: 'legal services', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /세무|회계|tax\s*service|accounting|cpa/i, ko: '세무/회계', en: 'tax & accounting', industry: 'B2B_MFG', weight: 6 },
	{ pattern: /SaaS|소프트웨어|플랫폼|software|B2B/i, ko: 'B2B 솔루션', en: 'B2B solution', industry: 'B2B_MFG', weight: 4 },
	// —— local B2C ——
	{ pattern: /부동산|부동산중개|real\s*estate/i, ko: '부동산', en: 'real estate', industry: 'LOCAL_STORE', weight: 6 },
	{ pattern: /카페|맛집|음식점|레스토랑|restaurant|cafe/i, ko: '맛집/카페', en: 'restaurant/cafe', industry: 'LOCAL_STORE', weight: 5 },
	{ pattern: /학원|어학원|academy|tutoring/i, ko: '학원', en: 'academy', industry: 'LOCAL_STORE', weight: 5 },
	{ pattern: /인테리어|interior\s*design/i, ko: '인테리어', en: 'interior design', industry: 'LOCAL_STORE', weight: 5 },
	// Weak beauty/wellness — never outranks medical context or plastic-strong terms
	{ pattern: /뷰티웰빙|웰빙센터|뷰티케어/i, ko: '뷰티/웰빙', en: 'beauty/wellness', industry: 'LOCAL_STORE', weight: 1 },
	{ pattern: /미용|헤어|네일|뷰티|salon|beauty/i, ko: '뷰티/미용', en: 'beauty/salon', industry: 'LOCAL_STORE', weight: 2 },
];

const GENERAL_CLINIC_RULE: KeywordRule = {
	pattern: /병원|의원|클리닉|clinic|hospital|medical/i,
	ko: '일반의원',
	en: 'general clinic',
	industry: 'MEDICAL',
	medicalKind: 'clinic',
	weight: 5,
};

const SPECIALTY_CLINIC_RULE: KeywordRule = {
	pattern: /통증|정형|재활|내과/,
	ko: '전문클리닉',
	en: 'specialty clinic',
	industry: 'MEDICAL',
	medicalKind: 'clinic',
	weight: 6,
};

const SCHEMA_INDUSTRY: Record<string, { ko: string; en: string; industry: IndustryType; medicalKind?: KeywordRule['medicalKind'] }> = {
	Dentist: { ko: '치과', en: 'dental clinic', industry: 'MEDICAL', medicalKind: 'dental' },
	MedicalClinic: { ko: '의원', en: 'medical clinic', industry: 'MEDICAL', medicalKind: 'clinic' },
	Physician: { ko: '병원', en: 'physician practice', industry: 'MEDICAL', medicalKind: 'clinic' },
	Hospital: { ko: '병원', en: 'hospital', industry: 'MEDICAL', medicalKind: 'clinic' },
	VeterinaryCare: { ko: '반려동물 병원', en: 'pet hospital', industry: 'MEDICAL', medicalKind: 'vet' },
	Pharmacy: { ko: '약국', en: 'pharmacy', industry: 'MEDICAL', medicalKind: 'clinic' },
	BeautySalon: { ko: '뷰티 살롱', en: 'beauty salon', industry: 'LOCAL_STORE' },
	HairSalon: { ko: '헤어 살롱', en: 'hair salon', industry: 'LOCAL_STORE' },
	HealthClub: { ko: '피트니스', en: 'health club', industry: 'LOCAL_STORE' },
	ExerciseGym: { ko: '헬스장', en: 'gym', industry: 'LOCAL_STORE' },
	EducationalOrganization: { ko: '학원', en: 'academy', industry: 'LOCAL_STORE' },
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
	EmploymentAgency: { ko: '에이전시', en: 'agency', industry: 'B2B_MFG' },
	EventAgency: { ko: '행사 에이전시', en: 'event agency', industry: 'B2B_MFG' },
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

export { classifyMetaKeywords } from '@/lib/geo/brand-entities';

function splitKeywordList(raw: string | undefined | null): string[] {
	if (!raw) return [];
	return raw
		.split(/[,|/·;]/)
		.map((part) => cleanText(part, 40))
		.filter(Boolean);
}

function uniqDetectedKeywords(items: Array<string | undefined | null>, limit = 16): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = cleanText(raw, 40);
		if (!v || v.length < 2) continue;
		const key = v.toLowerCase();
		if (seen.has(key) || GENERIC_KEYWORDS.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

type DetectedKeywordBag = Partial<SiteMetadata> & {
	extractedKeywords?: string[] | null;
};

/** Rebuilds As-Is keywords from persisted crawl fields (legacy reports included). */
export function collectDetectedKeywordsFromMeta(meta: DetectedKeywordBag | null | undefined): string[] {
	if (!meta) return [];
	if (meta.detectedKeywords?.length) {
		return uniqDetectedKeywords([
			...meta.detectedKeywords,
			...(meta.extractedKeywords ?? []),
			...splitKeywordList(meta.metaKeywords),
		]);
	}
	return uniqDetectedKeywords([
		...splitKeywordList(meta.metaKeywords),
		...(meta.extractedKeywords ?? []),
		...(meta.entityPhrases ?? []),
		...(meta.needSignals ?? []),
		meta.businessEntity,
		meta.primaryKeyword,
		meta.category,
		meta.brandName,
		meta.location,
		meta.broadLocation,
	]);
}

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
	const hasBeautyWeak = BEAUTY_WEAK_RE.test(corpus);
	const hasGeneralMedical = GENERAL_MEDICAL_RE.test(corpus);
	const industrialOnly = PLASTIC_INDUSTRIAL_RE.test(corpus) && !PLASTIC_STRONG_RE.test(corpus);
	const hasPlasticStrong = PLASTIC_STRONG_RE.test(corpus) && !industrialOnly;

	let best: KeywordRule | null = null;
	let bestWeight = -1;
	for (const rule of PRIMARY_KEYWORD_RULES) {
		rule.pattern.lastIndex = 0;
		if (!rule.pattern.test(corpus)) continue;
		if (rule.medicalKind === 'plastic' && (!hasPlasticStrong || industrialOnly)) continue;
		const weight = rule.weight ?? 1;
		if (weight > bestWeight) {
			best = rule;
			bestWeight = weight;
		}
	}

	if (best?.industry === 'LOCAL_STORE' && hasBeautyWeak && hasGeneralMedical && !hasPlasticStrong) {
		return /통증의학|정형외과|재활의학|내과/.test(corpus)
			? SPECIALTY_CLINIC_RULE
			: GENERAL_CLINIC_RULE;
	}

	return best;
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
		businessEntity: meta.businessEntity || primaryKeyword,
		entityPhrases: meta.entityPhrases,
		needSignals: meta.needSignals,
		metaKeywords: meta.metaKeywords,
		detectedKeywords: meta.detectedKeywords?.length
			? meta.detectedKeywords
			: collectDetectedKeywordsFromMeta(meta),
		title: meta.title,
		metaDescription: meta.metaDescription,
		ogTitle: meta.ogTitle,
		ogDescription: meta.ogDescription,
		schemaKnowsAbout: meta.schemaKnowsAbout,
		schemaEntityTypes: meta.schemaEntityTypes,
		h2Texts: meta.h2Texts,
		navMenuTexts: meta.navMenuTexts,
		coreSpecialties: meta.coreSpecialties?.length
			? meta.coreSpecialties
			: extractCoreSpecialties({
					title: meta.title,
					metaKeywords: meta.metaKeywords,
					navMenuTexts: meta.navMenuTexts,
					description: meta.metaDescription,
					ogTitle: meta.ogTitle,
					ogDescription: meta.ogDescription,
					schemaTerms: meta.schemaKnowsAbout,
					targetKeywords: meta.detectedKeywords,
					category: meta.category,
					primaryKeyword,
					h2Texts: meta.h2Texts,
				}),
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
	const metaKeywords = cleanText($('meta[name="keywords"]').attr('content'), 200);
	const ogTitle = cleanText($('meta[property="og:title"]').attr('content'), 160);
	const ogSiteName = cleanText($('meta[property="og:site_name"]').attr('content'), 80);
	const ogDescription = cleanText($('meta[property="og:description"]').attr('content'), 240);
	const ogImage = cleanText($('meta[property="og:image"]').attr('content'), 400);
	const h1List = collectHeadings($, 'h1', 3);
	const h2List = collectHeadings($, 'h2', 8);
	const bodySnippets = collectHeadings($, 'p, li', 12);
	const h1 = h1List[0] || '';
	const navMenuTexts = filterNavMenuTexts(extractNavItems($, pageUrl, 24).map((item) => item.name));

	const nodes = readNodes($, rawHtml);
	const logoUrl = extractSiteLogoUrl($, pageUrl, { rawHtml, schemaNodes: nodes, ogImage });
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
		metaKeywords,
		...navMenuTexts,
		...h1List,
		...h2List,
		...bodySnippets,
		...schemaDescriptions,
		...schemaKnowsAbout,
		...schemaSpecialties,
		...schemaTypes,
		domain,
		pageUrl,
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

	const location = formatColloquialLocation(
		cleanText(schemaLocation, 40) ||
			extractLocationFromText([title, ogTitle, metaDescription, h1, corpus].join(' ')),
	);

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

	const coreSpecialties = extractCoreSpecialties({
		title,
		metaKeywords,
		navMenuTexts,
		description: metaDescription,
		ogTitle,
		ogDescription,
		schemaTerms: [...schemaKnowsAbout, ...schemaSpecialties],
		targetKeywords: splitKeywordList(metaKeywords),
		category: primaryKeyword,
		primaryKeyword,
		h2Texts: h2List,
		lang,
	});
	const consultLike = /상담|연구소|에이전시|agency|consult/i.test(`${title} ${brandName} ${primaryKeyword}`);
	if (medicalKind === 'plastic' && !coreSpecialties.some((s) => /성형외과|plastic/i.test(s))) {
		medicalKind = 'clinic';
		if (coreSpecialties[0]) primaryKeyword = coreSpecialties[0];
	}
	if (coreSpecialties[0] && industryType === 'MEDICAL' && !consultLike) {
		primaryKeyword = coreSpecialties[0];
	} else if (coreSpecialties[0] && (!primaryKeyword || primaryKeyword === (lang === 'ko' ? '일반의원' : 'general clinic'))) {
		primaryKeyword = coreSpecialties[0];
		industryType = 'MEDICAL';
		medicalKind = 'clinic';
	}

	const entityProfile = buildSiteEntityProfile({
		title,
		metaDescription,
		ogTitle,
		ogDescription,
		headings: [...h1List, ...h2List, ...navMenuTexts],
		bodySnippets,
		keywords: [...schemaKnowsAbout, ...schemaSpecialties, ...splitKeywordList(metaKeywords), ...coreSpecialties],
		brandName,
		primaryKeyword,
		category: primaryKeyword,
		location,
		lang,
	});
	if (entityProfile.businessEntity && !GENERIC_KEYWORDS.has(entityProfile.businessEntity.toLowerCase())) {
		if (consultLike || !coreSpecialties[0]) {
			primaryKeyword = entityProfile.businessEntity;
		}
	}

	const personNodes = nodes.filter((n) => hasType(n, 'Person'));
	const schemaPersonName = personNodes.map((n) => cleanText(n.name, 40)).find(Boolean);
	const schemaJobTitle = personNodes.map((n) => cleanText(n.jobTitle, 40)).find(Boolean);
	const footerText = extractFooterLegalText($);
	const extractedRep = extractRepresentative(
		[footerText, rawHtml ?? '', schemaPersonName ? `"@type":"Person","name":"${schemaPersonName}","jobTitle":"${schemaJobTitle || ''}"` : '']
			.filter(Boolean)
			.join('\n'),
		lang === 'en' ? 'en' : 'ko',
	);
	const representativeName = extractedRep.isExtracted ? extractedRep.name : schemaPersonName || undefined;
	const representativeJobTitle = extractedRep.isExtracted
		? extractedRep.jobTitle
		: schemaJobTitle || undefined;

	const classifiedKeywords = classifyMetaKeywords({
		brandName,
		name: schemaNames[0] || ogSiteName,
		title,
		ogTitle,
		ogSiteName,
		keywords: metaKeywords,
		keywordList: [...schemaKnowsAbout, ...schemaSpecialties, ...coreSpecialties],
		description: [metaDescription, ogDescription].filter(Boolean).join(' '),
		representativeName,
		personNames: schemaPersonName ? [schemaPersonName] : [],
		domain,
	});
	const detectedKeywords = uniqDetectedKeywords([
		...classifiedKeywords.categoryNouns,
		...splitKeywordList(metaKeywords),
		...schemaKnowsAbout,
		...schemaSpecialties,
		...coreSpecialties,
		...navMenuTexts,
		...entityProfile.entityPhrases,
		...entityProfile.needSignals,
		entityProfile.businessEntity,
		primaryKeyword,
		location,
		broadLocation,
	]);

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
		businessEntity: entityProfile.businessEntity,
		entityPhrases: entityProfile.entityPhrases,
		needSignals: entityProfile.needSignals,
		metaKeywords,
		detectedKeywords,
		brandEntities: classifiedKeywords.brandEntities,
		serviceKeywords: classifiedKeywords.categoryNouns,
		representativeName,
		representativeJobTitle,
		title,
		metaDescription,
		ogTitle: ogTitle || undefined,
		ogDescription: ogDescription || undefined,
		ogImage: ogImage || undefined,
		logoUrl: logoUrl || undefined,
		schemaKnowsAbout: (() => {
			const list = cleanMedicalEntities(uniqDetectedKeywords([...schemaKnowsAbout, ...schemaSpecialties], 16), {
				plasticOk: coreSpecialties.some((s) => /성형외과|plastic/i.test(s)),
				limit: 12,
			});
			return list.length ? list : undefined;
		})(),
		schemaEntityTypes: schemaTypes.length ? schemaTypes : undefined,
		h2Texts: h2List.length ? h2List : undefined,
		navMenuTexts: navMenuTexts.length ? navMenuTexts : undefined,
		coreSpecialties: coreSpecialties.length ? coreSpecialties : undefined,
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
	location?: string;
	brandName: string;
	primaryKeyword: string;
	industryType: string;
	needSignals?: string[];
}): string {
	const keyword = safePrimaryKeyword(data.primaryKeyword) || data.primaryKeyword.trim();
	const focus = keyword || (data.industryType === 'MEDICAL' ? '클리닉' : '서비스');
	const region = data.location || data.broadLocation;
	if (data.industryType === 'MEDICAL') {
		return buildMedicalSimulatorQuery(region, focus, 'ko');
	}
	const needs = [...(data.needSignals ?? [])];
	if (/상담/.test(focus) && !needs.includes('상담')) needs.push('상담');
	if (/야간/.test(focus) && !needs.includes('야간진료')) needs.push('야간진료');
	return buildConversationalQuery({
		lang: 'ko',
		location: region,
		entity: focus,
		needSignals: needs,
	});
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
		location: data.location,
		brandName: data.brandName,
		primaryKeyword: data.primaryKeyword,
		industryType: data.industryType,
	});
}

function generateBroadQueryEn(data: {
	broadLocation: string;
	location?: string;
	primaryKeyword: string;
	industryType: IndustryType;
	needSignals?: string[];
}): string {
	const city = data.location || data.broadLocation;
	const keyword = safePrimaryKeyword(data.primaryKeyword);
	const focus =
		keyword ||
		(data.industryType === 'MEDICAL' ? 'clinic' : data.industryType === 'B2B_MFG' ? 'company' : 'services');
	if (data.industryType === 'MEDICAL') {
		return buildMedicalSimulatorQuery(city, focus, 'en');
	}
	const needs = [...(data.needSignals ?? [])];
	if (/consult/i.test(focus) && !needs.includes('consultation')) needs.push('consultation');
	if (/evening/i.test(focus) && !needs.includes('evening hours')) needs.push('evening hours');
	return buildConversationalQuery({
		lang: 'en',
		location: city,
		entity: focus,
		needSignals: needs,
	});
}

/** Builds a metro-scale AI-search user query from extracted site metadata. */
export function generateUserQuery(meta: SiteMetadata, lang: AuditLang = 'ko'): string {
	const m = normalizeLegacyMeta(meta);
	const broad = broadLocationLabel(m.broadLocation, lang);
	const entity = m.businessEntity || m.primaryKeyword;
	if (lang === 'en') {
		return generateBroadQueryEn({
			broadLocation: broad,
			location: m.location,
			primaryKeyword: entity,
			industryType: m.industryType,
			needSignals: m.needSignals,
		});
	}
	return generateBroadQuery({
		broadLocation: m.broadLocation,
		location: m.location,
		brandName: m.brandName,
		primaryKeyword: entity,
		industryType: m.industryType,
		needSignals: m.needSignals,
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
