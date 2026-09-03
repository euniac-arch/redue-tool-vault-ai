/**
 * Universal SoV category guardrail.
 * Resolves the audited site's industry from schema @type / registry metadata,
 * keeps only same-vertical competitors, and rewrites building/floor queries
 * so hotel owners and off-floor F&B do not leak into the 1–3 leaderboard.
 */

import {
	detectIndustry,
	fromLegacyAuditIndustry,
	getIndustryProfile,
	isIndustryType,
	type IndustryType,
	type RegistryLang,
} from '@/lib/registry/universalIndustryRegistry';

export type SovIndustryFamily =
	| 'medical_clinic'
	| 'dental'
	| 'legal'
	| 'accounting'
	| 'beauty'
	| 'education'
	| 'fitness'
	| 'veterinary'
	| 'realestate'
	| 'interior'
	| 'professional'
	| 'hospitality'
	| 'fnb'
	| 'retail'
	| 'generic';

export type SovIndustryContext = {
	categoryName?: string;
	mainService?: string;
	region?: string;
	query?: string;
	industryType?: string;
	schemaTypes?: readonly string[];
	lang?: RegistryLang;
};

export type TargetIndustryProfile = {
	type: IndustryType;
	family: SovIndustryFamily;
	/** Prompt / UI label, e.g. `Medical / Dermatology`. */
	label: string;
	searchNoun: string;
	peerHint: RegExp;
};

const SCHEMA_INDUSTRY: Array<{ test: RegExp; type: IndustryType }> = [
	{ test: /VeterinaryCare/i, type: 'veterinary' },
	{ test: /Dentist|MedicalClinic|MedicalBusiness|Hospital|Physician|Pharmacy/i, type: 'medical' },
	{ test: /LegalService|Attorney|Notary/i, type: 'legal' },
	{ test: /AccountingService|FinancialService/i, type: 'accounting' },
	{ test: /BeautySalon|HairSalon|NailSalon|DaySpa|HealthAndBeauty/i, type: 'beauty' },
	{ test: /Restaurant|CafeOrCoffeeShop|FoodEstablishment|Bakery|BarOrPub/i, type: 'restaurant' },
	{ test: /EducationalOrganization|School|CollegeOrUniversity/i, type: 'education' },
	{ test: /RealEstateAgent/i, type: 'realestate' },
	{ test: /HealthClub|ExerciseGym|SportsActivityLocation/i, type: 'fitness' },
	{ test: /HomeAndConstructionBusiness|GeneralContractor/i, type: 'interior' },
	{ test: /ProfessionalService|SoftwareApplication/i, type: 'professional' },
];

const FAMILY_BY_TYPE: Record<IndustryType, SovIndustryFamily> = {
	medical: 'medical_clinic',
	legal: 'legal',
	accounting: 'accounting',
	beauty: 'beauty',
	interior: 'interior',
	fitness: 'fitness',
	veterinary: 'veterinary',
	education: 'education',
	realestate: 'realestate',
	restaurant: 'fnb',
	professional: 'professional',
	general: 'generic',
};

const PEER_HINT: Record<IndustryType, RegExp> = {
	medical:
		/피부과|피부시술|피부미용|성형|에스테틱|리프팅|보톡스|필러|의원|클리닉|병원|한의원|정형|재활|도수|통증|안과|산부인과|내과|치과|임플란트|dermatol|plastic|aesthetic|clinic|hospital|medical|physician/i,
	legal: /법률|변호사|법무|로펌|law|attorney|legal/i,
	accounting: /세무|회계|기장|tax|cpa|accounting/i,
	beauty: /미용|헤어|네일|피부관리|살롱|에스테틱|salon|hair|nail|spa|beauty/i,
	interior: /인테리어|시공|리모델링|interior|remodel/i,
	fitness: /헬스|필라테스|요가|피트니스|gym|pilates|fitness|yoga/i,
	veterinary: /동물병원|수의|vet|veterinary/i,
	education: /학원|학교|입시|교육|academy|school|tutoring|education/i,
	realestate: /부동산|공인중개|중개사|realty|realtor|estate/i,
	restaurant: /식당|레스토랑|맛집|카페|뷔페|키친|베이커리|음식|restaurant|cafe|kitchen|bakery|dining/i,
	professional: /에이전시|대행|컨설팅|소프트웨어|saas|agency|consulting|studio/i,
	general: /./,
};

const VERTICAL_NAME: Array<{ type: IndustryType; test: RegExp }> = [
	{ type: 'veterinary', test: /동물병원|수의|veterinary|\bvet\b/i },
	{ type: 'medical', test: /피부과|성형|의원|병원|클리닉|한의원|정형|치과|medical|clinic|hospital|dentist|dermatol/i },
	{ type: 'legal', test: /법률|변호사|법무|로펌|attorney|legal/i },
	{ type: 'accounting', test: /세무|회계|tax|cpa|accounting/i },
	{ type: 'beauty', test: /미용실|헤어샵|네일샵|살롱|salon|hair|nail/i },
	{ type: 'education', test: /학원|학교|입시|academy|school/i },
	{ type: 'fitness', test: /헬스장|필라테스|요가|피트니스|gym|pilates/i },
	{ type: 'realestate', test: /부동산|공인중개|realty|realtor/i },
	{ type: 'interior', test: /인테리어|시공|remodel|interior/i },
	{ type: 'restaurant', test: /식당|레스토랑|맛집|카페|뷔페|키친|베이커리|restaurant|cafe|kitchen|bakery/i },
	{ type: 'professional', test: /에이전시|대행|컨설팅|agency|consulting/i },
];

const BUILDING_OWNER =
	/빌딩|타워|플라자|오피스텔|상가|복합몰|오피스\b|공단|산업단지/i;
const PUBLIC_INSTITUTION =
	/시청|구청|군청|주민센터|출장소|도서관|박물관|경찰서|소방서|우체국|보건소/i;
const HOTEL_LODGING =
	/호텔|숙박|리조트|모텔|게스트하우스|펜션|marriott|hilton|hyatt|novotel|ibis|hotel|resort|motel|lodging/i;
const HOTEL_BRAND_BARE =
	/(메리어트|marriott|힐튼|hilton|하얏트|hyatt|노보텔|novotel|이비스|ibis|워커힐|조선호텔|롯데호텔|신라호텔|웨스틴|westin|sheraton|쉐라톤)(?!.*(?:의원|병원|클리닉|피부과|성형|치과|법무|학원|샵|식당|카페))/i;
const FNB_NAME =
	/뷔페|식당|레스토랑|맛집|키친|카페|커피|베이커리|술집|펍|바\b|buffet|restaurant|kitchen|cafe|bakery/i;
const RETAIL_NAME = /마트|백화점|쇼핑몰|아울렛|편의점|supermarket|mall|department/i;
const PLACE_QUERY =
	/메리어트|marriott|호텔|hotel|빌딩|타워|플라자|몰\b|아울렛|센터|오피스텔|상가|입점|\d+\s*층|층\b|지하|로비|호실/i;

const NAVER_GOOGLE_CATEGORY: Record<IndustryType | 'noise', RegExp> = {
	medical: /병원|의원|클리닉|의료|치과|hospital|doctor|dentist|health/i,
	legal: /법률|법무|변호|attorney|lawyer|legal/i,
	accounting: /세무|회계|tax|accounting/i,
	beauty: /미용|헤어|네일|뷰티|salon|beauty|spa/i,
	interior: /인테리어|시공|interior/i,
	fitness: /헬스|피트니스|gym|fitness/i,
	veterinary: /동물병원|수의|veterinary/i,
	education: /학원|학교|교육|academy|school/i,
	realestate: /부동산|중개|real.?estate/i,
	restaurant: /음식|식당|카페|뷔페|맛집|restaurant|food|cafe|bar|bakery|meal_/i,
	professional: /서비스|대행|컨설팅|agency|consulting/i,
	general: /./,
	noise: /숙박|호텔|모텔|리조트|lodging|shopping_mall|department_store|supermarket|convenience_store|store/i,
};

function corpusOf(ctx: SovIndustryContext): string {
	return [
		ctx.industryType,
		ctx.categoryName,
		ctx.mainService,
		ctx.query,
		...(ctx.schemaTypes ?? []),
	]
		.filter(Boolean)
		.join(' ');
}

function industryFromSchema(types: readonly string[] | undefined): IndustryType | null {
	const hay = (types ?? []).join(' ');
	if (!hay) return null;
	for (const row of SCHEMA_INDUSTRY) {
		if (row.test.test(hay)) return row.type;
	}
	return null;
}

function refineMedicalFamily(hay: string): SovIndustryFamily {
	return /치과|임플란트|교정|dental|implant|ortho/i.test(hay) ? 'dental' : 'medical_clinic';
}

function subtypeLabel(type: IndustryType, hay: string, lang: RegistryLang): { ko: string; en: string } {
	if (type === 'medical') {
		if (/치과|dental|implant/i.test(hay)) return { ko: '치과', en: 'Dental' };
		if (/성형|plastic/i.test(hay)) return { ko: '성형외과', en: 'Plastic Surgery' };
		if (/피부|에스테틱|dermatol|aesthetic/i.test(hay)) return { ko: '피부과', en: 'Dermatology' };
		return { ko: '병의원', en: 'Clinic' };
	}
	if (type === 'legal') return { ko: '법무법인', en: 'Law Firm' };
	if (type === 'accounting') return { ko: '세무회계', en: 'Tax & Accounting' };
	if (type === 'beauty') return { ko: '뷰티샵', en: 'Beauty Salon' };
	if (type === 'restaurant') return { ko: 'F&B', en: 'F&B' };
	if (type === 'education') return { ko: '교육기관', en: 'Education' };
	if (type === 'fitness') return { ko: '피트니스', en: 'Fitness' };
	if (type === 'veterinary') return { ko: '동물병원', en: 'Veterinary' };
	if (type === 'realestate') return { ko: '부동산', en: 'Real Estate' };
	if (type === 'interior') return { ko: '인테리어', en: 'Interior' };
	if (type === 'professional') return { ko: '전문 서비스', en: 'Professional Service' };
	const profile = getIndustryProfile(type);
	return { ko: profile.label.ko, en: profile.label.en };
}

function searchNounFor(type: IndustryType, mainService: string, lang: RegistryLang): string {
	const service = (mainService || '').replace(/\s+/g, ' ').trim();
	if (type === 'medical' || type === 'legal' || type === 'veterinary') {
		const sub = subtypeLabel(type, `${service} ${mainService}`, lang);
		return lang === 'en' ? sub.en.toLowerCase() : sub.ko;
	}
	if (service && type !== 'general') return service;
	const sub = subtypeLabel(type, service, lang);
	return lang === 'en' ? sub.en.toLowerCase() : sub.ko;
}

export function resolveTargetIndustry(ctx: SovIndustryContext = {}): TargetIndustryProfile {
	const lang: RegistryLang = ctx.lang === 'en' ? 'en' : 'ko';
	const hay = corpusOf(ctx);
	const mappedType = isIndustryType(ctx.industryType)
		? ctx.industryType
		: fromLegacyAuditIndustry(ctx.industryType);
	const fromType = mappedType !== 'general' ? mappedType : null;
	const fromSchema = industryFromSchema(ctx.schemaTypes);
	const fromText = detectIndustry({
		title: ctx.categoryName,
		keywords: [ctx.mainService, ctx.categoryName].filter(Boolean).join(' '),
		extraText: hay,
	});
	const type = fromType ?? (fromSchema && fromSchema !== 'general' ? fromSchema : fromText);
	const family =
		type === 'medical' ? refineMedicalFamily(hay) : type === 'restaurant' ? 'fnb' : FAMILY_BY_TYPE[type];
	const sub = subtypeLabel(type, hay, lang);
	const familyHead: Record<IndustryType, string> = {
		medical: 'Medical',
		legal: 'Legal',
		accounting: 'Accounting',
		beauty: 'Beauty',
		interior: 'Interior',
		fitness: 'Fitness',
		veterinary: 'Veterinary',
		education: 'Education',
		realestate: 'Real Estate',
		restaurant: 'F&B',
		professional: 'Professional',
		general: 'General',
	};
	const label = `${familyHead[type]} / ${sub.en}`;
	return {
		type,
		family,
		label,
		searchNoun: searchNounFor(type, ctx.mainService || ctx.categoryName || '', lang),
		peerHint: PEER_HINT[type],
	};
}

export function detectSovIndustryFamily(ctx: SovIndustryContext): SovIndustryFamily {
	const hay = corpusOf(ctx);
	if (/호텔|숙박|hotel|lodging/i.test(hay) && !PEER_HINT.medical.test(hay) && !PEER_HINT.legal.test(hay)) {
		return 'hospitality';
	}
	if (/쇼핑몰|마트|유통|retail/i.test(hay) && !PEER_HINT.medical.test(hay)) return 'retail';
	return resolveTargetIndustry(ctx).family;
}

export function looksLikePlaceOrBuildingQuery(query: string, ctx?: SovIndustryContext): boolean {
	const q = (query || '').replace(/^#/, '').trim();
	if (!q || !PLACE_QUERY.test(q)) return false;
	const industry = resolveTargetIndustry({ ...ctx, query: q });
	if (industry.type !== 'general' && industry.peerHint.test(q) && industry.type !== 'restaurant') {
		return false;
	}
	if (industry.type === 'restaurant' && /식당|맛집|카페|레스토랑|restaurant|cafe/i.test(q) && !/\d+\s*층|층\b|입점|빌딩|타워/.test(q)) {
		return false;
	}
	return true;
}

export function industrySearchNoun(
	family: SovIndustryFamily,
	mainService = '',
	lang: 'ko' | 'en' = 'ko',
): string {
	const mapped: IndustryType =
		family === 'dental' || family === 'medical_clinic'
			? 'medical'
			: family === 'fnb'
				? 'restaurant'
				: family === 'hospitality' || family === 'retail' || family === 'generic'
					? 'general'
					: isIndustryType(family)
						? family
						: 'general';
	return searchNounFor(mapped, mainService, lang);
}

function locationTokens(query: string, region = ''): string {
	const bits = [region, query.replace(/^#/, '')]
		.join(' ')
		.replace(/메리어트|marriott|호텔|hotel|\d+\s*층|층|빌딩|타워|플라자|오피스텔|상가|입점|지하|로비|호실/gi, ' ')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	const seen = new Set<string>();
	const keep: string[] = [];
	for (const token of bits.split(' ')) {
		if (token.length < 2 || /추천|후기|가격|예약/.test(token)) continue;
		if (seen.has(token)) continue;
		seen.add(token);
		keep.push(token);
		if (keep.length >= 4) break;
	}
	return keep.join(' ').trim();
}

/** Keep the chip label; rewrite the live search string so place queries include the vertical. */
export function rewriteSovSearchQuery(query: string, ctx: SovIndustryContext, lang: 'ko' | 'en' = 'ko'): string {
	const raw = (query || '').replace(/^#/, '').replace(/\s+/g, ' ').trim();
	if (!raw || !looksLikePlaceOrBuildingQuery(raw, ctx)) return raw;
	const industry = resolveTargetIndustry({ ...ctx, query: raw, lang });
	if (industry.type === 'general') return raw;
	const loc = locationTokens(raw, ctx.region) || (ctx.region || '').trim();
	const noun = industry.searchNoun;
	return [loc, noun].filter(Boolean).join(' ').trim() || raw;
}

function inferListingType(name: string, categoryOrTypes = ''): IndustryType | 'noise' | null {
	const hay = `${name} ${categoryOrTypes}`;
	if (HOTEL_LODGING.test(hay) || HOTEL_BRAND_BARE.test(name) || NAVER_GOOGLE_CATEGORY.noise.test(categoryOrTypes)) {
		return 'noise';
	}
	if (BUILDING_OWNER.test(name) && !VERTICAL_NAME.some((row) => row.test.test(name))) return 'noise';
	if (PUBLIC_INSTITUTION.test(name)) return 'noise';
	if (RETAIL_NAME.test(hay) && !PEER_HINT.restaurant.test(name)) return 'noise';
	for (const row of VERTICAL_NAME) {
		if (row.test.test(hay) || NAVER_GOOGLE_CATEGORY[row.type].test(categoryOrTypes)) return row.type;
	}
	return null;
}

export function isOffIndustryListing(
	name: string,
	family: SovIndustryFamily,
	categoryOrTypes = '',
	ctx?: SovIndustryContext,
): boolean {
	const listing = (name || '').trim();
	if (!listing) return true;
	const industry = resolveTargetIndustry({
		...ctx,
		categoryName: ctx?.categoryName,
		mainService: ctx?.mainService,
		industryType: ctx?.industryType || (family === 'fnb' ? 'restaurant' : family === 'medical_clinic' || family === 'dental' ? 'medical' : family),
	});
	const implied = inferListingType(listing, categoryOrTypes);
	if (implied === 'noise') {
		return industry.type !== 'restaurant' || !FNB_NAME.test(listing);
	}
	if (implied && implied !== industry.type) {
		if (industry.type === 'medical' && implied === 'beauty' && /에스테틱|피부/.test(listing)) return false;
		if (industry.type === 'beauty' && implied === 'medical' && /에스테틱|피부관리/.test(listing)) return false;
		return true;
	}
	if (industry.type === 'legal' && /부동산|세무|회계/.test(listing) && !/법률|법무|변호/.test(listing)) {
		return true;
	}
	if (industry.type === 'medical' && /치과|임플란트/.test(listing) && /피부|성형|미용|에스테틱|dermatol/i.test(corpusOf(ctx ?? {}))) {
		return !/피부|성형|미용/.test(listing);
	}
	if (implied === industry.type) return false;
	if (industry.type === 'general') return false;
	if (HOTEL_BRAND_BARE.test(listing) || (HOTEL_LODGING.test(listing) && !industry.peerHint.test(listing))) return true;
	if (industry.type !== 'restaurant' && FNB_NAME.test(listing) && !industry.peerHint.test(listing)) return true;
	if (BUILDING_OWNER.test(listing) && !industry.peerHint.test(listing)) return true;
	if (PUBLIC_INSTITUTION.test(listing)) return true;
	return false;
}

export function isSameIndustryPeer(name: string, family: SovIndustryFamily, categoryOrTypes = '', ctx?: SovIndustryContext): boolean {
	if (isOffIndustryListing(name, family, categoryOrTypes, ctx)) return false;
	const industry = resolveTargetIndustry({ ...ctx, industryType: ctx?.industryType || family });
	return industry.peerHint.test(`${name} ${categoryOrTypes}`) || industry.type === 'general';
}

export function filterIndustryListings<T extends { name: string; category?: string; types?: string[] }>(
	listings: readonly T[],
	ctx: SovIndustryContext,
): T[] {
	const family = detectSovIndustryFamily(ctx);
	return listings.filter((row) => {
		const meta = [row.category, ...(row.types || [])].filter(Boolean).join(' ');
		return !isOffIndustryListing(row.name, family, meta, ctx);
	});
}

export function filterIndustryNames(names: readonly string[], ctx: SovIndustryContext): string[] {
	const family = detectSovIndustryFamily(ctx);
	return names.filter((name) => !isOffIndustryListing(name, family, '', ctx));
}

export function nearbyIndustryPeerLabels(
	ctx: SovIndustryContext,
	lang: RegistryLang = 'ko',
	limit = 2,
): string[] {
	const industry = resolveTargetIndustry({ ...ctx, lang });
	const loc = (ctx.region || '').replace(/\s+/g, ' ').trim();
	const noun = industry.searchNoun;
	const rows =
		lang === 'en'
			? [loc ? `Nearby ${noun} within 3km` : `Nearby ${noun} within 3km`, loc ? `${loc} area ${noun}` : `Local ${noun}`]
			: [loc ? `${loc} 인근 동종 ${noun}` : `인근 동종 ${noun}`, loc ? `${loc} 반경 3km ${noun}` : `반경 3km ${noun}`];
	return rows.slice(0, limit);
}

export function isPlaceMonopolyQuery(query: string, ctx?: SovIndustryContext): boolean {
	return looksLikePlaceOrBuildingQuery(query, ctx);
}

export function buildSovIndustryPromptGuide(ctx: SovIndustryContext, query: string): string {
	const industry = resolveTargetIndustry({ ...ctx, query });
	const targetIndustry = industry.label;
	return [
		'[지침 - 업종 일관성 및 엔티티 정제]:',
		`1. 분석 대상 사이트의 주요 업종: ${targetIndustry}`,
		`2. 현재 분석 키워드: ${query}`,
		'3. 1~3위 경쟁사 선정 규칙:',
		`- 반드시 ${targetIndustry}와 직접 경쟁하는 동일/유사 업종의 브랜드·플레이스만 순위에 포함할 것.`,
		'- 건물명, 호텔, 식당, 공공기관 등 동종 경쟁사가 아닌 상호는 랭킹에서 무조건 제외(Blacklist)할 것.',
		'- 키워드가 자사의 고유 위치(건물/층수)를 가리킬 경우, 자사를 1위 독점으로 평가하고 타업종을 경쟁사로 올리지 말 것.',
	].join('\n');
}
