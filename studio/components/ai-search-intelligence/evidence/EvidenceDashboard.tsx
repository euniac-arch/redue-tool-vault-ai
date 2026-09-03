'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { AsiClipBanner } from '@/components/ai-search-intelligence/entitlement/AsiClipBanner';
import { CitationExplorerPanel } from '@/components/ai-search-intelligence/evidence/CitationExplorerPanel';
import { QuestionGeneratorPanel } from '@/components/ai-search-intelligence/evidence/QuestionGeneratorPanel';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiEvidence, loadAsiQueryGenerator, loadAsiQueryProbe } from '@/lib/ai-search-intelligence/client/asi-client';
import { inputFromCurrentSite } from '@/lib/ai-search-intelligence/client/current-site-input';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { asiSitesMatch, normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import type { AsiEvidenceSnapshot, AsiQuestionInput } from '@/lib/ai-search-intelligence/types';
import type { AsiToolId } from '@/lib/ai-search-intelligence/routes';

const CACHE_KEY = 'asi_evidence_snapshot';

function readCached(): AsiEvidenceSnapshot | null {
	const data = readAsiSessionSnapshot<AsiEvidenceSnapshot>(
		CACHE_KEY,
		(item) => Boolean(item?.site?.url && Array.isArray(item.citations) && item.monitorLatest),
	);
	if (!data) return null;
	return {
		...data,
		queryProbe: data.queryProbe ?? { current: null, previous: null, compare: [] },
	};
}

function writeCached(snapshot: AsiEvidenceSnapshot) {
	writeAsiSessionSnapshot(CACHE_KEY, snapshot);
}

export function EvidenceDashboard({
	tool,
}: {
	tool: Extract<AsiToolId, 'citations' | 'questions'>;
}) {
	const t = useTranslations('intelligence.evidence');
	const tUx = useTranslations('intelligence.ux');
	const failCopy = asiFailCopy(t('urlInvalid'), tUx);
	const { targetUrl, currentSite, requireTargetUrl, analysisEpoch, reportModuleStatus } = useIntelligence();
	const entryId = tool === 'questions' ? 'questions' : 'citations';
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<{ message: string; tone: 'error' } | null>(null);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [probing, setProbing] = useState(false);
	const [snapshot, setSnapshot] = useState<AsiEvidenceSnapshot | null>(null);
	const { nextSignal, cancel: cancelRun, isLive } = useAsiAbort();

	useEffect(() => {
		if (!toast) return;
		const id = window.setTimeout(() => setToast(null), 4200);
		return () => window.clearTimeout(id);
	}, [toast]);

	useEffect(() => {
		if (targetUrl) setUrl(targetUrl);
	}, [targetUrl]);

	useEffect(() => {
		const cached = readCached();
		const current = currentSite?.siteUrl || normalizeAsiSiteUrl(targetUrl);
		const cacheReady = Boolean(
			cached &&
				current &&
				asiSitesMatch(cached.site.url, current) &&
				!asiCacheShouldRebuild(cached) &&
				(tool !== 'citations' || Boolean(cached.citationReport)) &&
				(tool !== 'questions' || Boolean(cached.queryGeneration)),
		);
		if (cacheReady && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
			reportModuleStatus(entryId, {
				isLoading: false,
				data: cached,
				error: null,
				lastAnalyzedUrl: cached.site.url,
			});
			return;
		}
		setSnapshot(null);
	}, [analysisEpoch, currentSite?.siteUrl, entryId, reportModuleStatus, targetUrl, tool]);

	async function analyze(
		_nextUrl: string,
		questions?: Partial<AsiQuestionInput>,
		mode: 'page' | 'generate' = 'page',
	) {
		if (!currentSite) {
			const message = t('urlInvalid');
			setError(message);
			if (mode === 'generate') setToast({ message, tone: 'error' });
			requireTargetUrl();
			return;
		}
		setError(null);
		setProbing(false);
		setLoading(mode === 'page');
		setGenerating(mode === 'generate');
		reportModuleStatus(entryId, { isLoading: true, error: null });
		const signal = nextSignal();
		const loader = tool === 'questions' ? loadAsiQueryGenerator : loadAsiEvidence;
		try {
			const result = await loader(
				{
					...inputFromCurrentSite(currentSite),
					questions: { ...inputFromCurrentSite(currentSite).questions, ...questions },
				},
				signal,
			);
			if (!isLive(signal)) return;
			if (result.snapshot) {
				setSnapshot(result.snapshot);
				writeCached(result.snapshot);
				setUrl(result.snapshot.site.url);
				reportModuleStatus(entryId, {
					isLoading: false,
					data: result.snapshot,
					error: null,
					lastAnalyzedUrl: result.snapshot.site.url,
				});
			} else if (!isAsiCancelled(result.error)) {
				const message = asiLoadMessage(result.error, failCopy);
				setError(message);
				if (mode === 'generate') setToast({ message, tone: 'error' });
				reportModuleStatus(entryId, { isLoading: false, error: message });
			} else {
				reportModuleStatus(entryId, { isLoading: false });
			}
		} catch {
			if (!isLive(signal)) return;
			const message = tUx('analyzeFailed');
			setError(message);
			if (mode === 'generate') setToast({ message, tone: 'error' });
			reportModuleStatus(entryId, { isLoading: false, error: message });
		} finally {
			if (isLive(signal)) {
				setLoading(false);
				setGenerating(false);
			}
		}
	}

	async function probe(queries: string[]) {
		if (!snapshot || !currentSite) {
			requireTargetUrl();
			return;
		}
		setError(null);
		setLoading(false);
		setProbing(true);
		const signal = nextSignal();
		const result = await loadAsiQueryProbe(
			{
				...inputFromCurrentSite(currentSite),
				queries,
			},
			signal,
		);
		if (!isLive(signal)) return;
		if (result.snapshot) {
			const next = {
				...result.snapshot,
				questions: snapshot.questions,
				questionInputs: snapshot.questionInputs,
			};
			setSnapshot(next);
			writeCached(next);
		} else if (!isAsiCancelled(result.error)) {
			setError(asiLoadMessage(result.error, failCopy));
		}
		setProbing(false);
	}

	// React to the shared top control bar's explicit [AI 인텔리전스 분석] click even
	// when this dashboard is already mounted (a fresh mount already self-seeds above).
	const analyzeRef = useRef(analyze);
	analyzeRef.current = analyze;
	useEffect(() => onAsiAnalyzeRequest((nextUrl) => void analyzeRef.current(nextUrl)), []);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const resolved = requireTargetUrl();
		if (!resolved) return;
		void analyze(resolved, snapshot?.questionInputs);
	}

	return (
		<main>
			<AsiPageChrome
				kicker={t('kicker')}
				title={t(`title.${tool}`)}
				subtitle={t(`subtitle.${tool}`)}
				source={snapshot?.source}
				inputId="asi-evidence-url"
				url={url}
				onUrlChange={setUrl}
				onSubmit={onSubmit}
				urlLabel={t('urlLabel')}
				urlPlaceholder={t('urlPlaceholder')}
				submitLabel={t('analyze')}
				submittingLabel={t('analyzing')}
				loading={loading || generating || probing}
				onCancel={cancelRun}
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
						items={[{ id: 'visibility', value: snapshot.monitorLatest.visibilityScore }]}
					/>
				) : null}
				{snapshot && tool === 'citations' ? (
					<>
						<AsiClipBanner kind="citations" />
						<CitationExplorerPanel snapshot={snapshot} />
					</>
				) : snapshot && tool === 'questions' ? (
					<QuestionGeneratorPanel
						snapshot={snapshot}
						busy={loading}
						generating={generating}
						probing={probing}
						onGenerate={(input) => {
							const resolved = requireTargetUrl();
							if (!resolved) return;
							void analyze(resolved, input, 'generate');
						}}
						onProbe={(queries) => {
							void probe(queries);
						}}
						onCancel={cancelRun}
					/>
				) : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast?.message ?? null} />
		</main>
	);
}
