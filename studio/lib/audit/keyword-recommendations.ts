import {
	collectDetectedKeywordsFromMeta,
	type SiteMetadata,
	locationLabel,
} from '@/lib/audit/site-metadata';
import {
	actionNameForIndustry,
	getIndustryStrategy,
	joinRegion,
	NEUTRAL_SERVICE,
	resolveKeywordIndustry,
	serviceAt,
	type AuditLang,
	type KeywordIndustryType,
	type PipelineCtx,
} from '@/lib/audit/keyword-industry-strategy';
import { extractCoreSpecialties } from '@/lib/geo/core-specialties';
import { getIndustryProfile } from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';

export type { KeywordIndustryType } from '@/lib/audit/keyword-industry-strategy';
export { resolveKeywordIndustry } from '@/lib/audit/keyword-industry-strategy';

export type KeywordCategoryId = 'geoPrompt' | 'primary' | 'longTail' | 'lsiLocal';

export interface KeywordCategory {
	id: KeywordCategoryId;
	keywords: string[];
}

export interface KeywordRecommendationPack {
	categories: KeywordCategory[];
}

export interface KeywordSourceEvidence {
	priority: string;
	sourceName: string;
	sourceKey: string;
	content: string;
	chips: string[];
}

export interface KeywordPipelineResult {
	detectedSources: KeywordSourceEvidence[];
	aiPrompts: string[];
	mainTargetKeywords: string[];
	conversionLongtail: string[];
	localLsiKeywords: string[];
}

/** Shopping-mall / agency leak terms — only allowed when `registry.actionName` contains them. */
const MEDICAL_AGENCY_LEAK = /비교 후기|무료 상담|free consultation/i;

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

function isClinicLikeSpecialty(spec: string): boolean {
	return /스포츠|sports|아동|발달|소아|정형|통증|도수|관절|ortho|pain|manual/i.test(spec);
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

/** Ranked 1–3 specialties from crawl metadata (title / meta / nav / schema). */
export function resolveRankedSpecialties(meta: SiteMetadata, lang: AuditLang = 'ko'): string[] {
	const fromMeta = (meta.coreSpecialties ?? []).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
	if (fromMeta.length >= 2) return uniq(fromMeta, 3);

	const extracted = extractCoreSpecialties({
		title: meta.title,
		metaKeywords: meta.metaKeywords,
		navMenuTexts: meta.navMenuTexts,
		description: meta.metaDescription,
		ogTitle: meta.ogTitle,
		ogDescription: meta.ogDescription,
		schemaTerms: meta.schemaKnowsAbout,
		targetKeywords: [...(meta.detectedKeywords ?? []), ...(meta.entityPhrases ?? [])],
		category: meta.category,
		primaryKeyword: meta.primaryKeyword,
		h2Texts: meta.h2Texts,
		lang,
	});

	const merged = uniq([...fromMeta, ...extracted, topicFocus(meta, lang)], 3);
	return merged.length ? merged : [lang === 'en' ? NEUTRAL_SERVICE.en : NEUTRAL_SERVICE.ko];
}

function interleave(groups: string[][], limit: number): string[] {
	const maxLen = Math.max(0, ...groups.map((group) => group.length));
	const rows: string[] = [];
	for (let col = 0; col < maxLen; col += 1) {
		for (const group of groups) {
			rows.push(group[col] || '');
		}
	}
	return uniq(rows, limit);
}

function dropShopAndAgencyLeak(items: string[], actionName: string, medical: boolean): string[] {
	const allowQuote = /견적|quote|estimate/i.test(actionName);
	const allowTip = /팁|tip/i.test(actionName);
	return items.filter((item) => {
		if (medical && MEDICAL_AGENCY_LEAK.test(item)) return false;
		if (/견적|quote\b|quotation|estimate|가격표|price list/i.test(item) && !allowQuote) return false;
		if (/가이드$|\b팁\b|\btips?\b/i.test(item) && !allowTip) return false;
		return true;
	});
}

function buildPipelineCtx(
	clientName: string,
	region: string,
	services: string[],
	lang: AuditLang,
	industry: KeywordIndustryType = 'general',
): PipelineCtx {
	const brand = clientName.replace(/\s+/g, ' ').trim();
	const loc = region.replace(/\s+/g, ' ').trim();
	const fallback = lang === 'en' ? NEUTRAL_SERVICE.en : NEUTRAL_SERVICE.ko;
	const ranked = uniq(
		services.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
		3,
	);
	return {
		brand,
		loc,
		cityOk: Boolean(loc && loc !== '해당' && loc !== 'this'),
		lang,
		services: ranked.length ? ranked : [fallback],
		actionName: actionNameForIndustry(industry, lang),
	};
}

function buildMainTargetKeywords(ctx: PipelineCtx, placeNoun: string, officialSuffix: string): string[] {
	const s0 = serviceAt(ctx.services, 0);
	const s1 = serviceAt(ctx.services, 1);
	const s2 = ctx.services[2] || '';
	return uniq(
		[
			ctx.brand,
			joinRegion(ctx.loc, s0),
			joinRegion(ctx.loc, s1),
			ctx.brand ? `${ctx.brand} ${s0}` : '',
			s2 ? joinRegion(ctx.loc, s2) : ctx.cityOk ? `${ctx.loc} ${placeNoun}` : placeNoun,
			ctx.brand ? `${ctx.brand} ${officialSuffix}` : '',
		],
		6,
	);
}

/**
 * Industry-agnostic GEO/SEO keyword engine.
 * Maps `industry` → intent templates, then cycles services[0..2] across AI / long-tail / LSI.
 */
export function generateUniversalKeywordPipeline(
	clientName: string,
	region: string,
	services: string[],
	industry: KeywordIndustryType = 'general',
	lang: AuditLang = 'ko',
	detectedSources: KeywordSourceEvidence[] = [],
): KeywordPipelineResult {
	const strategy = getIndustryStrategy(industry);
	const ctx = buildPipelineCtx(clientName, region, services, lang, industry);
	const placeNoun = lang === 'en' ? strategy.placeNoun.en : strategy.placeNoun.ko;
	const officialSuffix = lang === 'en' ? strategy.officialSuffix.en : strategy.officialSuffix.ko;

	const aiPrompts = uniq(strategy.aiPrompts(ctx), 6);
	const mainTargetKeywords = buildMainTargetKeywords(ctx, placeNoun, officialSuffix);
	const conversionLongtail = dropShopAndAgencyLeak(
		uniq(
			[
				...interleave(
					ctx.services.map((spec) => strategy.conversionForService(spec, ctx)),
					8,
				),
				...strategy.extraConversion(ctx),
			],
			8,
		),
		ctx.actionName,
		strategy.filterAgencyLeak,
	);
	const localLsiKeywords = dropShopAndAgencyLeak(
		uniq(
			[
				...interleave(
					ctx.services.map((spec) => strategy.lsiForService(spec, ctx)),
					8,
				),
				...strategy.extraLsi(ctx),
			],
			8,
		),
		ctx.actionName,
		strategy.filterAgencyLeak,
	);

	return {
		detectedSources,
		aiPrompts,
		mainTargetKeywords,
		conversionLongtail,
		localLsiKeywords,
	};
}

/** @deprecated Prefer generateUniversalKeywordPipeline(..., 'medical'). */
export function generateMedicalKeywordPipeline(
	clientName: string,
	region: string,
	specialties: string[],
	lang: AuditLang = 'ko',
	detectedSources: KeywordSourceEvidence[] = [],
): KeywordPipelineResult {
	return generateUniversalKeywordPipeline(clientName, region, specialties, 'medical', lang, detectedSources);
}

function generateCancerKeywordPipeline(
	meta: SiteMetadata,
	lang: AuditLang,
	focus: string,
	loc: string,
	specialties: string[],
): KeywordPipelineResult {
	const brand = meta.brandName.trim();
	const city = loc && loc !== '해당' && loc !== 'this' ? loc : '';
	const corpus = `${brand} ${focus} ${meta.domain}`;
	const particle = isParticleTherapy(corpus);
	const audience = getIndustryProfile('medical').audienceName[lang];
	const main1 = specialties[0] || focus || (lang === 'en' ? NEUTRAL_SERVICE.en : NEUTRAL_SERVICE.ko);
	const main2 = specialties[1] || specialties[0] || focus;

	if (lang === 'en') {
		return {
			detectedSources: [],
			aiPrompts: uniq(
				particle
					? [
							'carbon ion therapy overseas hospital recommendation',
							brand ? `${brand} consultation how to book` : 'particle therapy consultation process',
							'Japan carbon ion therapy cost and procedure',
							city ? `${city} carbon ion therapy specialist clinic` : 'best carbon ion therapy center comparison',
							`${focus} vs proton therapy which is better`,
							brand ? `${brand} patient eligibility criteria` : 'who is eligible for carbon ion therapy',
						]
					: [
							`${focus} hospital recommendation`,
							brand ? `${brand} how to schedule a consultation` : `${focus} consultation process`,
							`${focus} cost and treatment timeline`,
							city ? `best ${focus} clinic in ${city}` : `trusted ${focus} specialists`,
							`${focus} second opinion overseas options`,
							`${main2} patient eligibility`,
						],
				6,
			),
			mainTargetKeywords: uniq(
				[brand, main1, city ? `${city} ${main1}` : '', brand && main1 ? `${brand} ${main1}` : '', 'cancer center', brand ? `${brand} official` : ''],
				6,
			),
			conversionLongtail: uniq(
				[
					`${main1} consultation booking`,
					`${main1} eligibility and process`,
					brand ? `${brand} first-visit booking` : `${main1} booking`,
					`${main1} cost and treatment timeline`,
					`${main1} insurance / coverage options`,
					`${main1} treatment reviews`,
					`${main2} second opinion`,
					brand ? `${brand} patient criteria` : `${main1} who qualifies`,
				],
				8,
			),
			localLsiKeywords: uniq(
				particle
					? ['proton therapy', 'radiation oncology', 'cancer center', 'heavy ion radiotherapy', 'oncology second opinion', city ? `${city} ${main1}` : '']
					: ['oncology', 'radiation therapy', 'chemotherapy alternatives', 'cancer specialist', 'tumor board', city ? `${city} ${main1}` : ''],
				8,
			),
		};
	}

	return {
		detectedSources: [],
		aiPrompts: uniq(
			particle
				? [
						'중입자치료 해외 병원 추천',
						brand ? `${brand} 상담 방법` : '중입자치료 상담 방법',
						'일본 중입자 치료 비용 및 절차',
						city ? `${city} 중입자치료 전문 병원` : '중입자치료 국내 병원 비교',
						'중입자치료 vs 양성자치료 차이',
						brand ? `${brand} 치료 대상 및 적응증` : '중입자치료 적응증 대상암',
					]
				: [
						`${focus} 병원 추천`,
						brand ? `${brand} 상담 방법` : `${focus} 상담 예약 방법`,
						`${focus} 비용 및 치료 절차`,
						city ? `${city} ${focus} 전문 병원` : `${focus} 국내외 비교`,
							`${focus} 적응증과 대상 ${audience}`,
						brand ? `${brand} 후기 및 치료 사례` : `${main2} 성공 사례`,
					],
			6,
		),
		mainTargetKeywords: uniq(
			[brand, main1, city ? `${city} ${main1}` : '', brand && main1 ? `${brand} ${main1}` : '', '암센터', brand ? `${brand} 공식` : ''],
			6,
		),
		conversionLongtail: uniq(
			[
				`${main1} 상담 예약`,
				`${main1} 적응증과 치료 절차`,
				brand ? `${brand} 첫 방문 예약` : `${main1} 예약`,
				`${main1} 비용 및 일정`,
				`${main1} 보험 적용 여부`,
				`${main1} 치료 후기 및 추천`,
				`${main2} 세컨드 오피니언`,
				brand ? `${brand} 치료 대상` : `${main1} 대상 ${audience}`,
			],
			8,
		),
		localLsiKeywords: uniq(
			particle
				? ['양성자치료', '방사선종양학과', '암센터', '탄소이온치료', '해외 암치료', '중입자 적응증', city ? `${city} ${main1}` : '']
				: ['종양내과', '방사선치료', '항암치료 대안', '암 전문의', '암 수술', city ? `${city} ${main1}` : ''],
			8,
		),
	};
}

function packFromPipeline(pipeline: KeywordPipelineResult): KeywordRecommendationPack {
	return {
		categories: [
			{ id: 'geoPrompt', keywords: pipeline.aiPrompts },
			{ id: 'primary', keywords: pipeline.mainTargetKeywords },
			{ id: 'longTail', keywords: pipeline.conversionLongtail },
			{ id: 'lsiLocal', keywords: pipeline.localLsiKeywords },
		],
	};
}

export type KeywordSourceId = 'schema' | 'title' | 'meta' | 'og' | 'heading' | 'body';

export interface KeywordSourceDetail {
	id: KeywordSourceId;
	priority: 1 | 2 | 3 | 4 | 5 | 6;
	present: boolean;
	/** Plain extracted text (title, description, OG). */
	text: string;
	/** Chip-style values (schema entities, headings, body keywords). */
	chips: string[];
}

const SOURCE_EVIDENCE_META: Record<KeywordSourceId, { sourceName: string; sourceKey: string }> = {
	schema: { sourceName: 'JSON-LD Schema', sourceKey: 'knowsAbout' },
	title: { sourceName: 'Title Tag', sourceKey: '<title>' },
	meta: { sourceName: 'Meta Tags', sourceKey: 'keywords' },
	og: { sourceName: 'Open Graph', sourceKey: 'og:title' },
	heading: { sourceName: 'Headings', sourceKey: 'H1-H2' },
	body: { sourceName: 'HTML Body', sourceKey: 'Body' },
};

export function toKeywordSourceEvidence(rows: KeywordSourceDetail[]): KeywordSourceEvidence[] {
	return rows.map((row) => ({
		priority: `P${row.priority}`,
		sourceName: SOURCE_EVIDENCE_META[row.id].sourceName,
		sourceKey: SOURCE_EVIDENCE_META[row.id].sourceKey,
		content: row.text,
		chips: row.chips,
	}));
}

function uniqLabels(items: Array<string | undefined | null>, limit = 16): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = (raw || '').replace(/\s+/g, ' ').trim();
		if (!v || v.length < 2) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

function firstText(...candidates: Array<string | null | undefined>): string {
	for (const raw of candidates) {
		const v = (raw || '').replace(/\s+/g, ' ').trim();
		if (v) return v;
	}
	return '';
}

/**
 * Live P1–P6 crawl text for the As-Is source detail list.
 */
export function resolveKeywordSourceDetails(
	report: Pick<AuditReport, 'siteMeta' | 'metrics' | 'detectedKeywords'> & {
		extractedKeywords?: string[] | null;
		metaKeywords?: string | null;
	},
): KeywordSourceDetail[] {
	const meta = report.siteMeta;
	const metrics = report.metrics;

	const schemaChips = uniqLabels(
		[
			...(meta?.schemaKnowsAbout ?? []),
			...(meta?.schemaEntityTypes ?? []),
			...(metrics?.schemaTypes ?? []),
		],
		14,
	);

	const titleText = firstText(meta?.title, metrics?.documentTitle, metrics?.pageTitle);

	const metaChips = uniqLabels(
		[
			...(meta?.metaKeywords ?? '')
				.split(/[,|/·;]/)
				.map((part) => part.trim()),
		],
		10,
	);
	const metaDescription = firstText(meta?.metaDescription, metrics?.metaDescription);

	const ogTitle = firstText(meta?.ogTitle, metrics?.ogTitle);
	const ogDescription = firstText(meta?.ogDescription, metrics?.ogDescription);
	const ogText = [ogTitle && `og:title: ${ogTitle}`, ogDescription && `og:description: ${ogDescription}`]
		.filter(Boolean)
		.join(' · ');

	const headingChips = uniqLabels(
		[
			...(metrics?.h1Texts ?? []).map((t) => `H1: ${t}`),
			...[...(meta?.h2Texts ?? []), ...(metrics?.h2Texts ?? [])].map((t) => `H2: ${t}`),
		],
		12,
	);

	const bodyChips = uniqLabels(
		[...(meta?.entityPhrases ?? []), ...(meta?.needSignals ?? [])],
		16,
	);

	return [
		{ id: 'schema', priority: 1, present: schemaChips.length > 0, text: '', chips: schemaChips },
		{ id: 'title', priority: 2, present: Boolean(titleText), text: titleText, chips: [] },
		{
			id: 'meta',
			priority: 3,
			present: metaChips.length > 0 || Boolean(metaDescription),
			text: metaDescription,
			chips: metaChips,
		},
		{ id: 'og', priority: 4, present: Boolean(ogText), text: ogText, chips: [] },
		{ id: 'heading', priority: 5, present: headingChips.length > 0, text: '', chips: headingChips },
		{ id: 'body', priority: 6, present: bodyChips.length > 0, text: '', chips: bodyChips },
	];
}

/**
 * As-Is keywords actually crawled from the target site
 * (meta tags, HTML body phrases, schema / index signals).
 */
export function collectDetectedKeywords(
	report: Pick<AuditReport, 'siteMeta' | 'detectedKeywords'> & {
		extractedKeywords?: string[] | null;
		metaKeywords?: string | null;
	},
): string[] {
	return collectDetectedKeywordsFromMeta({
		...report.siteMeta,
		detectedKeywords: report.detectedKeywords ?? report.siteMeta?.detectedKeywords,
		extractedKeywords: report.extractedKeywords,
		metaKeywords: report.metaKeywords ?? report.siteMeta?.metaKeywords,
	});
}

export function buildKeywordPipeline(
	meta: SiteMetadata | null | undefined,
	lang: AuditLang = 'ko',
	detectedSources: KeywordSourceEvidence[] = [],
): KeywordPipelineResult {
	const empty: KeywordPipelineResult = {
		detectedSources,
		aiPrompts: [],
		mainTargetKeywords: [],
		conversionLongtail: [],
		localLsiKeywords: [],
	};
	if (!meta) return empty;

	const focus = topicFocus(meta, lang);
	const loc = locationLabel(meta, lang);
	const specialties = resolveRankedSpecialties(meta, lang);
	const corpus = `${meta.brandName} ${focus} ${meta.domain} ${specialties.join(' ')}`;
	const industry = resolveKeywordIndustry({
		industryType: meta.industryType,
		category: meta.category,
		primaryKeyword: meta.primaryKeyword,
		brandName: meta.brandName,
		services: specialties,
		domain: meta.domain,
	});

	if (industry === 'medical' && isCancerRelated(corpus) && !specialties.some(isClinicLikeSpecialty)) {
		return { ...generateCancerKeywordPipeline(meta, lang, focus, loc, specialties), detectedSources };
	}

	return generateUniversalKeywordPipeline(meta.brandName, loc, specialties, industry, lang, detectedSources);
}

/** Builds GEO/SEO target keyword packs from extracted site metadata. */
export function buildKeywordRecommendations(
	meta: SiteMetadata | null | undefined,
	lang: AuditLang = 'ko',
): KeywordRecommendationPack {
	return packFromPipeline(buildKeywordPipeline(meta, lang));
}
