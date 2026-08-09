import { NextResponse } from 'next/server';
import {
	appendReportEmailLead,
	buildReportEmailHtml,
	sendReportViaResend,
} from '@/lib/report-email';

export const runtime = 'nodejs';

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * POST /api/send-report — deliver (or queue) a B2B audit report email.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs the lead for sales follow-up.
 */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const toEmail = String(body.toEmail ?? body.email ?? '').trim().toLowerCase();
	const reportUrl = String(body.reportUrl ?? '').trim();
	const targetUrl = String(body.targetUrl ?? '').trim();
	const contactName = String(body.contactName ?? '').trim() || undefined;
	const companyName = String(body.companyName ?? '').trim() || undefined;
	const auditId = String(body.auditId ?? '').trim() || undefined;
	const lang = String(body.lang ?? 'ko') === 'en' ? 'en' : 'ko';
	const score = Number(body.score);
	const maxScore = Number(body.maxScore);
	const statusLabel = String(body.statusLabel ?? '').trim() || '—';
	const geoCitationScore = body.geoCitationScore == null ? undefined : Number(body.geoCitationScore);
	const defectCount = body.defectCount == null ? undefined : Number(body.defectCount);

	if (!isValidEmail(toEmail)) {
		return NextResponse.json({ error: '유효한 이메일 주소를 입력해 주세요.' }, { status: 400 });
	}
	if (!reportUrl || !targetUrl || !Number.isFinite(score) || !Number.isFinite(maxScore)) {
		return NextResponse.json({ error: '보고서 정보가 올바르지 않습니다.' }, { status: 400 });
	}

	const origin = (() => {
		try {
			return new URL(reportUrl).origin;
		} catch {
			return process.env.NEXTAUTH_URL || 'https://redue-tool-vault-ai.vercel.app';
		}
	})();

	const consultUrl =
		process.env.REPORT_CONSULT_URL?.trim() ||
		process.env.NEXT_PUBLIC_KAKAO_CONSULT_URL?.trim() ||
		`${origin}/enterprise`;

	const { subject, html } = buildReportEmailHtml({
		lang,
		toEmail,
		contactName,
		companyName,
		reportUrl,
		targetUrl,
		score,
		maxScore,
		statusLabel,
		geoCitationScore,
		defectCount,
		consultUrl,
	});

	let delivery: 'resend' | 'logged' = 'logged';
	try {
		const sent = await sendReportViaResend({ to: toEmail, subject, html });
		if (sent) delivery = 'resend';
	} catch {
		delivery = 'logged';
	}

	const lead = {
		id: `rpt_${Date.now().toString(36)}`,
		toEmail,
		companyName: companyName ?? null,
		contactName: contactName ?? null,
		reportUrl,
		auditId: auditId ?? null,
		targetUrl,
		score,
		maxScore,
		statusLabel,
		geoCitationScore: geoCitationScore ?? null,
		defectCount: defectCount ?? null,
		lang,
		createdAt: new Date().toISOString(),
		delivery,
	};

	await appendReportEmailLead(lead).catch(() => {});

	return NextResponse.json({
		ok: true,
		delivery,
		message:
			delivery === 'resend'
				? '보고서 이메일을 발송했습니다.'
				: '요청이 접수되었습니다. 영업 담당자가 보고서 링크와 함께 회신합니다.',
	});
}
