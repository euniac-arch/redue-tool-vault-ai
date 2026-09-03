import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { derivedOf } from '@/lib/ai-search-intelligence/core/models';
import type { Opportunity, Query } from '@/lib/ai-search-intelligence/core/models';
import { classifyOpportunityStatus } from '@/lib/ai-search-intelligence/opportunity/classify';
import {
	isOpportunityCandidate,
	opportunityReason,
	opportunityScoreFromSignals,
	scoreOpportunitySignals,
} from '@/lib/ai-search-intelligence/opportunity/score';
import type { AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type {
	AIResponse,
	AsiOpportunityEngineRow,
	AsiOpportunityRow,
	AsiOpportunitySnapshot,
	AsiSource,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';
import type { AsiAuditBind } from '@/lib/ai-search-intelligence/types';

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function opportunityFromRow(row: AsiOpportunityRow): Opportunity {
	return {
		query: row.query,
		priority: derivedOf(row.priority),
		reason: row.reason,
		competitor: row.competitor,
		missingSignals: row.missingSignals,
		estimatedImpact: derivedOf(row.score),
		recommendedAction: row.status === 'miss' ? '추천·인용 콘텐츠를 보강하세요' : '경쟁 쿼리에서 1순위 근거를 확보하세요',
	};
}

export function analyzeOpportunityRow(input: {
	query: Query;
	responses: readonly AIResponse[];
	brand: string;
	aliases?: readonly string[];
	gaps: readonly AsiAuditSignalId[];
	location?: string;
	service?: string;
}): AsiOpportunityRow {
	const usable = input.responses.filter((item) => !item.meta?.error);
	const engines: AsiOpportunityEngineRow[] = input.responses.map((response) => {
		const analysis = analyzeAsiAnswer(response, {
			brand: input.brand,
			aliases: input.aliases,
			category: input.service,
			industry: input.service,
			services: input.service ? [input.service] : [],
		});
		return {
			engine: response.provider,
			mentioned: analysis.brandMentioned,
			recommended: analysis.recommended,
			answer: response.answer || response.meta?.error || '',
			source: response.source,
			fallback: response.meta?.fallback,
			error: response.meta?.error,
			citations: analysis.citations,
		};
	});
	const sample = Math.max(1, usable.length || engines.length);
	const mentioned = engines.filter((row) => row.mentioned).length;
	const recommended = engines.filter((row) => row.recommended).length;
	const mentionRate = mentioned / sample;
	const recommendationRate = recommended / sample;
	const competitors = unique(
		input.responses.flatMap((response) =>
			analyzeAsiAnswer(response, {
				brand: input.brand,
				aliases: input.aliases,
				category: input.service,
				industry: input.service,
				services: input.service ? [input.service] : [],
			}).competitors,
		),
	);
	const citations = unique(engines.flatMap((row) => row.citations));
	const ownedCitation = citations.some((url) => url.includes(input.brand.toLowerCase()) || engines.some((row) => row.citations.includes(url) && row.mentioned));
	const status = classifyOpportunityStatus({
		mentionRate,
		recommendationRate,
		competitorCount: competitors.length,
	});
	const signals = scoreOpportunitySignals({
		intent: input.query.intent,
		query: input.query.text,
		location: input.location,
		service: input.service,
		status,
		mentionRate,
		recommendationRate,
		competitorCount: competitors.length,
		citationCount: citations.length,
		ownedCitation,
		gaps: input.gaps,
	});
	const score = opportunityScoreFromSignals(signals);
	return {
		queryId: input.query.id,
		query: input.query.text,
		intent: input.query.intent,
		category: input.query.category,
		priority: input.query.priority.value,
		status,
		isOpportunity: isOpportunityCandidate(status, score),
		score,
		reason: opportunityReason({
			status,
			intent: input.query.intent,
			competitor: competitors[0],
			gaps: input.gaps,
		}),
		competitor: competitors[0],
		missingSignals: [...input.gaps],
		mentionRate,
		recommendationRate,
		brandMentioned: mentioned > 0,
		brandRecommended: recommended > 0,
		citations,
		competitors,
		engines,
		signals,
	};
}

export function buildOpportunitySnapshot(input: {
	site: AsiWarRoomSite;
	rows: AsiOpportunityRow[];
	source: AsiSource;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
}): AsiOpportunitySnapshot {
	const rows = [...input.rows].sort((a, b) => b.score - a.score || a.query.localeCompare(b.query));
	const win = rows.filter((row) => row.status === 'win').length;
	const compete = rows.filter((row) => row.status === 'compete').length;
	const miss = rows.filter((row) => row.status === 'miss').length;
	const opportunity = rows.filter((row) => row.isOpportunity).length;
	return {
		source: input.source,
		analyzedAt: new Date().toISOString(),
		boundFromAudit: input.boundFromAudit,
		auditBind: input.auditBind,
		site: input.site,
		summary: {
			total: rows.length,
			win,
			compete,
			miss,
			opportunity,
		},
		rows,
		top: rows.filter((row) => row.isOpportunity).slice(0, 5),
	};
}
