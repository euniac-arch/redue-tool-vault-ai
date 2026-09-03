import { getInsightsNewsFeed } from '@/lib/insights/insights-news-service';
import { parseInsightsNewsTab } from '@/lib/insights/insights-news-types';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parseTab(value: string | null) {
	return parseInsightsNewsTab(value);
}

function wantsRefresh(searchParams: URLSearchParams): boolean {
	const raw = (searchParams.get('refresh') || searchParams.get('force') || '').toLowerCase();
	return raw === '1' || raw === 'true';
}

/**
 * GET /api/insights — public Insights feed.
 * Same 5h Firestore cache as `/api/news/fetch` (Search Engine Land / Journal
 * + Google Search Central + keyword filter). Cache hits return immediately;
 * RSS is fetched only when TTL elapsed, the store is empty, or `refresh=1`.
 *
 * Firestore is never instantiated here — collectors use the Admin singleton
 * (`getAdminFirestore`) so `settings()` cannot run per request.
 */
export async function GET(request: Request) {
	const requestId = createInsightsRequestId();
	try {
		const { searchParams } = new URL(request.url);
		const result = await getInsightsNewsFeed({
			tab: parseTab(searchParams.get('tab') || searchParams.get('category')),
			forceRefresh: wantsRefresh(searchParams),
		});
		return insightsNoStoreJson(result, 200, requestId);
	} catch (error) {
		logInsightsFailure('insights/news', error, { requestId });
		return insightsNoStoreJson({ error: insightsPublicError('news') }, 502, requestId);
	}
}
