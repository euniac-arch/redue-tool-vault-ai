import {
	type IndustryType,
	type SiteMetadata,
	locationLabel,
} from '@/lib/audit/site-metadata';

export type KeywordCategoryId = 'geoPrompt' | 'primary' | 'longTail' | 'lsiLocal';

export interface KeywordCategory {
	id: KeywordCategoryId;
	keywords: string[];
}

export interface KeywordRecommendationPack {
	categories: KeywordCategory[];
}

type AuditLang = 'ko' | 'en';

function uniq(items: string[], limit = 8): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = raw.replace(/\s+/g, ' ').trim();
		if (!v || seen.has(v.toLowerCase())) continue;
		seen.add(v.toLowerCase());
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

function isParticleTherapy(corpus: string): boolean {
	return /중입자|탄소이온|carbon.?ion|heavy.?ion|particle.?therap/i.test(corpus);
}

function isCancerRelated(corpus: string): boolean {
	return isParticleTherapy(corpus) || /암치료|암센터|proton|cancer|종양|항암/i.test(corpus);
}

function topicFocus(meta: SiteMetadata, lang: AuditLang): string {
	const primary = (meta.primaryKeyword || meta.category || '').trim();
	if (primary && !/믿을 만한 곳|trusted provider|전문 서비스/i.test(primary)) return primary;
	if (isParticleTherapy(`${meta.brandName} ${meta.domain}`)) {
		return lang === 'en' ? 'carbon ion therapy' : '중입자치료';
	}
	if (isCancerRelated(`${meta.brandName} ${meta.domain}`)) {
		return lang === 'en' ? 'cancer treatment' : '암치료';
	}
	return lang === 'en' ? 'core service' : '핵심 서비스';
}

function buildGeoPrompts(meta: SiteMetadata, lang: AuditLang, focus: string, loc: string): string[] {
	const brand = meta.brandName.trim();
	const corpus = `${brand} ${focus} ${meta.domain}`;

	if (lang === 'en') {
		const city = loc && loc !== 'this' ? loc : '';
		if (isParticleTherapy(corpus)) {
			return uniq([
				'carbon ion therapy overseas hospital recommendation',
				brand ? `${brand} consultation how to book` : 'particle therapy consultation process',
				'Japan carbon ion therapy cost and procedure',
				city ? `${city} carbon ion therapy specialist clinic` : 'best carbon ion therapy center comparison',
				`${focus} vs proton therapy which is better`,
				brand ? `${brand} patient eligibility criteria` : 'who is eligible for carbon ion therapy',
			]);
		}
		if (isCancerRelated(corpus)) {
			return uniq([
				`${focus} hospital recommendation`,
				brand ? `${brand} how to schedule a consultation` : `${focus} consultation process`,
				`${focus} cost and treatment timeline`,
				city ? `best ${focus} clinic in ${city}` : `trusted ${focus} specialists`,
				`${focus} second opinion overseas options`,
			]);
		}
		return uniq([
			city ? `best ${focus} in ${city} recommend` : `best ${focus} recommendation`,
			brand ? `${brand} how to book a consultation` : `${focus} consultation process`,
			`${focus} cost comparison and reviews`,
			city ? `${city} ${focus} trusted provider` : `${focus} vs alternatives which is better`,
			brand ? `${brand} official contact and hours` : `${focus} near me open now`,
		]);
	}

	const city = loc && loc !== '해당' ? loc : '';
	if (isParticleTherapy(corpus)) {
		return uniq([
			'중입자치료 해외 병원 추천',
			brand ? `${brand} 상담 방법` : '중입자치료 상담 방법',
			'일본 중입자 치료 비용 및 절차',
			city ? `${city} 중입자치료 전문 병원` : '중입자치료 국내 병원 비교',
			'중입자치료 vs 양성자치료 차이',
			brand ? `${brand} 치료 대상 및 적응증` : '중입자치료 적응증 대상암',
			'중입자암치료 해외 패키지 후기',
		]);
	}
	if (isCancerRelated(corpus)) {
		return uniq([
			`${focus} 병원 추천`,
			brand ? `${brand} 상담 방법` : `${focus} 상담 예약 방법`,
			`${focus} 비용 및 치료 절차`,
			city ? `${city} ${focus} 전문 병원` : `${focus} 국내외 비교`,
			`${focus} 적응증과 대상 환자`,
			brand ? `${brand} 후기 및 치료 사례` : `${focus} 성공 사례`,
		]);
	}

	return uniq([
		city ? `${city} ${focus} 추천` : `${focus} 추천`,
		brand ? `${brand} 상담 방법` : `${focus} 상담 예약 방법`,
		`${focus} 비용 및 절차`,
		city ? `${city} ${focus} 잘하는 곳` : `${focus} 비교 후기`,
		brand ? `${brand} 위치 및 예약` : `${focus} 근처 영업시간`,
		`${focus} 후기 좋은 곳`,
	]);
}

function buildPrimary(meta: SiteMetadata, lang: AuditLang, focus: string): string[] {
	const brand = meta.brandName.trim();
	const domain = meta.domain.replace(/^www\./, '');
	const industry = meta.industryType;

	const industryLabel =
		lang === 'en'
			? industryLabelEn(industry)
			: industryLabelKo(industry);

	return uniq([
		brand,
		focus,
		brand && focus ? `${brand} ${focus}` : '',
		industryLabel,
		domain,
		brand ? (lang === 'en' ? `${brand} official` : `${brand} 공식`) : '',
	]);
}

function industryLabelKo(industry: IndustryType): string {
	switch (industry) {
		case 'MEDICAL':
			return '의료기관';
		case 'LOCAL_STORE':
			return '지역 매장';
		case 'B2B_MFG':
			return 'B2B 제조/솔루션';
		default:
			return '전문 서비스';
	}
}

function industryLabelEn(industry: IndustryType): string {
	switch (industry) {
		case 'MEDICAL':
			return 'medical clinic';
		case 'LOCAL_STORE':
			return 'local business';
		case 'B2B_MFG':
			return 'B2B manufacturing';
		default:
			return 'professional service';
	}
}

function buildLongTail(meta: SiteMetadata, lang: AuditLang, focus: string, loc: string): string[] {
	const brand = meta.brandName.trim();
	const city = loc && loc !== '해당' && loc !== 'this' ? loc : '';

	if (lang === 'en') {
		return uniq([
			`${focus} consultation booking`,
			`${focus} quote / estimate`,
			brand ? `${brand} vs competitors comparison` : `${focus} comparison`,
			`${focus} price list`,
			city ? `${city} ${focus} appointment today` : `${focus} same-day consultation`,
			`${focus} insurance / coverage options`,
			brand ? `contact ${brand} for estimate` : `${focus} free consultation`,
		]);
	}

	return uniq([
		`${focus} 상담 예약`,
		`${focus} 견적 문의`,
		brand ? `${brand} 비교 후기` : `${focus} 비교`,
		`${focus} 비용 안내`,
		city ? `${city} ${focus} 당일 상담` : `${focus} 당일 상담`,
		`${focus} 보험 적용 여부`,
		brand ? `${brand} 상담 신청` : `${focus} 무료 상담`,
		`${focus} 후기 보고 결정`,
	]);
}

function buildLsiLocal(meta: SiteMetadata, lang: AuditLang, focus: string, loc: string): string[] {
	const brand = meta.brandName.trim();
	const city = loc && loc !== '해당' && loc !== 'this' ? loc : '';
	const detailed = meta.location.trim();
	const corpus = `${brand} ${focus} ${meta.domain}`;

	if (lang === 'en') {
		const related = isParticleTherapy(corpus)
			? ['proton therapy', 'radiation oncology', 'cancer center', 'heavy ion radiotherapy', 'oncology second opinion']
			: isCancerRelated(corpus)
				? ['oncology', 'radiation therapy', 'chemotherapy alternatives', 'cancer specialist', 'tumor board']
				: [`${focus} reviews`, `${focus} specialist`, `${focus} FAQ`, `${focus} guide`, `${focus} tips`];

		return uniq([
			...related,
			city ? `${city} ${focus}` : '',
			detailed && detailed !== city ? `${detailed} ${focus}` : '',
			city ? `${city} near me` : 'near me',
			brand && city ? `${brand} ${city}` : '',
		]);
	}

	const related = isParticleTherapy(corpus)
		? ['양성자치료', '방사선종양학과', '암센터', '탄소이온치료', '해외 암치료', '중입자 적응증']
		: isCancerRelated(corpus)
			? ['종양내과', '방사선치료', '항암치료 대안', '암 전문의', '암 수술']
			: [`${focus} 후기`, `${focus} 전문`, `${focus} FAQ`, `${focus} 가이드`, `${focus} 팁`];

	return uniq([
		...related,
		city ? `${city} ${focus}` : '',
		detailed && detailed !== city ? `${detailed} ${focus}` : '',
		city ? `${city} 근처` : '근처',
		brand && city ? `${brand} ${city}` : '',
		city ? `${city} 추천` : '',
	]);
}

/** Builds GEO/SEO target keyword packs from extracted site metadata. */
export function buildKeywordRecommendations(
	meta: SiteMetadata | null | undefined,
	lang: AuditLang = 'ko',
): KeywordRecommendationPack {
	if (!meta) {
		return {
			categories: [
				{ id: 'geoPrompt', keywords: [] },
				{ id: 'primary', keywords: [] },
				{ id: 'longTail', keywords: [] },
				{ id: 'lsiLocal', keywords: [] },
			],
		};
	}

	const focus = topicFocus(meta, lang);
	const loc = locationLabel(meta, lang);

	return {
		categories: [
			{ id: 'geoPrompt', keywords: buildGeoPrompts(meta, lang, focus, loc) },
			{ id: 'primary', keywords: buildPrimary(meta, lang, focus) },
			{ id: 'longTail', keywords: buildLongTail(meta, lang, focus, loc) },
			{ id: 'lsiLocal', keywords: buildLsiLocal(meta, lang, focus, loc) },
		],
	};
}
