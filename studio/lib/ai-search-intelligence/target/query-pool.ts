/**
 * Common Query Dataset. Queries are built from Target Context only —
 * industry / location / service / audience / brand / intent.
 * No site-specific strings. No invented fallbacks.
 */
import { asiDatasetScopeKey } from '@/lib/ai-search-intelligence/competitors/scope';
import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import {
	ASI_SOV_DEFAULT_QUERY_LIMIT,
	ASI_SOV_MAX_QUERY_LIMIT,
	type AsiSovQuery,
} from '@/lib/ai-search-intelligence/sov/query-set';
import {
	generateUniversalQueries,
	type UniversalQueryResult,
} from '@/lib/ai-search-intelligence/query-intelligence/generate';
import {
	targetContextFromSite,
	type AsiTargetContext,
} from '@/lib/ai-search-intelligence/target/context';
import type {
	AsiQueryContextReport,
	AsiQueryGenerationStatus,
	AsiQuestionInput,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

export type AsiQueryPoolItem = AsiSovQuery & {
	source: 'target' | 'service' | 'competitor' | 'extra';
};

export type AsiQueryPoolOptions = {
	extra?: readonly string[];
	competitors?: readonly string[];
	limit?: number;
	hasQuestionOverrides?: boolean;
};

export type AsiQueryDataset = {
	status: AsiQueryGenerationStatus;
	context: AsiQueryContextReport;
	items: AsiQueryPoolItem[];
	generatedAt: string;
	domain: string;
};

const STORE = new Map<string, AsiQueryPoolItem[]>();
const DATASETS = new Map<string, AsiQueryDataset>();

function keyFor(domain: string): string {
	return asiDatasetScopeKey(domain);
}

function phrase(...parts: Array<string | undefined>): string {
	return parts.map((part) => (part || '').trim()).filter(Boolean).join(' ');
}

function pushUnique(
	rows: AsiQueryPoolItem[],
	seen: Set<string>,
	item: AsiQueryPoolItem,
) {
	const text = item.query.trim();
	if (!text) return;
	const key = text.toLowerCase();
	if (seen.has(key)) return;
	seen.add(key);
	rows.push({ ...item, query: text });
}

export function defaultRecommendQuery(
	input: Pick<AsiTargetContext, 'brandName' | 'location' | 'category' | 'services'>,
): string {
	const location = input.location?.trim() || '';
	const category = input.category?.trim() || input.services?.[0]?.trim() || '';
	const brand = input.brandName?.trim() || '';
	if (location && category) return `${location} ${category} 추천`;
	if (category) return `${category} 추천`;
	if (location && brand) return `${location} ${brand} 추천`;
	if (brand) return `${brand} 추천`;
	return '';
}

/** Natural-language example for the Search Simulator. Uses only known Target Context. */
export function exampleSearchQuery(
	input: Pick<AsiTargetContext, 'brandName' | 'location' | 'category' | 'services'>,
): string {
	const location = input.location?.trim() || '';
	const subject = input.category?.trim() || input.services?.[0]?.trim() || '';
	const brand = input.brandName?.trim() || '';
	if (location && subject) return `${location}에서 ${subject} 잘하는 곳 추천해줘`;
	if (subject) return `${subject} 잘하는 곳 추천해줘`;
	if (location && brand) return `${location}에서 ${brand} 같은 곳 추천해줘`;
	if (brand) return `${brand} 추천해줘`;
	return '';
}

function datasetFromResult(
	context: AsiTargetContext,
	result: UniversalQueryResult,
	items: AsiQueryPoolItem[],
): AsiQueryDataset {
	return {
		status: result.status,
		context: result.context,
		items,
		generatedAt: new Date().toISOString(),
		domain: context.domain,
	};
}

export function buildAsiQueryPool(
	context: AsiTargetContext,
	options?: AsiQueryPoolOptions,
): AsiQueryPoolItem[] {
	const limit = Math.max(1, Math.min(ASI_SOV_MAX_QUERY_LIMIT, options?.limit ?? ASI_SOV_DEFAULT_QUERY_LIMIT));
	const competitorSlots = Math.min(2, (options?.competitors ?? []).filter((item) => item.trim()).length) * 2;
	const extraSlots = (options?.extra ?? []).filter((item) => item.trim()).length;
	const coreLimit = Math.max(4, ASI_SOV_MAX_QUERY_LIMIT - competitorSlots - extraSlots);
	const generated = generateUniversalQueries(context, {
		limit: coreLimit,
		hasQuestionOverrides: options?.hasQuestionOverrides,
	});
	const seen = new Set<string>();
	const rows: AsiQueryPoolItem[] = [];

	for (const item of generated.items) {
		pushUnique(rows, seen, {
			query: item.query,
			category: item.category,
			source: item.intent === 'service' ? 'service' : 'target',
		});
	}

	for (const name of (options?.competitors ?? []).slice(0, 2)) {
		const competitor = name.trim();
		if (!competitor) continue;
		pushUnique(rows, seen, {
			query: phrase(context.brandName, 'vs', competitor),
			category: 'compare',
			source: 'competitor',
		});
		pushUnique(rows, seen, {
			query: phrase(context.location, competitor),
			category: 'discovery',
			source: 'competitor',
		});
	}

	for (const raw of options?.extra ?? []) {
		const query = raw.trim();
		if (!query) continue;
		pushUnique(rows, seen, {
			query,
			category: classifyAsiSovQuery(query),
			source: 'extra',
		});
	}

	return sliceQueryPool(rows, limit);
}

export function queryPoolFromSite(
	site: AsiWarRoomSite,
	options?: AsiQueryPoolOptions & {
		services?: readonly string[];
		questions?: Partial<AsiQuestionInput>;
	},
): AsiQueryPoolItem[] {
	return buildAsiQueryPool(
		targetContextFromSite(site, {
			services: options?.services,
			questions: options?.questions,
		}),
		options,
	);
}

function sliceQueryPool(rows: AsiQueryPoolItem[], limit: number): AsiQueryPoolItem[] {
	if (rows.length <= limit) return rows;
	const competitors = rows.filter((item) => item.source === 'competitor');
	const extras = rows.filter((item) => item.source === 'extra');
	const core = rows.filter((item) => item.source !== 'competitor' && item.source !== 'extra');
	const reserved = Math.min(limit - 1, competitors.length + extras.length);
	return [...core.slice(0, Math.max(1, limit - reserved)), ...competitors, ...extras].slice(0, limit);
}

export function syncAsiQueryPool(
	context: AsiTargetContext,
	options?: AsiQueryPoolOptions,
): AsiQueryPoolItem[] {
	const requested = Math.max(1, Math.min(ASI_SOV_MAX_QUERY_LIMIT, options?.limit ?? ASI_SOV_DEFAULT_QUERY_LIMIT));
	const full = buildAsiQueryPool(context, { ...options, limit: ASI_SOV_MAX_QUERY_LIMIT });
	STORE.set(keyFor(context.domain), full);
	const generated = generateUniversalQueries(context, {
		limit: ASI_SOV_MAX_QUERY_LIMIT,
		hasQuestionOverrides: options?.hasQuestionOverrides,
	});
	DATASETS.set(keyFor(context.domain), datasetFromResult(context, generated, full));
	return sliceQueryPool(full, requested);
}

export function readAsiQueryPool(domain: string): AsiQueryPoolItem[] {
	return [...(STORE.get(keyFor(domain)) ?? [])];
}

export function readAsiQueryDataset(domain: string): AsiQueryDataset | null {
	const stored = DATASETS.get(keyFor(domain));
	if (!stored) return null;
	return { ...stored, items: [...stored.items] };
}

export function clearAsiQueryPool(domain?: string) {
	if (!domain) {
		STORE.clear();
		DATASETS.clear();
		return;
	}
	STORE.delete(keyFor(domain));
	DATASETS.delete(keyFor(domain));
}
