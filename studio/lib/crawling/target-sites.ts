import type { TargetSite } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
	extractContactInfo,
	mapWithConcurrency,
	normalizePhoneNumber,
	phoneIdentityKey,
	phoneLookupVariants,
	type ExtractedContactInfo,
} from '@/lib/crawling/contact-info';
import {
	evaluatePagesLocation,
	isKrMetroRegion,
	targetRegionFromKeyword,
	type KrMetroRegion,
	type LocationEvaluation,
} from '@/lib/crawling/location-filter';
import {
	extractRootDomain,
	isDefaultBlacklistedDomain,
} from '@/lib/crawling/domain';
import { assertPublicHttpUrl, UnsafeAuditUrlError } from '@/lib/ssrf-guard';

/** SQLite stores status as TEXT; this union is the application-level ENUM. */
export const TARGET_SITE_STATUSES = [
	'PENDING',
	'DIAGNOSED',
	'CONTACTED',
	'EXCLUDED',
] as const;

export type TargetSiteStatus = (typeof TARGET_SITE_STATUSES)[number];

/** Statuses that must never be re-queued as a new PENDING lead. */
export const SKIP_NEW_COLLECTION_STATUSES: ReadonlySet<TargetSiteStatus> = new Set([
	'EXCLUDED',
	'DIAGNOSED',
	'CONTACTED',
]);

const MAX_STORED_KEYWORDS = 50;

export type DiscoveredTargetSaveInput = {
	url: string;
	keyword?: string;
	phoneNumber?: string | null;
	address?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
};

export type TargetPersistSkipReason =
	| 'invalid_url'
	| 'blacklist'
	| 'excluded'
	| 'diagnosed'
	| 'contacted'
	| 'location_mismatch'
	| 'phone_duplicate';

export type TargetPersistRow = {
	domain: string;
	originalUrl: string;
	status: TargetSiteStatus;
	action: 'inserted' | 'updated' | 'skipped';
	reason?: TargetPersistSkipReason;
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
};

export type SaveDiscoveredTargetsResult = {
	inserted: TargetPersistRow[];
	updated: TargetPersistRow[];
	skipped: TargetPersistRow[];
};

export type SaveDiscoveredTargetsOptions = {
	/** Fallback keyword applied to every item that does not carry its own. */
	keyword?: string;
	/**
	 * After upsert, scrape homepage / contact pages for email + form URL.
	 * Defaults to true. Pass false from unit tests that must not hit the network.
	 */
	enrichContact?: boolean;
	/** Max parallel contact scrapes (default 4). */
	contactConcurrency?: number;
	/** Stop starting new contact scrapes after this budget (default 25s). */
	contactBudgetMs?: number;
	/**
	 * Metro used for address validation (e.g. "부산"). When omitted, derived
	 * from `keyword` ("부산 판매" → 부산). Non-KR / unknown keywords skip the filter.
	 */
	targetRegion?: string | null;
};

const DEFAULT_CONTACT_CONCURRENCY = 4;
const DEFAULT_CONTACT_BUDGET_MS = 25_000;

function asInput(item: string | DiscoveredTargetSaveInput): DiscoveredTargetSaveInput {
	return typeof item === 'string' ? { url: item } : item;
}

export function parseSearchKeywords(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((value): value is string => typeof value === 'string')
			.map((value) => value.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

export function serializeSearchKeywords(keywords: string[]): string {
	return JSON.stringify(keywords.slice(0, MAX_STORED_KEYWORDS));
}

export function mergeSearchKeywords(existingRaw: string, incoming: string[]): string {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const keyword of [...parseSearchKeywords(existingRaw), ...incoming]) {
		const trimmed = keyword.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(trimmed);
		if (merged.length >= MAX_STORED_KEYWORDS) break;
	}
	return serializeSearchKeywords(merged);
}

function skipReasonForStatus(status: TargetSiteStatus): TargetPersistSkipReason | undefined {
	if (status === 'EXCLUDED') return 'excluded';
	if (status === 'DIAGNOSED') return 'diagnosed';
	if (status === 'CONTACTED') return 'contacted';
	return undefined;
}

export function parseTargetSiteStatus(value: string): TargetSiteStatus {
	if ((TARGET_SITE_STATUSES as readonly string[]).includes(value)) {
		return value as TargetSiteStatus;
	}
	return 'PENDING';
}

function toRow(
	site: Pick<TargetSite, 'domain' | 'originalUrl' | 'status'> & {
		checkLocationNeeded?: boolean;
		parsedAddress?: string | null;
	},
	action: TargetPersistRow['action'],
	reason?: TargetPersistSkipReason,
): TargetPersistRow {
	return {
		domain: site.domain,
		originalUrl: site.originalUrl,
		status: parseTargetSiteStatus(site.status),
		action,
		reason,
		checkLocationNeeded: Boolean(site.checkLocationNeeded),
		parsedAddress: site.parsedAddress ?? null,
	};
}

function placesUpdateData(hit: {
	phoneNumber?: string | null;
	address?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
}) {
	const phone = hit.phoneNumber ? normalizePhoneNumber(hit.phoneNumber) || hit.phoneNumber : null;
	return {
		...(phone ? { phoneNumber: phone } : {}),
		...(hit.address ? { address: hit.address } : {}),
		...(hit.googleRating != null ? { googleRating: hit.googleRating } : {}),
		...(hit.googleReviewCount != null ? { googleReviewCount: hit.googleReviewCount } : {}),
	};
}

async function findTargetSitesByPhoneKeys(keys: string[]): Promise<TargetSite[]> {
	const variants = new Set<string>();
	for (const key of keys) {
		for (const variant of phoneLookupVariants(key)) variants.add(variant);
	}
	const list = Array.from(variants);
	if (list.length === 0) return [];
	return prisma.targetSite.findMany({
		where: { phoneNumber: { in: list } },
	});
}

/**
 * Persist search-engine / Places discovery hits at root-domain granularity.
 *
 * - New domains → INSERT `PENDING`
 * - Existing `EXCLUDED` / `DIAGNOSED` / `CONTACTED` → skip as new leads;
 *   only `lastSearchedAt` + keyword history are updated (status unchanged)
 * - Existing `PENDING` → same timestamp/keyword update, no duplicate row
 * - Same phone number (different domain) → skip as `phone_duplicate`
 * - Default portal/marketplace domains (amazon, google, wikipedia, …) are dropped
 */
export async function saveDiscoveredTargets(
	items: Array<string | DiscoveredTargetSaveInput>,
	options: SaveDiscoveredTargetsOptions = {},
): Promise<SaveDiscoveredTargetsResult> {
	const result: SaveDiscoveredTargetsResult = {
		inserted: [],
		updated: [],
		skipped: [],
	};

	type NormalizedHit = {
		domain: string;
		originalUrl: string;
		keywords: string[];
		phoneNumber?: string | null;
		address?: string | null;
		googleRating?: number | null;
		googleReviewCount?: number | null;
	};

	const byDomain = new Map<string, NormalizedHit>();
	const phoneOwner = new Map<string, string>();

	for (const raw of items) {
		const item = asInput(raw);
		const url = typeof item.url === 'string' ? item.url.trim() : '';
		const domain = extractRootDomain(url);
		if (!url || !domain) {
			result.skipped.push({
				domain: url || '',
				originalUrl: url,
				status: 'PENDING',
				action: 'skipped',
				reason: 'invalid_url',
			});
			continue;
		}
		if (isDefaultBlacklistedDomain(url) || isDefaultBlacklistedDomain(domain)) {
			result.skipped.push({
				domain,
				originalUrl: url,
				status: 'EXCLUDED',
				action: 'skipped',
				reason: 'blacklist',
			});
			continue;
		}

		const keywords = [item.keyword, options.keyword]
			.filter((value): value is string => typeof value === 'string')
			.map((value) => value.trim())
			.filter(Boolean);

		const phoneKey = phoneIdentityKey(item.phoneNumber);
		if (phoneKey) {
			const owner = phoneOwner.get(phoneKey);
			if (owner && owner !== domain) {
				result.skipped.push({
					domain,
					originalUrl: url,
					status: 'PENDING',
					action: 'skipped',
					reason: 'phone_duplicate',
				});
				continue;
			}
			phoneOwner.set(phoneKey, domain);
		}

		const prev = byDomain.get(domain);
		if (prev) {
			prev.keywords = [
				...prev.keywords,
				...keywords.filter((kw) => !prev.keywords.includes(kw)),
			];
			prev.phoneNumber = prev.phoneNumber || item.phoneNumber;
			prev.address = prev.address || item.address;
			prev.googleRating = prev.googleRating ?? item.googleRating;
			prev.googleReviewCount = prev.googleReviewCount ?? item.googleReviewCount;
			continue;
		}
		byDomain.set(domain, {
			domain,
			originalUrl: url,
			keywords,
			phoneNumber: item.phoneNumber,
			address: item.address,
			googleRating: item.googleRating,
			googleReviewCount: item.googleReviewCount,
		});
	}

	if (byDomain.size === 0) return result;

	const domains = Array.from(byDomain.keys());
	const existingRows = await prisma.targetSite.findMany({
		where: { domain: { in: domains } },
	});
	const existingByDomain = new Map(existingRows.map((row) => [row.domain, row]));

	const phoneKeys = Array.from(phoneOwner.keys());
	const existingPhoneRows =
		phoneKeys.length > 0 ? await findTargetSitesByPhoneKeys(phoneKeys) : [];
	const existingByPhone = new Map<string, TargetSite>();
	for (const row of existingPhoneRows) {
		const key = phoneIdentityKey(row.phoneNumber);
		if (!key) continue;
		if (!existingByPhone.has(key)) existingByPhone.set(key, row);
	}

	const now = new Date();
	const upsertHits: NormalizedHit[] = [];

	for (const hit of byDomain.values()) {
		const phoneKey = phoneIdentityKey(hit.phoneNumber);
		const phoneMatch = phoneKey ? existingByPhone.get(phoneKey) : undefined;
		if (phoneMatch && phoneMatch.domain !== hit.domain && !existingByDomain.has(hit.domain)) {
			result.skipped.push({
				domain: hit.domain,
				originalUrl: hit.originalUrl,
				status: parseTargetSiteStatus(phoneMatch.status),
				action: 'skipped',
				reason: skipReasonForStatus(parseTargetSiteStatus(phoneMatch.status)) || 'phone_duplicate',
			});
			try {
				await prisma.targetSite.update({
					where: { domain: phoneMatch.domain },
					data: {
						lastSearchedAt: now,
						searchKeywords: mergeSearchKeywords(phoneMatch.searchKeywords, hit.keywords),
						...placesUpdateData({
							googleRating: hit.googleRating,
							googleReviewCount: hit.googleReviewCount,
						}),
					},
				});
			} catch {
				/* existing phone row may have been removed */
			}
			continue;
		}
		upsertHits.push(hit);
	}

	if (upsertHits.length === 0) return result;

	const saved = await prisma.$transaction(
		upsertHits.map((hit) => {
			const existing = existingByDomain.get(hit.domain);
			const extras = placesUpdateData(hit);
			const createPhone = extras.phoneNumber;
			const createAddress = extras.address;
			return prisma.targetSite.upsert({
				where: { domain: hit.domain },
				create: {
					domain: hit.domain,
					originalUrl: hit.originalUrl,
					status: 'PENDING',
					searchKeywords: serializeSearchKeywords(hit.keywords),
					lastSearchedAt: now,
					...(createPhone ? { phoneNumber: createPhone } : {}),
					...(createAddress ? { address: createAddress } : {}),
					...(hit.googleRating != null ? { googleRating: hit.googleRating } : {}),
					...(hit.googleReviewCount != null
						? { googleReviewCount: hit.googleReviewCount }
						: {}),
				},
				update: {
					lastSearchedAt: now,
					searchKeywords: existing
						? mergeSearchKeywords(existing.searchKeywords, hit.keywords)
						: serializeSearchKeywords(hit.keywords),
					...(hit.googleRating != null ? { googleRating: hit.googleRating } : {}),
					...(hit.googleReviewCount != null
						? { googleReviewCount: hit.googleReviewCount }
						: {}),
					...(!existing?.phoneNumber && createPhone ? { phoneNumber: createPhone } : {}),
					...(!existing?.address && createAddress ? { address: createAddress } : {}),
				},
			});
		}),
	);

	for (const site of saved) {
		const wasExisting = existingByDomain.has(site.domain);
		if (!wasExisting && parseTargetSiteStatus(site.status) === 'PENDING') {
			result.inserted.push(toRow(site, 'inserted'));
			continue;
		}
		result.updated.push(
			toRow(site, 'updated', skipReasonForStatus(parseTargetSiteStatus(site.status))),
		);
	}

	if (options.enrichContact !== false) {
		const targetRegion =
			options.targetRegion !== undefined
				? options.targetRegion
				: targetRegionFromKeyword(options.keyword || '');
		const enrichTargets = saved.filter((site) => {
			const previous = existingByDomain.get(site.domain);
			if (parseTargetSiteStatus(site.status) === 'EXCLUDED') return false;
			if (SKIP_NEW_COLLECTION_STATUSES.has(parseTargetSiteStatus(site.status))) return false;
			if (!previous) return true;
			return !site.email && !site.lastScrapedAt;
		});
		if (enrichTargets.length > 0) {
			const enriched = await enrichTargetSitesContactInfo(
				enrichTargets.map((site) => site.originalUrl),
				{
					concurrency: options.contactConcurrency,
					budgetMs: options.contactBudgetMs,
					targetRegion,
				},
			);
			applyLocationEnrichmentToResult(result, enriched);
		}
	}

	return result;
}

function applyLocationEnrichmentToResult(
	result: SaveDiscoveredTargetsResult,
	enriched: PersistContactInfoResult[],
) {
	const byDomain = new Map(enriched.map((row) => [row.domain, row]));
	const keepInserted: TargetPersistRow[] = [];
	for (const row of result.inserted) {
		const info = byDomain.get(row.domain);
		if (!info) {
			keepInserted.push(row);
			continue;
		}
		const next: TargetPersistRow = {
			...row,
			status: info.status ?? row.status,
			checkLocationNeeded: info.checkLocationNeeded,
			parsedAddress: info.parsedAddress,
			reason: info.status === 'EXCLUDED' ? 'location_mismatch' : row.reason,
			action: info.status === 'EXCLUDED' ? 'skipped' : row.action,
		};
		if (info.status === 'EXCLUDED') {
			result.skipped.push(next);
		} else {
			keepInserted.push(next);
		}
	}
	result.inserted = keepInserted;
	result.updated = result.updated.map((row) => {
		const info = byDomain.get(row.domain);
		if (!info) return row;
		return {
			...row,
			status: info.status ?? row.status,
			checkLocationNeeded: info.checkLocationNeeded,
			parsedAddress: info.parsedAddress,
			reason:
				info.status === 'EXCLUDED'
					? 'location_mismatch'
					: row.reason,
		};
	});
}

export type PersistContactInfoResult = {
	domain: string;
	email: string | null;
	contactFormUrl: string | null;
	lastScrapedAt: Date | null;
	ok: boolean;
	status?: TargetSiteStatus;
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
	locationVerdict?: LocationEvaluation['verdict'];
	phoneNumber?: string | null;
	address?: string | null;
	kakaoChannelUrl?: string | null;
	instagramUrl?: string | null;
	naverTalkUrl?: string | null;
};

function locationUpdateData(
	evaluation: LocationEvaluation,
	currentStatus: TargetSiteStatus,
): {
	parsedAddress: string | null;
	checkLocationNeeded: boolean;
	status?: TargetSiteStatus;
} {
	const canExclude =
		evaluation.verdict === 'out_of_region' && currentStatus === 'PENDING';
	return {
		parsedAddress: evaluation.parsedAddress,
		checkLocationNeeded: evaluation.checkLocationNeeded,
		...(canExclude ? { status: 'EXCLUDED' as const } : {}),
	};
}

function scrapedContactUpdateData(
	info: ExtractedContactInfo,
	locationFields: ReturnType<typeof locationUpdateData> | null,
) {
	const resolvedAddress = info.address || locationFields?.parsedAddress || null;
	return {
		...(info.email ? { email: info.email } : {}),
		...(info.contactFormUrl ? { contactFormUrl: info.contactFormUrl } : {}),
		...(info.phoneNumber ? { phoneNumber: info.phoneNumber } : {}),
		...(info.kakaoChannelUrl ? { kakaoChannelUrl: info.kakaoChannelUrl } : {}),
		...(info.instagramUrl ? { instagramUrl: info.instagramUrl } : {}),
		...(info.naverTalkUrl ? { naverTalkUrl: info.naverTalkUrl } : {}),
		...(resolvedAddress ? { address: resolvedAddress } : {}),
		...(locationFields
			? {
					parsedAddress: locationFields.parsedAddress,
					checkLocationNeeded: locationFields.checkLocationNeeded,
					...(locationFields.status ? { status: locationFields.status } : {}),
				}
			: resolvedAddress
				? { parsedAddress: resolvedAddress }
				: {}),
	};
}

function contactExtrasFromInfo(info: ExtractedContactInfo) {
	return {
		phoneNumber: info.phoneNumber,
		address: info.address,
		kakaoChannelUrl: info.kakaoChannelUrl,
		instagramUrl: info.instagramUrl,
		naverTalkUrl: info.naverTalkUrl,
	};
}

function resolveTargetRegion(
	raw: string | null | undefined,
): KrMetroRegion | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (isKrMetroRegion(trimmed)) return trimmed;
	return targetRegionFromKeyword(trimmed);
}

/**
 * Scrape one URL and write email / contact_form_url / last_scraped_at
 * onto the matching `target_sites` row (update-only; missing rows are skipped).
 */
export async function persistContactInfoForUrl(
	url: string,
	options: { targetRegion?: string | null } = {},
): Promise<PersistContactInfoResult | null> {
	const domain = extractRootDomain(url);
	if (!domain) return null;

	const targetRegion = resolveTargetRegion(options.targetRegion);
	let info: ExtractedContactInfo;
	try {
		info = await extractContactInfo(url, {
			collectLocationPages: Boolean(targetRegion),
			targetRegion,
		});
	} catch (error) {
		console.warn(
			'[target_sites] contact extract failed:',
			domain,
			error instanceof Error ? error.message : error,
		);
		return { domain, email: null, contactFormUrl: null, lastScrapedAt: null, ok: false };
	}

	const existing = await prisma.targetSite.findUnique({ where: { domain } });
	if (!existing) {
		return {
			domain,
			email: info.email,
			contactFormUrl: info.contactFormUrl,
			lastScrapedAt: info.lastScrapedAt,
			ok: false,
		};
	}

	const currentStatus = parseTargetSiteStatus(existing.status);
	const location = targetRegion ? evaluatePagesLocation(info.pages, targetRegion) : null;
	const locationFields = location ? locationUpdateData(location, currentStatus) : null;

	try {
		const updated = await prisma.targetSite.update({
			where: { domain },
			data: {
				...scrapedContactUpdateData(info, locationFields),
				...(info.pagesVisited.length > 0 ? { lastScrapedAt: info.lastScrapedAt } : {}),
			},
		});
		if (location) {
			console.log('📍 [target_sites location]:', {
				domain,
				verdict: location.verdict,
				address: location.parsedAddress,
				checkLocationNeeded: location.checkLocationNeeded,
				status: updated.status,
			});
		}
		return {
			domain,
			email: info.email,
			contactFormUrl: info.contactFormUrl,
			lastScrapedAt: info.pagesVisited.length > 0 ? info.lastScrapedAt : null,
			ok: true,
			status: parseTargetSiteStatus(updated.status),
			checkLocationNeeded: location?.checkLocationNeeded ?? false,
			parsedAddress: location?.parsedAddress ?? info.address ?? null,
			locationVerdict: location?.verdict,
			...contactExtrasFromInfo(info),
			address: info.address || location?.parsedAddress || null,
		};
	} catch (error) {
		console.warn(
			'[target_sites] contact persist skipped (row missing?):',
			domain,
			error instanceof Error ? error.message : error,
		);
		return {
			domain,
			email: info.email,
			contactFormUrl: info.contactFormUrl,
			lastScrapedAt: info.lastScrapedAt,
			ok: false,
		};
	}
}

/**
 * Upsert contact fields for a crawled URL. Creates a PENDING lead when the
 * domain is new (manual / hybrid scan path).
 */
export async function upsertTargetSiteContactInfo(
	url: string,
	options: { targetRegion?: string | null } = {},
): Promise<PersistContactInfoResult | null> {
	const domain = extractRootDomain(url);
	if (!domain || isDefaultBlacklistedDomain(url) || isDefaultBlacklistedDomain(domain)) {
		return null;
	}

	const targetRegion = resolveTargetRegion(options.targetRegion);
	let info: ExtractedContactInfo;
	try {
		info = await extractContactInfo(url, {
			collectLocationPages: Boolean(targetRegion),
			targetRegion,
		});
	} catch (error) {
		console.warn(
			'[target_sites] contact extract failed:',
			domain,
			error instanceof Error ? error.message : error,
		);
		return { domain, email: null, contactFormUrl: null, lastScrapedAt: null, ok: false };
	}

	const location = targetRegion ? evaluatePagesLocation(info.pages, targetRegion) : null;
	const existing = await prisma.targetSite.findUnique({ where: { domain } });
	const currentStatus = existing ? parseTargetSiteStatus(existing.status) : 'PENDING';
	const locationFields = location ? locationUpdateData(location, currentStatus) : null;

	try {
		const scrapedAt = info.pagesVisited.length > 0 ? info.lastScrapedAt : null;
		const resolvedAddress = info.address || locationFields?.parsedAddress || null;
		const updated = await prisma.targetSite.upsert({
			where: { domain },
			create: {
				domain,
				originalUrl: url,
				status: locationFields?.status || 'PENDING',
				searchKeywords: '[]',
				email: info.email,
				contactFormUrl: info.contactFormUrl,
				phoneNumber: info.phoneNumber,
				address: resolvedAddress,
				kakaoChannelUrl: info.kakaoChannelUrl,
				instagramUrl: info.instagramUrl,
				naverTalkUrl: info.naverTalkUrl,
				lastScrapedAt: scrapedAt,
				lastSearchedAt: info.lastScrapedAt,
				parsedAddress: locationFields?.parsedAddress ?? info.address ?? null,
				checkLocationNeeded: locationFields?.checkLocationNeeded ?? false,
			},
			update: {
				...scrapedContactUpdateData(info, locationFields),
				...(scrapedAt ? { lastScrapedAt: scrapedAt } : {}),
			},
		});
		return {
			domain,
			email: info.email,
			contactFormUrl: info.contactFormUrl,
			lastScrapedAt: scrapedAt,
			ok: true,
			status: parseTargetSiteStatus(updated.status),
			checkLocationNeeded: location?.checkLocationNeeded ?? false,
			parsedAddress: location?.parsedAddress ?? info.address ?? null,
			locationVerdict: location?.verdict,
			...contactExtrasFromInfo(info),
			address: resolvedAddress,
		};
	} catch (error) {
		console.warn(
			'[target_sites] contact upsert failed:',
			domain,
			error instanceof Error ? error.message : error,
		);
		return {
			domain,
			email: info.email,
			contactFormUrl: info.contactFormUrl,
			lastScrapedAt: info.lastScrapedAt,
			ok: false,
		};
	}
}

export async function enrichTargetSitesContactInfo(
	urls: string[],
	options: { concurrency?: number; budgetMs?: number; targetRegion?: string | null } = {},
): Promise<PersistContactInfoResult[]> {
	const concurrency = options.concurrency ?? DEFAULT_CONTACT_CONCURRENCY;
	const budgetMs = options.budgetMs ?? DEFAULT_CONTACT_BUDGET_MS;
	const unique = new Map<string, string>();
	for (const raw of urls) {
		const url = typeof raw === 'string' ? raw.trim() : '';
		const domain = extractRootDomain(url);
		if (!url || !domain) continue;
		if (!unique.has(domain)) unique.set(domain, url);
	}

	const targets = Array.from(unique.values());
	if (targets.length === 0) return [];

	const deadline = Date.now() + Math.max(0, budgetMs);
	let skippedForBudget = 0;

	const results = await mapWithConcurrency(targets, concurrency, async (url) => {
		if (Date.now() >= deadline) {
			skippedForBudget += 1;
			const domain = extractRootDomain(url);
			if (domain && options.targetRegion) {
				try {
					await prisma.targetSite.update({
						where: { domain },
						data: { checkLocationNeeded: true },
					});
				} catch {
					/* row may be missing */
				}
				return {
					domain,
					email: null,
					contactFormUrl: null,
					lastScrapedAt: null,
					ok: false,
					checkLocationNeeded: true,
					parsedAddress: null,
				} satisfies PersistContactInfoResult;
			}
			return null;
		}
		const persisted = await persistContactInfoForUrl(url, { targetRegion: options.targetRegion });
		if (persisted?.ok) {
			console.log('📧 [target_sites contact]:', {
				domain: persisted.domain,
				email: persisted.email,
				contactFormUrl: persisted.contactFormUrl,
				phoneNumber: persisted.phoneNumber,
				kakaoChannelUrl: persisted.kakaoChannelUrl,
				instagramUrl: persisted.instagramUrl,
				location: persisted.locationVerdict,
			});
		}
		return persisted;
	});

	if (skippedForBudget > 0) {
		console.warn(
			`⚠️ [target_sites contact]: budget ${budgetMs}ms reached, deferred ${skippedForBudget} domain(s)`,
		);
	}

	return results.filter((row): row is PersistContactInfoResult => Boolean(row));
}

/**
 * Soft-delete: mark domains as EXCLUDED so later crawls never re-insert them.
 * Unknown domains are upserted as EXCLUDED (explicit blacklist).
 */
export async function excludeTargetSites(
	urlsOrDomains: string[],
): Promise<{ excluded: number; domains: string[] }> {
	const now = new Date();
	const unique = new Map<string, string>();

	for (const raw of urlsOrDomains) {
		const trimmed = typeof raw === 'string' ? raw.trim() : '';
		if (!trimmed) continue;
		const domain = extractRootDomain(trimmed) || extractRootDomain(`https://${trimmed}`);
		if (!domain) continue;
		if (!unique.has(domain)) unique.set(domain, trimmed);
	}

	if (unique.size === 0) return { excluded: 0, domains: [] };

	await prisma.$transaction(
		Array.from(unique.entries()).map(([domain, originalUrl]) =>
			prisma.targetSite.upsert({
				where: { domain },
				create: {
					domain,
					originalUrl,
					status: 'EXCLUDED',
					searchKeywords: '[]',
					lastSearchedAt: now,
				},
				update: { status: 'EXCLUDED' },
			}),
		),
	);

	return { excluded: unique.size, domains: Array.from(unique.keys()) };
}

export async function updateTargetSiteStatus(
	urlOrDomain: string,
	status: TargetSiteStatus,
): Promise<TargetSite | null> {
	const domain = extractRootDomain(urlOrDomain) || extractRootDomain(`https://${urlOrDomain}`);
	if (!domain) return null;
	try {
		return await prisma.targetSite.update({
			where: { domain },
			data: { status },
		});
	} catch {
		return null;
	}
}

export function isSkippedNewCollection(status: TargetSiteStatus): boolean {
	return SKIP_NEW_COLLECTION_STATUSES.has(status);
}

export type RefreshTargetSiteError = 'invalid_id' | 'not_found' | 'unsafe_url' | 'scrape_failed';

export type RefreshTargetSiteResult =
	| { ok: true; site: TargetSite }
	| { ok: false; error: RefreshTargetSiteError; message?: string };

export type SerializedTargetRefresh = {
	id: string;
	domain: string;
	email: string | null;
	contact_form_url: string | null;
	phone_number: string | null;
	address: string | null;
	kakao_channel_url: string | null;
	instagram_url: string | null;
	naver_talk_url: string | null;
	google_rating: number | null;
	google_review_count: number | null;
	last_scraped_at: string | null;
	check_location_needed: boolean;
	parsed_address: string | null;
};

export function serializeTargetRefresh(site: TargetSite): SerializedTargetRefresh {
	return {
		id: site.id,
		domain: site.domain,
		email: site.email,
		contact_form_url: site.contactFormUrl,
		phone_number: site.phoneNumber,
		address: site.address ?? site.parsedAddress ?? null,
		kakao_channel_url: site.kakaoChannelUrl,
		instagram_url: site.instagramUrl,
		naver_talk_url: site.naverTalkUrl,
		google_rating: site.googleRating,
		google_review_count: site.googleReviewCount,
		last_scraped_at: site.lastScrapedAt ? site.lastScrapedAt.toISOString() : null,
		check_location_needed: Boolean(site.checkLocationNeeded),
		parsed_address: site.parsedAddress ?? null,
	};
}

export type SerializedTargetSite = {
	id: string;
	domain: string;
	original_url: string;
	status: TargetSiteStatus;
	email: string | null;
	contact_form_url: string | null;
	phone_number: string | null;
	address: string | null;
	kakao_channel_url: string | null;
	instagram_url: string | null;
	naver_talk_url: string | null;
	google_rating: number | null;
	google_review_count: number | null;
	last_scraped_at: string | null;
	diagnosed_at: string | null;
	audit_lead_id: string | null;
	has_report: boolean;
	check_location_needed: boolean;
	parsed_address: string | null;
};

export function serializeTargetSite(site: TargetSite): SerializedTargetSite {
	const row = site as TargetSite & {
		diagnosisReport?: string | null;
		diagnosedAt?: Date | null;
		auditLeadId?: string | null;
	};
	return {
		id: row.id,
		domain: row.domain,
		original_url: row.originalUrl,
		status: parseTargetSiteStatus(row.status),
		email: row.email,
		contact_form_url: row.contactFormUrl,
		phone_number: row.phoneNumber,
		address: row.address ?? row.parsedAddress ?? null,
		kakao_channel_url: row.kakaoChannelUrl,
		instagram_url: row.instagramUrl,
		naver_talk_url: row.naverTalkUrl,
		google_rating: row.googleRating,
		google_review_count: row.googleReviewCount,
		last_scraped_at: row.lastScrapedAt ? row.lastScrapedAt.toISOString() : null,
		diagnosed_at: row.diagnosedAt ? row.diagnosedAt.toISOString() : null,
		audit_lead_id: row.auditLeadId ?? null,
		has_report: Boolean(row.diagnosisReport && row.diagnosisReport.length > 2),
		check_location_needed: Boolean(row.checkLocationNeeded),
		parsed_address: row.parsedAddress ?? null,
	};
}

const MAX_LOOKUP = 200;

export async function findTargetSitesByDomains(domains: string[]): Promise<TargetSite[]> {
	const unique = Array.from(
		new Set(
			domains
				.map((value) => {
					const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
					if (!trimmed) return '';
					return extractRootDomain(trimmed) || extractRootDomain(`https://${trimmed}`) || trimmed;
				})
				.filter(Boolean),
		),
	).slice(0, MAX_LOOKUP);
	if (unique.length === 0) return [];
	return prisma.targetSite.findMany({
		where: { domain: { in: unique } },
	});
}

export async function findTargetSitesByIds(ids: string[]): Promise<TargetSite[]> {
	const unique = Array.from(
		new Set(ids.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)),
	).slice(0, MAX_LOOKUP);
	if (unique.length === 0) return [];
	return prisma.targetSite.findMany({
		where: { id: { in: unique } },
	});
}

export type SaveTargetDiagnosisError = 'invalid_id' | 'not_found' | 'invalid_report';

export type SaveTargetDiagnosisResult =
	| { ok: true; site: TargetSite }
	| { ok: false; error: SaveTargetDiagnosisError; message?: string };

function stringifyDiagnosisReport(report: unknown): string | null {
	if (report == null) return null;
	if (typeof report === 'string') {
		const trimmed = report.trim();
		return trimmed ? trimmed : null;
	}
	try {
		return JSON.stringify(report);
	} catch {
		return null;
	}
}

/**
 * Persist a precision SEO/GEO diagnosis onto a `target_sites` row and
 * flip status to DIAGNOSED. Resolves by primary key, then by domain.
 */
export async function saveTargetDiagnosis(input: {
	id?: string;
	domain?: string;
	url?: string;
	report: unknown;
	auditLeadId?: string | null;
}): Promise<SaveTargetDiagnosisResult> {
	const id = typeof input.id === 'string' ? input.id.trim() : '';
	const url = typeof input.url === 'string' ? input.url.trim() : '';
	const domainRaw = typeof input.domain === 'string' ? input.domain.trim() : '';
	const domain =
		extractRootDomain(domainRaw) ||
		extractRootDomain(url) ||
		extractRootDomain(domainRaw ? `https://${domainRaw}` : '') ||
		'';

	const reportJson = stringifyDiagnosisReport(input.report);
	if (!reportJson) {
		return { ok: false, error: 'invalid_report', message: '진단 결과 JSON이 필요합니다.' };
	}

	let site: TargetSite | null = null;
	if (id) {
		site = await prisma.targetSite.findUnique({ where: { id } });
	}
	if (!site && domain) {
		site = await prisma.targetSite.findUnique({ where: { domain } });
	}
	if (!site) {
		return { ok: false, error: id || domain ? 'not_found' : 'invalid_id' };
	}

	const auditLeadId =
		typeof input.auditLeadId === 'string' && input.auditLeadId.trim()
			? input.auditLeadId.trim()
			: (site as TargetSite & { auditLeadId?: string | null }).auditLeadId;

	const updated = await prisma.targetSite.update({
		where: { id: site.id },
		data: {
			status: 'DIAGNOSED',
			diagnosisReport: reportJson,
			diagnosedAt: new Date(),
			...(auditLeadId ? { auditLeadId } : {}),
		} as Parameters<typeof prisma.targetSite.update>[0]['data'],
	});
	return { ok: true, site: updated };
}

function homepageUrlForSite(site: Pick<TargetSite, 'originalUrl' | 'domain'>): string {
	const raw = (site.originalUrl || site.domain).trim();
	if (!raw) return '';
	return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/**
 * Re-scrape one `target_sites` row by primary key and persist email /
 * contact_form_url / last_scraped_at. Existing values are kept when the
 * new scrape does not find a replacement (failed fetch never wipes data).
 */
export async function refreshTargetSiteById(id: string): Promise<RefreshTargetSiteResult> {
	const trimmed = typeof id === 'string' ? id.trim() : '';
	if (!trimmed) return { ok: false, error: 'invalid_id' };

	const site = await prisma.targetSite.findUnique({ where: { id: trimmed } });
	if (!site) return { ok: false, error: 'not_found' };

	const url = homepageUrlForSite(site);
	if (!url) return { ok: false, error: 'scrape_failed', message: '수집할 URL이 없습니다.' };

	try {
		await assertPublicHttpUrl(url);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (error instanceof UnsafeAuditUrlError) {
			return { ok: false, error: 'unsafe_url', message };
		}
		return { ok: false, error: 'scrape_failed', message };
	}

	let info: ExtractedContactInfo;
	const keywords = parseSearchKeywords(site.searchKeywords);
	const targetRegion =
		keywords.map((keyword) => targetRegionFromKeyword(keyword)).find(Boolean) || null;
	try {
		info = await extractContactInfo(url, {
			collectLocationPages: Boolean(targetRegion),
			targetRegion,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[target_sites] refresh extract failed:', site.domain, message);
		return { ok: false, error: 'scrape_failed', message };
	}

	if (info.pagesVisited.length === 0) {
		return {
			ok: false,
			error: 'scrape_failed',
			message: '사이트를 가져오지 못했습니다.',
		};
	}

	const currentStatus = parseTargetSiteStatus(site.status);
	const location = targetRegion ? evaluatePagesLocation(info.pages, targetRegion) : null;
	const locationFields = location ? locationUpdateData(location, currentStatus) : null;

	try {
		const updated = await prisma.targetSite.update({
			where: { id: site.id },
			data: {
				...scrapedContactUpdateData(info, locationFields),
				lastScrapedAt: info.lastScrapedAt,
			},
		});
		console.log('📧 [target_sites refresh]:', {
			id: updated.id,
			domain: updated.domain,
			email: updated.email,
			contactFormUrl: updated.contactFormUrl,
			phoneNumber: updated.phoneNumber,
			kakaoChannelUrl: updated.kakaoChannelUrl,
			instagramUrl: updated.instagramUrl,
			location: location?.verdict,
		});
		return { ok: true, site: updated };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[target_sites] refresh persist failed:', site.domain, message);
		return { ok: false, error: 'scrape_failed', message };
	}
}

/** Root domains that must not surface as a new collection in the UI. */
export function blockedDomainsFromSave(result: SaveDiscoveredTargetsResult): Set<string> {
	const blocked = new Set<string>();
	for (const row of result.updated) {
		if (
			row.reason === 'excluded' ||
			row.reason === 'diagnosed' ||
			row.reason === 'contacted' ||
			row.reason === 'location_mismatch'
		) {
			blocked.add(row.domain);
		}
	}
	for (const row of result.skipped) {
		if (row.domain) blocked.add(row.domain);
	}
	return blocked;
}

export function summarizePersistence(result: SaveDiscoveredTargetsResult) {
	const skippedNewCollection = result.updated.filter(
		(row) =>
			row.reason === 'excluded' ||
			row.reason === 'diagnosed' ||
			row.reason === 'contacted' ||
			row.reason === 'location_mismatch',
	);
	return {
		inserted: result.inserted.length,
		updated: result.updated.length,
		skipped: result.skipped.length,
		skippedExcluded: skippedNewCollection.filter((row) => row.reason === 'excluded').length,
		skippedDiagnosed: skippedNewCollection.filter((row) => row.reason === 'diagnosed').length,
		skippedContacted: skippedNewCollection.filter((row) => row.reason === 'contacted').length,
		skippedBlacklist: result.skipped.filter((row) => row.reason === 'blacklist').length,
		skippedLocation: result.skipped.filter((row) => row.reason === 'location_mismatch').length,
		skippedPhone: result.skipped.filter((row) => row.reason === 'phone_duplicate').length,
	};
}
