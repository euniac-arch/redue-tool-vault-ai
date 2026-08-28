'use client';

import { memo, useState, type KeyboardEvent } from 'react';
import { Loader2, Rocket, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AiSearchTimelineGuideModal } from '@/components/audit/AiSearchTimelineGuideModal';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { AUDIT_TAB_ANCHOR_ID, type AuditTrackId } from '@/components/audit/AuditResultTabs';
import { useCountUp } from '@/lib/audit/use-count-up';

interface TwoTrackDiagnosisCardProps {
	technicalScore: number;
	geoScore: number;
	technicalPercentile: number;
	geoPercentile: number;
	isHttps?: boolean;
	securityCapped?: boolean;
	geoGrade?: string | null;
	/** Track 3 — real Core Web Vitals / PSI performance read (0–100), or the on-page fallback while loading. */
	cwvScore: number;
	/** True while the live PageSpeed(Lighthouse) read is still in flight for this audit. */
	cwvLoading?: boolean;
	/** True once a real PSI snapshot has landed — false while the CWV axis is an on-page fallback. */
	cwvMeasured?: boolean;
	/** Single source of truth shared with the bottom detail tab nav (`AuditResultTabs`). */
	activeTrack: AuditTrackId;
	/** Fired when a top card is clicked — activates the matching track and scrolls to the detail tabs. */
	onTrackSelect: (track: AuditTrackId) => void;
}

const TOP_SPEC_THRESHOLD = 95;
const SSL_SAFE_LINE = 85;

/** Active-card theme per track — mirrors the bottom tab nav's accent colors for a unified feel. */
const TOP_CARD_ACTIVE_THEME: Record<AuditTrackId, string> = {
	track1: 'border-2 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] bg-gradient-to-b from-cyan-950/30 to-slate-900/90',
	track2: 'border-2 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)] bg-gradient-to-b from-purple-950/30 to-slate-900/90',
	track3: 'border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] bg-gradient-to-b from-emerald-950/30 to-slate-900/90',
};

/** Fully opaque common style for the two cards that are not the currently active track — never dimmed. */
const INACTIVE_TOP_CARD_CLASS =
	'border-2 border-slate-800/80 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900/70 transition-all duration-300';

const INTERACTIVE_TOP_CARD_CLASS = 'cursor-pointer opacity-100 transition-all duration-300 hover:scale-[1.01]';

function topCardClassName(track: AuditTrackId, activeTrack: AuditTrackId): string {
	const theme = activeTrack === track ? TOP_CARD_ACTIVE_THEME[track] : INACTIVE_TOP_CARD_CLASS;
	return `flex h-full flex-col rounded-xl p-4 ${INTERACTIVE_TOP_CARD_CLASS} ${theme}`;
}

function sslNoticeKey(technicalScore: number, isHttps: boolean, securityCapped: boolean) {
	if (!isHttps || securityCapped) return 'sslMissing' as const;
	if (technicalScore >= SSL_SAFE_LINE && technicalScore < 100) return 'sslSafeLine' as const;
	if (technicalScore < SSL_SAFE_LINE) return 'sslBelow' as const;
	return 'sslComplete' as const;
}

function TwoTrackDiagnosisCardInner({
	technicalScore,
	geoScore,
	technicalPercentile,
	geoPercentile,
	isHttps = true,
	securityCapped = false,
	geoGrade,
	cwvScore,
	cwvLoading = false,
	cwvMeasured = true,
	activeTrack,
	onTrackSelect,
}: TwoTrackDiagnosisCardProps) {
	const t = useTranslations('audit.twoTrack');
	const [guideOpen, setGuideOpen] = useState(false);
	const topSpecAchieved = isHttps && technicalScore >= TOP_SPEC_THRESHOLD;
	const sslKey = sslNoticeKey(technicalScore, isHttps, securityCapped);
	// Counts up from the previous (fallback-estimate) value the instant Track 3 lands
	// and `cwvLoading` flips false — a no-op while the skeleton is still showing.
	const animatedCwvScore = useCountUp(cwvScore);

	function handleCardClick(track: AuditTrackId) {
		onTrackSelect(track);
		if (typeof document === 'undefined') return;
		document.getElementById(AUDIT_TAB_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth' });
	}

	function handleCardKeyDown(track: AuditTrackId, event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		handleCardClick(track);
	}

	return (
		<section
			id="two-track-diagnosis"
			className="audit-report-section scroll-mt-24"
			aria-labelledby="two-track-diagnosis-title"
		>
			<div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md sm:p-7">
				<div
					className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-800/20 via-transparent to-transparent"
					aria-hidden
				/>
				<div className="relative mb-6 flex flex-col gap-3">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold ${
									topSpecAchieved
										? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
										: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-300'
								}`}
							>
								<ShieldCheck className="h-3.5 w-3.5" aria-hidden />
								{topSpecAchieved ? t('badgeAchieved') : t('badgeTarget')}
							</span>
							<h2
								id="two-track-diagnosis-title"
								className="text-base font-extrabold tracking-tight text-white sm:text-lg"
							>
								{t('title')}
							</h2>
						</div>
						<button
							type="button"
							onClick={() => setGuideOpen(true)}
							className="print:hidden inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-2 text-[0.6rem] font-bold text-white shadow-md shadow-indigo-500/25 transition-colors hover:bg-indigo-400 sm:w-auto sm:text-[0.7rem]"
						>
							<Rocket className="h-3.5 w-3.5" aria-hidden />
							{t('openGuide')}
						</button>
					</div>
					<p className="text-[0.6rem] leading-relaxed text-slate-400 sm:text-[0.7rem]">{t('subtitle')}</p>
				</div>

				<div className="relative grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-3">
					<article
						className={topCardClassName('track1', activeTrack)}
						role="button"
						tabIndex={0}
						aria-pressed={activeTrack === 'track1'}
						onClick={() => handleCardClick('track1')}
						onKeyDown={(event) => handleCardKeyDown('track1', event)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs font-bold tracking-wide text-indigo-300">{t('track1.label')}</p>
							<span className="rounded-full border border-indigo-500/30 bg-indigo-500/5 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300">
								{t('track1.weightBadge')}
							</span>
						</div>
						<p className="mt-1 text-[11px] font-semibold text-slate-400">{t('track1.title')}</p>
						<div className="mt-3 flex flex-wrap items-end gap-1.5">
							<span className="text-4xl font-extrabold tabular-nums text-sky-400 sm:text-5xl">
								{technicalScore}
							</span>
							<span className="mb-1 text-sm font-semibold text-slate-500">{t('scoreSuffix')}</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
							<div
								className="h-full rounded-full bg-indigo-500"
								style={{ width: `${Math.min(100, Math.max(technicalScore, 2))}%` }}
							/>
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							<ScoreGradeBadge score={technicalScore} isHttps={isHttps} securityCapped={securityCapped} />
							<span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
								{t('percentile', { percentile: technicalPercentile })}
							</span>
						</div>
						<p
							className={`mt-3 text-xs leading-relaxed ${
								sslKey === 'sslMissing' ? 'text-amber-300' : 'text-slate-400'
							}`}
						>
							{t(`track1.${sslKey}`)}
						</p>
					</article>

					<article
						className={topCardClassName('track2', activeTrack)}
						role="button"
						tabIndex={0}
						aria-pressed={activeTrack === 'track2'}
						onClick={() => handleCardClick('track2')}
						onKeyDown={(event) => handleCardKeyDown('track2', event)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs font-bold tracking-wide text-violet-300">{t('track2.label')}</p>
							<span className="rounded-full border border-violet-500/30 bg-violet-500/5 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
								{t('track2.weightBadge')}
							</span>
						</div>
						<p className="mt-1 text-[11px] font-semibold text-slate-400">{t('track2.title')}</p>
						<div className="mt-3 flex flex-wrap items-end gap-1.5">
							<span className="text-4xl font-extrabold tabular-nums text-purple-400 sm:text-5xl">
								{geoScore}
							</span>
							<span className="mb-1 text-sm font-semibold text-slate-500">{t('scoreSuffix')}</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
							<div
								className="h-full rounded-full bg-violet-500"
								style={{ width: `${Math.min(100, Math.max(geoScore, 2))}%` }}
							/>
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							<ScoreGradeBadge score={geoScore} grade={geoGrade} isHttps={isHttps} />
							<span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
								{t('percentile', { percentile: geoPercentile })}
							</span>
						</div>
						<p className="mt-3 text-xs leading-relaxed text-slate-400">{t('track2.body')}</p>
					</article>

					{/* Track 3 · deliberately Emerald/Teal — keeps a distinct performance-dashboard
					    look away from Track 1's blue/cyan and Track 2's purple/violet accents. */}
					<article
						className={topCardClassName('track3', activeTrack)}
						role="button"
						tabIndex={0}
						aria-pressed={activeTrack === 'track3'}
						onClick={() => handleCardClick('track3')}
						onKeyDown={(event) => handleCardKeyDown('track3', event)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs font-bold tracking-wide text-emerald-400">{t('track3.label')}</p>
							<span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
								{t('track3.weightBadge')}
							</span>
						</div>
						<p className="mt-1 text-[11px] font-semibold text-slate-400">{t('track3.title')}</p>
						{cwvLoading ? (
							<CwvCardSkeleton loadingLabel={t('track3.loadingLabel')} />
						) : (
							<>
								<div className="mt-3 flex flex-wrap items-end gap-1.5">
									<span className="text-4xl font-extrabold tabular-nums text-emerald-400 sm:text-5xl">
										{animatedCwvScore}
									</span>
									<span className="mb-1 text-sm font-semibold text-slate-500">{t('scoreSuffix')}</span>
								</div>
								<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
									<div
										className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300"
										style={{ width: `${Math.min(100, Math.max(animatedCwvScore, 2))}%` }}
									/>
								</div>
								<div className="mt-3 flex flex-wrap items-center gap-1.5">
									<ScoreGradeBadge score={cwvScore} isHttps={isHttps} />
								</div>
								<p className="mt-3 text-xs leading-relaxed text-slate-400">
									{cwvMeasured ? t('track3.body') : t('track3.bodyFallback')}
								</p>
							</>
						)}
					</article>
				</div>
			</div>

			<AiSearchTimelineGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
		</section>
	);
}

export const TwoTrackDiagnosisCard = memo(TwoTrackDiagnosisCardInner);

/** Track 3 pulse skeleton — shown while the live PSI(Lighthouse) read is still in flight. */
function CwvCardSkeleton({ loadingLabel }: { loadingLabel: string }) {
	return (
		<div className="mt-3 flex flex-col gap-2" role="status" aria-live="polite">
			<div className="h-9 w-24 animate-pulse rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/10" />
			<div className="h-1.5 w-full animate-pulse rounded-full bg-slate-800" />
			<div className="flex items-center gap-1.5">
				<div className="h-5 w-14 animate-pulse rounded-full bg-slate-800" />
				<div className="h-5 w-20 animate-pulse rounded-full bg-emerald-500/10" />
			</div>
			<span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
				<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
				{loadingLabel}
			</span>
		</div>
	);
}
