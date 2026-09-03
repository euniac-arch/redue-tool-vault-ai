import type { AsiQueryCompareRow, AsiQueryExtract, AsiQueryRun } from '@/lib/ai-search-intelligence/types';

function rankValue(rank: AsiQueryExtract['rank']): number | null {
	return rank == null ? null : rank;
}

export function compareAsiQueryRuns(current: AsiQueryRun, previous: AsiQueryRun | null): AsiQueryCompareRow[] {
	if (!previous) {
		return current.records.map((record) => ({
			query: record.query,
			provider: record.provider,
			previous: null,
			current: record.extracted,
			mentionChanged: false,
			recommendChanged: false,
			rankDelta: null,
		}));
	}
	const prior = new Map(previous.records.map((record) => [`${record.provider}::${record.query}`, record]));
	return current.records.map((record) => {
		const last = prior.get(`${record.provider}::${record.query}`);
		const prevExtract = last?.extracted ?? null;
		const currRank = rankValue(record.extracted.rank);
		const prevRank = prevExtract ? rankValue(prevExtract.rank) : null;
		return {
			query: record.query,
			provider: record.provider,
			previous: prevExtract,
			current: record.extracted,
			mentionChanged: Boolean(prevExtract && prevExtract.mentioned !== record.extracted.mentioned),
			recommendChanged: Boolean(prevExtract && prevExtract.recommended !== record.extracted.recommended),
			rankDelta: prevRank != null && currRank != null ? prevRank - currRank : null,
		};
	});
}
