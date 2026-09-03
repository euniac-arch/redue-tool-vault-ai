import { appendAsiCitationStore, readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { isAsiPersistEnabled } from '@/lib/ai-search-intelligence/persist/enabled';
import { tryReadAsiHistoryKind } from '@/lib/ai-search-intelligence/persist/fs-store';
import {
	readPersistedCompetitorObservations,
	readPersistedResponses,
	readPersistedVisibilityRecords,
} from '@/lib/ai-search-intelligence/persist/repository';
import { asiHistoryHydrated, markAsiHistoryHydrated } from '@/lib/ai-search-intelligence/persist/state';
import { appendAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import { appendAsiVisibilityStore, readAsiVisibilityStore } from '@/lib/ai-search-intelligence/visibility/store';

function domainKey(domain: string): string {
	return domain.trim().toLowerCase();
}

function historyReadsOk(domain: string): boolean {
	return (['observation', 'competitor', 'visibility'] as const).every((kind) => tryReadAsiHistoryKind(domain, kind).ok);
}

/** Load durable history into process memory once per domain. Failed I/O does not mark hydrated. */
export function hydrateAsiHistory(domain: string, extras?: { brand?: string; url?: string; aliases?: readonly string[] }) {
	const key = domainKey(domain);
	if (!key || asiHistoryHydrated(key) || !isAsiPersistEnabled()) return;
	try {
		if (!historyReadsOk(key)) return;

		const brand = extras?.brand || key.split('.')[0] || key;
		const aliases = extras?.aliases ?? brandAliases(brand, key);
		const url = extras?.url || `https://${key}`;
		const responses = readPersistedResponses(key);
		if (responses.length && readAsiCitationStore(key).responses.length === 0) {
			appendAsiSovStore(key, responses, { brand, aliases });
			appendAsiCitationStore(key, responses, { brand, siteUrl: url, aliases });
		}
		syncCompetitorRepository(key, {
			brand,
			aliases,
			observations: readPersistedCompetitorObservations(key),
		});

		if (readAsiVisibilityStore(key).length === 0) {
			for (const record of readPersistedVisibilityRecords(key)) {
				appendAsiVisibilityStore(key, record, { persist: false });
			}
		}
		markAsiHistoryHydrated(key);
	} catch {
		/* leave unmarked so the next request retries hydration */
	}
}
