import type { IndustryType } from '@/lib/audit/site-metadata';
import type { AIEngineId, GeoDiagnosticReport, KeywordDepthLevel } from '@/types/geo-diagnostic';
import type { GeoNapInfo, GeoSiteContext, KeywordWeight, RecommendationReason } from '@/types/geo-prescription';
import { buildToBeKeywordPack } from '@/lib/geo/as-is-honesty';
import { cleanMedicalEntities } from '@/lib/geo/clean-medical-entities';
import { generateEngineSimulation } from '@/lib/geo/engine-simulation';
import {
	buildAfterDiagnosticReport,
	buildAppliedPatches,
	buildPrescriptionJsonLd,
	contextFromDiagnostic,
	wrapJsonLdScript,
} from '@/lib/geo/prescription-patches';
import { buildKeywordWeights, buildRecommendationReasons } from '@/lib/geo/prompt-insights';
import { attributeTagLabels, buildExpandedQueryCoverage } from '@/lib/geo/query-coverage';
import { pickExpandedTriggerQuery } from '@/lib/geo/query-location';

export type PrescriptionLang = 'ko' | 'en';

export interface PrescriptionTriggerChange {
	engineId: AIEngineId;
	engineName: string;
	beforeLevel: KeywordDepthLevel | null;
	afterLevel: KeywordDepthLevel;
}

export interface PrescriptionAfterOptions {
	industryType?: IndustryType;
	category?: string;
	location?: string;
	targetKeywords?: string[];
	existingSchemaTypes?: string[];
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	businessEntity?: string;
	entityPhrases?: string[];
	needSignals?: string[];
	nap?: GeoNapInfo;
	title?: string;
	metaKeywords?: string;
	navMenuTexts?: string[];
	representativeName?: string;
	representativeTitle?: string;
}

function siteContext(
	before: GeoDiagnosticReport,
	lang: PrescriptionLang,
	opts?: PrescriptionAfterOptions,
): GeoSiteContext {
	return contextFromDiagnostic(before, lang, {
		industryType: opts?.industryType,
		category: opts?.category,
		location: opts?.location,
		targetKeywords: opts?.targetKeywords,
		existingSchemaTypes: opts?.existingSchemaTypes,
		description: opts?.description || opts?.ogDescription,
		ogTitle: opts?.ogTitle,
		ogDescription: opts?.ogDescription,
		businessEntity: opts?.businessEntity,
		entityPhrases: opts?.entityPhrases,
		needSignals: opts?.needSignals,
		nap: opts?.nap,
		title: opts?.title,
		metaKeywords: opts?.metaKeywords,
		navMenuTexts: opts?.navMenuTexts,
		representativeName: opts?.representativeName,
		representativeTitle: opts?.representativeTitle,
	});
}

/** Client-side fallback snapshot after schema / FAQ / meta patches land. */
export function buildPrescriptionAfterReport(
	before: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
): GeoDiagnosticReport {
	const ctx = siteContext(before, lang, opts);
	const coverage = buildExpandedQueryCoverage(ctx);
	return buildAfterDiagnosticReport(
		before,
		{ ...ctx, attributeLabels: attributeTagLabels(coverage, lang) },
		before.triggerQueries,
		lang,
	);
}

export function prescriptionTriggerChanges(
	before: GeoDiagnosticReport,
	after: GeoDiagnosticReport,
): PrescriptionTriggerChange[] {
	const afterById = new Map(after.engines.map((engine) => [engine.engine.id, engine]));
	return before.engines.map((engine) => {
		const next = afterById.get(engine.engine.id);
		const afterLevel: KeywordDepthLevel = next && next.depthLevel !== null ? next.depthLevel : 2;
		return {
			engineId: engine.engine.id,
			engineName: engine.engine.name,
			beforeLevel: engine.depthLevel,
			afterLevel,
		};
	});
}

/** Combined entity + FAQPage JSON-LD ready to paste into <head>. */
export function buildPrescriptionSchemaMarkup(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
): string {
	const ctx = siteContext(report, lang, opts);
	return wrapJsonLdScript(buildPrescriptionJsonLd(ctx));
}

export function buildClientAppliedPatches(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
) {
	return buildAppliedPatches(siteContext(report, lang, opts));
}

/** Client-side fallback when /api/geo/apply-prescription is unavailable. */
export function buildClientQueryCoverage(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
) {
	return buildExpandedQueryCoverage(siteContext(report, lang, opts));
}

export function buildClientKeywordWeights(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
): KeywordWeight[] {
	const ctx = siteContext(report, lang, opts);
	return buildKeywordWeights(ctx, buildExpandedQueryCoverage(ctx));
}

/** Rebuild 6-engine To-Be queries from Answer Center rank-1~3 keywords. */
export function syncAfterReportToBeQueries(
	after: GeoDiagnosticReport,
	keywords: readonly string[],
	location: string,
	lang: PrescriptionLang,
): GeoDiagnosticReport {
	const specialties = cleanMedicalEntities(keywords, { plasticOk: true, limit: 3 });
	const pack = buildToBeKeywordPack({
		lang,
		location,
		category: specialties[0],
		primaryKeyword: specialties[0],
		brandName: after.brandName,
		specialties,
	});
	return {
		...after,
		engines: after.engines.map((engine) => {
			const sim = generateEngineSimulation(engine.engine.id, after.brandName, location, specialties, after.domain, {
				url: after.targetUrl,
				lang,
			});
			const expandedTriggerQuery = pickExpandedTriggerQuery(
				engine.engine.id,
				pack,
				sim.toBeQueries[0] || engine.postOptimization?.expandedTriggerQuery || '',
			);
			return {
				...engine,
				postOptimization: {
					targetLevel: 3 as const,
					targetLevelLabel:
						engine.postOptimization?.targetLevelLabel ||
						(lang === 'en'
							? 'Level 3 excellent (unbranded recommend queries) — Answer Center 5 prescriptions (SSL + JSON-LD + /llms.txt)'
							: 'Level 3 우수 (비브랜드 추천 질의) — Answer Center 5대 처방(SSL + JSON-LD + /llms.txt)'),
					expandedTriggerQuery,
					expectedSimulationResponse: sim.toBeResponse,
					expandedCategoryQueries: pack.all.length ? pack.all : sim.toBeQueries,
				},
			};
		}),
	};
}

export function buildClientRecommendationReasons(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
): RecommendationReason[] {
	const ctx = siteContext(report, lang, opts);
	return buildRecommendationReasons(ctx, buildExpandedQueryCoverage(ctx));
}
