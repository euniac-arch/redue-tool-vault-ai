/**
 * Server-side (Admin SDK) persistence for the public Insights news cache.
 *
 * Collections:
 *   - `insights_news`            — one document per article, keyed by SHA-256(link|guid)
 *   - `insights_metadata/feed`   — `{ lastFetchedAt }` TTL cursor (5h)
 *
 * Writes use `set(..., { merge: true })` so a refresh never duplicates articles.
 * Gracefully no-ops when Firebase Admin is not configured, matching diagnostics /
 * audit-projects conventions.
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { createdAtToIso, stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import {
	collectedToInsightsNewsItem,
	type CollectedInsightsArticle,
} from '@/lib/insights/insights-news-collect';
import { classifyArticleCategory } from '@/lib/insights/insights-news-classify';
import {
	isInsightsNewsCategory,
	type InsightsNewsCategory,
	type InsightsNewsItem,
} from '@/lib/insights/insights-news-types';

export const INSIGHTS_NEWS_COLLECTION = 'insights_news';
export const INSIGHTS_METADATA_COLLECTION = 'insights_metadata';
export const INSIGHTS_METADATA_DOC = 'feed';

const READ_LIMIT = 160;
const WRITE_CHUNK = 400;

export type InsightsNewsMeta = {
	lastFetchedAt: string | null;
	lastFetchedAtMs: number | null;
	articleCount: number;
};

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asCategories(value: unknown): InsightsNewsCategory[] {
	return asStringArray(value).filter(isInsightsNewsCategory);
}

function timestampToMs(value: unknown): number | null {
	if (!value) return null;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? null : parsed;
	}
	if (value instanceof Date) {
		const ms = value.getTime();
		return Number.isNaN(ms) ? null : ms;
	}
	const ts = value as { toDate?: () => Date; seconds?: number; toMillis?: () => number };
	if (typeof ts.toMillis === 'function') return ts.toMillis();
	if (typeof ts.toDate === 'function') return ts.toDate().getTime();
	if (typeof ts.seconds === 'number') return ts.seconds * 1000;
	return null;
}

export function mapInsightsNewsDoc(id: string, data: Record<string, unknown>): InsightsNewsItem | null {
	const title = typeof data.title === 'string' ? data.title.trim() : '';
	const sourceUrl =
		(typeof data.sourceUrl === 'string' && data.sourceUrl.trim()) ||
		(typeof data.link === 'string' && data.link.trim()) ||
		'';
	if (!title || !sourceUrl) return null;

	const publishedAtIso = createdAtToIso(data.publishedAtIso ?? data.publishedAt);
	const guid = typeof data.guid === 'string' && data.guid.trim() ? data.guid.trim() : null;

	return collectedToInsightsNewsItem({
		id,
		guid,
		link: sourceUrl,
		title,
		summary: typeof data.summary === 'string' ? data.summary : '',
		sourceName: typeof data.sourceName === 'string' ? data.sourceName : '',
		sourceUrl,
		region: data.region === 'KR' ? 'KR' : 'GLOBAL',
		publishedAtIso,
		category: classifyArticleCategory(title, typeof data.summary === 'string' ? data.summary : ''),
		categories: asCategories(data.categories),
		tags: asStringArray(data.tags),
	});
}

export async function readInsightsNewsMeta(): Promise<InsightsNewsMeta | null> {
	if (!isFirebaseAdminConfigured()) return null;
	const snap = await getAdminFirestore()
		.collection(INSIGHTS_METADATA_COLLECTION)
		.doc(INSIGHTS_METADATA_DOC)
		.get();
	if (!snap.exists) return null;
	const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
	const lastFetchedAtMs =
		timestampToMs(data.lastFetchedAtMs) ?? timestampToMs(data.lastFetchedAt);
	return {
		lastFetchedAt: lastFetchedAtMs != null ? new Date(lastFetchedAtMs).toISOString() : null,
		lastFetchedAtMs,
		articleCount: typeof data.articleCount === 'number' ? data.articleCount : 0,
	};
}

export async function listCachedInsightsNews(): Promise<InsightsNewsItem[]> {
	if (!isFirebaseAdminConfigured()) return [];
	const col = getAdminFirestore().collection(INSIGHTS_NEWS_COLLECTION);
	let rows: Array<{ id: string; data: Record<string, unknown> }>;
	try {
		const snap = await col.orderBy('publishedAtIso', 'desc').limit(READ_LIMIT).get();
		rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
	} catch (error) {
		console.warn(
			'[insights-news] orderBy publishedAtIso failed; falling back to unordered read',
			error instanceof Error ? error.message : error,
		);
		const snap = await col.limit(READ_LIMIT).get();
		rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
	}

	const items: InsightsNewsItem[] = [];
	for (const row of rows) {
		const mapped = mapInsightsNewsDoc(row.id, row.data);
		if (mapped) items.push(mapped);
	}
	return items.sort((a, b) => (Date.parse(b.publishedAtIso) || 0) - (Date.parse(a.publishedAtIso) || 0));
}

function toWritePayload(article: CollectedInsightsArticle): Record<string, unknown> {
	return stripUndefinedDeep({
		id: article.id,
		guid: article.guid,
		link: article.link,
		title: article.title,
		summary: article.summary,
		sourceName: article.sourceName,
		sourceUrl: article.sourceUrl,
		region: article.region,
		publishedAtIso: article.publishedAtIso,
		category: article.category,
		categories: article.categories,
		tags: article.tags,
		fetchedAt: new Date().toISOString(),
	});
}

/**
 * Upsert articles by hash id (`merge: true`) and bump `insights_metadata.lastFetchedAt`.
 */
export async function upsertInsightsNewsCache(articles: CollectedInsightsArticle[]): Promise<InsightsNewsItem[]> {
	if (!isFirebaseAdminConfigured()) {
		return articles.map(collectedToInsightsNewsItem);
	}

	const db = getAdminFirestore();
	for (let i = 0; i < articles.length; i += WRITE_CHUNK) {
		const chunk = articles.slice(i, i + WRITE_CHUNK);
		const batch = db.batch();
		for (const article of chunk) {
			const ref = db.collection(INSIGHTS_NEWS_COLLECTION).doc(article.id);
			batch.set(ref, toWritePayload(article), { merge: true });
		}
		await batch.commit();
	}

	const articleCount = articles.length;
	await db
		.collection(INSIGHTS_METADATA_COLLECTION)
		.doc(INSIGHTS_METADATA_DOC)
		.set(
			{
				lastFetchedAt: FieldValue.serverTimestamp(),
				lastFetchedAtMs: Date.now(),
				articleCount,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);

	const cached = await listCachedInsightsNews();
	return cached.length > 0 ? cached : articles.map(collectedToInsightsNewsItem);
}
