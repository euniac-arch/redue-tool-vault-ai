'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import { RecommendCompetitorsPanel } from '@/components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel';
import { RecommendSimulatorPanel } from '@/components/ai-search-intelligence/recommendation/RecommendSimulatorPanel';
import { RecommendSovPanel } from '@/components/ai-search-intelligence/recommendation/RecommendSovPanel';
import { RecommendTestPanel } from '@/components/ai-search-intelligence/recommendation/RecommendTestPanel';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	seedAsiSiteUrl,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiRecommendation, loadAsiShareOfVoice, loadAsiSimulator } from '@/lib/ai-search-intelligence/client/asi-client';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
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
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [snapshot, setSnapshot] = useState<AsiRecommendationSnapshot | null>(null);
	const { nextSignal, cancel, isLive } = useAsiAbort();

	function loadSnapshot(input: { url: string; query?: string; refresh?: boolean }, signal: AbortSignal) {
		const payload = { ...input, audit: loadLatestAuditPayload() };
		if (tool === 'sov') return loadAsiShareOfVoice(payload, signal);
		if (tool === 'simulator') return loadAsiSimulator(payload, signal);
		return loadAsiRecommendation(payload, signal);
	}

	async function analyze(nextUrl: string, query?: string, refresh = false) {
		const normalized = normalizeAsiSiteUrl(nextUrl);
		if (!normalized) {
			setError(t('urlInvalid'));
			return;
		}
		setError(null);
		setLoading(true);
		const signal = nextSignal();
		const result = await loadSnapshot({ url: normalized, query, refresh }, signal);
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

	// A mount may ONLY ever restore an already-computed result (zero network
	// calls) — it must NEVER call `loadSnapshot()` on its own just because a URL
	// happens to be bound. Every fetch requires the user to press this page's
	// Analyze button or the shared top bar's button — except the `?q=` handoff,
	// which is itself an explicit action (a link click on another ASI page).
	useEffect(() => {
		const incomingQ = new URLSearchParams(window.location.search).get('q')?.trim() || '';
		const cached = readCached();
		const seedUrl = seedAsiSiteUrl(cached?.site.url);
		const cacheReady =
			cached &&
			(!seedUrl || cached.site.url === normalizeAsiSiteUrl(seedUrl)) &&
			!asiCacheShouldRebuild(cached) &&
			(tool !== 'sov' || cached.sov.computedFrom === 'live');
		if (incomingQ && seedUrl) {
			void analyze(seedUrl, incomingQ);
			return;
		}
		if (cacheReady && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
		}
		// First-paint only: hand off `q` from Evidence → recommendation test.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
