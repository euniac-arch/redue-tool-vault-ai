'use client';

import { useTranslations } from 'next-intl';
import { AsiLockCta } from '@/components/ai-search-intelligence/entitlement/AsiLockCta';
import type { AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement';
import type { AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';
import { ASI_CARD } from '@/lib/ui/asi-chrome';

export function AsiLockPanel({ feature }: { feature: AsiFeatureId; tier: AsiTier }) {
	const t = useTranslations('intelligence.lock');

	return (
		<section className={`${ASI_CARD} px-5 py-6`}>
			<h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
				<span aria-hidden>🔒 </span>
				{t(`${feature}.title`)}
			</h2>
			<p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
				{t(`${feature}.body`)}
			</p>
			<div className="mt-5">
				<AsiLockCta feature={feature} label={t('ctaAnalyze')} />
			</div>
		</section>
	);
}
