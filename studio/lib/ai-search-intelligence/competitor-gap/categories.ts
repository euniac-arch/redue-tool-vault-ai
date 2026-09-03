/**
 * Nine gap kinds. A row is emitted only when observed data shows the competitor ahead.
 * Audit-only kinds (content / entity / local) require a bound audit signal.
 */
import type { IntelligenceActionCategory } from '@/lib/ai-search-intelligence/core/models';
import type {
	AsiAuditSignalId,
	AsiCompetitorGapKind,
	AsiCompetitorGapMetric,
	AsiCompetitorGapRow,
} from '@/lib/ai-search-intelligence/types';
import { ASI_COMPETITOR_GAP_KINDS } from '@/lib/ai-search-intelligence/types';
import type { CompetitorQueryRates } from '@/lib/ai-search-intelligence/competitor-gap/rates';
import type { AsiEvidenceEntityCompare, AsiEvidenceSourceRow } from '@/lib/ai-search-intelligence/types';

const AUTHORITY_TYPES = new Set(['official', 'news', 'review']);

function clamp(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function pct(value: number): number {
	return clamp(value * 100);
}

const ACTION: Record<AsiCompetitorGapKind, { category: IntelligenceActionCategory; action: string; why: string }> = {
	visibility: {
		category: 'entity',
		action: '경쟁사가 언급되는 질문에서 브랜드 엔티티를 분명히 하세요.',
		why: '같은 질문에서 경쟁사 언급이 더 많습니다.',
	},
	recommendation: {
		category: 'faq',
		action: '추천 의도에 맞는 FAQ·비교 콘텐츠를 보강하세요.',
		why: 'AI가 경쟁사를 더 자주 추천합니다.',
	},
	citation: {
		category: 'citation',
		action: '인용될 공식 페이지와 출처를 확보하세요.',
		why: '경쟁사 관련 Citation이 더 많습니다.',
	},
	evidence: {
		category: 'citation',
		action: 'Evidence Explorer에서 부족한 출처를 채우세요.',
		why: '경쟁사 Evidence(관련 페이지·외부 출처)가 더 두껍습니다.',
	},
	content: {
		category: 'content',
		action: '관련 콘텐츠 coverage를 높이세요.',
		why: '사이트 콘텐츠 신호가 약하고 경쟁사 페이지가 더 보입니다.',
	},
	entity: {
		category: 'entity',
		action: '브랜드 Entity 정합을 맞추세요.',
		why: '엔티티 신호가 약해 경쟁사가 먼저 연결됩니다.',
	},
	local: {
		category: 'local',
		action: '지역 NAP·로컬 엔티티를 보강하세요.',
		why: '지역 질문에서 경쟁사 신호가 더 강합니다.',
	},
	authority: {
		category: 'citation',
		action: '뉴스·공식 등 권위 있는 출처를 확보하세요.',
		why: '권위 있는 Citation이 경쟁사 쪽에 더 많습니다.',
	},
	coverage: {
		category: 'query',
		action: '경쟁사가 보이는 질문을 Opportunity Finder에서 공략하세요.',
		why: '더 많은 질문에서 경쟁사가 관측됩니다.',
	},
};

function row(input: {
	kind: AsiCompetitorGapKind;
	competitor: string;
	query?: string;
	brandValue: number;
	competitorValue: number;
	gap: number;
	unit: 'percent' | 'count';
	evidence: string[];
	impact: number;
}): AsiCompetitorGapRow {
	const copy = ACTION[input.kind];
	return {
		id: `${input.kind}::${input.competitor}::${input.query || 'all'}`,
		kind: input.kind,
		competitor: input.competitor,
		query: input.query,
		brandValue: input.brandValue,
		competitorValue: input.competitorValue,
		gap: input.gap,
		unit: input.unit,
		why: copy.why,
		evidence: input.evidence,
		impact: input.impact,
		recommendedAction: copy.action,
		actionCategory: copy.category,
		available: true,
	};
}

type GapAggregate = {
	mentionBrand: number;
	mentionThem: number;
	recBrand: number;
	recThem: number;
	citeBrand: number;
	citeThem: number;
	evidenceBrand: number;
	evidenceThem: number;
	authorityBrand: number;
	authorityThem: number;
	coveredBrand: number;
	coveredThem: number;
	localBrand: number;
	localThem: number;
	hasLocal: boolean;
	citeEvidence: string[];
};

function aggregateGapSignals(input: {
	competitor: string;
	rates: readonly CompetitorQueryRates[];
	brand: AsiEvidenceEntityCompare;
	them: AsiEvidenceEntityCompare;
	sources: readonly AsiEvidenceSourceRow[];
	location?: string;
}): GapAggregate {
	const mentionBrand = input.rates.reduce((sum, item) => sum + item.brandMention, 0) / input.rates.length;
	const mentionThem = input.rates.reduce((sum, item) => sum + item.competitorMention, 0) / input.rates.length;
	const recBrand = input.rates.reduce((sum, item) => sum + item.brandRecommend, 0) / input.rates.length;
	const recThem = input.rates.reduce((sum, item) => sum + item.competitorRecommend, 0) / input.rates.length;
	const localRates = input.location
		? input.rates.filter((item) => item.query.toLowerCase().includes(input.location!.toLowerCase()))
		: [];
	return {
		mentionBrand,
		mentionThem,
		recBrand,
		recThem,
		citeBrand: input.brand.citations,
		citeThem: input.them.citations,
		evidenceBrand: input.brand.relevantPages + input.brand.externalSources,
		evidenceThem: input.them.relevantPages + input.them.externalSources,
		authorityBrand: input.sources.filter((item) => item.relatedTo === 'brand' && AUTHORITY_TYPES.has(item.sourceType)).length,
		authorityThem: input.sources.filter(
			(item) => item.entity?.toLowerCase() === input.competitor.toLowerCase() && AUTHORITY_TYPES.has(item.sourceType),
		).length,
		coveredBrand: input.rates.filter((item) => item.brandMention > 0).length / input.rates.length,
		coveredThem: input.rates.filter((item) => item.competitorMention > 0).length / input.rates.length,
		localBrand: localRates.length ? localRates.reduce((sum, item) => sum + item.brandMention, 0) / localRates.length : mentionBrand,
		localThem: localRates.length ? localRates.reduce((sum, item) => sum + item.competitorMention, 0) / localRates.length : mentionThem,
		hasLocal: localRates.length > 0,
		citeEvidence: input.sources
			.filter((item) => item.entity?.toLowerCase() === input.competitor.toLowerCase() || item.relatedTo === 'competitor')
			.map((item) => item.url),
	};
}

function metricOf(
	kind: AsiCompetitorGapKind,
	brand: number,
	competitor: number,
	unit: 'percent' | 'count',
	available = true,
): AsiCompetitorGapMetric {
	return { kind, brand, competitor, gap: competitor - brand, unit, available };
}

/** Always compute the 9 observed/derived gaps. Positive gap = competitor ahead. */
export function computeNineGapMetrics(input: {
	competitor: string;
	rates: readonly CompetitorQueryRates[];
	brand: AsiEvidenceEntityCompare;
	them: AsiEvidenceEntityCompare;
	sources: readonly AsiEvidenceSourceRow[];
	location?: string;
}): AsiCompetitorGapMetric[] {
	if (!input.rates.length) {
		return ASI_COMPETITOR_GAP_KINDS.map((kind) =>
			metricOf(kind, 0, 0, kind === 'citation' || kind === 'evidence' || kind === 'content' || kind === 'authority' ? 'count' : 'percent', false),
		);
	}
	const agg = aggregateGapSignals(input);
	return ASI_COMPETITOR_GAP_KINDS.map((kind) => {
		if (kind === 'visibility') return metricOf(kind, pct(agg.mentionBrand), pct(agg.mentionThem), 'percent');
		if (kind === 'recommendation') return metricOf(kind, pct(agg.recBrand), pct(agg.recThem), 'percent');
		if (kind === 'citation') return metricOf(kind, agg.citeBrand, agg.citeThem, 'count');
		if (kind === 'evidence') return metricOf(kind, agg.evidenceBrand, agg.evidenceThem, 'count');
		if (kind === 'content') return metricOf(kind, input.brand.relevantPages, input.them.relevantPages, 'count');
		if (kind === 'entity') return metricOf(kind, pct(agg.mentionBrand), pct(agg.mentionThem), 'percent');
		if (kind === 'local') return metricOf(kind, pct(agg.localBrand), pct(agg.localThem), 'percent', agg.hasLocal);
		if (kind === 'authority') return metricOf(kind, agg.authorityBrand, agg.authorityThem, 'count');
		return metricOf(kind, pct(agg.coveredBrand), pct(agg.coveredThem), 'percent');
	});
}

export function deriveCompetitorGapRows(input: {
	competitor: string;
	rates: readonly CompetitorQueryRates[];
	brand: AsiEvidenceEntityCompare;
	them: AsiEvidenceEntityCompare;
	sources: readonly AsiEvidenceSourceRow[];
	gaps: readonly AsiAuditSignalId[];
	boundFromAudit: boolean;
	location?: string;
}): AsiCompetitorGapRow[] {
	if (!input.rates.length) return [];
	const out: AsiCompetitorGapRow[] = [];
	const mentionBrand = input.rates.reduce((sum, item) => sum + item.brandMention, 0) / input.rates.length;
	const mentionThem = input.rates.reduce((sum, item) => sum + item.competitorMention, 0) / input.rates.length;
	const recBrand = input.rates.reduce((sum, item) => sum + item.brandRecommend, 0) / input.rates.length;
	const recThem = input.rates.reduce((sum, item) => sum + item.competitorRecommend, 0) / input.rates.length;
	const citeBrand = input.brand.citations;
	const citeThem = input.them.citations;
	const evidenceBrand = input.brand.relevantPages + input.brand.externalSources;
	const evidenceThem = input.them.relevantPages + input.them.externalSources;
	const authorityBrand = input.sources.filter((item) => item.relatedTo === 'brand' && AUTHORITY_TYPES.has(item.sourceType)).length;
	const authorityThem = input.sources.filter(
		(item) => item.entity?.toLowerCase() === input.competitor.toLowerCase() && AUTHORITY_TYPES.has(item.sourceType),
	).length;
	const coveredBrand = input.rates.filter((item) => item.brandMention > 0).length / input.rates.length;
	const coveredThem = input.rates.filter((item) => item.competitorMention > 0).length / input.rates.length;
	const localRates = input.location
		? input.rates.filter((item) => item.query.toLowerCase().includes(input.location!.toLowerCase()))
		: [];
	const citeEvidence = input.sources
		.filter((item) => item.entity?.toLowerCase() === input.competitor.toLowerCase() || item.relatedTo === 'competitor')
		.map((item) => item.url);

	if (mentionThem > mentionBrand) {
		out.push(
			row({
				kind: 'visibility',
				competitor: input.competitor,
				brandValue: pct(mentionBrand),
				competitorValue: pct(mentionThem),
				gap: pct(mentionThem) - pct(mentionBrand),
				unit: 'percent',
				evidence: citeEvidence.slice(0, 3),
				impact: clamp((mentionThem - mentionBrand) * 100),
			}),
		);
	}
	if (recThem > recBrand) {
		out.push(
			row({
				kind: 'recommendation',
				competitor: input.competitor,
				brandValue: pct(recBrand),
				competitorValue: pct(recThem),
				gap: pct(recThem) - pct(recBrand),
				unit: 'percent',
				evidence: citeEvidence.slice(0, 3),
				impact: clamp((recThem - recBrand) * 120),
			}),
		);
	}
	if (citeThem > citeBrand && (citeThem > 0 || citeBrand > 0)) {
		out.push(
			row({
				kind: 'citation',
				competitor: input.competitor,
				brandValue: citeBrand,
				competitorValue: citeThem,
				gap: citeThem - citeBrand,
				unit: 'count',
				evidence: citeEvidence.slice(0, 5),
				impact: clamp((citeThem - citeBrand) * 12),
			}),
		);
	}
	if (evidenceThem > evidenceBrand && evidenceThem > 0) {
		out.push(
			row({
				kind: 'evidence',
				competitor: input.competitor,
				brandValue: evidenceBrand,
				competitorValue: evidenceThem,
				gap: evidenceThem - evidenceBrand,
				unit: 'count',
				evidence: citeEvidence.slice(0, 5),
				impact: clamp((evidenceThem - evidenceBrand) * 10),
			}),
		);
	}
	if (input.boundFromAudit && input.gaps.includes('content') && (citeThem > citeBrand || evidenceThem > evidenceBrand)) {
		out.push(
			row({
				kind: 'content',
				competitor: input.competitor,
				brandValue: input.brand.relevantPages,
				competitorValue: input.them.relevantPages,
				gap: Math.max(1, input.them.relevantPages - input.brand.relevantPages),
				unit: 'count',
				evidence: citeEvidence.slice(0, 3),
				impact: 64,
			}),
		);
	}
	if (input.boundFromAudit && input.gaps.includes('entity') && mentionThem > mentionBrand) {
		out.push(
			row({
				kind: 'entity',
				competitor: input.competitor,
				brandValue: pct(mentionBrand),
				competitorValue: pct(mentionThem),
				gap: pct(mentionThem) - pct(mentionBrand),
				unit: 'percent',
				evidence: [],
				impact: 70,
			}),
		);
	}
	if (localRates.length && input.location) {
		const localBrand = localRates.reduce((sum, item) => sum + item.brandMention, 0) / localRates.length;
		const localThem = localRates.reduce((sum, item) => sum + item.competitorMention, 0) / localRates.length;
		if (localThem > localBrand && (input.boundFromAudit ? input.gaps.includes('local') : true)) {
			out.push(
				row({
					kind: 'local',
					competitor: input.competitor,
					query: localRates[0]?.query,
					brandValue: pct(localBrand),
					competitorValue: pct(localThem),
					gap: pct(localThem) - pct(localBrand),
					unit: 'percent',
					evidence: [],
					impact: clamp((localThem - localBrand) * 110),
				}),
			);
		}
	} else if (input.boundFromAudit && input.gaps.includes('local') && mentionThem > mentionBrand) {
		out.push(
			row({
				kind: 'local',
				competitor: input.competitor,
				brandValue: pct(mentionBrand),
				competitorValue: pct(mentionThem),
				gap: pct(mentionThem) - pct(mentionBrand),
				unit: 'percent',
				evidence: [],
				impact: 58,
			}),
		);
	}
	if (authorityThem > authorityBrand && authorityThem > 0) {
		out.push(
			row({
				kind: 'authority',
				competitor: input.competitor,
				brandValue: authorityBrand,
				competitorValue: authorityThem,
				gap: authorityThem - authorityBrand,
				unit: 'count',
				evidence: input.sources
					.filter((item) => item.entity?.toLowerCase() === input.competitor.toLowerCase() && AUTHORITY_TYPES.has(item.sourceType))
					.map((item) => item.url)
					.slice(0, 5),
				impact: clamp((authorityThem - authorityBrand) * 14),
			}),
		);
	}
	if (input.rates.length >= 2 && coveredThem > coveredBrand) {
		out.push(
			row({
				kind: 'coverage',
				competitor: input.competitor,
				brandValue: pct(coveredBrand),
				competitorValue: pct(coveredThem),
				gap: pct(coveredThem) - pct(coveredBrand),
				unit: 'percent',
				evidence: input.rates.filter((item) => item.competitorMention > 0 && item.brandMention === 0).map((item) => item.query).slice(0, 5),
				impact: clamp((coveredThem - coveredBrand) * 90),
			}),
		);
	}

	return out;
}
