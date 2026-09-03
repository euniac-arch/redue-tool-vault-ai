'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export const HUB_TABS = [
	{
		id: 'aeo-geo',
		href: '/insights?tab=aeo-geo',
		titleKey: 'aeoGeoGuide',
		roleKey: 'hubRoleLearn',
	},
	{
		id: 'ai-hub',
		href: '/insights?tab=ai-hub',
		titleKey: 'globalAiTools',
		roleKey: 'hubRoleFindTools',
	},
	{
		id: 'prompts',
		href: '/insights?tab=prompts',
		titleKey: 'aiPromptHub',
		roleKey: 'hubRoleUseAi',
	},
	{
		id: 'insights',
		href: '/insights?tab=insights',
		titleKey: 'insightsColumn',
		roleKey: 'hubRoleSeeTrends',
	},
] as const;

export type InsightsHubTabId = (typeof HUB_TABS)[number]['id'];

export function resolveInsightsHubTab(pathname: string, tabParam: string | null): InsightsHubTabId {
	if (pathname.startsWith('/aeo-geo')) return 'aeo-geo';
	if (pathname.startsWith('/ai-hub')) return 'ai-hub';
	if (pathname.startsWith('/prompts')) return 'prompts';
	if (tabParam === 'aeo-geo' || tabParam === 'ai-hub' || tabParam === 'prompts' || tabParam === 'insights') {
		return tabParam;
	}
	if (pathname === '/insights' || pathname.startsWith('/insights/')) return 'insights';
	return 'aeo-geo';
}

export function InsightsHubTabs({ className = '' }: { className?: string }) {
	const t = useTranslations('nav');
	const pathname = usePathname() ?? '/insights';
	const searchParams = useSearchParams();
	const activeId = resolveInsightsHubTab(pathname, searchParams.get('tab'));

	return (
		<nav
			aria-label={t('insightsHub')}
			className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-4 ${className}`.trim()}
		>
			{HUB_TABS.map((tab) => {
				const active = tab.id === activeId;
				return (
					<Link
						key={tab.id}
						href={tab.href}
						aria-current={active ? 'page' : undefined}
						className={`flex min-w-0 flex-col rounded-xl border px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
							active
								? 'border-cyan-400/70 bg-cyan-50 shadow-sm dark:border-cyan-500/50 dark:bg-slate-800/90'
								: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
						}`}
					>
						<span
							className={`text-[10px] font-bold uppercase tracking-wider ${
								active ? 'text-cyan-600 dark:text-cyan-400/80' : 'text-slate-400 dark:text-slate-500'
							}`}
						>
							{t(tab.roleKey)}
						</span>
						<span
							className={`mt-0.5 text-xs font-bold leading-snug sm:truncate sm:text-[13px] ${
								active
									? 'text-cyan-700 dark:text-cyan-400'
									: 'text-slate-700 dark:text-slate-200'
							}`}
						>
							{t(tab.titleKey)}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
