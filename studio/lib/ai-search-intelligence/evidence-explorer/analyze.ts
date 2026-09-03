import { compareEvidenceEntities, collectEvidenceSources } from '@/lib/ai-search-intelligence/evidence-explorer/compare';
import { buildEvidenceAnswerTrace } from '@/lib/ai-search-intelligence/evidence-explorer/trace';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { isUsableAsiResponse } from '@/lib/ai-search-intelligence/sov/extract';
import type { AsiAuditBind, AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type {
	AIResponse,
	AsiEvidenceExplorerSnapshot,
	AsiSource,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

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

export function buildEvidenceExplorerSnapshot(input: {
	site: AsiWarRoomSite;
	responses: readonly AIResponse[];
	source: AsiSource;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	gaps: readonly AsiAuditSignalId[];
	aliases?: readonly string[];
}): AsiEvidenceExplorerSnapshot {
	const answers = input.responses.map((response) =>
		buildEvidenceAnswerTrace({
			response,
			brand: input.site.brandName,
			siteUrl: input.site.url,
			aliases: input.aliases,
			location: input.site.location,
			gaps: input.gaps,
		}),
	);
	const competitors = unique(answers.flatMap((item) => item.competitors));
	const sources = collectEvidenceSources({
		responses: input.responses,
		siteUrl: input.site.url,
		brand: input.site.brandName,
		competitors,
	});
	const compared = compareEvidenceEntities({
		brand: input.site.brandName,
		competitors,
		siteUrl: input.site.url,
		sources,
		answers,
	});
	const withEvidence = answers.filter((item) => item.evidenceAvailable).length;
	const validResponses = input.responses.filter((row) => isUsableAsiResponse(row) && row.source === 'live');
	return {
		source: input.source,
		analyzedAt: new Date().toISOString(),
		boundFromAudit: input.boundFromAudit,
		auditBind: input.auditBind,
		site: input.site,
		answers,
		sources,
		brand: compared.brand,
		competitors: compared.competitors,
		summary: {
			answers: answers.length,
			withEvidence,
			unavailable: answers.length - withEvidence,
			brandCitations: compared.brand.citations,
			competitorCitations: compared.competitors.reduce((sum, row) => sum + row.citations, 0),
			validResponseCount: validResponses.length,
			queryCount: unique(input.responses.map((row) => row.query)).length,
			observationState: resolveAsiObservationState({
				analyzed: input.source === 'live' || validResponses.length > 0,
				validResponseCount: validResponses.length,
				competitorCount: compared.competitors.length,
			}),
		},
	};
}
