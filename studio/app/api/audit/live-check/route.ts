import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { runLiveEngineChecks } from '@/lib/audit/live-check-engines';
import { resolveLiveCheckQuery } from '@/lib/audit/live-check-score';
import type { LiveCheckEngineId, LiveCheckRequestBody, LiveCheckResponse } from '@/types/live-engine-check';

/** Bind monorepo-root + studio `.env` so MOCK_* switches are visible in live-check. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

export const runtime = 'nodejs';
export const maxDuration = 30;

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

/**
 * POST /api/audit/live-check
 * Body: { siteUrl, siteName, targetQuery, location?, category?, ruleScores? }
 *
 * Calls Gemini / ChatGPT / Perplexity / Claude in parallel with standard
 * JSON-only prompts (no experimental tools). A single engine timeout or
 * failure never blocks the rest.
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
		if (!targetQuery) {
			return noStoreJson({ success: false, targetQuery, results: [], error: 'targetQuery가 필요합니다.' }, { status: 400 });
		}

		const location = asString(body.location);
		const category = asString(body.category);

		const results = await runLiveEngineChecks({
			siteUrl,
			siteName,
			targetQuery,
			location: location || undefined,
			category: category || undefined,
			ruleScores: parseRuleScores(body.ruleScores),
		});

		return noStoreJson({ success: true, targetQuery, results });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Live check failed';
		return noStoreJson({ success: false, targetQuery: '', results: [], error: message }, { status: 500 });
	}
}
