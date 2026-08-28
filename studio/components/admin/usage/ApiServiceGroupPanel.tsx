import type { ReactNode } from 'react';
import { BellRing, MapPin, ShieldAlert, Sparkles } from 'lucide-react';
import {
	API_USAGE_KPI,
	ENGINE_SHARE_ROWS,
	QUOTA_GAUGES,
	engineSharePercent,
	formatTokens,
	formatUsd,
	monthBudgetRatio,
	quotaRemaining,
	quotaUsedPercent,
	type BudgetControlState,
	type QuotaGauge,
} from '@/lib/admin/api-usage';
import { HealthBadge, ProviderDot } from './api-usage-badges';

const PANEL =
	'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none';

const ENGINE_BAR: Record<string, string> = {
	'gpt-4o': 'bg-emerald-500',
	'gpt-4o-mini': 'bg-emerald-300',
	'claude-3-5-sonnet': 'bg-orange-500',
	sonar: 'bg-sky-500',
	'gemini-1.5-pro': 'bg-blue-500',
	'gemini-1.5-flash': 'bg-blue-300',
};

function QuotaRing({ gauge }: { gauge: QuotaGauge }) {
	const pct = quotaUsedPercent(gauge);
	const remaining = quotaRemaining(gauge);
	const radius = 28;
	const stroke = 6;
	const circ = 2 * Math.PI * radius;
	const offset = circ - (pct / 100) * circ;
	const tone =
		pct >= 80 ? 'text-rose-500' : pct >= 50 ? 'text-amber-500' : 'text-cyan-500';

	return (
		<div className="flex items-center gap-3">
			<div className="relative h-[72px] w-[72px] shrink-0">
				<svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden>
					<circle
						cx="36"
						cy="36"
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={stroke}
						className="text-slate-100 dark:text-slate-800"
					/>
					<circle
						cx="36"
						cy="36"
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={stroke}
						strokeDasharray={circ}
						strokeDashoffset={offset}
						strokeLinecap="round"
						className={tone}
					/>
				</svg>
				<span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
					{pct.toFixed(0)}%
				</span>
			</div>
			<div className="min-w-0">
				<div className="flex items-center gap-1.5">
					<ProviderDot provider={gauge.provider} />
					<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{gauge.label}</p>
				</div>
				<p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{gauge.caption}</p>
				<p className="mt-1 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
					잔여 {remaining.toLocaleString('en-US')} / {gauge.limit.toLocaleString('en-US')} {gauge.unit}
				</p>
				<p className="text-[11px] text-slate-400 dark:text-slate-500">{gauge.resetHint}</p>
			</div>
		</div>
	);
}

function BudgetToggle({
	checked,
	onChange,
	label,
	description,
	icon,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	description: string;
	icon: ReactNode;
}) {
	return (
		<div className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
			<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
				<span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
					{description}
				</span>
			</span>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0.5 transition-colors ${
					checked ? 'bg-slate-900 dark:bg-cyan-500' : 'bg-slate-200 dark:bg-slate-700'
				}`}
			>
				<span
					className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
						checked ? 'translate-x-5' : 'translate-x-0'
					}`}
				/>
			</button>
		</div>
	);
}

export function ApiServiceGroupPanel({
	budget,
	onBudgetChange,
}: {
	budget: BudgetControlState;
	onBudgetChange: (next: BudgetControlState) => void;
}) {
	const budgetPct = monthBudgetRatio();
	const armedWarning = budget.warnAtEightyPercent && budgetPct >= 80;

	return (
		<section className="grid gap-4 xl:grid-cols-12" aria-label="서비스 그룹별 사용 현황">
			<article className={`xl:col-span-6 ${PANEL}`}>
				<div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Group A · LLM &amp; Search AI
						</p>
						<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">AI 엔진별 점유율 및 비용</h2>
					</div>
					<span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						토큰/비용
					</span>
				</div>
				<div className="px-5 pt-4">
					<div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
						{ENGINE_SHARE_ROWS.map((row) => (
							<span
								key={row.id}
								className={ENGINE_BAR[row.id] ?? 'bg-slate-400'}
								style={{ width: `${engineSharePercent(row)}%` }}
								title={`${row.model} ${engineSharePercent(row).toFixed(1)}%`}
							/>
						))}
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="mt-2 w-full min-w-[520px] text-left text-sm">
						<thead>
							<tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
								<th className="px-5 py-2 font-semibold">모델</th>
								<th className="px-3 py-2 font-semibold">호출</th>
								<th className="px-3 py-2 font-semibold">토큰</th>
								<th className="px-3 py-2 font-semibold">지출</th>
								<th className="px-5 py-2 font-semibold">상태</th>
							</tr>
						</thead>
						<tbody>
							{ENGINE_SHARE_ROWS.map((row) => (
								<tr key={row.id} className="border-t border-slate-100 dark:border-slate-700/80">
									<td className="px-5 py-2.5">
										<div className="flex items-center gap-2">
											<ProviderDot provider={row.provider} />
											<div>
												<p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{row.model}</p>
												<p className="text-[10px] text-slate-400 dark:text-slate-500">{row.label}</p>
											</div>
										</div>
									</td>
									<td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
										{row.calls.toLocaleString('en-US')}
									</td>
									<td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
										{formatTokens(row.tokens)}
									</td>
									<td className="px-3 py-2.5 font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
										{formatUsd(row.costUsd)}
									</td>
									<td className="px-5 py-2.5">
										<HealthBadge health={row.health} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</article>

			<article className={`xl:col-span-3 ${PANEL}`}>
				<div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Group B · C
						</p>
						<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">이미지 &amp; 지도 쿼터</h2>
					</div>
					<MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
				</div>
				<div className="flex flex-col gap-4 px-5 py-4">
					{QUOTA_GAUGES.map((gauge) => (
						<QuotaRing key={gauge.id} gauge={gauge} />
					))}
				</div>
			</article>

			<article className={`xl:col-span-3 ${PANEL}`}>
				<div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Budget Control
						</p>
						<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">비용 안전 제어</h2>
					</div>
					<ShieldAlert className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
				</div>
				<div className="flex flex-col gap-2 p-3">
					<BudgetToggle
						checked={budget.fallbackToCheapModels}
						onChange={(fallbackToCheapModels) => onBudgetChange({ ...budget, fallbackToCheapModels })}
						label="저비용 모델 Fallback"
						description="일일 비용 상한 도달 시 GPT-4o-mini / Gemini Flash로 자동 전환합니다."
						icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
					/>
					<BudgetToggle
						checked={budget.warnAtEightyPercent}
						onChange={(warnAtEightyPercent) => onBudgetChange({ ...budget, warnAtEightyPercent })}
						label="월 예산 80% 경고"
						description="월간 한도 $300의 80%($240) 초과 시 관리자 알림을 발송합니다."
						icon={<BellRing className="h-4 w-4" strokeWidth={1.75} />}
					/>
				</div>
				<div
					className={`mx-3 mb-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
						armedWarning
							? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
							: 'border border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400'
					}`}
				>
					{armedWarning
						? `월 예산 ${budgetPct.toFixed(1)}% 사용 — 경고 알림이 발송됩니다.`
						: `현재 월 사용 ${formatUsd(API_USAGE_KPI.monthCostUsd)} (${budgetPct.toFixed(1)}%). 80% 임계값 미만입니다.`}
					{budget.fallbackToCheapModels ? ' Fallback 정책이 활성입니다.' : ' Fallback 정책이 꺼져 있습니다.'}
				</div>
			</article>
		</section>
	);
}
