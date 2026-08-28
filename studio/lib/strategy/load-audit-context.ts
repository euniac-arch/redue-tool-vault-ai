import { getGuestAuditById, getGuestAudits } from '@/lib/audit-history-storage';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { fetchAuditById, peekCachedAudit } from '@/lib/audit/report-client-cache';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import { buildStudioState } from '@/lib/strategy/map-audit-context';
import { sameStrategySite } from '@/lib/strategy/strategy-url';
import type { StrategyLoadSource, StrategyStudioState } from '@/lib/strategy/types';

export type StrategyAuditLoadResult =
	| { ok: true; state: StrategyStudioState; source: StrategyLoadSource }
	| { ok: false; reason: 'missing' | 'invalid' | 'network'; message: string };

function fromReport(
	report: AuditReport,
	auditId: string | null,
	source: StrategyLoadSource,
	lang: AuditLang,
): StrategyAuditLoadResult {
	if (!report?.url) {
		return { ok: false, reason: 'invalid', message: 'invalid' };
	}
	return {
		ok: true,
		source,
		state: buildStudioState(report, { auditId, source, lang }),
	};
}

/**
 * Resolve the audit that Strategy Studio should bind to.
 * Order: in-memory cache → GET /api/audit/[id] → guest history → latest payload.
 * Does not invent a report when nothing is found.
 */
function findGuestByUrl(url: string) {
	return getGuestAudits().find((item) => sameStrategySite(item.url, url) && item.report?.url) ?? null;
}

export async function loadStrategyStudioState(opts: {
	auditId?: string | null;
	url?: string | null;
	lang?: AuditLang;
}): Promise<StrategyAuditLoadResult> {
	const lang: AuditLang = opts.lang === 'en' ? 'en' : 'ko';
	const auditId = (opts.auditId || '').trim();
	const siteUrl = (opts.url || '').trim();

	if (auditId) {
		const cached = peekCachedAudit(auditId);
		if (cached?.report?.url) {
			return fromReport(cached.report, cached.id, 'api', lang);
		}

		const fetched = await fetchAuditById(auditId);
		if ('report' in fetched && fetched.report?.url) {
			return fromReport(fetched.report, fetched.id, 'api', lang);
		}

		const guest = getGuestAuditById(auditId);
		if (guest?.report?.url) {
			return fromReport(guest.report, guest.id, 'guest-history', lang);
		}

		const latestById = loadLatestAuditPayload();
		if (latestById?.report?.url && latestById.auditId === auditId) {
			return fromReport(latestById.report, latestById.auditId, 'latest-payload', lang);
		}

		if ('error' in fetched && fetched.status === 0) {
			return { ok: false, reason: 'network', message: fetched.error || 'network' };
		}
		return { ok: false, reason: 'missing', message: 'missing' };
	}

	if (siteUrl) {
		const byUrl = findGuestByUrl(siteUrl);
		if (byUrl?.report?.url) {
			return fromReport(byUrl.report, byUrl.id, 'guest-history', lang);
		}
		const latestByUrl = loadLatestAuditPayload();
		if (latestByUrl?.report?.url && sameStrategySite(latestByUrl.report.url, siteUrl)) {
			return fromReport(latestByUrl.report, latestByUrl.auditId, 'latest-payload', lang);
		}
	}

	const latest = loadLatestAuditPayload();
	if (latest?.report?.url) {
		return fromReport(latest.report, latest.auditId, 'latest-payload', lang);
	}

	const newest = getGuestAudits()[0];
	if (newest?.report?.url) {
		return fromReport(newest.report, newest.id, 'guest-history', lang);
	}

	return { ok: false, reason: 'missing', message: 'missing' };
}
