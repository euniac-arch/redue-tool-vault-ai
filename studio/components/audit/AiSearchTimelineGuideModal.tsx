'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, MapPin, MessageSquareText, Radar, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface AiSearchTimelineGuideModalProps {
	open: boolean;
	onClose: () => void;
}

const CYCLE_KEYS = ['realtime', 'generative'] as const;
const CHECKLIST_ITEMS = [
	{ key: 'index', icon: Radar },
	{ key: 'qa', icon: MessageSquareText },
	{ key: 'nap', icon: MapPin },
] as const;

function CycleChip({ children, tone }: { children: ReactNode; tone: 'indigo' | 'emerald' }) {
	const chip =
		tone === 'indigo'
			? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
			: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
	return (
		<span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums ${chip}`}>
			{children}
		</span>
	);
}

export function AiSearchTimelineGuideModal({ open, onClose }: AiSearchTimelineGuideModalProps) {
	const t = useTranslations('audit.twoTrack.modal');

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

	const openForecast = () => {
		onClose();
		requestAnimationFrame(() => {
			document.getElementById('ai-timeline-forecast')?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		});
	};

	return createPortal(
		<div
			className="print:hidden animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-timeline-guide-title"
			aria-describedby="ai-timeline-guide-desc"
			onClick={onClose}
		>
			<div
				className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-indigo-500/10"
				onClick={(event) => event.stopPropagation()}
			>
				<header className="shrink-0 border-b border-slate-800 px-5 py-5 pr-16 sm:px-7">
					<button
						type="button"
						onClick={onClose}
						className="absolute top-4 right-4 rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
						aria-label={t('closeAria')}
					>
						<X className="h-5 w-5" aria-hidden />
					</button>
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-400">{t('kicker')}</p>
					<h3
						id="ai-timeline-guide-title"
						className="mt-1.5 break-keep text-xl font-black tracking-tight text-white sm:text-2xl"
					>
						{t('title')}
					</h3>
					<p id="ai-timeline-guide-desc" className="mt-2 break-keep text-sm leading-relaxed text-slate-400">
						{t('desc')}
					</p>
				</header>

				<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
					<section aria-labelledby="ai-cycle-title">
						<div className="mb-3 flex items-center gap-2">
							<Clock3 className="h-4 w-4 text-indigo-400" aria-hidden />
							<h4 id="ai-cycle-title" className="text-sm font-extrabold text-white">
								{t('cyclesTitle')}
							</h4>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{CYCLE_KEYS.map((key) => (
								<article
									key={key}
									className={`rounded-xl border p-4 ${
										key === 'realtime'
											? 'border-indigo-500/30 bg-indigo-500/10'
											: 'border-emerald-500/30 bg-emerald-500/10'
									}`}
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-bold text-white">{t(`cycles.${key}.title`)}</p>
										<CycleChip tone={key === 'realtime' ? 'indigo' : 'emerald'}>
											{t(`cycles.${key}.window`)}
										</CycleChip>
									</div>
									<p className="mt-2 text-xs leading-relaxed text-slate-300">{t(`cycles.${key}.body`)}</p>
									<p className="mt-2 text-[11px] font-semibold text-slate-500">{t(`cycles.${key}.engines`)}</p>
								</article>
							))}
						</div>
					</section>

					<section className="mt-7" aria-labelledby="ai-weekly-title">
						<h4 id="ai-weekly-title" className="text-sm font-extrabold text-white">
							{t('checklistTitle')}
						</h4>
						<p className="mt-1 text-xs leading-relaxed text-slate-400">{t('checklistHint')}</p>
						<ol className="mt-4 space-y-3">
							{CHECKLIST_ITEMS.map(({ key, icon: Icon }, index) => (
								<li
									key={key}
									className="flex gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4"
								>
									<span
										className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
										aria-hidden
									>
										<Icon className="h-4 w-4" />
									</span>
									<div className="min-w-0">
										<p className="text-sm font-bold text-white">
											<span className="mr-1.5 tabular-nums text-indigo-400">{index + 1}.</span>
											{t(`checklist.${key}.title`)}
										</p>
										<p className="mt-1.5 text-xs leading-relaxed text-slate-400">
											{t(`checklist.${key}.body`)}
										</p>
									</div>
								</li>
							))}
						</ol>
					</section>

					<p className="mt-6 text-[11px] leading-relaxed text-slate-500">{t('disclaimer')}</p>
				</div>

				<footer className="shrink-0 border-t border-slate-800 px-5 py-4 sm:px-7">
					<button
						type="button"
						onClick={openForecast}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400"
					>
						{t('forecastCta')}
					</button>
				</footer>
			</div>
		</div>,
		document.body,
	);
}
