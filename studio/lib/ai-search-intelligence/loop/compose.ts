/**
 * Intelligence Loop composer. Reads existing stores only — no provider I/O.
 */
import { buildCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/competitor-gap/analyze';
import { resolveSharedCompetitorNames, syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { toIntelligenceQuery } from '@/lib/ai-search-intelligence/core/from-asi';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { buildEvidenceExplorerSnapshot } from '@/lib/ai-search-intelligence/evidence-explorer/analyze';
import { generateNextActions } from '@/lib/ai-search-intelligence/next-action/generate';
import { analyzeOpportunityRow, buildOpportunitySnapshot } from '@/lib/ai-search-intelligence/opportunity/analyze';
import { composeAsiLoopChanges } from '@/lib/ai-search-intelligence/loop/changes';
import { emptyAsiLoop } from '@/lib/ai-search-intelligence/loop/empty';
import { generateVisibilityAlerts } from '@/lib/ai-search-intelligence/visibility/alerts';
import { latestAsiVisibilityRecord, readAsiVisibilityStore } from '@/lib/ai-search-intelligence/visibility/store';
import { buildVisibilityTrend } from '@/lib/ai-search-intelligence/visibility/trend';
import type {
	AIResponse,
	AsiIntelligenceLoop,
	AsiLoopLink,
	AsiSearchHealth,
	AsiVisibilityDelta,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

function aliasesFor(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

function emptyDelta(current: number | null): AsiVisibilityDelta {
	return { current, previous: null, change: null, changePct: null, provenance: 'observed' };
}

function healthFrom(current: number, previous: number | null): AsiSearchHealth {
	if (previous == null) {
		return { current, previous: null, change: null, changePct: null, provenance: 'derived', changeProvenance: null };
	}
	const change = Math.round((current - previous) * 10) / 10;
	const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
	return { current, previous, change, changePct, provenance: 'derived', changeProvenance: 'observed' };
}

export { emptyAsiLoop };

function responsesByQuery(rows: readonly AIResponse[]): Map<string, AIResponse[]> {
	const byQuery = new Map<string, AIResponse[]>();
	for (const row of rows) {
		const key = row.query.trim();
		if (!key) continue;
		const list = byQuery.get(key) ?? [];
		list.push(row);
		byQuery.set(key, list);
	}
	return byQuery;
}

export function composeAsiLoop(input: {
	site: AsiWarRoomSnapshot['site'];
	fallbackVisibility?: number;
	boundFromAudit?: boolean;
	source?: AsiWarRoomSnapshot['source'];
}): AsiIntelligenceLoop {
	const fallback = input.fallbackVisibility ?? 0;
	const records = readAsiVisibilityStore(input.site.domain);
	const latest = latestAsiVisibilityRecord(input.site.domain);
	const prior = records.length >= 2 ? records[records.length - 2] : null;
	const current = latest?.visibility ?? fallback;
	const trend7Full = records.length
		? buildVisibilityTrend({ records, window: '7d', brand: input.site.brandName })
		: null;
	const trend30Full = records.length
		? buildVisibilityTrend({ records, window: '30d', brand: input.site.brandName })
		: null;
	const trend7 = trend7Full?.kpis.visibility ?? emptyDelta(current);
	const trend30 = trend30Full?.kpis.visibility ?? emptyDelta(current);
	const stored = readAsiCitationStore(input.site.domain).responses;
	const aliases = aliasesFor(input.site.brandName, input.site.domain);
	const source = stored.some((row) => row.source === 'live') ? 'live' : input.source ?? 'mock';

	let opportunities: AsiLoopLink[] = [];
	let gaps: AsiLoopLink[] = [];
	let actions: AsiLoopLink[] = [];

	if (stored.length) {
		const byQuery = responsesByQuery(stored);
		const rows = [...byQuery.entries()].map(([query, responses]) =>
			analyzeOpportunityRow({
				query: toIntelligenceQuery({ query }, { location: input.site.location, service: input.site.category }),
				responses,
				brand: input.site.brandName,
				aliases,
				gaps: [],
				location: input.site.location,
				service: input.site.category,
			}),
		);
		const opportunity = buildOpportunitySnapshot({
			site: input.site,
			rows,
			source,
			boundFromAudit: Boolean(input.boundFromAudit),
		});
		const evidence = buildEvidenceExplorerSnapshot({
			site: input.site,
			responses: stored,
			source,
			boundFromAudit: Boolean(input.boundFromAudit),
			gaps: [],
			aliases,
		});
		syncCompetitorRepository(input.site.domain, {
			brand: input.site.brandName,
			aliases,
			responses: stored,
		});
		const gap = buildCompetitorGapSnapshot({
			site: input.site,
			responses: stored,
			source,
			boundFromAudit: Boolean(input.boundFromAudit),
			gaps: [],
			aliases,
			knownCompetitors: resolveSharedCompetitorNames({
				domain: input.site.domain,
				brand: input.site.brandName,
				aliases,
				responses: stored,
			}),
		});
		opportunities = opportunity.top.slice(0, 3).map((row) => ({
			id: row.queryId,
			title: row.query,
			href: '/intelligence/opportunity-finder',
			meta: row.status.toUpperCase(),
		}));
		gaps = gap.top.slice(0, 3).map((row) => ({
			id: row.id,
			title: `${row.competitor} · ${row.kind}`,
			href: '/intelligence/competitor-gap',
			meta: String(row.gap),
		}));
		actions = generateNextActions({
			opportunity,
			evidence,
			gap,
			audit: null,
			gaps: [],
			boundFromAudit: Boolean(input.boundFromAudit),
			siteUrl: input.site.url,
			site: input.site,
		})
			.slice(0, 3)
			.map((row) => ({
				id: row.id,
				title: row.title,
				href: '/intelligence/next-best-action',
				meta: row.impactTier.toUpperCase(),
			}));
	}

	const alerts = trend7Full
		? generateVisibilityAlerts({ records, trend: trend7Full, window: '7d' })
				.slice(0, 3)
				.map((row) => ({
					id: row.id,
					title: row.title,
					href: row.href,
					meta: row.message,
				}))
		: [];

	return {
		health: healthFrom(current, prior?.visibility ?? null),
		changes: composeAsiLoopChanges(latest, prior),
		opportunities,
		gaps,
		actions,
		alerts,
		trend7,
		trend30,
	};
}

export function attachAsiLoop(base: AsiWarRoomSnapshot): AsiWarRoomSnapshot {
	return {
		...base,
		loop: composeAsiLoop({
			site: base.site,
			fallbackVisibility: base.kpis.visibility,
			boundFromAudit: base.boundFromAudit,
			source: base.source,
		}),
	};
}
