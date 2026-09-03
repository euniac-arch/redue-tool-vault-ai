'use client';

import { useTranslations } from 'next-intl';
import type { AsiProvenance, AsiProvenanceBadgeId } from '@/lib/ai-search-intelligence/provenance';
import { defaultBadgeForProvenance } from '@/lib/ai-search-intelligence/provenance';
import { ASI_BADGE } from '@/lib/ui/asi-chrome';

const TONE: Record<AsiProvenance, string> = {
	observed:
		'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	derived:
		'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
};

const KIND: Record<AsiProvenanceBadgeId, AsiProvenance> = {
	observed: 'observed',
	live_result: 'observed',
	actual_response: 'observed',
	redue_analysis: 'derived',
	estimated: 'derived',
	derived_score: 'derived',
};

export function AsiProvenanceBadge({
	badge,
	kind,
}: {
	badge?: AsiProvenanceBadgeId;
	kind?: AsiProvenance;
}) {
	const t = useTranslations('intelligence.provenance');
	const resolved = badge ?? (kind ? defaultBadgeForProvenance(kind) : null);
	if (!resolved) return null;
	const provenance = KIND[resolved];

	return (
		<span className={`${ASI_BADGE} ${TONE[provenance]}`} title={t(`badge.${resolved}`)}>
			{t(`badge.${resolved}`)}
		</span>
	);
}
