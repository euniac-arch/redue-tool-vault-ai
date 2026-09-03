'use client';

import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { CompetitorGapBoard } from '@/components/ai-search-intelligence/competitor-gap/CompetitorGapBoard';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { useAsiAnalysis } from '@/lib/ai-search-intelligence/client/use-asi-analysis';
import { asiFailCopy, loadAsiCompetitorGap } from '@/lib/ai-search-intelligence/client/asi-client';
import type { AsiCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/types';

export function CompetitorGapDashboard() {
	const t = useTranslations('intelligence.gap');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { url, setUrl, error, toast, loading, elapsedTime, snapshot, cancel, onSubmit } =
		useAsiAnalysis<AsiCompetitorGapSnapshot>({
			cacheKey: 'asi_gap_snapshot',
			entryId: 'gap',
			isValid: (data) =>
				Boolean(
					data?.site?.url &&
						data.summary &&
						Array.isArray(data.rows) &&
						Array.isArray(data.metrics) &&
						data.metrics.length === 9 &&
						Array.isArray(data.rankedCompetitors),
				),
			loader: loadAsiCompetitorGap,
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
				inputId="asi-gap-url"
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
				{snapshot?.auditBind ? <AsiScoreCompareStrip bind={snapshot.auditBind} items={[]} /> : null}
				{snapshot ? <CompetitorGapBoard snapshot={snapshot} /> : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast} />
		</main>
	);
}
