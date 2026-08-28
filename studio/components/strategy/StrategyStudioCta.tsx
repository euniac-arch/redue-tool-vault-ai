'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buildStrategyStudioHref } from '@/lib/strategy/strategy-url';

interface StrategyStudioCtaProps {
	auditId?: string | null;
	keyword?: string | null;
	url?: string | null;
	variant?: 'banner' | 'button';
}

export function StrategyStudioCta({ auditId, keyword, url, variant = 'banner' }: StrategyStudioCtaProps) {
	const t = useTranslations('strategyStudio');
	const href = buildStrategyStudioHref(auditId, keyword, url);

	if (variant === 'button') {
		return (
			<Link
				href={href}
				className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] px-6 py-3 text-sm font-bold text-white"
			>
				{t('ctaButton')}
			</Link>
		);
	}

	return (
		<section
			aria-label={t('ctaAria')}
			className="print:hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-5 py-4 dark:border-cyan-500/20 dark:from-[#0b1726] dark:via-[#0a1220] dark:to-[#082028]"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
						{t('ctaKicker')}
					</p>
					<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('ctaTitle')}</p>
					<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('ctaHint')}</p>
				</div>
				<Link
					href={href}
					className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] px-5 py-2.5 text-sm font-bold text-white"
				>
					{t('ctaButton')}
				</Link>
			</div>
		</section>
	);
}
