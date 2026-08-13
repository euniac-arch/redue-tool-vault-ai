'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
	formatBytes,
	formatKiB,
	formatMs,
	type PageSpeedSnapshot,
	type PsiCoreVital,
	type PsiScoreTier,
} from '@/lib/audit/pagespeed';
import { PageSpeedScoreCards } from '@/components/audit/PageSpeedScoreCards';
import { PageSpeedSkeleton } from '@/components/audit/PageSpeedSkeleton';
import { PageSpeedSolutionGuide } from '@/components/audit/PageSpeedSolutionGuide';

export type PageSpeedStrategy = 'desktop' | 'mobile';

const TIER_STYLES: Record<
	PsiScoreTier,
	{ border: string; bg: string; text: string; icon: string }
> = {
	poor: {
		border: 'border-rose-500/35',
		bg: 'bg-rose-500/10',
		text: 'text-rose-300',
		icon: '🔴',
	},
	'needs-improvement': {
		border: 'border-amber-400/35',
		bg: 'bg-amber-500/10',
		text: 'text-amber-300',
		icon: '🟡',
	},
	good: {
		border: 'border-emerald-500/35',
		bg: 'bg-emerald-500/10',
		text: 'text-emerald-300',
		icon: '🟢',
	},
};

function vitalDisplay(v: PsiCoreVital): string {
	if (v.displayValue) return v.displayValue;
	if (v.value == null) return '—';
	if (v.id === 'lcp' || v.id === 'fcp') return `${v.value.toFixed(2)} s`;
	if (v.id === 'cls') return String(v.value);
	return `${Math.round(v.value)} ms`;
}

function buildOfficialPsiUrl(targetUrl: string): string | null {
	const trimmed = targetUrl?.trim();
	if (!trimmed) return null;
	try {
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const u = new URL(withProtocol);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(u.toString())}`;
	} catch {
		return null;
	}
}

interface PageSpeedPrecisionPanelProps {
	snapshot: PageSpeedSnapshot | null;
	loading: boolean;
	error: string | null;
	/** Current device strategy tab — default desktop (PC). */
	strategy?: PageSpeedStrategy;
	onStrategyChange?: (strategy: PageSpeedStrategy) => void;
	/** Diagnosed site URL for the official PageSpeed Insights deep link. */
	targetUrl?: string;
}

/**
 * Tab 2 — 「웹 성능 & 접근성 · PageSpeed 실측」
 * 1) 4대 핵심 지표 → 2) Core Web Vitals → 3) 리소스 + 해결 가이드
 * 로딩 중 1~3 전체 스켈레톤, 완료 시 일괄 slide-in.
 */
export function PageSpeedPrecisionPanel({
	snapshot,
	loading,
	error,
	strategy = 'desktop',
	onStrategyChange,
	targetUrl,
}: PageSpeedPrecisionPanelProps) {
	const t = useTranslations('audit.pageSpeed');
	const [isResourceOpen, setIsResourceOpen] = useState(false);

	const officialPsiHref = buildOfficialPsiUrl(targetUrl || snapshot?.url || '');

	const resourceIssueCount = snapshot
		? snapshot.renderBlocking.length +
			snapshot.images.length +
			snapshot.fonts.length +
			(snapshot.cacheResources?.length ?? 0) +
			(snapshot.scriptExecution?.length ?? 0) +
			(snapshot.lcpElement &&
			(snapshot.lcpElement.hasLazyLoading || snapshot.lcpElement.missingFetchPriority)
				? 1
				: 0)
		: 0;

	const lcpNeedsWarning =
		snapshot?.lcpElement &&
		(snapshot.lcpElement.hasLazyLoading || snapshot.lcpElement.missingFetchPriority);

	return (
		<section
			id="sec-pagespeed"
			className="scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 sm:p-6"
			aria-labelledby="psi-precision-title"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
						{t('precisionBadge')}
					</p>
					<h3 id="psi-precision-title" className="mt-1 text-base font-extrabold text-white">
						{t('precisionTitle')}
					</h3>
					<p className="mt-1 text-xs text-slate-400">{t('precisionSubtitle')}</p>
				</div>

				{/* PC / Mobile strategy tabs — top-right header */}
				<div
					className="inline-flex shrink-0 self-start rounded-lg border border-white/10 bg-black/25 p-0.5"
					role="tablist"
					aria-label={t('tabAriaLabel')}
				>
					{(
						[
							{ id: 'desktop' as const, label: t('tabDesktop') },
							{ id: 'mobile' as const, label: t('tabMobile') },
						] as const
					).map((tab) => {
						const active = strategy === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => onStrategyChange?.(tab.id)}
								className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 ${
									active
										? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
										: 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
								}`}
							>
								{tab.label}
							</button>
						);
					})}
				</div>
			</div>

			{loading && !snapshot ? <PageSpeedSkeleton /> : null}

			{!loading && error && !snapshot ? (
				<div
					className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
					role="alert"
				>
					<p className="font-semibold">{t('errorTitle')}</p>
					<p className="mt-1 text-xs text-amber-100/80">{error}</p>
					<p className="mt-2 text-[11px] text-slate-400">{t('errorHint')}</p>
				</div>
			) : null}

			{snapshot ? (
				<div key={`${snapshot.url}|${snapshot.fetchedAt}`} className="psi-slide-in flex flex-col gap-6">
					{/* 1단계 — PageSpeed 4대 핵심 지표 */}
					<section aria-labelledby="psi-stage-scores">
						<p id="psi-stage-scores" className="sr-only">
							{t('cardsTitle')}
						</p>
						<PageSpeedScoreCards snapshot={snapshot} />
					</section>

					{/* 2단계 — Core Web Vitals 실측 */}
					<section aria-labelledby="psi-stage-vitals">
						<p
							id="psi-stage-vitals"
							className="text-xs font-bold uppercase tracking-wide text-slate-400"
						>
							{t('vitalsTitle')}
						</p>
						<div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{snapshot.vitals.map((v) => {
								const style = TIER_STYLES[v.tier];
								const label =
									v.id === 'lcp'
										? t('vitals.lcp')
										: v.id === 'fcp'
											? t('vitals.fcp')
											: v.id === 'tbt'
												? t('vitals.tbt')
												: t('vitals.cls');
								const thresholdKey =
									v.id === 'tbt' ? 'tbt' : v.id === 'lcp' ? 'lcp' : v.id === 'fcp' ? 'fcp' : 'cls';
								return (
									<article
										key={v.id}
										className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3`}
									>
										<div className="flex items-center justify-between gap-2">
											<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
												{label}
											</p>
											<span aria-hidden>{style.icon}</span>
										</div>
										<p className={`mt-1 text-2xl font-extrabold tabular-nums ${style.text}`}>
											{vitalDisplay(v)}
										</p>
										<p className={`mt-1 text-[11px] font-semibold ${style.text}`}>
											{t(
												`tiers.${
													v.tier === 'needs-improvement' ? 'needsImprovement' : v.tier
												}`,
											)}
										</p>
										<p className="mt-1 text-[10px] text-slate-500">
											{t(`vitalThreshold.${thresholdKey}`)}
										</p>
									</article>
								);
							})}
						</div>
					</section>

					{/* LCP 크리티컬 경로 경고 카드 */}
					{lcpNeedsWarning && snapshot.lcpElement ? (
						<section
							className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3.5"
							aria-labelledby="psi-lcp-warning"
							role="alert"
						>
							<div className="flex items-start gap-2.5">
								<AlertTriangle
									className="mt-0.5 h-4 w-4 shrink-0 text-rose-300"
									aria-hidden
								/>
								<div className="min-w-0 flex-1">
									<p id="psi-lcp-warning" className="text-sm font-bold text-rose-200">
										{t('resources.lcpWarningTitle')}
									</p>
									<p className="mt-1 font-mono text-xs text-rose-100/90">
										{snapshot.lcpElement.label}
										{snapshot.lcpElement.selector
											? ` · ${snapshot.lcpElement.selector}`
											: ''}
									</p>
									<ul className="mt-2 flex flex-col gap-1.5">
										{snapshot.lcpElement.warnings.map((w, i) => (
											<li key={i} className="text-xs leading-relaxed text-rose-100/85">
												{w}
											</li>
										))}
									</ul>
									{snapshot.lcpElement.snippet ? (
										<pre className="mt-2 max-h-24 overflow-auto rounded-lg border border-rose-500/20 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
											{snapshot.lcpElement.snippet}
										</pre>
									) : null}
								</div>
							</div>
						</section>
					) : null}

					{/* 3단계 — 렌더링 차단 리소스 (기본 접힘) */}
					<section
						className="rounded-xl border border-white/[0.08] bg-black/20"
						aria-labelledby="psi-stage-resources"
					>
						<button
							type="button"
							id="psi-stage-resources"
							aria-expanded={isResourceOpen}
							aria-controls="psi-resources-panel"
							onClick={() => setIsResourceOpen((v) => !v)}
							className="flex w-full cursor-pointer select-none items-center justify-between gap-3 px-3.5 py-3 text-left"
						>
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<span className="text-sm font-bold text-slate-100">
									{t('resourcesStageTitle')}
								</span>
								<span
									className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
										resourceIssueCount > 0
											? 'bg-amber-500/20 text-amber-300'
											: 'bg-emerald-500/15 text-emerald-300'
									}`}
								>
									{resourceIssueCount > 0
										? t('accordion.issuesDetected', { count: resourceIssueCount })
										: t('accordion.noIssues')}
								</span>
							</div>
							<span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200">
								{isResourceOpen ? t('accordion.collapse') : t('accordion.showDetails')}
								{isResourceOpen ? (
									<ChevronUp className="h-3.5 w-3.5" aria-hidden />
								) : (
									<ChevronDown className="h-3.5 w-3.5" aria-hidden />
								)}
							</span>
						</button>

						<div
							id="psi-resources-panel"
							className="psi-accordion"
							data-open={isResourceOpen ? 'true' : 'false'}
							inert={!isResourceOpen ? true : undefined}
						>
							<div className="psi-accordion-inner">
								<div className="flex flex-col gap-3 border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
									<ResourceTable
										title={t('resources.renderBlocking')}
										empty={t('resources.emptyBlocking')}
										headers={[
											t('resources.colFile'),
											t('resources.colSize'),
											t('resources.colWasted'),
											t('resources.colDelay'),
										]}
										rows={snapshot.renderBlocking.map((r) => [
											r.fileName,
											formatBytes(r.bytes),
											formatBytes(r.wastedBytes),
											formatMs(r.wastedMs),
										])}
										urlHints={snapshot.renderBlocking.map((r) => r.url)}
									/>

									<ResourceTable
										title={t('resources.images')}
										empty={t('resources.emptyImages')}
										headers={[
											t('resources.colFile'),
											t('resources.colInsight'),
										]}
										rows={snapshot.images.map((r) => [
											r.label || r.fileName,
											r.insight ||
												`${r.fileName} (${formatKiB(r.bytes)}${
													(r.wastedBytes ?? r.webpSavingsBytes)
														? ` → ${formatKiB(r.wastedBytes ?? r.webpSavingsBytes)} 절감 가능`
														: ''
												})`,
										])}
										urlHints={snapshot.images.map((r) => r.url)}
										wideSecondCol
									/>

									<div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
										<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
											<p className="text-xs font-bold text-slate-200">
												{t('resources.cache')}
											</p>
											{snapshot.cacheTotalWastedBytes != null &&
											snapshot.cacheTotalWastedBytes > 0 ? (
												<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-300">
													{t('resources.cacheTotalSave', {
														size: formatKiB(snapshot.cacheTotalWastedBytes),
													})}
												</span>
											) : null}
										</div>
										{(snapshot.cacheResources?.length ?? 0) === 0 ? (
											<p className="px-3.5 py-3 text-xs text-slate-500">
												{t('resources.emptyCache')}
											</p>
										) : (
											<div className="overflow-x-auto">
												<table className="w-full min-w-[320px] text-left text-xs">
													<thead>
														<tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-slate-500">
															<th className="px-3.5 py-2 font-semibold">
																{t('resources.colFile')}
															</th>
															<th className="px-3.5 py-2 font-semibold">
																{t('resources.colTtl')}
															</th>
															<th className="px-3.5 py-2 font-semibold">
																{t('resources.colSize')}
															</th>
															<th className="px-3.5 py-2 font-semibold">
																{t('resources.colWasted')}
															</th>
														</tr>
													</thead>
													<tbody>
														{(snapshot.cacheResources ?? []).map((r) => (
															<tr
																key={r.url}
																className="border-b border-white/[0.04] last:border-0"
															>
																<td
																	className="max-w-[200px] truncate px-3.5 py-2 font-mono text-slate-300"
																	title={r.url}
																>
																	{r.fileName}
																</td>
																<td
																	className={`px-3.5 py-2 tabular-nums ${
																		!r.cacheLifetimeMs || r.cacheLifetimeMs <= 0
																			? 'font-semibold text-rose-300'
																			: 'text-amber-300'
																	}`}
																>
																	{r.ttlLabel}
																</td>
																<td className="px-3.5 py-2 tabular-nums text-slate-400">
																	{formatKiB(r.totalBytes)}
																</td>
																<td className="px-3.5 py-2 tabular-nums text-slate-400">
																	{formatKiB(r.wastedBytes)}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										)}
									</div>

									<ResourceTable
										title={t('resources.scripts')}
										empty={t('resources.emptyScripts')}
										headers={[
											t('resources.colFile'),
											t('resources.colOrigin'),
											t('resources.colCpu'),
											t('resources.colScripting'),
										]}
										rows={(snapshot.scriptExecution ?? []).map((r) => [
											r.fileName,
											r.origin === 'third-party'
												? t('resources.originThird')
												: r.origin === 'first-party'
													? t('resources.originFirst')
													: t('resources.originUnknown'),
											formatMs(r.totalMs),
											formatMs(r.scriptingMs),
										])}
										urlHints={(snapshot.scriptExecution ?? []).map((r) => r.url)}
									/>

									{(snapshot.mainThreadWork?.length ?? 0) > 0 ? (
										<ResourceTable
											title={t('resources.mainThread')}
											empty={t('resources.emptyMainThread')}
											headers={[
												t('resources.colTask'),
												t('resources.colDuration'),
											]}
											rows={(snapshot.mainThreadWork ?? []).map((r) => [
												r.groupLabel,
												formatMs(r.durationMs),
											])}
										/>
									) : null}

									<ResourceTable
										title={t('resources.fonts')}
										empty={t('resources.emptyFonts')}
										headers={[
											t('resources.colFile'),
											t('resources.colSize'),
											t('resources.colCdnSave'),
										]}
										rows={snapshot.fonts.map((r) => [
											r.fileName,
											formatBytes(r.bytes),
											formatBytes(r.cdnSavingsBytes),
										])}
										urlHints={snapshot.fonts.map((r) => r.url)}
									/>
								</div>
							</div>
						</div>
					</section>

					{/* 4단계 — 문제점별 맞춤형 실전 해결 가이드 (기본 접힘) */}
					<PageSpeedSolutionGuide snapshot={snapshot} />
				</div>
			) : null}

			{/* Official Google PageSpeed Insights deep link — below solution guide */}
			{officialPsiHref ? (
				<div className="flex justify-center pt-1">
					<a
						href={officialPsiHref}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-transparent px-3.5 py-2 text-center text-xs font-medium text-slate-300 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/[0.06] hover:text-emerald-100"
					>
						{t('officialPsiLink')}
					</a>
				</div>
			) : null}
		</section>
	);
}

function ResourceTable({
	title,
	empty,
	headers,
	rows,
	urlHints,
	wideSecondCol,
}: {
	title: string;
	empty: string;
	headers: string[];
	rows: string[][];
	/** Full resource URLs for the file-name column tooltip. */
	urlHints?: string[];
	wideSecondCol?: boolean;
}) {
	return (
		<div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
			<p className="border-b border-white/[0.06] px-3.5 py-2.5 text-xs font-bold text-slate-200">
				{title}
			</p>
			{rows.length === 0 ? (
				<p className="px-3.5 py-3 text-xs text-slate-500">{empty}</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[320px] text-left text-xs">
						<thead>
							<tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-slate-500">
								{headers.map((h) => (
									<th key={h} className="px-3.5 py-2 font-semibold">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, i) => (
								<tr key={i} className="border-b border-white/[0.04] last:border-0">
									{row.map((cell, j) => (
										<td
											key={j}
											className={`px-3.5 py-2 ${
												j === 0
													? 'max-w-[200px] truncate font-mono text-slate-300'
													: wideSecondCol && j === 1
														? 'text-slate-400'
														: 'tabular-nums text-slate-400'
											}`}
											title={j === 0 ? urlHints?.[i] || cell : undefined}
										>
											{cell}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
