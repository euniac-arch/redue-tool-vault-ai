import type { AuditCheckItem, AuditCheckStatus } from '@/lib/site-auditor';

/** Five-level remediation priority for B2B action plans. */
export type ActionPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type ActionDifficulty = 'easy' | 'medium' | 'hard';

export interface ActionPriorityMeta {
	priority: ActionPriority;
	/** Lower = more urgent within the same priority band. */
	rank: number;
	labelKey: 'critical' | 'high' | 'geoMust' | 'eeat' | 'enhance';
	difficulty: ActionDifficulty;
	/** Highlight GEO-MUST rows for AI-search CRO. */
	geoHighlight: boolean;
	/** i18n key under audit.b2b.effects.* */
	effectKey: string;
}

/**
 * Check-id → P1–P5 mapping aligned with the B2B remediation guide.
 * Unlisted ids fall back by status (fail→P2, warning→P5).
 */
const CHECK_PRIORITY: Record<string, Omit<ActionPriorityMeta, 'rank'>> = {
	// P1 CRITICAL — indexing blockers
	title: { priority: 'P1', labelKey: 'critical', difficulty: 'easy', geoHighlight: false, effectKey: 'title' },
	'meta-description': {
		priority: 'P1',
		labelKey: 'critical',
		difficulty: 'easy',
		geoHighlight: false,
		effectKey: 'metaDescription',
	},
	'single-h1': { priority: 'P1', labelKey: 'critical', difficulty: 'medium', geoHighlight: false, effectKey: 'singleH1' },
	'jsonld-present': {
		priority: 'P1',
		labelKey: 'critical',
		difficulty: 'hard',
		geoHighlight: false,
		effectKey: 'jsonld',
	},
	canonical: { priority: 'P1', labelKey: 'critical', difficulty: 'easy', geoHighlight: false, effectKey: 'canonical' },

	// P2 HIGH — brand entity / site structure
	organization: { priority: 'P2', labelKey: 'high', difficulty: 'medium', geoHighlight: false, effectKey: 'organization' },
	'website-schema': {
		priority: 'P2',
		labelKey: 'high',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'websiteSchema',
	},

	// P3 GEO-MUST — AI citation / rich-result schemas
	'faq-howto-schema': {
		priority: 'P3',
		labelKey: 'geoMust',
		difficulty: 'medium',
		geoHighlight: true,
		effectKey: 'faqHowto',
	},
	'article-fields': {
		priority: 'P3',
		labelKey: 'geoMust',
		difficulty: 'medium',
		geoHighlight: true,
		effectKey: 'article',
	},
	'news-article': {
		priority: 'P3',
		labelKey: 'geoMust',
		difficulty: 'medium',
		geoHighlight: true,
		effectKey: 'newsArticle',
	},
	'ai-bots-allowed': {
		priority: 'P3',
		labelKey: 'geoMust',
		difficulty: 'easy',
		geoHighlight: true,
		effectKey: 'aiBots',
	},

	// P4 E-E-A-T — author / publisher graph
	'person-eeat': { priority: 'P4', labelKey: 'eeat', difficulty: 'hard', geoHighlight: false, effectKey: 'person' },
	'eeat-author': { priority: 'P4', labelKey: 'eeat', difficulty: 'hard', geoHighlight: false, effectKey: 'eeat' },

	// P5 ENHANCE — accessibility & polish
	'image-alt': { priority: 'P5', labelKey: 'enhance', difficulty: 'easy', geoHighlight: false, effectKey: 'imageAlt' },
	'html-lang': { priority: 'P5', labelKey: 'enhance', difficulty: 'easy', geoHighlight: false, effectKey: 'htmlLang' },
	'heading-structure': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'headingStructure',
	},
	'heading-skip': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'headingSkip',
	},
	'og-tags': { priority: 'P5', labelKey: 'enhance', difficulty: 'easy', geoHighlight: false, effectKey: 'ogTags' },
	'response-time': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'hard',
		geoHighlight: false,
		effectKey: 'responseTime',
	},
	'page-weight': { priority: 'P5', labelKey: 'enhance', difficulty: 'medium', geoHighlight: false, effectKey: 'pageWeight' },
	'render-blocking': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'renderBlocking',
	},
	'crawlable-text': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'crawlableText',
	},
};

const PRIORITY_ORDER: Record<ActionPriority, number> = {
	P1: 1,
	P2: 2,
	P3: 3,
	P4: 4,
	P5: 5,
};

const DIFFICULTY_ORDER: Record<ActionDifficulty, number> = {
	easy: 0,
	medium: 1,
	hard: 2,
};

function resolveStatus(check: AuditCheckItem): AuditCheckStatus {
	return check.status ?? (check.passed ? 'pass' : 'fail');
}

export function getActionPriorityMeta(check: AuditCheckItem): ActionPriorityMeta {
	const mapped = CHECK_PRIORITY[check.id];
	if (mapped) {
		return { ...mapped, rank: PRIORITY_ORDER[mapped.priority] };
	}

	const status = resolveStatus(check);
	const priority: ActionPriority = status === 'fail' ? 'P2' : 'P5';
	return {
		priority,
		rank: PRIORITY_ORDER[priority],
		labelKey: priority === 'P2' ? 'high' : 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'generic',
	};
}

export interface PrioritizedActionItem {
	id: string;
	label: string;
	evidence?: string;
	why?: string;
	impact?: string;
	weight: number;
	status: AuditCheckStatus;
	priority: ActionPriority;
	labelKey: ActionPriorityMeta['labelKey'];
	difficulty: ActionDifficulty;
	geoHighlight: boolean;
	effectKey: string;
}

/**
 * Failed/warning checks sorted P1→P5, then easier fixes first, then higher weight.
 */
export function buildPrioritizedActions(checks: AuditCheckItem[]): PrioritizedActionItem[] {
	return checks
		.filter((c) => resolveStatus(c) !== 'pass')
		.map((c) => {
			const meta = getActionPriorityMeta(c);
			return {
				id: c.id,
				label: c.label,
				evidence: c.evidence,
				why: c.why,
				impact: c.impact,
				weight: c.weight,
				status: resolveStatus(c),
				priority: meta.priority,
				labelKey: meta.labelKey,
				difficulty: meta.difficulty,
				geoHighlight: meta.geoHighlight,
				effectKey: meta.effectKey,
			};
		})
		.sort((a, b) => {
			if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
			if (a.difficulty !== b.difficulty) return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
			return b.weight - a.weight;
		});
}

export const PRIORITY_BADGE_STYLES: Record<ActionPriority, string> = {
	P1: 'bg-rose-500 text-white ring-1 ring-rose-300/40',
	P2: 'bg-orange-500 text-white ring-1 ring-orange-300/40',
	P3: 'bg-indigo-500 text-white ring-1 ring-indigo-300/50',
	P4: 'bg-sky-500 text-white ring-1 ring-sky-300/40',
	P5: 'bg-slate-500 text-white ring-1 ring-slate-300/30',
};
