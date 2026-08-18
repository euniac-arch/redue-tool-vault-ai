'use client';

import { Compass, MapPin, MessageCircleHeart, ScanSearch, Target } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getReachLevelGuide, type ReachGuideLang } from '@/lib/geo/reach-level-guides';
import type { ReachLevel } from '@/types/site-reach';

type GuideTone = 'rose' | 'amber' | 'emerald';

const LEVEL_TONE: Record<ReachLevel, GuideTone> = {
	1: 'rose',
	2: 'amber',
	3: 'emerald',
};

const TONE = {
	rose: {
		card: 'border-rose-500/25 bg-rose-950/20',
		cardLight: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-400/25 dark:bg-rose-500/[0.08]',
		badge: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
		badgeLight: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
		title: 'text-rose-100',
		titleLight: 'text-rose-950 dark:text-rose-50',
		icon: 'text-rose-300',
	},
	amber: {
		card: 'border-amber-500/25 bg-amber-950/20',
		cardLight: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-400/25 dark:bg-amber-500/[0.08]',
		badge: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
		badgeLight: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
		title: 'text-amber-100',
		titleLight: 'text-amber-950 dark:text-amber-50',
		icon: 'text-amber-300',
	},
	emerald: {
		card: 'border-emerald-500/25 bg-emerald-950/20',
		cardLight: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-500/[0.08]',
		badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
		badgeLight: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
		title: 'text-emerald-100',
		titleLight: 'text-emerald-950 dark:text-emerald-50',
		icon: 'text-emerald-300',
	},
} as const;

const LEVEL_ICON = {
	1: ScanSearch,
	2: MapPin,
	3: MessageCircleHeart,
} as const;

function useGuideLang(): ReachGuideLang {
	const locale = useLocale();
	return locale === 'en' ? 'en' : 'ko';
}

/** Section kicker above the query console — level cards live in the console chips. */
export function ReachLevelGuideOverview() {
	const t = useTranslations('audit.aiEngineCards');

	return (
		<section aria-label={t('reachGuideOverviewAria')}>
			<p className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
				<span aria-hidden>📘 </span>
				{t('reachGuideKicker')}
			</p>
			<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
				{t('reachGuideHint')}
			</p>
		</section>
	);
}

/** Selected-level mechanism / scope / pattern panel inside the query console. */
export function ReachLevelGuideDetail({
	selectedLevel,
}: {
	selectedLevel: ReachLevel;
}) {
	const t = useTranslations('audit.aiEngineCards');
	const lang = useGuideLang();
	const guide = getReachLevelGuide(selectedLevel, lang);
	const tone = TONE[LEVEL_TONE[selectedLevel]];
	const Icon = LEVEL_ICON[selectedLevel];

	return (
		<div
			className={`space-y-2.5 rounded-xl border p-3.5 ${tone.card}`}
			aria-live="polite"
			aria-label={t('reachGuideDetailAria', { level: selectedLevel })}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<Icon className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`} aria-hidden />
						<p className={`text-[12px] font-extrabold ${tone.title}`}>{guide.title}</p>
						<span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${tone.badge}`}>
							{guide.badgeText}
						</span>
					</div>
					<p className="mt-1 text-[11px] leading-relaxed text-slate-400">{guide.shortDesc}</p>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div className="rounded-lg border border-white/5 bg-slate-950/50 px-2.5 py-2 sm:col-span-2">
					<p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
						<Compass className="h-3 w-3" aria-hidden />
						{t('reachMechanismLabel')}
					</p>
					<p className="text-[11px] leading-relaxed text-slate-200">{guide.reachMechanism}</p>
				</div>
				<div className="rounded-lg border border-white/5 bg-slate-950/50 px-2.5 py-2">
					<p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
						<Target className="h-3 w-3" aria-hidden />
						{t('exposureScopeLabel')}
					</p>
					<p className="text-[11px] leading-relaxed text-slate-200">{guide.exposureScope}</p>
				</div>
				<div className="rounded-lg border border-white/5 bg-slate-950/50 px-2.5 py-2">
					<p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
						{t('examplePatternLabel')}
					</p>
					<p className="font-mono text-[11px] leading-relaxed text-indigo-200">{guide.examplePattern}</p>
				</div>
			</div>
		</div>
	);
}

/** Compact callout on each engine simulation card. */
export function ReachLevelGuideInline({ level }: { level: ReachLevel }) {
	const t = useTranslations('audit.aiEngineCards');
	const lang = useGuideLang();
	const guide = getReachLevelGuide(level, lang);
	const tone = TONE[LEVEL_TONE[level]];
	const Icon = LEVEL_ICON[level];

	return (
		<aside
			className={`rounded-xl border px-3 py-2.5 ${tone.cardLight}`}
			aria-label={t('reachGuideInlineAria', { level })}
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<Icon className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`} aria-hidden />
				<p className={`text-[11px] font-extrabold ${tone.titleLight}`}>{t('engineReachGuideLabel')}</p>
				<span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${tone.badgeLight}`}>
					{guide.badgeText}
				</span>
			</div>
			<p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
				{guide.reachMechanism}
			</p>
			<p className="mt-1 text-[10px] leading-relaxed text-slate-500">
				<span className="font-bold">{t('exposureScopeLabel')}: </span>
				{guide.exposureScope}
			</p>
		</aside>
	);
}
