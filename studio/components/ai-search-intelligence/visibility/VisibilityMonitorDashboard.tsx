'use client';

import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { VisibilityMonitorBoard } from '@/components/ai-search-intelligence/visibility/VisibilityMonitorBoard';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { useAsiAnalysis } from '@/lib/ai-search-intelligence/client/use-asi-analysis';
import { asiFailCopy, loadAsiVisibility } from '@/lib/ai-search-intelligence/client/asi-client';
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import type { AsiVisibilityMonitorSnapshot } from '@/lib/ai-search-intelligence/types';

export function VisibilityMonitorDashboard() {
	const t = useTranslations('intelligence.monitor');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { url, setUrl, error, toast, loading, elapsedTime, snapshot, analyze, cancel, onSubmit } =
		useAsiAnalysis<AsiVisibilityMonitorSnapshot>({
			cacheKey: 'asi_visibility_snapshot',
			isValid: (data) =>
				Boolean(data?.site?.url && data.trends && Array.isArray(data.alerts) && data.persistVersion === 'v2'),
			loader: loadAsiVisibility,
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
				inputId="asi-visibility-url"
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
				{snapshot?.auditBind ? (
					<AsiScoreCompareStrip
						bind={snapshot.auditBind}
						items={[{ id: 'visibility', value: snapshot.latest?.visibility ?? 0 }]}
					/>
				) : null}
				{snapshot ? (
					<VisibilityMonitorBoard
						snapshot={snapshot}
						onEnroll={(cadence) => void analyze(url, { cadence } satisfies Pick<AsiRunInput, 'cadence'>)}
					/>
				) : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast} />
		</main>
	);
}
