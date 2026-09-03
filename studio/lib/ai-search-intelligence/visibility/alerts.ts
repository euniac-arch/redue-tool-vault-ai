import type { AsiVisibilityAlert, AsiVisibilityRecord, AsiVisibilityTrend, AsiVisibilityWindow } from '@/lib/ai-search-intelligence/types';
import { ASI_VISIBILITY_CONFIG } from '@/lib/ai-search-intelligence/visibility/config';
import { previousRecord } from '@/lib/ai-search-intelligence/visibility/trend';

const THRESHOLDS = ASI_VISIBILITY_CONFIG.alerts;

function severityFor(drop: number): AsiVisibilityAlert['severity'] {
	if (drop >= THRESHOLDS.criticalDrop) return 'critical';
	if (drop >= THRESHOLDS.warningDrop) return 'warning';
	return 'info';
}

function cause(text: string): AsiVisibilityAlert['causes'][number] {
	return { text, provenance: 'derived' };
}

function makeAlert(input: {
	type: AsiVisibilityAlert['type'];
	title: string;
	window: AsiVisibilityWindow;
	previous: number;
	current: number;
	relatedQuery?: string;
	relatedCompetitor?: string;
	relatedProvider?: AsiVisibilityAlert['relatedProvider'];
	causes: AsiVisibilityAlert['causes'];
	href: string;
}): AsiVisibilityAlert {
	const change = Math.round((input.current - input.previous) * 10) / 10;
	const drop = input.previous - input.current;
	return {
		id: `${input.type}::${input.window}::${input.relatedQuery ?? input.relatedCompetitor ?? input.relatedProvider ?? 'site'}`,
		type: input.type,
		severity: severityFor(drop),
		title: input.title,
		message: `${input.previous} → ${input.current}`,
		window: input.window,
		previousValue: input.previous,
		currentValue: input.current,
		change,
		relatedQuery: input.relatedQuery,
		relatedCompetitor: input.relatedCompetitor,
		relatedProvider: input.relatedProvider,
		causes: input.causes,
		href: input.href,
	};
}

function derivedCauses(input: {
	trend: AsiVisibilityTrend;
	previous: AsiVisibilityRecord;
	current: AsiVisibilityRecord;
}): AsiVisibilityAlert['causes'] {
	const out: AsiVisibilityAlert['causes'] = [];
	const top = input.trend.gap.competitorName;
	if (top) {
		const prev = input.previous.competitorScores[top] ?? 0;
		const now = input.current.competitorScores[top] ?? 0;
		if (now - prev >= THRESHOLDS.competitorSurge) {
			out.push(cause(`${top}의 추천·언급 증가`));
		}
	}
	if ((input.previous.citation ?? 0) - (input.current.citation ?? 0) >= THRESHOLDS.citationDrop) {
		out.push(cause('Citation 감소'));
	}
	const queryDrops = input.current.queries.filter((row) => {
		const before = input.previous.queries.find((item) => item.query === row.query);
		if (!before) return false;
		return before.mentionRate - row.mentionRate >= THRESHOLDS.queryShift;
	});
	if (queryDrops.length) {
		out.push(cause('특정 Query군 노출 감소'));
	}
	return out;
}

export function generateVisibilityAlerts(input: {
	records: readonly AsiVisibilityRecord[];
	trend: AsiVisibilityTrend;
	window: AsiVisibilityWindow;
	now?: number;
	previous?: AsiVisibilityRecord | null;
}): AsiVisibilityAlert[] {
	const current = input.records[input.records.length - 1];
	const previous = input.previous === undefined ? previousRecord(input.records, input.window, input.now) : input.previous;
	if (!current || !previous) return [];

	const causes = derivedCauses({ trend: input.trend, previous, current });
	const alerts: AsiVisibilityAlert[] = [];
	const kpis = input.trend.kpis;

	const drops: Array<{
		id: AsiVisibilityAlert['type'];
		title: string;
		threshold: number;
		kpi: keyof typeof kpis;
		href: string;
	}> = [
		{
			id: 'visibility_drop',
			title: 'AI Visibility 감소',
			threshold: THRESHOLDS.visibilityDrop,
			kpi: 'visibility',
			href: '/intelligence/evidence-explorer',
		},
		{
			id: 'recommendation_drop',
			title: 'Recommendation 감소',
			threshold: THRESHOLDS.recommendationDrop,
			kpi: 'recommendation',
			href: '/intelligence/competitor-gap',
		},
		{
			id: 'citation_drop',
			title: 'Citation 감소',
			threshold: THRESHOLDS.citationDrop,
			kpi: 'citation',
			href: '/intelligence/evidence-explorer',
		},
		{
			id: 'sov_drop',
			title: 'SOV 감소',
			threshold: THRESHOLDS.sovDrop,
			kpi: 'sov',
			href: '/intelligence/share-of-voice',
		},
	];

	for (const row of drops) {
		const metric = kpis[row.kpi];
		if (metric.current == null || metric.previous == null || metric.change == null) continue;
		if (metric.previous - metric.current < row.threshold) continue;
		alerts.push(
			makeAlert({
				type: row.id,
				title: row.title,
				window: input.window,
				previous: metric.previous,
				current: metric.current,
				causes,
				href: row.href,
			}),
		);
	}

	const top = input.trend.gap.competitorName;
	if (top) {
		const prev = previous.competitorScores[top];
		const now = current.competitorScores[top];
		if (prev != null && now != null && now - prev >= THRESHOLDS.competitorSurge) {
			alerts.push(
				makeAlert({
					type: 'competitor_surge',
					title: '경쟁사 급상승',
					window: input.window,
					previous: prev,
					current: now,
					relatedCompetitor: top,
					causes: [cause(`${top}의 추천 증가`), ...causes.filter((item) => !item.text.includes(top))],
					href: '/intelligence/competitor-gap',
				}),
			);
		}
	}

	for (const row of current.queries) {
		const before = previous.queries.find((item) => item.query === row.query);
		if (!before) continue;
		const drop = before.mentionRate - row.mentionRate;
		if (drop < THRESHOLDS.queryShift) continue;
		alerts.push(
			makeAlert({
				type: 'query_shift',
				title: '중요 Query 급변',
				window: input.window,
				previous: before.mentionRate,
				current: row.mentionRate,
				relatedQuery: row.query,
				causes: [cause(`${row.query} 노출 감소`)],
				href: '/intelligence/opportunity-finder',
			}),
		);
	}

	for (const engine of Object.keys(current.providerScores) as Array<keyof typeof current.providerScores>) {
		const prev = previous.providerScores[engine];
		const now = current.providerScores[engine];
		if (prev == null || now == null) continue;
		if (prev - now < THRESHOLDS.providerShift) continue;
		alerts.push(
			makeAlert({
				type: 'provider_anomaly',
				title: 'Provider 이상 변화',
				window: input.window,
				previous: prev,
				current: now,
				relatedProvider: engine,
				causes: [cause(`${engine} 노출 감소`)],
				href: '/intelligence/evidence-explorer',
			}),
		);
	}

	return alerts;
}
