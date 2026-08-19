'use client';

import Link from 'next/link';
import { Braces, LayoutDashboard, Sparkles, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const AREAS = [
	{ key: 'ai', href: '/geo-optimization', icon: Sparkles },
	{ key: 'seo', href: '/audit', icon: LayoutDashboard },
	{ key: 'geo', href: '/geo-optimization', icon: Target },
	{ key: 'schema', href: '/audit', icon: Braces },
] as const;

/** Four diagnosis-domain cards: AI visibility, SEO, GEO, Schema. */
export function DiagnosisAreaCards() {
	const t = useTranslations('landing.diagnosisAreas');

	return (
		<section aria-label={t('title')} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{AREAS.map(({ key, href, icon: Icon }) => (
				<article key={key} className={`${LANDING_CARD} flex min-h-[188px] flex-col`}>
					<span
						className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7C3AED]/40 bg-[#7C3AED]/15 text-[#A78BFA]"
						aria-hidden
					>
						<Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
					</span>
					<h3 className="mt-3 text-base font-bold text-white">{t(`items.${key}.title`)}</h3>
					<p className="mt-1.5 text-[13px] leading-[1.5] text-[#94A3B8]">
						{t(`items.${key}.line1`)}
						<br />
						{t(`items.${key}.line2`)}
					</p>
					<Link
						href={href}
						className="mt-auto pt-4 text-[13px] font-medium text-[#818CF8] transition hover:text-[#A5B4FC]"
					>
						{t('learnMore')}
					</Link>
				</article>
			))}
		</section>
	);
}
