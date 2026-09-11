/**
 * Server-side NDJSON response builder for `/api/audit/scan` — mirrors the
 * `remote-patch-stream.ts` pattern already used by `/api/admin/remote-patch/execute`
 * ("Streams NDJSON timeline events so the UI is not stuck at 35% during a hang.").
 *
 * Returns a `NextResponse` (not a plain `Response`) specifically so callers can still
 * use `response.cookies.set(...)` (e.g. `applyGuestAuditCookie`) exactly like the
 * existing `noStoreJson` helper — `NextResponse` accepts a `ReadableStream` body just
 * like the underlying Web `Response` it wraps.
 */
import { NextResponse } from 'next/server';
import { encodeAuditScanEvent, type AuditScanStreamEvent } from '@/lib/audit/scan-stream-types';

export type { AuditScanStreamEvent };

export function createAuditScanNdjsonResponse(
	run: (emit: (event: AuditScanStreamEvent) => void) => Promise<void>,
): NextResponse {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let closed = false;
			const emit = (event: AuditScanStreamEvent) => {
				if (closed) return;
				controller.enqueue(encoder.encode(encodeAuditScanEvent(event)));
			};
			try {
				await run(emit);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error('[audit/scan][stream] run() threw past its own try/catch:', message);
				emit({ type: 'error', message });
			} finally {
				closed = true;
				controller.close();
			}
		},
	});
	return new NextResponse(stream, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
			'X-Accel-Buffering': 'no',
		},
	});
}
