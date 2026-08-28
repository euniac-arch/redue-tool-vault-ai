/**
 * 1-minute Before/After result summary — snapshot + auto-diff.
 *
 * `initialAudit` / `optimizedAudit` are the API-ready pair.
 * Until the re-diagnosis endpoint lands, UI defaults to MOCK_* samples.
 */

import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveHasLlmsTxt } from '@/lib/audit/llms-txt-check';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

export type ResultSummaryLang = 'ko' | 'en';
export type SchemaReadiness = 'missing' | 'incomplete' | 'complete';
export type LlmsTxtStatus = 'missing' | 'present';

export interface ResultSummaryAudit {
	siteName?: string;
	url?: string;
	/** 0–100 overall headline score. */
	score: number;
	schema: {
		status: SchemaReadiness;
		coverage?: number;
		schemaType?: string | null;
	};
	llmsTxt: {
		status: LlmsTxtStatus;
	};
	metaOg: {
		/** 0–100 meta + Open Graph completeness. */
		score: number;
	};
	geoLocal: {
		/** 0–100 GEO locality / local-target signal. */
		score: number;
	};
	/** Human-readable patches applied on the After snapshot. */
	appliedActions?: string[];
}

export interface ResultSummaryScorePair {
	before: number;
	after: number;
	delta: number;
}

export interface ResultSummaryDiff {
	siteName: string;
	url: string;
	score: ResultSummaryScorePair;
	schema: {
		before: SchemaReadiness;
		after: SchemaReadiness;
		improved: boolean;
		schemaType: string | null;
		beforeCoverage: number;
		afterCoverage: number;
	};
	llmsTxt: {
		before: LlmsTxtStatus;
		after: LlmsTxtStatus;
		improved: boolean;
	};
	metaOg: ResultSummaryScorePair;
	geoLocal: ResultSummaryScorePair;
	appliedActions: string[];
}

const SCHEMA_RANK: Record<SchemaReadiness, number> = {
	missing: 0,
	incomplete: 1,
	complete: 2,
};

function clampScore(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function pair(before: number, after: number): ResultSummaryScorePair {
	const b = clampScore(before);
	const a = clampScore(after);
	return { before: b, after: a, delta: a - b };
}

export function sanitizeResultSummaryFilename(name: string): string {
	const cleaned = name
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 48);
	return cleaned || 'REDUE-site';
}

function preferredSchemaType(types: string[] | undefined | null): string | null {
	if (!types?.length) return null;
	const preferred = types.find((type) =>
		/MedicalClinic|Hospital|Dentist|VeterinaryCare|LocalBusiness|Organization/i.test(type),
	);
	return preferred || types[0] || null;
}

function schemaStatusFromReport(report: AuditReport): {
	status: SchemaReadiness;
	coverage: number;
	schemaType: string | null;
} {
	const types = report.metrics?.schemaTypes ?? [];
	const coverage = clampScore(
		typeof report.schemaCoverage === 'number'
			? report.schemaCoverage
			: types.length
				? Math.min(100, types.length * 28)
				: 0,
	);
	const schemaType = preferredSchemaType(types);
	const hasJsonLd = (report.metrics?.jsonLdBlockCount ?? 0) > 0 || types.length > 0;
	let status: SchemaReadiness = 'missing';
	if (coverage >= 70 || (schemaType && coverage >= 55)) status = 'complete';
	else if (hasJsonLd || coverage >= 15) status = 'incomplete';
	return { status, coverage, schemaType };
}

function metaOgScoreFromReport(report: AuditReport): number {
	const checks = report.checklist ?? report.categories?.flatMap((cat) => cat.checks) ?? [];
	const ogCheck = checks.find((item) => item.id === 'og-tags');
	if (ogCheck) {
		if (ogCheck.status === 'pass' || ogCheck.passed) return 100;
		if (ogCheck.status === 'warning') return 62;
	}
	const metrics = report.metrics;
	let score = 0;
	if ((metrics?.titleLength ?? 0) >= 10 || metrics?.pageTitle || metrics?.documentTitle) score += 25;
	if ((metrics?.metaDescriptionLength ?? 0) >= 50 || metrics?.metaDescription) score += 25;
	if (metrics?.ogTitle) score += 25;
	if (metrics?.ogDescription) score += 25;
	return clampScore(score);
}

function geoLocalScoreFromReport(report: AuditReport): number {
	if (typeof report.geoCitationScore === 'number' && Number.isFinite(report.geoCitationScore)) {
		return clampScore(report.geoCitationScore);
	}
	const meta = report.siteMeta;
	let score = 18;
	if (meta?.location || meta?.broadLocation) score += 28;
	const types = report.metrics?.schemaTypes ?? [];
	if (types.some((type) => /MedicalClinic|LocalBusiness|Hospital|Dentist/i.test(type))) score += 26;
	if (meta?.primaryKeyword) score += 12;
	return clampScore(score);
}

function defaultAppliedActions(
	initial: ResultSummaryAudit,
	optimized: ResultSummaryAudit,
	lang: ResultSummaryLang,
): string[] {
	if (optimized.appliedActions?.length) return optimized.appliedActions;
	const ko = lang !== 'en';
	const actions: string[] = [];
	const schemaType = optimized.schema.schemaType || (ko ? '엔티티' : 'entity');
	if (SCHEMA_RANK[optimized.schema.status] > SCHEMA_RANK[initial.schema.status]) {
		actions.push(ko ? `${schemaType} 스키마 주입` : `${schemaType} schema injected`);
	}
	if (initial.llmsTxt.status === 'missing' && optimized.llmsTxt.status === 'present') {
		actions.push(ko ? '/llms.txt 배포' : '/llms.txt published');
	}
	if (optimized.metaOg.score - initial.metaOg.score >= 8) {
		actions.push(ko ? '메타태그 & OpenGraph 보완' : 'Meta tags & Open Graph completed');
	}
	if (optimized.geoLocal.score - initial.geoLocal.score >= 8) {
		actions.push(ko ? 'GEO 지역성/로컬 타겟 신호 보강' : 'GEO locality / local-target signals reinforced');
	}
	return actions;
}

/**
 * Map a live / stored AuditReport into the summary snapshot.
 *
 * `score` must match the exact headline number the result page renders
 * (`DualScoreSummaryHeader` / `buildDiagnosisScoreSnapshot().measuredScore`) —
 * it used to be `normalizeTo100(report.score, report.maxScore)`, a legacy
 * checklist raw/max ratio that silently drifted from the real Track1×40% +
 * Track2×40% + CWV×20% (− security penalty) composite shown everywhere else,
 * making the Before/After popup disagree with the page it sits on top of.
 * Pass `coreWebVitalsScore100` (live PSI read) when the caller has one so the
 * "After" side matches the on-screen score to the digit; omitted (e.g. for a
 * historical "Before" report) it falls back to the on-page performance
 * estimate, same as `buildSnapshotFromReport` uses for stored timeline points.
 */
export function resultSummaryFromAuditReport(
	report: AuditReport,
	options?: { coreWebVitalsScore100?: number | null },
): ResultSummaryAudit {
	const schema = schemaStatusFromReport(report);
	const lang: AuditLang = report.lang === 'en' ? 'en' : 'ko';
	const measuredScore = buildDiagnosisScoreSnapshot(report, null, lang, {
		coreWebVitalsScore100: options?.coreWebVitalsScore100,
	}).measuredScore;
	return {
		siteName: resolveProjectSiteName(report) || siteLabelFromUrl(report.url),
		url: report.url,
		score: clampScore(measuredScore),
		schema,
		llmsTxt: { status: resolveHasLlmsTxt(report) ? 'present' : 'missing' },
		metaOg: { score: metaOgScoreFromReport(report) },
		geoLocal: { score: geoLocalScoreFromReport(report) },
	};
}

/**
 * Map a real historical domain-tracking point (first-ever / latest measured diagnosis for this
 * site) into the summary shape. Only `score` (measuredScore), `geoLocal` (citationIndex) and
 * `metaOg` (technicalScore) are tracked numerically over time — `schemaType` / `llmsTxt` aren't
 * stored per-snapshot, so callers should pass the current known values for those (kept identical
 * across before/after rather than fabricating a historical value we never measured).
 */
export function resultSummaryFromTrackingPoint(
	point: { measuredScore: number; citationIndex: number; technicalScore: number; schemaCoverage: number },
	known: { siteName?: string; url?: string; schemaType?: string | null; llmsTxt: LlmsTxtStatus },
): ResultSummaryAudit {
	const coverage = clampScore(point.schemaCoverage);
	let status: SchemaReadiness = 'missing';
	if (coverage >= 70) status = 'complete';
	else if (coverage >= 15) status = 'incomplete';
	return {
		siteName: known.siteName,
		url: known.url,
		score: clampScore(point.measuredScore),
		schema: { status, coverage, schemaType: known.schemaType ?? null },
		llmsTxt: { status: known.llmsTxt },
		metaOg: { score: clampScore(point.technicalScore) },
		geoLocal: { score: clampScore(point.citationIndex) },
	};
}

export function buildResultSummaryDiff(
	initialAudit: ResultSummaryAudit,
	optimizedAudit: ResultSummaryAudit,
	lang: ResultSummaryLang = 'ko',
): ResultSummaryDiff {
	const schemaType = optimizedAudit.schema.schemaType || initialAudit.schema.schemaType || null;
	return {
		siteName:
			optimizedAudit.siteName ||
			initialAudit.siteName ||
			(optimizedAudit.url ? siteLabelFromUrl(optimizedAudit.url) : '') ||
			(initialAudit.url ? siteLabelFromUrl(initialAudit.url) : '') ||
			(lang === 'en' ? 'Audited site' : '진단 사이트'),
		url: optimizedAudit.url || initialAudit.url || '',
		score: pair(initialAudit.score, optimizedAudit.score),
		schema: {
			before: initialAudit.schema.status,
			after: optimizedAudit.schema.status,
			improved: SCHEMA_RANK[optimizedAudit.schema.status] > SCHEMA_RANK[initialAudit.schema.status],
			schemaType,
			beforeCoverage: clampScore(initialAudit.schema.coverage ?? 0),
			afterCoverage: clampScore(optimizedAudit.schema.coverage ?? 0),
		},
		llmsTxt: {
			before: initialAudit.llmsTxt.status,
			after: optimizedAudit.llmsTxt.status,
			improved: initialAudit.llmsTxt.status === 'missing' && optimizedAudit.llmsTxt.status === 'present',
		},
		metaOg: pair(initialAudit.metaOg.score, optimizedAudit.metaOg.score),
		geoLocal: pair(initialAudit.geoLocal.score, optimizedAudit.geoLocal.score),
		appliedActions: defaultAppliedActions(initialAudit, optimizedAudit, lang),
	};
}

export function formatClientResultReport(
	diff: ResultSummaryDiff,
	lang: ResultSummaryLang = 'ko',
): string {
	const schemaLabel = {
		ko: { missing: '없음', incomplete: '미흡', complete: '완료' },
		en: { missing: 'Missing', incomplete: 'Incomplete', complete: 'Complete' },
	}[lang];
	const llmsLabel = {
		ko: { missing: '없음', present: '생성 완료' },
		en: { missing: 'Missing', present: 'Published' },
	}[lang];
	const lift = (delta: number) => (delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '');
	const lines =
		lang === 'en'
			? [
					'REDUE AI · 1-minute Before/After summary',
					`Site: ${diff.siteName}${diff.url ? ` (${diff.url})` : ''}`,
					'',
					`Overall score: ${diff.score.before} → ${diff.score.after}${lift(diff.score.delta)}`,
					`Schema.org: ${schemaLabel[diff.schema.before]} → ${schemaLabel[diff.schema.after]}`,
					`AI discoverability (llms.txt): ${llmsLabel[diff.llmsTxt.before]} → ${llmsLabel[diff.llmsTxt.after]}`,
					`Meta & Open Graph: ${diff.metaOg.before} → ${diff.metaOg.after}${lift(diff.metaOg.delta)}`,
					`GEO locality: ${diff.geoLocal.before} → ${diff.geoLocal.after}${lift(diff.geoLocal.delta)}`,
					'',
					'Applied automations',
					...(diff.appliedActions.length
						? diff.appliedActions.map((item, index) => `${index + 1}. ${item}`)
						: ['- None recorded']),
				]
			: [
					'REDUE AI · 1분 요약 결과보고서 (Before / After)',
					`사이트: ${diff.siteName}${diff.url ? ` (${diff.url})` : ''}`,
					'',
					`종합 점수: ${diff.score.before}점 → ${diff.score.after}점${lift(diff.score.delta)}점`,
					`Schema.org 구조화 데이터: ${schemaLabel[diff.schema.before]} → ${schemaLabel[diff.schema.after]}`,
					`AI 탐색성 (llms.txt): ${llmsLabel[diff.llmsTxt.before]} → ${llmsLabel[diff.llmsTxt.after]}`,
					`메타태그 & OpenGraph: ${diff.metaOg.before}점 → ${diff.metaOg.after}점${lift(diff.metaOg.delta)}점`,
					`GEO 지역성/로컬 타겟: ${diff.geoLocal.before}점 → ${diff.geoLocal.after}점${lift(diff.geoLocal.delta)}점`,
					'',
					'자동화 적용 내역',
					...(diff.appliedActions.length
						? diff.appliedActions.map((item, index) => `${index + 1}. ${item}`)
						: ['- 기록된 적용 내역 없음']),
				];
	return lines.join('\n');
}

export const MOCK_INITIAL_AUDIT: ResultSummaryAudit = {
	siteName: '예담의원',
	url: 'https://yedam-clinic.example.com',
	score: 41,
	schema: { status: 'incomplete', coverage: 18, schemaType: null },
	llmsTxt: { status: 'missing' },
	metaOg: { score: 38 },
	geoLocal: { score: 24 },
};

export const MOCK_OPTIMIZED_AUDIT: ResultSummaryAudit = {
	siteName: '예담의원',
	url: 'https://yedam-clinic.example.com',
	score: 86,
	schema: { status: 'complete', coverage: 94, schemaType: 'MedicalClinic' },
	llmsTxt: { status: 'present' },
	metaOg: { score: 92 },
	geoLocal: { score: 81 },
	appliedActions: [
		'MedicalClinic 스키마 주입',
		'/llms.txt 배포',
		'메타태그 & OpenGraph 3종 완성',
		'GEO 지역성/로컬 타겟 신호 보강',
	],
};

export const MOCK_RESULT_SUMMARY_DIFF = buildResultSummaryDiff(
	MOCK_INITIAL_AUDIT,
	MOCK_OPTIMIZED_AUDIT,
	'ko',
);
