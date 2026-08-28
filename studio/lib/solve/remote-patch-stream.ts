/**
 * NDJSON stream helpers for remote-patch execute (browser-safe, no FTP imports).
 */

export type RemotePatchExecutePayload = {
	ok: boolean;
	backupFolderName?: string | null;
	backupAbsolutePath?: string | null;
	targetPath?: string | null;
	injectedPath?: string | null;
	targetAbsolutePath?: string | null;
	cmsLabel?: string | null;
	engine?: 'php-dynamic' | 'html-static' | null;
	anchor?: string | null;
	warning?: string | null;
	message?: string;
	logs?: string[];
	error?: string;
};

export type RemotePatchStreamEvent =
	| { type: 'log'; line: string; progress?: number }
	| (RemotePatchExecutePayload & { type: 'result' })
	| { type: 'error'; message: string; logs?: string[] };

export function inferRemotePatchProgress(line: string): number | undefined {
	const labeled = line.match(/\[(?:진행|완료)\s*(\d+)\s*%\]/);
	if (labeled) return Number(labeled[1]);
	const bracket = line.match(/\[(\d+)%\]/);
	if (bracket) return Number(bracket[1]);
	if (/무결성 검증|풀패키지/.test(line)) return 100;
	if (/건너뜀/.test(line) && /llms/.test(line)) return 90;
	if (/건너뜀/.test(line) && /sitemap/.test(line)) return 75;
	if (/건너뜀/.test(line) && /robots/.test(line)) return 60;
	if (/건너뜀/.test(line) && /head\.sub/.test(line)) return 40;
	if (/llms-full|llms\.txt/.test(line) && /업로드|배포/.test(line)) return 90;
	if (/sitemap\.xml/.test(line)) return 75;
	if (/robots\.txt/.test(line)) return 60;
	if (/스키마 및 메타태그|\[주입 완료\]|\[주입 중\]/.test(line)) return 40;
	if (/백업 생성|\[백업 생성 중\]/.test(line)) return 40;
	if (/타겟 확정|1순위 타겟/.test(line)) return 35;
	if (/접속/.test(line)) return 12;
	return undefined;
}

export function encodeRemotePatchEvent(event: RemotePatchStreamEvent): Uint8Array {
	return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export function createRemotePatchNdjsonResponse(
	run: (emit: (event: RemotePatchStreamEvent) => void) => Promise<void>,
): Response {
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (event: RemotePatchStreamEvent) => {
				controller.enqueue(encodeRemotePatchEvent(event));
			};
			try {
				await run(emit);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				emit({ type: 'error', message });
			} finally {
				controller.close();
			}
		},
	});
	return new Response(stream, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'X-Accel-Buffering': 'no',
		},
	});
}

function emptyFail(message: string, extra?: Partial<RemotePatchExecutePayload>): RemotePatchExecutePayload {
	return {
		ok: false,
		backupFolderName: null,
		targetPath: null,
		injectedPath: null,
		cmsLabel: null,
		message,
		logs: [],
		error: message,
		...extra,
	};
}

/**
 * Read either an NDJSON execute stream or a legacy JSON body.
 * Calls `onLog` as soon as each timeline line arrives.
 */
export async function consumeRemotePatchExecuteResponse(
	res: Response,
	onLog: (line: string, progress?: number) => void,
): Promise<RemotePatchExecutePayload> {
	const contentType = res.headers.get('content-type') || '';
	const isNdjson = /ndjson/i.test(contentType);

	if (!isNdjson || !res.body) {
		const data = (await res.json()) as RemotePatchExecutePayload;
		for (const line of data.logs || []) {
			onLog(line, inferRemotePatchProgress(line));
		}
		return data;
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let result: RemotePatchExecutePayload | null = null;

	const applyChunk = (chunk: string) => {
		buffer += chunk;
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';
		for (const raw of lines) {
			const line = raw.trim();
			if (!line) continue;
			let event: RemotePatchStreamEvent;
			try {
				event = JSON.parse(line) as RemotePatchStreamEvent;
			} catch {
				onLog(line);
				continue;
			}
			if (event.type === 'log') {
				onLog(event.line, event.progress);
			} else if (event.type === 'error') {
				for (const logLine of event.logs || []) onLog(logLine);
				onLog(event.message);
				result = emptyFail(event.message, { logs: event.logs || [] });
			} else if (event.type === 'result') {
				result = event;
			}
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (value) applyChunk(decoder.decode(value, { stream: !done }));
		if (done) {
			if (buffer.trim()) applyChunk('\n');
			break;
		}
	}

	return result || emptyFail('원격 패치 응답이 비어 있습니다.', { error: 'empty stream' });
}
