/**
 * Per-query Naver News cache (memory + Firestore).
 * Look up before hitting openapi.naver.com so Insights / GEO refresh
 * does not re-fire the same keyword within the TTL window.
 */

import 'server-only';

import { createHash } from 'crypto';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const INSIGHTS_NAVER_CACHE_COLLECTION = 'insights_naver_cache';
/** Mid-range of the 1–6h window requested for Naver keyword freshness. */
export const NAVER_KEYWORD_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

export type CachedNaverNewsHit = {
	title: string;
	snippet: string;
	url: string;
	pubDate: Date;
};

type CachedNaverNewsRow = {
	title: string;
	snippet: string;
	url: string;
	pubDateIso: string;
};

type MemoryEntry = {
	items: CachedNaverNewsHit[];
	expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();

export function naverCacheDocId(query: string): string {
	return createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
}

function toHits(rows: CachedNaverNewsRow[]): CachedNaverNewsHit[] {
	return rows
		.filter((row) => row.title && row.url)
		.map((row) => ({
			title: row.title,
			snippet: row.snippet,
			url: row.url,
			pubDate: row.pubDateIso ? new Date(row.pubDateIso) : new Date(0),
		}));
}

function toRows(items: CachedNaverNewsHit[]): CachedNaverNewsRow[] {
	return items.map((item) => ({
		title: item.title,
		snippet: item.snippet,
		url: item.url,
		pubDateIso: Number.isNaN(item.pubDate.getTime()) ? new Date(0).toISOString() : item.pubDate.toISOString(),
	}));
}

export function readNaverSearchMemoryCache(query: string, now = Date.now()): CachedNaverNewsHit[] | null {
	const key = naverCacheDocId(query);
	const entry = memoryCache.get(key);
	if (!entry || entry.expiresAt <= now) {
		if (entry) memoryCache.delete(key);
		return null;
	}
	return entry.items;
}

export function writeNaverSearchMemoryCache(query: string, items: CachedNaverNewsHit[], now = Date.now()): void {
	memoryCache.set(naverCacheDocId(query), {
		items,
		expiresAt: now + NAVER_KEYWORD_CACHE_TTL_MS,
	});
}

export async function readNaverSearchCache(query: string): Promise<CachedNaverNewsHit[] | null> {
	const trimmed = query.trim();
	if (!trimmed) return null;

	const memory = readNaverSearchMemoryCache(trimmed);
	if (memory) return memory;

	if (!isFirebaseAdminConfigured()) return null;

	try {
		const snap = await getAdminFirestore()
			.collection(INSIGHTS_NAVER_CACHE_COLLECTION)
			.doc(naverCacheDocId(trimmed))
			.get();
		if (!snap.exists) return null;
		const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
		const fetchedAtMs = typeof data.fetchedAtMs === 'number' ? data.fetchedAtMs : 0;
		if (!fetchedAtMs || Date.now() - fetchedAtMs >= NAVER_KEYWORD_CACHE_TTL_MS) return null;
		const rows = Array.isArray(data.items) ? (data.items as CachedNaverNewsRow[]) : [];
		const items = toHits(rows);
		writeNaverSearchMemoryCache(trimmed, items, fetchedAtMs);
		return items;
	} catch (error) {
		console.warn(
			'[insights-news] Naver keyword cache read failed',
			trimmed,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

export async function writeNaverSearchCache(query: string, items: CachedNaverNewsHit[]): Promise<void> {
	const trimmed = query.trim();
	if (!trimmed) return;

	writeNaverSearchMemoryCache(trimmed, items);

	if (!isFirebaseAdminConfigured()) return;

	try {
		await getAdminFirestore()
			.collection(INSIGHTS_NAVER_CACHE_COLLECTION)
			.doc(naverCacheDocId(trimmed))
			.set(
				{
					query: trimmed,
					items: toRows(items),
					fetchedAtMs: Date.now(),
					fetchedAt: new Date().toISOString(),
				},
				{ merge: true },
			);
	} catch (error) {
		console.warn(
			'[insights-news] Naver keyword cache write failed',
			trimmed,
			error instanceof Error ? error.message : error,
		);
	}
}
