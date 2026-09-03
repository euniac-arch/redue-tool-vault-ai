import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import type { AsiSovCategory, AsiWarRoomSite } from '@/lib/ai-search-intelligence/types';
import { ASI_SOV_CATEGORIES } from '@/lib/ai-search-intelligence/types';

export const ASI_SOV_DEFAULT_QUERY_LIMIT = 6;
export const ASI_SOV_MAX_QUERY_LIMIT = 24;

export type AsiSovQuery = {
	query: string;
	category: AsiSovCategory;
};

function phrase(...parts: Array<string | undefined>): string {
	return parts.map((part) => (part || '').trim()).filter(Boolean).join(' ');
}

/**
 * Intent templates filled from the current Target Context only.
 * Missing location / category is skipped — never replaced with a vertical default.
 */
export function buildAsiQuerySet(
	site: Pick<AsiWarRoomSite, 'brandName' | 'location' | 'category'>,
	options?: { extra?: readonly string[]; limit?: number },
): AsiSovQuery[] {
	const location = site.location?.trim() || '';
	const category = site.category?.trim() || '';
	const brand = site.brandName?.trim() || '';
	const subject = category || brand;
	const templates: Record<AsiSovCategory, string> = {
		discovery: phrase(location, category) || brand,
		recommend: phrase(location, subject, '추천') || phrase(brand, '추천'),
		compare: phrase(location, subject, '비교') || phrase(brand, '비교'),
		solve: phrase(subject, '문제 있으면 어디로'),
		purchase: phrase(location, subject, '비용') || phrase(brand, '비용'),
		local: location ? phrase(location, '근처', subject) : phrase(subject),
	};
	const extras = (options?.extra ?? []).map((query) => query.trim()).filter(Boolean);
	const rows: AsiSovQuery[] = [
		...ASI_SOV_CATEGORIES.map((intent) => ({ query: templates[intent], category: intent })),
		...extras.map((query) => ({ query, category: classifyAsiSovQuery(query) })),
	];
	if (brand) {
		rows.push({ query: `${brand} 후기`, category: 'discovery' });
	}
	const seen = new Set<string>();
	const unique: AsiSovQuery[] = [];
	for (const row of rows) {
		const query = row.query.trim();
		if (!query) continue;
		const key = query.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push({ ...row, query });
	}
	const limit = Math.max(1, Math.min(ASI_SOV_MAX_QUERY_LIMIT, options?.limit ?? ASI_SOV_DEFAULT_QUERY_LIMIT));
	return unique.slice(0, limit);
}
