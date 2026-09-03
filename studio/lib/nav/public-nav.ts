import { ASI_PILLARS, getAsiPillar, getAsiTool, resolveAsiPathname } from '@/lib/ai-search-intelligence/routes';

export type PublicNavChildKey =
	| 'liveDiagnose'
	| 'auditHistory'
	| 'asiWarRoom'
	| 'asiBrandPerception'
	| 'asiReputationRadar'
	| 'asiBrandSnapshot'
	| 'asiRecommendationTest'
	| 'asiRecommendationSimulator'
	| 'asiShareOfVoice'
	| 'asiCompetitorAnalysis'
	| 'asiCitationExplorer'
	| 'asiQueryGenerator'
	| 'asiVisibilityMonitor'
	| 'asiAgentReadiness'
	| 'asiOpportunityFinder'
	| 'asiEvidenceExplorer'
	| 'asiCompetitorGap'
	| 'asiNextBestAction'
	| 'asiPerception'
	| 'asiRecommendation'
	| 'asiEvidence'
	| 'asiFuture'
	| 'asiDiscover'
	| 'asiMeasure'
	| 'asiExplain'
	| 'asiCompete'
	| 'asiAct'
	| 'asiMonitor'
	| 'asiGnbShareOfVoice'
	| 'asiGnbBrandKnowledgeGraph'
	| 'asiGnbLiveGrounding'
	| 'asiGnbCitationBottleneck'
	| 'asiGnbGeoKeywords'
	| 'asiGnbActionGuide'
	| 'aeoGeoGuide'
	| 'globalAiTools'
	| 'aiPromptHub'
	| 'insightsColumn';

export type PublicNavItemKey =
	| 'scanner'
	| 'aiSearchIntelligence'
	| 'strategyStudio'
	| 'industry'
	| 'insightsHub'
	| 'portfolio';

export type PublicNavChild = {
	href: string;
	key: PublicNavChildKey;
};

export type PublicNavItem = {
	href: string;
	key: PublicNavItemKey;
	match: readonly string[];
	children?: readonly PublicNavChild[];
};

/**
 * Compact vertical GNB list for the "AI 인텔리전스" mega-menu — 6 core tools
 * only (title + href), matching the slim single-column style used by the
 * other GNB items. Keep this list at exactly 6 entries.
 */
const AI_INTELLIGENCE_GNB_MENUS: readonly PublicNavChild[] = [
	{ href: getAsiTool('sov').href, key: 'asiGnbShareOfVoice' },
	{ href: getAsiTool('brand').href, key: 'asiGnbBrandKnowledgeGraph' },
	{ href: getAsiTool('visibility').href, key: 'asiGnbLiveGrounding' },
	{ href: getAsiTool('citations').href, key: 'asiGnbCitationBottleneck' },
	{ href: getAsiTool('questions').href, key: 'asiGnbGeoKeywords' },
	{ href: getAsiTool('action').href, key: 'asiGnbActionGuide' },
];

export const PUBLIC_NAV: readonly PublicNavItem[] = [
	{
		href: '/audit',
		key: 'scanner',
		match: ['/audit', '/report', '/diagnose'],
		children: [
			{ href: '/audit', key: 'liveDiagnose' },
			{ href: '/audit?tab=history', key: 'auditHistory' },
		],
	},
	{
		href: getAsiPillar('discover').href,
		key: 'aiSearchIntelligence',
		match: ['/intelligence'],
		children: AI_INTELLIGENCE_GNB_MENUS,
	},
	{
		href: '/strategy',
		key: 'strategyStudio',
		match: ['/strategy'],
	},
	{
		href: '/industry',
		key: 'industry',
		match: ['/industry'],
	},
	{
		href: '/insights?tab=aeo-geo',
		key: 'insightsHub',
		match: ['/insights', '/aeo-geo', '/ai-hub', '/prompts'],
		children: [
			{ href: '/insights?tab=aeo-geo', key: 'aeoGeoGuide' },
			{ href: '/insights?tab=ai-hub', key: 'globalAiTools' },
			{ href: '/insights?tab=prompts', key: 'aiPromptHub' },
			{ href: '/insights?tab=insights', key: 'insightsColumn' },
		],
	},
	{
		href: '/portfolio',
		key: 'portfolio',
		match: ['/portfolio', '/cases'],
	},
] as const;

export const PUBLIC_NAV_CTA = { href: '/contact', key: 'contact' as const };

export function isPublicNavItemActive(pathname: string, item: PublicNavItem): boolean {
	if (item.key === 'scanner') {
		return (
			pathname === '/audit' ||
			pathname.startsWith('/audit/') ||
			pathname.startsWith('/report/') ||
			pathname === '/diagnose' ||
			pathname.startsWith('/diagnose/')
		);
	}
	return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPublicNavChildActive(
	pathname: string,
	search: string,
	child: PublicNavChild,
): boolean {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const tab = params.get('tab')?.trim() || '';

	if (child.href.startsWith('/intelligence')) {
		const route = resolveAsiPathname(pathname);
		const group = ASI_PILLARS.find((item) => item.navKey === child.key);
		if (group) {
			return route.pillar.id === group.id;
		}
		if (child.key === 'asiWarRoom') {
			return route.tool.id === 'war-room';
		}
		return route.tool.href === child.href.split('#')[0];
	}

	if (child.key === 'liveDiagnose') {
		return (
			(pathname === '/audit' && tab !== 'history') ||
			pathname === '/diagnose' ||
			pathname.startsWith('/diagnose/')
		);
	}
	if (child.key === 'auditHistory') {
		return pathname === '/audit/history' || pathname.startsWith('/audit/history/') || (pathname === '/audit' && tab === 'history');
	}
	if (child.key === 'aeoGeoGuide') {
		return pathname === '/aeo-geo' || pathname.startsWith('/aeo-geo/') || (pathname === '/insights' && tab === 'aeo-geo');
	}
	if (child.key === 'globalAiTools') {
		return pathname === '/ai-hub' || pathname.startsWith('/ai-hub/') || (pathname === '/insights' && tab === 'ai-hub');
	}
	if (child.key === 'aiPromptHub') {
		return pathname === '/prompts' || pathname.startsWith('/prompts/') || (pathname === '/insights' && tab === 'prompts');
	}
	if (child.key === 'insightsColumn') {
		return pathname === '/insights' && (tab === '' || tab === 'insights');
	}
	return pathname === child.href || pathname.startsWith(`${child.href}/`);
}
