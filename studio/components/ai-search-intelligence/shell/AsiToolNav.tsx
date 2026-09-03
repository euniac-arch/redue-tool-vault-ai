'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ASI_FEATURES, resolveAsiPathname } from '@/lib/ai-search-intelligence/routes';
import { ASI_TOOL_ACTIVE, ASI_TOOL_IDLE, asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiToolNav() {
	const t = useTranslations('intelligence');
	const pathname = usePathname();
	const activeHref = resolveAsiPathname(pathname).tool.href;

	return (
		<nav aria-label={t('toolNavAria')} className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			{ASI_FEATURES.map((tool) => {
				const active = tool.href === activeHref;
				return (
					<Link
						key={tool.id}
						href={tool.href}
						prefetch
						aria-current={active ? 'page' : undefined}
						className={asiFocusRing(
							`rounded-lg border px-3 py-2 text-left text-[13px] font-semibold ${
								active ? ASI_TOOL_ACTIVE : ASI_TOOL_IDLE
							}`,
						)}
					>
						{t(tool.titleKey)}
					</Link>
				);
			})}
		</nav>
	);
}
