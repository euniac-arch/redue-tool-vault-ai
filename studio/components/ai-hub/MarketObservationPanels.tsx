'use client';

import type { MarketBundle, ServiceShareRow } from '@/lib/ai-hub/market-observations';
import { checkStatusLabel, formatMomPp, listWebTrafficRows, VISITS_UNAVAILABLE_LABEL } from '@/lib/ai-hub/market-observations';
import { getKstDateKey } from '@/lib/ai-hub/live-ai-rankings';
import { GrowthBadge } from '@/components/admin/ai-tools/ai-tools-badges';

const SEGMENT_COLORS = [
	'bg-cyan-500',
	'bg-violet-500',
	'bg-rose-500',
	'bg-amber-500',
	'bg-emerald-500',
	'bg-indigo-500',
	'bg-sky-500',
];

function checkedLabel(iso: string | null): string | null {
	if (!iso) return null;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	const key = getKstDateKey(date);
	const [year, month, day] = key.split('-').map(Number);
	const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
	const hh = String(kst.getUTCHours()).padStart(2, '0');
	const mm = String(kst.getUTCMinutes()).padStart(2, '0');
	return `${year}년 ${month}월 ${day}일 ${hh}:${mm} KST 확인`;
}

export function MarketProvenance({ bundle, compact = false }: { bundle: MarketBundle; compact?: boolean }) {
	const checked = checkedLabel(bundle.checkedAt);
	return (
		<div className={`flex flex-col gap-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 ${compact ? '' : 'mt-2'}`}>
			<p className="font-bold text-slate-700 dark:text-slate-200">글로벌 AI 웹 트래픽 점유율</p>
			<p>
				{bundle.webTraffic.periodLabel}
				{checked ? ` · ${checked}` : ' · 서버 일일 확인 전'}
			</p>
			<p>
				측정 지표: {bundle.webTraffic.metricLabel}
				{bundle.webTraffic.isEstimated ? ' · 패널 추정치' : ''}
				{' · '}
				{checkStatusLabel(bundle.checkStatus)}
			</p>
			{bundle.webTraffic.sources.length > 0 ? (
				<p className="flex flex-col gap-0.5">
					<span>출처: {bundle.webTraffic.sourceName}</span>
					{bundle.webTraffic.sources.map((source) => (
						<a
							key={source.url}
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
						>
							{source.role === 'primary'
								? '1차 출처'
								: source.role === 'secondary'
									? '2차 출처'
									: source.role === 'corroboration'
										? '교차 확인(2차)'
										: '인용된 원문(미수집)'}
							: {source.label}
						</a>
					))}
				</p>
			) : null}
			{bundle.checkNote ? <p>{bundle.checkNote}</p> : null}
		</div>
	);
}

export function WebTrafficShareBar({ bundle }: { bundle: MarketBundle }) {
	const rows = listWebTrafficRows(bundle);
	const shown = rows.reduce((sum, row) => sum + row.sharePct, 0);
	const remainder = Math.max(0, Math.round((100 - shown) * 10) / 10);
	return (
		<div className="flex flex-col gap-2.5">
			<MarketProvenance bundle={bundle} compact />
			<div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60" aria-hidden>
				{rows.map((row, index) => (
					<div
						key={row.serviceId}
						title={`${row.serviceName} · ${row.sharePct.toFixed(1)}%`}
						className={`${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} h-full`}
						style={{ width: `${row.sharePct}%` }}
					/>
				))}
				{remainder > 0 ? <div className="h-full bg-slate-300 dark:bg-slate-600" style={{ width: `${remainder}%` }} title={`반올림 잔여 · ${remainder.toFixed(1)}%p`} /> : null}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{rows.map((row, index) => {
					const mom = formatMomPp(row.momChangePp);
					return (
						<div key={row.serviceId} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
							<span className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`} aria-hidden />
							<span className="truncate">{row.serviceName}</span>
							<span className="font-bold tabular-nums text-slate-500 dark:text-slate-400">{row.sharePct.toFixed(1)}%</span>
							{mom ? <GrowthBadge growth={mom} /> : null}
						</div>
					);
				})}
			</div>
			<p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
				전월 대비가 있는 항목만 표시합니다. 합계 {shown.toFixed(1)}%는 출처 표의 반올림이며 100%로 다시 맞추지 않습니다. 앱 사용자 수와 추천 유입 비중은 이 막대에 포함되지 않습니다.
			</p>
		</div>
	);
}

export function WebTrafficRankTable({
	bundle,
	names,
}: {
	bundle: MarketBundle;
	names?: Map<string, { name: string; provider: string }>;
}) {
	const rows = listWebTrafficRows(bundle);
	return (
		<div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
			<table className="w-full border-collapse text-left text-sm">
				<thead>
					<tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
						<th className="px-2 py-2 sm:px-3 sm:py-2.5">순위</th>
						<th className="px-2 py-2 sm:px-3 sm:py-2.5">AI 서비스</th>
						<th className="hidden px-3 py-2.5 text-right md:table-cell">월간 방문량</th>
						<th className="px-2 py-2 sm:px-3 sm:py-2.5">웹 트래픽 점유율</th>
						<th className="px-2 py-2 text-right sm:px-3 sm:py-2.5">전월 대비</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<TrafficRow key={`${row.serviceId}:${row.rank}`} row={row} names={names} />
					))}
				</tbody>
			</table>
		</div>
	);
}

function TrafficRow({ row, names }: { row: ServiceShareRow; names?: Map<string, { name: string; provider: string }> }) {
	const known = names?.get(row.serviceId);
	const mom = formatMomPp(row.momChangePp);
	return (
		<tr className="border-t border-slate-100 text-slate-700 dark:border-slate-700/60 dark:text-slate-200">
			<td className="px-2 py-2 text-xs font-extrabold tabular-nums sm:px-3 sm:py-2.5">#{row.rank}</td>
			<td className="px-2 py-2 sm:px-3 sm:py-2.5">
				<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{known?.name ?? row.serviceName}</p>
				<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{known?.provider ?? row.serviceName}</p>
			</td>
			<td className="hidden px-3 py-2.5 text-right text-xs font-bold text-slate-500 dark:text-slate-400 md:table-cell">{VISITS_UNAVAILABLE_LABEL}</td>
			<td className="px-2 py-2 sm:px-3 sm:py-2.5">
				<div className="flex items-center gap-2">
					<div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-700/60">
						<div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(row.sharePct, 100)}%` }} />
					</div>
					<span className="shrink-0 text-xs font-bold tabular-nums">{row.sharePct.toFixed(1)}%</span>
				</div>
			</td>
			<td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-slate-500 sm:px-3 sm:py-2.5 dark:text-slate-400">{mom ?? '—'}</td>
		</tr>
	);
}

export function ReferralShareTable({ bundle }: { bundle: MarketBundle }) {
	if (!bundle.referral) return null;
	const rows = [...bundle.referral.rows].sort((a, b) => a.rank - b.rank);
	const primary = bundle.referral.sources[0];
	return (
		<section className="flex flex-col gap-2">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">AI 검색 추천·유입 점유율</p>
				<p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
					{bundle.referral.periodLabel} · {bundle.referral.metricLabel}. 위의 웹 방문 점유율과 다른 지표입니다.
					{bundle.referral.isEstimated ? ' 추정치.' : ' 측정값의 2차 인용.'}
				</p>
			</div>
			<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
				<table className="w-full border-collapse text-left text-sm">
					<thead>
						<tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
							<th className="px-3 py-2.5">순위</th>
							<th className="px-3 py-2.5">서비스</th>
							<th className="px-3 py-2.5 text-right">유입 비중</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.serviceId} className="border-t border-slate-100 dark:border-slate-700/60">
								<td className="px-3 py-2 text-xs font-bold tabular-nums">#{row.rank}</td>
								<td className="px-3 py-2 text-xs font-bold">{row.serviceName}</td>
								<td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{row.sharePct.toFixed(1)}%</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{primary ? (
				<a href={primary.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300">
					출처: {bundle.referral.sourceName}
				</a>
			) : null}
			{bundle.referral.notes.map((note) => (
				<p key={note} className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
					{note}
				</p>
			))}
		</section>
	);
}

export function MarketFootnotes({ bundle }: { bundle: MarketBundle }) {
	return (
		<div className="flex flex-col gap-1.5 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
			{bundle.webTraffic.notes.map((note) => (
				<p key={note}>{note}</p>
			))}
			{bundle.visitFootnote ? <p>{bundle.visitFootnote}</p> : null}
			{bundle.usageFootnote ? <p>{bundle.usageFootnote}</p> : null}
			{bundle.domainPolicy.slice(0, 2).map((note) => (
				<p key={note}>{note}</p>
			))}
		</div>
	);
}
