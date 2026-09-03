'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { AsiLockPanel } from '@/components/ai-search-intelligence/entitlement/AsiLockPanel';
import { WarRoomLoopPanel } from '@/components/ai-search-intelligence/war-room/WarRoomLoopPanel';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCompetitorFoundLead, AsiObservationEmpty } from '@/components/ai-search-intelligence/primitives/AsiObservationEmpty';
import { ASI_COMPETITOR_MIN_SAMPLE, resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiRevealList, AsiRevealItem } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { AsiMetricHeading, AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import type { AsiMetricId } from '@/lib/ai-search-intelligence/provenance';
import {
	ASI_INTENSITY_TONE,
	ASI_TD_NAME,
	ASI_TD_NUM,
	AsiDataTable,
} from '@/components/ai-search-intelligence/primitives/AsiDataTable';
import { ASI_BADGE, ASI_CARD, ASI_CTA, ASI_KPI, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiBoundUrl,
	readAsiSessionSnapshot,
	WAR_ROOM_CACHE_KEY,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiWarRoom } from '@/lib/ai-search-intelligence/client/asi-client';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import type {
	AsiEngineId,
	AsiMentionType,
	AsiStatusTone,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

const KPI_ITEMS = [
	{ key: 'visibility', href: '/intelligence/visibility-monitor', metric: 'visibilityScore' },
	{ key: 'recommendationRate', href: '/intelligence/recommendation-test', metric: 'recommendationRate' },
	{ key: 'shareOfVoice', href: '/intelligence/share-of-voice', metric: 'shareOfVoice' },
	{ key: 'trustScore', href: '/intelligence/reputation-radar', metric: 'trustScore' },
	{ key: 'agentReadiness', href: '/intelligence/agent-readiness', metric: 'agentReadiness' },
] as const satisfies ReadonlyArray<{ key: keyof AsiWarRoomSnapshot['kpis']; href: string; metric: AsiMetricId }>;

const STATUS_ORDER: AsiStatusTone[] = ['rising', 'falling', 'caution'];

const STATUS_TONE: Record<AsiStatusTone, string> = {
	rising: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	falling: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
	caution: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
};

const DOT_TONE: Record<AsiStatusTone, string> = {
	rising: 'bg-emerald-500',
	falling: 'bg-rose-500',
	caution: 'bg-amber-500',
};

const OWNERSHIP_TONE: Record<AsiWarRoomSnapshot['citations'][number]['ownership'], string> = {
	owned: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200',
	brand_earned:
		'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	unbranded_third_party:
		'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
};

function readCachedSnapshot(): AsiWarRoomSnapshot | null {
	return readAsiSessionSnapshot<AsiWarRoomSnapshot>(WAR_ROOM_CACHE_KEY, (data) => Boolean(data?.site?.url));
}

function writeCachedSnapshot(snapshot: AsiWarRoomSnapshot) {
	writeAsiSessionSnapshot(WAR_ROOM_CACHE_KEY, snapshot);
}

function mentionBar(value: number): string {
	if (value >= 72) return 'bg-emerald-500';
	if (value >= 48) return 'bg-cyan-500';
	return 'bg-slate-400 dark:bg-slate-500';
}

export function WarRoomDashboard() {
	const t = useTranslations('intelligence.warRoom');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [snapshot, setSnapshot] = useState<AsiWarRoomSnapshot | null>(null);
	const { nextSignal, cancel, isLive } = useAsiAbort();
	const { actor, ready } = useAsiActor();
	const canWar = canAccessFeature(actor, 'war-room');

	// A mount may ONLY ever restore an already-computed result (zero network
	// calls) — it must NEVER call `loadAsiWarRoom()` on its own. Every fetch
	// requires the user to press this page's Analyze button or the shared top
	// bar's [AI 인텔리전스 분석] button; there is no other path to a network call.
	useEffect(() => {
		const cached = readCachedSnapshot();
		if (cached && !asiCacheShouldRebuild(cached)) {
			setSnapshot(cached);
			setUrl(cached.site.url);
		}
	}, []);

	async function analyze(nextUrl: string) {
		const normalized = normalizeAsiSiteUrl(nextUrl);
		if (!normalized) {
			setError(t('urlInvalid'));
			return;
		}
		setError(null);
		setLoading(true);
		const signal = nextSignal();
		const result = await loadAsiWarRoom({ url: normalized, audit: loadLatestAuditPayload() }, signal);
		if (!isLive(signal)) return;
		if (result.snapshot) {
			setSnapshot(result.snapshot);
			writeCachedSnapshot(result.snapshot);
			setUrl(result.snapshot.site.url);
		} else if (!isAsiCancelled(result.error)) {
			setError(asiLoadMessage(result.error, failCopy));
		}
		setLoading(false);
	}

	// React to the shared top control bar's explicit [AI 인텔리전스 분석] click even
	// when this dashboard is already mounted (a fresh mount already self-seeds above).
	const analyzeRef = useRef(analyze);
	analyzeRef.current = analyze;
	const canWarRef = useRef(canWar);
	canWarRef.current = canWar;
	useEffect(
		() => onAsiAnalyzeRequest((nextUrl) => canWarRef.current && void analyzeRef.current(nextUrl)),
		[],
	);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void analyze(url);
	}

	const bound = snapshot?.site.url || url || readAsiBoundUrl() || '';

	return (
		<main>
			{canWar ? (
				<AsiPageChrome
					kicker={t('kicker')}
					title={t('title')}
					subtitle={t('subtitle')}
					source={snapshot?.source}
					inputId="asi-war-room-url"
					url={url}
					onUrlChange={setUrl}
					onSubmit={onSubmit}
					urlLabel={t('urlLabel')}
					urlPlaceholder={t('urlPlaceholder')}
					submitLabel={t('analyze')}
					submittingLabel={t('analyzing')}
					loading={loading}
					onCancel={cancel}
					cancelLabel={tUx('cancel')}
					error={error}
					boundNote={snapshot?.boundFromAudit ? t('boundFromAudit') : null}
					emptyTitle={t('emptyTitle')}
					emptyBody={t('emptyBody')}
					hasResult
				>
					<WarRoomLoopPanel snapshot={snapshot} siteUrl={bound} />
					{snapshot ? <WarRoomBoard snapshot={snapshot} /> : null}
				</AsiPageChrome>
			) : (
				<div className="flex flex-col gap-6">
					<section>
						<p className={ASI_SECTION_KICKER}>{t('kicker')}</p>
						<h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{t('title')}</h2>
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t('subtitle')}</p>
					</section>
					<WarRoomLoopPanel snapshot={snapshot} siteUrl={bound} />
					{ready ? <AsiLockPanel feature="war-room" tier={actor.tier} /> : null}
				</div>
			)}
		</main>
	);
}

function WarRoomBoard({ snapshot }: { snapshot: AsiWarRoomSnapshot }) {
	const t = useTranslations('intelligence.warRoom');
	const kpis = snapshot.kpis;

	return (
		<div className="flex flex-col gap-6">
			{snapshot.auditBind ? (
				<AsiScoreCompareStrip
					bind={snapshot.auditBind}
					items={[
						{ id: 'visibility', value: kpis.visibility },
						{ id: 'recommendation', value: kpis.recommendationRate },
						{ id: 'trust', value: kpis.trustScore },
					]}
				/>
			) : null}
			<AsiRevealList aria-label={t('kpiAria')} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<AsiRevealItem className={`col-span-2 lg:col-span-1 ${ASI_KPI}`}>
					<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('brandLabel')}</p>
					<p className="mt-2 truncate text-base font-bold text-slate-900 dark:text-white">{snapshot.site.brandName}</p>
					<p className="mt-1 truncate text-xs text-slate-500">{snapshot.site.domain}</p>
				</AsiRevealItem>
				{KPI_ITEMS.map((item) => (
					<AsiRevealItem key={item.key}>
					<Link
						href={item.href}
						className={`block h-full ${ASI_KPI} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40`}
					>
						<AsiScore value={kpis[item.key]} label={t(`kpi.${item.key}`)} metric={item.metric} size="sm" />
					</Link>
					</AsiRevealItem>
				))}
			</AsiRevealList>

			<AsiCard kicker={t('visibilityKicker')} title={t('visibilityTitle')} href="/intelligence/brand-perception" actionLabel={t('more')} provenance="derived" badge="derived_score" metric="visibilityScore">
				<div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-center">
					<AsiScore
						value={snapshot.visibility.overall}
						label={t('visibilityOverall')}
						hint={t('visibilityHint')}
						metric="visibilityScore"
						showGrade
						size="lg"
					/>
					<ul className="grid gap-3 sm:grid-cols-2">
						{snapshot.visibility.engines.map((engine) => (
							<EngineScoreRow key={engine.engine} engine={engine.engine} score={engine.score} mention={engine.mentionType} />
						))}
					</ul>
				</div>
			</AsiCard>

			<section className="grid gap-3 sm:grid-cols-3">
				{STATUS_ORDER.map((tone) => (
					<AsiCard key={tone} kicker={t('todayKicker')} title={t(`status.${tone}`)} provenance="derived">
						<span className={`mb-3 ${ASI_BADGE} gap-1.5 ${STATUS_TONE[tone]}`}>
							<span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[tone]}`} aria-hidden />
							{t(`status.${tone}`)}
						</span>
						<ul className="flex flex-col gap-2">
							{snapshot.today[tone].map((item) => (
								<li key={item} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
									{item}
								</li>
							))}
						</ul>
					</AsiCard>
				))}
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				<AsiCard kicker={t('blockersKicker')} title={t('blockersTitle')} href="/intelligence/recommendation-test" actionLabel={t('more')} provenance="derived">
					<ol className="flex flex-col gap-3">
						{snapshot.blockers.map((item, index) => (
							<li key={item.id}>
								<Link
									href={item.href}
									className={asiFocusRing(
										'block rounded-xl border border-transparent px-1 py-1 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50',
									)}
								>
									<p className="text-sm font-bold text-slate-900 dark:text-white">
										<span className="mr-2 tabular-nums text-cyan-600 dark:text-cyan-400">{index + 1}</span>
										{item.title}
									</p>
									<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</p>
								</Link>
							</li>
						))}
					</ol>
				</AsiCard>

				<AsiCard kicker={t('opportunityKicker')} title={t('opportunityTitle')} href="/intelligence/query-generator" actionLabel={t('more')} provenance="derived" badge="estimated" metric="opportunityScore">
					<ul className="flex flex-col gap-3">
						{snapshot.opportunities.map((item) => (
							<li key={item.id}>
								<Link
									href={item.href}
									className={asiFocusRing(
										'block rounded-xl border border-slate-200 px-4 py-3 hover:border-cyan-300 dark:border-slate-800 dark:hover:border-cyan-700',
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
										<span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
											{t('impact', { value: item.impact })}
											<AsiMetricTooltip metric="opportunityScore" label={t('impact', { value: item.impact })} />
											<AsiProvenanceBadge badge="estimated" />
										</span>
									</div>
									<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</p>
								</Link>
							</li>
						))}
					</ul>
				</AsiCard>
			</div>

			<AsiCard kicker={t('competitorsKicker')} title={t('competitorsTitle')} href="/intelligence/competitor-analysis" actionLabel={t('more')} provenance="derived" badge="estimated">
				{(() => {
					const observationState =
						snapshot.observationState ??
						resolveAsiObservationState({
							analyzed: snapshot.source === 'live' || (snapshot.validResponseCount ?? 0) > 0,
							validResponseCount: snapshot.validResponseCount ?? 0,
							competitorCount: snapshot.competitors.length,
						});
					const coverage = {
						queryCount: snapshot.queryCount ?? snapshot.queries.length,
						validResponseCount: snapshot.validResponseCount ?? 0,
						minSample: ASI_COMPETITOR_MIN_SAMPLE,
					};
					if (observationState !== 'COMPETITORS_FOUND') {
						return <AsiObservationEmpty state={observationState} coverage={coverage} />;
					}
					return (
						<div className="flex flex-col gap-4">
							<AsiCompetitorFoundLead names={snapshot.competitors.map((row) => row.name)} />
							<AsiDataTable
								minWidthClass="min-w-[28rem]"
								rows={snapshot.competitors}
								rowKey={(row) => row.name}
								columns={[
									{ key: 'name', header: t('competitorName'), cell: (row) => row.name, cellClassName: ASI_TD_NAME },
									{
										key: 'coRecommend',
										header: <AsiMetricHeading label={t('coRecommend')} metric="coRecommend" />,
										cell: (row) => row.coRecommend,
										cellClassName: ASI_TD_NUM,
									},
									{
										key: 'intensity',
										header: <AsiMetricHeading label={t('intensity')} metric="competitorIntensity" />,
										cell: (row) => t(`intensityValue.${row.intensity}`),
										cellClassName: (row) => `py-2.5 font-semibold ${ASI_INTENSITY_TONE[row.intensity]}`,
									},
									{
										key: 'share',
										header: t('share'),
										cell: (row) => `${row.sharePercent}%`,
										cellClassName: ASI_TD_NUM,
									},
								]}
							/>
						</div>
					);
				})()}
			</AsiCard>

			<div className="grid gap-4 lg:grid-cols-2">
				<AsiCard kicker={t('queryKicker')} title={t('queryTitle')} href="/intelligence/query-generator" actionLabel={t('more')} provenance="observed" badge="observed" metric="actualRank">
					<ul className="flex flex-col gap-2">
						{snapshot.queries.map((item) => (
							<li
								key={item.query}
								className="flex flex-col gap-1 rounded-xl border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
							>
								<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.query}</p>
								<p className="text-xs text-slate-500">
									<span className={item.recommended ? 'font-bold text-emerald-600 dark:text-emerald-300' : 'font-bold text-rose-600 dark:text-rose-300'}>
										{item.recommended ? t('recommended') : t('notRecommended')}
									</span>
									<span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
									{t('winner', { name: item.winner })}
								</p>
							</li>
						))}
					</ul>
				</AsiCard>

				<AsiCard kicker={t('citationKicker')} title={t('citationTitle')} href="/intelligence/citation-explorer" actionLabel={t('more')} provenance="observed" badge="observed" metric="actualCitation">
					<ul className="flex flex-col gap-2">
						{snapshot.citations.map((item) => (
							<li key={item.url} className="flex flex-col gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
								<a
									href={item.url}
									target="_blank"
									rel="noreferrer"
									className={asiFocusRing(
										'text-sm font-semibold text-slate-800 hover:text-cyan-700 dark:text-slate-100 dark:hover:text-cyan-300',
									)}
								>
									{item.title}
								</a>
								<span className={`w-fit ${ASI_BADGE} ${OWNERSHIP_TONE[item.ownership]}`}>
									{t(`ownership.${item.ownership}`)}
								</span>
							</li>
						))}
					</ul>
				</AsiCard>
			</div>

			<section className={`${ASI_CARD} border-cyan-200 bg-cyan-50 px-5 py-6 dark:border-cyan-800 dark:bg-cyan-950/20`}>
				<p className={ASI_SECTION_KICKER}>{t('ctaKicker')}</p>
				<h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{t('ctaTitle')}</h2>
				<p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">{t('ctaBody')}</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<Link href="/intelligence/opportunity-finder" className={ASI_CTA}>
						{t('ctaLoop')}
					</Link>
					<Link href="/intelligence/recommendation-test" className={ASI_CTA}>
						{t('ctaButton')}
					</Link>
				</div>
			</section>
		</div>
	);
}

function EngineScoreRow({
	engine,
	score,
	mention,
}: {
	engine: AsiEngineId;
	score: number;
	mention: AsiMentionType;
}) {
	const t = useTranslations('intelligence.warRoom');
	const Glyph = ENGINE_GLYPH[engine];
	const width = `${Math.max(8, Math.min(100, score))}%`;

	return (
		<li className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
						<Glyph className="h-3.5 w-3.5" />
					</span>
					<p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t(`engine.${engine}`)}</p>
				</div>
				<div className="flex items-center gap-1.5">
					<p className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{score}</p>
					<AsiMetricTooltip metric="engineVisibility" label={t(`engine.${engine}`)} />
					<AsiProvenanceBadge badge="derived_score" />
				</div>
			</div>
			<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
				<div className={`h-full rounded-full ${mentionBar(score)}`} style={{ width }} />
			</div>
			<p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
				<span>{t(`mention.${mention}`)}</span>
				<AsiProvenanceBadge badge="observed" />
			</p>
		</li>
	);
}
