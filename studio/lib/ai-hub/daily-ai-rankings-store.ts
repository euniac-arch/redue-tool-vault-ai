/**
 * Persist one ranking snapshot per KST calendar day so `previousRank` is a
 * real yesterday value, not a hardcoded table.
 *
 * Write order: Firestore `ai_rankings_daily/{date}` when Admin is configured,
 * plus a local `.data/ai-rankings/daily/{date}.json` fallback for offline / CI.
 */

import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import type { DailyRankSnapshotRow } from '@/lib/ai-hub/live-ai-rankings';

export const AI_RANKINGS_DAILY_COLLECTION = 'ai_rankings_daily';

export type DailyRankingSnapshot = {
	date: string;
	updatedAt: string;
	tools: DailyRankSnapshotRow[];
};

const FILE_DIR = path.join(process.cwd(), '.data', 'ai-rankings', 'daily');

function isSnapshot(value: unknown): value is DailyRankingSnapshot {
	if (!value || typeof value !== 'object') return false;
	const row = value as DailyRankingSnapshot;
	return typeof row.date === 'string' && typeof row.updatedAt === 'string' && Array.isArray(row.tools);
}

function filePath(dateKey: string): string {
	return path.join(FILE_DIR, `${dateKey}.json`);
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
	await fs.mkdir(FILE_DIR, { recursive: true });
	const tmp = `${filePath(snapshot.date)}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(snapshot, null, '\t'), 'utf8');
	await fs.rename(tmp, filePath(snapshot.date));
}

async function readFirestoreSnapshot(dateKey: string): Promise<DailyRankingSnapshot | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(AI_RANKINGS_DAILY_COLLECTION).doc(dateKey).get();
		if (!snap.exists) return null;
		const data = snap.data();
		return isSnapshot(data) ? data : null;
	} catch (error) {
		console.warn('[ai-rankings] Firestore read failed, falling back to disk:', error);
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
		console.warn('[ai-rankings] Firestore write failed, disk snapshot still saved:', error);
	}
}

export async function readDailyRankingSnapshot(dateKey: string): Promise<DailyRankingSnapshot | null> {
	return (await readFirestoreSnapshot(dateKey)) ?? (await readFileSnapshot(dateKey));
}

export async function writeDailyRankingSnapshot(snapshot: DailyRankingSnapshot): Promise<void> {
	await writeFileSnapshot(snapshot);
	await writeFirestoreSnapshot(snapshot);
}
