/**
 * Cadence interface for daily / weekly / monthly remesasure.
 * Memory + schedule.json so a process restart still finds due jobs.
 */
import {
	clearPersistedSchedule,
	listPersistedSchedules,
	readPersistedSchedule,
	writePersistedSchedule,
	type AsiPersistedSchedule,
} from '@/lib/ai-search-intelligence/persist/schedule-file';
import { ASI_VISIBILITY_CONFIG, type AsiVisibilityCadence } from '@/lib/ai-search-intelligence/visibility/config';

export type AsiVisibilityJob = {
	id: string;
	domain: string;
	url: string;
	cadence: AsiVisibilityCadence;
	lastRunAt: string | null;
	nextRunAt: string;
};

const JOBS = new Map<string, AsiVisibilityJob>();
const PANELS = new Map<string, string[]>();
let scheduleHydrated = false;

function keyFor(domain: string): string {
	return domain.trim().toLowerCase();
}

function persistEntry(domain: string) {
	const key = keyFor(domain);
	const job = JOBS.get(key) ?? null;
	const queries = PANELS.get(key) ?? [];
	if (!job && !queries.length) {
		clearPersistedSchedule(key);
		return;
	}
	const state: AsiPersistedSchedule = { job, queries };
	writePersistedSchedule(key, state);
}

export function hydrateVisibilitySchedule() {
	if (scheduleHydrated) return;
	scheduleHydrated = true;
	for (const { domain, state } of listPersistedSchedules()) {
		const key = keyFor(state.job?.domain || domain);
		if (state.job && !JOBS.has(key)) JOBS.set(key, { ...state.job, domain: key });
		if (state.queries.length && !PANELS.has(key)) PANELS.set(key, state.queries);
	}
}

export function resetVisibilityScheduleHydration() {
	scheduleHydrated = false;
}

export function nextVisibilityRunAt(from: Date, cadence: AsiVisibilityCadence): string {
	return new Date(from.getTime() + ASI_VISIBILITY_CONFIG.cadenceMs[cadence]).toISOString();
}

export function readVisibilityJob(domain: string): AsiVisibilityJob | null {
	hydrateVisibilitySchedule();
	return JOBS.get(keyFor(domain)) ?? null;
}

export function readVisibilityPanel(domain: string): string[] {
	hydrateVisibilitySchedule();
	return [...(PANELS.get(keyFor(domain)) ?? [])];
}

export function writeVisibilityPanel(domain: string, queries: readonly string[]): string[] {
	hydrateVisibilitySchedule();
	const key = keyFor(domain);
	const next = [...new Set(queries.map((item) => item.trim()).filter(Boolean))];
	if (!next.length) {
		PANELS.delete(key);
	} else {
		PANELS.set(key, next);
	}
	persistEntry(key);
	return next;
}

export function clearVisibilityJobs(domain?: string) {
	if (!domain) {
		JOBS.clear();
		PANELS.clear();
		resetVisibilityScheduleHydration();
		return;
	}
	const key = keyFor(domain);
	JOBS.delete(key);
	PANELS.delete(key);
	clearPersistedSchedule(key);
}

export function enrollVisibilityJob(input: {
	url: string;
	domain: string;
	cadence: AsiVisibilityCadence;
	now?: Date;
}): AsiVisibilityJob {
	hydrateVisibilitySchedule();
	const now = input.now ?? new Date();
	const key = keyFor(input.domain);
	const current = readVisibilityJob(key);
	const job: AsiVisibilityJob = {
		id: current?.id ?? `vis::${key}`,
		domain: key,
		url: input.url,
		cadence: input.cadence,
		lastRunAt: current?.lastRunAt ?? null,
		nextRunAt:
			current && current.cadence === input.cadence ? current.nextRunAt : nextVisibilityRunAt(now, input.cadence),
	};
	JOBS.set(job.domain, job);
	persistEntry(job.domain);
	return job;
}

export function dueVisibilityJobs(now = new Date()): AsiVisibilityJob[] {
	hydrateVisibilitySchedule();
	const ms = now.getTime();
	return [...JOBS.values()].filter((job) => Date.parse(job.nextRunAt) <= ms);
}

export function markVisibilityJobRun(domain: string, now = new Date()): AsiVisibilityJob | null {
	hydrateVisibilitySchedule();
	const job = readVisibilityJob(domain);
	if (!job) return null;
	const next: AsiVisibilityJob = {
		...job,
		lastRunAt: now.toISOString(),
		nextRunAt: nextVisibilityRunAt(now, job.cadence),
	};
	JOBS.set(job.domain, next);
	persistEntry(job.domain);
	return next;
}

export type AsiVisibilitySchedulePort = {
	enroll: typeof enrollVisibilityJob;
	due: typeof dueVisibilityJobs;
	markRun: typeof markVisibilityJobRun;
};

export const asiVisibilitySchedule: AsiVisibilitySchedulePort = {
	enroll: enrollVisibilityJob,
	due: dueVisibilityJobs,
	markRun: markVisibilityJobRun,
};
