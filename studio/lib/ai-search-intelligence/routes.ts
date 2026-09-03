/**
 * AI SEARCH INTELLIGENCE IA — single source for GNB children, in-product
 * sub-nav, breadcrumbs, and /intelligence/[feature] pages.
 *
 * Canonical URLs are flat feature slugs so each of the 16 tools is a distinct
 * App Router page. Nested STEP 03 paths remain aliases and 308 to canonical.
 */

export const ASI_BASE = '/intelligence';

export type AsiPillarId = 'discover' | 'measure' | 'explain' | 'compete' | 'act' | 'monitor';

export type AsiIaEntryId = AsiToolId | 'visibility-trend' | 'alert';

export type AsiIaNavKey =
	| 'asiDiscover'
	| 'asiMeasure'
	| 'asiExplain'
	| 'asiCompete'
	| 'asiAct'
	| 'asiMonitor';

export type AsiToolId =
	| 'war-room'
	| 'brand'
	| 'reputation'
	| 'snapshot'
	| 'test'
	| 'simulator'
	| 'sov'
	| 'competitors'
	| 'citations'
	| 'questions'
	| 'visibility'
	| 'agent-readiness'
	| 'opportunity'
	| 'explorer'
	| 'gap'
	| 'action';

export type AsiFeatureSlug =
	| 'war-room'
	| 'brand-perception'
	| 'reputation-radar'
	| 'brand-snapshot'
	| 'recommendation-test'
	| 'recommendation-simulator'
	| 'share-of-voice'
	| 'competitor-analysis'
	| 'citation-explorer'
	| 'query-generator'
	| 'visibility-monitor'
	| 'agent-readiness'
	| 'opportunity-finder'
	| 'evidence-explorer'
	| 'competitor-gap'
	| 'next-best-action';

export type AsiNavChildKey =
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
	| 'asiNextBestAction';

export type AsiToolDef = {
	id: AsiToolId;
	slug: AsiFeatureSlug;
	href: `${typeof ASI_BASE}/${AsiFeatureSlug}`;
	titleKey: `tools.${AsiToolId}`;
	summaryKey: `tools.${AsiToolId}Summary`;
	navKey: AsiNavChildKey;
	iaTitleKey?: `ia.entries.${string}`;
};

export type AsiIaEntry = {
	id: AsiIaEntryId;
	href: string;
	toolId: AsiToolId;
	titleKey: string;
};

export type AsiPillarDef = {
	id: AsiPillarId;
	href: `${typeof ASI_BASE}/${AsiFeatureSlug}` | typeof ASI_BASE;
	navKey: AsiIaNavKey;
	roleKey: `roles.${AsiPillarId}`;
	tools: readonly AsiToolDef[];
	extras?: readonly AsiIaEntry[];
};

const warRoom: AsiToolDef = {
	id: 'war-room',
	slug: 'war-room',
	href: `${ASI_BASE}/war-room`,
	titleKey: 'tools.war-room',
	summaryKey: 'tools.war-roomSummary',
	navKey: 'asiWarRoom',
};

const brand: AsiToolDef = {
	id: 'brand',
	slug: 'brand-perception',
	href: `${ASI_BASE}/brand-perception`,
	titleKey: 'tools.brand',
	summaryKey: 'tools.brandSummary',
	navKey: 'asiBrandPerception',
};

const reputation: AsiToolDef = {
	id: 'reputation',
	slug: 'reputation-radar',
	href: `${ASI_BASE}/reputation-radar`,
	titleKey: 'tools.reputation',
	summaryKey: 'tools.reputationSummary',
	navKey: 'asiReputationRadar',
};

const snapshot: AsiToolDef = {
	id: 'snapshot',
	slug: 'brand-snapshot',
	href: `${ASI_BASE}/brand-snapshot`,
	titleKey: 'tools.snapshot',
	summaryKey: 'tools.snapshotSummary',
	navKey: 'asiBrandSnapshot',
	iaTitleKey: 'ia.entries.content',
};

const test: AsiToolDef = {
	id: 'test',
	slug: 'recommendation-test',
	href: `${ASI_BASE}/recommendation-test`,
	titleKey: 'tools.test',
	summaryKey: 'tools.testSummary',
	navKey: 'asiRecommendationTest',
	iaTitleKey: 'ia.entries.recommendation',
};

const simulator: AsiToolDef = {
	id: 'simulator',
	slug: 'recommendation-simulator',
	href: `${ASI_BASE}/recommendation-simulator`,
	titleKey: 'tools.simulator',
	summaryKey: 'tools.simulatorSummary',
	navKey: 'asiRecommendationSimulator',
	iaTitleKey: 'ia.entries.simulator',
};

const sov: AsiToolDef = {
	id: 'sov',
	slug: 'share-of-voice',
	href: `${ASI_BASE}/share-of-voice`,
	titleKey: 'tools.sov',
	summaryKey: 'tools.sovSummary',
	navKey: 'asiShareOfVoice',
};

const competitors: AsiToolDef = {
	id: 'competitors',
	slug: 'competitor-analysis',
	href: `${ASI_BASE}/competitor-analysis`,
	titleKey: 'tools.competitors',
	summaryKey: 'tools.competitorsSummary',
	navKey: 'asiCompetitorAnalysis',
	iaTitleKey: 'ia.entries.competitors',
};

const citations: AsiToolDef = {
	id: 'citations',
	slug: 'citation-explorer',
	href: `${ASI_BASE}/citation-explorer`,
	titleKey: 'tools.citations',
	summaryKey: 'tools.citationsSummary',
	navKey: 'asiCitationExplorer',
	iaTitleKey: 'ia.entries.citations',
};

const questions: AsiToolDef = {
	id: 'questions',
	slug: 'query-generator',
	href: `${ASI_BASE}/query-generator`,
	titleKey: 'tools.questions',
	summaryKey: 'tools.questionsSummary',
	navKey: 'asiQueryGenerator',
	iaTitleKey: 'ia.entries.query',
};

const visibility: AsiToolDef = {
	id: 'visibility',
	slug: 'visibility-monitor',
	href: `${ASI_BASE}/visibility-monitor`,
	titleKey: 'tools.visibility',
	summaryKey: 'tools.visibilitySummary',
	navKey: 'asiVisibilityMonitor',
	iaTitleKey: 'ia.entries.visibility',
};

const agentReadiness: AsiToolDef = {
	id: 'agent-readiness',
	slug: 'agent-readiness',
	href: `${ASI_BASE}/agent-readiness`,
	titleKey: 'tools.agent-readiness',
	summaryKey: 'tools.agent-readinessSummary',
	navKey: 'asiAgentReadiness',
};

const opportunity: AsiToolDef = {
	id: 'opportunity',
	slug: 'opportunity-finder',
	href: `${ASI_BASE}/opportunity-finder`,
	titleKey: 'tools.opportunity',
	summaryKey: 'tools.opportunitySummary',
	navKey: 'asiOpportunityFinder',
};

const explorer: AsiToolDef = {
	id: 'explorer',
	slug: 'evidence-explorer',
	href: `${ASI_BASE}/evidence-explorer`,
	titleKey: 'tools.explorer',
	summaryKey: 'tools.explorerSummary',
	navKey: 'asiEvidenceExplorer',
};

const gap: AsiToolDef = {
	id: 'gap',
	slug: 'competitor-gap',
	href: `${ASI_BASE}/competitor-gap`,
	titleKey: 'tools.gap',
	summaryKey: 'tools.gapSummary',
	navKey: 'asiCompetitorGap',
	iaTitleKey: 'ia.entries.gap',
};

const action: AsiToolDef = {
	id: 'action',
	slug: 'next-best-action',
	href: `${ASI_BASE}/next-best-action`,
	titleKey: 'tools.action',
	summaryKey: 'tools.actionSummary',
	navKey: 'asiNextBestAction',
};

const visibilityTrend: AsiIaEntry = {
	id: 'visibility-trend',
	href: `${visibility.href}#asi-trend`,
	toolId: 'visibility',
	titleKey: 'ia.entries.visibilityMonitor',
};

const visibilityAlert: AsiIaEntry = {
	id: 'alert',
	href: `${visibility.href}#asi-alerts`,
	toolId: 'visibility',
	titleKey: 'ia.entries.alert',
};

export const ASI_PILLARS: readonly AsiPillarDef[] = [
	{
		id: 'discover',
		href: questions.href,
		navKey: 'asiDiscover',
		roleKey: 'roles.discover',
		tools: [questions, opportunity, simulator],
	},
	{
		id: 'measure',
		href: visibility.href,
		navKey: 'asiMeasure',
		roleKey: 'roles.measure',
		tools: [visibility, brand, sov, test],
	},
	{
		id: 'explain',
		href: explorer.href,
		navKey: 'asiExplain',
		roleKey: 'roles.explain',
		tools: [explorer, citations, reputation],
	},
	{
		id: 'compete',
		href: competitors.href,
		navKey: 'asiCompete',
		roleKey: 'roles.compete',
		tools: [competitors, gap],
	},
	{
		id: 'act',
		href: action.href,
		navKey: 'asiAct',
		roleKey: 'roles.act',
		tools: [action, agentReadiness, snapshot],
	},
	{
		id: 'monitor',
		href: ASI_BASE,
		navKey: 'asiMonitor',
		roleKey: 'roles.monitor',
		tools: [warRoom],
		extras: [visibilityTrend, visibilityAlert],
	},
] as const;

/** Unique tools in thinking-flow order. Never a flat 17-item list. */
export const ASI_FEATURES: readonly AsiToolDef[] = ASI_PILLARS.flatMap((pillar) => pillar.tools);

export function asiIaEntries(group: AsiPillarDef): AsiIaEntry[] {
	const fromTools = group.tools.map((tool) => ({
		id: tool.id,
		href: tool.href,
		toolId: tool.id,
		titleKey: tool.iaTitleKey ?? tool.titleKey,
	}));
	return group.id === 'monitor' ? [...(group.extras ?? []), ...fromTools] : [...fromTools, ...(group.extras ?? [])];
}

export function entryHash(href: string): string {
	const index = href.indexOf('#');
	return index >= 0 ? href.slice(index) : '';
}

export function isAsiIaEntryActive(entry: AsiIaEntry, pathname: string, hash = ''): boolean {
	const route = resolveAsiPathname(pathname);
	if (route.tool.id !== entry.toolId) return false;
	const want = entryHash(entry.href);
	const got = hash.startsWith('#') ? hash : hash ? `#${hash}` : '';
	if (want) return got === want;
	if (entry.toolId === 'visibility' && entry.id === 'visibility') {
		return got !== '#asi-trend' && got !== '#asi-alerts';
	}
	return true;
}

export function isAsiIaGroupActive(group: AsiPillarDef, pathname: string, hash = ''): boolean {
	return asiIaEntries(group).some((entry) => isAsiIaEntryActive(entry, pathname, hash));
}

const FEATURE_BY_SLUG = new Map<string, AsiToolDef>(ASI_FEATURES.map((tool) => [tool.slug, tool]));

/** STEP 03 nested paths and pillar hubs → canonical flat slug. */
const PATH_ALIASES: Record<string, AsiFeatureSlug> = {
	perception: 'brand-perception',
	'perception/brand': 'brand-perception',
	'perception/reputation': 'reputation-radar',
	'perception/snapshot': 'brand-snapshot',
	recommendation: 'recommendation-test',
	'recommendation/test': 'recommendation-test',
	'recommendation/simulator': 'recommendation-simulator',
	'recommendation/sov': 'share-of-voice',
	'recommendation/competitors': 'competitor-analysis',
	'recommendation/gap': 'competitor-gap',
	gap: 'competitor-gap',
	'recommendation/action': 'next-best-action',
	action: 'next-best-action',
	evidence: 'citation-explorer',
	'evidence/citations': 'citation-explorer',
	'evidence/explorer': 'evidence-explorer',
	explorer: 'evidence-explorer',
	'evidence/questions': 'query-generator',
	'evidence/visibility': 'visibility-monitor',
	future: 'agent-readiness',
	'future/agent-readiness': 'agent-readiness',
	opportunity: 'opportunity-finder',
	'war-room/opportunity': 'opportunity-finder',
};

const LEGACY_PILLAR_DEFAULTS: Record<string, AsiFeatureSlug> = {
	perception: 'brand-perception',
	recommendation: 'recommendation-test',
	evidence: 'citation-explorer',
	future: 'agent-readiness',
	'war-room': 'war-room',
};

export type AsiResolvedRoute = {
	pillar: AsiPillarDef;
	tool: AsiToolDef;
	/** Canonical path for this resolution. */
	href: string;
	/** Set when the requested slug should 308 to `href`. */
	redirectTo?: string;
};

export function getAsiPillar(id: AsiPillarId): AsiPillarDef {
	return ASI_PILLARS.find((pillar) => pillar.id === id) ?? ASI_PILLARS[0];
}

export function getAsiTool(id: AsiToolId): AsiToolDef {
	return ASI_FEATURES.find((tool) => tool.id === id) ?? ASI_FEATURES[0];
}

export function isAsiFeatureSlug(value: string | undefined): value is AsiFeatureSlug {
	return Boolean(value && FEATURE_BY_SLUG.has(value));
}

export function isIntelligencePath(pathname: string | null | undefined): boolean {
	const path = pathname || '';
	return path === ASI_BASE || path.startsWith(`${ASI_BASE}/`);
}

function pillarForTool(tool: AsiToolDef): AsiPillarDef {
	return ASI_PILLARS.find((pillar) => pillar.tools.some((item) => item.id === tool.id)) ?? ASI_PILLARS[0];
}

/**
 * `/intelligence` and `/intelligence/war-room` are the same tool (no extra hop
 * when already on either). Unknown paths → War Room. Nested aliases 308 to the
 * matching flat feature slug.
 */
export function resolveAsiRoute(slug?: readonly string[] | null): AsiResolvedRoute {
	const parts = (slug ?? []).map((part) => part.trim()).filter(Boolean);
	const requested = parts.length ? `${ASI_BASE}/${parts.join('/')}` : ASI_BASE;

	if (parts.length === 0) {
		return { pillar: getAsiPillar('monitor'), tool: warRoom, href: ASI_BASE };
	}

	const joined = parts.join('/');
	const feature = FEATURE_BY_SLUG.get(parts[0]);
	if (feature && parts.length === 1) {
		return {
			pillar: pillarForTool(feature),
			tool: feature,
			href: feature.href,
		};
	}

	const aliased = PATH_ALIASES[joined];
	if (aliased) {
		const tool = FEATURE_BY_SLUG.get(aliased) ?? warRoom;
		return {
			pillar: pillarForTool(tool),
			tool,
			href: tool.href,
			redirectTo: requested === tool.href ? undefined : tool.href,
		};
	}

	if (FEATURE_BY_SLUG.has(parts[0]) && parts.length > 1) {
		const tool = FEATURE_BY_SLUG.get(parts[0]) ?? warRoom;
		return {
			pillar: pillarForTool(tool),
			tool,
			href: tool.href,
			redirectTo: tool.href,
		};
	}

	const pillar = ASI_PILLARS.find((item) => item.id === parts[0]);
	if (pillar) {
		const tool =
			pillar.tools.find((item) => item.id === parts[1] || item.slug === parts[1]) ?? pillar.tools[0];
		return {
			pillar,
			tool,
			href: tool.href,
			redirectTo: requested === tool.href ? undefined : tool.href,
		};
	}

	const legacySlug = LEGACY_PILLAR_DEFAULTS[parts[0]];
	if (legacySlug) {
		const tool = FEATURE_BY_SLUG.get(legacySlug) ?? warRoom;
		return {
			pillar: pillarForTool(tool),
			tool,
			href: tool.href,
			redirectTo: requested === tool.href ? undefined : tool.href,
		};
	}

	return {
		pillar: getAsiPillar('monitor'),
		tool: warRoom,
		href: ASI_BASE,
		redirectTo: ASI_BASE,
	};
}

export function resolveAsiPathname(pathname: string | null | undefined): AsiResolvedRoute {
	const raw = (pathname || '').split('?')[0];
	const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw || ASI_BASE;
	if (!isIntelligencePath(path)) {
		return { pillar: getAsiPillar('monitor'), tool: warRoom, href: ASI_BASE };
	}
	if (path === ASI_BASE) {
		return { pillar: getAsiPillar('monitor'), tool: warRoom, href: ASI_BASE };
	}
	const parts = path.slice(ASI_BASE.length).split('/').filter(Boolean);
	return resolveAsiRoute(parts);
}

export function asiBreadcrumb(route: AsiResolvedRoute): Array<{ href: string; titleKey: string; current?: boolean }> {
	const crumbs: Array<{ href: string; titleKey: string; current?: boolean }> = [
		{ href: ASI_BASE, titleKey: 'productName' },
	];

	crumbs.push({ href: route.pillar.href, titleKey: `pillars.${route.pillar.id}` });

	crumbs.push({ href: route.tool.href, titleKey: route.tool.titleKey, current: true });
	return crumbs;
}
