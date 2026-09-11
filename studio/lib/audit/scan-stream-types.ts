/**
 * Shared NDJSON event shapes for `/api/audit/scan`'s progress stream — kept in a
 * zero-runtime-import, type-only module so both the server (`scan-stream.ts`, which
 * imports `next/server`) and the browser client (`audit-history-storage.ts`) can import
 * the same event union without pulling server-only code into the client bundle.
 *
 * Wire format: one JSON object per line (`\n`-terminated), `Content-Type:
 * application/x-ndjson`. A menu-heavy site's full-audit crawl (see
 * `full-audit-engine.ts`) can legitimately take tens of seconds — `progress` events are
 * emitted per crawl phase/page so the client can show real status instead of the
 * connection looking stalled, and `result`/`error` always terminate the stream exactly
 * once.
 */

/** Mirrors `FullAuditProgress` from `full-audit-engine.ts` (kept structurally
 *  compatible rather than imported, since that module pulls in cheerio/node-only deps
 *  that must never reach the browser bundle). */
export interface AuditScanProgressPayload {
	phase: 'discover' | 'analyze' | 'cache' | 'done';
	mode: 'full' | 'incremental';
	pagesFound: number;
	pagesParsed: number;
	currentIndex: number;
	currentUrl?: string;
	cacheHits: number;
	cacheMisses: number;
	percent: number;
	message: string;
}

export type AuditScanStreamEvent =
	| ({ type: 'progress' } & AuditScanProgressPayload)
	| { type: 'result'; payload: Record<string, unknown> }
	| { type: 'error'; message: string; stage?: string };

export function encodeAuditScanEvent(event: AuditScanStreamEvent): string {
	return `${JSON.stringify(event)}\n`;
}
