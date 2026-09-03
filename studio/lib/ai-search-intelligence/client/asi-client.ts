import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import type { AsiErrorCode } from '@/lib/ai-search-intelligence/api/errors';
import { isAsiErrorCode } from '@/lib/ai-search-intelligence/api/errors';
import type { AsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import { isPublicAsiAccountUsage, publishAsiAccountUsage } from '@/lib/ai-search-intelligence/entitlement/usage-public';
import type {
	AsiAgentReadinessSnapshot,
	AsiEvidenceSnapshot,
	AsiPerceptionSnapshot,
	AsiRecommendationSnapshot,
	AsiOpportunitySnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiCompetitorGapSnapshot,
	AsiNextActionSnapshot,
	AsiVisibilityMonitorSnapshot,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

type AsiSnapshot =
	| AsiWarRoomSnapshot
	| AsiPerceptionSnapshot
	| AsiRecommendationSnapshot
	| AsiEvidenceSnapshot
	| AsiAgentReadinessSnapshot
	| AsiOpportunitySnapshot
	| AsiEvidenceExplorerSnapshot
	| AsiCompetitorGapSnapshot
	| AsiNextActionSnapshot
	| AsiVisibilityMonitorSnapshot;

export type AsiLoadError = AsiErrorCode;

export type AsiLoadResult<T> = { snapshot: T; error: null } | { snapshot: null; error: AsiLoadError };

export type AsiFailCopy = {
	invalidUrl: string;
	unavailable: string;
	api_key?: string;
	provider_timeout?: string;
	rate_limit?: string;
	invalid_response?: string;
	network_error?: string;
	cancelled?: string;
	invalid_operation?: string;
	invalid_json?: string;
	entitlement?: string;
	entitlement_quota?: string;
};

/** Map API error codes to UI copy. Never show raw provider/server text. */
export function asiLoadMessage(error: AsiLoadError, copy: AsiFailCopy): string {
	if (error === 'invalid_url') return copy.invalidUrl;
	if (error === 'api_key' && copy.api_key) return copy.api_key;
	if (error === 'provider_timeout' && copy.provider_timeout) return copy.provider_timeout;
	if (error === 'rate_limit' && copy.rate_limit) return copy.rate_limit;
	if (error === 'invalid_response' && copy.invalid_response) return copy.invalid_response;
	if (error === 'network_error' && copy.network_error) return copy.network_error;
	if (error === 'cancelled' && copy.cancelled) return copy.cancelled;
	if ((error === 'invalid_operation' || error === 'invalid_json') && copy.invalid_operation) {
		return copy.invalid_operation;
	}
	if (error === 'entitlement' && copy.entitlement) return copy.entitlement;
	if (error === 'entitlement_quota' && copy.entitlement_quota) return copy.entitlement_quota;
	return copy.unavailable;
}

export function asiFailCopy(
	invalidUrl: string,
	tUx: (key: string) => string,
): AsiFailCopy {
	return {
		invalidUrl,
		unavailable: tUx('analyzeFailed'),
		api_key: tUx('errors.apiKey'),
		provider_timeout: tUx('errors.timeout'),
		rate_limit: tUx('errors.rateLimit'),
		invalid_response: tUx('errors.invalidResponse'),
		network_error: tUx('errors.network'),
		cancelled: tUx('errors.cancelled'),
		invalid_operation: tUx('analyzeFailed'),
		entitlement: tUx('errors.entitlement'),
		entitlement_quota: tUx('errors.entitlementQuota'),
	};
}

type AsiEnvelopeBody<T> = {
	success?: boolean;
	data?: { snapshot?: T | null; operation?: string; accountUsage?: unknown } | T | null;
	error?: { code?: string; message?: string } | string | null;
	snapshot?: T | null;
};

function errorFromEnvelope(body: AsiEnvelopeBody<AsiSnapshot>, status: number): AsiLoadError {
	const raw =
		typeof body.error === 'string'
			? body.error
			: body.error && typeof body.error === 'object'
				? body.error.code
				: undefined;
	if (isAsiErrorCode(raw)) return raw;
	if (status === 422) return 'invalid_url';
	if (status === 429) return 'rate_limit';
	if (status === 504) return 'provider_timeout';
	if (status === 401 || status === 403) return 'api_key';
	return 'unavailable';
}

function snapshotFromEnvelope<T extends AsiSnapshot>(body: AsiEnvelopeBody<T>): T | null {
	if (body.snapshot) return body.snapshot;
	const data = body.data;
	if (!data) return null;
	if (typeof data === 'object' && data && 'snapshot' in data) {
		return (data.snapshot as T | null) ?? null;
	}
	return data as T;
}

async function postAsi<T extends AsiSnapshot>(
	operation: AsiOperation,
	input: AsiRunInput,
	signal?: AbortSignal,
): Promise<AsiLoadResult<T>> {
	try {
		const res = await fetch('/api/intelligence', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal,
			body: JSON.stringify({
				operation,
				url: input.url,
				query: input.query,
				queries: input.queries,
				expandSov: input.expandSov,
				expandCitations: input.expandCitations,
				probeQueries: input.probeQueries,
				questions: input.questions,
				audit: input.audit ?? null,
				refresh: input.refresh === true ? true : undefined,
			}),
		});
		let body: AsiEnvelopeBody<T> = {};
		try {
			body = (await res.json()) as AsiEnvelopeBody<T>;
		} catch {
			return { snapshot: null, error: res.ok ? 'invalid_response' : 'unavailable' };
		}
		if (!res.ok || body.success === false) {
			return { snapshot: null, error: errorFromEnvelope(body, res.status) };
		}
		const usage = body.data && typeof body.data === 'object' && 'accountUsage' in body.data ? body.data.accountUsage : null;
		if (isPublicAsiAccountUsage(usage)) publishAsiAccountUsage(usage);
		const snapshot = snapshotFromEnvelope(body);
		if (!snapshot) return { snapshot: null, error: 'invalid_url' };
		return { snapshot, error: null };
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return { snapshot: null, error: 'cancelled' };
		}
		return { snapshot: null, error: 'network_error' };
	}
}

export function loadAsiWarRoom(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiWarRoomSnapshot>('war-room', input, signal);
}

export function loadAsiPerception(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiPerceptionSnapshot>('brand-perception', input, signal);
}

export function loadAsiRecommendation(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiRecommendationSnapshot>('recommendation-test', input, signal);
}

export function loadAsiSimulator(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiRecommendationSnapshot>('recommendation-simulator', input, signal);
}

export function loadAsiShareOfVoice(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiRecommendationSnapshot>('share-of-voice', { ...input, expandSov: true }, signal);
}

export function loadAsiEvidence(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiEvidenceSnapshot>('citation-explorer', input, signal);
}

export function loadAsiQueryProbe(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiEvidenceSnapshot>(
		'query-generator',
		{
			...input,
			probeQueries: true,
			expandCitations: false,
		},
		signal,
	);
}

export function loadAsiAgentReadiness(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiAgentReadinessSnapshot>('agent-readiness', input, signal);
}

export function loadAsiOpportunity(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiOpportunitySnapshot>('opportunity-finder', input, signal);
}

export function loadAsiExplorer(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiEvidenceExplorerSnapshot>('evidence-explorer', input, signal);
}

export function loadAsiCompetitorGap(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiCompetitorGapSnapshot>('competitor-gap', input, signal);
}

export function loadAsiNextAction(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiNextActionSnapshot>('next-best-action', input, signal);
}

export function loadAsiVisibility(input: AsiRunInput, signal?: AbortSignal) {
	return postAsi<AsiVisibilityMonitorSnapshot>('visibility-monitor', input, signal);
}

export function cancelAsiRequest(requestId: string) {
	return fetch('/api/intelligence', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ operation: 'cancel', requestId }),
	}).catch(() => undefined);
}
