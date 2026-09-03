import 'server-only';

import { hostnameAsSource, formatRelativeKo } from '@/lib/admin/geo-news-html';
import { isNaverNewsConfigured, searchNaverNews } from '@/lib/admin/geo-news-naver';
import { parseRssOrAtom } from '@/lib/admin/geo-news-rss';
import { canonicalizeNewsUrl } from '@/lib/admin/geo-news-dedupe';
import {
	INSIGHTS_AI_RESEARCH_SYSTEM,
	buildHeuristicResearchResult,
	extractJsonObjectFromText,
	normalizeAiResearchArticle,
	normalizeAiResearchResult,
	type InsightsAiResearchArticle,
	type InsightsAiResearchResult,
} from './insights-ai-research';
import { logInsightsFailure, redactInsightsLogText } from './insights-api-errors';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const NEWS_WINDOW = 'when:14d';
const COLLECT_TIMEOUT_MS = 8_000;
const OPENAI_TIMEOUT_MS = 25_000;
const USER_AGENT = 'REDUE-Studio/1.0 (insights-ai-research; +https://redue.ai)';

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

export function readOpenAiApiKey(): string {
	return envString('OPENAI_API_KEY');
}

function googleNewsRssUrl(query: string, locale: 'ko' | 'en'): string {
	const params = locale === 'ko' ? 'hl=ko&gl=KR&ceid=KR:ko' : 'hl=en-US&gl=US&ceid=US:en';
	const relaxed = query.replace(/"/g, '').replace(/\s+/g, ' ').trim();
	return `https://news.google.com/rss/search?q=${encodeURIComponent(`${relaxed} ${NEWS_WINDOW}`)}&${params}`;
}

function articleKey(url: string): string {
	return canonicalizeNewsUrl(url) || url.trim().toLowerCase();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, label: string): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		console.log(`[insights-ai-research] ${label} start`, { url: redactInsightsLogText(url.slice(0, 120)), timeoutMs });
		const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
		console.log(`[insights-ai-research] ${label} done`, { status: res.status });
		return res;
	} catch (error) {
		const aborted = error instanceof Error && error.name === 'AbortError';
		console.error(`[insights-ai-research] ${label} failed`, {
			aborted,
			message: redactInsightsLogText(error instanceof Error ? error.message : String(error)),
		});
		throw aborted ? new Error(`${label} timed out after ${timeoutMs}ms`) : error;
	} finally {
		clearTimeout(timer);
	}
}

function toResearchArticle(input: {
	title: string;
	snippet: string;
	url: string;
	publisher?: string;
	pubDate?: Date;
}): InsightsAiResearchArticle | null {
	const title = input.title.replace(/\s+/g, ' ').trim();
	const url = input.url.trim();
	if (!title || !/^https?:\/\//i.test(url)) return null;
	const pubDate = input.pubDate && !Number.isNaN(input.pubDate.getTime()) ? input.pubDate : null;
	return normalizeAiResearchArticle({
		title,
		url,
		publisher: (input.publisher || hostnameAsSource(url) || 'News').trim(),
		date: pubDate ? pubDate.toISOString() : '',
		snippet: (input.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 280),
	});
}

function buildFallbackArticles(query: string): InsightsAiResearchArticle[] {
	const now = new Date().toISOString();
	return [
		{
			title: `${query} — AI 검색·GEO 동향 브리핑`,
			url: 'https://searchengineland.com/',
			publisher: 'Search Engine Land',
			date: now,
			snippet: `${query}와 관련된 생성형 검색, AI 오버뷰, 브랜드 인용 이슈를 모니터링하세요.`,
		},
		{
			title: '생성형 엔진 최적화를 위한 엔티티·스키마 점검',
			url: 'https://developers.google.com/search/docs/appearance/structured-data',
			publisher: 'Google Search Central',
			date: now,
			snippet: '공식 문서의 구조화 데이터 가이드를 기준으로 Organization/FAQPage 신호를 맞춥니다.',
		},
		{
			title: 'llms.txt와 AI 크롤러 접근 정책',
			url: 'https://www.searchenginejournal.com/',
			publisher: 'Search Engine Journal',
			date: now,
			snippet: '답변 엔진이 원문을 인용하려면 크롤러 차단과 원문 URL 접근성을 확인해야 합니다.',
		},
	]
		.map((article, index) => normalizeAiResearchArticle(article, index))
		.filter((item): item is InsightsAiResearchArticle => Boolean(item));
}

async function collectFromGoogleNews(query: string): Promise<InsightsAiResearchArticle[]> {
	const jobs = [googleNewsRssUrl(query, 'ko'), googleNewsRssUrl(query, 'en')];
	const settled = await Promise.allSettled(
		jobs.map(async (url) => {
			const res = await fetchWithTimeout(
				url,
				{
					headers: {
						Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
						'User-Agent': USER_AGENT,
					},
				},
				COLLECT_TIMEOUT_MS,
				'google-news-rss',
			);
			if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
			return parseRssOrAtom(await res.text());
		}),
	);
	const out: InsightsAiResearchArticle[] = [];
	for (const result of settled) {
		if (result.status !== 'fulfilled') {
			console.error(
				'[insights-ai-research] google news job rejected',
				redactInsightsLogText(result.reason instanceof Error ? result.reason.message : String(result.reason)),
			);
			continue;
		}
		for (const item of result.value) {
			const mapped = toResearchArticle({
				title: item.title,
				snippet: item.snippet,
				url: item.link,
				publisher: item.sourceName,
				pubDate: item.pubDate,
			});
			if (mapped) out.push(mapped);
		}
	}
	console.log('[insights-ai-research] google news items', out.length);
	return out;
}

async function collectFromNaver(query: string): Promise<InsightsAiResearchArticle[]> {
	if (!isNaverNewsConfigured()) {
		console.log('[insights-ai-research] naver skipped — credentials missing');
		return [];
	}
	try {
		const items = await Promise.race([
			searchNaverNews(query, 8),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('naver timed out')), COLLECT_TIMEOUT_MS);
			}),
		]);
		const mapped = items
			.map((item) =>
				toResearchArticle({
					title: item.title,
					snippet: item.snippet,
					url: item.url,
					publisher: hostnameAsSource(item.url) || '네이버 뉴스',
					pubDate: item.pubDate,
				}),
			)
			.filter((item): item is InsightsAiResearchArticle => Boolean(item));
		console.log('[insights-ai-research] naver items', mapped.length);
		return mapped;
	} catch (error) {
		console.error(
			'[insights-ai-research] Naver search failed',
			redactInsightsLogText(error instanceof Error ? error.message : String(error)),
		);
		return [];
	}
}

export async function collectLatestResearchArticles(query: string): Promise<InsightsAiResearchArticle[]> {
	try {
		const collected = await Promise.race([
			Promise.all([collectFromGoogleNews(query), collectFromNaver(query)]).then(([google, naver]) => [
				...google,
				...naver,
			]),
			new Promise<InsightsAiResearchArticle[]>((_, reject) => {
				setTimeout(() => reject(new Error('collect timed out')), COLLECT_TIMEOUT_MS + 500);
			}),
		]);
		const byUrl = new Map<string, InsightsAiResearchArticle>();
		for (const article of collected) {
			const key = articleKey(article.url);
			const existing = byUrl.get(key);
			if (!existing || Date.parse(article.date) > Date.parse(existing.date || '')) {
				byUrl.set(key, article);
			}
		}
		const ranked = [...byUrl.values()]
			.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
			.slice(0, 5);
		console.log('[insights-ai-research] collected unique', ranked.length);
		return ranked;
	} catch (error) {
		console.error(
			'[insights-ai-research] collect failed — using fallback articles',
			redactInsightsLogText(error instanceof Error ? error.message : String(error)),
		);
		return [];
	}
}

async function analyzeWithGpt4oMini(
	query: string,
	articles: InsightsAiResearchArticle[],
	apiKey: string,
): Promise<InsightsAiResearchResult> {
	const userPrompt = [
		`검색 질의: ${query}`,
		'아래 최신 기사(최대 5건)만 근거로 분석하라.',
		JSON.stringify(
			articles.map((article) => ({
				title: article.title,
				url: article.url,
				publisher: article.publisher,
				date: article.date,
				snippet: article.snippet,
			})),
		),
	].join('\n');

	const res = await fetchWithTimeout(
		OPENAI_URL,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: MODEL,
				temperature: 0.3,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: INSIGHTS_AI_RESEARCH_SYSTEM },
					{ role: 'user', content: userPrompt },
				],
			}),
		},
		OPENAI_TIMEOUT_MS,
		'openai-chat',
	);

	const data = (await res.json().catch(() => null)) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	} | null;
	if (!res.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
	const content = data?.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty OpenAI response');
	console.log('[insights-ai-research] openai content chars', content.length);
	return normalizeAiResearchResult(extractJsonObjectFromText(content), articles, query, MODEL);
}

function formatArticleDates(articles: InsightsAiResearchArticle[]): InsightsAiResearchArticle[] {
	return articles.slice(0, 5).map((article, index) => {
		const displayDate =
			article.date && !Number.isNaN(Date.parse(article.date))
				? formatRelativeKo(new Date(article.date)) || article.date
				: article.date;
		return {
			...article,
			id: article.id || article.url || `ai_${index}`,
			date: displayDate,
			publishedAt: article.publishedAt || displayDate,
			summary: article.summary || article.snippet,
		};
	});
}

export async function runInsightsAiResearch(query: string, apiKey: string): Promise<InsightsAiResearchResult> {
	console.log('[insights-ai-research] run start', { query, hasKey: Boolean(apiKey) });
	let articles = await collectLatestResearchArticles(query);
	let collectWarning = '';
	if (articles.length === 0) {
		articles = buildFallbackArticles(query);
		collectWarning = '실시간 뉴스 수집이 지연되어 참고용 소스를 사용했습니다.';
		console.warn('[insights-ai-research] empty collect — fallback articles');
	}

	try {
		const analyzed = await analyzeWithGpt4oMini(query, articles, apiKey);
		const fallbackByUrl = new Map(articles.map((article) => [articleKey(article.url), article]));
		const merged = analyzed.articles.map((article) => {
			const fallback = fallbackByUrl.get(articleKey(article.url));
			return (
				normalizeAiResearchArticle({
					...fallback,
					...article,
					publisher: article.publisher || fallback?.publisher,
					date: article.date || fallback?.date,
					snippet: article.snippet || fallback?.snippet,
				}) || article
			);
		});
		console.log('[insights-ai-research] run success', { articles: (merged.length > 0 ? merged : articles).length });
		return {
			...analyzed,
			warning: collectWarning || undefined,
			articles: formatArticleDates(merged.length > 0 ? merged : articles),
		};
	} catch (error) {
		logInsightsFailure('insights-ai-research', error, { stage: 'provider' });
		return {
			...buildHeuristicResearchResult(
				query,
				formatArticleDates(articles),
				[collectWarning, 'AI Provider 요청에 실패해 약식 결과를 사용했습니다.'].filter(Boolean).join(' '),
			),
		};
	}
}
