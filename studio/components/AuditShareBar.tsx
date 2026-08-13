'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { shareToKakao } from '@/lib/kakao-share';

interface AuditShareBarProps {
	shareUrl: string;
	score: number;
	statusLabel: string;
	onOpenEmail: () => void;
}

const COMPACT_BAR_MQ = '(max-width: 1599px)';

function ActionButton({
	onClick,
	className,
	icon,
	label,
	shortLabel,
	title,
	nowrap = false,
}: {
	onClick: () => void;
	className: string;
	icon: string;
	label: string;
	shortLabel: string;
	title?: string;
	/** Prevent label ellipsis (e.g. email preview CTA). */
	nowrap?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title ?? label}
			aria-label={label}
			className={`group flex w-auto items-center gap-2 rounded-xl text-left text-sm font-bold transition min-[1600px]:w-full min-[1600px]:px-3.5 min-[1600px]:py-2.5 max-[1599px]:shrink-0 max-[1599px]:justify-center max-[1599px]:px-3 max-[1599px]:py-2.5 max-[450px]:px-2.5 ${nowrap ? 'overflow-visible' : 'overflow-hidden'} ${className}`}
		>
			<span className="shrink-0 text-base leading-none" aria-hidden>
				{icon}
			</span>
			{/* ≥1600: full label · 451–1599: short label · ≤450: icon only */}
			<span
				className={`min-[1600px]:inline max-[1599px]:hidden ${
					nowrap ? 'whitespace-nowrap' : 'min-w-0 flex-1 truncate'
				}`}
			>
				{label}
			</span>
			<span
				className={`hidden text-xs max-[1599px]:inline max-[450px]:hidden ${
					nowrap ? 'whitespace-nowrap' : 'truncate'
				}`}
			>
				{shortLabel}
			</span>
		</button>
	);
}

export function AuditShareBar({
	shareUrl,
	score,
	statusLabel,
	onOpenEmail,
}: AuditShareBarProps) {
	const t = useTranslations('audit.share');
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
	const [shareError, setShareError] = useState<string | null>(null);
	const [isCompactBar, setIsCompactBar] = useState(false);
	const [footerLiftPx, setFooterLiftPx] = useState(0);

	useEffect(() => {
		const mq = window.matchMedia(COMPACT_BAR_MQ);
		const syncMq = () => setIsCompactBar(mq.matches);
		syncMq();
		mq.addEventListener('change', syncMq);
		return () => mq.removeEventListener('change', syncMq);
	}, []);

	/** Lift the bottom bar so it rests just above the site footer when overlapping. */
	useEffect(() => {
		if (!isCompactBar) {
			setFooterLiftPx(0);
			return;
		}

		const footer = document.getElementById('site-footer');
		if (!footer) return;

		const updateLift = () => {
			const rect = footer.getBoundingClientRect();
			const overlap = Math.max(0, Math.ceil(window.innerHeight - rect.top));
			setFooterLiftPx(overlap);
		};

		updateLift();

		const observer = new IntersectionObserver(updateLift, {
			threshold: Array.from({ length: 21 }, (_, i) => i / 20),
		});
		observer.observe(footer);

		window.addEventListener('scroll', updateLift, { passive: true });
		window.addEventListener('resize', updateLift);

		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', updateLift);
			window.removeEventListener('resize', updateLift);
		};
	}, [isCompactBar]);

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

	function openRedueEmailModal() {
		onOpenEmail();
	}

	const kakaoLabel = copyState === 'copied' ? t('copied') : t('kakao');
	const kakaoShort = copyState === 'copied' ? t('copiedShort') : t('kakaoShort');

	return (
		<>
			{/* In-flow spacer so report content is not covered by the fixed bottom bar */}
			<div
				aria-hidden
				className="pointer-events-none h-0 print:hidden max-[1599px]:h-[4.5rem]"
			/>

			<aside
				aria-label={t('floatingAria')}
				style={isCompactBar ? { bottom: footerLiftPx } : undefined}
				className="fixed z-50 print:hidden transition-[bottom] duration-150 ease-out min-[1600px]:bottom-4 min-[1600px]:right-4 max-[1599px]:inset-x-0 max-[1599px]:bottom-0"
			>
				<div
					className={[
						'border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur',
						/* ≥1600: vertical side card — wide enough for email preview label */
						'min-[1600px]:flex min-[1600px]:w-auto min-[1600px]:min-w-[16.5rem] min-[1600px]:max-w-[min(100vw-3rem,22rem)] min-[1600px]:flex-col min-[1600px]:gap-2 min-[1600px]:rounded-2xl min-[1600px]:p-3',
						/* <1600: full-width floating bottom bar */
						'max-[1599px]:flex max-[1599px]:w-full max-[1599px]:items-center max-[1599px]:justify-between max-[1599px]:gap-3 max-[1599px]:rounded-none max-[1599px]:border-x-0 max-[1599px]:border-b-0 max-[1599px]:bg-slate-900/95 max-[1599px]:px-4 max-[1599px]:py-3 max-[1599px]:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] max-[1599px]:backdrop-blur-md max-[1599px]:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
					].join(' ')}
				>
					{/* Left cluster: PDF / Email / Kakao — stacks on desktop via `contents` */}
					<div className="min-[1600px]:contents max-[1599px]:flex max-[1599px]:min-w-0 max-[1599px]:items-center max-[1599px]:gap-2">
						<ActionButton
							onClick={handlePrintPdf}
							icon="📄"
							label={t('pdf')}
							shortLabel={t('pdfShort')}
							className="bg-[#D4AF37] text-[#0B1C2C] hover:bg-[#e0c15a]"
						/>
						<ActionButton
							onClick={openRedueEmailModal}
							icon="✉️"
							label={t('email')}
							shortLabel={t('emailShort')}
							nowrap
							className="border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20"
						/>
						<ActionButton
							onClick={handleShare}
							icon="💬"
							label={kakaoLabel}
							shortLabel={kakaoShort}
							className="border border-white/[0.08] bg-white/5 text-slate-200 hover:bg-white/10"
						/>

						{shareError ? (
							<p className="px-1 text-[11px] leading-snug text-rose-400 min-[1600px]:block max-[1599px]:hidden">
								{shareError}
							</p>
						) : null}
					</div>

					{/* Right / bottom: Contact CTA — always keeps readable text */}
					<div className="min-[1600px]:mt-1 min-[1600px]:border-t min-[1600px]:border-white/10 min-[1600px]:pt-2.5 max-[1599px]:mt-0 max-[1599px]:shrink-0 max-[1599px]:border-0 max-[1599px]:pt-0">
						<Link
							href="/contact"
							title={t('contact')}
							className={[
								'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-blue-500',
								'min-[1600px]:w-full min-[1600px]:scale-[1.02] min-[1600px]:px-3 min-[1600px]:py-3 min-[1600px]:text-sm',
								'max-[1599px]:min-h-[2.75rem] max-[1599px]:px-4 max-[1599px]:py-2.5 max-[1599px]:text-sm max-[450px]:px-3 max-[450px]:text-xs',
							].join(' ')}
						>
							<span className="shrink-0 text-base leading-none" aria-hidden>
								📞
							</span>
							<span className="min-w-0 truncate max-[450px]:hidden">{t('contact')}</span>
							<span className="hidden min-w-0 truncate max-[450px]:inline">{t('contactShort')}</span>
						</Link>
					</div>
				</div>
			</aside>
		</>
	);
}
