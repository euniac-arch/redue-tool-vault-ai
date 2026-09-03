import { derivedOf, observedOf } from '@/lib/ai-search-intelligence/core/models';
import type { Alert, VisibilitySnapshot } from '@/lib/ai-search-intelligence/core/models';
import type {
	AsiAuditBind,
	AsiSource,
	AsiVisibilityMonitorSnapshot,
	AsiVisibilityRecord,
	AsiVisibilityWindow,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';
import { ASI_VISIBILITY_WINDOWS } from '@/lib/ai-search-intelligence/types';
import { generateVisibilityAlerts } from '@/lib/ai-search-intelligence/visibility/alerts';
import { compareAdjacentVisibility } from '@/lib/ai-search-intelligence/visibility/compare';
import { buildVisibilityTrend } from '@/lib/ai-search-intelligence/visibility/trend';

export function coreVisibilityFromRecord(record: AsiVisibilityRecord): VisibilitySnapshot {
	return {
		timestamp: record.timestamp,
		totalQueries: observedOf(record.queryCount),
		visibilityScore: derivedOf(record.visibility),
		recommendationRate: derivedOf(record.recommendation),
		citationRate: derivedOf(record.citation),
		shareOfVoice: derivedOf(record.sov),
		competitorScores: derivedOf(record.competitorScores),
		providerScores: derivedOf(record.providerScores),
	};
}

export function coreAlertsFromMonitor(snapshot: AsiVisibilityMonitorSnapshot): Alert[] {
	return snapshot.alerts.map((row) => ({
		type: row.type,
		severity: row.severity,
		message: row.message,
		relatedQuery: row.relatedQuery,
		relatedCompetitor: row.relatedCompetitor,
		previousValue: observedOf(row.previousValue),
		currentValue: observedOf(row.currentValue),
		createdAt: snapshot.analyzedAt,
	}));
}

export function buildVisibilityMonitorSnapshot(input: {
	site: AsiWarRoomSite;
	source: AsiSource;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	records: readonly AsiVisibilityRecord[];
	reused?: boolean;
	remeasured?: boolean;
	nextEligibleAt?: string | null;
	enrolled?: AsiVisibilityMonitorSnapshot['enrolled'];
	now?: number;
}): AsiVisibilityMonitorSnapshot {
	const latest = input.records[input.records.length - 1] ?? null;
	const trends = Object.fromEntries(
		ASI_VISIBILITY_WINDOWS.map((window) => [
			window,
			buildVisibilityTrend({ records: input.records, window, brand: input.site.brandName, now: input.now }),
		]),
	) as AsiVisibilityMonitorSnapshot['trends'];
	const comparison = compareAdjacentVisibility(input.records);
	const alerts = [
		...ASI_VISIBILITY_WINDOWS.flatMap((window: AsiVisibilityWindow) =>
			generateVisibilityAlerts({ records: input.records, trend: trends[window], window, now: input.now }),
		),
		...(comparison?.alerts ?? []),
	];
	const seen = new Set<string>();
	const unique = alerts.filter((row) => {
		if (seen.has(row.id)) return false;
		seen.add(row.id);
		return true;
	});
	return {
		source: input.source,
		analyzedAt: latest?.timestamp || new Date().toISOString(),
		boundFromAudit: input.boundFromAudit,
		auditBind: input.auditBind,
		site: input.site,
		latest,
		historyCount: input.records.length,
		reused: Boolean(input.reused),
		remeasured: Boolean(input.remeasured),
		nextEligibleAt: input.nextEligibleAt ?? null,
		enrolled: input.enrolled ?? null,
		trends,
		alerts: unique,
		comparison,
		persistVersion: 'v2',
	};
}
