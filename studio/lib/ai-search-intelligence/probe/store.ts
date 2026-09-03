import type { AsiQueryProbeReport, AsiQueryRun } from '@/lib/ai-search-intelligence/types';
import { compareAsiQueryRuns } from '@/lib/ai-search-intelligence/probe/compare';

const STORE = new Map<string, AsiQueryRun[]>();
const MAX_RUNS = 8;

function keyFor(domain: string): string {
	return domain.trim().toLowerCase();
}

export function emptyAsiQueryProbeReport(): AsiQueryProbeReport {
	return { current: null, previous: null, compare: [] };
}

export function readAsiQueryRuns(domain: string): AsiQueryRun[] {
	return [...(STORE.get(keyFor(domain)) ?? [])];
}

export function clearAsiQueryRuns(domain?: string) {
	if (!domain) {
		STORE.clear();
		return;
	}
	STORE.delete(keyFor(domain));
}

export function appendAsiQueryRun(domain: string, run: AsiQueryRun): AsiQueryProbeReport {
	const previous = readAsiQueryRuns(domain)[0] ?? null;
	const next = [run, ...readAsiQueryRuns(domain).filter((item) => item.runId !== run.runId)].slice(0, MAX_RUNS);
	STORE.set(keyFor(domain), next);
	return {
		current: run,
		previous,
		compare: compareAsiQueryRuns(run, previous),
	};
}

export function latestAsiQueryProbeReport(domain: string): AsiQueryProbeReport {
	const runs = readAsiQueryRuns(domain);
	const current = runs[0] ?? null;
	const previous = runs[1] ?? null;
	if (!current) return emptyAsiQueryProbeReport();
	return {
		current,
		previous,
		compare: compareAsiQueryRuns(current, previous),
	};
}
