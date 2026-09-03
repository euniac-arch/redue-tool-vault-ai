import { derivedOf } from '@/lib/ai-search-intelligence/core/models';
import type { Action } from '@/lib/ai-search-intelligence/core/models';
import { computeNineGapMetrics, deriveCompetitorGapRows } from '@/lib/ai-search-intelligence/competitor-gap/categories';
import { rankObservedCompetitors, ratesForCompetitor, type RankedCompetitor } from '@/lib/ai-search-intelligence/competitor-gap/rates';
import { ASI_COMPETITOR_GAP_KINDS } from '@/lib/ai-search-intelligence/types';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { isUsableAsiResponse } from '@/lib/ai-search-intelligence/sov/extract';
import { compareEvidenceEntities, collectEvidenceSources } from '@/lib/ai-search-intelligence/evidence-explorer/compare';
import { buildEvidenceAnswerTrace } from '@/lib/ai-search-intelligence/evidence-explorer/trace';
import type {
	AIResponse,
	AsiAuditBind,
	AsiAuditSignalId,
	AsiCompetitorGapKind,
	AsiCompetitorGapMetric,
	AsiCompetitorGapQueryCompare,
	AsiCompetitorGapRow,
	AsiCompetitorGapBoard,
	AsiCompetitorGapSnapshot,
	AsiEvidenceEntityCompare,
	AsiEvidenceSourceRow,
	AsiCompetitorWhyWin,
	AsiSource,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

const MATRIX_KINDS: AsiCompetitorGapKind[] = [...ASI_COMPETITOR_GAP_KINDS];
const TARGET_LIMIT = 5;

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

function pct(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function emptyMetric(kind: AsiCompetitorGapKind, unit: 'percent' | 'count'): AsiCompetitorGapMetric {
	return { kind, brand: 0, competitor: 0, gap: 0, unit, available: false };
}

export function actionFromGap(row: AsiCompetitorGapRow): Action {
	return {
		id: row.id,
		title: row.recommendedAction,
		reason: row.why,
		priority: derivedOf(row.impact),
		category: row.actionCategory,
		affectedQueries: row.query ? [row.query] : [],
		expectedImpact: derivedOf(row.impact),
		relatedPages: row.evidence,
	};
}

function emptyNineMetrics(): AsiCompetitorGapMetric[] {
	return MATRIX_KINDS.map((kind) =>
		emptyMetric(kind, kind === 'citation' || kind === 'evidence' || kind === 'content' || kind === 'authority' ? 'count' : 'percent'),
	);
}

function whyTheyWin(rows: readonly AsiCompetitorGapRow[]): AsiCompetitorWhyWin[] {
	return [...rows]
		.sort((a, b) => b.impact - a.impact || b.gap - a.gap)
		.slice(0, 4)
		.map((row) => ({
			id: row.kind,
			delta: row.gap,
			unit: row.unit,
			evidence: row.evidence,
			provenance: row.evidence.length ? 'observed' : 'derived',
		}));
}

function whyTheyWinFromMetrics(metrics: readonly AsiCompetitorGapMetric[]): AsiCompetitorWhyWin[] {
	return metrics
		.filter((item) => item.available && item.gap > 0)
		.sort((a, b) => b.gap - a.gap)
		.slice(0, 4)
		.map((item) => ({
			id: item.kind,
			delta: item.gap,
			unit: item.unit,
			evidence: [],
			provenance: 'derived' as const,
		}));
}

function buildBoardForCompetitor(input: {
	competitor: RankedCompetitor;
	responses: readonly AIResponse[];
	site: AsiWarRoomSite;
	aliases?: readonly string[];
	brand: AsiEvidenceEntityCompare;
	them: AsiEvidenceEntityCompare;
	sources: AsiEvidenceSourceRow[];
	gaps: readonly AsiAuditSignalId[];
	boundFromAudit: boolean;
}): AsiCompetitorGapBoard {
	const byQuery = new Map<string, AIResponse[]>();
	for (const response of input.responses) {
		const key = response.query.trim();
		const list = byQuery.get(key) ?? [];
		list.push(response);
		byQuery.set(key, list);
	}
	const rates = [...byQuery.entries()].map(([query, responses]) =>
		ratesForCompetitor({
			query,
			responses,
			brand: input.site.brandName,
			competitor: input.competitor.name,
			siteUrl: input.site.url,
			aliases: input.aliases,
		}),
	);
	const rows = deriveCompetitorGapRows({
		competitor: input.competitor.name,
		rates,
		brand: input.brand,
		them: input.them,
		sources: input.sources,
		gaps: input.gaps,
		boundFromAudit: input.boundFromAudit,
		location: input.site.location,
	}).sort((a, b) => b.impact - a.impact || b.gap - a.gap);
	const metrics = computeNineGapMetrics({
		competitor: input.competitor.name,
		rates,
		brand: input.brand,
		them: input.them,
		sources: input.sources,
		location: input.site.location,
	});
	const why = whyTheyWin(rows);
	const queries: AsiCompetitorGapQueryCompare[] = rates
		.filter((item) => item.competitorMention > 0 || item.competitorRecommend > 0)
		.map((item) => ({
			query: item.query,
			competitor: input.competitor.name,
			brand: {
				recommendation: pct(item.brandRecommend),
				citation: item.brandCitations.length,
				mention: Math.round(item.brandMention * item.sample),
			},
			competitorStats: {
				recommendation: pct(item.competitorRecommend),
				citation: item.competitorCitations.length,
				mention: Math.round(item.competitorMention * item.sample),
			},
			gaps: {
				recommendation: pct(item.competitorRecommend) - pct(item.brandRecommend),
				citation: item.competitorCitations.length - item.brandCitations.length,
				visibility: Math.round(item.competitorMention * item.sample) - Math.round(item.brandMention * item.sample),
			},
		}));
	return {
		name: input.competitor.name,
		mentionCount: input.competitor.mentionCount,
		recommendCount: input.competitor.recommendCount,
		metrics,
		queries,
		whyTheyWin: why.length ? why : whyTheyWinFromMetrics(metrics),
		rows,
		top: rows.slice(0, 5),
	};
}

export function buildCompetitorGapSnapshot(input: {
	site: AsiWarRoomSite;
	responses: readonly AIResponse[];
	source: AsiSource;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	gaps: readonly AsiAuditSignalId[];
	aliases?: readonly string[];
	competitor?: string;
	/** Shared repository names (observed + confirmed). Unioned with response extract. */
	knownCompetitors?: readonly string[];
}): AsiCompetitorGapSnapshot {
	const validResponses = input.responses.filter((row) => isUsableAsiResponse(row) && row.source === 'live');
	const ranked = rankObservedCompetitors({
		responses: input.responses,
		brand: input.site.brandName,
		aliases: input.aliases,
	});
	const known = (input.knownCompetitors ?? []).filter((name) => !ranked.some((row) => row.name.toLowerCase() === name.toLowerCase()));
	const mergedRanked: RankedCompetitor[] = [
		...ranked,
		...known.map((name) => ({ name, mentionCount: 0, recommendCount: 0 })),
	];
	const names = unique(mergedRanked.map((row) => row.name));
	const queryCount = unique(input.responses.map((row) => row.query)).length;
	const observationState = resolveAsiObservationState({
		analyzed: input.source === 'live' || validResponses.length > 0,
		validResponseCount: validResponses.length,
		competitorCount: names.length,
	});
	const emptySummary = {
		competitorsObserved: names.length,
		totalGaps: 0,
		highImpact: 0,
		validResponseCount: validResponses.length,
		queryCount,
		observationState,
	};
	const answers = input.responses.map((response) =>
		buildEvidenceAnswerTrace({
			response,
			brand: input.site.brandName,
			siteUrl: input.site.url,
			aliases: input.aliases,
			location: input.site.location,
			gaps: input.gaps,
		}),
	);
	const sources = collectEvidenceSources({
		responses: input.responses,
		siteUrl: input.site.url,
		brand: input.site.brandName,
		competitors: names,
	});
	const compared = compareEvidenceEntities({
		brand: input.site.brandName,
		competitors: names,
		siteUrl: input.site.url,
		sources,
		answers,
	});
	const selected =
		mergedRanked.find((row) => row.name === input.competitor)?.name ??
		mergedRanked[0]?.name;
	if (!selected) {
		return {
			source: input.source,
			analyzedAt: new Date().toISOString(),
			boundFromAudit: input.boundFromAudit,
			auditBind: input.auditBind,
			site: input.site,
			brand: compared.brand,
			competitors: [],
			rankedCompetitors: [],
			boards: [],
			metrics: emptyNineMetrics(),
			queries: [],
			whyTheyWin: [],
			rows: [],
			top: [],
			summary: emptySummary,
		};
	}

	const boards = mergedRanked.slice(0, TARGET_LIMIT).map((competitor) =>
		buildBoardForCompetitor({
			competitor,
			responses: input.responses,
			site: input.site,
			aliases: input.aliases,
			brand: compared.brand,
			them:
				compared.competitors.find((item) => item.name.toLowerCase() === competitor.name.toLowerCase()) ?? {
					name: competitor.name,
					kind: 'competitor' as const,
					citations: 0,
					relevantPages: 0,
					externalSources: 0,
				},
			sources,
			gaps: input.gaps,
			boundFromAudit: input.boundFromAudit,
		}),
	);
	const active = boards.find((board) => board.name === selected) ?? boards[0]!;

	return {
		source: input.source,
		analyzedAt: new Date().toISOString(),
		boundFromAudit: input.boundFromAudit,
		auditBind: input.auditBind,
		site: input.site,
		brand: compared.brand,
		competitors: compared.competitors,
		selectedCompetitor: selected,
		rankedCompetitors: mergedRanked.slice(0, TARGET_LIMIT),
		boards,
		metrics: active.metrics,
		queries: active.queries,
		whyTheyWin: active.whyTheyWin,
		rows: active.rows,
		top: active.top,
		summary: {
			competitorsObserved: names.length,
			totalGaps: active.rows.length,
			highImpact: active.rows.filter((item) => item.impact >= 60).length,
			validResponseCount: validResponses.length,
			queryCount,
			observationState,
		},
	};
}

export function uniqueObservedCompetitors(names: readonly string[]): string[] {
	return unique(names);
}
