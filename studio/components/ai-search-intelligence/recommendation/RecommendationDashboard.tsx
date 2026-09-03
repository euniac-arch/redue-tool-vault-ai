'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { RecommendCompetitorsPanel } from '@/components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel';
import { RecommendSimulatorPanel } from '@/components/ai-search-intelligence/recommendation/RecommendSimulatorPanel';
import { RecommendSovPanel } from '@/components/ai-search-intelligence/recommendation/RecommendSovPanel';
import { RecommendTestPanel } from '@/components/ai-search-intelligence/recommendation/RecommendTestPanel';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiRecommendation, loadAsiShareOfVoice, loadAsiSimulator } from '@/lib/ai-search-intelligence/client/asi-client';
import { inputFromCurrentSite } from '@/lib/ai-search-intelligence/client/current-site-input';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { asiSitesMatch, normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import type { AsiRecommendationSnapshot } from '@/lib/ai-search-intelligence/types';
import type { AsiToolId } from '@/lib/ai-search-intelligence/routes';

const CACHE_KEY = 'asi_recommendation_snapshot';

function readCached(): AsiRecommendationSnapshot | null {
	return readAsiSessionSnapshot<AsiRecommendationSnapshot>(
		CACHE_KEY,
		(data) => Boolean(data?.site?.url && data.testResults),
	);
}

function writeCached(snapshot: AsiRecommendationSnapshot) {
	writeAsiSessionSnapshot(CACHE_KEY, snapshot);
}

export function RecommendationDashboard({
	tool,
}: {
	tool: Extract<AsiToolId, 'test' | 'simulator' | 'sov' | 'competitors'>;
}) {
	const t = useTranslations('intelligence.recommendation');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { targetUrl, currentSite, requireTargetUrl, analysisEpoch, reportModuleStatus } = useIntelligence();
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [snapshot, setSnapshot] = useState<AsiRecommendationSnapshot | null>(null);
	const { nextSignal, cancel, isLive } = useAsiAbort();

	useEffect(() => {
		if (targetUrl) setUrl(targetUrl);
	}, [targetUrl]);

	function loadSnapshot(input: { query?: string; refresh?: boolean }, signal: AbortSignal) {
		if (!currentSite) return Promise.resolve({ snapshot: null, error: 'invalid_url' as const });
		const payload = { ...inputFromCurrentSite(currentSite), query: input.query, refresh: input.refresh };
		if (tool === 'sov') return loadAsiShareOfVoice(payload, signal);
		if (tool === 'simulator') return loadAsiSimulator(payload, signal);
		return loadAsiRecommendation(payload, signal);
	}

	async function analyze(_nextUrl?: string, query?: string, refresh = false) {
		if (!currentSite) {
			setError(t('urlInvalid'));
			requireTargetUrl();
			return;
		}
		setError(null);
		setLoading(true);
		reportModuleStatus(tool, { isLoading: true, error: null });
		const signal = nextSignal();
		const result = await loadSnapshot({ query, refresh }, signal);
		if (!isLive(signal)) return;
		if (result.snapshot) {
			setSnapshot(result.snapshot);
			writeCached(result.snapshot);
			setUrl(result.snapshot.site.url);
			reportModuleStatus(tool, {
				isLoading: false,
				data: result.snapshot,
				error: null,
				lastAnalyzedUrl: result.snapshot.site.url,
			});
		} else if (!isAsiCancelled(result.error)) {
			const message = asiLoadMessage(result.error, failCopy);
			setError(message);
			reportModuleStatus(tool, { isLoading: false, error: message });
		} else {
			reportModuleStatus(tool, { isLoading: false });
		}
		setLoading(false);
	}

	useEffect(() => {
		const incomingQ = new URLSearchParams(window.location.search).get('q')?.trim() || '';
		const cached = readCached();
		const current = currentSite?.siteUrl || normalizeAsiSiteUrl(targetUrl);
		const cacheReady = Boolean(
			cached &&
				current &&
				asiSitesMatch(cached.site.url, current) &&
				!asiCacheShouldRebuild(cached) &&
				(tool !== 'sov' || cached.sov.computedFrom === 'live'),
		);
		if (incomingQ && currentSite && analysisEpoch === 0) {
			void analyze(currentSite.siteUrl, incomingQ);
			return;
		}
		if (cacheReady && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
			reportModuleStatus(tool, {
				isLoading: false,
				data: cached,
				error: null,
				lastAnalyzedUrl: cached.site.url,
			});
			return;
		}
		setSnapshot(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [analysisEpoch, currentSite?.siteUrl, targetUrl, tool]);

	// React to the shared top control bar's explicit [AI 인텔리전스 분석] click even
	// when this dashboard is already mounted (a fresh mount already self-seeds above).
	const analyzeRef = useRef(analyze);
	analyzeRef.current = analyze;
	useEffect(() => onAsiAnalyzeRequest((nextUrl) => void analyzeRef.current(nextUrl)), []);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const resolved = requireTargetUrl();
		if (!resolved) return;
		void analyze(resolved);
	}

	return (
		<main>
			<AsiPageChrome
				kicker={t('kicker')}
				title={t(`title.${tool}`)}
				subtitle={t(`subtitle.${tool}`)}
				source={snapshot?.source}
				inputId="asi-recommendation-url"
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
						items={[{ id: 'recommendation', value: snapshot.simulator.potential }]}
					/>
				) : null}
				{snapshot && tool === 'test' ? (
					<RecommendTestPanel
						snapshot={snapshot}
						busy={loading}
						onRunQuery={(query) => void analyze(snapshot.site.url, query)}
					/>
				) : snapshot && tool === 'simulator' ? (
					<RecommendSimulatorPanel
						snapshot={snapshot}
						busy={loading}
						onRunQuery={(nextQuery) => void analyze(snapshot.site.url, nextQuery, true)}
					/>
				) : snapshot && tool === 'sov' ? (
					<RecommendSovPanel snapshot={snapshot} />
				) : snapshot ? (
					<RecommendCompetitorsPanel snapshot={snapshot} />
				) : null}
			</AsiPageChrome>
		</main>
	);
}
