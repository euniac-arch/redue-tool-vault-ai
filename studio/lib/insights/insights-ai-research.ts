import { formatRelativeKo } from '@/lib/admin/geo-news-html';
import { classifyArticleCategory } from './insights-news-classify';
import type { InsightsNewsItem } from './insights-news-types';

export type InsightsSearchMode = 'feed' | 'ai' | 'youtube';

export type InsightsAiResearchArticle = {
	id: string;
	title: string;
	url: string;
	publisher: string;
	date: string;
	snippet: string;
	publishedAt: string;
	summary: string;
};

export function resolveAiResearchArticleId(
	article: { id?: string | null; url?: string | null },
	index: number,
): string {
	const id = typeof article.id === 'string' ? article.id.trim() : '';
	const url = typeof article.url === 'string' ? article.url.trim() : '';
	return id || url || `ai_${index}`;
}

export type InsightsAiResearchResult = {
	query: string;
	summary: string;
	insights: string[];
	articles: InsightsAiResearchArticle[];
	model: string;
	warning?: string;
	searchedAt?: number;
};

export const INSIGHTS_AI_RESEARCH_SYSTEM = [
	'너는 AI SEO & GEO 전문 분석가이다.',
	'제공된 최신 기사들을 바탕으로 핵심 동향 요약(3~4줄)과 SEO/GEO 적용 시사점을 도출하고, 참조한 기사 목록을 JSON 형식으로 반환하라.',
	'없는 사실이나 URL을 만들지 말고, 입력된 기사만 인용하라.',
	'JSON 키: summary(string), insights(string[]), articles([{ title, url, publisher, date, snippet }]).',
].join(' ');

export function isInsightsProMember(planId?: string | null, role?: string | null): boolean {
	const plan = (planId || '').toLowerCase();
	const nextRole = (role || '').toLowerCase();
	return plan === 'pro' || plan === 'agency' || nextRole === 'admin';
}

/** Guests and members can start research. Daily cap is enforced separately. */
export function canUseInsightsAiResearch(_flags?: { isLoggedIn: boolean; isProMember: boolean }): boolean {
	return true;
}

export function extractJsonObjectFromText(text: string): unknown {
	const trimmed = String(text || '').trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
		throw new Error('Model did not return JSON');
	}
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(asString).filter((item) => item.length > 0).slice(0, 8);
}

export function normalizeAiResearchArticle(value: unknown, index = 0): InsightsAiResearchArticle | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const title = asString(row.title);
	const url = asString(row.url);
	if (!title || !/^https?:\/\//i.test(url)) return null;
	const date = asString(row.date) || asString(row.publishedAt);
	const snippet = asString(row.snippet) || asString(row.summary);
	const summary = asString(row.summary) || snippet || '원문에서 요약을 제공하지 않았습니다.';
	return {
		id: resolveAiResearchArticleId({ id: asString(row.id), url }, index),
		title,
		url,
		publisher: asString(row.publisher) || 'News',
		date,
		snippet: snippet.slice(0, 280),
		publishedAt: date,
		summary,
	};
}

export function normalizeAiResearchResult(
	raw: unknown,
	fallbackArticles: InsightsAiResearchArticle[] = [],
	query = '',
	model = 'gpt-4o-mini',
): InsightsAiResearchResult {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const fromModel = Array.isArray(body.articles)
		? body.articles
				.map((article, index) => normalizeAiResearchArticle(article, index))
				.filter((item): item is InsightsAiResearchArticle => Boolean(item))
		: [];
	const articles = (fromModel.length > 0 ? fromModel : fallbackArticles).slice(0, 5);
	const insights = asStringList(body.insights);
	return {
		query,
		summary: asString(body.summary) || '제공된 기사에서 핵심 동향을 추출하지 못했습니다.',
		insights:
			insights.length > 0
				? insights
				: ['인용된 기사를 기준으로 공식 페이지의 엔티티·스키마 신호를 점검하세요.'],
		articles,
		model,
	};
}

export function buildHeuristicResearchResult(
	query: string,
	articles: InsightsAiResearchArticle[],
	warning: string,
): InsightsAiResearchResult {
	const titles = articles.map((article) => article.title).filter(Boolean);
	const lead = titles[0] ? `가장 최근 헤드라인은 “${titles[0]}”입니다. ` : '';
	return {
		query,
		summary: `${query} 관련 최신 기사 ${articles.length}건을 확보했습니다. ${lead}모델 분석이 지연되어 수집된 헤드라인·요약을 기준으로 SEO/GEO 관점만 정리했습니다.`,
		insights: [
			'공식 페이지의 브랜드 엔티티·Organization/LocalBusiness 스키마가 기사 속 명칭과 일치하는지 확인하세요.',
			'AI 오버뷰·답변 엔진 인용을 위해 FAQPage와 1페이지 1주제 구조를 유지하세요.',
			'llms.txt와 원문 URL이 막히지 않았는지 크롤러 접근을 점검하세요.',
		],
		articles,
		model: 'heuristic',
		warning,
	};
}

export function researchArticleToNewsItem(article: InsightsAiResearchArticle, index: number): InsightsNewsItem {
	const publishedSource = article.publishedAt || article.date;
	const published = publishedSource ? new Date(publishedSource) : new Date(0);
	const publishedAtIso = Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString();
	const summary = article.summary || article.snippet || '원문에서 요약을 제공하지 않았습니다.';
	const id = resolveAiResearchArticleId(article, index);
	return {
		id,
		title: article.title,
		summary,
		sourceName: article.publisher,
		sourceUrl: article.url,
		guid: null,
		region: /[가-힣]{2,}/.test(`${article.title} ${article.publisher}`) ? 'KR' : 'GLOBAL',
		// `publishedSource` is whatever raw date string the model/scraper returned
		// (often a bare ISO timestamp, e.g. "2026-09-01T06:10:00.000Z") — never show
		// that as-is. Format it the same way the regular news feed does: a relative
		// Korean label ('3시간 전', '어제', ...), falling back to the ISO string only
		// if the date genuinely couldn't be parsed.
		publishedAt: formatRelativeKo(published) || publishedAtIso,
		publishedAtIso,
		category: classifyArticleCategory(article.title, summary),
		categories: [],
		tags: [],
	};
}
