/**
 * Last successful AI research snapshot.
 * Survives feed/AI tab switches and leaving Insights for other menus.
 */

import {
	normalizeAiResearchArticle,
	type InsightsAiResearchArticle,
	type InsightsAiResearchResult,
} from './insights-ai-research';

export const LAST_AI_RESEARCH_KEY = 'redue_last_ai_research';

export type LastAiResearchSnapshot = {
	query: string;
	summary: string;
	insights: string[];
	articles: InsightsAiResearchArticle[];
	timestamp: number;
	model?: string;
	warning?: string;
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function serializeResearchArticles(
	articles: InsightsAiResearchArticle[],
): InsightsAiResearchArticle[] {
	return articles
		.map((article, index) => normalizeAiResearchArticle({ ...article, id: article.id }, index))
		.filter((item): item is InsightsAiResearchArticle => Boolean(item))
		.slice(0, 5);
}

export function snapshotFromResearchResult(
	result: InsightsAiResearchResult,
	timestamp = Date.now(),
): LastAiResearchSnapshot {
	return {
		query: asText(result.query),
		summary: asText(result.summary),
		insights: Array.isArray(result.insights) ? result.insights.map(asText).filter(Boolean) : [],
		articles: serializeResearchArticles(result.articles || []),
		timestamp: result.searchedAt || timestamp,
		model: asText(result.model) || 'gpt-4o-mini',
		warning: asText(result.warning) || undefined,
	};
}

export function lastResearchToResult(snapshot: LastAiResearchSnapshot): InsightsAiResearchResult {
	return {
		query: snapshot.query,
		summary: snapshot.summary,
		insights: snapshot.insights,
		articles: serializeResearchArticles(snapshot.articles),
		model: snapshot.model || 'gpt-4o-mini',
		warning: snapshot.warning,
		searchedAt: snapshot.timestamp,
	};
}

export function parseLastAiResearch(value: unknown): LastAiResearchSnapshot | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const query = asText(row.query);
	const summary = asText(row.summary);
	const articles = Array.isArray(row.articles)
		? row.articles
				.map((article, index) => normalizeAiResearchArticle(article, index))
				.filter((item): item is InsightsAiResearchArticle => Boolean(item))
		: [];
	if (!query || (!summary && articles.length === 0)) return null;
	const timestamp = typeof row.timestamp === 'number' && Number.isFinite(row.timestamp) ? row.timestamp : Date.now();
	const insights = Array.isArray(row.insights) ? row.insights.map(asText).filter(Boolean) : [];
	return {
		query,
		summary: summary || `${query} 관련 직전 리서치 결과입니다.`,
		insights,
		articles,
		timestamp,
		model: asText(row.model) || 'gpt-4o-mini',
		warning: asText(row.warning) || undefined,
	};
}

export function readLastAiResearch(): LastAiResearchSnapshot | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(LAST_AI_RESEARCH_KEY);
		if (!raw) return null;
		return parseLastAiResearch(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function writeLastAiResearch(
	result: InsightsAiResearchResult,
	timestamp = Date.now(),
): LastAiResearchSnapshot {
	const snapshot = snapshotFromResearchResult(result, timestamp);
	if (isBrowser() && snapshot.query) {
		try {
			window.localStorage.setItem(LAST_AI_RESEARCH_KEY, JSON.stringify(snapshot));
		} catch {
			/* private mode / quota */
		}
	}
	return snapshot;
}

export function clearLastAiResearch() {
	if (!isBrowser()) return;
	try {
		window.localStorage.removeItem(LAST_AI_RESEARCH_KEY);
	} catch {
		/* ignore */
	}
}
