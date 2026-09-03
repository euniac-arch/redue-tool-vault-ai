import type { AsiEngineId } from '@/lib/ai-search-intelligence/types';
import { ASI_ENGINES } from '@/lib/ai-search-intelligence/types';

export type AsiProviderUsage = {
	calls: number;
	failures: number;
	timeouts: number;
	retries: number;
	cacheHits: number;
	cancelled: number;
	totalMs: number;
	avgMs: number | null;
	lastError?: string;
};

export type AsiUsageReport = {
	date: string;
	requests: number;
	providerCalls: number;
	cacheHits: number;
	skippedDuplicate: number;
	cancelled: number;
	failures: number;
	failureRate: number | null;
	avgMs: number | null;
	byProvider: Record<AsiEngineId, AsiProviderUsage>;
};

function emptyProvider(): AsiProviderUsage {
	return {
		calls: 0,
		failures: 0,
		timeouts: 0,
		retries: 0,
		cacheHits: 0,
		cancelled: 0,
		totalMs: 0,
		avgMs: null,
	};
}

function emptyReport(date: string): AsiUsageReport {
	return {
		date,
		requests: 0,
		providerCalls: 0,
		cacheHits: 0,
		skippedDuplicate: 0,
		cancelled: 0,
		failures: 0,
		failureRate: null,
		avgMs: null,
		byProvider: {
			chatgpt: emptyProvider(),
			gemini: emptyProvider(),
			perplexity: emptyProvider(),
			claude: emptyProvider(),
		},
	};
}

let today = utcDate();
let report = emptyReport(today);

function utcDate(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

function roll(now = Date.now()) {
	const date = utcDate(now);
	if (date === today) return;
	today = date;
	report = emptyReport(date);
}

function finalize(row: AsiProviderUsage) {
	row.avgMs = row.calls > 0 ? Math.round(row.totalMs / row.calls) : null;
}

export function clearAsiUsage() {
	today = utcDate();
	report = emptyReport(today);
}

export function recordAsiHttpRequest() {
	roll();
	report.requests += 1;
}

export function recordAsiUsage(input: {
	provider: AsiEngineId;
	ok: boolean;
	ms: number;
	retries?: number;
	cacheHit?: boolean;
	skippedDuplicate?: boolean;
	cancelled?: boolean;
	timeout?: boolean;
	error?: string;
}) {
	roll();
	const row = report.byProvider[input.provider] ?? emptyProvider();
	if (input.cacheHit) {
		report.cacheHits += 1;
		row.cacheHits += 1;
		report.byProvider[input.provider] = row;
		return;
	}
	if (input.skippedDuplicate) {
		report.skippedDuplicate += 1;
		report.byProvider[input.provider] = row;
		return;
	}
	row.calls += 1;
	row.totalMs += Math.max(0, input.ms);
	row.retries += input.retries ?? 0;
	if (input.cancelled) {
		row.cancelled += 1;
		report.cancelled += 1;
	}
	if (input.timeout) {
		row.timeouts += 1;
	}
	if (!input.ok) {
		row.failures += 1;
		report.failures += 1;
		if (input.error) row.lastError = input.error.slice(0, 48);
	}
	finalize(row);
	report.byProvider[input.provider] = row;
	report.providerCalls += 1;
	const liveCalls = ASI_ENGINES.reduce((sum, id) => sum + report.byProvider[id].calls, 0);
	const liveMs = ASI_ENGINES.reduce((sum, id) => sum + report.byProvider[id].totalMs, 0);
	report.avgMs = liveCalls > 0 ? Math.round(liveMs / liveCalls) : null;
	report.failureRate = liveCalls > 0 ? Number((report.failures / liveCalls).toFixed(4)) : null;
}

/** Admin snapshot. Never includes API keys, URLs with keys, or raw provider payloads. */
export function readAsiUsageReport(now = Date.now()): AsiUsageReport {
	roll(now);
	return {
		...report,
		byProvider: {
			chatgpt: { ...report.byProvider.chatgpt },
			gemini: { ...report.byProvider.gemini },
			perplexity: { ...report.byProvider.perplexity },
			claude: { ...report.byProvider.claude },
		},
	};
}
