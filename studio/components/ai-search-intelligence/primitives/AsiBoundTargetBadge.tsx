'use client';

import { useTranslations } from 'next-intl';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';

export function AsiBoundTargetBadge({ className = '' }: { className?: string }) {
	const t = useTranslations('intelligence.ux');
	const { currentSite, targetUrl } = useIntelligence();
	const displayUrl = currentSite?.siteUrl || targetUrl.trim();
	const bound = Boolean(displayUrl);
	const display = bound ? displayUrl : t('siteUnset');

	return (
		<span
			title={display}
			className={`inline-flex max-w-full items-center truncate rounded-full border px-3 py-1.5 text-xs font-semibold ${
				bound
					? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200'
					: 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400'
			} ${className}`}
		>
			{t('boundTarget', { url: display })}
		</span>
	);
}
