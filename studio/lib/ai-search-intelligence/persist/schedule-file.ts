/**
 * Durable monitor jobs + pinned query panels.
 * Separate from the seven history kinds (observation … alert).
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isAsiPersistEnabled } from '@/lib/ai-search-intelligence/persist/enabled';
import { asiHistoryRoot, atomicWriteJsonFile, listAsiHistoryDomains } from '@/lib/ai-search-intelligence/persist/fs-store';
import type { AsiVisibilityCadence } from '@/lib/ai-search-intelligence/visibility/config';

export type AsiPersistedVisibilityJob = {
	id: string;
	domain: string;
	url: string;
	cadence: AsiVisibilityCadence;
	lastRunAt: string | null;
	nextRunAt: string;
};

export type AsiPersistedSchedule = {
	job: AsiPersistedVisibilityJob | null;
	queries: string[];
};

function domainKey(domain: string): string {
	return domain.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '_') || 'unknown';
}

function fileFor(domain: string): string {
	return join(asiHistoryRoot(), domainKey(domain), 'schedule.json');
}

export function readPersistedSchedule(domain: string): AsiPersistedSchedule | null {
	if (!isAsiPersistEnabled()) return null;
	const path = fileFor(domain);
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as AsiPersistedSchedule;
		if (!parsed || typeof parsed !== 'object') return null;
		return {
			job: parsed.job && typeof parsed.job === 'object' ? parsed.job : null,
			queries: Array.isArray(parsed.queries) ? parsed.queries.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
		};
	} catch {
		return null;
	}
}

export function writePersistedSchedule(domain: string, state: AsiPersistedSchedule) {
	if (!isAsiPersistEnabled()) return;
	try {
		const path = fileFor(domain);
		mkdirSync(join(asiHistoryRoot(), domainKey(domain)), { recursive: true });
		atomicWriteJsonFile(path, JSON.stringify(state));
	} catch {
		/* persist is best-effort */
	}
}

export function clearPersistedSchedule(domain: string) {
	if (!isAsiPersistEnabled()) return;
	try {
		const path = fileFor(domain);
		if (existsSync(path)) unlinkSync(path);
	} catch {
		/* clear is best-effort */
	}
}

export function listPersistedSchedules(): Array<{ domain: string; state: AsiPersistedSchedule }> {
	if (!isAsiPersistEnabled()) return [];
	const out: Array<{ domain: string; state: AsiPersistedSchedule }> = [];
	for (const domain of listAsiHistoryDomains()) {
		const state = readPersistedSchedule(domain);
		if (!state) continue;
		if (!state.job && !state.queries.length) continue;
		out.push({ domain, state });
	}
	return out;
}
