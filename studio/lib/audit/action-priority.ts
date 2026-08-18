import { checklistDefForEngineId } from '@/lib/audit/checklistDefinitions';
import type { AuditCheckItem, AuditCheckStatus } from '@/lib/site-auditor';
import type { SchemaVertical } from '@/lib/audit/recommended-schemas';

/** Six-level remediation priority for B2B action plans. P0 is the HTTPS security gate. */
export type ActionPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type ActionDifficulty = 'easy' | 'medium' | 'hard';

export interface ActionPriorityMeta {
	priority: ActionPriority;
	/** Lower = more urgent within the same priority band. */
	rank: number;
	labelKey: 'emergency' | 'critical' | 'high' | 'geoMust' | 'eeat' | 'enhance';
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
	// P0 EMERGENCY — TLS / HTTPS security gate (Answer Center first card)
	https: { priority: 'P0', labelKey: 'emergency', difficulty: 'easy', geoHighlight: false, effectKey: 'https' },

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

	// P2 HIGH — brand entity / LocalBusiness · MedicalClinic · Organization NAP
	organization: { priority: 'P2', labelKey: 'high', difficulty: 'medium', geoHighlight: false, effectKey: 'organization' },
	'website-schema': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'websiteSchema',
	},

	// P3 GEO-MUST — FAQPage is the conversational citation unit (not Article/NewsArticle)
	'faq-howto-schema': {
		priority: 'P3',
		labelKey: 'geoMust',
		difficulty: 'medium',
		geoHighlight: true,
		effectKey: 'faqHowto',
	},
	'article-fields': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
		effectKey: 'pageSchema',
	},
	'news-article': {
		priority: 'P5',
		labelKey: 'enhance',
		difficulty: 'medium',
		geoHighlight: false,
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
	'llms-txt': {
		priority: 'P1',
		labelKey: 'geoMust',
		difficulty: 'easy',
		geoHighlight: true,
		effectKey: 'llmsTxt',
	},
};

const PRIORITY_ORDER: Record<ActionPriority, number> = {
	P0: 0,
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

export interface ActionPriorityOptions {
	/** Press/media only — Article/NewsArticle stay GEO-MUST. */
	newsVertical?: boolean;
	vertical?: SchemaVertical;
}

function applyVerticalOverride(
	checkId: string,
	mapped: Omit<ActionPriorityMeta, 'rank'>,
	options?: ActionPriorityOptions,
): Omit<ActionPriorityMeta, 'rank'> {
	const news = options?.newsVertical === true || options?.vertical === 'news';
	if (!news) return mapped;
	if (checkId === 'article-fields') {
		return {
			priority: 'P3',
			labelKey: 'geoMust',
			difficulty: 'medium',
			geoHighlight: true,
			effectKey: 'article',
		};
	}
	if (checkId === 'news-article') {
		return {
			priority: 'P3',
			labelKey: 'geoMust',
			difficulty: 'medium',
			geoHighlight: true,
			effectKey: 'newsArticle',
		};
	}
	return mapped;
}

export function getActionPriorityMeta(
	check: AuditCheckItem,
	options?: ActionPriorityOptions,
): ActionPriorityMeta {
	const mapped = CHECK_PRIORITY[check.id];
	const definedLevel = checklistDefForEngineId(check.id)?.pLevel;
	if (mapped) {
		const withLevel = definedLevel ? { ...mapped, priority: definedLevel } : mapped;
		const resolved = applyVerticalOverride(check.id, withLevel, options);
		return { ...resolved, rank: PRIORITY_ORDER[resolved.priority] };
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
export function buildPrioritizedActions(
	checks: AuditCheckItem[],
	options?: ActionPriorityOptions,
): PrioritizedActionItem[] {
	return checks
		.filter((c) => resolveStatus(c) !== 'pass')
		.map((c) => {
			const meta = getActionPriorityMeta(c, options);
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
	P0: 'box-border border border-rose-300/70 bg-rose-700 text-white',
	P1: 'box-border border border-rose-300/40 bg-rose-500 text-white',
	P2: 'box-border border border-orange-300/40 bg-orange-500 text-white',
	P3: 'box-border border border-indigo-300/50 bg-indigo-500 text-white',
	P4: 'box-border border border-sky-300/40 bg-sky-500 text-white',
	P5: 'box-border border border-slate-300/30 bg-slate-500 text-white',
};

/** Header count chips — 1px border, no ring, so the first badge is not clipped. */
export const PRIORITY_COUNT_BADGE_STYLES: Record<ActionPriority, string> = {
	P0: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60',
	P1: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/60',
	P2: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/60',
	P3: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
	P4: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
	P5: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};
