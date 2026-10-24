import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { runLiveEngineChecks } from '@/lib/audit/live-check-engines';
import { persistLiveEngineChecks } from '@/lib/audit/persist-live-checks';
import { resolveLiveCheckQuery } from '@/lib/audit/live-check-score';
import { buildUniversalQuerySov, extractBrandAliasesFromMeta } from '@/lib/audit/universal-sov-engine';
import type {
	LiveCheckEngineId,
	LiveCheckPersistStatus,
	LiveCheckRequestBody,
	LiveCheckResponse,
	LiveEngineCheckResult,
	LiveEngineChecksSnapshot,
} from '@/types/live-engine-check';

/** Bind monorepo-root + studio `.env` so MOCK_* switches are visible in live-check. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_QUERY_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const AUDIT_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

function noStoreJson(body: LiveCheckResponse, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
		return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
	} catch {
		return false;
	}
}

function parseRuleScores(raw: unknown): LiveCheckRequestBody['ruleScores'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const source = raw as Record<string, unknown>;
	const scores: NonNullable<LiveCheckRequestBody['ruleScores']> = {};
	for (const engine of ['gemini', 'chatgpt', 'perplexity', 'claude', 'copilot', 'clova'] as const) {
		const value = Number(source[engine]);
		if (Number.isFinite(value)) scores[engine as LiveCheckEngineId] = value;
	}
	return scores;
}

interface LiveCheckOutcome {
	results: LiveEngineCheckResult[];
	startedAt: string;
	checkedAt: string;
	persisted: boolean;
	persistStatus: LiveCheckPersistStatus;
	snapshot: LiveEngineChecksSnapshot;
}

/**
 * Identical overlapping requests (a double click, two tabs on one instance) share one
 * run, so they do not double the paid calls or race each other's write.
 */
const inflight = new Map<string, Promise<LiveCheckOutcome>>();

async function runAndPersist(
	input: Parameters<typeof runLiveEngineChecks>[0],
	auditId: string,
): Promise<LiveCheckOutcome> {
	const startedAt = new Date().toISOString();
	const results = await runLiveEngineChecks(input);
	const checkedAt = new Date().toISOString();
	const snapshot: LiveEngineChecksSnapshot = { checkedAt, startedAt, targetQuery: input.targetQuery, results };

	let persisted = false;
	let persistStatus: LiveCheckPersistStatus = 'skipped';
	let stored: LiveEngineChecksSnapshot | undefined;
	if (auditId && !results.some((row) => row.isMock)) {
		try {
			const saved = await persistLiveEngineChecks(auditId, input.siteUrl, snapshot);
			persisted = saved.ok;
			persistStatus = saved.status;
			stored = saved.snapshot;
			console.info('[live-check persist]', { auditId, status: saved.status, stores: saved.stores });
		} catch (error) {
			persistStatus = 'error';
			console.error('[live-check persist] failed:', error instanceof Error ? error.message : error);
		}
	}
	return { results, startedAt, checkedAt, persisted, persistStatus, snapshot: stored ?? snapshot };
}

/**
 * POST /api/audit/live-check
 * Body: { auditId?, siteUrl, siteName, targetQuery, location?, category?, ruleScores? }
 *
 * Calls ChatGPT / Perplexity / Gemini / Claude in parallel. Each engine has its own 15s
 * abort timer, and Promise.allSettled keeps one failure from cancelling the others.
 * Gemini uses Google Search grounding. Perplexity uses sonar. A result is a measurement
 * only when the response shows a web search ran, so failures and bodies without search
 * evidence keep the rule score and make no exposure claim.
 *
 * With a valid `auditId`, the attempt is also written to that saved report's
 * `liveEngineChecks` field (see `persist-live-checks.ts`). `persisted` is true only when a
 * store confirmed the write, and `persistStatus` says why it was not.
 */
export async function POST(req: NextRequest) {
	try {
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const siteUrl = asString(body.siteUrl);
		const siteName = asString(body.siteName);
		const targetQuery =
			asString(body.targetQuery) ||
			resolveLiveCheckQuery({
				targetKeyword: asString(body.targetKeyword),
				primaryQuery: asString(body.primaryQuery),
				keywords: Array.isArray(body.keywords) ? body.keywords.map((item) => String(item)) : [],
				category: asString(body.category),
			});

		if (!siteUrl || !siteName) {
			return noStoreJson({ success: false, targetQuery, results: [], error: 'siteUrl과 siteName이 필요합니다.' }, { status: 400 });
		}
		if (!isHttpUrl(siteUrl)) {
			return noStoreJson({ success: false, targetQuery, results: [], error: 'siteUrl 형식이 올바르지 않습니다.' }, { status: 400 });
		}
		if (!targetQuery) {
			return noStoreJson({ success: false, targetQuery, results: [], error: 'targetQuery가 필요합니다.' }, { status: 400 });
		}
		if (targetQuery.length > MAX_QUERY_LENGTH || siteName.length > MAX_NAME_LENGTH) {
			return noStoreJson({ success: false, targetQuery: '', results: [], error: '질의 또는 상호가 너무 깁니다.' }, { status: 400 });
		}
		const rawAuditId = asString(body.auditId);
		const auditId = AUDIT_ID_PATTERN.test(rawAuditId) ? rawAuditId : '';

		const location = asString(body.location);
		const category = asString(body.category);
		const requestedAliases = Array.isArray(body.brandAliases)
			? body.brandAliases.map((item) => String(item).trim()).filter((item) => item.length >= 2)
			: [];
		const brandContext = extractBrandAliasesFromMeta({
			targetUrl: siteUrl,
			brandName: siteName,
			pageTitle: siteName,
		});
		const brandAliases = requestedAliases.length ? requestedAliases : brandContext.brandAliases;

		const productTokens = Array.isArray(body.productTokens)
			? body.productTokens.map((item) => String(item).trim()).filter((item) => item.length >= 2)
			: undefined;
		const input = {
			siteUrl,
			siteName,
			targetQuery,
			location: location || undefined,
			category: category || undefined,
			brandAliases,
			productTokens,
			ruleScores: parseRuleScores(body.ruleScores),
		};

		const key = `${auditId}|${siteUrl}|${targetQuery}`;
		let pending = inflight.get(key);
		if (!pending) {
			pending = runAndPersist(input, auditId).finally(() => inflight.delete(key));
			inflight.set(key, pending);
		}
		const { results, startedAt, checkedAt, persisted, persistStatus, snapshot } = await pending;

		const bestRank = results
			.filter((row) => row.isLiveGrounded)
			.map((row) => row.citedRank)
			.filter((rank): rank is 1 | 2 | 3 => rank === 1 || rank === 2 || rank === 3)
			.sort((a, b) => a - b)[0];
		const citations = results
			.filter((row) => row.isLiveGrounded)
			.flatMap((row) => row.citations ?? row.citedSources?.map((url) => ({ title: '', url })) ?? []);
		const querySov = buildUniversalQuerySov({
			query: targetQuery,
			context: { targetUrl: siteUrl, brandAliases, canonicalBrand: siteName },
			clientRank: bestRank,
			citations,
		});

		return noStoreJson({ success: true, targetQuery, results, querySov, persisted, persistStatus, checkedAt, startedAt, snapshot });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Live check failed';
		return noStoreJson({ success: false, targetQuery: '', results: [], error: message }, { status: 500 });
	}
}
