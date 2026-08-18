'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
	CartesianGrid,
	Line,
	LineChart,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { TrackingStatusBadge } from '@/components/audit/TrackingStatusBadge';
type TooltipContentProps = {
	active?: boolean;
	payload?: Array<{ payload?: DomainTrackingChartPoint }>;
	label?: string | number;
};
import {
	aggregateTrackingByGranularity,
	assignTrackingEvents,
	computeTrackingDeltas,
	daysUntilNextCitationMeasurement,
	filterTrackingPointsByRange,
	formatTrackingDateTime,
	hostnameFromAuditUrl,
	isProjectedAuditReport,
	latestMeasuredAfter,
	listDomainAppliedEvents,
	listDomainTrackingSnapshots,
	mergeDomainHistoryPoints,
	overlayAppliedEventsOnPoints,
	persistReportTrackingSnapshot,
	resolveTrackingStatus,
	snapshotsFromHistoryList,
	type AppliedPatchItem,
	type DomainTrackingChartPoint,
	type TrackingEvent,
	type TrackingGranularity,
	type TrackingListRange,
} from '@/lib/audit/domain-tracking';
import {
	AUDIT_HISTORY_SYNC_CHANNEL,
	getGuestAudits,
	type AuditHistoryEntry,
} from '@/lib/audit-history-storage';
import type { AuditReport } from '@/lib/site-auditor';

interface ActualAuditHistoryTrackerProps {
	report: AuditReport;
	reportId?: string | null;
	publicView?: boolean;
}

type HistoryDotProps = {
	cx?: number;
	cy?: number;
	index?: number;
	payload?: DomainTrackingChartPoint;
	stroke?: string;
	showMarker?: boolean;
	activeIndex?: number;
};

type ChartHoverState = {
	isTooltipActive?: boolean;
	activeTooltipIndex?: number | string;
};

function resolveHoverIndex(state: ChartHoverState, length: number): number | null {
	if (!state.isTooltipActive || state.activeTooltipIndex == null || length <= 0) return null;
	const idx =
		typeof state.activeTooltipIndex === 'number'
			? state.activeTooltipIndex
			: Number(state.activeTooltipIndex);
	if (!Number.isFinite(idx) || idx < 0 || idx >= length) return null;
	return idx;
}

const HISTORY_LIST_PAGE_SIZE = 7;
const TOOLTIP_PATCH_LIMIT = 3;
const CHART_PATCH_CHIP_LIMIT = 10;

function markerEvents(events: TrackingEvent[]): TrackingEvent[] {
	return events.filter((event) => event.type !== 'baseline');
}

function uniqueNonPatchMarkers(events: TrackingEvent[]): TrackingEvent[] {
	const seen = new Set<string>();
	const out: TrackingEvent[] = [];
	for (const event of markerEvents(events)) {
		if (
			event.type === 'PATCH_APPLIED' ||
			event.type === 'schema_patch' ||
			event.type === 'OPTIMIZATION_COMPLETE'
		) {
			continue;
		}
		if (seen.has(event.type)) continue;
		seen.add(event.type);
		out.push(event);
	}
	return out;
}

function patchEventCount(events: TrackingEvent[]): number {
	return events.filter(
		(event) =>
			event.type === 'PATCH_APPLIED' ||
			event.type === 'schema_patch' ||
			event.type === 'OPTIMIZATION_COMPLETE',
	).length;
}

function primaryMarker(events: TrackingEvent[]): TrackingEvent | undefined {
	return (
		events.find((event) => event.type === 'PATCH_APPLIED') ??
		events.find((event) => event.type === 'OPTIMIZATION_COMPLETE') ??
		events.find((event) => event.type === 'schema_patch') ??
		events.find((event) => event.type === 'rescan') ??
		events.find((event) => event.type === 'score_jump' || event.type === 'score_drop')
	);
}

function markerEmoji(type: TrackingEvent['type']): string {
	if (type === 'PATCH_APPLIED' || type === 'schema_patch') return '🛠️';
	if (type === 'OPTIMIZATION_COMPLETE') return '📍';
	if (type === 'rescan') return '🚀';
	return '📈';
}

function HistoryDot({ cx, cy, payload, stroke, showMarker, index, activeIndex }: HistoryDotProps) {
	if (cx == null || cy == null || !payload) return null;
	const marker = showMarker ? primaryMarker(payload.events) : undefined;
	const hot = Boolean(marker);
	const isActive = index === activeIndex;
	return (
		<g>
			<circle
				cx={cx}
				cy={cy}
				r={isActive || hot ? 6 : 4.5}
				fill="#0f172a"
				stroke={stroke ?? '#34d399'}
				strokeWidth={isActive || hot ? 2.4 : 2}
			/>
			{isActive || hot ? (
				<circle
					cx={cx}
					cy={cy}
					r={9}
					fill="none"
					stroke={stroke ?? '#34d399'}
					strokeOpacity={isActive ? 0.5 : 0.35}
				/>
			) : null}
			{marker ? (
				<text
					x={cx}
					y={cy - 14}
					textAnchor="middle"
					fontSize="11"
					className="pointer-events-none"
				>
					{markerEmoji(marker.type)}
				</text>
			) : null}
		</g>
	);
}

function HistoryTooltip({
	active,
	payload,
	label,
	eventLabel,
	labels,
}: TooltipContentProps & {
	eventLabel: (event: TrackingEvent) => string;
	labels: {
		measured: string;
		citation: string;
		technical: string;
		externalTrust: string;
		expected: string;
		scoreSuffix: string;
		runRound: (n: number) => string;
		runDone: string;
		appliedPatches: string;
		patchAppliedCount: (count: number) => string;
		patchMore: (count: number) => string;
	};
}) {
	if (!active || !payload?.length) return null;
	const point = payload[0]?.payload as DomainTrackingChartPoint | undefined;
	if (!point) return null;
	const tags = uniqueNonPatchMarkers(point.events);
	const patchList: AppliedPatchItem[] = point.appliedPatches ?? [];
	const hiddenPatchCount = Math.max(0, patchList.length - TOOLTIP_PATCH_LIMIT);
	const fallbackPatchCount = patchEventCount(point.events);

	return (
		<div className="min-w-[180px] max-w-[280px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-950/95 dark:shadow-black/40">
			<div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-700">
				<span className="font-bold text-slate-800 dark:text-slate-100">{label}</span>
				<span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
					{point.runRound ? labels.runRound(point.runRound) : labels.runDone}
				</span>
			</div>
			{tags.length > 0 ? (
				<ul className="mb-2 flex flex-wrap gap-1">
					{tags.map((event) => (
						<li
							key={`${event.type}-${event.n ?? 0}`}
							className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
						>
							{eventLabel(event)}
						</li>
					))}
				</ul>
			) : null}
			<dl className="mb-2 space-y-1 text-[11px]">
				<div className="flex items-center justify-between gap-4">
					<dt className="text-emerald-700 dark:text-emerald-400">{labels.measured}</dt>
					<dd className="font-bold text-slate-800 dark:text-slate-100">
						{point.measuredScore}
						{labels.scoreSuffix}
					</dd>
				</div>
				<div className="flex items-center justify-between gap-4">
					<dt className="text-blue-700 dark:text-blue-400">{labels.citation}</dt>
					<dd className="font-bold text-slate-800 dark:text-slate-100">
						{point.citationIndex}
						{labels.scoreSuffix}
					</dd>
				</div>
				<div className="flex items-center justify-between gap-4">
					<dt className="text-slate-500 dark:text-slate-400">{labels.technical}</dt>
					<dd className="font-semibold text-slate-700 dark:text-slate-200">
						{point.technicalScore}
						{labels.scoreSuffix}
					</dd>
				</div>
				{point.externalTrustScore !== point.citationIndex ? (
					<div className="flex items-center justify-between gap-4">
						<dt className="text-slate-500 dark:text-slate-400">{labels.externalTrust}</dt>
						<dd className="font-semibold text-slate-700 dark:text-slate-200">
							{point.externalTrustScore}
							{labels.scoreSuffix}
						</dd>
					</div>
				) : null}
				{point.expectedScore != null ? (
					<div className="flex items-center justify-between gap-4">
						<dt className="text-amber-700 dark:text-amber-300">{labels.expected}</dt>
						<dd className="font-semibold text-amber-800 dark:text-amber-200">
							{point.expectedScore}
							{labels.scoreSuffix}
						</dd>
					</div>
				) : null}
			</dl>
			{patchList.length > 0 ? (
				<div className="border-t border-slate-200 pt-1.5 dark:border-slate-800">
					<div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
						<span>{labels.appliedPatches}</span>
						<span className="font-semibold text-blue-600 dark:text-blue-400">{patchList.length}</span>
					</div>
					<div className="flex flex-wrap gap-1">
						{patchList.slice(0, TOOLTIP_PATCH_LIMIT).map((patch) => (
							<span
								key={patch.name}
								className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
							>
								{patch.name}
							</span>
						))}
						{hiddenPatchCount > 0 ? (
							<span className="self-center text-[10px] text-slate-500">{labels.patchMore(hiddenPatchCount)}</span>
						) : null}
					</div>
				</div>
			) : fallbackPatchCount > 0 ? (
				<div className="border-t border-slate-200 pt-1.5 dark:border-slate-800">
					<span className="inline-flex rounded-full border border-amber-300/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-400/30 dark:text-amber-300">
						{labels.patchAppliedCount(fallbackPatchCount)}
					</span>
				</div>
			) : null}
		</div>
	);
}

export function ActualAuditHistoryTracker({
	report,
	reportId,
	publicView = false,
}: ActualAuditHistoryTrackerProps) {
	const t = useTranslations('audit.historyTracker');
	const router = useRouter();
	const hostname = hostnameFromAuditUrl(report.url);
	const currentId = reportId?.trim() || `local:${hostname}`;

	const [points, setPoints] = useState<DomainTrackingChartPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [granularity, setGranularity] = useState<TrackingGranularity>('daily');
	const [listRange, setListRange] = useState<TrackingListRange>('7d');
	const [visibleCount, setVisibleCount] = useState(HISTORY_LIST_PAGE_SIZE);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [rescanning, setRescanning] = useState(false);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	const reportRef = useRef(report);
	reportRef.current = report;
	const reportStamp = [
		report.url,
		report.fetchedAt,
		report.score,
		report.geoCitationScore ?? '',
		report.isPrescriptionApplied ? '1' : '0',
		report.prescriptionAppliedAt ?? '',
	].join('|');

	const loadSeries = useCallback(async () => {
		const currentReport = reportRef.current;
		const current = isProjectedAuditReport(currentReport)
			? null
			: persistReportTrackingSnapshot(currentId, currentReport);

		const local = listDomainTrackingSnapshots(hostname);
		const guest = snapshotsFromHistoryList(getGuestAudits(), hostname);
		const appliedEvents = listDomainAppliedEvents(hostname);

		let server: AuditHistoryEntry[] = [];
		try {
			const res = await fetch('/api/audit/history', { cache: 'no-store' });
			const data = (await res.json()) as { items?: AuditHistoryEntry[] };
			if (res.ok && Array.isArray(data.items)) server = data.items;
		} catch {
			// Guest + local tracking still render.
		}

		const merged = mergeDomainHistoryPoints([
			...local,
			...guest,
			...snapshotsFromHistoryList(server, hostname),
			...(current ? [current] : []),
		]);
		setPoints(overlayAppliedEventsOnPoints(assignTrackingEvents(merged), appliedEvents));
		setLoading(false);
	}, [currentId, hostname]);

	useEffect(() => {
		void loadSeries();
	}, [loadSeries, reportStamp]);

	useEffect(() => {
		const bump = () => {
			void loadSeries();
		};
		window.addEventListener(AUDIT_HISTORY_SYNC_CHANNEL, bump);
		return () => window.removeEventListener(AUDIT_HISTORY_SYNC_CHANNEL, bump);
	}, [loadSeries]);

	const chartPoints = useMemo(
		() => aggregateTrackingByGranularity(points, granularity),
		[granularity, points],
	);
	const listPoints = useMemo(() => {
		const filtered = filterTrackingPointsByRange(points, listRange);
		return [...filtered].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}, [listRange, points]);
	const visibleList = listPoints.slice(0, visibleCount);
	const patchChips = useMemo(() => {
		return points
			.filter((point) => {
				if (point.isGhostAnchor) return false;
				if ((point.appliedPatches?.length ?? 0) > 0) return true;
				return point.events.some(
					(event) =>
						event.type === 'PATCH_APPLIED' ||
						event.type === 'schema_patch' ||
						event.type === 'OPTIMIZATION_COMPLETE',
				);
			})
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, CHART_PATCH_CHIP_LIMIT);
	}, [points]);
	const deltas = useMemo(() => computeTrackingDeltas(chartPoints), [chartPoints]);
	const isSingle = chartPoints.filter((point) => !point.isGhostAnchor).length <= 1;
	const lastIndex = chartPoints.length > 0 ? chartPoints.length - 1 : 0;
	const activeIndex = hoveredIndex !== null ? hoveredIndex : lastIndex;

	useEffect(() => {
		setHoveredIndex(null);
	}, [granularity, lastIndex]);

	useEffect(() => {
		setVisibleCount(HISTORY_LIST_PAGE_SIZE);
	}, [listRange, hostname]);

	const eventLabel = useCallback((event: TrackingEvent): string => {
		if (event.type === 'PATCH_APPLIED') return t('eventPatchApplied');
		if (event.type === 'OPTIMIZATION_COMPLETE') return t('eventOptimizationDone');
		if (event.type === 'schema_patch') return t('eventSchemaPatch');
		if (event.type === 'rescan') return t('eventRescan', { n: event.n ?? 2 });
		if (event.type === 'score_jump') return t('eventScoreJump');
		if (event.type === 'score_drop') return t('eventScoreDrop');
		return t('baseline');
	}, [t]);

	const tooltipLabels = useMemo(
		() => ({
			measured: t('measured'),
			citation: t('citation'),
			technical: t('technical'),
			externalTrust: t('externalTrust'),
			expected: t('expected'),
			scoreSuffix: t('scoreSuffix'),
			runRound: (n: number) => t('runRound', { n }),
			runDone: t('runDone'),
			appliedPatches: t('appliedPatches'),
			patchAppliedCount: (count: number) => t('patchAppliedCount', { count }),
			patchMore: (count: number) => t('patchMore', { count }),
		}),
		[t],
	);

	const renderTooltip = useCallback(
		({ active, payload, label }: TooltipContentProps) => (
			<HistoryTooltip
				active={active}
				payload={payload}
				label={label}
				eventLabel={eventLabel}
				labels={tooltipLabels}
			/>
		),
		[eventLabel, tooltipLabels],
	);

	const handleChartMouseMove = useCallback(
		(state: ChartHoverState) => {
			const next = resolveHoverIndex(state, chartPoints.length);
			if (next !== null) setHoveredIndex(next);
		},
		[chartPoints.length],
	);

	const handleChartMouseLeave = useCallback(() => {
		setHoveredIndex(null);
	}, []);

	const appliedAt = report.prescriptionAppliedAt ?? null;
	const measuredAfter = appliedAt ? latestMeasuredAfter(points, appliedAt) : null;
	const trackingStatus = resolveTrackingStatus({
		appliedAt,
		latestMeasuredAt: measuredAfter,
	});
	const daysUntilNext = daysUntilNextCitationMeasurement(appliedAt, measuredAfter);
	const expectedGuide =
		report.expectedScore ??
		points.find((point) => point.expectedScore != null && !point.isGhostAnchor)?.expectedScore ??
		null;

	function handleRescan() {
		if (publicView || rescanning) return;
		const target = (report.url || '').trim();
		if (!target) return;
		setRescanning(true);
		const next = new URLSearchParams({
			url: target,
			forceRefresh: 'true',
			t: String(Date.now()),
		});
		if (reportId?.trim()) next.set('replaceId', reportId.trim());
		router.push(`/audit/result?${next.toString()}`);
	}

	return (
		<div className="flex flex-col gap-5">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<h2
						id="audit-history-tracker-title"
						className="text-xl font-bold text-slate-900 dark:text-white"
					>
						{t('title')}
					</h2>
					<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>
					<p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500">{hostname}</p>
					<TrackingStatusBadge
						status={trackingStatus}
						daysUntilNext={daysUntilNext}
						expectedScore={expectedGuide}
					/>
				</div>
				{publicView ? null : (
					<button
						type="button"
						onClick={handleRescan}
						disabled={rescanning}
						className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-400/30 dark:text-emerald-400"
					>
						{rescanning ? t('rescanning') : t('rescan')}
					</button>
				)}
			</header>

			<div className="flex flex-wrap items-center justify-between gap-2">
				{isSingle ? (
					<div className="inline-flex min-w-0 flex-1 items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-blue-700 dark:text-blue-300">
						<span aria-hidden>📌</span>
						<span>{t('day0Badge')}</span>
					</div>
				) : null}
				<div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white/70 p-0.5 dark:border-slate-800 dark:bg-slate-950/40">
					{(
						[
							{ id: 'daily' as const, label: t('granularityDaily') },
							{ id: 'weekly' as const, label: t('granularityWeekly') },
						] as const
					).map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setGranularity(item.id)}
							className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
								granularity === item.id
									? 'bg-slate-900 text-white dark:bg-emerald-500/20 dark:text-emerald-300'
									: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
							}`}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>

			{!isSingle && deltas ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<article className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
						<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
							{t('statFromBaseline')} · {t('measured')}
						</p>
						<p
							className={`mt-1 text-lg font-extrabold ${
								deltas.scoreDelta > 0
									? 'text-emerald-600 dark:text-emerald-400'
									: deltas.scoreDelta < 0
										? 'text-rose-500 dark:text-rose-400'
										: 'text-slate-500 dark:text-slate-400'
							}`}
						>
							{deltas.scoreDelta > 0
								? t('statScoreUp', { delta: deltas.scoreDelta })
								: deltas.scoreDelta < 0
									? t('statScoreDown', { delta: Math.abs(deltas.scoreDelta) })
									: t('statScoreFlat')}
						</p>
						<p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
							{deltas.first.measuredScore} → {deltas.latest.measuredScore}
							{t('scoreSuffix')}
						</p>
					</article>
					<article className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
						<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
							{t('statFromBaseline')} · {t('citation')}
						</p>
						<p
							className={`mt-1 text-lg font-extrabold ${
								(deltas.citationPct ?? deltas.citationDelta) > 0
									? 'text-blue-600 dark:text-blue-400'
									: (deltas.citationPct ?? deltas.citationDelta) < 0
										? 'text-rose-500 dark:text-rose-400'
										: 'text-slate-500 dark:text-slate-400'
							}`}
						>
							{deltas.citationPct != null
								? deltas.citationPct > 0
									? t('statCitationUp', { pct: deltas.citationPct })
									: deltas.citationPct < 0
										? t('statCitationDown', { pct: Math.abs(deltas.citationPct) })
										: t('statCitationFlat')
								: deltas.citationDelta > 0
									? t('statScoreUp', { delta: deltas.citationDelta })
									: deltas.citationDelta < 0
										? t('statScoreDown', { delta: Math.abs(deltas.citationDelta) })
										: t('statCitationFlat')}
						</p>
						<p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
							{deltas.first.citationIndex} → {deltas.latest.citationIndex}
							{t('scoreSuffix')}
						</p>
					</article>
				</div>
			) : null}

			<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:p-4">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						{t('yAxis')}
					</p>
					<ul className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
						<li className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
							<span className="h-0.5 w-4 rounded-full bg-emerald-400" aria-hidden />
							{t('measured')}
						</li>
						<li className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
							<span className="h-0.5 w-4 rounded-full bg-blue-400" aria-hidden />
							{t('citation')}
						</li>
						<li className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
							<span
								className="h-0 w-4 border-t-2 border-dashed border-amber-400"
								aria-hidden
							/>
							{t('expected')}
						</li>
					</ul>
				</div>

				{loading ? (
					<p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">{t('loading')}</p>
				) : (
					<div className="min-h-[300px] min-w-[520px]">
						<SafeResponsiveContainer minHeight={300}>
							<LineChart
								data={chartPoints ?? []}
								margin={{ top: 28, right: 16, left: 0, bottom: 8 }}
								aria-label={t('chartAria')}
								onMouseMove={handleChartMouseMove}
								onMouseLeave={handleChartMouseLeave}
							>
								<CartesianGrid strokeDasharray="3 4" stroke="currentColor" className="text-slate-200 dark:text-slate-700/80" />
								<XAxis
									dataKey="dateLabel"
									tick={{ fill: 'currentColor', fontSize: 10 }}
									className="text-slate-400 dark:text-slate-500"
									tickMargin={8}
								/>
								<YAxis
									domain={[0, 100]}
									ticks={[0, 25, 50, 75, 100]}
									tick={{ fill: 'currentColor', fontSize: 10 }}
									className="text-slate-400 dark:text-slate-500"
									tickFormatter={(v: number) => `${v}`}
									width={36}
								/>
								<Tooltip
									active={chartPoints.length > 0}
									defaultIndex={hoveredIndex === null && chartPoints.length > 0 ? lastIndex : undefined}
									content={renderTooltip}
									cursor={{
										stroke: '#818cf8',
										strokeDasharray: '3 3',
										strokeWidth: 1.5,
									}}
									wrapperStyle={{ outline: 'none', pointerEvents: 'none' }}
								/>
								<Line
									type="monotone"
									dataKey="measuredScore"
									name={t('measured')}
									stroke="#34d399"
									strokeWidth={2.4}
									dot={<HistoryDot stroke="#34d399" showMarker activeIndex={activeIndex} />}
									activeDot={{ r: 6, stroke: '#34d399', fill: '#0f172a' }}
									isAnimationActive={chartPoints.length > 1}
									connectNulls
								/>
								<Line
									type="monotone"
									dataKey="citationIndex"
									name={t('citation')}
									stroke="#60a5fa"
									strokeWidth={2.2}
									dot={<HistoryDot stroke="#60a5fa" activeIndex={activeIndex} />}
									activeDot={{ r: 6, stroke: '#60a5fa', fill: '#0f172a' }}
									isAnimationActive={chartPoints.length > 1}
									connectNulls
								/>
								<Line
									type="monotone"
									dataKey="expectedScore"
									name={t('expected')}
									stroke="#fbbf24"
									strokeWidth={2}
									strokeDasharray="6 4"
									dot={false}
									activeDot={{ r: 5, stroke: '#fbbf24', fill: '#0f172a' }}
									isAnimationActive={false}
									connectNulls={false}
								/>
							</LineChart>
						</SafeResponsiveContainer>
					</div>
				)}
				{!loading && patchChips.length > 0 ? (
					<div className="mt-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
						<ul className="flex w-max min-w-full flex-nowrap gap-2">
							{patchChips.map((point) => {
								const patchCount = point.appliedPatches?.length || patchEventCount(point.events);
								return (
									<li
										key={point.snapshotId}
										className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
									>
										{formatTrackingDateTime(point.createdAt)} ·{' '}
										{t('patchAppliedCount', { count: Math.max(patchCount, 1) })}
									</li>
								);
							})}
						</ul>
					</div>
				) : null}
			</div>

			<section className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:p-4">
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={() => setHistoryOpen((open) => !open)}
						aria-expanded={historyOpen}
						className="inline-flex min-w-0 items-center gap-2 text-left"
					>
						<h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
							{t('historyList')}
						</h3>
						<span className="text-[11px] text-slate-400 dark:text-slate-500">
							{t('showingOf', {
								shown: historyOpen ? visibleList.length : 0,
								total: listPoints.length,
							})}
						</span>
					</button>
					<button
						type="button"
						onClick={() => setHistoryOpen((open) => !open)}
						aria-expanded={historyOpen}
						className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						{historyOpen ? t('historyToggleOpen') : t('historyToggleClosed')}
					</button>
				</div>

				{historyOpen ? (
					<>
						<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
							<div className="inline-flex rounded-lg border border-slate-200 bg-white/70 p-0.5 dark:border-slate-800 dark:bg-slate-950/40">
								{(
									[
										{ id: '7d' as const, label: t('filter7d') },
										{ id: '30d' as const, label: t('filter30d') },
										{ id: 'all' as const, label: t('filterAll') },
									] as const
								).map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => setListRange(item.id)}
										className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
											listRange === item.id
												? 'bg-slate-900 text-white dark:bg-emerald-500/20 dark:text-emerald-300'
												: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
										}`}
									>
										{item.label}
									</button>
								))}
							</div>
						</div>

						{loading ? (
							<p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('loading')}</p>
						) : visibleList.length === 0 ? (
							<p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('listEmpty')}</p>
						) : (
							<ol className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
								{visibleList.map((point) => {
									const patchCount = point.appliedPatches?.length ?? 0;
									const preview = (point.appliedPatches ?? []).slice(0, TOOLTIP_PATCH_LIMIT);
									return (
										<li key={point.snapshotId} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
											<div className="min-w-0">
												<p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
													{formatTrackingDateTime(point.createdAt)}
												</p>
												<p className="mt-0.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
													{point.runRound ? t('runRound', { n: point.runRound }) : t('runDone')}
													<span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
														{point.measuredScore}
														{t('scoreSuffix')}
													</span>
													<span className="ml-1.5 font-medium text-blue-600 dark:text-blue-400">
														{t('citation')} {point.citationIndex}
														{t('scoreSuffix')}
													</span>
												</p>
											</div>
											{patchCount > 0 ? (
												<div className="flex flex-wrap items-center gap-1">
													{preview.map((patch) => (
														<span
															key={patch.name}
															className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
														>
															{patch.name}
														</span>
													))}
													{patchCount > TOOLTIP_PATCH_LIMIT ? (
														<span className="text-[10px] text-slate-500">
															{t('patchMore', { count: patchCount - TOOLTIP_PATCH_LIMIT })}
														</span>
													) : null}
												</div>
											) : null}
										</li>
									);
								})}
							</ol>
						)}

						{!loading && visibleList.length < listPoints.length ? (
							<button
								type="button"
								onClick={() => setVisibleCount((count) => count + HISTORY_LIST_PAGE_SIZE)}
								className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
							>
								{t('loadMore')}
							</button>
						) : null}
					</>
				) : null}
			</section>
		</div>
	);
}
