import { throwIfAsiAborted } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';

export function capAsiQueries(queries: readonly string[], limit: number = ASI_GUARD.maxQueriesPerRequest): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of queries) {
		const query = raw.trim();
		if (!query) continue;
		const key = query.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(query);
		if (out.length >= limit) break;
	}
	return out;
}

export function chunkAsiBatch<T>(items: readonly T[], size: number = ASI_GUARD.batchSize): T[][] {
	const width = Math.max(1, size);
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += width) {
		batches.push(items.slice(i, i + width));
	}
	return batches;
}

export async function runAsiBatches<T, R>(
	items: readonly T[],
	each: (item: T, index: number) => Promise<R>,
	options?: { size?: number; concurrency?: number; signal?: AbortSignal },
): Promise<R[]> {
	const out: R[] = [];
	let index = 0;
	const width = Math.max(1, options?.concurrency ?? options?.size ?? ASI_GUARD.batchSize);
	for (const batch of chunkAsiBatch(items, width)) {
		throwIfAsiAborted(options?.signal);
		const started = index;
		const results = await Promise.all(
			batch.map((item, offset) => {
				throwIfAsiAborted(options?.signal);
				return each(item, started + offset);
			}),
		);
		out.push(...results);
		index += batch.length;
	}
	return out;
}
