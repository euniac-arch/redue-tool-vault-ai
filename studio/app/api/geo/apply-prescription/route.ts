import { NextResponse } from 'next/server';
import { applyGeoPrescription } from '@/lib/geo/apply-prescription';
import { getAuditProjectById } from '@/lib/firebase/audit-projects';
import { prisma } from '@/lib/prisma';
import type { IndustryType } from '@/lib/audit/site-metadata';
import type { AIEngineId, GeoDiagnosticReport, KeywordDepthLevel } from '@/types/geo-diagnostic';
import type { ApplyPrescriptionRequest, PrescriptionLang } from '@/types/geo-prescription';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ENGINE_IDS: readonly AIEngineId[] = ['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'];

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function asString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function parseLang(raw: unknown): PrescriptionLang {
	return raw === 'en' ? 'en' : 'ko';
}

function parseIndustry(raw: unknown): IndustryType | undefined {
	if (raw === 'MEDICAL' || raw === 'LOCAL_STORE' || raw === 'B2B_MFG' || raw === 'GENERAL') return raw;
	return undefined;
}

function parseKeywords(raw: unknown): string[] | undefined {
	if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
	if (typeof raw === 'string') {
		return raw
			.split(/[,|\n]/)
			.map((item) => item.trim())
			.filter(Boolean)
			.slice(0, 12);
	}
	return undefined;
}

function parseBeforeLevels(raw: unknown): ApplyPrescriptionRequest['beforeLevels'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const src = raw as Record<string, unknown>;
	const out: NonNullable<ApplyPrescriptionRequest['beforeLevels']> = {};
	for (const id of ENGINE_IDS) {
		const value = src[id];
		if (value === null) {
			out[id] = null;
			continue;
		}
		const num = Number(value);
		if (num === 0 || num === 1 || num === 2 || num === 3) {
			out[id] = num as KeywordDepthLevel | 0;
		}
	}
	return Object.keys(out).length ? out : undefined;
}

function isDiagnosticReport(raw: unknown): raw is GeoDiagnosticReport {
	if (!raw || typeof raw !== 'object') return false;
	const obj = raw as Record<string, unknown>;
	return typeof obj.targetUrl === 'string' && Array.isArray(obj.engines);
}

function parseBody(raw: unknown): ApplyPrescriptionRequest | null {
	if (!raw || typeof raw !== 'object') return null;
	const body = raw as Record<string, unknown>;
	const targetUrl = asString(body.targetUrl) || asString(body.url) || asString(body.siteUrl);
	const siteId = asString(body.siteId);
	if (!targetUrl && !siteId) return null;

	return {
		siteId,
		targetUrl: targetUrl || '',
		currentSchema: body.currentSchema as ApplyPrescriptionRequest['currentSchema'],
		targetKeywords: parseKeywords(body.targetKeywords),
		lang: parseLang(body.lang),
		brandName: asString(body.brandName),
		category: asString(body.category),
		location: asString(body.location),
		industryType: parseIndustry(body.industryType),
		beforeLevels: parseBeforeLevels(body.beforeLevels),
		forceRefresh: body.forceRefresh !== false,
	};
}

async function resolveSiteFromId(siteId: string): Promise<{ url?: string; name?: string; category?: string }> {
	try {
		const project = await prisma.project.findUnique({
			where: { id: siteId },
			select: { targetUrl: true, name: true, category: true },
		});
		if (project?.targetUrl) {
			return { url: project.targetUrl, name: project.name, category: project.category };
		}
	} catch {
		/* prisma may be unavailable in some environments */
	}

	try {
		const lead = await prisma.auditLead.findUnique({
			where: { id: siteId },
			select: { url: true },
		});
		if (lead?.url) return { url: lead.url };
	} catch {
		/* ignore */
	}

	try {
		const doc = await getAuditProjectById(siteId);
		if (doc?.url) return { url: doc.url };
	} catch {
		/* firebase optional */
	}

	return {};
}

/**
 * POST /api/geo/apply-prescription
 * Body: { siteId?, targetUrl, currentSchema?, targetKeywords?, brandName?, category?, ... }
 *
 * Runs scrape → GEO patch generation → 6-engine re-simulation.
 */
export async function POST(request: Request) {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return noStoreJson({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const input = parseBody(raw);
	if (!input) {
		return noStoreJson({ error: 'targetUrl 또는 siteId에 연결된 URL이 필요합니다.' }, { status: 400 });
	}

	if (!input.targetUrl && input.siteId) {
		const resolved = await resolveSiteFromId(input.siteId);
		if (resolved.url) {
			input.targetUrl = resolved.url;
			if (!input.brandName && resolved.name) input.brandName = resolved.name;
			if (!input.category && resolved.category) input.category = resolved.category;
		}
	}

	if (!input.targetUrl) {
		return noStoreJson({ error: 'targetUrl 또는 siteId에 연결된 URL이 필요합니다.' }, { status: 400 });
	}

	const body = raw as Record<string, unknown>;
	const beforeReport = isDiagnosticReport(body.beforeReport) ? body.beforeReport : undefined;

	try {
		const result = await applyGeoPrescription(input, beforeReport);
		return noStoreJson(result);
	} catch (err) {
		const message = err instanceof UnsafeAuditUrlError ? err.message : err instanceof Error ? err.message : '처방전 적용에 실패했습니다.';
		return noStoreJson({ error: message }, { status: 400 });
	}
}
