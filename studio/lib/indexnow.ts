import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export interface PingResult {
	success: boolean;
	message: string;
}

function getOrCreateKey(): string {
	const envKey = process.env.INDEXNOW_KEY?.trim();
	if (envKey) return envKey;
	// Stable per-process fallback so repeated pings in local/dev use the same key.
	return crypto.createHash('sha256').update('redue-ai-studio-indexnow').digest('hex').slice(0, 32);
}

/**
 * IndexNow requires the key to be hosted at `https://{host}/{key}.txt`. Since
 * we have real filesystem access to the WordPress root that was just
 * patched, we drop the key file there too — if that root is the one being
 * served publicly at `siteUrl`, key verification succeeds for real.
 */
export function writeIndexNowKeyFile(wpRootPath: string, key: string): void {
	try {
		fs.writeFileSync(path.join(wpRootPath, `${key}.txt`), key, 'utf8');
	} catch {
		// Non-fatal: local root may not be the publicly served document root.
	}
}

/**
 * Submits `siteUrl` to the shared IndexNow endpoint, which fans the URL out
 * to every participating engine (Bing, Yandex, Naver, Seznam, ...). Returns a
 * best-effort result — a non-2xx response (e.g. key file not reachable yet)
 * is reported but never throws, since indexing pings must never break the
 * injection flow.
 */
export async function pingIndexNow(siteUrl: string): Promise<PingResult> {
	try {
		const url = new URL(siteUrl);
		const key = getOrCreateKey();
		const res = await fetch(INDEXNOW_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify({
				host: url.host,
				key,
				keyLocation: `${url.origin}/${key}.txt`,
				urlList: [siteUrl],
			}),
			signal: AbortSignal.timeout(8000),
		});
		if (res.ok) {
			return { success: true, message: `IndexNow 제출 완료 (HTTP ${res.status}) — Bing/Yandex/Naver로 전파됩니다.` };
		}
		return { success: false, message: `IndexNow 응답 오류 (HTTP ${res.status}) — 키 파일 호스팅 상태를 확인하세요.` };
	} catch (err) {
		return { success: false, message: `IndexNow 요청 실패: ${(err as Error).message}` };
	}
}
