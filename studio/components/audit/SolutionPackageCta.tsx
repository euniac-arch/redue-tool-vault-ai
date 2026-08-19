'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ContactInquiryForm } from '@/components/ContactInquiryForm';
import {
	ENTERPRISE_PACKAGE_PRICE_KRW,
	SOLUTION_PACKAGES,
	SOLUTION_PACKAGES_ID,
	formatKrw,
	type SolutionPackageId,
} from '@/lib/audit/solution-packages';

interface SolutionPackageCtaProps {
	targetUrl: string;
	brandName: string;
	targetQuery?: string;
}

export function SolutionPackageCta({ targetUrl, brandName, targetQuery }: SolutionPackageCtaProps) {
	const t = useTranslations('audit.packages');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
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
		<div
			id={SOLUTION_PACKAGES_ID}
			className="print:hidden mt-8 scroll-mt-24 space-y-6 rounded-3xl border border-blue-500/20 bg-gradient-to-b from-slate-900/90 via-[#0d1527] to-[#0b0f19] p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.15)]"
		>
			<div className="space-y-1 text-center">
				<h3 className="text-lg font-extrabold text-white">{t('title')}</h3>
				<p className="text-xs text-slate-400">{t('subtitle')}</p>
			</div>

			<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
				<article className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 transition-all hover:border-slate-700">
					<div>
						<span className="text-[11px] font-bold text-slate-400">{t('standard.kicker')}</span>
						<h4 className="mt-1 text-base font-bold text-white">{t('standard.name')}</h4>
						<p className="mt-1 text-xs text-slate-400">{t('standard.body')}</p>
						<div className="mt-4 text-lg font-bold text-indigo-400">
							₩{formatKrw(SOLUTION_PACKAGES.standard.priceKrw, lang)}{' '}
							<span className="text-xs font-normal text-slate-500">{t('priceSuffix')}</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setSelected('standard')}
						className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white transition-all hover:border-slate-600 hover:bg-slate-700 hover:shadow-md"
					>
						{t('standard.cta')}
					</button>
				</article>

				<article className="relative flex flex-col justify-between rounded-2xl border border-blue-500/40 bg-gradient-to-b from-blue-950/40 to-slate-900/90 p-6 shadow-lg shadow-blue-950/50">
					<span className="absolute top-3 right-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-blue-500/40">
						{t('pro.badge')}
					</span>
					<div>
						<span className="text-[11px] font-bold text-blue-400">{t('pro.kicker')}</span>
						<h4 className="mt-1 text-base font-bold text-white">{t('pro.name')}</h4>
						<p className="mt-1 text-xs text-slate-400">{t('pro.body')}</p>
						<div className="mt-4 text-lg font-bold text-emerald-400">
							₩{formatKrw(SOLUTION_PACKAGES.pro.priceKrw, lang)}{' '}
							<span className="text-xs font-normal text-slate-500">{t('priceSuffix')}</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setSelected('pro')}
						className="mt-4 w-full rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/40 transition-all hover:from-blue-500 hover:to-violet-500 hover:shadow-blue-500/60"
					>
						{t('pro.cta')}
					</button>
				</article>
			</div>

			<article className="mt-5 flex flex-col gap-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-slate-900/90 p-6 md:flex-row md:items-stretch md:justify-between md:gap-8">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold text-indigo-200">
							{t('enterprise.badge')}
						</span>
						<span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-200">
							{t('enterprise.exclusive')}
						</span>
						<span className="rounded-full border border-slate-500/40 bg-slate-800/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
							{t('enterprise.limited')}
						</span>
					</div>
					<h4 className="mt-3 text-base font-bold text-white md:text-lg">{t('enterprise.name')}</h4>
					<ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-300">
						<li className="whitespace-nowrap">
							<span className="text-indigo-300">✓</span> {t('enterprise.features.pr')}
						</li>
						<li className="whitespace-nowrap">
							<span className="text-indigo-300">✓</span> {t('enterprise.features.nap')}
						</li>
						<li className="whitespace-nowrap">
							<span className="text-indigo-300">✓</span> {t('enterprise.features.rag')}
						</li>
						<li className="whitespace-nowrap">
							<span className="text-indigo-300">✓</span> {t('enterprise.features.guard')}
						</li>
					</ul>
				</div>

				<div className="flex shrink-0 flex-col justify-center border-t border-indigo-500/20 pt-5 md:w-60 md:border-l md:border-t-0 md:pl-8 md:pt-0">
					<div className="break-keep text-2xl font-extrabold tracking-tight text-indigo-200">
						₩{formatKrw(ENTERPRISE_PACKAGE_PRICE_KRW, lang)}~
					</div>
					<p className="mt-1 break-keep text-xs text-slate-400">{t('enterprise.priceNote')}</p>
					<button
						type="button"
						disabled
						className="mt-4 w-full cursor-not-allowed rounded-lg border border-indigo-400/40 bg-transparent py-2.5 text-xs font-bold text-indigo-200/90"
					>
						{t('enterprise.cta')}
					</button>
				</div>
			</article>

			<p className="break-keep text-[11px] leading-relaxed text-slate-500">{t('legalDisclaimer')}</p>

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
