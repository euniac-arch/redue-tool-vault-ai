/**
 * Universal Compliant Dynamic Engine
 *
 * Binds report / prescription copy to the audited domain (brand, location,
 * services, schema) and keeps every vertical inside display-ads, e-commerce,
 * and specialty-advertising rules: no rank/guarantee claims, no comparative
 * “best / reviews / 잘하는 곳” queries, estimate footnotes on money.
 */

import { withJosa } from '@/lib/korean-josa';

export type CompliantLang = 'ko' | 'en';

export type CompliantIndustryKey =
	| 'medical'
	| 'legal'
	| 'accounting'
	| 'beauty'
	| 'interior'
	| 'fitness'
	| 'veterinary'
	| 'education'
	| 'realestate'
	| 'restaurant'
	| 'professional'
	| 'general';

export interface UniversalAuditData {
	domain: string;
	brandName: string;
	detectedCategory: string;
	schemaType: string;
	location: string;
	primaryKeywords: string[];
	scores?: {
		total?: number;
		aiTrust?: number;
		tech?: number;
		expectedScore?: number;
	};
	metrics?: {
		currentShare?: number;
		targetShare?: number;
		directoryShare?: number;
		clientRank?: number;
		estimatedMonthlyValue?: string;
		estimatedMaxGain?: string;
	};
	lang?: CompliantLang;
	industryType?: string | null;
}

export interface IndustryVoice {
	key: CompliantIndustryKey;
	categoryKo: string;
	categoryEn: string;
	schemaType: string;
	queryNeedKo: string;
	systemNounKo: string;
	placeNounKo: string;
}

export interface CompliantQuerySpectrum {
	level1: string;
	level2: string;
	level3: string;
}

export interface CompliantFaq {
	question: string;
	answer: string;
}

const VOICE: Record<CompliantIndustryKey, IndustryVoice> = {
	medical: {
		key: 'medical',
		categoryKo: '의료',
		categoryEn: 'Healthcare',
		schemaType: 'MedicalClinic',
		queryNeedKo: '진료',
		systemNounKo: '진료 시스템',
		placeNounKo: '곳',
	},
	legal: {
		key: 'legal',
		categoryKo: '법률',
		categoryEn: 'Legal',
		schemaType: 'LegalService',
		queryNeedKo: '상담',
		systemNounKo: '상담 절차',
		placeNounKo: '곳',
	},
	accounting: {
		key: 'accounting',
		categoryKo: '세무·회계',
		categoryEn: 'Accounting',
		schemaType: 'AccountingService',
		queryNeedKo: '상담',
		systemNounKo: '상담 절차',
		placeNounKo: '곳',
	},
	beauty: {
		key: 'beauty',
		categoryKo: '뷰티',
		categoryEn: 'Beauty',
		schemaType: 'BeautySalon',
		queryNeedKo: '예약',
		systemNounKo: '시술 안내',
		placeNounKo: '곳',
	},
	interior: {
		key: 'interior',
		categoryKo: '인테리어',
		categoryEn: 'Interior',
		schemaType: 'HomeAndConstructionBusiness',
		queryNeedKo: '상담',
		systemNounKo: '시공 상담',
		placeNounKo: '곳',
	},
	fitness: {
		key: 'fitness',
		categoryKo: '피트니스',
		categoryEn: 'Fitness',
		schemaType: 'HealthClub',
		queryNeedKo: '예약',
		systemNounKo: '이용 안내',
		placeNounKo: '곳',
	},
	veterinary: {
		key: 'veterinary',
		categoryKo: '동물병원',
		categoryEn: 'Veterinary',
		schemaType: 'VeterinaryCare',
		queryNeedKo: '진료',
		systemNounKo: '진료 안내',
		placeNounKo: '곳',
	},
	education: {
		key: 'education',
		categoryKo: '교육',
		categoryEn: 'Education',
		schemaType: 'EducationalOrganization',
		queryNeedKo: '상담',
		systemNounKo: '수강 안내',
		placeNounKo: '곳',
	},
	realestate: {
		key: 'realestate',
		categoryKo: '부동산',
		categoryEn: 'Real estate',
		schemaType: 'RealEstateAgent',
		queryNeedKo: '상담',
		systemNounKo: '매물 안내',
		placeNounKo: '곳',
	},
	restaurant: {
		key: 'restaurant',
		categoryKo: '외식업',
		categoryEn: 'Restaurant',
		schemaType: 'Restaurant',
		queryNeedKo: '예약',
		systemNounKo: '예약 및 메뉴',
		placeNounKo: '곳',
	},
	professional: {
		key: 'professional',
		categoryKo: 'IT 솔루션',
		categoryEn: 'IT / SaaS',
		schemaType: 'SoftwareApplication',
		queryNeedKo: '도입',
		systemNounKo: '도입 절차',
		placeNounKo: '기업',
	},
	general: {
		key: 'general',
		categoryKo: '일반',
		categoryEn: 'General business',
		schemaType: 'Organization',
		queryNeedKo: '안내',
		systemNounKo: '운영 시스템',
		placeNounKo: '곳',
	},
};

const SCHEMA_TO_KEY: Array<{ test: RegExp; key: CompliantIndustryKey }> = [
	{ test: /MedicalClinic|Hospital|Dentist|Physician/i, key: 'medical' },
	{ test: /VeterinaryCare/i, key: 'veterinary' },
	{ test: /LegalService|Attorney/i, key: 'legal' },
	{ test: /AccountingService/i, key: 'accounting' },
	{ test: /BeautySalon/i, key: 'beauty' },
	{ test: /HomeAndConstructionBusiness/i, key: 'interior' },
	{ test: /HealthClub|ExerciseGym/i, key: 'fitness' },
	{ test: /EducationalOrganization/i, key: 'education' },
	{ test: /RealEstateAgent/i, key: 'realestate' },
	{ test: /Restaurant|CafeOrCoffeeShop|FoodEstablishment/i, key: 'restaurant' },
	{ test: /SoftwareApplication|ProfessionalService/i, key: 'professional' },
	{ test: /OnlineStore|Store|Manufacturer/i, key: 'general' },
];

function clean(value: string | null | undefined): string {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function hayOf(input: {
	industryType?: string | null;
	schemaType?: string | null;
	category?: string | null;
	keywords?: string | readonly string[] | null;
	title?: string | null;
}): string {
	const keywords = Array.isArray(input.keywords) ? input.keywords.join(' ') : input.keywords || '';
	return `${input.industryType || ''} ${input.schemaType || ''} ${input.category || ''} ${keywords} ${input.title || ''}`;
}

export function resolveIndustryVoice(input: {
	industryType?: string | null;
	schemaType?: string | null;
	category?: string | null;
	keywords?: string | readonly string[] | null;
	title?: string | null;
	detectedCategory?: string | null;
}): IndustryVoice {
	const type = clean(input.industryType).toLowerCase();
	if (type === 'medical') return VOICE.medical;
	if (type === 'veterinary') return VOICE.veterinary;
	if (type === 'legal') return VOICE.legal;
	if (type === 'accounting') return VOICE.accounting;
	if (type === 'beauty') return VOICE.beauty;
	if (type === 'interior') return VOICE.interior;
	if (type === 'fitness') return VOICE.fitness;
	if (type === 'education') return VOICE.education;
	if (type === 'realestate') return VOICE.realestate;
	if (type === 'restaurant') return VOICE.restaurant;
	if (type === 'professional' || type === 'b2b_mfg') return VOICE.professional;
	if (type === 'local_store') {
		const localHay = hayOf(input);
		if (/카페|식당|맛집|레스토랑|restaurant|cafe/i.test(localHay)) return VOICE.restaurant;
		if (/병원|의원|클리닉|피부과|성형|치과/i.test(localHay)) return VOICE.medical;
		if (/법률|변호사|법무/i.test(localHay)) return VOICE.legal;
	}

	const schema = clean(input.schemaType);
	for (const row of SCHEMA_TO_KEY) {
		if (row.test.test(schema)) return VOICE[row.key];
	}

	const hay = hayOf(input);
	if (/법률|변호사|법무|law\s*firm|attorney|legal/i.test(hay)) return VOICE.legal;
	if (/세무|회계|tax|account/i.test(hay)) return VOICE.accounting;
	if (/동물병원|수의|veterinary|pet\s*clinic/i.test(hay)) return VOICE.veterinary;
	if (/병원|의원|클리닉|피부과|성형|치과|medical|clinic|hospital/i.test(hay)) return VOICE.medical;
	if (/인테리어|리모델링|시공|interior/i.test(hay)) return VOICE.interior;
	if (/피트니스|필라테스|헬스|gym|fitness/i.test(hay)) return VOICE.fitness;
	if (/학원|과외|입시|academy|tutoring/i.test(hay)) return VOICE.education;
	if (/부동산|중개|realty|real\s*estate/i.test(hay)) return VOICE.realestate;
	if (/카페|식당|맛집|레스토랑|restaurant|cafe/i.test(hay)) return VOICE.restaurant;
	if (/뷰티|미용|네일|salon|beauty/i.test(hay)) return VOICE.beauty;
	if (/saas|클라우드|소프트웨어|솔루션|software|cloud/i.test(hay)) return VOICE.professional;

	const detected = clean(input.detectedCategory);
	if (/법률/.test(detected)) return VOICE.legal;
	if (/외식|요식/.test(detected)) return VOICE.restaurant;
	if (/의료|병의원/.test(detected)) return VOICE.medical;
	if (/IT|솔루션|소프트웨어/.test(detected)) return VOICE.professional;

	return VOICE.general;
}

export function industryCategoryLabel(voice: IndustryVoice, lang: CompliantLang = 'ko'): string {
	return lang === 'en' ? voice.categoryEn : voice.categoryKo;
}

export function anonymizedCompetitorLabel(
	rank: number,
	lang: CompliantLang = 'ko',
	industryLabel?: string,
): string {
	const n = Number.isFinite(rank) ? Math.max(1, Math.min(Math.round(rank), 26)) : 1;
	const letter = String.fromCharCode(64 + n);
	const industry = clean(industryLabel);
	if (lang === 'en') {
		const base = n <= 2 ? `Competitor ${letter}` : `Competitor ${letter}`;
		return industry ? `${base} (${industry})` : base;
	}
	const base = `경쟁 ${letter}사`;
	return industry ? `${base} (${industry})` : base;
}

export function formatEstimatedAmount(value: string | number | null | undefined, lang: CompliantLang = 'ko'): string {
	const raw = String(value ?? '').replace(/[^\d]/g, '');
	if (!raw) return lang === 'en' ? '—(simulation estimate)' : '—원 *(시뮬레이션 추정치)';
	const formatted = Number(raw).toLocaleString('ko-KR');
	return lang === 'en'
		? `₩${formatted} *(simulation estimate)`
		: `${formatted}원 *(시뮬레이션 추정치)`;
}

export const ESTIMATE_FOOTNOTE_KO =
	'※ 키워드 평균 CPC와 질의 시뮬레이션을 역산한 이론적 추정치이며 실제 매출이나 특정 성과를 보증하지 않습니다.';
export const ESTIMATE_FOOTNOTE_EN =
	'※ Reverse-calculated from average keyword CPC and query simulations. This does not guarantee actual revenue or a specific outcome.';

const BANNED_CLAIM_RE =
	/1위\s*독점|영구\s*확보|100%\s*보장|3일\s*내\s*인용\s*완료|CTR\s*2배\s*급상승/gi;

export function softenBannedClaims(text: string): string {
	return (text || '')
		.replace(/1위\s*독점/g, '1위 추천 진입 목표')
		.replace(/영구\s*확보/g, '오가닉 유입 기반 구축')
		.replace(/100%\s*보장/g, '지표 회복 목표')
		.replace(/3일\s*내\s*인용\s*완료/g, '인용 확률 향상 지원')
		.replace(/CTR\s*2배\s*급상승/g, '지표 회복 목표');
}

export function softenComparativeQuery(query: string, voice?: IndustryVoice): string {
	const need = voice?.queryNeedKo || '안내';
	const system = voice?.systemNounKo || '운영 시스템';
	return softenBannedClaims(query || '')
		.replace(/믿을 만한 곳(?:\s*어디가 좋아)?\??/g, `${need} 안내`)
		.replace(/치료\s*솔루션(?:\s*의원)?\s*잘하는\s*곳(?:\s*추천해줘)?/g, '정밀 진료 시스템 갖춘 곳 안내해줘')
		.replace(/울트라클리어엘리트\s*잘하는\s*곳/g, '울트라클리어엘리트 도입 안내')
		.replace(/울트라클리어엘리트\s*후기/g, '울트라클리어엘리트 시스템 안내')
		.replace(/최고의\s+/g, '')
		.replace(/과잉진료\s*없이\s*|과다수수료\s*없는\s*/g, '')
		.replace(/(성형외과)\s*잘하는\s*곳/g, '$1 위치 및 진료시간 안내')
		.replace(/(피부과(?:\s*클리닉)?)\s*잘하는\s*곳/g, `$1 ${need === '안내' ? '안내' : `${need} 안내`}`)
		.replace(/\+\s*잘하는\s*곳/g, `+ ${need === '안내' ? '안내' : `${need} 안내`}`)
		.replace(/\+\s*후기(?=\s|$)/g, '+ 정보 안내')
		.replace(/잘하는\s*곳(?:\s*추천해줘)?/g, /안내$/.test(system) ? system : `${system} 안내`)
		.replace(/후기\s*좋은\s*곳/g, '정보 안내')
		.replace(/후기\s*좋고\s*신뢰할\s*만한/g, '정보 안내');
}

export function softenQueryToken(token: string, voice?: IndustryVoice): string {
	const t = (token || '').trim();
	if (!t) return t;
	const need = voice?.queryNeedKo || '안내';
	if (/^잘하는\s*곳$/.test(t)) return need === '안내' ? '안내' : `${need} 안내`;
	if (/^후기$/.test(t)) return '정보 안내';
	if (/^후기\s*좋은(?:\s*곳)?$/.test(t)) return '정보 안내';
	if (/^추천해줘$/.test(t) || /^추천$/.test(t)) return '안내';
	if (/^치료\s*솔루션$/.test(t)) return '정밀 시스템';
	return softenComparativeQuery(t, voice);
}

function keywordsOf(data: UniversalAuditData): string[] {
	return (data.primaryKeywords || []).map(clean).filter(Boolean).slice(0, 3);
}

export function hostFromDomain(domain: string): string {
	const raw = clean(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
	return raw || 'example.com';
}

export function buildCompliantQuerySpectrum(
	data: UniversalAuditData,
	voice = resolveIndustryVoice(data),
): CompliantQuerySpectrum {
	const lang = data.lang === 'en' ? 'en' : 'ko';
	const brand = clean(data.brandName) || hostFromDomain(data.domain);
	const loc = clean(data.location);
	const kws = keywordsOf(data);
	const kw0 = kws[0] || voice.queryNeedKo;
	const kw1 = kws[1] || '';

	if (lang === 'en') {
		const level1 = `${brand} location and hours`;
		const level2 = [loc, kw0, kw1, 'information'].filter(Boolean).join(' ');
		const level3 = loc
			? `Share information on ${kw0} ${voice.systemNounKo} in ${loc}`
			: `Share information on ${kw0} ${voice.systemNounKo}`;
		return { level1, level2, level3 };
	}

	const level1 = `${brand} 위치 및 운영 안내`;
	const level2 = [loc, kw0, kw1, '안내'].filter(Boolean).join(' ');

	let level3: string;
	if (voice.key === 'legal') {
		level3 = loc ? `${loc} ${kw0} 및 상담 절차 안내` : `${kw0} 상담 절차 안내`;
	} else if (voice.key === 'restaurant') {
		level3 = loc ? `${loc} 예약 안내 및 대표 메뉴 구성` : '예약 안내 및 대표 메뉴 구성';
	} else if (voice.key === 'professional') {
		level3 = `${kw0} 도입 절차 및 기술 스펙 안내`;
	} else {
		level3 = loc
			? `${loc}에서 ${kw0} 전문 시스템 갖춘 ${voice.placeNounKo} 안내해줘`
			: `${kw0} 전문 시스템 갖춘 ${voice.placeNounKo} 안내해줘`;
	}

	return {
		level1: softenComparativeQuery(level1, voice),
		level2: softenComparativeQuery(level2, voice),
		level3: softenComparativeQuery(level3, voice),
	};
}

export function buildCompliantFaqs(data: UniversalAuditData, voice = resolveIndustryVoice(data)): CompliantFaq[] {
	const lang = data.lang === 'en' ? 'en' : 'ko';
	const brand = clean(data.brandName) || hostFromDomain(data.domain);
	const loc = clean(data.location) || (lang === 'en' ? 'this area' : '해당');
	const kws = keywordsOf(data);
	const kw0 = kws[0] || voice.queryNeedKo;
	const joined = kws.join(', ') || voice.categoryKo;
	const domain = hostFromDomain(data.domain);

	if (lang === 'en') {
		return [
			{
				question: `Where can I find ${kw0} information in ${loc}?`,
				answer: `${brand} publishes ${kw0} information for the ${loc} area on its official website (${domain}).`,
			},
			{
				question: `What are ${brand}’s main services and how do I start?`,
				answer: `${brand}’s primary areas are ${joined}. Details and scheduling are available through official channels.`,
			},
		];
	}

	return [
		{
			question: `${loc}에서 ${kw0} 관련 안내는 어디서 확인하나요?`,
			answer: `${withJosa(brand, '은/는')} ${loc} 지역 ${kw0} 안내를 공식 웹사이트(${domain})를 통해 제공합니다.`,
		},
		{
			question: `${brand}의 대표 서비스 및 상담 절차는?`,
			answer: `${brand}의 주요 분야는 ${joined}이며, 상세 절차 및 일정은 공식 채널에서 확인하실 수 있습니다.`,
		},
	];
}

export function buildSovMarketAnalysis(
	data: Pick<UniversalAuditData, 'location' | 'primaryKeywords' | 'metrics' | 'lang'>,
): string {
	const lang = data.lang === 'en' ? 'en' : 'ko';
	const loc = clean(data.location) || (lang === 'en' ? 'this area' : '해당');
	const service = clean(data.primaryKeywords?.[0]) || (lang === 'en' ? 'this service' : '핵심 서비스');
	const current = data.metrics?.currentShare ?? 5;
	const target = data.metrics?.targetShare ?? 48;
	const directory = data.metrics?.directoryShare ?? 52;
	const rank = data.metrics?.clientRank ?? 4;
	const rankLabel =
		rank >= 4 ? (lang === 'en' ? 'outside the top 3' : '3위 밖') : lang === 'en' ? `#${rank}` : `${rank}위`;

	if (lang === 'en') {
		return `In the ${loc} “${service}” search market, you are currently ${rankLabel} (${current}%), and ${directory}% of traffic is leaking to third-party blogs and platforms. Applying GEO prescriptions first can absorb that leaked traffic, with a goal of reaching about ${target}% share.`;
	}
	return `${loc} 지역 "${service}" 검색 시장에서 자사는 현재 ${rankLabel}(${current}%)이며, ${directory}%의 트래픽이 3자 블로그·플랫폼으로 분산되고 있습니다. GEO 처방을 선제 적용하면 분산된 트래픽을 흡수해 최대 ${target}% 수준의 점유율 확보를 목표로 최적화할 수 있습니다.`;
}

export function llmsMetaLine(data: UniversalAuditData, voice = resolveIndustryVoice(data)): string {
	const lang = data.lang === 'en' ? 'en' : 'ko';
	const category = clean(data.detectedCategory) || industryCategoryLabel(voice, lang);
	const schema = clean(data.schemaType) || voice.schemaType;
	const loc = clean(data.location) || (lang === 'en' ? 'Nationwide' : '전국');
	return lang === 'en'
		? `Industry: ${category} · Schema.org: ${schema} · Region: ${loc}`
		: `업종: ${category} · Schema.org: ${schema} · 지역: ${loc}`;
}

export function auditDataFromSite(input: {
	domain?: string;
	url?: string;
	brandName?: string;
	location?: string;
	category?: string;
	primaryKeyword?: string;
	targetKeywords?: readonly string[];
	specialties?: readonly string[];
	schemaType?: string;
	industryType?: string | null;
	lang?: CompliantLang;
	detectedCategory?: string;
	scores?: UniversalAuditData['scores'];
	metrics?: UniversalAuditData['metrics'];
}): UniversalAuditData {
	const keywords = [
		...(input.targetKeywords || []),
		...(input.specialties || []),
		input.primaryKeyword || '',
		input.category || '',
	]
		.map(clean)
		.filter(Boolean);
	const unique: string[] = [];
	for (const kw of keywords) {
		if (!unique.includes(kw)) unique.push(kw);
		if (unique.length >= 3) break;
	}
	const voice = resolveIndustryVoice({
		industryType: input.industryType,
		schemaType: input.schemaType,
		category: input.category || input.primaryKeyword,
		keywords: unique,
	});
	return {
		domain: hostFromDomain(input.domain || input.url || ''),
		brandName: clean(input.brandName) || hostFromDomain(input.domain || input.url || ''),
		detectedCategory: clean(input.detectedCategory) || industryCategoryLabel(voice, input.lang === 'en' ? 'en' : 'ko'),
		schemaType: clean(input.schemaType) || voice.schemaType,
		location: clean(input.location) || (input.lang === 'en' ? 'Nationwide' : '전국'),
		primaryKeywords: unique,
		scores: input.scores,
		metrics: input.metrics,
		lang: input.lang === 'en' ? 'en' : 'ko',
		industryType: input.industryType,
	};
}

export function hasBannedClaim(text: string): boolean {
	return BANNED_CLAIM_RE.test(text || '');
}
