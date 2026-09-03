'use client';

import { useTranslations } from 'next-intl';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiReveal } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import type { AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';
import { ASI_KICKER } from '@/lib/ui/asi-chrome';

export function AsiToolPlaceholder({ route }: { route: AsiResolvedRoute }) {
	const t = useTranslations('intelligence');
	const tNav = useTranslations('nav');

	return (
		<AsiReveal className="flex flex-col gap-5">
			<section className="flex flex-col gap-3">
				<p className={ASI_KICKER}>{tNav(route.pillar.navKey)}</p>
				<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
					{t(route.tool.titleKey)}
				</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
					{t(route.tool.summaryKey)}
				</p>
			</section>
			<AsiEmptyState title={t('comingTitle')} body={t('comingBody')} />
		</AsiReveal>
	);
}
