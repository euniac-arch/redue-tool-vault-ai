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
 * POST /api/audit/scan — the Step 7 lead-magnet endpoint. Deliberately public
 * (no auth required): a prospect only needs to paste their URL to get a real,
 * live scan. Every scan is logged to `AuditLead` (best-effort, never blocks
 * the response) so sales can follow up on who checked their score.
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
	prisma.auditLead
		.create({
			data: {
				url: report.url,
				score: report.score,
				maxScore: report.maxScore,
				statusLabel: report.statusLabel,
				reportJson: JSON.stringify(report),
				userId: session?.user?.id ?? null,
			},
		})
		.catch(() => {
			// Lead logging is best-effort — never fail the visitor-facing report over it.
		});

	return NextResponse.json(report);
}
