'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageSubTabs } from '@/components/nav/PageSubTabs';

const HUB_TABS = [
	{ id: 'aeo-geo', href: '/insights?tab=aeo-geo', aliases: ['/aeo-geo'] },
	{ id: 'ai-hub', href: '/insights?tab=ai-hub', aliases: ['/ai-hub'] },
	{ id: 'prompts', href: '/insights?tab=prompts', aliases: ['/prompts'] },
	{ id: 'insights', href: '/insights?tab=insights', aliases: ['/insights'] },
] as const;

const HUB_TAB_LABEL: Record<(typeof HUB_TABS)[number]['id'], 'aeoGeoGuide' | 'globalAiTools' | 'aiPromptHub' | 'insightsColumn'> = {
	'aeo-geo': 'aeoGeoGuide',
	'ai-hub': 'globalAiTools',
	prompts: 'aiPromptHub',
	insights: 'insightsColumn',
};

export function resolveInsightsHubTab(pathname: string, tabParam: string | null): (typeof HUB_TABS)[number]['id'] {
	if (pathname.startsWith('/aeo-geo')) return 'aeo-geo';
	if (pathname.startsWith('/ai-hub')) return 'ai-hub';
	if (pathname.startsWith('/prompts')) return 'prompts';
	if (tabParam === 'aeo-geo' || tabParam === 'ai-hub' || tabParam === 'prompts' || tabParam === 'insights') return tabParam;
	if (pathname === '/insights' || pathname.startsWith('/insights/')) return 'insights';
	return 'aeo-geo';
}

export function InsightsHubTabs({ className = '' }: { className?: string }) {
	const t = useTranslations('nav');
	const pathname = usePathname() ?? '/insights';
	const searchParams = useSearchParams();
	const activeId = resolveInsightsHubTab(pathname, searchParams.get('tab'));

	return (
		<div className={`flex w-full items-center justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`.trim()}>
			<PageSubTabs
				tone="cyan"
				align="center"
				ariaLabel={t('insightsHub')}
				activeId={activeId}
				tabs={HUB_TABS.map((tab) => ({
					id: tab.id,
					href: tab.href,
					label: t(HUB_TAB_LABEL[tab.id]),
				}))}
			/>
		</div>
	);
}
