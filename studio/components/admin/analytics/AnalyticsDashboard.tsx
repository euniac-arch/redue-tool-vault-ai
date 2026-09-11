'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Globe2, Loader2, Monitor, RefreshCw, Smartphone, TrendingUp, Users } from 'lucide-react';
import { fetchAnalyticsRange } from '@/lib/admin/analyticsService';
import { shiftDateKey } from '@/lib/analytics/detect';
import type { DailyAnalyticsAggregate } from '@/lib/analytics/types';

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

type RangePreset = '7' | '30' | 'custom';

function todaySeoulDateKey(): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
}

function mergeCounts(target: Record<string, number>, source: Record<string, number> | undefined) {
	for (const [key, value] of Object.entries(source ?? {})) {
		target[key] = (target[key] ?? 0) + value;
	}
}

function sumAggregates(days: DailyAnalyticsAggregate[]) {
	const totals = {
		totalViews: 0,
		uniqueVisitors: 0,
		referrers: {} as Record<string, number>,
		devices: {} as Record<string, number>,
		browsers: {} as Record<string, number>,
	};
	for (const day of days) {
		totals.totalViews += day.totalViews;
		totals.uniqueVisitors += day.uniqueVisitors;
		mergeCounts(totals.referrers, day.referrers);
		mergeCounts(totals.devices, day.devices);
		mergeCounts(totals.browsers, day.browsers);
	}
	return totals;
}

function sortedEntries(record: Record<string, number>): [string, number][] {
	return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

export function AnalyticsDashboard() {
	const today = useMemo(() => todaySeoulDateKey(), []);
	const [preset, setPreset] = useState<RangePreset>('7');
	const [customStart, setCustomStart] = useState(() => shiftDateKey(today, -6));
	const [customEnd, setCustomEnd] = useState(today);

	const [todayData, setTodayData] = useState<DailyAnalyticsAggregate | null>(null);
	const [rangeDays, setRangeDays] = useState<DailyAnalyticsAggregate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const { rangeStart, rangeEnd } = useMemo(() => {
		if (preset === '7') return { rangeStart: shiftDateKey(today, -6), rangeEnd: today };
		if (preset === '30') return { rangeStart: shiftDateKey(today, -29), rangeEnd: today };
		return { rangeStart: customStart, rangeEnd: customEnd };
	}, [preset, today, customStart, customEnd]);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [todayRes, rangeRes] = await Promise.all([
				fetchAnalyticsRange(today, today),
				fetchAnalyticsRange(rangeStart, rangeEnd),
			]);
			setTodayData(todayRes.days[0] ?? null);
			setRangeDays(rangeRes.days);
		} catch (err) {
			setError(err instanceof Error ? err.message : '분석 데이터를 불러오지 못했습니다.');
		} finally {
			setLoading(false);
		}
	}, [today, rangeStart, rangeEnd]);

	useEffect(() => {
		void load();
	}, [load]);

	const totals = useMemo(() => sumAggregates(rangeDays), [rangeDays]);
	const referrerEntries = useMemo(() => sortedEntries(totals.referrers), [totals]);
	const deviceEntries = useMemo(() => sortedEntries(totals.devices), [totals]);
	const browserEntries = useMemo(() => sortedEntries(totals.browsers), [totals]);
	const referrerTotal = referrerEntries.reduce((sum, [, count]) => sum + count, 0);
	const deviceTotal = deviceEntries.reduce((sum, [, count]) => sum + count, 0);
	const browserTotal = browserEntries.reduce((sum, [, count]) => sum + count, 0);
	const topReferrer = referrerEntries[0]?.[0] ?? '-';

	const mobileCount = totals.devices.Mobile ?? 0;
	const desktopCount = totals.devices.Desktop ?? 0;
	const mobileVsDesktopBase = mobileCount + desktopCount;
	const mobileRatio = mobileVsDesktopBase > 0 ? Math.round((mobileCount / mobileVsDesktopBase) * 100) : 0;
	const desktopRatio = mobileVsDesktopBase > 0 ? 100 - mobileRatio : 0;

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<KpiCard label="오늘 순 방문자" value={(todayData?.uniqueVisitors ?? 0).toLocaleString('ko-KR')} icon={Users} tone="blue" />
				<KpiCard label="오늘 페이지뷰" value={(todayData?.totalViews ?? 0).toLocaleString('ko-KR')} icon={Eye} tone="emerald" />
				<KpiCard label="Top 유입 경로" value={topReferrer} icon={Globe2} tone="violet" />
				<KpiCard label="모바일 / 데스크톱" value={`${mobileRatio}% / ${desktopRatio}%`} icon={Smartphone} tone="amber" />
			</div>

			<div className={CARD}>
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/60" role="tablist" aria-label="조회 기간">
						{(
							[
								{ value: '7', label: '최근 7일' },
								{ value: '30', label: '최근 30일' },
								{ value: 'custom', label: '기간 지정' },
							] as { value: RangePreset; label: string }[]
						).map((tab) => {
							const active = preset === tab.value;
							return (
								<button
									key={tab.value}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setPreset(tab.value)}
									className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
										active
											? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
											: 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
									}`}
								>
									{tab.label}
								</button>
							);
						})}
					</div>

					{preset === 'custom' && (
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={customStart}
								max={customEnd}
								onChange={(event) => setCustomStart(event.target.value)}
								className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
								aria-label="시작일"
							/>
							<span className="text-xs text-slate-400 dark:text-slate-500">~</span>
							<input
								type="date"
								value={customEnd}
								min={customStart}
								max={today}
								onChange={(event) => setCustomEnd(event.target.value)}
								className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
								aria-label="종료일"
							/>
						</div>
					)}

					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
						새로고침
					</button>
				</div>
			</div>

			{error && (
				<div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
					<p>{error}</p>
					<button type="button" onClick={() => void load()} className="font-semibold underline">
						다시 시도
					</button>
				</div>
			)}

			<div className="grid gap-4 lg:grid-cols-2">
				<section className={`${CARD} flex flex-col gap-3`}>
					<h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
						<TrendingUp className="h-4 w-4" aria-hidden />
						유입 경로 (Referrer / UTM)
					</h2>
					{loading && rangeDays.length === 0 ? (
						<p className="flex items-center gap-2 py-6 text-xs text-slate-500 dark:text-slate-400">
							<Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
						</p>
					) : referrerEntries.length === 0 ? (
						<p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">선택한 기간에 수집된 방문 데이터가 없습니다.</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[320px] text-left text-xs">
								<thead>
									<tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
										<th className="py-2 pr-3 font-semibold">유입 경로</th>
										<th className="py-2 pr-3 font-semibold text-right">방문 수</th>
										<th className="py-2 font-semibold text-right">비율</th>
									</tr>
								</thead>
								<tbody>
									{referrerEntries.map(([label, count]) => (
										<tr key={label} className="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
											<td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">{label}</td>
											<td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{count.toLocaleString('ko-KR')}건</td>
											<td className="py-2 text-right text-slate-500 dark:text-slate-400">
												{referrerTotal > 0 ? Math.round((count / referrerTotal) * 100) : 0}%
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

				<section className={`${CARD} flex flex-col gap-4`}>
					<h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
						<Monitor className="h-4 w-4" aria-hidden />
						디바이스 & 브라우저
					</h2>
					{loading && rangeDays.length === 0 ? (
						<p className="flex items-center gap-2 py-6 text-xs text-slate-500 dark:text-slate-400">
							<Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
						</p>
					) : deviceTotal === 0 && browserTotal === 0 ? (
						<p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">선택한 기간에 수집된 방문 데이터가 없습니다.</p>
					) : (
						<>
							<div className="flex flex-col gap-2">
								<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">디바이스</p>
								{deviceEntries.map(([label, count]) => (
									<ProgressRow key={label} label={label} count={count} total={deviceTotal} />
								))}
							</div>
							<div className="flex flex-col gap-2">
								<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">브라우저</p>
								{browserEntries.map(([label, count]) => (
									<ProgressRow key={label} label={label} count={count} total={browserTotal} tone="emerald" />
								))}
							</div>
						</>
					)}
				</section>
			</div>
		</div>
	);
}

const TONE_ICON_CLASS: Record<string, string> = {
	blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
	emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
	violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
	amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
};

function KpiCard({
	label,
	value,
	icon: Icon,
	tone,
}: {
	label: string;
	value: string;
	icon: typeof Users;
	tone: 'blue' | 'emerald' | 'violet' | 'amber';
}) {
	return (
		<div className={CARD}>
			<div className="flex items-start justify-between gap-3">
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
				<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_CLASS[tone]}`}>
					<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
				</span>
			</div>
			<p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100" title={value}>
				{value}
			</p>
		</div>
	);
}

function ProgressRow({
	label,
	count,
	total,
	tone = 'blue',
}: {
	label: string;
	count: number;
	total: number;
	tone?: 'blue' | 'emerald';
}) {
	const pct = total > 0 ? Math.round((count / total) * 100) : 0;
	const barClass = tone === 'emerald' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-blue-600 dark:bg-cyan-400';
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between text-xs">
				<span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
				<span className="text-slate-500 dark:text-slate-400">
					{count.toLocaleString('ko-KR')}건 ({pct}%)
				</span>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
				<div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}
