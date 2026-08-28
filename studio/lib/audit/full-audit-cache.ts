/**
 * Delta-cache persistence for Full Audit.
 * Compatible with LocalStorage / IndexedDB (JSON), Firestore, and a file cache.
 * The in-process Map is always used; remote/file backends are best-effort.
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const FULL_AUDIT_CACHE_KEY_PREFIX = 'redue.full-audit.delta.v1:';
export const FULL_AUDIT_CACHE_COLLECTION = 'audit_delta_cache';

export type DeltaCachePage = {
	page_title: string;
	h1: string;
	summary: string;
	schema_type: string;
	content_hash: string;
	last_audited: number;
	/** Site-relative path kept so cache hits rebuild CrawledPageMeta. */
	url_path?: string;
	h2?: string[];
	missing_alt?: number;
	images_total?: number;
	heading_skip?: boolean;
	/** Compact render-blocking script rows (page_url + full_tag). */
	render_blocking?: Array<{
		page_url: string;
		script_src: string;
		full_tag: string;
		is_head: boolean;
		recommendation: string;
	}>;
	/** Compact missing-alt rows bound to the page they were found on. */
	missing_alt_images?: Array<{
		page_url: string;
		page_display?: string;
		img_src: string;
		normalized_src?: string;
		current_alt: string;
		issue_type: 'missing' | 'empty' | 'stopword';
		suggested_alt: string;
		issue?: 'alt 누락' | '공백(alt="")' | '불용어(image/사진 등)';
	}>;
	image_srcs?: string[];
	source?: string;
};

export type DeltaCacheDocument = {
	site_origin: string;
	last_full_scan: number;
	pages: Record<string, DeltaCachePage>;
};

const memory = new Map<string, DeltaCacheDocument>();

export function normalizeSiteOrigin(origin: string): string {
	try {
		const u = new URL(origin);
		return `${u.protocol}//${u.host.toLowerCase()}`;
	} catch {
		return String(origin || '').replace(/\/+$/, '').toLowerCase();
	}
}

export function deltaCacheStorageKey(origin: string): string {
	return `${FULL_AUDIT_CACHE_KEY_PREFIX}${normalizeSiteOrigin(origin)}`;
}

function originDocId(origin: string): string {
	return normalizeSiteOrigin(origin)
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9._-]+/gi, '_')
		.slice(0, 200);
}

export function emptyDeltaCache(origin: string): DeltaCacheDocument {
	return { site_origin: normalizeSiteOrigin(origin), last_full_scan: 0, pages: {} };
}

export function isDeltaCacheDocument(value: unknown): value is DeltaCacheDocument {
	if (!value || typeof value !== 'object') return false;
	const doc = value as DeltaCacheDocument;
	return typeof doc.site_origin === 'string' && typeof doc.last_full_scan === 'number' && Boolean(doc.pages) && typeof doc.pages === 'object';
}

export function serializeDeltaCache(doc: DeltaCacheDocument): string {
	return JSON.stringify(doc);
}

export function parseDeltaCache(raw: string | null | undefined): DeltaCacheDocument | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		return isDeltaCacheDocument(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function fileCachePath(origin: string): string {
	return join(tmpdir(), 'redue-full-audit-cache', `${originDocId(origin)}.json`);
}

async function loadFileCache(origin: string): Promise<DeltaCacheDocument | null> {
	try {
		const raw = await readFile(fileCachePath(origin), 'utf8');
		return parseDeltaCache(raw);
	} catch {
		return null;
	}
}

async function saveFileCache(doc: DeltaCacheDocument): Promise<void> {
	try {
		const path = fileCachePath(doc.site_origin);
		await mkdir(join(path, '..'), { recursive: true });
		await writeFile(path, serializeDeltaCache(doc), 'utf8');
	} catch (err) {
		console.warn('[full-audit-cache] file write skipped:', err instanceof Error ? err.message : err);
	}
}

async function loadFirestoreCache(origin: string): Promise<DeltaCacheDocument | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(FULL_AUDIT_CACHE_COLLECTION).doc(originDocId(origin)).get();
		if (!snap.exists) return null;
		const data = snap.data() as DeltaCacheDocument | undefined;
		return isDeltaCacheDocument(data) ? data : null;
	} catch (err) {
		console.warn('[full-audit-cache] Firestore read skipped:', err instanceof Error ? err.message : err);
		return null;
	}
}

async function saveFirestoreCache(doc: DeltaCacheDocument): Promise<void> {
	if (!isFirebaseAdminConfigured()) return;
	try {
		await getAdminFirestore().collection(FULL_AUDIT_CACHE_COLLECTION).doc(originDocId(doc.site_origin)).set({
			...doc,
			updatedAt: new Date().toISOString(),
		});
	} catch (err) {
		console.warn('[full-audit-cache] Firestore write skipped:', err instanceof Error ? err.message : err);
	}
}

export async function loadDeltaCache(origin: string): Promise<DeltaCacheDocument | null> {
	const key = normalizeSiteOrigin(origin);
	const mem = memory.get(key);
	if (mem) return mem;
	const remote = (await loadFirestoreCache(key)) || (await loadFileCache(key));
	if (remote) memory.set(key, remote);
	return remote;
}

export async function saveDeltaCache(doc: DeltaCacheDocument): Promise<void> {
	const normalized: DeltaCacheDocument = {
		site_origin: normalizeSiteOrigin(doc.site_origin),
		last_full_scan: doc.last_full_scan,
		pages: { ...doc.pages },
	};
	memory.set(normalized.site_origin, normalized);
	await Promise.all([saveFileCache(normalized), saveFirestoreCache(normalized)]);
}

export function peekMemoryDeltaCache(origin: string): DeltaCacheDocument | null {
	return memory.get(normalizeSiteOrigin(origin)) ?? null;
}

export function seedMemoryDeltaCache(doc: DeltaCacheDocument): void {
	memory.set(normalizeSiteOrigin(doc.site_origin), {
		site_origin: normalizeSiteOrigin(doc.site_origin),
		last_full_scan: doc.last_full_scan,
		pages: { ...doc.pages },
	});
}

export function clearMemoryDeltaCache(origin?: string): void {
	if (!origin) {
		memory.clear();
		return;
	}
	memory.delete(normalizeSiteOrigin(origin));
}
