'use client';

import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { AgentReadinessPanel } from '@/components/ai-search-intelligence/future/AgentReadinessPanel';
import { AgentReadinessRing } from '@/components/ai-search-intelligence/future/AgentReadinessRing';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { ASI_CARD, ASI_KICKER } from '@/lib/ui/asi-chrome';
import { useAsiCountUp } from '@/lib/ui/asi-motion';
import { useAsiAnalysis } from '@/lib/ai-search-intelligence/client/use-asi-analysis';
import { asiFailCopy, loadAsiAgentReadiness } from '@/lib/ai-search-intelligence/client/asi-client';
import type { AsiAgentReadinessSnapshot, AsiReadinessStatus } from '@/lib/ai-search-intelligence/types';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';

const COUNT_KEYS: AsiReadinessStatus[] = ['ready', 'partial', 'gap'];

export function AgentReadinessDashboard() {
	const t = useTranslations('intelligence.future');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { url, setUrl, error, toast, loading, elapsedTime, snapshot, cancel, onSubmit } =
		useAsiAnalysis<AsiAgentReadinessSnapshot>({
			cacheKey: 'asi_agent_readiness_snapshot',
			isValid: (data) => Boolean(data?.site?.url && typeof data.overall === 'number' && Array.isArray(data.items)),
			loader: loadAsiAgentReadiness,
			invalidUrlMessage: t('urlInvalid'),
			failCopy,
		});

	return (
		<main>
			<AsiPageChrome
				kicker={t('kicker')}
				title={t('title')}
				subtitle={t('subtitle')}
				source={snapshot?.source}
				inputId="asi-future-url"
				url={url}
				onUrlChange={setUrl}
				onSubmit={onSubmit}
				urlLabel={t('urlLabel')}
				urlPlaceholder={t('urlPlaceholder')}
				submitLabel={t('analyze')}
				submittingLabel={t('analyzing')}
				loading={loading}
				elapsedSeconds={elapsedTime}
				onCancel={cancel}
				cancelLabel={tUx('cancel')}
				error={error}
				boundNote={snapshot?.boundFromAudit ? t('boundFromAudit') : null}
				emptyTitle={t('emptyTitle')}
				emptyBody={t('emptyBody')}
				hasResult={Boolean(snapshot)}
			>
				{snapshot ? (
				<>
					{snapshot.auditBind ? (
						<AsiScoreCompareStrip
							bind={snapshot.auditBind}
							items={[{ id: 'readiness', value: snapshot.overall }]}
						/>
					) : null}
					<ReadinessOverview snapshot={snapshot} />

					<AsiCard kicker={t('listKicker')} title={t('listTitle')} meta={t('listMeta')} provenance="derived" badge="derived_score" metric="readinessItem">
						<AgentReadinessPanel snapshot={snapshot} />
					</AsiCard>
				</>
				) : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast} />
		</main>
	);
}

function ReadinessOverview({ snapshot }: { snapshot: AsiAgentReadinessSnapshot }) {
	const t = useTranslations('intelligence.future');
	const overallShown = useAsiCountUp(snapshot.overall);

	return (
		<section className={`${ASI_CARD} overflow-hidden p-5 sm:p-6`}>
			<div className="flex flex-col gap-6 lg:flex-row lg:items-center">
				<div className="flex min-w-0 items-center gap-4 sm:gap-5">
					<AgentReadinessRing value={snapshot.overall} />
					<div className="min-w-0">
						<p className={ASI_KICKER}>{t('overallKicker')}</p>
						<h2 className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
							{t('overallTitle')}
							<AsiMetricTooltip metric="agentReadiness" label={t('overallTitle')} />
							<AsiProvenanceBadge badge="derived_score" />
						</h2>
						<p className="mt-2 flex flex-wrap items-end gap-2">
							<span className="text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">
								{overallShown}
							</span>
							<span className="pb-1 text-sm font-bold text-slate-400">/ 100</span>
							<ScoreGradeBadge score={snapshot.overall} size="sm" showQualifier={false} />
						</p>
						<p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
							{snapshot.site.brandName} · {snapshot.site.domain}
						</p>
					</div>
				</div>
				<div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
					{COUNT_KEYS.map((key) => (
						<div
							key={key}
							className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 dark:border-slate-700 dark:bg-slate-800/60 sm:px-3"
						>
							<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t(`status.${key}`)}</p>
							<p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 dark:text-white sm:text-2xl">
								{snapshot.statusCounts[key]}
							</p>
							<p className="text-[11px] font-semibold text-slate-500">{t('itemCount')}</p>
						</div>
					))}
				</div>
			</div>
			<p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
				{t('disclaimer')}
			</p>
		</section>
	);
}
