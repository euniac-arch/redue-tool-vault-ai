'use client';

import { useState, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { shareToKakao } from '@/lib/kakao-share';

interface AuditShareBarProps {
	captureRef: RefObject<HTMLElement>;
	shareUrl: string;
	score: number;
	statusLabel: string;
}

export function AuditShareBar({ captureRef, shareUrl, score, statusLabel }: AuditShareBarProps) {
	const t = useTranslations('audit.share');
	const [downloading, setDownloading] = useState(false);
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
	const [shareError, setShareError] = useState<string | null>(null);

	async function handleShare() {
		setShareError(null);
		try {
			const shared = await shareToKakao({
				title: `REDUE AI SEO & GEO 진단 리포트 — ${score.toFixed(1)}점 (${statusLabel})`,
				description: '내 사이트의 SEO/GEO 점수를 10초 만에 무료로 확인해보세요.',
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

	async function handleDownloadPdf() {
		if (!captureRef.current) return;
		setDownloading(true);
		try {
			const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
			const canvas = await html2canvas(captureRef.current, { backgroundColor: '#0C0D0E', scale: 2 });
			const imageData = canvas.toDataURL('image/png');
			const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
			pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
			pdf.save(`REDUE_AI_진단리포트_${score.toFixed(0)}점.pdf`);
		} catch {
			setShareError('PDF 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
		} finally {
			setDownloading(false);
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<button
				onClick={handleShare}
				className="rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
			>
				{copyState === 'copied' ? t('copied') : t('kakao')}
			</button>
			<button
				onClick={handleDownloadPdf}
				disabled={downloading}
				className="rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
			>
				{downloading ? t('pdfLoading') : t('pdf')}
			</button>
			{shareError && <p className="text-xs text-rose-400">{shareError}</p>}
		</div>
	);
}
