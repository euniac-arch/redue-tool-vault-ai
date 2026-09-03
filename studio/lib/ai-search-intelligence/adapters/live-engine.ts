import { mockAsiEngine } from '@/lib/ai-search-intelligence/adapters/mock-engine';
import type { AsiEnginePort, AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { overlayLiveCitations } from '@/lib/ai-search-intelligence/citations/overlay';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { buildEmptyLiveEvidenceSnapshot } from '@/lib/ai-search-intelligence/evidence/live-base';
import { runAsiCompetitorGap } from '@/lib/ai-search-intelligence/competitor-gap/run';
import { aggregateAsiWarRoom } from '@/lib/ai-search-intelligence/core/aggregate-war-room';
import { runAsiEvidenceExplorer } from '@/lib/ai-search-intelligence/evidence-explorer/run';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { runAsiBatches } from '@/lib/ai-search-intelligence/guard/batch';
import { attachAsiLoop } from '@/lib/ai-search-intelligence/loop/compose';
import { runAsiNextAction } from '@/lib/ai-search-intelligence/next-action/run';
import { runAsiOpportunity } from '@/lib/ai-search-intelligence/opportunity/run';
import { runAsiPerception } from '@/lib/ai-search-intelligence/perception/run';
import { attachAsiQueryProbe } from '@/lib/ai-search-intelligence/probe/overlay';
import { overlayLiveCompetitors, warRoomCompetitorsFromRegistry } from '@/lib/ai-search-intelligence/competitors/overlay';
import { syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { overlayLiveRecommendations } from '@/lib/ai-search-intelligence/providers/compose';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import { resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { collectLiveSovObservations } from '@/lib/ai-search-intelligence/sov/coverage';
import { overlayLiveSov } from '@/lib/ai-search-intelligence/sov/overlay';
import { buildAsiQuerySet } from '@/lib/ai-search-intelligence/sov/query-set';
import { buildSearchSimulation } from '@/lib/ai-search-intelligence/recommendation/simulate';
import { defaultRecommendQuery, resolveAsiTargetContext, servicesFromAudit, syncAsiQueryPool } from '@/lib/ai-search-intelligence/target';
import { hasRecentAsiSovQuery, readAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import { ASI_ENGINES, type AIResponse, type AsiWarRoomSnapshot } from '@/lib/ai-search-intelligence/types';
import { runAsiVisibility } from '@/lib/ai-search-intelligence/visibility/run';
import { recordAsiVisibilitySnapshot } from '@/lib/ai-search-intelligence/visibility/store';

async function queryAndStore(
	input: {
		query: string;
		url: string;
		brand: string;
		domain: string;
		location?: string;
		category?: string;
		refresh?: boolean;
	},
): Promise<AIResponse[]> {
	const planned = await runAsiQueryPlan({
		queries: [input.query],
		url: input.url,
		brand: input.brand,
		domain: input.domain,
		location: input.location,
		category: input.category,
		limit: 1,
		refresh: input.refresh,
	});
	return flattenAsiQueryPlan(planned);
}

function emptyLiveWarRoom(base: AsiWarRoomSnapshot): AsiWarRoomSnapshot {
	return attachAsiLoop({
		...base,
		source: 'live',
		visibility: {
			overall: 0,
			engines: ASI_ENGINES.map((engine) => ({ engine, score: 0, mentionType: 'none' as const })),
		},
		kpis: {
			visibility: 0,
			recommendationRate: 0,
			shareOfVoice: 0,
			trustScore: 0,
			agentReadiness: 0,
		},
		competitors: [],
		validResponseCount: 0,
		observationState: resolveAsiObservationState({
			analyzed: true,
			validResponseCount: 0,
			competitorCount: 0,
		}),
	});
}

/**
 * Live / hybrid path: same snapshot contract as mock.
 * Every diagnose tool queries through queryAsiProviders — never silent mock KPIs.
 * Overlay applies only when a provider tagged source live or fallback.
 * Failures keep error metadata. Hybrid may label source=fallback.
 */
export const liveAsiEngine: AsiEnginePort = {
	async loadWarRoom(input: AsiRunInput) {
		const base = await mockAsiEngine.loadWarRoom(input);
		if (!base) return null;
		const context = {
			url: base.site.url,
			brand: base.site.brandName,
			domain: base.site.domain,
			location: base.site.location,
			category: base.site.category,
		};
		await queryAndStore({
			...context,
			query:
				input.query ||
				defaultRecommendQuery({
					brandName: base.site.brandName,
					location: base.site.location,
					category: base.site.category,
					services: servicesFromAudit(input, base.site.category),
				}),
		});
		const live = readAsiSovStore(base.site.domain).filter((row) => row.source === 'live');
		const mode = resolveAsiMode();
		if (!live.length && mode === 'live') return emptyLiveWarRoom(base);
		if (!live.length && mode === 'hybrid') {
			syncCompetitorRepository(base.site.domain, {
				brand: base.site.brandName,
				location: base.site.location,
				category: base.site.category,
			});
			const competitors = warRoomCompetitorsFromRegistry(base.site.domain);
			return attachAsiLoop({
				...base,
				source: 'fallback',
				competitors,
				validResponseCount: 0,
				observationState: resolveAsiObservationState({
					analyzed: true,
					validResponseCount: 0,
					competitorCount: competitors.length,
				}),
			});
		}
		return aggregateAsiWarRoom(base);
	},
	loadPerception: runAsiPerception,
	async loadEvidence(input: AsiRunInput) {
		const base = buildEmptyLiveEvidenceSnapshot(input);
		if (!base) return null;
		const context = {
			url: base.site.url,
			brand: base.site.brandName,
			domain: base.site.domain,
			location: base.site.location,
			category: base.site.category,
		};
		const stored = readAsiCitationStore(base.site.domain);
		if (input.expandCitations && stored.responses.length === 0 && !input.probeQueries) {
			await queryAndStore({
				...context,
				query:
					input.query ||
					defaultRecommendQuery({
						brandName: base.site.brandName,
						location: base.site.location,
						category: base.site.category,
						services: servicesFromAudit(input, base.site.category),
					}),
			});
		}
		const next = readAsiCitationStore(base.site.domain);
		const withCitations = overlayLiveCitations(base, { sources: next.sources, responses: next.responses });
		const probed = await attachAsiQueryProbe(withCitations, input, async (queries) => {
			const rows: AIResponse[] = [];
			await runAsiBatches(
				queries.slice(0, ASI_GUARD.maxQueriesPerRequest),
				async (query) => {
					rows.push(...(await queryAndStore({ ...context, query })));
				},
				{ concurrency: ASI_GUARD.queryConcurrency, signal: getAsiRequestContext()?.signal },
			);
			return rows;
		});
		if (!input.probeQueries) return probed;
		const after = readAsiCitationStore(base.site.domain);
		return {
			...overlayLiveCitations(probed, { sources: after.sources, responses: after.responses }),
			queryProbe: probed.queryProbe,
		};
	},
	async loadAgentReadiness(input: AsiRunInput) {
		const base = await mockAsiEngine.loadAgentReadiness(input);
		if (!base) return null;
		if (readAsiCitationStore(base.site.domain).responses.length === 0) {
			await queryAndStore({
				url: base.site.url,
				brand: base.site.brandName,
				domain: base.site.domain,
				location: base.site.location,
				category: base.site.category,
				query:
					input.query ||
					defaultRecommendQuery({
						brandName: base.site.brandName,
						location: base.site.location,
						category: base.site.category,
						services: servicesFromAudit(input, base.site.category),
					}),
			});
		}
		return base;
	},
	loadOpportunity: runAsiOpportunity,
	loadExplorer: runAsiEvidenceExplorer,
	loadGap: runAsiCompetitorGap,
	loadAction: runAsiNextAction,
	loadVisibility: runAsiVisibility,
	async loadRecommendation(input: AsiRunInput) {
		const base = await mockAsiEngine.loadRecommendation(input);
		if (!base) return null;
		const aliases = brandAliases(base.site.brandName, base.site.domain);
		hydrateAsiHistory(base.site.domain, {
			brand: base.site.brandName,
			url: base.site.url,
			aliases,
		});
		const context = {
			url: base.site.url,
			brand: base.site.brandName,
			domain: base.site.domain,
			location: base.site.location,
			category: base.site.category,
		};
		const testQuery = input.query || base.testQuery;
		const testResponses = await queryAndStore({ ...context, query: testQuery, refresh: input.refresh === true });
		const target = resolveAsiTargetContext({ url: base.site.url, audit: input.audit });
		if (target && testQuery.trim()) {
			syncAsiQueryPool(target, { extra: [testQuery], limit: 16 });
		}

		if (input.expandSov) {
			const extras = buildAsiQuerySet(base.site, { extra: input.queries, limit: ASI_GUARD.maxQueriesPerRequest })
				.map((item) => item.query)
				.filter((query) => query !== testQuery && !hasRecentAsiSovQuery(context.domain, query));
			await runAsiBatches(
				extras,
				async (query) => {
					await queryAndStore({ ...context, query });
				},
				{ concurrency: ASI_GUARD.queryConcurrency, signal: getAsiRequestContext()?.signal },
			);
		}

		syncCompetitorRepository(base.site.domain, {
			brand: base.site.brandName,
			aliases,
			auditNames: input.audit?.report.realCompetitors?.names,
			location: base.site.location,
			category: base.site.category,
		});
		const withRows = overlayLiveRecommendations(base, testResponses, base.site.brandName);
		const withSov = overlayLiveSov(withRows, collectLiveSovObservations(base.site.domain, {
			brand: base.site.brandName,
			aliases,
		}), { honestLive: true });
		const withCompetitors = overlayLiveCompetitors(withSov, {
			auditNames: input.audit?.report.realCompetitors?.names,
		});
		recordAsiVisibilitySnapshot({
			domain: base.site.domain,
			brand: base.site.brandName,
			aliases,
			responses: testResponses,
			source: testResponses.some((row) => row.source === 'live') ? 'live' : base.source,
			cadence: 'on_demand',
		});
		return {
			...withCompetitors,
			simulation: buildSearchSimulation({
				query: testQuery,
				site: base.site,
				responses: testResponses,
				aliases,
			}),
		};
	},
};
