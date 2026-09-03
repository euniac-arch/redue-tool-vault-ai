'use client';

import { useTranslations } from 'next-intl';
import { AsiBilingualTitle, AsiCategoryBadge } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiReveal } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { useActiveIntelligenceTool } from '@/lib/ai-search-intelligence/use-intelligence-tool';
import type { AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';
import { ASI_KICKER } from '@/lib/ui/asi-chrome';

export function AsiToolPlaceholder({ route: _route }: { route: AsiResolvedRoute }) {
	const t = useTranslations('intelligence');
	const tool = useActiveIntelligenceTool();

	return (
		<AsiReveal className="flex flex-col gap-5">
			<section className="flex flex-col gap-3">
				<p className={ASI_KICKER}>
					<AsiCategoryBadge categoryKo={tool.categoryKo} categoryEn={tool.categoryEn} />
				</p>
				<AsiBilingualTitle as="h1" size="detail" titleKo={tool.titleKo} titleEn={tool.titleEn} />
				<p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{tool.subDescription}</p>
			</section>
			<AsiEmptyState title={t('comingTitle')} body={t('comingBody')} />
		</AsiReveal>
	);
}
