/**
 * In-memory caches for the interactive audit result page.
 * Dedupes Strict Mode remounts, ?url= → ?id= replacements, and enrichment refetches.
 */

import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditReport } from '@/lib/site-auditor';

type PsiStrategy = 'desktop' | 'mobile';

const AUDIT_TTL_MS = 90_000;

const auditCache = new Map<string, { id: string; report: AuditReport; at: number }>();
const auditInflight = new Map<string, Promise<{ id: string; report: AuditReport } | { error: string; status: number }>>();
const geoCache = new Map<string, GeoNarrativeReport>();
const geoInflight = new Map<string, Promise<GeoNarrativeReport | null>>();
const psiCache = new Map<string, PageSpeedSnapshot>();
const psiInflight = new Map<string, Promise<PageSpeedSnapshot | null>>();

function isFresh(at: number, ttl = AUDIT_TTL_MS): boolean {
	return Date.now() - at < ttl;
}

export function peekCachedAudit(id: string): { id: string; report: AuditReport } | null {
	const hit = auditCache.get(id);
	if (!hit || !isFresh(hit.at)) {
		if (hit) auditCache.delete(id);
		return null;
	}
	return { id: hit.id, report: hit.report };
}

export function rememberAudit(id: string, report: AuditReport) {
	if (!id) return;
	auditCache.set(id, { id, report, at: Date.now() });
}

export async function fetchAuditById(
	id: string,
	opts?: { force?: boolean },
): Promise<{ id: string; report: AuditReport } | { error: string; status: number }> {
	if (!opts?.force) {
		const hit = peekCachedAudit(id);
		if (hit) return hit;
	}
	const inflight = auditInflight.get(id);
	if (inflight) return inflight;

	const promise = (async () => {
		const res = await fetch(`/api/audit/${encodeURIComponent(id)}`, {
			cache: 'no-store',
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
			},
		});
		const data = await res.json().catch(() => ({}));
		if (res.ok && data.report) {
			const next = { id: (data.id as string) || id, report: data.report as AuditReport };
			rememberAudit(next.id, next.report);
			return next;
		}
		return {
			error: typeof data.error === 'string' && data.error ? data.error : '',
			status: res.status,
		};
	})();

	auditInflight.set(id, promise);
	try {
		return await promise;
	} finally {
		auditInflight.delete(id);
	}
}

export function peekCachedGeoNarrative(key: string): GeoNarrativeReport | null {
	return geoCache.get(key) ?? null;
}

export function rememberGeoNarrative(key: string, report: GeoNarrativeReport) {
	geoCache.set(key, report);
}

export function getGeoNarrativeInflight(key: string): Promise<GeoNarrativeReport | null> | undefined {
	return geoInflight.get(key);
}

export function setGeoNarrativeInflight(key: string, promise: Promise<GeoNarrativeReport | null>) {
	geoInflight.set(key, promise);
	void promise.finally(() => {
		if (geoInflight.get(key) === promise) geoInflight.delete(key);
	});
}

export function psiCacheKey(url: string, fetchedAt: string, strategy: PsiStrategy): string {
	return `${url}|${fetchedAt}|${strategy}`;
}

export function peekCachedPageSpeed(key: string): PageSpeedSnapshot | null {
	return psiCache.get(key) ?? null;
}

export function rememberPageSpeed(key: string, snapshot: PageSpeedSnapshot) {
	psiCache.set(key, snapshot);
}

export function getPageSpeedInflight(key: string): Promise<PageSpeedSnapshot | null> | undefined {
	return psiInflight.get(key);
}

export function setPageSpeedInflight(key: string, promise: Promise<PageSpeedSnapshot | null>) {
	psiInflight.set(key, promise);
	void promise.finally(() => {
		if (psiInflight.get(key) === promise) psiInflight.delete(key);
	});
}
