import { NextResponse } from 'next/server';
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import {
	asiErrorEnvelope,
	asiEnvelopeMeta,
	asiSuccessEnvelope,
	localeFromRequest,
} from '@/lib/ai-search-intelligence/api/envelope';
import { AsiServiceError, classifyAsiThrown } from '@/lib/ai-search-intelligence/api/errors';
import { createAsiRequestId, logAsiRequest } from '@/lib/ai-search-intelligence/api/log';
import { resolveAsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import { authorizeAsiRequest } from '@/lib/ai-search-intelligence/entitlement/authorize';
import { clipAsiSnapshot } from '@/lib/ai-search-intelligence/entitlement/clip';
import { asiUsageKeyFor, publicAsiEntitlement, resolveAsiActorFromRequest } from '@/lib/ai-search-intelligence/entitlement/actor';
import { asiGuestDiagnoseRemaining, consumeAsiGuestDiagnose } from '@/lib/ai-search-intelligence/entitlement/quota';
import { assertAsiMonthlyBudget, publicAsiAccountUsage, readAsiAccountUsage, recordAsiAccountQueries } from '@/lib/ai-search-intelligence/guard/account-usage';
import { abortAsiRun, beginAsiRun, endAsiRun } from '@/lib/ai-search-intelligence/guard/cancel';
import { capAsiQueries } from '@/lib/ai-search-intelligence/guard/batch';
import { acquireAsiConcurrency, releaseAsiConcurrency } from '@/lib/ai-search-intelligence/guard/concurrency';
import { asiClientKeyFromRequest, runWithAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { recordAsiHttpRequest } from '@/lib/ai-search-intelligence/guard/metrics';
import { consumeAsiHttpRateLimit } from '@/lib/ai-search-intelligence/guard/rate-limit';
import { resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { asiRuntimeClientStatus, asiRuntimeMetaProvider, runAsiOperation } from '@/lib/ai-search-intelligence/service/asi-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

function metaBase(requestId: string, operation?: string) {
	return asiEnvelopeMeta({
		mode: resolveAsiMode(),
		provider: asiRuntimeMetaProvider(),
		requestId,
		operation,
	});
}

export async function GET(req: Request) {
	const requestId = createAsiRequestId();
	const meta = metaBase(requestId);
	const actor = await resolveAsiActorFromRequest(req);
	const clientKey = asiClientKeyFromRequest(req);
	const usageKey = asiUsageKeyFor(actor, clientKey);
	logAsiRequest(requestId, 'info', { method: 'GET', path: '/api/intelligence' });
	return NextResponse.json(
		asiSuccessEnvelope(
			{
				...asiRuntimeClientStatus(),
				entitlement: publicAsiEntitlement(actor),
				accountUsage: publicAsiAccountUsage(readAsiAccountUsage(usageKey, actor.limits)),
			},
			meta,
		),
		{ headers: { 'x-asi-request-id': requestId } },
	);
}

export async function POST(req: Request) {
	const requestId = createAsiRequestId();
	const locale = localeFromRequest(req);
	const fail = (code: AsiServiceError['code'], operation?: string) => {
		const { body, status } = asiErrorEnvelope(code, metaBase(requestId, operation), locale);
		logAsiRequest(requestId, 'error', { method: 'POST', operation: operation ?? null, code, status });
		return NextResponse.json(body, { status, headers: { 'x-asi-request-id': requestId } });
	};

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return fail('invalid_json');
	}

	if (body.operation === 'cancel' || body.action === 'cancel') {
		const target = typeof body.requestId === 'string' ? body.requestId : '';
		const cancelled = Boolean(target && abortAsiRun(target, 'cancelled'));
		logAsiRequest(requestId, 'info', { method: 'POST', operation: 'cancel', cancelled });
		return NextResponse.json(asiSuccessEnvelope({ cancelled }, metaBase(requestId, 'cancel')), {
			headers: { 'x-asi-request-id': requestId },
		});
	}

	const operation = resolveAsiOperation(
		typeof body.operation === 'string' ? body.operation : typeof body.action === 'string' ? body.action : '',
	);
	if (!operation) {
		return fail('invalid_operation');
	}

	const actor = await resolveAsiActorFromRequest(req);
	const requestedQueries = Array.isArray(body.queries)
		? body.queries.filter((item): item is string => typeof item === 'string')
		: [];
	const denied = authorizeAsiRequest(actor, {
		operation,
		queries: requestedQueries,
		expandSov: body.expandSov === true,
		expandCitations: body.expandCitations === true,
		cadence: typeof body.cadence === 'string' ? body.cadence : null,
	});
	if (denied) {
		return fail('entitlement', operation);
	}

	const clientKey = asiClientKeyFromRequest(req);
	if (actor.tier === 'guest') {
		if (asiGuestDiagnoseRemaining(actor, clientKey) <= 0) {
			return fail('entitlement_quota', operation);
		}
	}

	const url = typeof body.url === 'string' ? body.url : '';
	const queries = requestedQueries.length
		? capAsiQueries(requestedQueries, actor.limits.queries)
		: undefined;
	const input: AsiRunInput = {
		url,
		query: typeof body.query === 'string' ? body.query : undefined,
		queries,
		expandSov: operation === 'share-of-voice' || body.expandSov === true,
		expandCitations: operation === 'citation-explorer' || body.expandCitations === true,
		probeQueries:
			body.probeQueries === true || (operation === 'query-generator' && Boolean(queries?.length)),
		questions: body.questions && typeof body.questions === 'object' ? (body.questions as AsiRunInput['questions']) : undefined,
		audit: body.audit && typeof body.audit === 'object' ? (body.audit as AsiRunInput['audit']) : null,
		cadence:
			body.cadence === 'daily' || body.cadence === 'weekly' || body.cadence === 'monthly'
				? body.cadence
				: undefined,
		refresh: body.refresh === true,
		// remesasure is scheduler-only. The request body cannot start it.
	};

	const usageKey = asiUsageKeyFor(actor, clientKey);
	const upcomingQueries = Math.max(1, queries?.length ?? (input.query ? 1 : 1));
	try {
		assertAsiMonthlyBudget(usageKey, actor.limits, upcomingQueries);
		consumeAsiHttpRateLimit(clientKey);
		acquireAsiConcurrency(usageKey);
	} catch (error) {
		const classified = error instanceof AsiServiceError ? error : classifyAsiThrown(error);
		return fail(classified.code, operation);
	}

	recordAsiHttpRequest();
	const run = beginAsiRun(requestId);
	const onClientAbort = () => abortAsiRun(requestId, 'cancelled');
	req.signal.addEventListener('abort', onClientAbort);
	const timer = setTimeout(() => abortAsiRun(requestId, 'timeout'), ASI_GUARD.requestTimeoutMs);
	logAsiRequest(requestId, 'info', {
		method: 'POST',
		operation,
		hasUrl: Boolean(url),
		queryCount: queries?.length ?? (input.query ? 1 : 0),
	});

	try {
		const snapshot = await runWithAsiRequestContext(
			{ requestId, clientKey, signal: run.signal, tier: actor.tier, limits: actor.limits, usageKey },
			() => runAsiOperation(operation, input),
		);
		const clipped = clipAsiSnapshot(operation, snapshot, actor);
		consumeAsiGuestDiagnose(actor, clientKey);
		recordAsiAccountQueries(usageKey, upcomingQueries);
		const meta = metaBase(requestId, operation);
		logAsiRequest(requestId, 'info', { method: 'POST', operation, ok: true });
		return NextResponse.json(
			asiSuccessEnvelope(
				{ snapshot: clipped, operation, accountUsage: publicAsiAccountUsage(readAsiAccountUsage(usageKey, actor.limits)) },
				meta,
			),
			{ headers: { 'x-asi-request-id': requestId } },
		);
	} catch (error) {
		const classified = error instanceof AsiServiceError ? error : classifyAsiThrown(error);
		return fail(classified.code, operation);
	} finally {
		clearTimeout(timer);
		req.signal.removeEventListener('abort', onClientAbort);
		releaseAsiConcurrency(usageKey);
		endAsiRun(requestId);
	}
}
