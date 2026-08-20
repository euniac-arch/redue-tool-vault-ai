'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ContactInquiryForm } from '@/components/ContactInquiryForm';
import { clampScore } from '@/lib/audit/score-grade';
import {
	PACKAGE_SCORE_BANDS,
	SOLUTION_PACKAGES,
	SOLUTION_PACKAGES_ID,
	formatKrw,
	packageScoreBand,
	projectProScore,
	projectStandardScore,
	type PackageScoreBandId,
	type PackageScoreProjection,
	type SolutionPackageId,
} from '@/lib/audit/solution-packages';

interface SolutionPackageCtaProps {
	targetUrl: string;
	brandName: string;
	targetQuery?: string;
	currentScore: number;
}

const PLANS = [
	{
		key: 'standard',
		itemKeys: ['jsonld', 'llms', 'meta', 'turnaround'],
		benefitKeys: ['jsonld', 'llms', 'meta'],
		order: 'order-2 md:order-1',
		card: 'bg-white border border-slate-200 shadow-sm dark:bg-slate-900/60 dark:border-slate-800 dark:shadow-none',
		name: 'text-slate-900 text-lg font-bold dark:text-white',
		tagline: 'text-slate-500 dark:text-slate-400',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500',
		list: 'text-slate-600 dark:text-slate-300',
		badge: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
		cta: 'border border-slate-200 bg-slate-50 py-3 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
		toggle: 'text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300',
	},
	{
		key: 'pro',
		itemKeys: ['standardAll', 'naver', 'eeat', 'faq', 'reaudit'],
		benefitKeys: ['standardAll', 'naver', 'eeat', 'reaudit'],
		order: 'order-1 md:order-2',
		popular: true,
		card: 'relative overflow-hidden border-2 border-cyan-300 bg-gradient-to-b from-white via-white to-cyan-50 shadow-sm dark:border-cyan-500/50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)] md:-translate-y-2',
		name: 'text-xl font-black text-cyan-700 dark:text-cyan-300',
		tagline: 'text-cyan-800 dark:text-cyan-200/80',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500 dark:text-slate-400',
		list: 'text-slate-700 dark:text-slate-200',
		badge: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
		cta: 'bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-bold text-white shadow-lg shadow-cyan-900/20 hover:from-cyan-400 hover:to-blue-500 dark:shadow-cyan-900/40',
		toggle: 'text-cyan-700 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200',
	},
	{
		key: 'enterprise',
		itemKeys: ['pr', 'wikidata', 'maps', 'rag', 'guard'],
		benefitKeys: ['wikidata', 'pr', 'guard'],
		order: 'order-3',
		comingSoon: true,
		card: 'border border-slate-200 bg-slate-50 opacity-95 dark:border-slate-800/60 dark:bg-slate-950/40 dark:opacity-85',
		name: 'text-lg font-bold text-slate-700 dark:text-slate-300',
		tagline: 'text-slate-500',
		price: 'text-slate-700 dark:text-slate-300',
		unit: 'text-slate-500',
		list: 'text-slate-500 dark:text-slate-400',
		badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300',
		cta: 'border border-slate-200 bg-white py-3 font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
		toggle: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
	},
] as const;

type PlanConfig = (typeof PLANS)[number];

export function SolutionPackageCta({ targetUrl, brandName, targetQuery, currentScore }: SolutionPackageCtaProps) {
	const t = useTranslations('audit.packages');
	const [selected, setSelected] = useState<SolutionPackageId | null>(null);

	useEffect(() => {
		if (!selected) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setSelected(null);
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [selected]);

	const inquiryMessage = selected
		? [
				t('inquiryPrefillLead', { brand: brandName, url: targetUrl, package: t(`${selected}.name`) }),
				targetQuery ? t('inquiryPrefillKeyword', { keyword: targetQuery }) : '',
				t('inquiryPrefillAsk', { package: t(`${selected}.name`) }),
			]
				.filter(Boolean)
				.join('\n')
		: '';

	return (
		<div id={SOLUTION_PACKAGES_ID} className="print:hidden mt-8 scroll-mt-24 space-y-6">
			<div className="space-y-1 text-center">
				<h3 className="break-keep text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h3>
				<p className="break-keep text-[10px] text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
			</div>

			<ScoreBandGuide currentScore={currentScore} />

			<ul className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
				{PLANS.map((plan) => (
					<li key={plan.key} className={plan.order}>
						<PackagePlanCard
							plan={plan}
							currentScore={currentScore}
							onSelect={() => setSelected(plan.key)}
						/>
					</li>
				))}
			</ul>

			<p className="break-keep text-[9px] leading-relaxed text-slate-500">{t('legalDisclaimer')}</p>

			{selected && typeof document !== 'undefined'
				? createPortal(
						<div
							className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
							role="dialog"
							aria-modal="true"
							aria-labelledby="solution-package-inquiry-title"
							onClick={() => setSelected(null)}
						>
							<div
								className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[90vh] sm:rounded-2xl"
								onClick={(event) => event.stopPropagation()}
							>
								<div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10 md:px-5">
									<div className="min-w-0">
										<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
											{t(`${selected}.kicker`)}
										</p>
										<h2
											id="solution-package-inquiry-title"
											className="mt-1 text-base font-extrabold text-slate-900 dark:text-white md:text-lg"
										>
											{t('inquiryTitle', { package: t(`${selected}.name`) })}
										</h2>
									</div>
									<button
										type="button"
										onClick={() => setSelected(null)}
										className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
										aria-label={t('inquiryClose')}
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="overflow-y-auto p-4 md:p-5">
									<ContactInquiryForm
										variant="embedded"
										defaults={{
											company: brandName,
											pageUrl: targetUrl,
											inquiryType: 'geo',
											message: inquiryMessage,
										}}
										onSubmitted={() => setSelected(null)}
									/>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</div>
	);
}

function PackagePlanCard({
	plan,
	currentScore,
	onSelect,
}: {
	plan: PlanConfig;
	currentScore: number;
	onSelect: () => void;
}) {
	const t = useTranslations('audit.packages');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const pkg = SOLUTION_PACKAGES[plan.key];
	const projection = useMemo(() => {
		if (plan.key === 'standard') return projectStandardScore(currentScore);
		if (plan.key === 'pro') return projectProScore(currentScore);
		return null;
	}, [plan.key, currentScore]);

	return (
		<article className={`flex h-full flex-col rounded-2xl p-6 ${plan.card}`}>
			<div className="min-w-0 flex-1">
				{plan.key === 'pro' ? (
					<span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm">
						{t('pro.badge')}
					</span>
				) : plan.key === 'enterprise' ? (
					<span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
						{t('enterprise.badge')}
					</span>
				) : null}

				<h4 className={`mt-2 break-keep ${plan.key === 'pro' ? 'pr-20' : ''} ${plan.name}`}>{t(`${plan.key}.name`)}</h4>
				<p className={`mt-0.5 break-keep text-[10px] ${plan.tagline}`}>{t(`${plan.key}.tagline`)}</p>

				<p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
					<span className={`break-keep text-2xl font-bold tracking-tight ${plan.price}`}>
						₩{formatKrw(pkg.priceKrw, lang)}
						{pkg.openEnded ? '~' : ''}
					</span>
					<span className={`break-keep text-[11px] font-semibold ${plan.unit}`}>{t(`${plan.key}.vat`)}</span>
					<span className={`break-keep text-xs font-normal ${plan.unit}`}>/ {t(`${plan.key}.unit`)}</span>
				</p>

				<ScoreGoalBadge planId={plan.key} projection={projection} className={plan.badge} />

				<p className="mt-3 break-keep text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
					{t(`${plan.key}.target`)}
				</p>

				<ul className={`my-5 space-y-1.5 text-[9px] sm:text-[11px] ${plan.list}`}>
					{plan.itemKeys.map((item) => (
						<li key={item} className="break-keep leading-snug">
							{t(`${plan.key}.items.${item}.title`)}
						</li>
					))}
				</ul>
			</div>

			<div className="mt-auto min-w-0">
				<button
					type="button"
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setOpen((prev) => !prev)}
					className={`inline-flex w-full items-center justify-center gap-1 py-2 text-[9px] font-medium transition-colors ${plan.toggle}`}
				>
					<span className="shrink-0 leading-none" aria-hidden>
						💡
					</span>
					<span className="break-keep">{open ? t('detailsToggleClose') : t('detailsToggleOpen')}</span>
					<ChevronDown
						className={`h-3 w-3 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
						aria-hidden
					/>
				</button>

				<div
					id={panelId}
					className={`grid transition-all duration-300 ease-out ${
						open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
					}`}
					inert={!open ? true : undefined}
				>
					<div className="min-h-0 overflow-hidden">
						<ul className="mb-3 space-y-1.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
							{plan.benefitKeys.map((item) => (
								<li
									key={item}
									className="flex min-w-0 items-start gap-1.5 text-[10px] font-normal leading-relaxed text-slate-600 dark:text-slate-300"
								>
									<span className="mt-px shrink-0 leading-relaxed" aria-hidden>
										•
									</span>
									<span className="min-w-0 break-keep">
										<span className="font-semibold text-slate-800 dark:text-slate-100">
											{t(`${plan.key}.items.${item}.benefitTitle`)}
										</span>
										<span> ➔ </span>
										<span>{t(`${plan.key}.items.${item}.effect`)}</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				</div>

				<button
					type="button"
					onClick={onSelect}
					className={`mt-1 inline-flex w-full items-center justify-center rounded-xl text-center text-xs transition-all ${plan.cta}`}
				>
					{t(`${plan.key}.cta`)}
				</button>
			</div>
		</article>
	);
}

function ScoreGoalBadge({
	planId,
	projection,
	className,
}: {
	planId: SolutionPackageId;
	projection: PackageScoreProjection | null;
	className: string;
}) {
	const t = useTranslations('audit.packages');

	const label =
		planId === 'enterprise' || !projection
			? t('enterprise.scoreBadge')
			: t('scoreLift.headline', {
					current: projection.current,
					goalLow: projection.goalLow,
					goalHigh: projection.goalHigh,
					liftLow: t(`${planId}.liftLow`),
					liftHigh: t(`${planId}.liftHigh`),
				});

	return (
		<p
			className={`mt-3 flex w-full items-start gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-snug ${className}`}
		>
			<span className="mt-0.5 shrink-0 leading-none" aria-hidden>
				🚀
			</span>
			<span className="min-w-0 break-keep">{label}</span>
		</p>
	);
}

function ScoreBandGuide({ currentScore }: { currentScore: number }) {
	const t = useTranslations('audit.packages');
	const current = Math.round(clampScore(currentScore));
	const active = packageScoreBand(current);

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
			<p className="text-center text-[10px] font-bold tabular-nums text-slate-900 dark:text-white">
				{t('scoreGuide.current', { score: current })}
			</p>
			<div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:gap-2">
				{PACKAGE_SCORE_BANDS.map((band) => {
					const on = band.id === active;
					return (
						<span
							key={band.id}
							className={`inline-flex min-w-0 max-w-full flex-col rounded-xl border px-2 py-1.5 text-center sm:px-2.5 ${
								on ? BAND_CHIP_ACTIVE[band.id] : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400'
							}`}
						>
							<span className="break-keep text-[8px] font-bold leading-snug">
								{t(`scoreGuide.${band.id}.range`)} ({t(`scoreGuide.${band.id}.label`)})
							</span>
						</span>
					);
				})}
			</div>
			<p className="mt-2 break-keep text-center text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">
				{t(`scoreGuide.${active}.desc`)}
			</p>
			<div className="relative mt-3">
				<div className="flex h-2 overflow-hidden rounded-full">
					{PACKAGE_SCORE_BANDS.map((band) => (
						<div key={band.id} className={BAND_BAR[band.id]} style={{ width: `${band.barPercent}%` }} />
					))}
				</div>
				<span
					className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow"
					style={{ left: `${Math.min(97, Math.max(3, current))}%` }}
					title={`${current}`}
					aria-hidden
				/>
			</div>
		</div>
	);
}

const BAND_CHIP_ACTIVE: Record<PackageScoreBandId, string> = {
	risk: 'border-rose-400/60 bg-rose-500/20 text-rose-800 dark:text-rose-100 shadow-[0_0_12px_-4px_rgba(244,63,94,0.7)]',
	fair: 'border-amber-400/60 bg-amber-500/20 text-amber-800 dark:text-amber-100 shadow-[0_0_12px_-4px_rgba(245,158,11,0.7)]',
	optimized: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100 shadow-[0_0_12px_-4px_rgba(16,185,129,0.7)]',
	monopoly: 'border-indigo-400/60 bg-indigo-500/20 text-indigo-800 dark:text-indigo-100 shadow-[0_0_12px_-4px_rgba(99,102,241,0.7)]',
};

const BAND_BAR: Record<PackageScoreBandId, string> = {
	risk: 'h-full bg-rose-500/80',
	fair: 'h-full bg-amber-400/80',
	optimized: 'h-full bg-emerald-400/80',
	monopoly: 'h-full bg-indigo-400/80',
};
