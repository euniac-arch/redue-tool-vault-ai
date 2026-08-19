'use client';

import { Lightbulb, Lock, Timer, Waypoints } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const ITEMS = [
	{ key: 'engines', icon: Waypoints },
	{ key: 'speed', icon: Timer },
	{ key: 'insight', icon: Lightbulb },
	{ key: 'security', icon: Lock },
] as const;

/** Four REDUE differentiators inside a single card. */
export function DifferentiatorGrid() {
	const t = useTranslations('landing.strengths');

	return (
		<section aria-label={t('ariaLabel')} className={`${LANDING_CARD} mt-8 p-6`}>
			<ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{ITEMS.map(({ key, icon: Icon }) => (
					<li key={key} className="flex flex-col items-start">
						<div className="flex items-center gap-2">
							<Icon className="h-4 w-4 shrink-0 text-[#818CF8]" strokeWidth={1.75} aria-hidden />
							<p className="text-[15px] font-bold text-white">{t(`items.${key}.title`)}</p>
						</div>
						<p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
							{t(`items.${key}.line1`)}
							<br />
							{t(`items.${key}.line2`)}
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}
