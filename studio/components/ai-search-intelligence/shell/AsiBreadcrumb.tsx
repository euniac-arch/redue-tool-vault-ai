'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { asiBreadcrumb, type AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';
import { asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiBreadcrumb({ route }: { route: AsiResolvedRoute }) {
	const t = useTranslations('intelligence');
	const crumbs = asiBreadcrumb(route);

	return (
		<nav aria-label={t('breadcrumbAria')}>
			<ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
				{crumbs.map((crumb, index) => {
					const label = t(crumb.titleKey);
					const last = Boolean(crumb.current) || index === crumbs.length - 1;
					return (
						<li key={`${crumb.href}-${crumb.titleKey}`} className="flex min-w-0 items-center gap-1.5">
							{index > 0 ? (
								<span aria-hidden className="text-slate-300 dark:text-slate-600">
									/
								</span>
							) : null}
							{last ? (
								<span
									aria-current="page"
									className="truncate text-cyan-700 dark:text-cyan-400"
								>
									{label}
								</span>
							) : (
								<Link
									href={crumb.href}
									className={asiFocusRing(
										'truncate rounded-sm text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300',
									)}
								>
									{label}
								</Link>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
