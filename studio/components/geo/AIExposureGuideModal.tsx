'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Lightbulb, Star, Trophy, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AIExposureGuideModalProps {
	open: boolean;
	onClose: () => void;
}

const LEVELS = [
	{
		key: '3' as const,
		Icon: Trophy,
		card: 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-400/25 dark:bg-emerald-500/[0.08]',
		iconWrap: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
		title: 'text-emerald-950 dark:text-emerald-50',
	},
	{
		key: '2' as const,
		Icon: Star,
		card: 'border-amber-200/80 bg-amber-50/80 dark:border-amber-400/25 dark:bg-amber-500/[0.08]',
		iconWrap: 'border-amber-400/40 bg-amber-500/15 text-amber-800 dark:text-amber-300',
		badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
		title: 'text-amber-950 dark:text-amber-50',
	},
	{
		key: '1' as const,
		Icon: AlertTriangle,
		card: 'border-rose-200/80 bg-rose-50/80 dark:border-rose-400/25 dark:bg-rose-500/[0.08]',
		iconWrap: 'border-rose-400/40 bg-rose-500/15 text-rose-700 dark:text-rose-300',
		badge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
		title: 'text-rose-950 dark:text-rose-50',
	},
] as const;

function GuideQuestion({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-start gap-2.5">
			<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
			<h3 className="break-keep text-sm font-extrabold leading-snug text-slate-900 dark:text-white sm:text-base">
				{children}
			</h3>
		</div>
	);
}

export function AIExposureGuideModal({ open, onClose }: AIExposureGuideModalProps) {
	const t = useTranslations('audit.aiExposureGuide');

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!open || typeof document === 'undefined') return null;

	return createPortal(
		<div
			className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-exposure-guide-title"
			onClick={onClose}
		>
			<div
				className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[90vh] sm:rounded-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<header className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-[#D4AF37]">
								{t('kicker')}
							</p>
							<h2
								id="ai-exposure-guide-title"
								className="mt-1.5 break-keep text-lg font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-xl"
							>
								<span className="mr-1.5" aria-hidden>
									💡
								</span>
								{t('title')}
							</h2>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
							aria-label={t('closeAria')}
						>
							<X className="h-4 w-4" aria-hidden />
						</button>
					</div>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
					<section>
						<GuideQuestion>{t('levelsQuestion')}</GuideQuestion>
						<p className="mt-2.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							{t('levelsIntro')}
						</p>
						<ul className="mt-4 flex flex-col gap-2.5">
							{LEVELS.map(({ key, Icon, card, iconWrap, badge, title }) => (
								<li key={key} className={`rounded-xl border px-3.5 py-3.5 sm:px-4 ${card}`}>
									<div className="flex items-start gap-3">
										<span
											className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconWrap}`}
										>
											<Icon className="h-4 w-4" aria-hidden />
										</span>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className={`break-keep text-sm font-extrabold leading-snug ${title}`}>
													{t(`level${key}Title`)}
												</p>
												<span
													className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge}`}
												>
													{t(`level${key}Badge`)}
												</span>
											</div>
											<p className="mt-1.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">
												{t(`level${key}Body`)}
											</p>
										</div>
									</div>
								</li>
							))}
						</ul>
					</section>

					<section className="mt-7">
						<GuideQuestion>{t('metricsQuestion')}</GuideQuestion>
						<dl className="mt-4 flex flex-col gap-2.5">
							<div className="rounded-xl border border-cyan-200/80 bg-cyan-50/70 px-3.5 py-3.5 dark:border-cyan-400/20 dark:bg-cyan-500/10 sm:px-4">
								<dt className="text-sm font-extrabold text-cyan-950 dark:text-cyan-100">{t('enginesTitle')}</dt>
								<dd className="mt-1.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">
									{t('enginesBody')}
								</dd>
							</div>
						</dl>
					</section>
				</div>
			</div>
		</div>,
		document.body,
	);
}
