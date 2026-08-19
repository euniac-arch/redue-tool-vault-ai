'use client';

import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const STEPS = ['url', 'analyze', 'report'] as const;

/** Three-step audit process inside a single card. */
export function AuditProcessFlow() {
	const t = useTranslations('landing.process');

	return (
		<section aria-label={t('title')} className={`${LANDING_CARD} mt-8 px-8 py-6`}>
			<ol className="flex flex-col items-center justify-between gap-5 lg:flex-row lg:gap-4">
				{STEPS.map((key, index) => (
					<li key={key} className="flex w-full flex-col items-center lg:w-auto lg:flex-1 lg:flex-row">
						<div className="flex flex-1 flex-col items-center text-center">
							<p className="text-[20px] font-bold text-[#818CF8]">{t(`steps.${key}.n`)}</p>
							<p className="mt-1 text-base font-bold text-white">{t(`steps.${key}.title`)}</p>
							<p className="mt-1 text-[13px] text-[#94A3B8]">{t(`steps.${key}.desc`)}</p>
						</div>
						{index < STEPS.length - 1 ? (
							<span
								aria-hidden
								className="mt-2 text-[20px] text-[#475569] lg:mt-0 lg:px-3"
							>
								<span className="lg:hidden">↓</span>
								<span className="hidden lg:inline">→</span>
							</span>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}