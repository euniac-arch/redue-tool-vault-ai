import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface ReportEmailLead {
	id: string;
	toEmail: string;
	companyName?: string | null;
	contactName?: string | null;
	reportUrl: string;
	auditId?: string | null;
	targetUrl: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	geoCitationScore?: number | null;
	defectCount?: number | null;
	lang: string;
	createdAt: string;
	delivery: 'resend' | 'logged';
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LEADS_FILE = path.join(DATA_DIR, 'report-email-leads.json');

async function readLeads(): Promise<ReportEmailLead[]> {
	try {
		const raw = await readFile(LEADS_FILE, 'utf8');
		const parsed = JSON.parse(raw) as ReportEmailLead[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function appendReportEmailLead(lead: ReportEmailLead): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
	const existing = await readLeads();
	existing.unshift(lead);
	await writeFile(LEADS_FILE, JSON.stringify(existing.slice(0, 500), null, 2), 'utf8');
}

export function buildReportEmailHtml(args: {
	lang: 'ko' | 'en';
	toEmail: string;
	contactName?: string;
	companyName?: string;
	reportUrl: string;
	targetUrl: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	geoCitationScore?: number;
	defectCount?: number;
	consultUrl: string;
}): { subject: string; html: string } {
	const isKo = args.lang !== 'en';
	const greeting = args.contactName
		? isKo
			? `${args.contactName} 님${args.companyName ? ` (${args.companyName})` : ''}`
			: `${args.contactName}${args.companyName ? ` (${args.companyName})` : ''}`
		: isKo
			? '담당자님'
			: 'there';

	const subject = isKo
		? `[REDUE] SEO & GEO 정밀 진단 보고서 — ${args.statusLabel} (${args.score}/${args.maxScore})`
		: `[REDUE] SEO & GEO Technical Audit — ${args.statusLabel} (${args.score}/${args.maxScore})`;

	const html = `<!DOCTYPE html>
<html lang="${isKo ? 'ko' : 'en'}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0B1C2C;font-family:Segoe UI,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B1C2C;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#102338;border:1px solid rgba(201,162,39,0.35);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 28px 12px;">
          <div style="display:inline-block;background:#C9A227;color:#0B1C2C;font-weight:800;font-size:12px;padding:6px 10px;border-radius:8px;">REDUE</div>
          <h1 style="margin:16px 0 8px;font-size:22px;line-height:1.35;color:#fff;">
            ${isKo ? 'SEO & GEO 정밀 진단 보고서' : 'SEO & GEO Technical Audit Report'}
          </h1>
          <p style="margin:0;color:#94a3b8;font-size:14px;">${isKo ? '안녕하세요,' : 'Hi'} ${greeting}.</p>
        </td></tr>
        <tr><td style="padding:8px 28px 20px;">
          <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.6;">
            ${
							isKo
								? '요청하신 사이트의 정밀 진단 요약입니다. 상세 기술적 증거와 개선 우선순위는 아래 보고서 링크에서 확인하실 수 있습니다.'
								: 'Here is the precision audit summary for your site. Open the report link below for technical evidence and prioritized fixes.'
						}
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B1C2C;border-radius:12px;">
            <tr>
              <td style="padding:16px;width:33%;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">${isKo ? '종합 점수' : 'Score'}</div>
                <div style="font-size:24px;font-weight:800;color:#D4AF37;margin-top:4px;">${args.score}/${args.maxScore}</div>
                <div style="font-size:12px;color:#94a3b8;">${args.statusLabel}</div>
              </td>
              <td style="padding:16px;width:33%;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">${isKo ? 'AI 인용 친화도' : 'AI citation'}</div>
                <div style="font-size:24px;font-weight:800;color:#34d399;margin-top:4px;">${args.geoCitationScore ?? '—'}</div>
              </td>
              <td style="padding:16px;width:33%;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">${isKo ? '기술 결함' : 'Defects'}</div>
                <div style="font-size:24px;font-weight:800;color:#fb7185;margin-top:4px;">${args.defectCount ?? '—'}</div>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;word-break:break-all;">URL: ${args.targetUrl}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;" align="center">
          <a href="${args.reportUrl}" style="display:inline-block;background:#635bff;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:12px;">
            ${isKo ? '상세 웹 보고서 열기' : 'Open full web report'}
          </a>
          <div style="height:12px;"></div>
          <a href="${args.consultUrl}" style="display:inline-block;background:transparent;color:#D4AF37;text-decoration:none;font-weight:700;font-size:13px;padding:12px 18px;border-radius:12px;border:1px solid rgba(212,175,55,0.45);">
            ${isKo ? '전문가에게 1:1 최적화 작업 요청하기' : 'Request 1:1 optimization with an expert'}
          </a>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">
            ${
							isKo
								? '본 메일은 REDUE AI 정밀 진단 엔진으로 생성되었습니다. 작업 문의: contact@redue.ai'
								: 'Generated by the REDUE AI precision audit engine. Inquiries: contact@redue.ai'
						}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

	return { subject, html };
}

/** Optional Resend delivery. Returns true when accepted by the provider. */
export async function sendReportViaResend(args: {
	to: string;
	subject: string;
	html: string;
}): Promise<boolean> {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) return false;

	const from = process.env.REPORT_EMAIL_FROM?.trim() || 'REDUE Audit <onboarding@resend.dev>';
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from,
			to: [args.to],
			subject: args.subject,
			html: args.html,
			...(process.env.REPORT_INBOX_EMAIL
				? { bcc: [process.env.REPORT_INBOX_EMAIL.trim()] }
				: {}),
		}),
	});

	return res.ok;
}
