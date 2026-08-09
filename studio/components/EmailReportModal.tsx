'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AuditReport } from '@/lib/site-auditor';

interface EmailReportModalProps {
	open: boolean;
	onClose: () => void;
	report: AuditReport;
	reportUrl: string;
	auditId?: string | null;
}

export function EmailReportModal({ open, onClose, report, reportUrl, auditId }: EmailReportModalProps) {
	const t = useTranslations('audit.email');
	const locale = useLocale();
	const [toEmail, setToEmail] = useState('');
	const [contactName, setContactName] = useState('');
	const [companyName, setCompanyName] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	if (!open) return null;

	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const defectCount = checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) !== 'pass').length;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setSending(true);
		setError(null);
		setSuccess(null);
		try {
			const res = await fetch('/api/send-report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					toEmail,
					contactName: contactName || undefined,
					companyName: companyName || undefined,
					reportUrl,
					auditId: auditId || undefined,
					targetUrl: report.url,
					score: report.score,
					maxScore: report.maxScore,
					statusLabel: report.statusLabel,
					geoCitationScore: report.geoCitationScore,
					defectCount,
					lang: locale === 'en' ? 'en' : 'ko',
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? t('error'));
			setSuccess(data.message ?? t('success'));
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true">
			<div className="w-full max-w-md rounded-2xl border border-[#C9A227]/30 bg-[#0B1C2C] p-6 shadow-2xl">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">{t('badge')}</p>
						<h2 className="mt-1 text-lg font-extrabold text-white">{t('title')}</h2>
						<p className="mt-1 text-xs text-slate-400">{t('subtitle')}</p>
					</div>
					<button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
						✕
					</button>
				</div>

				<form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
					<label className="flex flex-col gap-1.5 text-sm">
						<span className="font-semibold text-slate-300">{t('email')}</span>
						<input
							required
							type="email"
							value={toEmail}
							onChange={(e) => setToEmail(e.target.value)}
							placeholder="ceo@company.com"
							className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#D4AF37]"
						/>
					</label>
					<label className="flex flex-col gap-1.5 text-sm">
						<span className="font-semibold text-slate-300">{t('contactName')}</span>
						<input
							type="text"
							value={contactName}
							onChange={(e) => setContactName(e.target.value)}
							placeholder={t('contactPlaceholder')}
							className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#D4AF37]"
						/>
					</label>
					<label className="flex flex-col gap-1.5 text-sm">
						<span className="font-semibold text-slate-300">{t('companyName')}</span>
						<input
							type="text"
							value={companyName}
							onChange={(e) => setCompanyName(e.target.value)}
							placeholder={t('companyPlaceholder')}
							className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#D4AF37]"
						/>
					</label>

					{error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
					{success && (
						<p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{success}</p>
					)}

					<button
						type="submit"
						disabled={sending}
						className="mt-1 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-[#0B1C2C] transition hover:bg-[#e0c15a] disabled:opacity-50"
					>
						{sending ? t('sending') : t('submit')}
					</button>
					<p className="text-[11px] leading-relaxed text-slate-500">{t('footnote')}</p>
				</form>
			</div>
		</div>
	);
}
