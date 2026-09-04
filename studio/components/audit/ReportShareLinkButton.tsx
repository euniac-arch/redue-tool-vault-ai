'use client';

import { type MouseEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { MemberLockBadge } from '@/components/audit/MemberLockBadge';

interface ReportShareLinkButtonProps {
	shareUrl: string;
	className?: string;
	variant?: 'header' | 'preview' | 'bar';
	locked?: boolean;
	onLockedClick?: (event: MouseEvent<HTMLButtonElement>) => void;
	onCopied?: () => void;
}

export function ReportShareLinkButton({
	shareUrl,
	className = '',
	variant = 'header',
	locked = false,
	onLockedClick,
	onCopied,
}: ReportShareLinkButtonProps) {
	const t = useTranslations('audit.share');
	const [copied, setCopied] = useState(false);

	async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		if (locked) {
			onLockedClick?.(event);
			return;
		}
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
		onCopied?.();
		window.setTimeout(() => setCopied(false), 2000);
	}

	const label = copied ? t('copied') : t('copyReportLink');
	const shortLabel = copied ? t('copiedShort') : t('copyReportLinkShort');
	const base =
		variant === 'preview'
			? 'rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/25'
			: variant === 'bar'
				? ''
				: 'rounded-xl border border-cyan-300 bg-cyan-50 px-3.5 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20';

	return (
		<button
			type="button"
			onClick={(event) => void handleCopy(event)}
			disabled={!locked && !shareUrl}
			title={shareUrl || undefined}
			aria-label={label}
			className={`relative inline-flex items-center gap-2 overflow-visible disabled:cursor-not-allowed disabled:opacity-50 ${base} ${className}`}
		>
			{variant === 'bar' && locked ? <MemberLockBadge /> : null}
			<span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
				<Link2 className="h-3.5 w-3.5" strokeWidth={2.25} />
			</span>
			<span className={variant === 'bar' ? 'min-w-0 min-[1600px]:inline max-[1599px]:hidden min-[1600px]:flex-1 min-[1600px]:truncate' : undefined}>
				{label}
			</span>
			{variant === 'bar' ? (
				<span className="hidden truncate text-xs max-[1599px]:inline max-[450px]:hidden">{shortLabel}</span>
			) : null}
		</button>
	);
}
