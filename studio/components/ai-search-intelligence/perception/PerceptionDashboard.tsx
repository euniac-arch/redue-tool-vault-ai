'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { BrandPerceptionPanel } from '@/components/ai-search-intelligence/perception/BrandPerceptionPanel';
import { BrandSnapshotPanel } from '@/components/ai-search-intelligence/perception/BrandSnapshotPanel';
import { ReputationRadarPanel } from '@/components/ai-search-intelligence/perception/ReputationRadarPanel';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	seedAsiSiteUrl,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiPerception } from '@/lib/ai-search-intelligence/client/asi-client';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type { AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';
import type { AsiToolId } from '@/lib/ai-search-intelligence/routes';

const PERCEPTION_CACHE_KEY = 'asi_perception_snapshot';

function readCached(): AsiPerceptionSnapshot | null {
	return readAsiSessionSnapshot<AsiPerceptionSnapshot>(
		PERCEPTION_CACHE_KEY,
		(data) => Boolean(data?.site?.url && data.axes),
	);
}

function writeCached(snapshot: AsiPerceptionSnapshot) {
	writeAsiSessionSnapshot(PERCEPTION_CACHE_KEY, snapshot);
}

export function PerceptionDashboard({ tool }: { tool: Extract<AsiToolId, 'brand' | 'reputation' | 'snapshot'> }) {
	const t = useTranslations('intelligence.perception');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [snapshot, setSnapshot] = useState<AsiPerceptionSnapshot | null>(null);
	const { nextSignal, cancel, isLive } = useAsiAbort();

	// A mount may ONLY ever restore an already-computed result (zero network
	// calls) — it must NEVER call `loadAsiPerception()` on its own. Every fetch
	// requires the user to press this page's Analyze button or the shared top
	// bar's [AI 인텔리전스 분석] button; there is no other path to a network call.
	useEffect(() => {
		const cached = readCached();
		const seedUrl = seedAsiSiteUrl(cached?.site.url);
		if (cached && (!seedUrl || cached.site.url === normalizeAsiSiteUrl(seedUrl)) && !asiCacheShouldRebuild(cached)) {
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
		const result = await loadAsiPerception({ url: normalized, audit: loadLatestAuditPayload() }, signal);
		if (!isLive(signal)) return;
		if (result.snapshot) {
			setSnapshot(result.snapshot);
			writeCached(result.snapshot);
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
	useEffect(() => onAsiAnalyzeRequest((nextUrl) => void analyzeRef.current(nextUrl)), []);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void analyze(url);
	}

	return (
		<main>
			<AsiPageChrome
				kicker={t('kicker')}
				title={t(`title.${tool}`)}
				subtitle={t(`subtitle.${tool}`)}
				source={snapshot?.source}
				inputId="asi-perception-url"
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
				hasResult={Boolean(snapshot)}
			>
				{snapshot?.auditBind ? (
					<AsiScoreCompareStrip
						bind={snapshot.auditBind}
						items={[
							{ id: 'trust', value: snapshot.trustScore },
							{ id: 'recommendation', value: snapshot.axes.recommendation },
						]}
					/>
				) : null}
				{snapshot && tool === 'brand' ? (
					<BrandPerceptionPanel snapshot={snapshot} />
				) : snapshot && tool === 'reputation' ? (
					<ReputationRadarPanel snapshot={snapshot} />
				) : snapshot ? (
					<BrandSnapshotPanel snapshot={snapshot} />
				) : null}
			</AsiPageChrome>
		</main>
	);
}
