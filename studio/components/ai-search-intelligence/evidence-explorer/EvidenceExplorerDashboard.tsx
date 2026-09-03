'use client';

import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { EvidenceExplorerBoard } from '@/components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { useAsiAnalysis } from '@/lib/ai-search-intelligence/client/use-asi-analysis';
import { asiFailCopy, loadAsiExplorer } from '@/lib/ai-search-intelligence/client/asi-client';
import type { AsiEvidenceExplorerSnapshot } from '@/lib/ai-search-intelligence/types';

export function EvidenceExplorerDashboard() {
	const t = useTranslations('intelligence.explorer');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { url, setUrl, error, toast, loading, elapsedTime, snapshot, cancel, onSubmit } =
		useAsiAnalysis<AsiEvidenceExplorerSnapshot>({
			cacheKey: 'asi_explorer_snapshot',
			isValid: (data) => Boolean(data?.site?.url && data.summary && Array.isArray(data.answers)),
			loader: loadAsiExplorer,
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
				inputId="asi-explorer-url"
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
				{snapshot ? <EvidenceExplorerBoard snapshot={snapshot} /> : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast} />
		</main>
	);
}
