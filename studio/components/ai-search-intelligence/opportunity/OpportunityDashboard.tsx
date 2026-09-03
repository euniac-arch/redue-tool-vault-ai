'use client';

import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { OpportunityBoard } from '@/components/ai-search-intelligence/opportunity/OpportunityBoard';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { useAsiAnalysis } from '@/lib/ai-search-intelligence/client/use-asi-analysis';
import { asiFailCopy, loadAsiOpportunity } from '@/lib/ai-search-intelligence/client/asi-client';
import type { AsiOpportunitySnapshot } from '@/lib/ai-search-intelligence/types';

export function OpportunityDashboard() {
	const t = useTranslations('intelligence.opportunity');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { url, setUrl, error, toast, loading, elapsedTime, snapshot, cancel, onSubmit } =
		useAsiAnalysis<AsiOpportunitySnapshot>({
			cacheKey: 'asi_opportunity_snapshot',
			isValid: (data) => Boolean(data?.site?.url && data.summary && Array.isArray(data.rows)),
			loader: loadAsiOpportunity,
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
				inputId="asi-opportunity-url"
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
				{snapshot ? <OpportunityBoard snapshot={snapshot} /> : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast} />
		</main>
	);
}
