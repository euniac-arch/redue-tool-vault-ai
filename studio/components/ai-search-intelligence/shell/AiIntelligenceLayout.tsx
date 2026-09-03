'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AsiUsageMeter } from '@/components/ai-search-intelligence/entitlement/AsiUsageMeter';
import { AsiReveal } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { AsiBreadcrumb } from '@/components/ai-search-intelligence/shell/AsiBreadcrumb';
import { AsiControlBar } from '@/components/ai-search-intelligence/shell/AsiControlBar';
import { AsiIaNav } from '@/components/ai-search-intelligence/shell/AsiIaNav';
import { IntelligenceProvider } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import { AI_INTELLIGENCE_PRODUCT } from '@/constants/aiIntelligenceTools';
import { resolveAsiPathname } from '@/lib/ai-search-intelligence/routes';
import { AsiBilingualTitle } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { ASI_KICKER } from '@/lib/ui/asi-chrome';

export function AiIntelligenceLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname() ?? '/intelligence';
	const route = resolveAsiPathname(pathname);
	const t = useTranslations('intelligence');
	const { usage } = useAsiActor();

	return (
		<IntelligenceProvider>
			<div className="flex min-h-full min-w-0 flex-col gap-6">
				<AsiReveal className="flex flex-col gap-4">
					<header className="flex flex-col gap-4">
						<AsiBreadcrumb route={route} />
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="flex flex-col gap-2">
								<p className={ASI_KICKER}>{t('productKicker')}</p>
								<AsiBilingualTitle
									as="h1"
									size="page"
									titleKo={AI_INTELLIGENCE_PRODUCT.titleKo}
									titleEn={AI_INTELLIGENCE_PRODUCT.titleEn}
								/>
								<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t('productTagline')}</p>
							</div>
							<AsiUsageMeter usage={usage} />
						</div>
						<AsiControlBar />
						<AsiIaNav />
					</header>
				</AsiReveal>
				<div key={route.tool.href} className="min-w-0">
					{children}
				</div>
			</div>
		</IntelligenceProvider>
	);
}
