/**
 * Orchestrates the daily AI ranking payload: load the live catalog from disk
 * (so admin refresh is visible), compute ranks / shares, and persist today's
 * snapshot for tomorrow's `previousRank`.
 */

import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import bundledCatalog from '@/data/aiToolsData.json';
import {
	AI_TOOL_CATEGORIES,
	flattenAiToolCategories,
	type AiTool,
	type AiToolCategoryRaw,
} from '@/lib/admin/ai-tools-management';
import {
	analyzeDailyRankings,
	computeDailyRankings,
	getKstDateKey,
	parseDateKey,
	shiftDateKey,
	toDailySnapshotRows,
	type DailyAiRankingsResponse,
	type DailyRankSnapshotRow,
} from '@/lib/ai-hub/live-ai-rankings';
import { readDailyRankingSnapshot, writeDailyRankingSnapshot } from '@/lib/ai-hub/daily-ai-rankings-store';
import { readPublishedMarketBundle, runAuthorizedMarketCheck, type MarketCheckRun } from '@/lib/ai-hub/market-observation-refresh';
import { applyPublicMarketView, listWebTrafficRows, marketCacheToken, type MarketBundle } from '@/lib/ai-hub/market-observations';

const DATA_FILE = path.join(process.cwd(), 'data', 'aiToolsData.json');

type MemorySlot = { date: string; includeHidden: boolean; payload: DailyAiRankingsResponse; builtAt: number };

const memory = new Map<string, MemorySlot>();

function memoryKey(date: string, includeHidden: boolean, marketToken: string): string {
	return `${date}:${includeHidden ? 'all' : 'public'}:${marketToken}`;
}

export async function readAiToolsCatalog(): Promise<AiToolCategoryRaw[]> {
	try {
		const raw = await fs.readFile(DATA_FILE, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (Array.isArray(parsed)) return parsed as AiToolCategoryRaw[];
	} catch {
		/* bundled import below */
	}
	return bundledCatalog as AiToolCategoryRaw[];
}

export async function loadCatalogTools(includeHidden: boolean): Promise<AiTool[]> {
	const categories = await readAiToolsCatalog();
	const tools = flattenAiToolCategories(categories);
	return includeHidden ? tools : tools.filter((tool) => tool.is_public);
}

function snapshotMap(rows: DailyRankSnapshotRow[] | undefined): Map<string, DailyRankSnapshotRow> {
	return new Map((rows ?? []).map((row) => [row.id, row]));
}

export async function getDailyAiRankingsPayload(options?: {
	date?: string | null;
	forceRefresh?: boolean;
	includeHidden?: boolean;
	runMarketCheck?: boolean;
}): Promise<DailyAiRankingsResponse> {
	const date = parseDateKey(options?.date) ?? getKstDateKey();
	const includeHidden = options?.includeHidden === true;
	let market: MarketBundle;
	let marketCheck: MarketCheckRun | null = null;
	if (options?.runMarketCheck) {
		try {
			marketCheck = await runAuthorizedMarketCheck();
			market = marketCheck.bundle;
		} catch (error) {
			console.error('[ai-market] daily check failed:', error instanceof Error ? error.message : error);
			market = await readPublishedMarketBundle();
		}
	} else {
		market = await readPublishedMarketBundle();
	}
	const key = memoryKey(date, includeHidden, marketCacheToken(market));

	if (!options?.forceRefresh) {
		const hit = memory.get(key);
		if (hit && hit.date === date) return hit.payload;
	}

	const [catalog, todaySnap, yesterdaySnap] = await Promise.all([
		loadCatalogTools(includeHidden),
		readDailyRankingSnapshot(date),
		readDailyRankingSnapshot(shiftDateKey(date, -1)),
	]);

	const updatedAt = new Date().toISOString();
	const previousById = snapshotMap(yesterdaySnap?.tools);
	const catalogIds = new Set(catalog.map((tool) => tool.id));
	const snapshotIds = new Set((todaySnap?.tools ?? []).map((row) => row.id));
	const catalogChanged =
		catalogIds.size !== snapshotIds.size || [...catalogIds].some((id) => !snapshotIds.has(id));
	const reuseToday = Boolean(!options?.forceRefresh && todaySnap && todaySnap.tools.length > 0 && !catalogChanged);
	const stamp = reuseToday && todaySnap ? todaySnap.updatedAt : updatedAt;
	const computed = computeDailyRankings(catalog, previousById, stamp, {
		hasYesterdaySnapshot: Boolean(yesterdaySnap && yesterdaySnap.tools.length > 0),
	});
	const tools = applyPublicMarketView(computed, market);

	if (!reuseToday) {
		try {
			await writeDailyRankingSnapshot({
				date,
				updatedAt,
				tools: toDailySnapshotRows(tools),
			});
		} catch (error) {
			console.warn('[ai-rankings] snapshot persist skipped:', error instanceof Error ? error.message : error);
		}
	}

	const categoryLabels = Object.fromEntries(AI_TOOL_CATEGORIES.map((category) => [category.id, category.label]));
	const trafficIds = listWebTrafficRows(market).map((row) => row.serviceId);
	const globalTop = trafficIds
		.map((id) => tools.find((tool) => tool.id === id))
		.filter((tool): tool is (typeof tools)[number] => Boolean(tool));
	const payload: DailyAiRankingsResponse = {
		date,
		updatedAt: stamp,
		source: 'verified-web-traffic+catalog',
		tools,
		market,
		marketPersistence: marketCheck?.persistence ?? null,
		analysis: {
			...analyzeDailyRankings(tools, categoryLabels),
			globalTop,
			topMover: null,
			newEntries: [],
			rising: [],
			topRising: null,
		},
		categories: AI_TOOL_CATEGORIES.filter((category) => tools.some((tool) => tool.category === category.id)),
	};

	memory.set(key, { date, includeHidden, payload, builtAt: Date.now() });
	return payload;
}

/** Called after the admin refresh writes a new catalog so today's ranks rebuild. */
export async function rebuildTodayAiRankings(): Promise<DailyAiRankingsResponse> {
	memory.clear();
	return getDailyAiRankingsPayload({ forceRefresh: true, includeHidden: true });
}
