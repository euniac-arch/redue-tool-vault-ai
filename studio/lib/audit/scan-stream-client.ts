/**
 * Browser-side NDJSON consumer for `/api/audit/scan` — mirrors
 * `consumeRemotePatchExecuteResponse` (`lib/solve/remote-patch-stream.ts`). Kept in its
 * own client-safe module (no `next/server` import) so it can be bundled into
 * `audit-history-storage.ts` without pulling server-only code into the browser.
 */
import type { AuditScanProgressPayload, AuditScanStreamEvent } from '@/lib/audit/scan-stream-types';

export type { AuditScanProgressPayload };

/**
 * Reads either the NDJSON progress stream or a legacy/pre-flight plain-JSON error body
 * (400 invalid URL, 402 quota exceeded — those still return synchronously before the
 * scan stream starts, see `route.ts`). Calls `onProgress` as soon as each progress line
 * arrives so a long menu-heavy crawl never looks stalled to the caller.
 */
export async function consumeAuditScanResponse(
	res: Response,
	onProgress?: (progress: AuditScanProgressPayload) => void,
): Promise<{ status: number; ok: boolean; data: Record<string, unknown> }> {
	const contentType = res.headers.get('content-type') || '';
	const isNdjson = /ndjson/i.test(contentType);

	if (!isNdjson || !res.body) {
		const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		return { status: res.status, ok: res.ok, data };
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let result: Record<string, unknown> | null = null;
	let streamError: string | null = null;

	const applyLine = (raw: string) => {
		const line = raw.trim();
		if (!line) return;
		let event: AuditScanStreamEvent;
		try {
			event = JSON.parse(line) as AuditScanStreamEvent;
		} catch {
			return;
		}
		if (event.type === 'progress') {
			onProgress?.(event);
		} else if (event.type === 'result') {
			result = event.payload;
		} else if (event.type === 'error') {
			streamError = event.message;
		}
	};

	const applyChunk = (chunk: string) => {
		buffer += chunk;
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';
		for (const line of lines) applyLine(line);
	};

	while (true) {
		const { done, value } = await reader.read();
		if (value) applyChunk(decoder.decode(value, { stream: !done }));
		if (done) {
			if (buffer.trim()) applyLine(buffer);
			break;
		}
	}

	if (result) return { status: res.status, ok: res.ok, data: result };
	return {
		status: streamError ? 502 : res.status,
		ok: false,
		data: { error: streamError || '진단 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.' },
	};
}
