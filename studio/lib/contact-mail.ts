import 'server-only';

import nodemailer from 'nodemailer';

const DEFAULT_NOTIFY_TO = 'euniac@naver.com';
const DEFAULT_SMTP_HOST = 'smtp.naver.com';
const DEFAULT_SMTP_PORT = 465;

const INQUIRY_TYPE_LABEL: Record<string, string> = {
	geo: 'GEO 최적화 작업',
	seo: 'SEO 개선 작업',
	schema: '스키마 / 구조화 데이터',
	audit: '정밀 진단 컨설팅',
	general: '기타 문의',
	all: '전체 문의',
};

export type ContactInquiryMailPayload = {
	name: string;
	company?: string | null;
	email: string;
	phone?: string | null;
	inquiryType: string;
	title?: string | null;
	message: string;
	pageUrl?: string | null;
	serviceType?: string | null;
	createdAt?: string | null;
};

function env(name: string): string {
	return process.env[name]?.trim() || '';
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function displayOrDash(value: string | null | undefined): string {
	const trimmed = value?.trim() || '';
	return trimmed ? escapeHtml(trimmed) : '—';
}

function inquiryTypeLabel(inquiryType: string, serviceType?: string | null): string {
	if (serviceType?.trim()) return serviceType.trim();
	return INQUIRY_TYPE_LABEL[inquiryType] || inquiryType || '기타 문의';
}

function applicantLabel(payload: ContactInquiryMailPayload): string {
	return payload.company?.trim() || payload.name.trim() || '신청자';
}

export function buildContactInquiryMail(payload: ContactInquiryMailPayload): {
	subject: string;
	html: string;
	text: string;
} {
	const applicant = applicantLabel(payload);
	const subject = `[REDUE 작업 문의] ${applicant}님의 새로운 작업 문의가 접수되었습니다.`;
	const typeLabel = inquiryTypeLabel(payload.inquiryType, payload.serviceType);
	const receivedAt = payload.createdAt?.trim()
		? new Date(payload.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
		: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

	const rows: Array<[string, string]> = [
		['문의자 성명', displayOrDash(payload.name)],
		['회사명', displayOrDash(payload.company)],
		['연락처', displayOrDash(payload.phone)],
		['이메일', displayOrDash(payload.email)],
		['웹사이트 URL', displayOrDash(payload.pageUrl)],
		['문의 유형', escapeHtml(typeLabel)],
		['문의 제목', displayOrDash(payload.title)],
		['접수 시각', escapeHtml(receivedAt)],
	];

	const messageHtml = payload.message.trim()
		? escapeHtml(payload.message).replace(/\r\n|\r|\n/g, '<br />')
		: '—';

	const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Malgun Gothic','Apple SD Gothic Neo',Segoe UI,Arial,sans-serif;color:#1e2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0B1C2C;padding:22px 24px;">
              <div style="display:inline-block;background:#C9A227;color:#0B1C2C;font-weight:800;font-size:11px;letter-spacing:0.06em;padding:5px 9px;border-radius:6px;">REDUE</div>
              <h1 style="margin:12px 0 0;font-size:20px;line-height:1.4;color:#ffffff;">새로운 작업 문의가 접수되었습니다</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#cbd5e1;">관리자 확인용 알림 메일입니다.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                ${rows
									.map(
										([label, value], index) => `
                <tr>
                  <th align="left" style="width:28%;padding:11px 14px;background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-weight:700;white-space:nowrap;">${label}</th>
                  <td style="padding:11px 14px;background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;word-break:break-all;">${value}</td>
                </tr>`,
									)
									.join('')}
                <tr>
                  <th align="left" valign="top" style="width:28%;padding:11px 14px;background:#ffffff;font-size:12px;color:#64748b;font-weight:700;">상세 문의 내용</th>
                  <td style="padding:11px 14px;background:#ffffff;font-size:13px;line-height:1.65;color:#0f172a;word-break:break-word;">${messageHtml}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 22px;font-size:11px;color:#94a3b8;line-height:1.5;">
              이 메일은 REDUE 작업 문의 접수 시 자동 발송됩니다. 회신 시 문의자 이메일(${escapeHtml(payload.email || '—')})로 전달됩니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = [
		'새로운 작업 문의가 접수되었습니다.',
		'',
		`문의자 성명: ${payload.name || '-'}`,
		`회사명: ${payload.company || '-'}`,
		`연락처: ${payload.phone || '-'}`,
		`이메일: ${payload.email || '-'}`,
		`웹사이트 URL: ${payload.pageUrl || '-'}`,
		`문의 유형: ${typeLabel}`,
		`문의 제목: ${payload.title || '-'}`,
		`접수 시각: ${receivedAt}`,
		'',
		'상세 문의 내용:',
		payload.message || '-',
	].join('\n');

	return { subject, html, text };
}

function createNaverTransport() {
	const user = env('NAVER_USER');
	const pass = env('NAVER_PASSWORD');
	if (!user || !pass) {
		return null;
	}

	const port = Number(env('NAVER_SMTP_PORT') || DEFAULT_SMTP_PORT);
	return nodemailer.createTransport({
		host: env('NAVER_SMTP_HOST') || DEFAULT_SMTP_HOST,
		port: Number.isFinite(port) ? port : DEFAULT_SMTP_PORT,
		secure: true,
		auth: { user, pass },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000,
	});
}

/**
 * Sends an admin notification for a newly stored work inquiry.
 * Never throws — SMTP / network failures are logged and swallowed.
 */
export async function sendContactInquiryMail(payload: ContactInquiryMailPayload): Promise<boolean> {
	try {
		const transport = createNaverTransport();
		if (!transport) {
			console.warn(
				'[contact-mail] NAVER_USER / NAVER_PASSWORD 가 없어 관리자 메일 발송을 건너뜁니다. studio/.env.local 을 확인하세요.',
			);
			return false;
		}

		const from = env('NAVER_USER');
		const to = env('CONTACT_NOTIFY_EMAIL') || DEFAULT_NOTIFY_TO;
		const { subject, html, text } = buildContactInquiryMail(payload);

		await transport.sendMail({
			from: `REDUE 작업 문의 <${from}>`,
			to,
			replyTo: payload.email || undefined,
			subject,
			html,
			text,
		});
		return true;
	} catch (error) {
		console.error('[contact-mail] 관리자 메일 발송 실패:', error);
		return false;
	}
}
