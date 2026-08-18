/**
 * E-E-A-T brand-trust audit — keywords, NAP, Schema.org 5-property
 * checklist, digital-footprint proxies, and industry How-to copy.
 *
 * Bound to crawled siteMeta / JSON-LD / robots.txt. Never injects leftover
 * verticals unless those terms are evidenced on-page.
 */

import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { cleanMedicalEntities, looksLikePlasticSpecialty } from '@/lib/geo/clean-medical-entities';
import { buildSchemaPropertyChecks, type PrecisionLang } from '@/lib/geo/precision-diagnostics';
import type { EnginePlatformSignals } from '@/lib/audit/engine-analysis';
import type { IndustryType } from '@/lib/audit/site-metadata';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import type { AuditLang } from '@/lib/site-auditor';
import type { SchemaPropertyCheck } from '@/types/geo-diagnostic';

export interface EeatChecklistItem {
	valid: boolean;
	label: string;
}

export interface EeatAuditData {
	primaryKeywords: string[];
	missingTargetKeyword: string;
	/** Footer / Person-schema representative legal name. */
	personName: string;
	personJobTitle: string;
	recommendedSchemaType: string;
	napMatchRate: number;
	napStatusDescription: string;
	schemaChecklist: {
		entityType: EeatChecklistItem;
		geoCoordinates: EeatChecklistItem;
		openingHours: EeatChecklistItem;
		offerCatalog: EeatChecklistItem;
		sameAs: EeatChecklistItem;
	};
	digitalFootprint: {
		googleMentionsCount: number;
		googleBenchmarkAvg: number;
		naverPostingsCount: number;
		bingPlacesRegistered: boolean;
	};
	botAccessibility: {
		gptBot: boolean;
		perplexityBot: boolean;
		claudeBot: boolean;
		googleExtended: boolean;
	};
}

export interface EeatHowtoStep {
	title: string;
	body: string;
}

export interface EeatHowtoGuides {
	google: EeatHowtoStep[];
	naver: EeatHowtoStep[];
	bing: EeatHowtoStep[];
}

export type EeatVertical = 'medical' | 'legal' | 'local' | 'b2b' | 'general';

export interface EeatKeywordInput {
	specialties?: readonly string[];
	primaryKeyword?: string;
	category?: string;
	location?: string;
	broadLocation?: string;
	brandName?: string;
	detectedKeywords?: readonly string[];
	industryType?: string;
	lang?: AuditLang;
}

const GENERIC_KEYWORD = /^(일반의원|전문클리닉|전문 서비스|믿을 만한 곳|trusted provider|general clinic|specialty clinic)$/i;

function compact(value: string | undefined | null): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function uniquePreserve(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const v = compact(raw);
		if (!v) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
	}
	return out;
}

export function resolveEeatRegion(input: Pick<EeatKeywordInput, 'broadLocation' | 'location'>): string {
	return compact(input.broadLocation) || compact(input.location);
}

export function resolveEeatVertical(input: {
	industryType?: string;
	schemaTypes?: readonly string[];
	keywordHay?: string;
}): EeatVertical {
	const types = (input.schemaTypes ?? []).join(' ');
	const hay = `${types} ${input.keywordHay || ''} ${input.industryType || ''}`;
	if (/LegalService|Attorney|법률|변호사|법무|attorney|law\s*firm/i.test(hay)) return 'legal';
	if (
		/MedicalClinic|Hospital|Dentist|Physician|VeterinaryCare|MedicalBusiness|Pharmacy/i.test(types) ||
		input.industryType === 'MEDICAL'
	) {
		return 'medical';
	}
	if (/Manufacturer|SoftwareApplication|Organization/i.test(types) && input.industryType === 'B2B_MFG') {
		return 'b2b';
	}
	if (input.industryType === 'B2B_MFG') return 'b2b';
	if (input.industryType === 'LOCAL_STORE' || /LocalBusiness|Store|Restaurant|BeautySalon/i.test(types)) {
		return 'local';
	}
	return 'general';
}

export function resolveEeatSchemaType(input: {
	schemaTypes?: readonly string[];
	vertical?: EeatVertical;
	keywordHay?: string;
}): string {
	const found = (input.schemaTypes ?? [])
		.map((t) => t.replace(/^https?:\/\/schema\.org\//i, '').trim())
		.find((t) =>
			/MedicalClinic|Hospital|Dentist|Physician|VeterinaryCare|MedicalBusiness|Pharmacy|LegalService|Attorney|LocalBusiness|Store|Restaurant|BeautySalon|OnlineStore|SoftwareApplication|Manufacturer|ProfessionalService|Organization/i.test(
				t,
			),
		);
	if (found && !/^Hospital$/i.test(found)) return found;
	const config = resolveIndustryConfigFromSite({
		keywords: input.keywordHay,
		description: input.keywordHay,
		schemaTypes: input.schemaTypes,
		legacyIndustry:
			input.vertical === 'medical'
				? 'MEDICAL'
				: input.vertical === 'b2b'
					? 'B2B_MFG'
					: input.vertical === 'local'
						? 'LOCAL_STORE'
						: undefined,
	});
	if (input.vertical === 'legal' || config.type === 'legal') return config.schemaType || 'LegalService';
	if (input.vertical === 'medical' || config.type === 'medical') return config.schemaType || 'MedicalClinic';
	if (input.vertical === 'b2b' || config.type === 'professional') return config.schemaType || 'ProfessionalService';
	return config.schemaType || 'LocalBusiness';
}

/** Ranked specialties + region. Drops leftover plastic-surgery terms and brand/UI chrome. */
export function buildEeatPrimaryKeywords(input: EeatKeywordInput): string[] {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const region = resolveEeatRegion(input);
	const brand = compact(input.brandName);
	const plasticOk =
		[...(input.specialties ?? []), input.primaryKeyword, input.category, ...(input.detectedKeywords ?? [])]
			.filter(Boolean)
			.some((s) => looksLikePlasticSpecialty(String(s)));

	const cleaned = cleanMedicalEntities(
		[...(input.specialties ?? []), input.primaryKeyword, input.category],
		{ plasticOk, limit: 8 },
	).filter((kw) => {
		if (GENERIC_KEYWORD.test(kw)) return false;
		if (brand && kw.toLowerCase() === brand.toLowerCase()) return false;
		if (region && kw.toLowerCase() === region.toLowerCase()) return false;
		return true;
	});

	const specialties = uniquePreserve(cleaned).slice(0, 2);
	if (!specialties.length) {
		const fallback = compact(input.primaryKeyword) || compact(input.category);
		if (fallback && !GENERIC_KEYWORD.test(fallback) && fallback.toLowerCase() !== brand.toLowerCase()) {
			specialties.push(fallback);
		} else if (lang === 'en') {
			specialties.push('local service');
		} else {
			specialties.push('지역 서비스');
		}
	}

	const keywords = uniquePreserve([...specialties, region]);
	return keywords.slice(0, 4);
}

export function buildMissingTargetKeyword(input: EeatKeywordInput & { primaryKeywords?: readonly string[] }): string {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const region = resolveEeatRegion(input);
	const keywords = input.primaryKeywords?.length ? input.primaryKeywords : buildEeatPrimaryKeywords(input);
	const specialty = keywords.find((kw) => kw && kw !== region) || keywords[0] || (lang === 'en' ? 'service' : '서비스');
	if (lang === 'en') {
		return region ? `${region} ${specialty} reviews` : `${specialty} reviews`;
	}
	return region ? `${region} ${specialty} 후기` : `${specialty} 후기`;
}

export function shouldShowMissingKeyword(args: {
	missingTargetKeyword: string;
	detectedKeywords?: readonly string[];
	faqPresent?: boolean;
	geoPct?: number;
}): boolean {
	const target = compact(args.missingTargetKeyword).toLowerCase();
	if (!target) return false;
	const detected = (args.detectedKeywords ?? []).map((k) => compact(k).toLowerCase());
	if (detected.some((k) => k === target || k.includes(target))) {
		return false;
	}
	if (args.faqPresent && (args.geoPct ?? 0) >= 55) return false;
	return true;
}

export function computeNapMatchRate(args: {
	orgPresent: boolean;
	orgComplete: boolean;
	hasTelephone?: boolean;
	hasAddress?: boolean;
	hasOpeningHours?: boolean;
}): number {
	const fields = [args.hasTelephone, args.hasAddress, args.hasOpeningHours].filter((v) => v === true).length;
	if (args.orgComplete && fields >= 2) return 94;
	if (args.orgComplete) return 86;
	if (args.orgPresent && fields >= 2) return 72;
	if (args.orgPresent) return 64;
	if (fields >= 2) return 52;
	return 46;
}

export function napStatusDescription(rate: number, lang: AuditLang = 'ko'): string {
	if (rate >= 90) {
		return lang === 'en'
			? 'On-page Organization NAP (name / address / telephone / hours) is complete.'
			: '온페이지 Organization NAP(상호·주소·전화·영업시간)가 일치합니다.';
	}
	return lang === 'en'
		? 'Organization NAP fields (address / telephone / hours) are incomplete on this page.'
		: '이 페이지의 Organization NAP(주소/전화/영업시간) 속성이 불완전합니다.';
}

/** Industry-weighted regional Google-mention benchmark (not a fixed 220). */
export function googleMentionBenchmarkFor(vertical: EeatVertical): number {
	switch (vertical) {
		case 'medical':
			return 220;
		case 'legal':
			return 180;
		case 'local':
			return 160;
		case 'b2b':
			return 140;
		default:
			return 180;
	}
}

export function computeGoogleMentionCount(args: {
	schemaPct: number;
	orgPresent: boolean;
	orgComplete: boolean;
	sameAsCount: number;
	googleMapsLinked: boolean;
	vertical: EeatVertical;
}): number {
	const industryBias = args.vertical === 'medical' ? 12 : args.vertical === 'legal' ? 8 : args.vertical === 'b2b' ? 4 : 6;
	const raw = Math.round(
		industryBias +
			args.schemaPct * 1.35 +
			(args.orgComplete ? 36 : args.orgPresent ? 16 : 0) +
			args.sameAsCount * 10 +
			(args.googleMapsLinked ? 22 : 0),
	);
	return Math.min(280, Math.max(4, raw));
}

export function computeNaverPostingsCount(args: {
	naverPlaceLinked: boolean;
	naverBlogLinked: boolean;
	geoPct: number;
	vertical: EeatVertical;
}): number {
	const industryBias = args.vertical === 'medical' ? 6 : args.vertical === 'local' ? 5 : args.vertical === 'legal' ? 3 : 2;
	const raw = Math.round(
		industryBias +
			(args.naverPlaceLinked ? 28 : 4) +
			(args.naverBlogLinked ? 22 : 0) +
			args.geoPct * 0.25,
	);
	return Math.min(80, Math.max(0, raw));
}

export function schemaChecklistFromProperties(properties: readonly SchemaPropertyCheck[]): EeatAuditData['schemaChecklist'] {
	const byId = Object.fromEntries(properties.map((p) => [p.id, p]));
	const item = (id: string, fallbackLabel: string): EeatChecklistItem => ({
		valid: Boolean(byId[id]?.complete),
		label: byId[id]?.label || fallbackLabel,
	});
	return {
		entityType: item('entityType', '@type'),
		geoCoordinates: item('geoCoordinates', 'geo'),
		openingHours: item('openingHours', 'openingHoursSpecification'),
		offerCatalog: item('hasOfferCatalog', 'hasOfferCatalog / availableService'),
		sameAs: item('sameAs', 'sameAs'),
	};
}

export function buildIndustryHowtoGuides(args: {
	lang: AuditLang;
	vertical: EeatVertical;
	schemaType: string;
	specialty: string;
	region: string;
	brandName?: string;
}): EeatHowtoGuides {
	const en = args.lang === 'en';
	const specialty = args.specialty || (en ? 'core service' : '핵심 서비스');
	const region = args.region;
	const place = region ? (en ? ` in ${region}` : ` ${region}`) : '';
	const schema = args.schemaType || 'LocalBusiness';
	const brand = compact(args.brandName);

	if (args.vertical === 'legal') {
		return {
			google: [
				{
					title: en ? 'Publish legal-industry coverage:' : '법률 전문 매체 보도:',
					body: en
						? `Distribute brand-named briefs 1–2× per month to legal dailies and bar-association outlets covering ${specialty}${place}.`
						: `${place ? `${region} ` : ''}${specialty} 취급 분야가 드러나도록 법률 전문지·협회 매체에 월 1~2회 브랜드명 보도자료를 배포합니다.`,
				},
				{
					title: en ? 'Register on legal directories:' : '법률 디렉터리 등록:',
					body: en
						? `Add the ${schema} profile (practice areas, sameAs) to the Korean Bar Association directory and major legal-information portals.`
						: `대한변호사협회 디렉터리와 법률정보 포털에 ${schema} 프로필(취급 분야·sameAs)을 등록합니다.`,
				},
				{
					title: en ? 'Earn citable expert mentions:' : '인용 가능한 전문가 언급:',
					body: en
						? 'Secure official-domain citations through expert columns and interview pieces on litigation / advisory topics.'
						: '소송·자문 주제의 칼럼·인터뷰로 공식 도메인 URL 인용을 확보합니다.',
				},
			],
			naver: [
				{
					title: en ? 'Publish on a steady cadence:' : '주기적 원고 발행:',
					body: en
						? `Keep weekly Naver posts that include the brand and “${specialty}” consultation keywords.`
						: `브랜드명과 ‘${specialty}’ 상담 키워드가 포함된 네이버 블로그를 주 1~2회 유지합니다.`,
				},
				{
					title: en ? 'Grow Knowledge-iN answers:' : '지식iN 전문 답변:',
					body: en
						? `Post sourced answers on Naver Knowledge-iN for “${region ? `${region} ` : ''}${specialty}” questions.`
						: `‘${region ? `${region} ` : ''}${specialty}’ 질의에 근거 있는 지식iN 답변을 올립니다.`,
				},
				{
					title: en ? 'Add an automated posting pipeline:' : '자동 포스팅 파이프라인:',
					body: en
						? 'Use API/AI draft automation so recency signals stay fresh without inventing case facts.'
						: '사실관계 날조 없이 최신성만 유지하도록 API/AI 원고 초안 자동화를 둡니다.',
				},
			],
			bing: bingHowto(en, schema),
		};
	}

	if (args.vertical === 'local') {
		return {
			google: [
				{
					title: en ? 'Publish local-press mentions:' : '지역 언론 보도:',
					body: en
						? `Send brand-named notices 1–2× per month to local dailies and neighborhood portals covering ${specialty}${place}.`
						: `${place ? `${region} ` : ''}상권·지역 언론에 ‘${specialty}’가 드러나는 브랜드 소식을 월 1~2회 배포합니다.`,
				},
				{
					title: en ? 'Register on local directories:' : '지역 디렉터리 등록:',
					body: en
						? `List the ${schema} profile (hours, services, sameAs) on chamber-of-commerce and local-commerce portals.`
						: `상공회의소·지역 상권 포털에 ${schema} 프로필(영업시간·서비스·sameAs)을 등록합니다.`,
				},
				{
					title: en ? 'Expand review / backlink citations:' : '후기·백링크 확장:',
					body: en
						? 'Collect official-URL citations from local blogs, maps lists, and partner pages.'
						: '지역 블로그·지도 리스트·제휴 페이지에서 공식 URL 인용을 늘립니다.',
				},
			],
			naver: [
				{
					title: en ? 'Publish on a steady cadence:' : '주기적 원고 발행:',
					body: en
						? `Post 1–2× weekly on Naver with the brand and “${specialty}” service keywords.`
						: `브랜드명과 ‘${specialty}’ 서비스 키워드가 포함된 네이버 블로그를 주 1~2회 유지합니다.`,
				},
				{
					title: en ? 'Grow community mentions:' : '커뮤니티 언급 확대:',
					body: en
						? `Answer neighborhood cafe / Knowledge-iN threads about ${specialty}${place}.`
						: `${place ? `${region} ` : ''}동네 카페·지식iN의 ‘${specialty}’ 질의에 신뢰할 수 있는 답변을 남깁니다.`,
				},
				{
					title: en ? 'Add an automated posting pipeline:' : '자동 포스팅 파이프라인:',
					body: en
						? 'Keep recency with API/AI drafts tied to real menu / hours updates.'
						: '실제 메뉴·영업시간 갱신에 맞춘 API/AI 초안으로 최신성을 유지합니다.',
				},
			],
			bing: bingHowto(en, schema),
		};
	}

	if (args.vertical === 'b2b') {
		return {
			google: [
				{
					title: en ? 'Publish industry coverage:' : '산업 전문 매체 보도:',
					body: en
						? `Distribute brand-named product/solution briefs 1–2× per month to trade press covering ${specialty}.`
						: `‘${specialty}’ 솔루션이 드러나도록 산업 전문지에 월 1~2회 브랜드 보도자료를 배포합니다.`,
				},
				{
					title: en ? 'Register on B2B directories:' : 'B2B 디렉터리 등록:',
					body: en
						? `Add the ${schema} profile (offers, sameAs) to partner portals and industry directories.`
						: `파트너 포털·산업 디렉터리에 ${schema} 프로필(오퍼·sameAs)을 등록합니다.`,
				},
				{
					title: en ? 'Earn analyst / partner citations:' : '파트너 인용 확보:',
					body: en
						? 'Collect official-domain citations from case studies, partner pages, and expert columns.'
						: '사례·파트너 페이지·전문가 칼럼에서 공식 도메인 인용을 확보합니다.',
				},
			],
			naver: [
				{
					title: en ? 'Publish on a steady cadence:' : '주기적 원고 발행:',
					body: en
						? `Keep weekly Naver posts that include the brand and “${specialty}” solution keywords.`
						: `브랜드명과 ‘${specialty}’ 솔루션 키워드가 포함된 네이버 블로그를 주 1~2회 유지합니다.`,
				},
				{
					title: en ? 'Grow Knowledge-iN / community answers:' : '지식iN·커뮤니티 답변:',
					body: en
						? `Answer buyer questions about ${specialty} with citable specs, not generic copy.`
						: `‘${specialty}’ 도입 질의에 스펙이 드러나는 지식iN 답변을 올립니다.`,
				},
				{
					title: en ? 'Add an automated posting pipeline:' : '자동 포스팅 파이프라인:',
					body: en
						? 'Automate drafts from real release notes so recency stays honest.'
						: '실제 릴리즈 노트 기반 API/AI 초안으로 최신성을 유지합니다.',
				},
			],
			bing: bingHowto(en, schema),
		};
	}

	// medical + general (general uses service wording, not "의료 연구소")
	const medical = args.vertical === 'medical';
	return {
		google: [
			{
				title: en ? 'Publish press releases regularly:' : '보도자료 정기 배포:',
				body: en
					? medical
						? `Distribute brand-named releases 1–2× per month to health/medical outlets covering ${specialty}${place}.`
						: `Distribute brand-named releases 1–2× per month to trade and local outlets covering ${specialty}${place}.`
					: medical
						? `주요 일간지 및 건강/의료 전문 매체에 ‘${specialty}’${place ? `·${region}` : ''}가 드러나는 보도자료를 월 1~2회 배포합니다.`
						: `업종 전문지·지역 매체에 ‘${specialty}’${place ? `·${region}` : ''}가 드러나는 보도자료를 월 1~2회 배포합니다.`,
			},
			{
				title: en ? (medical ? 'Register on clinical directories:' : 'Register on industry directories:') : medical ? '의료 정보 포털 등록:' : '업종 디렉터리 등록:',
				body: en
					? medical
						? `Add the ${schema} profile (specialties, hours, sameAs) to hospital-evaluation and health-information portals — not generic “research institute” listings.`
						: `Add the ${schema} profile (services, hours, sameAs) to relevant industry and local directories.`
					: medical
						? `병원 평가·건강정보 포털과 의사회/학회 디렉터리에 ${schema} 프로필(진료과목·진료시간·sameAs)을 등록합니다.`
						: `관련 협회·업종 포털에 ${schema} 프로필(서비스·영업시간·sameAs)을 등록합니다.`,
			},
			{
				title: en ? 'Expand external backlinks:' : '외부 백링크 확장:',
				body: en
					? `Secure official-domain citations through expert columns and interviews on ${specialty}.`
					: `‘${specialty}’ 주제의 전문 칼럼·인터뷰로 공식 도메인 URL 인용을 확보합니다.`,
			},
		],
		naver: [
			{
				title: en ? 'Publish on a steady cadence:' : '주기적 원고 발행:',
				body: en
					? `Keep 1–2 weekly Naver posts that include ${brand ? `${brand} and ` : ''}“${specialty}” keywords.`
					: `${brand ? `${brand} 및 ` : ''}‘${specialty}’ 키워드가 포함된 네이버 블로그를 주 1~2회 유지합니다.`,
			},
			{
				title: en ? 'Grow community mentions:' : '커뮤니티 언급 확대:',
				body: en
					? medical
						? `Post sourced answers on Knowledge-iN and relevant patient communities for “${region ? `${region} ` : ''}${specialty}”.`
						: `Post sourced answers on Knowledge-iN and niche communities for “${region ? `${region} ` : ''}${specialty}”.`
					: medical
						? `네이버 지식iN·관련 커뮤니티에 ‘${region ? `${region} ` : ''}${specialty}’ 질의의 근거 있는 답변을 올립니다.`
						: `네이버 지식iN·관련 커뮤니티에 ‘${region ? `${region} ` : ''}${specialty}’ 질의의 근거 있는 답변을 올립니다.`,
			},
			{
				title: en ? 'Add an automated posting pipeline:' : '자동 포스팅 파이프라인:',
				body: en
					? 'Use API/AI drafts tied to real service updates so recency stays measurable.'
					: '실제 서비스 갱신에 맞춘 API/AI 초안으로 최신성 지표를 유지합니다.',
			},
		],
		bing: bingHowto(en, schema),
	};
}

function bingHowto(en: boolean, schema: string): EeatHowtoStep[] {
	return [
		{
			title: en ? 'Open Bing Places:' : 'Bing Places 접속:',
			body: en
				? 'Go to bingplaces.com and sign in with the official business account.'
				: '공식 사이트(bingplaces.com) 접속 후 공식 계정으로 로그인합니다.',
		},
		{
			title: en ? 'Enter profile details:' : '프로필 정보 입력:',
			body: en
				? `Add name, address, phone, hours, website URL, and keep them aligned with on-page ${schema} NAP.`
				: `상호·주소·전화·영업시간·대표 URL을 입력하고 온페이지 ${schema} NAP와 일치시킵니다.`,
		},
		{
			title: en ? 'Sync Google profile:' : '구글 프로필 동기화:',
			body: en
				? 'You can sync an existing Google Business Profile in about a minute, then verify sameAs.'
				: '기존 Google 비즈니스 프로필을 동기화한 뒤 sameAs로 교차 검증합니다.',
		},
	];
}

export interface BuildEeatAuditArgs {
	lang?: AuditLang;
	specialties?: readonly string[];
	primaryKeyword?: string;
	category?: string;
	location?: string;
	broadLocation?: string;
	brandName?: string;
	detectedKeywords?: readonly string[];
	industryType?: string | IndustryType;
	schemaTypes?: readonly string[];
	jsonLdCorpus?: string;
	footerText?: string;
	representativeName?: string;
	representativeJobTitle?: string;
	organizationMissing?: readonly string[];
	orgPresent: boolean;
	orgComplete: boolean;
	faqPresent?: boolean;
	geoPct?: number;
	schemaPct?: number;
	platform?: Pick<
		EnginePlatformSignals,
		| 'hasTelephone'
		| 'hasAddress'
		| 'hasOpeningHours'
		| 'sameAsCount'
		| 'googleMapsLinked'
		| 'naverPlaceLinked'
		| 'naverBlogLinked'
		| 'bingPlacesLinked'
	>;
	aiBotAccess?: {
		gptbot?: boolean;
		perplexitybot?: boolean;
		claudebot?: boolean;
		'google-extended'?: boolean;
	};
}

export function buildEeatAuditData(args: BuildEeatAuditArgs): {
	data: EeatAuditData;
	schemaProperties: SchemaPropertyCheck[];
	howtoGuides: EeatHowtoGuides;
	showMissingKeyword: boolean;
} {
	const lang: PrecisionLang = args.lang === 'en' ? 'en' : 'ko';
	const keywordInput: EeatKeywordInput = {
		specialties: args.specialties,
		primaryKeyword: args.primaryKeyword,
		category: args.category,
		location: args.location,
		broadLocation: args.broadLocation,
		brandName: args.brandName,
		detectedKeywords: args.detectedKeywords,
		industryType: args.industryType,
		lang,
	};
	const primaryKeywords = buildEeatPrimaryKeywords(keywordInput);
	const region = resolveEeatRegion(keywordInput);
	const specialty = primaryKeywords.find((kw) => kw !== region) || primaryKeywords[0] || '';
	const missingTargetKeyword = buildMissingTargetKeyword({ ...keywordInput, primaryKeywords });
	const showMissingKeyword = shouldShowMissingKeyword({
		missingTargetKeyword,
		detectedKeywords: args.detectedKeywords,
		faqPresent: args.faqPresent,
		geoPct: args.geoPct,
	});

	const keywordHay = [...primaryKeywords, args.primaryKeyword, args.category].filter(Boolean).join(' ');
	const vertical = resolveEeatVertical({
		industryType: args.industryType,
		schemaTypes: args.schemaTypes,
		keywordHay,
	});
	const schemaType = resolveEeatSchemaType({
		schemaTypes: args.schemaTypes,
		vertical,
		keywordHay,
	});

	const schemaProperties = buildSchemaPropertyChecks({
		lang,
		schemaTypes: args.schemaTypes,
		jsonLdCorpus: args.jsonLdCorpus,
		organizationMissing: args.organizationMissing,
		orgComplete: args.orgComplete,
		industryType: args.industryType,
		category: args.category,
		keyword: specialty || args.primaryKeyword,
	});

	const platform = args.platform;
	const napMatchRate = computeNapMatchRate({
		orgPresent: args.orgPresent,
		orgComplete: args.orgComplete,
		hasTelephone: platform?.hasTelephone,
		hasAddress: platform?.hasAddress,
		hasOpeningHours: platform?.hasOpeningHours,
	});

	const googleBenchmarkAvg = googleMentionBenchmarkFor(vertical);
	const googleMentionsCount = computeGoogleMentionCount({
		schemaPct: args.schemaPct ?? 50,
		orgPresent: args.orgPresent,
		orgComplete: args.orgComplete,
		sameAsCount: platform?.sameAsCount ?? 0,
		googleMapsLinked: Boolean(platform?.googleMapsLinked),
		vertical,
	});
	const naverPostingsCount = computeNaverPostingsCount({
		naverPlaceLinked: Boolean(platform?.naverPlaceLinked),
		naverBlogLinked: Boolean(platform?.naverBlogLinked),
		geoPct: args.geoPct ?? 50,
		vertical,
	});

	const howtoGuides = buildIndustryHowtoGuides({
		lang,
		vertical,
		schemaType,
		specialty,
		region,
		brandName: args.brandName,
	});

	const industry = resolveIndustryConfigFromSite({
		lang,
		brandName: args.brandName,
		location: region,
		primaryKeyword: specialty || args.primaryKeyword,
		category: args.category,
		services: args.specialties,
		legacyIndustry: args.industryType,
		title: args.brandName,
		description: keywordHay,
		keywords: keywordHay,
		schemaTypes: args.schemaTypes,
	});

	const extractedPerson = extractRepresentative(
		[args.footerText, args.jsonLdCorpus].filter(Boolean).join('\n'),
		lang,
	);
	const storedName = compact(args.representativeName);
	const personName = storedName || extractedPerson.name;
	const personJobTitle =
		compact(args.representativeJobTitle) ||
		(extractedPerson.isExtracted ? extractedPerson.jobTitle : '') ||
		industry.personJobTitle;

	const data: EeatAuditData = {
		primaryKeywords,
		missingTargetKeyword,
		personName,
		personJobTitle,
		recommendedSchemaType: industry.schemaType,
		napMatchRate,
		napStatusDescription: napStatusDescription(napMatchRate, lang),
		schemaChecklist: schemaChecklistFromProperties(schemaProperties),
		digitalFootprint: {
			googleMentionsCount,
			googleBenchmarkAvg,
			naverPostingsCount,
			bingPlacesRegistered: Boolean(platform?.bingPlacesLinked),
		},
		botAccessibility: {
			gptBot: args.aiBotAccess?.gptbot !== false,
			perplexityBot: args.aiBotAccess?.perplexitybot !== false,
			claudeBot: args.aiBotAccess?.claudebot !== false,
			googleExtended: args.aiBotAccess?.['google-extended'] !== false,
		},
	};

	return { data, schemaProperties, howtoGuides, showMissingKeyword };
}
