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

/**
 * First stored audit already looks post-optimization: high overall, almost no
 * lift vs latest, and schema already injected.
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
	return before >= 85 && delta < 3 && schema >= 80;
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
}): { baseline: CustomBaselineScores | null; source: 'custom' | 'synthetic' | 'audit' } {
	const custom = parseCustomBaseline(args.customBaseline);
	if (custom) return { baseline: custom, source: 'custom' };

	if (
		needsPreOptimizationFallback({
			beforeOverall: args.beforeOverall,
			afterOverall: args.afterOverall,
			beforeSchema: args.beforeAxes?.schema ?? null,
			afterSchema: args.afterAxes.schema,
		})
	) {
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

function clampScore(value: number, min: number, max: number): number {
	return Math.round(Math.min(max, Math.max(min, value)));
}
