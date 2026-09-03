import { Sparkles, type LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { AiToolCategoryId } from '@/lib/admin/ai-tools-management';

const ICON_MAP = LucideIcons as unknown as Record<string, LucideIcon>;

/** Resolves a lucide-react icon component by its exported name (e.g. "MessageSquare"). */
export function resolveLucideIcon(name: string | undefined): LucideIcon {
	if (!name) return Sparkles;
	return ICON_MAP[name] ?? Sparkles;
}

export const CATEGORY_ACCENT: Record<AiToolCategoryId, string> = {
	llm: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800',
	image: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	video: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	audio: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	code: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
	hub: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-800',
};

/** Solid background variants (no ring) used for the logo-fallback avatar box on cards. */
export const CATEGORY_SOLID_ACCENT: Record<AiToolCategoryId, string> = {
	llm: 'bg-cyan-500',
	image: 'bg-violet-500',
	video: 'bg-rose-500',
	audio: 'bg-amber-500',
	code: 'bg-emerald-500',
	hub: 'bg-indigo-500',
};

export function AiToolCategoryBadge({ category, label }: { category: AiToolCategoryId; label: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${CATEGORY_ACCENT[category]}`}
		>
			{label}
		</span>
	);
}

/** Maps a free-form pricing type label (e.g. "Freemium", "Open Source / API") to a badge color. */
export function getPricingTypeStyle(type: string): string {
	const t = type.toLowerCase();
	if (t.includes('open source')) {
		return 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800';
	}
	if (t.includes('subscription')) {
		return 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-800';
	}
	if (t.includes('paid') && !t.includes('free')) {
		return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800';
	}
	if (t.includes('free') && !t.includes('freemium')) {
		return 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800';
	}
	return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800';
}

export function PricingTypeBadge({ type }: { type: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${getPricingTypeStyle(type)}`}
		>
			{type}
		</span>
	);
}

const RANK_MEDAL: Record<1 | 2 | 3, string> = {
	1: '🥇',
	2: '🥈',
	3: '🥉',
};

const RANK_STYLE: Record<1 | 2 | 3, string> = {
	1: 'border-amber-300 bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-800 dark:border-amber-500/60 dark:from-amber-500/20 dark:to-yellow-500/10 dark:text-amber-300',
	2: 'border-slate-300 bg-gradient-to-br from-slate-100 to-white text-slate-600 dark:border-slate-400/60 dark:from-slate-400/20 dark:to-slate-300/10 dark:text-slate-200',
	3: 'border-orange-300 bg-gradient-to-br from-orange-100 to-amber-50 text-orange-700 dark:border-orange-500/60 dark:from-orange-500/20 dark:to-amber-500/10 dark:text-orange-300',
};

/** Rank badge for cards/tables: gold/silver/bronze medal for 1~3, slate "#n" pill for the rest. */
export function RankBadge({ rank, className = '' }: { rank: number; className?: string }) {
	if (rank >= 1 && rank <= 3) {
		const tier = rank as 1 | 2 | 3;
		return (
			<span
				className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold shadow-sm ${RANK_STYLE[tier]} ${className}`}
			>
				<span aria-hidden>{RANK_MEDAL[tier]}</span>
				{`#${rank}`}
			</span>
		);
	}
	return (
		<span
			className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-400 ${className}`}
		>
			{`#${rank}`}
		</span>
	);
}

/** Parses a pre-formatted growth string like "+8.4%" / "-1.5%" into a sign and numeric value. */
export function parseGrowth(growth: string): { isUp: boolean; value: string } {
	const isUp = !growth.trim().startsWith('-');
	return { isUp, value: growth.trim() };
}

export function RisingStatusBadge({
	status,
	isRising,
	className = '',
}: {
	status?: 'ranked' | 'emerging' | 'hot_rising';
	isRising?: boolean;
	className?: string;
}) {
	if (status === 'hot_rising' || (isRising && status !== 'emerging')) {
		return (
			<span
				className={`inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 ${className}`}
			>
				HOT
			</span>
		);
	}
	if (status === 'emerging' || isRising) {
		return (
			<span
				className={`inline-flex items-center rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 ${className}`}
			>
				RISING
			</span>
		);
	}
	return null;
}

/** Live rank movement: NEW / ▲ N / ▼ N / —. */
export function RankChangeBadge({
	isNew,
	delta,
	className = '',
}: {
	isNew: boolean;
	delta: number;
	className?: string;
}) {
	if (isNew) {
		return (
			<span
				className={`inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 ${className}`}
			>
				NEW
			</span>
		);
	}
	if (delta > 0) {
		return (
			<span
				className={`inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 ${className}`}
			>
				▲ {delta}
			</span>
		);
	}
	if (delta < 0) {
		return (
			<span
				className={`inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 ${className}`}
			>
				▼ {Math.abs(delta)}
			</span>
		);
	}
	return (
		<span className={`inline-flex items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 ${className}`}>
			—
		</span>
	);
}

/** Green "up" / red "down" badge for month-over-month growth figures. */
export function GrowthBadge({ growth, className = '' }: { growth: string; className?: string }) {
	const { isUp, value } = parseGrowth(growth);
	return (
		<span
			className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
				isUp
					? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
					: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
			} ${className}`}
		>
			{isUp ? '▲' : '▼'} {value}
		</span>
	);
}
