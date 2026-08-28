import { Coins, Cpu, Globe, Images } from 'lucide-react';
import {
	API_USAGE_KPI,
	formatCompactTokens,
	formatTokens,
	formatUsd,
	monthBudgetRatio,
	todayTokenTotal,
	type ApiUsageKpi,
} from '@/lib/admin/api-usage';

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:shadow-none dark:hover:shadow-none';

function ProgressBar({ value, tone }: { value: number; tone: 'cyan' | 'violet' | 'emerald' | 'amber' }) {
	const bar = {
		cyan: 'bg-cyan-500',
		violet: 'bg-violet-500',
		emerald: 'bg-emerald-500',
		amber: 'bg-amber-500',
	}[tone];
	return (
		<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
			<div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
		</div>
	);
}

export function ApiUsageKpiCards({ kpi = API_USAGE_KPI }: { kpi?: ApiUsageKpi }) {
	const budgetPct = monthBudgetRatio(kpi);
	const tokenTotal = todayTokenTotal(kpi);

	return (
		<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="API 사용량 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						이번 달 총 API 원가
					</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
						<Coins className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
					{formatUsd(kpi.monthCostUsd)}
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					월간 한도 {formatUsd(kpi.monthBudgetUsd)} · {budgetPct.toFixed(1)}%
				</p>
				<ProgressBar value={budgetPct} tone="cyan" />
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						오늘 소모된 AI 토큰
					</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
						<Cpu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
					{formatTokens(tokenTotal)}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tokens</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					Prompt {formatCompactTokens(kpi.todayPromptTokens)} / Completion{' '}
					{formatCompactTokens(kpi.todayCompletionTokens)}
				</p>
				<ProgressBar
					value={(kpi.todayPromptTokens / tokenTotal) * 100}
					tone="violet"
				/>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						오늘 외부 API 호출 건수
					</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
						<Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
					{kpi.todayExternalCalls.toLocaleString('en-US')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">회</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					성공률 {kpi.todaySuccessRate.toFixed(1)}% · 평균 지연 {kpi.todayAvgLatencySec.toFixed(2)}s
				</p>
				<ProgressBar value={kpi.todaySuccessRate} tone="emerald" />
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						미디어 &amp; 맵 호출량
					</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
						<Images className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
					{(kpi.todayMapsCalls + kpi.todayImageCalls).toLocaleString('en-US')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">회</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					Maps {kpi.todayMapsCalls.toLocaleString('en-US')}회 / 이미지 검색{' '}
					{kpi.todayImageCalls.toLocaleString('en-US')}회
				</p>
				<ProgressBar
					value={(kpi.todayMapsCalls / (kpi.todayMapsCalls + kpi.todayImageCalls)) * 100}
					tone="amber"
				/>
			</article>
		</section>
	);
}
