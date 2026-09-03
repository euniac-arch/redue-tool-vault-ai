'use client';

import { useTranslations } from 'next-intl';
import type { PublicAsiAccountUsage } from '@/lib/ai-search-intelligence/entitlement/usage-public';
import { ASI_CARD } from '@/lib/ui/asi-chrome';

export function AsiUsageMeter({ usage }: { usage: PublicAsiAccountUsage | null }) {
	const t = useTranslations('intelligence.quota');
	if (!usage) return null;

	const unlimited = usage.queriesLimit == null;
	const limit = usage.queriesLimit ?? 0;
	const used = usage.queriesUsed;
	const remaining = usage.remaining;
	const pct = unlimited ? 0 : limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));

	return (
		<section className={`${ASI_CARD} w-full max-w-md px-4 py-3`} aria-label={t('title')}>
			<div className="flex items-baseline justify-between gap-3">
				<p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t('title')}</p>
				<p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
					{unlimited ? t('unlimited') : t('fraction', { used, limit })}
				</p>
			</div>
			{unlimited ? null : (
				<div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
					<div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
				</div>
			)}
			<p className="mt-2 text-xs text-zinc-500">
				{unlimited ? t('unlimitedHint') : remaining === 0 ? t('usedUp') : t('remaining', { count: remaining ?? 0 })}
			</p>
		</section>
	);
}
