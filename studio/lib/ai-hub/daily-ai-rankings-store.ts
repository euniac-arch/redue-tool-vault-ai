/**
 * Persist one ranking snapshot per KST calendar day so `previousRank` is a
 * real yesterday value. Prefer in-memory + Firestore; disk is best-effort
 * under /tmp (never process.cwd()/.data — Vercel /var/task is read-only).
 */

import 'server-only';

import fs from 'node:fs/promises';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import type { DailyRankSnapshotRow } from '@/lib/ai-hub/live-ai-rankings';
import { ensureWritableDir, writableDataPath } from '@/lib/server/writable-data-dir';

export const AI_RANKINGS_DAILY_COLLECTION = 'ai_rankings_daily';

export type DailyRankingSnapshot = {
	date: string;
	updatedAt: string;
	tools: DailyRankSnapshotRow[];
};

const snapshotMemory = new Map<string, DailyRankingSnapshot>();

function fileDir(): string {
	return writableDataPath('ai-rankings', 'daily');
}

function filePath(dateKey: string): string {
	return writableDataPath('ai-rankings', 'daily', `${dateKey}.json`);
}

function isSnapshot(value: unknown): value is DailyRankingSnapshot {
	if (!value || typeof value !== 'object') return false;
	const row = value as DailyRankingSnapshot;
	return typeof row.date === 'string' && typeof row.updatedAt === 'string' && Array.isArray(row.tools);
}

async function readFileSnapshot(dateKey: string): Promise<DailyRankingSnapshot | null> {
	try {
		const raw = await fs.readFile(filePath(dateKey), 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		return isSnapshot(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

async function writeFileSnapshot(snapshot: DailyRankingSnapshot): Promise<void> {
	try {
		if (!(await ensureWritableDir(fileDir()))) return;
		const dest = filePath(snapshot.date);
		await fs.writeFile(dest, JSON.stringify(snapshot), 'utf8');
	} catch (error) {
		console.warn('[ai-rankings] disk snapshot skipped:', error instanceof Error ? error.message : error);
	}
}

async function readFirestoreSnapshot(dateKey: string): Promise<DailyRankingSnapshot | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(AI_RANKINGS_DAILY_COLLECTION).doc(dateKey).get();
		if (!snap.exists) return null;
		const data = snap.data();
		return isSnapshot(data) ? data : null;
	} catch (error) {
		console.warn('[ai-rankings] Firestore read failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

async function writeFirestoreSnapshot(snapshot: DailyRankingSnapshot): Promise<void> {
	if (!isFirebaseAdminConfigured()) return;
	try {
		await getAdminFirestore()
			.collection(AI_RANKINGS_DAILY_COLLECTION)
			.doc(snapshot.date)
			.set(stripUndefinedDeep(snapshot), { merge: true });
	} catch (error) {
		console.warn('[ai-rankings] Firestore write failed:', error instanceof Error ? error.message : error);
	}
}

export async function readDailyRankingSnapshot(dateKey: string): Promise<DailyRankingSnapshot | null> {
	const cached = snapshotMemory.get(dateKey);
	if (cached) return cached;
	const loaded = (await readFirestoreSnapshot(dateKey)) ?? (await readFileSnapshot(dateKey));
	if (loaded) snapshotMemory.set(dateKey, loaded);
	return loaded;
}

export async function writeDailyRankingSnapshot(snapshot: DailyRankingSnapshot): Promise<void> {
	snapshotMemory.set(snapshot.date, snapshot);
	try {
		await writeFileSnapshot(snapshot);
	} catch (error) {
		console.warn('[ai-rankings] disk persist ignored:', error instanceof Error ? error.message : error);
	}
	try {
		await writeFirestoreSnapshot(snapshot);
	} catch (error) {
		console.warn('[ai-rankings] Firestore persist ignored:', error instanceof Error ? error.message : error);
	}
}
