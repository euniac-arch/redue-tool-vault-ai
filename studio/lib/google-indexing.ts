import { GoogleAuth } from 'google-auth-library';
import type { PingResult } from './indexnow';

const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';

/**
 * Google Indexing API requires a service account that has been added as an
 * "Owner" of the target property in Search Console — there is no sandbox/demo
 * mode. We support two ways to supply credentials:
 *  - `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`: the full service-account JSON as a string (e.g. from a secrets manager).
 *  - `GOOGLE_APPLICATION_CREDENTIALS`: a filesystem path to the service-account JSON key file.
 * If neither is configured, the ping is skipped (not treated as a hard failure).
 */
function buildAuthClient(): GoogleAuth | null {
	const inlineJson = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON?.trim();
	if (inlineJson) {
		try {
			const credentials = JSON.parse(inlineJson);
			return new GoogleAuth({ credentials, scopes: [INDEXING_SCOPE] });
		} catch {
			return null;
		}
	}
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
		return new GoogleAuth({ scopes: [INDEXING_SCOPE] });
	}
	return null;
}

export async function pingGoogleIndexing(siteUrl: string): Promise<PingResult> {
	const auth = buildAuthClient();
	if (!auth) {
		return {
			success: false,
			message: 'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON(또는 GOOGLE_APPLICATION_CREDENTIALS) 미설정 — 핑을 건너뛰었습니다.',
		};
	}

	try {
		const client = await auth.getClient();
		const res = await client.request({
			url: INDEXING_API_URL,
			method: 'POST',
			data: { url: siteUrl, type: 'URL_UPDATED' },
		});
		return { success: true, message: `Google Indexing API 제출 완료 (HTTP ${res.status})` };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Google Indexing API 요청 실패: ${message}` };
	}
}
