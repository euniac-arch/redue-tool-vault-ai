'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
	Download,
	FileDown,
	ImageDown,
	Loader2,
	Sparkles,
	X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import {
	buildExecBriefModel,
	sanitizeExecBriefFilename,
	type ExecBriefImprovement,
	type ExecBriefModel,
} from '@/lib/audit/exec-brief';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';
import type { AIEngineId } from '@/types/geo-diagnostic';

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
const EASE = [0.22, 1, 0.36, 1] as const;

const LEVEL_CHIP: Record<'1' | '2' | '3' | 'none', string> = {
	'3': 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300',
	'2': 'bg-amber-50 text-amber-800 ring-1 ring-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300',
	'1': 'bg-rose-50 text-rose-800 ring-1 ring-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300',
	none: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300/50 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15',
};

const PTAG_CHIP: Record<ExecBriefImprovement['pTag'], string> = {
	p0Priority: 'bg-rose-50 text-rose-700 ring-1 ring-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300',
	p0Urgent: 'bg-rose-50 text-rose-700 ring-1 ring-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300',
	p1: 'bg-amber-50 text-amber-800 ring-1 ring-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300',
	p2: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-300',
};

function indexTone(score: number): { text: string; stroke: string; bar: string } {
	if (score >= 74) return { text: 'text-emerald-700 dark:text-emerald-300', stroke: '#34d399', bar: 'bg-emerald-400' };
	if (score >= 52) return { text: 'text-amber-700 dark:text-amber-300', stroke: '#fbbf24', bar: 'bg-amber-400' };
	if (score >= 28) return { text: 'text-rose-700 dark:text-rose-300', stroke: '#fb7185', bar: 'bg-rose-400' };
	return { text: 'text-slate-600 dark:text-slate-300', stroke: '#94a3b8', bar: 'bg-slate-400' };
}

function levelChipKey(depth: 1 | 2 | 3 | null): keyof typeof LEVEL_CHIP {
	if (depth === 1 || depth === 2 || depth === 3) return String(depth) as '1' | '2' | '3';
	return 'none';
}

function IndexRing({ score }: { score: number }) {
	const rawId = useId();
	const gradId = `exec-brief-ring-${rawId.replace(/:/g, '')}`;
	const tone = indexTone(score);
	const dash = `${(score / 100) * RING_C} ${RING_C}`;

	return (
		<div className="relative flex h-24 w-24 shrink-0 items-center justify-center" aria-hidden>
			<svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90">
				<defs>
					<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#22d3ee" />
						<stop offset="100%" stopColor={tone.stroke} />
					</linearGradient>
				</defs>
				<circle cx="60" cy="60" r={RING_R} fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="12" />
				<circle
					cx="60"
					cy="60"
					r={RING_R}
					fill="none"
					strokeWidth="12"
					strokeLinecap="round"
					stroke={`url(#${gradId})`}
					strokeDasharray={dash}
				/>
			</svg>
			<p className={`absolute text-xl font-extrabold tabular-nums ${tone.text}`}>{score}%</p>
		</div>
	);
}

const EXEC_BRIEF_BG_DARK = '#0B1028';
const EXEC_BRIEF_BG_LIGHT = '#ffffff';
const ROI_EFFECTS_BG_DARK = '#0f172a';
const ROI_EFFECTS_BG_LIGHT = '#f8fafc';

function flattenCloneBackground(node: HTMLElement, color: string) {
	node.style.backgroundImage = 'none';
	node.style.backgroundColor = color;
	node.style.boxShadow = 'none';
	node.style.backdropFilter = 'none';
	(node.style as any).webkitBackdropFilter = 'none';
	node.style.maskImage = 'none';
	(node.style as any).webkitMaskImage = 'none';
}

async function saveExecBriefCard(el: HTMLElement, kind: 'png' | 'pdf', filenameBase: string) {
	const html2canvas = (await import('html2canvas')).default;
	const isDark = document.documentElement.classList.contains('dark');
	const canvas = await html2canvas(el, {
		backgroundColor: isDark ? EXEC_BRIEF_BG_DARK : EXEC_BRIEF_BG_LIGHT,
		scale: 2,
		useCORS: true,
		logging: false,
		onclone: (doc) => {
			const card = doc.getElementById('exec-brief-card');
			if (card instanceof HTMLElement) {
				card.style.maxHeight = 'none';
				card.style.height = 'auto';
				card.style.overflow = 'visible';
				flattenCloneBackground(card, isDark ? EXEC_BRIEF_BG_DARK : EXEC_BRIEF_BG_LIGHT);
			}
			doc.querySelectorAll<HTMLElement>('[data-exec-brief-scroll]').forEach((node) => {
				node.style.maxHeight = 'none';
				node.style.overflow = 'visible';
				node.style.flex = 'none';
				node.style.backgroundColor = isDark ? EXEC_BRIEF_BG_DARK : EXEC_BRIEF_BG_LIGHT;
			});
			doc.querySelectorAll<HTMLElement>('[data-exec-brief-roi-effects]').forEach((node) => {
				flattenCloneBackground(node, isDark ? ROI_EFFECTS_BG_DARK : ROI_EFFECTS_BG_LIGHT);
			});
			doc.querySelectorAll('[data-exec-brief-chrome]').forEach((node) => {
				(node as HTMLElement).style.display = 'none';
			});
		},
	});

	if (kind === 'png') {
		const link = document.createElement('a');
		link.download = `${filenameBase}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
		return;
	}

	const { jsPDF } = await import('jspdf');
	const img = canvas.toDataURL('image/png');
	const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
	const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4', compress: true });
	const pageW = pdf.internal.pageSize.getWidth();
	const pageH = pdf.internal.pageSize.getHeight();
	const margin = 28;
	const maxW = pageW - margin * 2;
	const maxH = pageH - margin * 2;
	const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
	const drawW = canvas.width * ratio;
	const drawH = canvas.height * ratio;
	pdf.addImage(img, 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
	pdf.save(`${filenameBase}.pdf`);
}

interface ExecBriefModalProps {
	open: boolean;
	onClose: () => void;
	report: AuditReport;
	geoNarrative?: GeoNarrativeReport | null;
	onGoToAnswerCenter: () => void;
}

export function ExecBriefModal({
	open,
	onClose,
	report,
	geoNarrative,
	onGoToAnswerCenter,
}: ExecBriefModalProps) {
	const t = useTranslations('audit.execBrief');
	const tUrgency = useTranslations('audit.b2b.execUrgency');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const reduceMotion = useReducedMotion();
	const liveReport = useEvaluationReport(report);
	const cardRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [saving, setSaving] = useState<'png' | 'pdf' | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	const brief = useMemo(
		() => buildExecBriefModel(liveReport, geoNarrative ?? null, lang),
		[liveReport, geoNarrative, lang],
	);

	useEffect(() => {
		setMounted(true);
	}, []);

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

	async function handleSave(kind: 'png' | 'pdf') {
		if (!cardRef.current || saving) return;
		setSaveError(null);
		setSaving(kind);
		try {
			const filename = `REDUE-AI-Exec-Brief-${sanitizeExecBriefFilename(brief.siteName)}`;
			await saveExecBriefCard(cardRef.current, kind, filename);
		} catch {
			setSaveError(t('saveError'));
		} finally {
			setSaving(null);
		}
	}

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					key="exec-brief-overlay"
					className="print:hidden fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="exec-brief-title"
					onClick={onClose}
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? undefined : { opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.2 }}
				>
					<motion.div
						ref={cardRef}
						id="exec-brief-card"
						className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[90vh] sm:rounded-2xl"
						onClick={(event) => event.stopPropagation()}
						initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: 10 }}
						transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE }}
					>
						<ExecBriefCard
							brief={brief}
							saving={saving}
							saveError={saveError}
							onClose={onClose}
							onGoToAnswerCenter={onGoToAnswerCenter}
							onSave={handleSave}
							t={t}
							tUrgency={tUrgency}
						/>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

function ExecBriefCard({
	brief,
	saving,
	saveError,
	onClose,
	onGoToAnswerCenter,
	onSave,
	t,
	tUrgency,
}: {
	brief: ExecBriefModel;
	saving: 'png' | 'pdf' | null;
	saveError: string | null;
	onClose: () => void;
	onGoToAnswerCenter: () => void;
	onSave: (kind: 'png' | 'pdf') => void;
	t: ReturnType<typeof useTranslations>;
	tUrgency: ReturnType<typeof useTranslations>;
}) {
	const tone = indexTone(brief.aiIndex);

	return (
		<>
			<header className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-[#D4AF37]">
							{t('kicker')}
						</p>
						<h2
							id="exec-brief-title"
							className="mt-1.5 break-keep text-lg font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-xl"
						>
							{t('title')}
						</h2>
						<p className="mt-1 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
							{brief.siteName}
						</p>
					</div>
					<button
						type="button"
						data-exec-brief-chrome
						onClick={onClose}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
						aria-label={t('closeAria')}
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>
			</header>

			<div data-exec-brief-scroll className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
				<section>
					<p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">
						{t('statusKicker')}
					</p>
					<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
						<div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black/25">
							<IndexRing score={brief.aiIndex} />
							<div className="min-w-0">
								<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
									{t('aiIndexLabel')}
								</p>
								<p className={`text-sm font-extrabold ${tone.text}`}>
									{t(`indexedRatio.${brief.indexedKind}`, {
										indexed: brief.indexedCount,
										total: brief.totalEngines,
									})}
								</p>
								<span className="mt-1.5 inline-flex rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#C9A227]">
									{brief.statusTone === 'brandOnly' && brief.urgencyLevel === 'urgent'
										? t('unbrandedUrgent')
										: tUrgency(brief.urgencyLevel)}
								</span>
							</div>
						</div>
						<div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-3.5 dark:border-indigo-400/20 dark:bg-indigo-500/10">
							<p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
								{t('statusLineLabel')}
							</p>
							<p className="mt-1.5 break-keep text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
								“{brief.statusHeadline}”
							</p>
							{brief.judgmentText ? (
								<p className="mt-2 break-keep text-xs leading-relaxed text-slate-600 dark:text-slate-400">
									{brief.judgmentText}
								</p>
							) : null}
						</div>
					</div>

					<ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{brief.engines.map((engine) => {
							const Glyph = ENGINE_GLYPH[engine.id as AIEngineId];
							const theme = ENGINE_CHAT_THEME[engine.id as AIEngineId];
							return (
								<li
									key={engine.id}
									className="flex items-start gap-2.5 overflow-visible rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#0a101f]"
								>
									<span
										className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${theme?.logoWrap ?? 'bg-slate-700'}`}
									>
										{Glyph ? <Glyph className="h-4 w-4" /> : null}
									</span>
									<div className="min-w-0 flex-1 overflow-visible">
										<div className="flex items-center justify-between gap-2 overflow-visible">
											<p className="truncate py-1 text-xs font-extrabold leading-normal text-slate-900 dark:text-white">
												{engine.name}
											</p>
											<span className="tabular-nums text-xs font-bold text-slate-600 dark:text-slate-300">
												{engine.score}%
											</span>
										</div>
										<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
											<div
												className={`h-full rounded-full ${indexTone(engine.score).bar}`}
												style={{ width: `${Math.min(100, Math.max(engine.score, 4))}%` }}
											/>
										</div>
										<span
											className={`mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-tight ${LEVEL_CHIP[levelChipKey(engine.depthLevel)]}`}
										>
											{engine.depthLevel
												? `${engine.levelLabel} (${engine.reason})`
												: engine.reason}
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				</section>

				<section className="mt-7">
					<p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">
						{t('improveKicker')}
					</p>
					<ol className="mt-3 flex flex-col gap-2.5">
						{brief.improvements.length > 0 ? (
							brief.improvements.map((item, index) => (
								<li
									key={item.id}
									className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-white/10 dark:bg-black/25"
								>
									<span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0B1C2C] text-[11px] font-extrabold text-[#D4AF37] dark:bg-[#D4AF37] dark:text-[#0B1C2C]">
										{String(index + 1).padStart(2, '0')}
									</span>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span
												className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${PTAG_CHIP[item.pTag]}`}
											>
												{t(`pTag.${item.pTag}`)}
											</span>
											<p className="break-keep text-sm font-extrabold text-slate-900 dark:text-white">
												{item.title}
											</p>
										</div>
										{item.statusLine ? (
											<p className="mt-1 break-keep text-xs font-semibold text-slate-700 dark:text-slate-200">
												{t('statusPrefix')}: {item.statusLine}
											</p>
										) : null}
										{item.causeLine ? (
											<p className="mt-1 break-keep text-xs leading-relaxed text-slate-600 dark:text-slate-400">
												{t('causePrefix')}: {item.causeLine}
											</p>
										) : (
											<p className="mt-1 break-keep text-xs leading-relaxed text-slate-600 dark:text-slate-400">
												{item.detail}
											</p>
										)}
									</div>
								</li>
							))
						) : (
							<li className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
								{t('improveEmpty')}
							</li>
						)}
					</ol>
				</section>

				<section className="mt-7">
					<p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">
						{t('roiKicker')}
					</p>
					<div className="mt-3 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/25">
							<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('roiCurrent')}</p>
							<div className="mt-1 flex items-baseline gap-1.5">
								<span className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
									{brief.currentScore}
								</span>
								<span className="text-sm font-semibold text-slate-500">%</span>
							</div>
							<p className="mt-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
								{t('roiTechnical', { score: brief.seoScore })}
							</p>
						</div>
						<div className="flex items-center justify-center">
							<div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2.5 text-center">
								<p className="text-sm font-extrabold text-[#D4AF37]">
									{brief.gain > 0 ? t('roiGain', { gain: brief.gain }) : t('roiGainNone')}
								</p>
							</div>
						</div>
						<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
							<p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300/80">
								{t('roiProjected')}
							</p>
							<div className="mt-1 flex items-baseline gap-1.5">
								<span className="text-3xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
									{brief.projectedScore}
								</span>
								<span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300/70">%+</span>
							</div>
							<p className="mt-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
								{brief.reachesAGrade || brief.alreadyInRange
									? t('roiStable', { threshold: brief.threshold })
									: t('roiFoundation', { threshold: brief.threshold })}
							</p>
						</div>
					</div>

					<div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-black/40">
						<div
							className={`h-full rounded-full ${tone.bar}`}
							style={{ width: `${Math.min(100, Math.max(brief.currentScore, 3))}%` }}
						/>
						<div
							className="absolute inset-y-0 w-0.5 bg-emerald-300"
							style={{ left: `${Math.min(100, brief.projectedScore)}%` }}
							aria-hidden
						/>
					</div>

					<div
						data-exec-brief-roi-effects
						className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] p-5 shadow-inner dark:border-slate-700 dark:bg-[#0f172a]"
					>
						<div
							className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-400 to-cyan-500"
							aria-hidden
						/>
						<div className="flex items-start gap-3.5 pl-2">
							<div
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-[#ecfdf5] text-lg text-emerald-600 dark:border-[#34d399]/30 dark:bg-[#064e3b] dark:text-emerald-400"
								aria-hidden
							>
								{brief.roiEffects.length > 0 ? '📈' : '🎯'}
							</div>
							{brief.roiEffects.length > 0 ? (
								<div className="min-w-0 flex-1 space-y-2">
									<h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
										{t('roiEffectsTitle')}
									</h4>
									<ul className="space-y-3 text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
										{brief.roiEffects.map((effect, index) => (
											<li key={effect.id} className="flex items-start gap-2">
												<span className="font-bold text-cyan-600 dark:text-cyan-400">
													{index + 1}.
												</span>
												<p className="break-keep">
													{effect.lead ?? ''}
													{effect.highlight ? (
														<strong className="font-semibold text-slate-900 dark:text-white">
															{effect.highlight}
														</strong>
													) : (
														effect.text
													)}
												</p>
											</li>
										))}
									</ul>
								</div>
							) : (
								<p className="min-w-0 flex-1 break-keep py-1 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
									{t('roiInflowHold')}
								</p>
							)}
						</div>
					</div>
				</section>
			</div>

			<footer className="shrink-0 border-t border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6">
				<div className="mb-4 border-t border-slate-200 pt-3 text-[10.5px] leading-relaxed text-slate-500 dark:border-slate-800">
					{t('disclaimer')}
				</div>
				<div data-exec-brief-chrome>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<button
							type="button"
							onClick={onGoToAnswerCenter}
							className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-blue-500"
						>
							<Sparkles className="h-4 w-4" aria-hidden />
							{brief.isPrescriptionApplied ? t('ctaAnswerCenter') : t('ctaApplyFirst')}
						</button>
						<button
							type="button"
							onClick={() => onSave('png')}
							disabled={Boolean(saving)}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
						>
							{saving === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
							{t('saveImage')}
						</button>
						<button
							type="button"
							onClick={() => onSave('pdf')}
							disabled={Boolean(saving)}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-3 text-sm font-bold text-[#C9A227] transition hover:bg-[#D4AF37]/20 disabled:opacity-60"
						>
							{saving === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
							{t('savePdf')}
						</button>
					</div>
					{saveError ? (
						<p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{saveError}</p>
					) : (
						<p className="mt-2 hidden items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:flex">
							<Download className="h-3 w-3" aria-hidden />
							{t('saveHint')}
						</p>
					)}
				</div>
			</footer>
		</>
	);
}
