'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ContactInquiryForm } from '@/components/ContactInquiryForm';
import { clampScore } from '@/lib/audit/score-grade';
import { SOLUTION_PACKAGES_ID, type SolutionPackageId } from '@/lib/audit/solution-packages';
import { PRICING_PLAN_IDS, PRICING_PLANS, formatPlanPrice, type PricingPlanId } from '@/lib/pricing/plans';

interface SolutionPackageCtaProps {
	targetUrl: string;
	brandName: string;
	targetQuery?: string;
	currentScore: number;
}

const PLAN_STYLES = {
	speed: {
		order: 'order-2 md:order-1',
		card: 'bg-white border border-slate-200 shadow-sm dark:bg-slate-900/60 dark:border-slate-800 dark:shadow-none',
		name: 'text-slate-900 text-lg font-bold dark:text-white',
		tagline: 'text-slate-500 dark:text-slate-400',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500',
		list: 'text-slate-600 dark:text-slate-300',
		lift: 'border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-100',
		liftChip: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950',
		cta: 'border border-slate-200 bg-slate-50 py-3 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
		toggle: 'text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300',
	},
	pro: {
		order: 'order-1 md:order-2',
		popular: true,
		card: 'relative overflow-hidden border-2 border-cyan-300 bg-gradient-to-b from-white via-white to-cyan-50 shadow-sm dark:border-cyan-500/50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)] md:-translate-y-2',
		name: 'text-xl font-black text-cyan-700 dark:text-cyan-300',
		tagline: 'text-cyan-800 dark:text-cyan-200/80',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500 dark:text-slate-400',
		list: 'text-slate-700 dark:text-slate-200',
		lift: 'border-cyan-300/80 bg-cyan-50 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-50',
		liftChip: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950',
		cta: 'bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-bold text-white shadow-lg shadow-cyan-900/20 hover:from-cyan-400 hover:to-blue-500 dark:shadow-cyan-900/40',
		toggle: 'text-cyan-700 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200',
	},
	enterprise: {
		order: 'order-3',
		card: 'relative border border-slate-800/80 bg-gradient-to-b from-white via-white to-slate-100 shadow-sm dark:border-indigo-400/35 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/40 dark:shadow-[0_0_28px_rgba(79,70,229,0.14)]',
		name: 'text-lg font-bold text-slate-900 dark:text-indigo-100',
		tagline: 'text-slate-600 dark:text-indigo-200/70',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500 dark:text-slate-400',
		list: 'text-slate-600 dark:text-slate-200',
		lift: 'border-violet-200/80 bg-violet-50 text-violet-950 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-50',
		liftChip: 'bg-violet-700 text-white dark:bg-violet-300 dark:text-violet-950',
		cta: 'bg-gradient-to-r from-slate-800 to-indigo-800 py-3.5 font-bold text-white shadow-lg shadow-slate-900/15 hover:from-slate-700 hover:to-indigo-700 dark:from-indigo-600 dark:to-violet-700 dark:shadow-indigo-950/40 dark:hover:from-indigo-500 dark:hover:to-violet-600',
		toggle: 'text-indigo-700 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200',
	},
} as const;

type PlanConfig = {
	key: PricingPlanId;
} & (typeof PLAN_STYLES)[PricingPlanId];

const PLANS: PlanConfig[] = PRICING_PLAN_IDS.map((key) => ({
	key,
	...PLAN_STYLES[key],
}));

export function SolutionPackageCta({ targetUrl, brandName, targetQuery, currentScore }: SolutionPackageCtaProps) {
	const t = useTranslations('audit.packages');
	const tPricing = useTranslations('landing.story.pricing');
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
				t('inquiryPrefillLead', { brand: brandName, url: targetUrl, package: tPricing(`plans.${selected}.name`) }),
				targetQuery ? t('inquiryPrefillKeyword', { keyword: targetQuery }) : '',
				t('inquiryPrefillAsk', { package: tPricing(`plans.${selected}.name`) }),
			]
				.filter(Boolean)
				.join('\n')
		: '';

	return (
		<div id={SOLUTION_PACKAGES_ID} className="print:hidden scroll-mt-24 space-y-6">
			<div className="space-y-1 text-center">
				<h3 className="break-keep text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h3>
				<p className="break-keep text-[10px] text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
			</div>

			<PlanLiftGuide currentScore={currentScore} />

			<ul className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
				{PLANS.map((plan) => (
					<li key={plan.key} className={plan.order}>
						<PackagePlanCard plan={plan} onSelect={() => setSelected(plan.key)} />
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
											{tPricing(`plans.${selected}.name`)}
										</p>
										<h2
											id="solution-package-inquiry-title"
											className="mt-1 text-base font-extrabold text-slate-900 dark:text-white md:text-lg"
										>
											{t('inquiryTitle', { package: tPricing(`plans.${selected}.name`) })}
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
	onSelect,
}: {
	plan: PlanConfig;
	onSelect: () => void;
}) {
	const t = useTranslations('audit.packages');
	const tPricing = useTranslations('landing.story.pricing');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const pkg = PRICING_PLANS[plan.key];
	const unit = tPricing(`plans.${plan.key}.unit`);
	const note = tPricing.has(`plans.${plan.key}.note`) ? tPricing(`plans.${plan.key}.note`) : '';
	const scopeNote = tPricing.has(`plans.${plan.key}.scopeNote`) ? tPricing(`plans.${plan.key}.scopeNote`) : '';

	return (
		<article className={`flex h-full flex-col rounded-2xl p-6 ${plan.card}`}>
			<div className="min-w-0 flex-1">
				{plan.key === 'pro' ? (
					<span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm">
						{tPricing('popular')}
					</span>
				) : plan.key === 'enterprise' ? (
					<span className="absolute right-3 top-3 rounded-full border border-indigo-200/80 bg-slate-900 px-2.5 py-1 text-[9px] font-bold text-slate-50 shadow-sm dark:border-indigo-400/40 dark:bg-indigo-950 dark:text-indigo-100">
						{tPricing('enterpriseBadge')}
					</span>
				) : null}

				<h4 className={`mt-2 break-keep ${plan.key === 'speed' ? '' : 'pr-20'} ${plan.name}`}>
					{tPricing(`plans.${plan.key}.name`)}
				</h4>
				<p className={`mt-0.5 break-keep text-[10px] ${plan.tagline}`}>{tPricing(`plans.${plan.key}.tagline`)}</p>

				<div className="mt-4">
					<p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
						<span className={`break-keep text-2xl font-bold tracking-tight ${plan.price}`}>
							{formatPlanPrice(pkg.priceKrw, lang, pkg.openEnded)}
						</span>
						<span className={`break-keep text-[11px] font-semibold ${plan.unit}`}>
							{tPricing(`plans.${plan.key}.vat`)}
						</span>
					</p>
					{unit ? (
						<p className={`mt-0.5 break-keep text-xs font-normal ${plan.unit}`}>{unit}</p>
					) : null}
				</div>

				<PlanLiftBadge planId={plan.key} className={plan.lift} chipClassName={plan.liftChip} />

				<p className="mt-3 break-keep text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
					{tPricing(`plans.${plan.key}.target`)}
				</p>

				<ul className={`my-5 space-y-1.5 text-[9px] sm:text-[11px] ${plan.list}`}>
					{Array.from({ length: pkg.items }, (_, index) => String(index)).map((item) => (
						<li key={item} className="break-keep leading-snug">
							✓ {tPricing(`plans.${plan.key}.items.${item}.label`)}
						</li>
					))}
				</ul>
				{note ? (
					<p className={`-mt-2 mb-3 break-keep text-[11px] font-semibold leading-relaxed ${plan.list}`}>{note}</p>
				) : null}
				{scopeNote ? (
					<p className="mb-2 break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{scopeNote}</p>
				) : null}
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
					inert={(!open ? '' : undefined) as unknown as boolean | undefined}
				>
					<div className="min-h-0 overflow-hidden">
						<ul className="mb-3 space-y-1.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
							{Array.from({ length: pkg.benefits }, (_, index) => String(index)).map((item) => (
								<li
									key={item}
									className="flex min-w-0 items-start gap-1.5 text-[10px] font-normal leading-relaxed text-slate-600 dark:text-slate-300"
								>
									<span className="mt-px shrink-0 leading-relaxed" aria-hidden>
										{tPricing(`plans.${plan.key}.benefits.${item}.icon`)}
									</span>
									<span className="min-w-0 break-keep">
										<span className="font-semibold text-slate-800 dark:text-slate-100">
											{tPricing(`plans.${plan.key}.benefits.${item}.title`)}
										</span>
										<span> ➔ </span>
										<span>{tPricing(`plans.${plan.key}.benefits.${item}.desc`)}</span>
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
					{tPricing(`plans.${plan.key}.cta`)}
				</button>
			</div>
		</article>
	);
}

function PlanLiftBadge({
	planId,
	className,
	chipClassName,
}: {
	planId: PricingPlanId;
	className: string;
	chipClassName: string;
}) {
	const t = useTranslations('audit.packages');
	const tPricing = useTranslations('landing.story.pricing');

	return (
		<div className={`mt-3 rounded-xl border px-3 py-2.5 ${className}`}>
			<p className="break-keep text-[10px] font-bold tracking-wide">
				{t('scoreLift.applied', { plan: tPricing(`plans.${planId}.name`) })}
			</p>
			<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
				<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums leading-none ${chipClassName}`}>
					{t(`scoreLift.${planId}.delta`)}
				</span>
				<span className="break-keep text-[10px] font-semibold leading-snug">{t(`scoreLift.${planId}.band`)}</span>
			</div>
			<p className="mt-1.5 break-keep text-[10px] font-medium leading-relaxed opacity-90">
				<span className="font-bold">{t('scoreLift.expected')}</span>
				<span> {t(`scoreLift.${planId}.detail`)}</span>
			</p>
		</div>
	);
}

function PlanLiftGuide({ currentScore }: { currentScore: number }) {
	const t = useTranslations('audit.packages');
	const tPricing = useTranslations('landing.story.pricing');
	const current = Math.round(clampScore(currentScore));

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
			<p className="text-center text-[11px] font-extrabold text-slate-900 dark:text-white">{t('scoreLift.bannerTitle')}</p>
			<p className="mt-1 text-center text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
				{t('scoreGuide.current', { score: current })}
			</p>
			<p className="mt-1 break-keep text-center text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">
				{t('scoreLift.bannerSubtitle')}
			</p>
			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
				{PRICING_PLAN_IDS.map((id) => (
					<div
						key={id}
						className={`rounded-xl border px-2.5 py-2 ${PLAN_STYLES[id].lift}`}
					>
						<p className="break-keep text-[9px] font-bold leading-snug">
							{t('scoreLift.applied', { plan: tPricing(`plans.${id}.name`) })}
						</p>
						<p className="mt-1.5 flex flex-wrap items-center gap-1.5">
							<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums leading-none ${PLAN_STYLES[id].liftChip}`}>
								{t(`scoreLift.${id}.delta`)}
							</span>
							<span className="break-keep text-[9px] font-semibold leading-snug">{t(`scoreLift.${id}.band`)}</span>
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
