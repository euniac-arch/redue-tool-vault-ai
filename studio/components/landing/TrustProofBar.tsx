'use client';

import { Clock, Globe, ShieldCheck, Waypoints } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const ITEMS = [
	{ key: 'speed', icon: Clock },
	{ key: 'engines', icon: Waypoints },
	{ key: 'sites', icon: Globe },
	{ key: 'security', icon: ShieldCheck },
] as const;

/** Four trust-metric cards directly under the hero URL form. */
export function TrustProofBar() {
	const t = useTranslations('landing.trustProof');

	return (
		<section aria-label={t('ariaLabel')} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{ITEMS.map(({ key, icon: Icon }) => (
				<article key={key} className={`${LANDING_CARD} flex items-center gap-3`}>
					<span
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/15 text-[#818CF8]"
						aria-hidden
					>
						<Icon className="h-5 w-5" strokeWidth={1.75} />
					</span>
					<div className="min-w-0">
						<p className="text-[20px] font-bold leading-none text-white">{t(`items.${key}.title`)}</p>
						<p className="mt-1 text-[13px] text-[#94A3B8]">{t(`items.${key}.sub`)}</p>
					</div>
				</article>
			))}
		</section>
	);
}
