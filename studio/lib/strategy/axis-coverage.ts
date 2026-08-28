import { hasDistrictLocation } from '@/lib/strategy/normalize-keyword';
import type {
	CoverageLevel,
	EntityCoverage,
	NormalizedKeyword,
	SearchIntentId,
	StrategyAuditContext,
	StrategyAxisCompare,
	StrategyAxisCoverage,
	StrategyEntityNode,
	StrategyLang,
} from '@/lib/strategy/types';

const LEVEL_RANK: Record<CoverageLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function gapLevelOf(current: CoverageLevel, target: CoverageLevel): CoverageLevel {
	const delta = LEVEL_RANK[target] - LEVEL_RANK[current];
	if (delta >= 2) return 'HIGH';
	if (delta === 1) return 'MEDIUM';
	return 'LOW';
}

export function rankOfGapLevel(level: CoverageLevel): 'P0' | 'P1' | 'P2' {
	return level === 'HIGH' ? 'P0' : level === 'MEDIUM' ? 'P1' : 'P2';
}

export function levelFromScore(score: number): CoverageLevel {
	if (score >= 70) return 'HIGH';
	if (score >= 45) return 'MEDIUM';
	return 'LOW';
}

function dotsFor(level: CoverageLevel, score?: number): number {
	if (typeof score === 'number' && Number.isFinite(score)) {
		return Math.max(1, Math.min(5, Math.round(score / 20)));
	}
	return level === 'HIGH' ? 4 : level === 'MEDIUM' ? 3 : 2;
}

function presentCount(status: EntityCoverage): number {
	return status === 'present' ? 2 : status === 'partial' ? 1 : 0;
}

export function measureAxisCoverage(input: {
	ctx: StrategyAuditContext;
	parsed: NormalizedKeyword;
	intents: SearchIntentId[];
	entities: StrategyEntityNode[];
	emphasized: Set<string>;
	lang: StrategyLang;
	currentState?: StrategyAxisCompare[];
}): StrategyAxisCoverage[] {
	const { ctx, parsed, intents, entities, emphasized, lang, currentState } = input;
	const intent = new Set(intents);
	const targetFor = (axis: 'entity' | 'local' | 'content' | 'aeo' | 'trust' | 'schema'): CoverageLevel => {
		if (axis === 'entity' && (emphasized.has('entity') || intent.has('service'))) return 'HIGH';
		if (axis === 'local' && (emphasized.has('local') || intent.has('local') || hasDistrictLocation(parsed))) {
			return 'HIGH';
		}
		if (axis === 'content' && (emphasized.has('content') || intent.has('category') || intent.has('service') || intent.has('problem'))) {
			return 'HIGH';
		}
		if (
			axis === 'aeo' &&
			(emphasized.has('aeo') || intent.has('problem') || intent.has('naturalLanguage') || intent.has('aiRecommendation'))
		) {
			return 'HIGH';
		}
		if (axis === 'trust' && (emphasized.has('trust') || intent.has('recommendation'))) return 'HIGH';
		if (axis === 'schema') return intent.has('problem') || intent.has('aiRecommendation') ? 'HIGH' : 'MEDIUM';
		return 'MEDIUM';
	};
	const targetLabel = lang === 'en' ? 'STRATEGIC TARGET' : 'STRATEGIC TARGET';

	const entityScore = ctx.scores.entity?.value;
	const presentUnits = entities.reduce((sum, node) => sum + presentCount(node.status), 0);
	const entityLevel =
		typeof entityScore === 'number' ? levelFromScore(entityScore) : presentUnits >= 8 ? 'HIGH' : presentUnits >= 5 ? 'MEDIUM' : 'LOW';

	const localScore = ctx.scores.local?.value;
	const localSignals =
		Number(Boolean(ctx.localSignals.address)) +
		Number(Boolean(ctx.localSignals.telephone)) +
		Number(ctx.localSignals.hasGeo) +
		Number(ctx.localSignals.hasOpeningHours);
	const localLevel =
		typeof localScore === 'number' ? levelFromScore(localScore) : localSignals >= 3 ? 'HIGH' : localSignals >= 2 ? 'MEDIUM' : 'LOW';

	const body = ctx.contentSignals.bodyTextLength;
	const contentLevel =
		typeof body === 'number' && body >= 1200 ? 'HIGH' : typeof body === 'number' && body >= 600 ? 'MEDIUM' : 'LOW';

	const faqs = ctx.contentSignals.faqCount ?? 0;
	const hasFaq = ctx.schema.types.some((type) => /faq/i.test(type));
	const aeoLevel = hasFaq && faqs > 0 ? 'HIGH' : faqs > 0 ? 'MEDIUM' : 'LOW';

	const trustLevel =
		ctx.trustSignals.sameAsCount > 0 && ctx.entities.representativeName
			? 'HIGH'
			: ctx.trustSignals.sameAsCount > 0
				? 'MEDIUM'
				: 'LOW';

	const schemaScore = typeof ctx.schema.coverage === 'number' ? ctx.schema.coverage : undefined;
	const schemaLevel =
		typeof schemaScore === 'number' ? levelFromScore(schemaScore) : ctx.schema.types.length >= 2 ? 'MEDIUM' : 'LOW';

	const compareLabel = (axis: string) => currentState?.find((row) => row.axis.toLowerCase() === axis.toLowerCase());

	const rows: Array<Omit<StrategyAxisCoverage, 'gapLevel' | 'dots' | 'targetLabel'> & { score?: number }> = [
		{
			axis: 'Entity',
			code: 'ENTITY',
			currentLevel: entityLevel,
			currentLabel: compareLabel('Entity')?.currentLabel || entityLevel,
			currentValue: entityScore,
			currentSource: typeof entityScore === 'number' ? 'audit-score' : 'audit-signal',
			targetLevel: targetFor('entity'),
			score: entityScore,
		},
		{
			axis: 'Local',
			code: 'LOCAL',
			currentLevel: localLevel,
			currentLabel: compareLabel('Local')?.currentLabel || localLevel,
			currentValue: localScore,
			currentSource: typeof localScore === 'number' ? 'audit-score' : 'audit-signal',
			targetLevel: targetFor('local'),
			score: localScore,
		},
		{
			axis: 'Content',
			code: 'CONTENT',
			currentLevel: contentLevel,
			currentLabel: compareLabel('Content')?.currentLabel || contentLevel,
			currentSource: typeof body === 'number' ? 'audit-signal' : 'qualitative',
			targetLevel: targetFor('content'),
		},
		{
			axis: 'AEO',
			code: 'AEO',
			currentLevel: aeoLevel,
			currentLabel: compareLabel('AEO')?.currentLabel || aeoLevel,
			currentSource: 'qualitative',
			targetLevel: targetFor('aeo'),
		},
		{
			axis: 'Trust',
			code: 'TRUST',
			currentLevel: trustLevel,
			currentLabel: compareLabel('Trust')?.currentLabel || trustLevel,
			currentSource: 'audit-signal',
			targetLevel: targetFor('trust'),
		},
		{
			axis: 'Schema',
			code: 'SCHEMA',
			currentLevel: schemaLevel,
			currentLabel: compareLabel('Schema')?.currentLabel || schemaLevel,
			currentValue: typeof schemaScore === 'number' ? Math.round(schemaScore) : undefined,
			currentSource: typeof schemaScore === 'number' ? 'audit-score' : 'audit-signal',
			targetLevel: targetFor('schema'),
			score: schemaScore,
		},
	];

	return rows.map((row) => ({
		axis: row.axis,
		code: row.code,
		currentLevel: row.currentLevel,
		currentLabel: row.currentLabel,
		currentValue: row.currentValue,
		currentSource: row.currentSource,
		targetLevel: row.targetLevel,
		targetLabel,
		gapLevel: gapLevelOf(row.currentLevel, row.targetLevel),
		dots: dotsFor(row.currentLevel, row.score),
	}));
}
