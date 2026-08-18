/**
 * Dynamic GEO diagnosis copy — combines on-page defect count with the
 * external-reputation score so the summary never claims "schema is solid"
 * while the checklist still has open defects.
 */

import type { AuditLang } from '@/lib/site-auditor';

/** Matches the GEO minimum-exposure threshold (70). */
export const REPUTATION_GOOD_THRESHOLD = 70;

export type ReputationInsightKind =
	| 'httpsCritical'
	| 'schemaGoodReputationWeak'
	| 'bothWeak'
	| 'schemaWeakReputationGood'
	| 'bothGood';

export interface ReputationInsightOptions {
	/** `false` replaces the diagnosis with the HTTPS security-critical sentence. */
	isHttps?: boolean;
}

export interface ReputationInsightLines {
	/** [진단 현황] — first line of the combined diagnosis. */
	status: string;
	/** [행동 촉구] — second line of the combined diagnosis. */
	action: string;
}

export interface ReputationInsight extends ReputationInsightLines {
	kind: ReputationInsightKind;
	/** Single-line join of status + action for emails, PDF summaries, and tests. */
	message: string;
	defectCount: number;
	reputationScore: number;
	isSchemaGood: boolean;
	isReputationGood: boolean;
}

function clampCount(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.round(n));
}

function clampScore(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

export function resolveReputationFlags(defectCount: number, reputationScore: number): {
	isSchemaGood: boolean;
	isReputationGood: boolean;
	kind: ReputationInsightKind;
	defectCount: number;
	reputationScore: number;
} {
	const defects = clampCount(defectCount);
	const score = clampScore(reputationScore);
	const isSchemaGood = defects === 0;
	const isReputationGood = score >= REPUTATION_GOOD_THRESHOLD;
	const kind: ReputationInsightKind = isSchemaGood
		? isReputationGood
			? 'bothGood'
			: 'schemaGoodReputationWeak'
		: isReputationGood
			? 'schemaWeakReputationGood'
			: 'bothWeak';
	return { isSchemaGood, isReputationGood, kind, defectCount: defects, reputationScore: score };
}

function insightLines(
	kind: ReputationInsightKind,
	defectCount: number,
	reputationScore: number,
	lang: AuditLang,
): ReputationInsightLines {
	if (kind === 'httpsCritical') {
		return lang === 'en'
			? {
					status: `[Critical] Missing HTTPS severely limits AI-engine citation trust, and fixing ${defectCount} on-page defects is urgent.`,
					action: '',
				}
			: {
					status: `[치명적] HTTPS 보안 프로토콜 미적용으로 인해 AI 엔진 인용 신뢰도가 심각하게 제한되어 있으며, 온페이지 결함(${defectCount}건) 개선이 시급합니다.`,
					action: '',
				};
	}

	if (lang === 'en') {
		switch (kind) {
			case 'schemaGoodReputationWeak':
				return {
					status: 'On-page schema is stable,',
					action: 'but external reputation and citation data need reinforcement.',
				};
			case 'bothWeak':
				return {
					status: `On-page defects (${defectCount}) and external trust (${reputationScore}) are both weak —`,
					action: 'comprehensive GEO optimization is urgent.',
				};
			case 'schemaWeakReputationGood':
				return {
					status: `External reputation is strong, but on-page defects (${defectCount}) are causing`,
					action: 'AI top-citation loss.',
				};
			case 'bothGood':
				return {
					status: 'On-page and external reputation signals both',
					action: 'stably meet the optimization baseline.',
				};
		}
	}

	switch (kind) {
		case 'schemaGoodReputationWeak':
			return {
				status: '온페이지 스키마는 안정적이나,',
				action: '외부 평판 및 인용 데이터 보강이 필요합니다.',
			};
		case 'bothWeak':
			return {
				status: `온페이지 결함(${defectCount}건)과 외부 신뢰도(${reputationScore}점) 모두 미흡하여`,
				action: '종합적인 GEO 최적화가 시급합니다.',
			};
		case 'schemaWeakReputationGood':
			return {
				status: `외부 평판은 우수하나, 온페이지 결함(${defectCount}건)으로 인해`,
				action: 'AI 상단 인용 손실이 발생하고 있습니다.',
			};
		case 'bothGood':
			return {
				status: '온페이지 및 외부 평판 신호가 모두',
				action: '최적화 기준을 안정적으로 충족하고 있습니다.',
			};
	}
}

function insightMessage(
	kind: ReputationInsightKind,
	defectCount: number,
	reputationScore: number,
	lang: AuditLang,
): string {
	const { status, action } = insightLines(kind, defectCount, reputationScore, lang);
	return action ? `${status} ${action}` : status;
}

/** Full insight object for UI tone + chips. */
export function resolveReputationInsight(
	defectCount: number,
	reputationScore: number,
	lang: AuditLang = 'ko',
	options?: ReputationInsightOptions,
): ReputationInsight {
	const flags = resolveReputationFlags(defectCount, reputationScore);
	const kind: ReputationInsightKind = options?.isHttps === false ? 'httpsCritical' : flags.kind;
	const lines = insightLines(kind, flags.defectCount, flags.reputationScore, lang);
	return {
		...flags,
		...lines,
		kind,
		message: insightMessage(kind, flags.defectCount, flags.reputationScore, lang),
	};
}

/**
 * Dynamic diagnosis sentence from on-page defects + external trust score.
 * `isSchemaGood` is true only when there are zero open defects — never inferred
 * from schema-coverage % alone.
 */
export function getReputationInsight(
	defectCount: number,
	reputationScore: number,
	lang: AuditLang = 'ko',
	options?: ReputationInsightOptions,
): string {
	return resolveReputationInsight(defectCount, reputationScore, lang, options).message;
}
