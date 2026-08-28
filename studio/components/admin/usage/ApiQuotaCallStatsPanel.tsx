'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { formatQuotaNumber, type ApiQuotaCallStats, type ApiQuotaServiceName } from '@/lib/admin/api-quota';

type Granularity = 'hourly' | 'daily';

const BAR_COLOR = '#0891B2';

function StatsTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ payload?: { hour?: string; date?: string; calls: number } }>;
}) {
	if (!active || !payload?.length) return null;
	const row = payload[0]?.payload;
	if (!row) return null;
	return (
		<div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:bg-slate-800 dark:border-slate-700">
			<p className="font-semibold text-slate-700 dark:text-slate-200">{row.hour ?? row.date}</p>
			<p className="mt-0.5 text-slate-500 dark:text-slate-400">{formatQuotaNumber(row.calls)}회 호출</p>
		</div>
	);
}

export function ApiQuotaCallStatsPanel({ callStats }: { callStats: ApiQuotaCallStats[] }) {
	const [serviceName, setServiceName] = useState<ApiQuotaServiceName>(
		callStats[0]?.serviceName ?? 'Google OAuth',
	);
	const [granularity, setGranularity] = useState<Granularity>('hourly');

	const active = useMemo(
		() => callStats.find((row) => row.serviceName === serviceName) ?? callStats[0],
		[callStats, serviceName],
	);

	const chartData = granularity === 'hourly' ? active?.hourly ?? [] : active?.daily ?? [];
	const dataKey = granularity === 'hourly' ? 'hour' : 'date';
	const totalCalls = chartData.reduce((sum, row) => sum + row.calls, 0);

	return (
		<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Call Volume</p>
					<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
						서비스별 호출 통계 · {granularity === 'hourly' ? '최근 12시간' : '최근 7일'}
					</h2>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:bg-slate-700/60 dark:border-slate-700">
						{callStats.map((row) => (
							<button
								key={row.serviceName}
								type="button"
								onClick={() => setServiceName(row.serviceName)}
								className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
									row.serviceName === serviceName
										? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
										: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
								}`}
							>
								{row.serviceName}
							</button>
						))}
					</div>
					<div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:bg-slate-700/60 dark:border-slate-700">
						{(['hourly', 'daily'] as const).map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => setGranularity(option)}
								className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
									option === granularity
										? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
										: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
								}`}
							>
								{option === 'hourly' ? '시간별' : '일별'}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="px-5 py-4">
				<p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
					총 <span className="font-bold text-slate-800 dark:text-slate-100">{formatQuotaNumber(totalCalls)}</span>회 호출
				</p>
				<div className="h-52">
					<SafeResponsiveContainer minHeight={208}>
						<BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
							<CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey={dataKey}
								tick={{ fill: '#64748b', fontSize: 11 }}
								tickLine={false}
								axisLine={false}
							/>
							<YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
							<Tooltip cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }} content={<StatsTooltip />} />
							<Bar dataKey="calls" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
						</BarChart>
					</SafeResponsiveContainer>
				</div>
			</div>
		</section>
	);
}
