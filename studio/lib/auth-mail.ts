import 'server-only';

import nodemailer from 'nodemailer';
import { buildPasswordResetUrl } from '@/lib/auth-account';

export const PASSWORD_RESET_MAIL_ERROR = '이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

const DEFAULT_FROM = 'REDUE AI SEO & GEO Studio <no-reply@reduegeo.com>';

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

/** Port 465 is implicit TLS. Port 587 starts plain and upgrades with STARTTLS. */
export function smtpSecureForPort(port: number): boolean {
	return port === 465;
}

type SmtpAuth = { host: string; port: number; user: string; pass: string };

function resolveSmtpAuth(): SmtpAuth | null {
	const genericUser = env('SMTP_USER');
	const genericPass = env('SMTP_PASSWORD') || env('SMTP_PASS');
	if (genericUser && genericPass) {
		const port = Number(env('SMTP_PORT') || (env('SMTP_HOST').includes('gmail') ? 587 : 465));
		return {
			host: env('SMTP_HOST') || 'smtp.gmail.com',
			port: Number.isFinite(port) ? port : 465,
			user: genericUser,
			pass: genericPass,
		};
	}

	const gmailUser = env('GMAIL_USER');
	const gmailPass = env('GMAIL_APP_PASSWORD');
	if (gmailUser && gmailPass) {
		const port = Number(env('GMAIL_SMTP_PORT') || 587);
		return {
			host: env('GMAIL_SMTP_HOST') || 'smtp.gmail.com',
			port: Number.isFinite(port) ? port : 587,
			user: gmailUser,
			pass: gmailPass.replace(/\s+/g, ''),
		};
	}

	const naverUser = env('NAVER_USER');
	const naverPass = env('NAVER_PASSWORD');
	if (naverUser && naverPass) {
		const port = Number(env('NAVER_SMTP_PORT') || 465);
		return {
			host: env('NAVER_SMTP_HOST') || 'smtp.naver.com',
			port: Number.isFinite(port) ? port : 465,
			user: naverUser,
			pass: naverPass,
		};
	}

	return null;
}

function createSmtpTransport(auth: SmtpAuth) {
	return nodemailer.createTransport({
		host: auth.host,
		port: auth.port,
		secure: smtpSecureForPort(auth.port),
		auth: { user: auth.user, pass: auth.pass },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000,
	});
}

function resolveResendFrom(): string {
	const configured = env('PASSWORD_RESET_FROM') || env('REPORT_EMAIL_FROM');
	if (!configured || /onboarding@resend\.dev/i.test(configured)) {
		if (configured && /onboarding@resend\.dev/i.test(configured)) {
			console.warn('[auth-mail] Resend test sender is configured. Password reset uses no-reply@reduegeo.com.');
		}
		return DEFAULT_FROM;
	}
	return configured;
}

function mailBodies(email: string, resetUrl: string): { subject: string; text: string; html: string } {
	const safeEmail = escapeHtml(email);
	const safeUrl = escapeHtml(resetUrl);
	const subject = '[REDUE] 비밀번호 재설정 안내';
	const text = [
		'REDUE AI SEO & GEO Studio',
		'',
		`${email} 계정의 비밀번호 재설정을 요청하셨습니다.`,
		'',
		'아래 링크에서 새 비밀번호를 설정해 주세요. 링크는 1시간 동안만 유효합니다.',
		resetUrl,
		'',
		'본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
	].join('\n');
	const html = `<!DOCTYPE html>
<html lang="ko">
<body style="margin:0;padding:0;background:#f4f7fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:18px;font-weight:700;color:#0f172a;">
              REDUE AI SEO &amp; GEO Studio
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
              <strong>${safeEmail}</strong> 계정의 비밀번호 재설정을 요청하셨습니다.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
              아래 버튼으로 새 비밀번호를 설정해 주세요. 이 링크는 <strong>1시간</strong> 동안만 유효합니다.
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <a href="${safeUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:14px;font-weight:700;">
                비밀번호 재설정하기
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">
              버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br />
              ${safeUrl}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:Arial,Apple SD Gothic Neo,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
              본인이 요청하지 않았다면 이 메일을 무시해 주세요. 비밀번호는 변경되지 않습니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
	return { subject, text, html };
}

async function sendViaSmtp(auth: SmtpAuth, email: string, bodies: { subject: string; text: string; html: string }) {
	const transport = createSmtpTransport(auth);
	await transport.sendMail({
		from: `"REDUE AI SEO & GEO Studio" <${auth.user}>`,
		to: email,
		subject: bodies.subject,
		text: bodies.text,
		html: bodies.html,
	});
}

async function sendViaResend(email: string, bodies: { subject: string; text: string; html: string }) {
	const apiKey = env('RESEND_API_KEY');
	if (!apiKey) {
		throw new Error('RESEND_API_KEY is missing');
	}
	const from = resolveResendFrom();
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from,
			to: [email],
			subject: bodies.subject,
			html: bodies.html,
			text: bodies.text,
		}),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`);
	}
}

export async function sendPasswordResetMail(email: string, token: string): Promise<void> {
	const resetUrl = buildPasswordResetUrl(email, token);
	const bodies = mailBodies(email, resetUrl);
	const smtp = resolveSmtpAuth();

	if (smtp) {
		await sendViaSmtp(smtp, email, bodies);
		return;
	}

	if (env('RESEND_API_KEY')) {
		await sendViaResend(email, bodies);
		return;
	}

	throw new Error('Password reset mail is not configured. Set SMTP/NAVER/GMAIL credentials or RESEND_API_KEY.');
}
