'use client';

import { useTranslations } from 'next-intl';
import { AsiLockCta } from '@/components/ai-search-intelligence/entitlement/AsiLockCta';
import { canAccessFeature, type AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import { ASI_CARD } from '@/lib/ui/asi-chrome';

type AsiClipKind = 'opportunity' | 'evidence' | 'citations';

const CLIP_FEATURE: Record<AsiClipKind, AsiFeatureId> = {
	opportunity: 'opportunity.basic',
	evidence: 'evidence.explorer',
	citations: 'evidence.basic',
};

export function AsiClipBanner({ kind }: { kind: AsiClipKind }) {
	const t = useTranslations('intelligence.lock');
	const { actor, ready } = useAsiActor();
	if (!ready) return null;

	const feature = CLIP_FEATURE[kind];
	if (canAccessFeature(actor, feature)) return null;

	return (
		<section className={`${ASI_CARD} px-5 py-5`}>
			<h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
				<span aria-hidden>🔒 </span>
				{t(`${feature}.title`)}
			</h2>
			<p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
				{t(`${feature}.body`)}
			</p>
			<div className="mt-4">
				<AsiLockCta feature={feature} label={t('ctaAnalyze')} />
			</div>
		</section>
	);
}
