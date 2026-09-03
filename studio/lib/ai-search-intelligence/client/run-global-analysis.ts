import {
	clearAsiToolSnapshots,
	readAsiSessionSnapshot,
	WAR_ROOM_CACHE_KEY,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { loadMatchingAuditPayload } from '@/lib/ai-search-intelligence/target/client';
import type { AsiTargetContext } from '@/lib/ai-search-intelligence/target/client';
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { inputFromCurrentSite } from '@/lib/ai-search-intelligence/client/current-site-input';
import type { AsiIaEntryId, AsiToolId } from '@/lib/ai-search-intelligence/routes';
import {
	loadAsiAgentReadiness,
	loadAsiCompetitorGap,
	loadAsiEvidence,
	loadAsiExplorer,
	loadAsiNextAction,
	loadAsiOpportunity,
	loadAsiPerception,
	loadAsiQueryGenerator,
	loadAsiRecommendation,
	loadAsiShareOfVoice,
	loadAsiSimulator,
	loadAsiVisibility,
	loadAsiWarRoom,
	type AsiLoadResult,
} from '@/lib/ai-search-intelligence/client/asi-client';

export type GlobalAnalysisJobId =
	| 'war-room'
	| 'perception'
	| 'recommendation'
	| 'evidence'
	| 'visibility'
	| 'readiness'
	| 'opportunity'
	| 'explorer'
	| 'gap'
	| 'action';

export const GLOBAL_ANALYSIS_JOBS: readonly GlobalAnalysisJobId[] = [
	'war-room',
	'perception',
	'recommendation',
	'evidence',
	'visibility',
	'readiness',
	'opportunity',
	'explorer',
	'gap',
	'action',
];

const ENTRY_TO_JOB: Record<AsiIaEntryId, GlobalAnalysisJobId> = {
	'war-room': 'war-room',
	brand: 'perception',
	reputation: 'perception',
	snapshot: 'perception',
	test: 'recommendation',
	simulator: 'recommendation',
	sov: 'recommendation',
	competitors: 'recommendation',
	citations: 'evidence',
	questions: 'evidence',
	visibility: 'visibility',
	'visibility-trend': 'visibility',
	alert: 'visibility',
	'agent-readiness': 'readiness',
	opportunity: 'opportunity',
	explorer: 'explorer',
	gap: 'gap',
	action: 'action',
};

export function jobForEntry(entryId: AsiIaEntryId): GlobalAnalysisJobId {
	return ENTRY_TO_JOB[entryId];
}

export function entriesForJob(jobId: GlobalAnalysisJobId): AsiIaEntryId[] {
	return (Object.entries(ENTRY_TO_JOB) as Array<[AsiIaEntryId, GlobalAnalysisJobId]>)
		.filter(([, job]) => job === jobId)
		.map(([entryId]) => entryId);
}

/** Unique loaders that cover all 16 tools. Shared snapshots are counted once. */
export const BATCH_UNIQUE_ENTRIES: readonly AsiIaEntryId[] = [
	'questions',
	'citations',
	'opportunity',
	'simulator',
	'visibility',
	'brand',
	'sov',
	'test',
	'explorer',
	'gap',
	'action',
	'agent-readiness',
	'war-room',
];

const TOOLS_COMPLETED_BY_ENTRY: Record<AsiIaEntryId, readonly AsiToolId[]> = {
	questions: ['questions'],
	citations: ['citations'],
	opportunity: ['opportunity'],
	simulator: ['simulator'],
	visibility: ['visibility'],
	brand: ['brand', 'reputation', 'snapshot'],
	sov: ['sov'],
	test: ['test', 'competitors'],
	explorer: ['explorer'],
	gap: ['gap'],
	action: ['action'],
	'agent-readiness': ['agent-readiness'],
	'war-room': ['war-room'],
	reputation: ['brand', 'reputation', 'snapshot'],
	snapshot: ['brand', 'reputation', 'snapshot'],
	competitors: ['test', 'competitors'],
	'visibility-trend': ['visibility'],
	alert: ['visibility'],
};

export const BATCH_TOOL_TOTAL = 16;

export function toolsCompletedByEntry(entryId: AsiIaEntryId): readonly AsiToolId[] {
	return TOOLS_COMPLETED_BY_ENTRY[entryId] ?? [];
}

async function mergeEvidence(input: AsiRunInput, signal?: AbortSignal) {
	const [citations, questions] = await Promise.all([loadAsiEvidence(input, signal), loadAsiQueryGenerator(input, signal)]);
	if (citations.snapshot && questions.snapshot) {
		return {
			snapshot: {
				...citations.snapshot,
				...questions.snapshot,
				citations: citations.snapshot.citations,
				citationReport: citations.snapshot.citationReport ?? questions.snapshot.citationReport,
				questions: questions.snapshot.questions,
				queryGeneration: questions.snapshot.queryGeneration,
			},
			error: null,
		} satisfies AsiLoadResult<(typeof questions)['snapshot'] & (typeof citations)['snapshot']>;
	}
	return questions.snapshot ? questions : citations;
}

async function mergeRecommendation(input: AsiRunInput, signal?: AbortSignal) {
	const [test, sov] = await Promise.all([loadAsiRecommendation(input, signal), loadAsiShareOfVoice(input, signal)]);
	if (test.snapshot && sov.snapshot) {
		return {
			snapshot: {
				...test.snapshot,
				sov: sov.snapshot.sov,
				competitors: sov.snapshot.competitors.length ? sov.snapshot.competitors : test.snapshot.competitors,
				simulator: sov.snapshot.simulator ?? test.snapshot.simulator,
			},
			error: null,
		};
	}
	return test.snapshot ? test : sov;
}

async function runJob(jobId: GlobalAnalysisJobId, input: AsiRunInput, signal?: AbortSignal): Promise<boolean> {
	switch (jobId) {
		case 'war-room': {
			const result = await loadAsiWarRoom(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot(WAR_ROOM_CACHE_KEY, result.snapshot);
			return true;
		}
		case 'perception': {
			const result = await loadAsiPerception(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_perception_snapshot', result.snapshot);
			return true;
		}
		case 'recommendation': {
			const result = await mergeRecommendation(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_recommendation_snapshot', result.snapshot);
			return true;
		}
		case 'evidence': {
			const result = await mergeEvidence(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_evidence_snapshot', result.snapshot);
			return true;
		}
		case 'visibility': {
			const result = await loadAsiVisibility(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_visibility_snapshot', result.snapshot);
			return true;
		}
		case 'readiness': {
			const result = await loadAsiAgentReadiness(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_agent_readiness_snapshot', result.snapshot);
			return true;
		}
		case 'opportunity': {
			const result = await loadAsiOpportunity(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_opportunity_snapshot', result.snapshot);
			return true;
		}
		case 'explorer': {
			const result = await loadAsiExplorer(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_explorer_snapshot', result.snapshot);
			return true;
		}
		case 'gap': {
			const result = await loadAsiCompetitorGap(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_gap_snapshot', result.snapshot);
			return true;
		}
		case 'action': {
			const result = await loadAsiNextAction(input, signal);
			if (!result.snapshot) return false;
			writeAsiSessionSnapshot('asi_action_snapshot', result.snapshot);
			return true;
		}
	}
}

function writeMergedSnapshot<T extends { site: { url: string } }>(key: string, snapshot: T) {
	const prev = readAsiSessionSnapshot<T>(key, (data) => Boolean(data?.site?.url));
	writeAsiSessionSnapshot(key, prev ? { ...prev, ...snapshot } : snapshot);
}

/**
 * Run exactly one IA entry's loader from the shared currentSite.
 * Shared caches (evidence / recommendation / perception / visibility) merge.
 */
export async function runEntryAnalysis(
	entryId: AsiIaEntryId,
	site: AsiTargetContext,
	signal?: AbortSignal,
): Promise<{ ok: boolean }> {
	const input = inputFromCurrentSite(site);
	switch (entryId) {
		case 'war-room': {
			const result = await loadAsiWarRoom(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot(WAR_ROOM_CACHE_KEY, result.snapshot);
			return { ok: true };
		}
		case 'brand':
		case 'reputation':
		case 'snapshot': {
			const result = await loadAsiPerception(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_perception_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'test':
		case 'competitors': {
			const result = await loadAsiRecommendation(input, signal);
			if (!result.snapshot) return { ok: false };
			writeMergedSnapshot('asi_recommendation_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'simulator': {
			const result = await loadAsiSimulator(input, signal);
			if (!result.snapshot) return { ok: false };
			writeMergedSnapshot('asi_recommendation_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'sov': {
			const result = await loadAsiShareOfVoice(input, signal);
			if (!result.snapshot) return { ok: false };
			writeMergedSnapshot('asi_recommendation_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'questions': {
			const result = await loadAsiQueryGenerator(input, signal);
			if (!result.snapshot) return { ok: false };
			writeMergedSnapshot('asi_evidence_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'citations': {
			const result = await loadAsiEvidence(input, signal);
			if (!result.snapshot) return { ok: false };
			writeMergedSnapshot('asi_evidence_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'visibility':
		case 'visibility-trend':
		case 'alert': {
			const result = await loadAsiVisibility(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_visibility_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'agent-readiness': {
			const result = await loadAsiAgentReadiness(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_agent_readiness_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'opportunity': {
			const result = await loadAsiOpportunity(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_opportunity_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'explorer': {
			const result = await loadAsiExplorer(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_explorer_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'gap': {
			const result = await loadAsiCompetitorGap(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_gap_snapshot', result.snapshot);
			return { ok: true };
		}
		case 'action': {
			const result = await loadAsiNextAction(input, signal);
			if (!result.snapshot) return { ok: false };
			writeAsiSessionSnapshot('asi_action_snapshot', result.snapshot);
			return { ok: true };
		}
	}
}

export async function runSingleToolAnalysis(
	site: AsiTargetContext,
	entryId: AsiIaEntryId,
	signal?: AbortSignal,
): Promise<{ ok: boolean }> {
	return runEntryAnalysis(entryId, site, signal);
}

export async function runBatchToolAnalysis(
	site: AsiTargetContext,
	options: {
		signal?: AbortSignal;
		onProgress?: (done: number, total: number, entryId: AsiIaEntryId) => void;
	} = {},
): Promise<{ okCount: number; total: number }> {
	clearAsiToolSnapshots();
	const total = BATCH_TOOL_TOTAL;
	let done = 0;
	let okCount = 0;
	for (const entryId of BATCH_UNIQUE_ENTRIES) {
		const ok = await runEntryAnalysis(entryId, site, options.signal);
		if (ok) okCount += 1;
		done += toolsCompletedByEntry(entryId).length;
		options.onProgress?.(Math.min(done, total), total, entryId);
	}
	options.onProgress?.(total, total, 'war-room');
	return { okCount, total };
}

export async function runGlobalIntelligenceAnalysis(
	url: string,
	options: {
		signal?: AbortSignal;
		jobs?: readonly GlobalAnalysisJobId[];
		onProgress?: (done: number, total: number) => void;
	} = {},
): Promise<{ okCount: number; total: number }> {
	const jobs = options.jobs ?? GLOBAL_ANALYSIS_JOBS;
	if (!options.jobs) clearAsiToolSnapshots();
	const input: AsiRunInput = { url, audit: loadMatchingAuditPayload(url) };
	const total = jobs.length;
	let cursor = 0;
	let done = 0;
	let okCount = 0;
	const concurrency = Math.min(3, total);

	async function worker() {
		while (cursor < jobs.length) {
			const index = cursor;
			cursor += 1;
			const ok = await runJob(jobs[index], input, options.signal);
			if (ok) okCount += 1;
			done += 1;
			options.onProgress?.(done, total);
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	options.onProgress?.(total, total);
	return { okCount, total };
}
