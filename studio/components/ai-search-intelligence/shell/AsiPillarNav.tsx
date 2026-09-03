'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AsiCategoryBadge } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { getIntelligenceCategory } from '@/constants/aiIntelligenceTools';
import { ASI_PILLARS, resolveAsiPathname } from '@/lib/ai-search-intelligence/routes';
import { ASI_PILLAR_ACTIVE, ASI_PILLAR_IDLE, asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiPillarNav() {
	const t = useTranslations('intelligence');
	const pathname = usePathname();
	const activePillar = resolveAsiPathname(pathname).pillar.id;

	return (
		<nav aria-label={t('pillarNavAria')} className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
			{ASI_PILLARS.map((pillar) => {
				const active = pillar.id === activePillar;
				const category = getIntelligenceCategory(pillar.id);
				return (
					<Link
						key={pillar.id}
						href={pillar.href}
						prefetch
						aria-current={active ? 'page' : undefined}
						className={asiFocusRing(
							`flex min-w-0 flex-col rounded-xl border px-3 py-2.5 ${active ? ASI_PILLAR_ACTIVE : ASI_PILLAR_IDLE}`,
						)}
					>
						<span
							className={`text-[10px] font-semibold ${
								active ? 'text-cyan-600 dark:text-cyan-400/80' : 'text-slate-400 dark:text-slate-500'
							}`}
						>
							<AsiCategoryBadge categoryKo={category.categoryKo} categoryEn={category.categoryEn} />
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
