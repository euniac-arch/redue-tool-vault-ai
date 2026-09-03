'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AI_INTELLIGENCE_PRODUCT, formatIntelligenceCategory } from '@/constants/aiIntelligenceTools';
import { useActiveIntelligenceTool } from '@/lib/ai-search-intelligence/use-intelligence-tool';
import { ASI_BASE, type AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';
import { asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiBreadcrumb({ route }: { route: AsiResolvedRoute }) {
	const t = useTranslations('intelligence');
	const tool = useActiveIntelligenceTool();
	const crumbs = [
		{ href: ASI_BASE, label: AI_INTELLIGENCE_PRODUCT.titleKo },
		{ href: route.pillar.href, label: formatIntelligenceCategory(tool) },
		{ href: route.tool.href, label: tool.titleKo, current: true },
	];

	return (
		<nav aria-label={t('breadcrumbAria')}>
			<ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
				{crumbs.map((crumb, index) => {
					const last = Boolean(crumb.current) || index === crumbs.length - 1;
					return (
						<li key={`${crumb.href}-${crumb.label}`} className="flex min-w-0 items-center gap-1.5">
							{index > 0 ? (
								<span aria-hidden className="text-slate-300 dark:text-slate-600">
									/
								</span>
							) : null}
							{last ? (
								<span aria-current="page" className="truncate text-cyan-700 dark:text-cyan-400">
									{crumb.label}
								</span>
							) : (
								<Link
									href={crumb.href}
									className={asiFocusRing(
										'truncate rounded-sm text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300',
									)}
								>
									{crumb.label}
								</Link>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
