'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PRICING_PLANS, formatPlanPrice, type PricingPlanId } from '@/lib/pricing/plans';

const PLANS = [
	{
		key: 'speed' as const,
		href: PRICING_PLANS.speed.href,
		items: PRICING_PLANS.speed.items,
		benefits: PRICING_PLANS.speed.benefits,
		order: 'order-2 md:order-1',
		card: 'bg-white border border-slate-200 shadow-sm dark:bg-slate-900/60 dark:border-slate-800 dark:shadow-none',
		name: 'text-slate-900 text-lg font-bold dark:text-white',
		tagline: 'text-slate-500 dark:text-slate-400',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500',
		list: 'text-slate-600 dark:text-slate-300',
		cta: 'border border-slate-200 bg-slate-50 py-3 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
		toggle: 'text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300',
	},
	{
		key: 'pro' as const,
		href: PRICING_PLANS.pro.href,
		items: PRICING_PLANS.pro.items,
		benefits: PRICING_PLANS.pro.benefits,
		order: 'order-1 md:order-2',
		card: 'relative border-2 border-cyan-300 bg-gradient-to-b from-white via-white to-cyan-50 shadow-sm dark:border-cyan-500/50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
		name: 'text-xl font-black text-cyan-700 dark:text-cyan-300',
		tagline: 'text-cyan-800 dark:text-cyan-200/80',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500 dark:text-slate-400',
		list: 'text-slate-700 dark:text-slate-200',
		cta: 'bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-bold text-white shadow-lg shadow-cyan-900/20 hover:from-cyan-400 hover:to-blue-500 dark:shadow-cyan-900/40',
		toggle: 'text-cyan-700 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200',
	},
	{
		key: 'enterprise' as const,
		href: PRICING_PLANS.enterprise.href,
		items: PRICING_PLANS.enterprise.items,
		benefits: PRICING_PLANS.enterprise.benefits,
		order: 'order-3',
		card: 'relative border border-slate-800/80 bg-gradient-to-b from-white via-white to-slate-100 shadow-sm dark:border-indigo-400/35 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/40 dark:shadow-[0_0_28px_rgba(79,70,229,0.14)]',
		name: 'text-lg font-bold text-slate-900 dark:text-indigo-100',
		tagline: 'text-slate-600 dark:text-indigo-200/70',
		price: 'text-slate-900 dark:text-white',
		unit: 'text-slate-500 dark:text-slate-400',
		list: 'text-slate-600 dark:text-slate-200',
		cta: 'bg-gradient-to-r from-slate-800 to-indigo-800 py-3.5 font-bold text-white shadow-lg shadow-slate-900/15 hover:from-slate-700 hover:to-indigo-700 dark:from-indigo-600 dark:to-violet-700 dark:shadow-indigo-950/40 dark:hover:from-indigo-500 dark:hover:to-violet-600',
		toggle: 'text-indigo-700 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200',
	},
] as const;

type PlanConfig = (typeof PLANS)[number];

export function PricingPackages() {
	const t = useTranslations('landing.story.pricing');

	return (
		<section id="pricing" className="mt-20 scroll-mt-24 sm:mt-24">
			<div className="mx-auto w-full max-w-5xl">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400">
						{t('badge')}
					</p>
					<h2 className="mt-3">
						<span className="block font-mono text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('kicker')}</span>
						<span className="mt-1 block text-2xl font-extrabold leading-snug text-slate-900 dark:text-white sm:text-3xl">
							{t('title')}
						</span>
					</h2>
					<p className="mx-auto mt-2 max-w-[600px] break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<ul className="mt-10 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
					{PLANS.map((plan) => (
						<li key={plan.key} className={plan.order}>
							<PricingPlanCard plan={plan} />
						</li>
					))}
				</ul>

				<div className="mx-auto mt-8 max-w-[760px] space-y-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
					<p>{t('footnote')}</p>
					<p>{t('disclaimer')}</p>
				</div>

				<div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-[11.5px] leading-relaxed text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400 dark:shadow-none">
					<p className="mb-1 font-semibold text-slate-800 dark:text-slate-300">{t('refundNotice.title')}</p>
					<ul className="list-inside list-disc space-y-0.5 text-slate-500 dark:text-slate-400">
						<li>{t('refundNotice.workStart')}</li>
						<li>{t('refundNotice.algorithm')}</li>
					</ul>
				</div>
			</div>
		</section>
	);
}

function PricingPlanCard({ plan }: { plan: PlanConfig }) {
	const t = useTranslations('landing.story.pricing');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const pkg = PRICING_PLANS[plan.key as PricingPlanId];
	const unit = t(`plans.${plan.key}.unit`);
	const note = t.has(`plans.${plan.key}.note`) ? t(`plans.${plan.key}.note`) : '';
	const scopeNote = t.has(`plans.${plan.key}.scopeNote`) ? t(`plans.${plan.key}.scopeNote`) : '';

	return (
		<article className={`flex h-full flex-col rounded-2xl p-6 ${plan.card}`}>
			<div className="min-w-0 flex-1">
				{plan.key === 'pro' ? (
					<span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
						{t('popular')}
					</span>
				) : plan.key === 'enterprise' ? (
					<span className="absolute right-3 top-3 rounded-full border border-indigo-200/80 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-50 shadow-sm dark:border-indigo-400/40 dark:bg-indigo-950 dark:text-indigo-100">
						{t('enterpriseBadge')}
					</span>
				) : null}
				<h3 className={`mt-2 ${plan.key === 'speed' ? '' : 'pr-24'} ${plan.name}`}>{t(`plans.${plan.key}.name`)}</h3>
				<p className={`mt-0.5 text-xs ${plan.tagline}`}>{t(`plans.${plan.key}.tagline`)}</p>
				<div className="mt-4">
					<p className="flex flex-wrap items-baseline gap-x-1.5">
						<span className={`break-keep text-2xl font-black tracking-tight sm:text-3xl ${plan.price}`}>
							{formatPlanPrice(pkg.priceKrw, lang, pkg.openEnded)}
						</span>
						<span className={`break-keep text-[11px] font-semibold ${plan.unit}`}>
							{t(`plans.${plan.key}.vat`)}
						</span>
					</p>
					{unit ? (
						<p className={`mt-0.5 break-keep text-xs font-normal ${plan.unit}`}>
							{unit}
						</p>
					) : null}
				</div>
				<ul className={`my-6 space-y-2.5 text-xs sm:text-sm ${plan.list}`}>
					{Array.from({ length: plan.items }, (_, index) => String(index)).map((item) => (
						<PricingItem
							key={item}
							label={t(`plans.${plan.key}.items.${item}.label`)}
							tooltip={t(`plans.${plan.key}.items.${item}.tooltip`)}
						/>
					))}
				</ul>
				{note ? (
					<p className={`-mt-2 mb-4 break-keep text-xs font-semibold leading-relaxed ${plan.list}`}>
						{note}
					</p>
				) : null}
				{scopeNote ? (
					<p
						className={`break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 ${
							plan.key === 'enterprise' ? 'mb-7' : 'mb-2'
						}`}
					>
						{scopeNote}
					</p>
				) : null}
			</div>

			<div className="mt-auto min-w-0">
				<button
					type="button"
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setOpen((prev) => !prev)}
					className={`inline-flex w-full items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${plan.toggle}`}
				>
					<span className="break-keep">{open ? t('benefitsToggleClose') : t('benefitsToggleOpen')}</span>
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
						<div className="mb-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
							<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
								{t('targetRecommend')}
							</p>
							<p className="mt-1 break-keep text-xs leading-relaxed text-slate-700 dark:text-slate-200">
								{t(`plans.${plan.key}.target`)}
							</p>
							<ul className="mt-3 space-y-2.5">
								{Array.from({ length: plan.benefits }, (_, index) => String(index)).map((item) => (
									<li key={item} className="flex min-w-0 items-start gap-2">
										<span className="mt-px shrink-0 text-sm leading-none" aria-hidden>
											{t(`plans.${plan.key}.benefits.${item}.icon`)}
										</span>
										<div className="min-w-0">
											<p className="break-keep text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">
												{t(`plans.${plan.key}.benefits.${item}.title`)}
											</p>
											<p className="mt-0.5 break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
												{t(`plans.${plan.key}.benefits.${item}.desc`)}
											</p>
										</div>
									</li>
								))}
							</ul>
							<p className="mt-3 break-keep border-t border-slate-200 pt-3 text-[11px] font-medium leading-relaxed text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
								{t(`plans.${plan.key}.benefitsSummary`)}
							</p>
						</div>
					</div>
				</div>

				<Link
					href={plan.href}
					className={`inline-flex w-full items-center justify-center rounded-xl text-center text-sm transition-all ${plan.cta}`}
				>
					{t(`plans.${plan.key}.cta`)}
				</Link>
			</div>
		</article>
	);
}

function PricingItem({ label, tooltip }: { label: string; tooltip: string }) {
	const tooltipId = useId();

	return (
		<li className="group relative flex items-start gap-1.5">
			<span className="mt-0.5 shrink-0" aria-hidden>
				✓
			</span>
			<span className="min-w-0">
				<span className="break-keep">{label}</span>
				<button
					type="button"
					aria-label={tooltip}
					aria-describedby={tooltipId}
					className="ml-1 inline-flex h-4 w-4 align-middle items-center justify-center rounded-full text-slate-400 transition-colors hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:hover:text-cyan-300"
				>
					<Info className="h-3.5 w-3.5" aria-hidden />
				</button>
			</span>
			<span
				id={tooltipId}
				role="tooltip"
				className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-1.5 w-full rounded-lg bg-slate-900 px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed break-keep text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:bg-slate-800"
			>
				{tooltip}
			</span>
		</li>
	);
}
