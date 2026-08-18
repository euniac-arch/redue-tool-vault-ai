'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ReportShareLinkButtonProps {
	shareUrl: string;
	className?: string;
	variant?: 'header' | 'preview' | 'bar';
}

export function ReportShareLinkButton({
	shareUrl,
	className = '',
	variant = 'header',
}: ReportShareLinkButtonProps) {
	const t = useTranslations('audit.share');
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			const input = document.createElement('textarea');
			input.value = shareUrl;
			input.setAttribute('readonly', '');
			input.style.position = 'fixed';
			input.style.left = '-9999px';
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
		}
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	const label = copied ? t('copied') : t('copyReportLink');
	const base =
		variant === 'preview'
			? 'rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/25'
			: variant === 'bar'
				? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10'
				: 'rounded-xl border border-cyan-300 bg-cyan-50 px-3.5 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20';

	return (
		<button
			type="button"
			onClick={() => void handleCopy()}
			disabled={!shareUrl}
			title={shareUrl || undefined}
			aria-label={label}
			className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${base} ${className}`}
		>
			<span aria-hidden>🔗</span>
			<span>{label}</span>
		</button>
	);
}
