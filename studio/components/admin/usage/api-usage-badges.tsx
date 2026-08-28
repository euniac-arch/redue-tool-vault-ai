import type { ApiProvider, ApiStatusCode, EngineHealth, MembershipPlan } from '@/lib/admin/api-usage';
import { latencyTone, statusLabel } from '@/lib/admin/api-usage';

const PLAN_STYLE: Record<MembershipPlan, string> = {
	Free: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
	Pro: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
	Enterprise: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
};

const HEALTH_STYLE: Record<EngineHealth, string> = {
	healthy: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
	watch: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
	limited: 'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
	degraded: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
};

const HEALTH_LABEL: Record<EngineHealth, string> = {
	healthy: '정상',
	watch: '관찰',
	limited: '한도 임박',
	degraded: '장애',
};

const STATUS_STYLE: Record<ApiStatusCode, string> = {
	200: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
	429: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
	500: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
};

const LATENCY_STYLE = {
	fast: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
	mid: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
	slow: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
} as const;

const PROVIDER_SWATCH: Record<ApiProvider, string> = {
	openai: 'bg-emerald-500',
	anthropic: 'bg-orange-500',
	perplexity: 'bg-sky-500',
	gemini: 'bg-blue-500',
	googlemaps: 'bg-red-500',
	unsplash: 'bg-slate-700 dark:bg-slate-300',
	pexels: 'bg-teal-500',
	pixabay: 'bg-lime-500',
};

export function PlanBadge({ plan }: { plan: MembershipPlan }) {
	return (
		<span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${PLAN_STYLE[plan]}`}>
			{plan}
		</span>
	);
}

export function HealthBadge({ health }: { health: EngineHealth }) {
	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${HEALTH_STYLE[health]}`}>
			{HEALTH_LABEL[health]}
		</span>
	);
}

export function StatusBadge({ status }: { status: ApiStatusCode }) {
	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLE[status]}`}>
			{statusLabel(status)}
		</span>
	);
}

export function LatencyBadge({ ms }: { ms: number }) {
	const tone = latencyTone(ms);
	return (
		<span className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ${LATENCY_STYLE[tone]}`}>
			{ms.toLocaleString('en-US')}ms
		</span>
	);
}

export function ProviderDot({ provider }: { provider: ApiProvider }) {
	return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${PROVIDER_SWATCH[provider]}`} aria-hidden />;
}
