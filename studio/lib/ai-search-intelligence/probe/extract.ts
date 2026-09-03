import { extractAsiSovObservation } from '@/lib/ai-search-intelligence/sov/extract';
import type { AIResponse, AsiQueryExtract, AsiQueryProbeRecord } from '@/lib/ai-search-intelligence/types';

export function emptyAsiQueryExtract(): AsiQueryExtract {
	return {
		mentioned: false,
		recommended: false,
		rank: null,
		mentionType: 'none',
		competitors: [],
		citations: [],
	};
}

export function extractAsiQueryResult(
	response: AIResponse,
	input: { brand: string; aliases?: readonly string[] },
): AsiQueryExtract {
	const row = extractAsiSovObservation(response, input);
	if (!row) {
		return {
			...emptyAsiQueryExtract(),
			citations: response.citations.map((item) => item.url).filter(Boolean),
		};
	}
	return {
		mentioned: row.brandMentioned,
		recommended: row.recommended,
		rank: row.rank,
		mentionType: row.recommended ? 'recommended' : row.brandMentioned ? 'simple_mention' : 'none',
		competitors: row.competitorMentions,
		citations: row.citations,
	};
}

export function toAsiQueryProbeRecord(
	response: AIResponse,
	input: { runId: string; brand: string; aliases?: readonly string[] },
): AsiQueryProbeRecord {
	return {
		runId: input.runId,
		timestamp: response.timestamp || new Date().toISOString(),
		query: response.query,
		provider: response.provider,
		response: {
			answer: response.answer,
			source: response.source,
			fallback: Boolean(response.meta?.fallback || response.source === 'fallback'),
			error: response.meta?.error,
		},
		extracted: extractAsiQueryResult(response, { brand: input.brand, aliases: input.aliases }),
	};
}
