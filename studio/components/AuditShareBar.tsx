'use client';

import Link from 'next/link';
import { memo, useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, FileDown, MessageCircle, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { AuthModal } from '@/components/AuthModal';
import { GeoAeoWorkGuideModal } from '@/components/audit/GeoAeoWorkGuideModal';
import { FLOATING_LOCKED_CLASS, MemberLockBadge } from '@/components/audit/MemberLockBadge';
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import { useAuditMemberGate } from '@/lib/audit/use-audit-member-gate';
import { shareToKakao } from '@/lib/kakao-share';

interface AuditShareBarProps {
	shareUrl: string;
	score: number;
	statusLabel: string;
	onOpenPdfPreview: () => void;
	onOpenExecBrief: () => void;
}

const COMPACT_BAR_MQ = '(max-width: 1599px)';
const ACTION_BTN =
	'group relative flex min-h-[2.75rem] w-auto items-center gap-2 overflow-visible rounded-xl text-left text-sm font-bold transition min-[1600px]:w-full min-[1600px]:px-3.5 min-[1600px]:py-2.5 max-[1599px]:shrink-0 max-[1599px]:justify-center max-[1599px]:px-3 max-[1599px]:py-2.5 max-[450px]:px-2.5';

function ActionButton({
	onClick,
	className,
	icon: Icon,
	label,
	shortLabel,
	title,
	locked = false,
	badge,
}: {
	onClick: (event: MouseEvent<HTMLButtonElement>) => void;
	className: string;
	icon: LucideIcon;
	label: string;
	shortLabel: string;
	title?: string;
	locked?: boolean;
	badge?: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={(event) => {
				event.preventDefault();
				onClick(event);
			}}
			title={title ?? label}
			aria-label={locked ? `${label} (${title ?? label})` : (title ?? label)}
			className={`${ACTION_BTN} ${locked ? FLOATING_LOCKED_CLASS : className}`}
		>
			{locked ? <MemberLockBadge /> : badge}
			<span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
				<Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
			</span>
			<span className="min-w-0 min-[1600px]:inline max-[1599px]:hidden min-[1600px]:flex-1 min-[1600px]:truncate">
				{label}
			</span>
			<span className="hidden truncate text-xs max-[1599px]:inline max-[450px]:hidden">{shortLabel}</span>
		</button>
	);
}

function AuditShareBarInner({
	shareUrl,
	score,
	statusLabel,
	onOpenPdfPreview,
	onOpenExecBrief,
}: AuditShareBarProps) {
	const t = useTranslations('audit.share');
	const tBrief = useTranslations('audit.execBrief');
	const tAuth = useTranslations('audit.authModal');
	const { signedIn, authModalOpen, authModalMessage, requireMember, closeAuthModal } = useAuditMemberGate();
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
	const [shareError, setShareError] = useState<string | null>(null);
	const [isCompactBar, setIsCompactBar] = useState(false);
	const [footerLiftPx, setFooterLiftPx] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const [geoGuideOpen, setGeoGuideOpen] = useState(false);
	const closeGeoGuide = useCallback(() => setGeoGuideOpen(false), []);

	useEffect(() => {
		const mq = window.matchMedia(COMPACT_BAR_MQ);
		const syncMq = () => setIsCompactBar(mq.matches);
		syncMq();
		mq.addEventListener('change', syncMq);
		return () => mq.removeEventListener('change', syncMq);
	}, []);

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

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2800);
		return () => window.clearTimeout(timer);
	}, [toast]);

	function guardExport(event: MouseEvent, action: () => void) {
		event.preventDefault();
		if (requireMember(tAuth('exportMessage'))) {
			action();
			return;
		}
		setToast(t('lockToast'));
	}

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
				setToast(t('copied'));
				setTimeout(() => setCopyState('idle'), 2000);
			}
		} catch (err) {
			setShareError((err as Error).message);
		}
	}

	const kakaoLabel = copyState === 'copied' ? t('copied') : t('kakao');
	const kakaoShort = copyState === 'copied' ? t('copiedShort') : t('kakaoShort');

	return (
		<>
			<div aria-hidden className="pointer-events-none h-0 print:hidden max-[1599px]:h-[4.5rem]" />

			<aside
				aria-label={t('floatingAria')}
				style={isCompactBar ? { bottom: footerLiftPx } : undefined}
				className="fixed z-50 print:hidden transition-[bottom] duration-150 ease-out min-[1600px]:bottom-4 min-[1600px]:right-4 max-[1599px]:inset-x-0 max-[1599px]:bottom-0"
			>
				<div
					className={[
						'overflow-visible border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/90 shadow-2xl backdrop-blur',
						'min-[1600px]:flex min-[1600px]:w-auto min-[1600px]:min-w-[16.5rem] min-[1600px]:max-w-[min(100vw-3rem,22rem)] min-[1600px]:flex-col min-[1600px]:gap-2 min-[1600px]:rounded-2xl min-[1600px]:p-3',
						'max-[1599px]:flex max-[1599px]:w-full max-[1599px]:items-center max-[1599px]:justify-between max-[1599px]:gap-3 max-[1599px]:rounded-none max-[1599px]:border-x-0 max-[1599px]:border-b-0 max-[1599px]:bg-white/95 dark:max-[1599px]:bg-slate-900/95 max-[1599px]:px-4 max-[1599px]:py-3 max-[1599px]:shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:max-[1599px]:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] max-[1599px]:backdrop-blur-md max-[1599px]:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
					].join(' ')}
				>
					<div className="overflow-visible min-[1600px]:contents max-[1599px]:flex max-[1599px]:min-w-0 max-[1599px]:items-center max-[1599px]:gap-2">
						<ActionButton
							onClick={onOpenExecBrief}
							icon={Zap}
							label={tBrief('fabLabel')}
							shortLabel={tBrief('fabLabelShort')}
							title={tBrief('fabAria')}
							className="bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:active:bg-indigo-600 dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-900"
						/>
						<ActionButton
							onClick={(event) => guardExport(event, onOpenPdfPreview)}
							icon={FileDown}
							label={t('pdf')}
							shortLabel={t('pdfShort')}
							locked={!signedIn}
							className="bg-[#D4AF37] text-[#0B1C2C] hover:bg-[#e0c15a]"
						/>
						<ReportShareLinkButton
							shareUrl={shareUrl}
							variant="bar"
							locked={!signedIn}
							onLockedClick={(event) => guardExport(event, () => undefined)}
							onCopied={() => setToast(t('copied'))}
							className={`${ACTION_BTN} ${
								signedIn
									? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10'
									: FLOATING_LOCKED_CLASS
							}`}
						/>
						<ActionButton
							onClick={(event) => guardExport(event, () => void handleShare())}
							icon={MessageCircle}
							label={kakaoLabel}
							shortLabel={kakaoShort}
							locked={!signedIn}
							className="border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
						/>
						<ActionButton
							onClick={() => setGeoGuideOpen(true)}
							icon={BookOpen}
							label={t('geoAeoGuide')}
							shortLabel={t('geoAeoGuideShort')}
							badge={
								<span
									aria-hidden
									className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-cyan-600 text-white shadow-sm dark:border-slate-800 dark:bg-cyan-400 dark:text-slate-950"
								>
									<Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
								</span>
							}
							className="border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/25"
						/>

						{shareError ? (
							<p className="px-1 text-[11px] leading-snug text-rose-700 dark:text-rose-400 min-[1600px]:block max-[1599px]:hidden">
								{shareError}
							</p>
						) : null}
					</div>

					<div className="min-[1600px]:mt-1 min-[1600px]:border-t min-[1600px]:border-slate-200 dark:min-[1600px]:border-white/10 min-[1600px]:pt-2.5 max-[1599px]:mt-0 max-[1599px]:shrink-0 max-[1599px]:border-0 max-[1599px]:pt-0">
						<Link
							href="/contact"
							title={t('contact')}
							className={[
								'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-blue-500',
								'min-[1600px]:w-full min-[1600px]:scale-[1.02] min-[1600px]:px-3 min-[1600px]:py-3 min-[1600px]:text-sm',
								'max-[1599px]:min-h-[2.75rem] max-[1599px]:px-4 max-[1599px]:py-2.5 max-[1599px]:text-sm max-[450px]:px-3 max-[450px]:text-xs',
							].join(' ')}
						>
							<span className="min-w-0 truncate max-[450px]:hidden">{t('contact')}</span>
							<span className="hidden min-w-0 truncate max-[450px]:inline">{t('contactShort')}</span>
						</Link>
					</div>
				</div>
				{toast ? (
					<p
						role="status"
						className="pointer-events-none absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-center text-[11px] font-semibold text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 max-[1599px]:left-4 max-[1599px]:right-4"
					>
						{toast}
					</p>
				) : null}
			</aside>

			<GeoAeoWorkGuideModal open={geoGuideOpen} onClose={closeGeoGuide} />
			<AuthModal open={authModalOpen} onClose={closeAuthModal} message={authModalMessage} />
		</>
	);
}

export const AuditShareBar = memo(AuditShareBarInner);
