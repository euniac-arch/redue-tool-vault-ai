'use client';

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Loader2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
	ASI_SITE_BAR_ID,
	ASI_SITE_INPUT_ID,
	useIntelligence,
	type IntelligenceRecentAudit,
} from '@/components/ai-search-intelligence/shell/IntelligenceContext';

const DROPDOWN_EASE = [0.16, 1, 0.3, 1] as const;

function AsiHistoryDropdown({
	id,
	label,
	placeholder,
	value,
	options,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	placeholder: string;
	value: string;
	options: IntelligenceRecentAudit[];
	disabled: boolean;
	onChange: (id: string) => void;
}) {
	const listId = `${id}-listbox`;
	const reduceMotion = Boolean(useReducedMotion());
	const rootRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);

	const selected = options.find((item) => item.id === value);
	const triggerLabel = selected?.label ?? placeholder;

	useEffect(() => {
		if (!isOpen) return;

		function handlePointerDown(event: PointerEvent) {
			if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setIsOpen(false);
		}

		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	useEffect(() => {
		if (disabled) setIsOpen(false);
	}, [disabled]);

	function toggleOpen() {
		if (disabled) return;
		setIsOpen((prev) => !prev);
	}

	function choose(nextId: string) {
		onChange(nextId);
		setIsOpen(false);
	}

	return (
		<div ref={rootRef} className="relative w-full">
			<label className="sr-only" htmlFor={id}>
				{label}
			</label>
			<button
				id={id}
				type="button"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={listId}
				onClick={toggleOpen}
				onKeyDown={(event) => {
					if (disabled) return;
					if (event.key === 'ArrowDown' && !isOpen) {
						event.preventDefault();
						setIsOpen(true);
					}
				}}
				className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border px-4 text-left text-sm font-medium outline-none transition-all focus-visible:border-cyan-500/60 focus-visible:ring-2 focus-visible:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
					isOpen
						? 'border-cyan-500/60 bg-slate-800/80 text-slate-100 ring-2 ring-cyan-500/20 dark:bg-slate-900/80'
						: 'border-slate-200 bg-white text-slate-800 hover:border-cyan-500/50 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:border-cyan-500/50 dark:hover:bg-slate-800/80'
				}`}
			>
				<span className="min-w-0 truncate">{triggerLabel}</span>
				<ChevronDown
					aria-hidden
					className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
				/>
			</button>
			<AnimatePresence>
				{isOpen ? (
					<motion.ul
						id={listId}
						role="listbox"
						aria-labelledby={id}
						initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: DROPDOWN_EASE }}
						className="absolute left-0 top-full z-50 mt-2 max-h-64 w-full min-w-[240px] origin-top overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-700/70 dark:bg-[#0d1627]/95"
					>
						{options.map((item) => {
							const isSelected = item.id === value;
							return (
								<li key={item.id} role="none">
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										onClick={() => choose(item.id)}
										className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
											isSelected
												? 'border-cyan-500/30 bg-cyan-500/10 font-semibold text-cyan-400'
												: 'border-transparent text-slate-600 hover:border-cyan-500/30 hover:bg-cyan-500/15 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
										}`}
									>
										<span className="min-w-0 truncate">{item.label}</span>
										{isSelected ? <Check aria-hidden className="h-4 w-4 shrink-0 text-cyan-400" /> : null}
									</button>
								</li>
							);
						})}
					</motion.ul>
				) : null}
			</AnimatePresence>
		</div>
	);
}

/**
 * Shared AI 인텔리전스 top control bar — the ONLY place a `/intelligence/*`
 * visit is allowed to kick off analysis. URL input + recent-audit history
 * picker + an explicit [AI 인텔리전스 분석] button; every sub-page reacts to
 * a submit here (see `onAsiAnalyzeRequest` / `seedAsiSiteUrl`) instead of
 * silently re-running whatever site was last audited elsewhere in the app.
 */
export function AsiControlBar() {
	const t = useTranslations('intelligence.controlBar');
	const tIa = useTranslations('intelligence.ia');
	const {
		targetUrl,
		setTargetUrl,
		recentAudits,
		recentAuditsLoading,
		isRequesting,
		analysisProgress,
		requestAnalysis,
		lastError,
	} = useIntelligence();
	const [selectedHistoryId, setSelectedHistoryId] = useState('');

	function handleSelectHistory(id: string) {
		setSelectedHistoryId(id);
		if (!id) return;
		const found = recentAudits.find((item) => item.id === id);
		if (found) setTargetUrl(found.url);
	}

	function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
		setTargetUrl(event.target.value);
		if (selectedHistoryId) setSelectedHistoryId('');
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		requestAnalysis();
	}

	const historyPlaceholder = recentAuditsLoading
		? t('historyPlaceholderLoading')
		: recentAudits.length
			? t('historyPlaceholder')
			: t('historyPlaceholderEmpty');

	return (
		<form
			id={ASI_SITE_BAR_ID}
			onSubmit={handleSubmit}
			className="relative z-20 flex flex-col gap-3 overflow-visible rounded-2xl border border-slate-200/80 border-t-cyan-500/20 bg-white/70 p-4 shadow-sm backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-cyan-400/0 before:via-cyan-400/50 before:to-blue-500/0 dark:border-white/10 dark:border-t-cyan-500/20 dark:bg-[#0b1220]/60 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
		>
			<div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
				<div className="w-full sm:w-64 sm:shrink-0">
					<AsiHistoryDropdown
						id="asi-control-bar-history"
						label={t('historyPlaceholder')}
						placeholder={historyPlaceholder}
						value={selectedHistoryId}
						options={recentAudits}
						disabled={recentAuditsLoading || recentAudits.length === 0}
						onChange={handleSelectHistory}
					/>
				</div>
				<div className="flex w-full min-w-0 flex-1 items-center gap-2">
					<label className="sr-only" htmlFor={ASI_SITE_INPUT_ID}>
						{t('urlPlaceholder')}
					</label>
					<input
						id={ASI_SITE_INPUT_ID}
						type="url"
						inputMode="url"
						autoComplete="url"
						value={targetUrl}
						onChange={handleUrlChange}
						placeholder={t('urlPlaceholder')}
						className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100"
					/>
					<button
						type="submit"
						disabled={!targetUrl.trim() || isRequesting}
						className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100"
					>
						{isRequesting ? (
							<>
								<Loader2 aria-hidden className="h-4 w-4 animate-spin" />
								<span className="whitespace-nowrap">{t('submittingLabel')}</span>
							</>
						) : (
							<>
								<Zap
									aria-hidden
									className="h-4 w-4 fill-slate-950/25 text-slate-950 [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.65))] motion-safe:animate-pulse"
								/>
								<span className="whitespace-nowrap">{t('submitLabel')}</span>
							</>
						)}
					</button>
				</div>
			</div>
			{lastError ? <p className="w-full text-xs font-semibold text-rose-600 dark:text-rose-400">{lastError}</p> : null}
			{isRequesting ? (
				<div className="flex w-full flex-col gap-1.5">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
						<div
							className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
							style={{
								width: `${Math.max(6, Math.round((analysisProgress.done / Math.max(1, analysisProgress.total)) * 100))}%`,
							}}
						/>
					</div>
					<p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
						{tIa('batchProgress', { done: analysisProgress.done, total: analysisProgress.total })}
					</p>
				</div>
			) : null}
			<p className="flex w-full items-center gap-2 text-xs text-slate-400/80">
				<span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.55)]" />
				<span>{t('boundHint')}</span>
			</p>
		</form>
	);
}
