import { readAsiSessionSnapshot } from '@/lib/ai-search-intelligence/asi-bound-url';
import { emptyAsiLoop } from '@/lib/ai-search-intelligence/loop/empty';
import { changesFromVisibilityTrend } from '@/lib/ai-search-intelligence/loop/changes';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import type {
	AsiCompetitorGapSnapshot,
	AsiIntelligenceLoop,
	AsiNextActionSnapshot,
	AsiOpportunitySnapshot,
	AsiVisibilityMonitorSnapshot,
} from '@/lib/ai-search-intelligence/types';

function sameSite(url: string | undefined, siteUrl: string): boolean {
	return Boolean(url && normalizeAsiSiteUrl(url) === normalizeAsiSiteUrl(siteUrl));
}

/** Client-only overlay so War Room reflects tools the user already ran this session. */
export function mergeLoopWithSession(loop: AsiIntelligenceLoop | undefined, siteUrl: string): AsiIntelligenceLoop {
	const next = loop ?? emptyAsiLoop();
	const opportunity = readAsiSessionSnapshot<AsiOpportunitySnapshot>(
		'asi_opportunity_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const gap = readAsiSessionSnapshot<AsiCompetitorGapSnapshot>(
		'asi_gap_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const action = readAsiSessionSnapshot<AsiNextActionSnapshot>(
		'asi_action_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const visibility = readAsiSessionSnapshot<AsiVisibilityMonitorSnapshot>(
		'asi_visibility_snapshot',
		(data) => Boolean(data?.site?.url && data.trends),
	);

	const opportunities =
		opportunity && sameSite(opportunity.site.url, siteUrl)
			? opportunity.top.slice(0, 3).map((row) => ({
					id: row.queryId,
					title: row.query,
					href: '/intelligence/opportunity-finder',
					meta: row.status.toUpperCase(),
				}))
			: next.opportunities;
	const gaps =
		gap && sameSite(gap.site.url, siteUrl)
			? gap.top.slice(0, 3).map((row) => ({
					id: row.id,
					title: `${row.competitor} · ${row.kind}`,
					href: '/intelligence/competitor-gap',
					meta: String(row.gap),
				}))
			: next.gaps;
	const actions =
		action && sameSite(action.site.url, siteUrl)
			? action.top.slice(0, 3).map((row) => ({
					id: row.id,
					title: row.title,
					href: '/intelligence/next-best-action',
					meta: row.impactTier.toUpperCase(),
				}))
			: next.actions;

	let health = next.health;
	let changes = next.changes;
	let trend7 = next.trend7;
	let trend30 = next.trend30;
	let alerts = next.alerts;
	if (visibility && sameSite(visibility.site.url, siteUrl)) {
		const vis = visibility.trends['7d'].kpis.visibility;
		const vis30 = visibility.trends['30d'].kpis.visibility;
		const today = visibility.trends.today.kpis.visibility;
		health = {
			current: visibility.latest?.visibility ?? today.current ?? vis.current ?? health.current,
			previous: today.previous ?? vis.previous,
			change: today.change ?? vis.change,
			changePct: today.changePct ?? vis.changePct,
			provenance: 'derived',
			changeProvenance: (today.change ?? vis.change) != null ? 'observed' : null,
		};
		const fromTrend = changesFromVisibilityTrend(
			visibility.trends.today.hasPrevious ? visibility.trends.today : visibility.trends['7d'],
		);
		changes = {
			hasPrevious: fromTrend.hasPrevious || next.changes.hasPrevious,
			queryExposure: next.changes.queryExposure ?? fromTrend.queryExposure,
			citation: fromTrend.citation ?? next.changes.citation,
			competitorName: fromTrend.competitorName ?? next.changes.competitorName,
			competitorChange: fromTrend.competitorChange ?? next.changes.competitorChange,
			competitorChangePct: fromTrend.competitorChangePct ?? next.changes.competitorChangePct,
		};
		trend7 = vis;
		trend30 = vis30;
		alerts = visibility.alerts.slice(0, 3).map((row) => ({
			id: row.id,
			title: row.title,
			href: row.href,
			meta: row.message,
		}));
	}

	return { health, changes, opportunities, gaps, actions, alerts, trend7, trend30 };
}
