/**
 * Durable monthly usage counters. Separate from the seven history kinds.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isAsiPersistEnabled } from '@/lib/ai-search-intelligence/persist/enabled';
import { asiHistoryRoot, atomicWriteJsonFile } from '@/lib/ai-search-intelligence/persist/fs-store';

export type AsiPersistedUsage = {
	month: string;
	queriesUsed: number;
	providerCalls: number;
};

function fileFor(usageKey: string): string {
	const safe = usageKey.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_') || 'unknown';
	return join(asiHistoryRoot(), '_usage', `${safe}.json`);
}

export function readPersistedUsage(usageKey: string): AsiPersistedUsage | null {
	if (!isAsiPersistEnabled() || !usageKey.trim()) return null;
	const path = fileFor(usageKey);
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as AsiPersistedUsage;
		if (!parsed || typeof parsed !== 'object' || typeof parsed.month !== 'string') return null;
		return {
			month: parsed.month,
			queriesUsed: Number(parsed.queriesUsed) || 0,
			providerCalls: Number(parsed.providerCalls) || 0,
		};
	} catch {
		return null;
	}
}

export function writePersistedUsage(usageKey: string, row: AsiPersistedUsage) {
	if (!isAsiPersistEnabled() || !usageKey.trim()) return;
	try {
		const path = fileFor(usageKey);
		mkdirSync(join(asiHistoryRoot(), '_usage'), { recursive: true });
		atomicWriteJsonFile(path, JSON.stringify(row));
	} catch {
		/* persist is best-effort */
	}
}

export function clearPersistedUsage(usageKey: string) {
	if (!isAsiPersistEnabled() || !usageKey.trim()) return;
	try {
		const path = fileFor(usageKey);
		if (existsSync(path)) unlinkSync(path);
	} catch {
		/* clear is best-effort */
	}
}
