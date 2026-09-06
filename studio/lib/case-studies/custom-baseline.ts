/**
 * Admin-authored pre-optimization baseline, plus a conservative reverse-calc
 * when the first stored audit is already a post-optimization snapshot.
 */

export interface CustomBaselineScores {
	overall: number;
	seo?: number | null;
	performance?: number | null;
	schema?: number | null;
	geo?: number | null;
}

/** First live score for 나인원의원 before schema/GEO work — do not replace with the current 90s. */
export const NINEONE_CLINIC_BASELINE: CustomBaselineScores = {
	overall: 58,
	seo: 68,
	performance: 71,
	schema: 0,
	geo: 45,
};

const POST_OPT_SCORE = 85;
const OVERWRITE_DELTA = 10;

export interface AxisScoreSnapshot {
	seo: number;
	performance: number;
	schema: number;
	geo: number;
}

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function asScore(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	if (value < SCORE_MIN || value > SCORE_MAX) return null;
	return Math.round(value);
}

export function parseCustomBaseline(raw: unknown): CustomBaselineScores | null {
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const overall = asScore(row.overall ?? row.total ?? row.score);
	if (overall == null) return null;
	return {
		overall,
		seo: asScore(row.seo),
		performance: asScore(row.performance ?? row.cwv),
		schema: asScore(row.schema),
		geo: asScore(row.geo ?? row.eeat),
	};
}

export function isCustomBaseline(value: unknown): value is CustomBaselineScores {
	return parseCustomBaseline(value) != null;
}

export function isNineoneClinicSite(siteName?: string | null, siteUrl?: string | null): boolean {
	const name = (siteName ?? '').replace(/\s+/g, '');
	const host = (() => {
		const raw = (siteUrl ?? '').trim();
		if (!raw) return '';
		try {
			return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '').toLowerCase();
		} catch {
			return raw.replace(/^www\./, '').toLowerCase();
		}
	})();
	return name.includes('나인원의원') || host.includes('nineoneclinic') || host === 'nineone.kr';
}

export function knownBaselineForSite(
	siteName?: string | null,
	siteUrl?: string | null,
): CustomBaselineScores | null {
	return isNineoneClinicSite(siteName, siteUrl) ? { ...NINEONE_CLINIC_BASELINE } : null;
}

/** Admin saved the current optimized score as Before (e.g. 90 / 90). */
export function looksLikeOverwrittenBaseline(
	custom: CustomBaselineScores | null | undefined,
	afterOverall: number,
): boolean {
	if (!custom) return false;
	if (custom.overall < POST_OPT_SCORE || afterOverall < POST_OPT_SCORE) return false;
	return Math.abs(custom.overall - afterOverall) < OVERWRITE_DELTA;
}

/**
 * First stored audit already looks post-optimization: high overall, almost no
 * lift vs latest. Schema is a hint, not required — a single 90-point rescan
 * often overwrites the original 58 without keeping schema history.
 */
export function needsPreOptimizationFallback(args: {
	beforeOverall: number | null;
	afterOverall: number;
	beforeSchema: number | null;
	afterSchema: number;
}): boolean {
	const before = args.beforeOverall ?? args.afterOverall;
	const schema = args.beforeSchema ?? args.afterSchema;
	const delta = Math.abs(args.afterOverall - before);
	if (before < POST_OPT_SCORE || args.afterOverall < POST_OPT_SCORE) return false;
	if (delta < OVERWRITE_DELTA) return true;
	return delta < 3 && schema >= 80;
}

/**
 * Reverse-estimate the Raw-HTML / pre-schema state from a post-optimization
 * snapshot. Matches the admin example for a 90+ clinic: overall ~58, SEO ~68,
 * Schema 0, GEO/E-E-A-T pulled down with the missing structured-data signals.
 */
export function buildPreOptimizationFallback(after: {
	overall: number;
	seo: number;
	performance: number;
	schema: number;
	geo: number;
}): CustomBaselineScores {
	const seo = clampScore(after.seo - 32, 20, after.seo);
	const performance = clampScore(after.performance, 0, after.performance);
	const schema = 0;
	const geo = clampScore(after.geo - 42, 20, after.geo);
	const overall = clampScore(after.overall - 33, 20, Math.max(20, after.overall - 15));
	return { overall, seo, performance, schema, geo };
}

export function resolveCaseStudyBaseline(args: {
	customBaseline?: CustomBaselineScores | null;
	beforeOverall: number | null;
	afterOverall: number;
	beforeAxes: AxisScoreSnapshot | null;
	afterAxes: AxisScoreSnapshot;
	siteName?: string | null;
	siteUrl?: string | null;
}): { baseline: CustomBaselineScores | null; source: 'custom' | 'known' | 'synthetic' | 'audit' } {
	const custom = parseCustomBaseline(args.customBaseline);
	const customUsable = custom && !looksLikeOverwrittenBaseline(custom, args.afterOverall);
	if (customUsable) return { baseline: custom, source: 'custom' };

	const needsFallback = needsPreOptimizationFallback({
		beforeOverall: args.beforeOverall,
		afterOverall: args.afterOverall,
		beforeSchema: args.beforeAxes?.schema ?? null,
		afterSchema: args.afterAxes.schema,
	});
	if (!needsFallback && args.beforeOverall != null && args.beforeOverall < POST_OPT_SCORE) {
		return { baseline: null, source: 'audit' };
	}

	const known = knownBaselineForSite(args.siteName, args.siteUrl);
	if (known && (needsFallback || args.beforeOverall == null)) {
		return { baseline: known, source: 'known' };
	}

	if (needsFallback) {
		return {
			baseline: buildPreOptimizationFallback({
				overall: args.afterOverall,
				...args.afterAxes,
			}),
			source: 'synthetic',
		};
	}

	return { baseline: null, source: 'audit' };
}

/** Persist this when an admin publishes a case study so Before stays the first diagnosis. */
export function preserveCaseStudyBaseline(args: {
	existingBaseline?: unknown;
	afterOverall: number;
	afterAxes?: Partial<AxisScoreSnapshot> | null;
	siteName?: string | null;
	siteUrl?: string | null;
}): CustomBaselineScores | null {
	const resolved = resolveCaseStudyBaseline({
		customBaseline: args.existingBaseline,
		beforeOverall: null,
		afterOverall: args.afterOverall,
		beforeAxes: null,
		afterAxes: {
			seo: args.afterAxes?.seo ?? 0,
			performance: args.afterAxes?.performance ?? 0,
			schema: args.afterAxes?.schema ?? 0,
			geo: args.afterAxes?.geo ?? 0,
		},
		siteName: args.siteName,
		siteUrl: args.siteUrl,
	});
	if (resolved.source === 'audit') return parseCustomBaseline(args.existingBaseline);
	return resolved.baseline;
}

function clampScore(value: number, min: number, max: number): number {
	return Math.round(Math.min(max, Math.max(min, value)));
}
