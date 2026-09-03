import { INSIGHT_CATEGORY_LABEL, type InsightsNewsItem } from '@/lib/insights/insights-news-types';

export type ResearchScrap = {
	id: string;
	queryKeyword: string;
	articleTitle: string;
	source: string;
	articleUrl: string;
	aiSummary: string;
	scrappedAt: string;
	tag: string;
};

export function newsItemToResearchScrap(item: InsightsNewsItem): ResearchScrap {
	const tag = INSIGHT_CATEGORY_LABEL[item.category] || item.tags[0] || 'AI / SEO';
	return {
		id: item.id,
		queryKeyword: item.tags[0] || tag,
		articleTitle: item.title,
		source: item.sourceName || 'News',
		articleUrl: item.sourceUrl,
		aiSummary: item.summary || '저장된 인사이트 기사입니다.',
		scrappedAt: item.publishedAtIso ? item.publishedAtIso.slice(0, 10) : item.publishedAt,
		tag,
	};
}

export function filterResearchScraps(scraps: ResearchScrap[], query: string): ResearchScrap[] {
	const keyword = query.trim().toLowerCase();
	if (!keyword) return scraps;
	return scraps.filter(
		(scrap) =>
			scrap.articleTitle.toLowerCase().includes(keyword) ||
			scrap.queryKeyword.toLowerCase().includes(keyword) ||
			scrap.tag.toLowerCase().includes(keyword),
	);
}

export function normalizeResearchScrapUrl(url: string): string {
	const raw = url.trim();
	if (!raw) return '';
	try {
		const parsed = new URL(raw);
		parsed.hash = '';
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return raw.replace(/\/$/, '');
	}
}

export function mergeResearchScraps(local: ResearchScrap[], remote: ResearchScrap[] = []): ResearchScrap[] {
	const seen = new Set<string>();
	const merged: ResearchScrap[] = [];
	for (const item of [...local, ...remote]) {
		const key = normalizeResearchScrapUrl(item.articleUrl) || item.id;
		if (!key || seen.has(key)) continue;
		seen.add(key);
		merged.push(item);
	}
	return merged;
}
