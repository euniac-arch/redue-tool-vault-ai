'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
	ArrowRight,
	CheckCircle2,
	Copy,
	Download,
	Loader2,
	MapPin,
	Sparkles,
	Tags,
	X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
	MOCK_INITIAL_AUDIT,
	MOCK_OPTIMIZED_AUDIT,
	buildResultSummaryDiff,
	formatClientResultReport,
	sanitizeResultSummaryFilename,
	type ResultSummaryAudit,
	type ResultSummaryDiff,
	type SchemaReadiness,
	type LlmsTxtStatus,
} from '@/lib/audit/result-summary-compare';

const EASE = [0.22, 1, 0.36, 1] as const;
const OVERLAY_BG = 'rgba(11, 15, 25, 0.8)';
const CARD_BG = '#131B2E';
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';
const CYAN = '#00F2FE';
const SUB = '#94A3B8';

export interface ResultSummaryOverlayProps {
	open: boolean;
	onClose: () => void;
	/**
	 * Before snapshot, built from the actual audited site via `resultSummaryFromAuditReport()`.
	 * Only falls back to the demo mock when the caller genuinely has no report yet.
	 */
	initialAudit?: ResultSummaryAudit | null;
	/**
	 * After snapshot, built from the actual audited site via `resultSummaryFromAuditReport()`.
	 * Only falls back to the demo mock when the caller genuinely has no report yet.
	 */
	optimizedAudit?: ResultSummaryAudit | null;
}

function useCountUp(target: number, active: boolean, durationMs = 1100): number {
	const reduceMotion = useReducedMotion();
	const [value, setValue] = useState(0);

	useEffect(() => {
		if (!active) {
			setValue(0);
			return;
		}
		if (reduceMotion) {
			setValue(target);
			return;
		}
		let frame = 0;
		const started = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - started) / durationMs);
			const eased = 1 - (1 - t) ** 3;
			setValue(Math.round(target * eased));
			if (t < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [active, durationMs, reduceMotion, target]);

	return value;
}

function schemaLabel(status: SchemaReadiness, t: ReturnType<typeof useTranslations>): string {
	return t(`schemaStatus.${status}`);
}

function llmsLabel(status: LlmsTxtStatus, t: ReturnType<typeof useTranslations>): string {
	return t(`llmsStatus.${status}`);
}

function downloadTextFile(filename: string, text: string) {
	const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
	const href = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(href);
}

export function ResultSummaryOverlay({
	open,
	onClose,
	initialAudit,
	optimizedAudit,
}: ResultSummaryOverlayProps) {
	const t = useTranslations('audit.resultSummary');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [copied, setCopied] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);

	const before = initialAudit ?? MOCK_INITIAL_AUDIT;
	const after = optimizedAudit ?? MOCK_OPTIMIZED_AUDIT;

	const diff = useMemo(
		() => buildResultSummaryDiff(before, after, lang),
		[before, after, lang],
	);

	const countedAfter = useCountUp(diff.score.after, open);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			setCopied(false);
			setExportError(null);
			return;
		}
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

	async function handleExport() {
		if (exporting) return;
		setExportError(null);
		setExporting(true);
		try {
			const text = formatClientResultReport(diff, lang);
			await navigator.clipboard.writeText(text);
			setCopied(true);
			downloadTextFile(
				`REDUE-1min-summary-${sanitizeResultSummaryFilename(diff.siteName)}.txt`,
				text,
			);
			window.setTimeout(() => setCopied(false), 2200);
		} catch {
			setExportError(t('exportError'));
		} finally {
			setExporting(false);
		}
	}

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					key="result-summary-overlay"
					className="print:hidden fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
					style={{ backgroundColor: OVERLAY_BG, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
					role="dialog"
					aria-modal="true"
					aria-labelledby="result-summary-title"
					onClick={onClose}
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? undefined : { opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.2 }}
				>
					<motion.div
						className="flex max-h-[94vh] w-full max-w-2xl flex-col sm:max-h-[90vh]"
						onClick={(event) => event.stopPropagation()}
						initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: 10 }}
						transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE }}
					>
						<div
							className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl"
							style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
						>
							<ResultSummaryCard
								diff={diff}
								countedAfter={countedAfter}
								copied={copied}
								exporting={exporting}
								exportError={exportError}
								onClose={onClose}
								onExport={handleExport}
								t={t}
							/>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

function ResultSummaryCard({
	diff,
	countedAfter,
	copied,
	exporting,
	exportError,
	onClose,
	onExport,
	t,
}: {
	diff: ResultSummaryDiff;
	countedAfter: number;
	copied: boolean;
	exporting: boolean;
	exportError: string | null;
	onClose: () => void;
	onExport: () => void;
	t: ReturnType<typeof useTranslations>;
}) {
	const lift = diff.score.delta;

	return (
		<>
			<header className="shrink-0 border-b px-5 py-4 sm:px-6" style={{ borderColor: CARD_BORDER }}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: CYAN }}>
							{t('kicker')}
						</p>
						<h2
							id="result-summary-title"
							className="mt-1 break-keep text-xl font-extrabold leading-snug text-white sm:text-2xl"
						>
							{t('title')}
						</h2>
						<p className="mt-1 truncate text-sm font-medium" style={{ color: SUB }}>
							{diff.siteName}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-400 transition hover:bg-white/10 hover:text-white"
						style={{ borderColor: CARD_BORDER }}
						aria-label={t('closeAria')}
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
				<section
					className="rounded-2xl border px-4 py-5 sm:px-5"
					style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(0,0,0,0.22)' }}
				>
					<p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: SUB }}>
						{t('scoreKicker')}
					</p>
					<div className="mt-3 flex flex-wrap items-end justify-between gap-4">
						<div className="flex items-end gap-3 sm:gap-4">
							<ScoreStack label={t('before')} value={diff.score.before} muted />
							<ArrowRight className="mb-2 h-5 w-5 shrink-0" style={{ color: CYAN }} aria-hidden />
							<ScoreStack label={t('after')} value={countedAfter} highlight />
						</div>
						{lift !== 0 ? (
							<span
								className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-extrabold tabular-nums"
								style={{
									color: lift > 0 ? '#04161A' : '#fecaca',
									backgroundColor: lift > 0 ? CYAN : 'rgba(244,63,94,0.18)',
									boxShadow: lift > 0 ? `0 0 24px ${CYAN}55` : undefined,
								}}
							>
								{lift > 0 ? t('liftBadge', { n: lift }) : t('dropBadge', { n: Math.abs(lift) })}
							</span>
						) : (
							<span className="text-xs font-semibold" style={{ color: SUB }}>
								{t('liftNone')}
							</span>
						)}
					</div>
				</section>

				<section className="mt-6">
					<p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: SUB }}>
						{t('metricsKicker')}
					</p>
					<ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						<MetricTile
							icon={<Sparkles className="h-4 w-4" aria-hidden />}
							title={t('metric.schema')}
							before={schemaLabel(diff.schema.before, t)}
							after={schemaLabel(diff.schema.after, t)}
							improved={diff.schema.improved}
						/>
						<MetricTile
							icon={<Tags className="h-4 w-4" aria-hidden />}
							title={t('metric.llms')}
							before={llmsLabel(diff.llmsTxt.before, t)}
							after={llmsLabel(diff.llmsTxt.after, t)}
							improved={diff.llmsTxt.improved}
						/>
						<MetricTile
							icon={<Copy className="h-4 w-4" aria-hidden />}
							title={t('metric.metaOg')}
							before={`${diff.metaOg.before}${t('scoreUnit')}`}
							after={`${diff.metaOg.after}${t('scoreUnit')}`}
							improved={diff.metaOg.delta > 0}
							delta={diff.metaOg.delta}
						/>
						<MetricTile
							icon={<MapPin className="h-4 w-4" aria-hidden />}
							title={t('metric.geoLocal')}
							before={`${diff.geoLocal.before}${t('scoreUnit')}`}
							after={`${diff.geoLocal.after}${t('scoreUnit')}`}
							improved={diff.geoLocal.delta > 0}
							delta={diff.geoLocal.delta}
						/>
					</ul>
				</section>

				<section className="mt-6">
					<p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: SUB }}>
						{t('actionsKicker')}
					</p>
					{diff.appliedActions.length > 0 ? (
						<ol className="mt-3 flex flex-col gap-2">
							{diff.appliedActions.map((item, index) => (
								<li
									key={`${item}-${index}`}
									className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5"
									style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(0,242,254,0.04)' }}
								>
									<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: CYAN }} aria-hidden />
									<p className="break-keep text-sm font-semibold text-slate-100">{item}</p>
								</li>
							))}
						</ol>
					) : (
						<p className="mt-3 rounded-xl border px-3.5 py-3 text-sm" style={{ borderColor: CARD_BORDER, color: SUB }}>
							{t('actionsEmpty')}
						</p>
					)}
				</section>
			</div>

			<footer className="shrink-0 border-t px-5 py-4 sm:px-6" style={{ borderColor: CARD_BORDER }}>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<button
						type="button"
						onClick={onExport}
						disabled={exporting}
						className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition disabled:opacity-60"
						style={{ backgroundColor: CYAN, color: '#04161A', boxShadow: `0 10px 28px ${CYAN}33` }}
					>
						{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
						{copied ? t('exported') : t('export')}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
						style={{ borderColor: CARD_BORDER }}
					>
						{t('close')}
					</button>
				</div>
				{exportError ? (
					<p className="mt-2 text-xs font-semibold text-rose-300">{exportError}</p>
				) : (
					<p className="mt-2 text-[11px]" style={{ color: SUB }}>
						{t('exportHint')}
					</p>
				)}
			</footer>
		</>
	);
}

function ScoreStack({
	label,
	value,
	muted,
	highlight,
}: {
	label: string;
	value: number;
	muted?: boolean;
	highlight?: boolean;
}) {
	return (
		<div>
			<p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: muted ? SUB : CYAN }}>
				{label}
			</p>
			<p
				className="mt-1 font-extrabold tabular-nums leading-none"
				style={{
					color: highlight ? CYAN : muted ? '#CBD5E1' : '#fff',
					fontSize: highlight ? '3rem' : '2.25rem',
					textShadow: highlight ? `0 0 28px ${CYAN}55` : undefined,
				}}
			>
				{value}
			</p>
		</div>
	);
}

function MetricTile({
	icon,
	title,
	before,
	after,
	improved,
	delta,
}: {
	icon: ReactNode;
	title: string;
	before: string;
	after: string;
	improved: boolean;
	delta?: number;
}) {
	return (
		<li className="rounded-xl border px-3.5 py-3" style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(0,0,0,0.18)' }}>
			<div className="flex items-center gap-2">
				<span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: CYAN, backgroundColor: 'rgba(0,242,254,0.08)' }}>
					{icon}
				</span>
				<p className="min-w-0 text-xs font-extrabold text-white">{title}</p>
			</div>
			<p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-sm">
				<span style={{ color: SUB }}>{before}</span>
				<ArrowRight className="h-3.5 w-3.5" style={{ color: CYAN }} aria-hidden />
				<span className="font-extrabold" style={{ color: improved ? CYAN : '#E2E8F0' }}>
					{after}
				</span>
				{typeof delta === 'number' && delta > 0 ? (
					<span className="text-[11px] font-bold" style={{ color: CYAN }}>
						+{delta}
					</span>
				) : null}
			</p>
		</li>
	);
}
