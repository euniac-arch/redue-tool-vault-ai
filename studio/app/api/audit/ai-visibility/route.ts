import { NextResponse } from 'next/server';
import {
	buildAiEngineVisibilityReport,
	type AiEngineVisibilityInput,
	type AiVisibilityScenario,
} from '@/lib/audit/ai-engine-visibility';
import type { GeoReputationSignals } from '@/lib/audit/geo-score';
import type { SiteMetadata } from '@/lib/audit/site-metadata';
import type { AuditLang } from '@/lib/site-auditor';

export const runtime = 'nodejs';

/**
 * GET/POST /api/audit/ai-visibility
 *
 * MOCK endpoint — returns heuristic Trigger Keyword Depth results for 6 AI
 * engines. Request/response schema is the contract the live crawler should
 * honour:
 *
 *   GET  ?url=&lang=ko|en&scenario=auto|high|low
 *   POST { url, lang, scenario, siteMeta?, signals? }
 *
 * Crawler integration (replace the `buildAiEngineVisibilityReport` call):
 *  - Fan out Level 1/2/3 probes per engine.
 *  - Store raw answer + citation URLs.
 *  - Set `source: 'live'` on the returned `AiEngineVisibilityReport`.
 */

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function parseLang(raw: unknown): AuditLang {
	return raw === 'en' ? 'en' : 'ko';
}

function parseScenario(raw: unknown): AiVisibilityScenario {
	if (raw === 'high' || raw === 'low' || raw === 'auto') return raw;
	return 'auto';
}

function asString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function parseSignals(raw: unknown): GeoReputationSignals | null {
	if (!raw || typeof raw !== 'object') return null;
	const s = raw as Record<string, unknown>;
	const domain = asString(s.domain);
	if (!domain) return null;
	return {
		domain,
		technicalPct: Number(s.technicalPct) || 0,
		schemaPct: Number(s.schemaPct) || 0,
		geoPct: Number(s.geoPct) || 0,
		orgPresent: Boolean(s.orgPresent),
		orgComplete: Boolean(s.orgComplete),
		faqPresent: Boolean(s.faqPresent),
		aiBotsOk: s.aiBotsOk !== false,
		keywords: Array.isArray(s.keywords) ? s.keywords.map((k) => String(k)).filter(Boolean) : [],
	};
}

function parseSiteMeta(raw: unknown): SiteMetadata | null {
	if (!raw || typeof raw !== 'object') return null;
	const m = raw as Record<string, unknown>;
	const domain = asString(m.domain);
	const brandName = asString(m.brandName);
	if (!domain || !brandName) return null;
	return {
		domain,
		brandName,
		category: asString(m.category) || brandName,
		primaryKeyword: asString(m.primaryKeyword) || asString(m.category) || brandName,
		industryType: (asString(m.industryType) as SiteMetadata['industryType']) || 'GENERAL',
		location: asString(m.location) || '',
		broadLocation: asString(m.broadLocation) || '',
		vertical: 'local',
		targetUrl: asString(m.targetUrl) || `https://${domain}`,
	};
}

function buildFromParams(input: AiEngineVisibilityInput) {
	if (!input.url.trim()) {
		return noStoreJson({ error: 'url is required' }, { status: 400 });
	}
	return noStoreJson(buildAiEngineVisibilityReport(input));
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	return buildFromParams({
		url: searchParams.get('url')?.trim() || '',
		lang: parseLang(searchParams.get('lang')),
		scenario: parseScenario(searchParams.get('scenario')),
	});
}

export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	return buildFromParams({
		url: asString(body.url) || asString(body.targetUrl) || '',
		lang: parseLang(body.lang),
		scenario: parseScenario(body.scenario),
		siteMeta: parseSiteMeta(body.siteMeta),
		signals: parseSignals(body.signals),
	});
}
