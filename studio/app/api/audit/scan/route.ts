import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/i18n/request';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditSite, type AuditLang } from '@/lib/site-auditor';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';

interface AuditScanBody {
	url?: string;
	lang?: string;
}

async function resolveLang(explicit?: string): Promise<AuditLang> {
	if (SUPPORTED_LOCALES.includes(explicit as AuditLang)) return explicit as AuditLang;
	const store = await cookies();
	const cookieLocale = store.get(LOCALE_COOKIE)?.value;
	return SUPPORTED_LOCALES.includes(cookieLocale as AuditLang) ? (cookieLocale as AuditLang) : 'ko';
}

/**
 * POST /api/audit/scan — public lead-magnet endpoint. Returns the live report
 * plus `id` of the persisted AuditLead so the client can deep-link to
 * `/audit/result?id=…` without re-scanning.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as AuditScanBody;
	const rawUrl = body.url?.trim();
	if (!rawUrl) {
		return NextResponse.json({ error: '진단할 URL을 입력해 주세요.' }, { status: 400 });
	}

	const lang = await resolveLang(body.lang);

	let report;
	try {
		report = await auditSite(rawUrl, lang);
	} catch (err) {
		if (err instanceof UnsafeAuditUrlError) {
			return NextResponse.json({ error: err.message }, { status: 400 });
		}
		return NextResponse.json({ error: '진단 중 오류가 발생했습니다. URL을 다시 확인해 주세요.' }, { status: 500 });
	}

	const session = await getServerSession(authOptions);
	let auditId: string | null = null;

	try {
		const lead = await prisma.auditLead.create({
			data: {
				url: report.url,
				score: report.score,
				maxScore: report.maxScore,
				statusLabel: report.statusLabel,
				reportJson: JSON.stringify(report),
				userId: session?.user?.id ?? null,
			},
		});
		auditId = lead.id;
	} catch {
		// Lead logging is best-effort — never fail the visitor-facing report over it.
	}

	return NextResponse.json({ ...report, id: auditId });
}
