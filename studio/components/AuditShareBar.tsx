'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { shareToKakao } from '@/lib/kakao-share';

interface AuditShareBarProps {
	shareUrl: string;
	score: number;
	statusLabel: string;
	onOpenEmail: () => void;
}

export function AuditShareBar({ shareUrl, score, statusLabel, onOpenEmail }: AuditShareBarProps) {
	const t = useTranslations('audit.share');
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
	const [shareError, setShareError] = useState<string | null>(null);

	async function handleShare() {
		setShareError(null);
		try {
			const shared = await shareToKakao({
				title: `REDUE AI SEO & GEO Technical Audit — ${score.toFixed(1)} (${statusLabel})`,
				description: 'B2B SEO & GEO precision audit report',
				link: shareUrl,
			});
			if (!shared) {
				await navigator.clipboard.writeText(shareUrl);
				setCopyState('copied');
				setTimeout(() => setCopyState('idle'), 2000);
			}
		} catch (err) {
			setShareError((err as Error).message);
		}
	}

	function handlePrintPdf() {
		window.print();
	}

	return (
		<div className="print:hidden flex flex-col gap-3 rounded-2xl border border-[#C9A227]/25 bg-gradient-to-r from-[#0B1C2C] to-[#102338] p-4 sm:flex-row sm:flex-wrap sm:items-center">
			<button
				type="button"
				onClick={handlePrintPdf}
				className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-[#0B1C2C] transition hover:bg-[#e0c15a]"
			>
				{t('pdf')}
			</button>
			<button
				type="button"
				onClick={onOpenEmail}
				className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
			>
				{t('email')}
			</button>
			<button
				type="button"
				onClick={handleShare}
				className="rounded-xl border border-white/[0.08] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
			>
				{copyState === 'copied' ? t('copied') : t('kakao')}
			</button>
			{shareError && <p className="text-xs text-rose-400">{shareError}</p>}
		</div>
	);
}
