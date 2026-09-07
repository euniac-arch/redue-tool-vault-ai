import 'server-only';

import nodemailer from 'nodemailer';
import { getAppOrigin } from '@/lib/audit/report-url';

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

function createNaverTransport() {
	const user = env('NAVER_USER');
	const pass = env('NAVER_PASSWORD');
	if (!user || !pass) return null;
	const port = Number(env('NAVER_SMTP_PORT') || 465);
	return nodemailer.createTransport({
		host: env('NAVER_SMTP_HOST') || 'smtp.naver.com',
		port: Number.isFinite(port) ? port : 465,
		secure: true,
		auth: { user, pass },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000,
	});
}

export function buildPasswordResetUrl(email: string, token: string, origin?: string): string {
	const base = (origin || getAppOrigin()).replace(/\/$/, '');
	const params = new URLSearchParams({ email, token });
	return `${base}/reset-password?${params.toString()}`;
}

export async function sendPasswordResetMail(email: string, token: string, origin?: string): Promise<boolean> {
	const transport = createNaverTransport();
	if (!transport) {
		console.warn('[auth-mail] NAVER_USER / NAVER_PASSWORD 가 없어 재설정 메일을 건너뜁니다.');
		return false;
	}

	const from = env('NAVER_USER');
	const resetUrl = buildPasswordResetUrl(email, token, origin);
	const safeEmail = escapeHtml(email);
	const safeUrl = escapeHtml(resetUrl);

	await transport.sendMail({
		from: `REDUE 계정 <${from}>`,
		to: email,
		subject: '[REDUE] 비밀번호 재설정 안내',
		text: [
			'비밀번호 재설정을 요청하셨습니다.',
			'',
			'아래 링크를 클릭해 새 비밀번호를 설정해 주세요. 링크는 1시간 동안만 유효합니다.',
			resetUrl,
			'',
			'본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
		].join('\n'),
		html: `
			<div style="font-family:Pretendard,Apple SD Gothic Neo,sans-serif;line-height:1.6;color:#0f172a">
				<p><strong>${safeEmail}</strong> 계정의 비밀번호 재설정을 요청하셨습니다.</p>
				<p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요. 링크는 <strong>1시간</strong> 동안만 유효합니다.</p>
				<p style="margin:24px 0">
					<a href="${safeUrl}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
						비밀번호 재설정하기
					</a>
				</p>
				<p style="font-size:12px;color:#64748b;word-break:break-all">${safeUrl}</p>
				<p style="font-size:12px;color:#64748b">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
			</div>
		`,
	});
	return true;
}
