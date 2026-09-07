import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readOpenAiApiKey, runInsightsAiResearch } from '@/lib/insights/insights-ai-research-engine';
import { canUseInsightsAiResearch, isInsightsProMember } from '@/lib/insights/insights-ai-research';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';
import { recordDailyApiUsage } from '@/lib/server/daily-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function POST(request: Request) {
	const started = Date.now();
	const requestId = createInsightsRequestId();

	type SessionUser = { id?: string; email?: string | null; role?: string | null; planId?: string };
	let sessionUser: SessionUser | null = null;
	try {
		const session = await withDeadline(getServerSession(authOptions), 3_000, 'getServerSession');
		const user = session && typeof session === 'object' && 'user' in session ? (session as { user?: SessionUser }).user : null;
		sessionUser = user || null;
	} catch (error) {
		logInsightsFailure('insights/ai-search', error, { requestId, stage: 'session' });
		sessionUser = null;
	}

	const isLoggedIn = Boolean(sessionUser?.id || sessionUser?.email);
	const isProMember = isInsightsProMember(sessionUser?.planId, sessionUser?.role);
	if (!canUseInsightsAiResearch({ isLoggedIn, isProMember })) {
		return insightsNoStoreJson({ error: 'AI 리서치를 사용할 수 없습니다.', code: 'auth_required' }, 401, requestId);
	}

	const apiKey = readOpenAiApiKey();
	if (!apiKey) {
		logInsightsFailure('insights/ai-search', new Error('provider_unavailable'), { requestId, stage: 'key' });
		return insightsNoStoreJson({ error: insightsPublicError('llm_unavailable'), code: 'unavailable' }, 503, requestId);
	}

	let query = '';
	try {
		const body = (await request.json()) as { query?: unknown };
		query = typeof body.query === 'string' ? body.query.replace(/\s+/g, ' ').trim() : '';
	} catch (error) {
		logInsightsFailure('insights/ai-search', error, { requestId, stage: 'body' });
		return insightsNoStoreJson({ error: '검색어를 전달해 주세요.', code: 'bad_request' }, 400, requestId);
	}

	if (query.length < 2) {
		return insightsNoStoreJson({ error: '검색어를 2자 이상 입력해 주세요.', code: 'bad_request' }, 400, requestId);
	}
	if (query.length > 200) {
		return insightsNoStoreJson({ error: '검색어는 200자 이하여야 합니다.', code: 'bad_request' }, 400, requestId);
	}

	try {
		const result = await runInsightsAiResearch(query, apiKey);
		recordDailyApiUsage({ service: 'ai_research', userId: sessionUser?.id, actorType: 'member' });
		return insightsNoStoreJson(result, 200, requestId);
	} catch (error) {
		logInsightsFailure('insights/ai-search', error, { requestId, ms: Date.now() - started });
		return insightsNoStoreJson({ error: insightsPublicError('research'), code: 'provider_failed' }, 502, requestId);
	}
}
