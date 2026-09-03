'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiErrorToast } from '@/components/ai-search-intelligence/common/AsiErrorToast';
import { AsiClipBanner } from '@/components/ai-search-intelligence/entitlement/AsiClipBanner';
import { CitationExplorerPanel } from '@/components/ai-search-intelligence/evidence/CitationExplorerPanel';
import { QuestionGeneratorPanel } from '@/components/ai-search-intelligence/evidence/QuestionGeneratorPanel';
import { AsiPageChrome } from '@/components/ai-search-intelligence/primitives/AsiPageChrome';
import { AsiScoreCompareStrip } from '@/components/ai-search-intelligence/primitives/AsiScoreCompareStrip';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	seedAsiSiteUrl,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import { asiFailCopy, asiLoadMessage, loadAsiEvidence, loadAsiQueryProbe } from '@/lib/ai-search-intelligence/client/asi-client';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
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

	// A mount may ONLY ever restore an already-computed result (zero network
	// calls, no auto-generated questions) — it must NEVER call `loadAsiEvidence()`
	// on its own. Every fetch requires the user to press this page's Analyze /
	// Generate button or the shared top bar's button; no other path exists.
	useEffect(() => {
		const cached = readCached();
		const seedUrl = seedAsiSiteUrl(cached?.site.url);
		const cacheReady =
			cached &&
			(!seedUrl || cached.site.url === normalizeAsiSiteUrl(seedUrl)) &&
			!asiCacheShouldRebuild(cached) &&
			(tool !== 'citations' || Boolean(cached.citationReport)) &&
			(tool !== 'questions' || Boolean(cached.queryGeneration));
		if (cacheReady && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
		}
	}, []);

	async function analyze(
		nextUrl: string,
		questions?: Partial<AsiQuestionInput>,
		mode: 'page' | 'generate' = 'page',
	) {
		const normalized = normalizeAsiSiteUrl(nextUrl);
		if (!normalized) {
			const message = t('urlInvalid');
			setError(message);
			if (mode === 'generate') setToast({ message, tone: 'error' });
			return;
		}
		setError(null);
		setProbing(false);
		setLoading(mode === 'page');
		setGenerating(mode === 'generate');
		const signal = nextSignal();
		try {
			const result = await loadAsiEvidence(
				{
					url: normalized,
					questions,
					audit: loadLatestAuditPayload(),
				},
				signal,
			);
			if (!isLive(signal)) return;
			if (result.snapshot) {
				setSnapshot(result.snapshot);
				writeCached(result.snapshot);
				setUrl(result.snapshot.site.url);
			} else if (!isAsiCancelled(result.error)) {
				const message = asiLoadMessage(result.error, failCopy);
				setError(message);
				if (mode === 'generate') setToast({ message, tone: 'error' });
			}
		} catch {
			if (!isLive(signal)) return;
			const message = tUx('analyzeFailed');
			setError(message);
			if (mode === 'generate') setToast({ message, tone: 'error' });
		} finally {
			if (isLive(signal)) {
				setLoading(false);
				setGenerating(false);
			}
		}
	}

	async function probe(queries: string[]) {
		if (!snapshot) return;
		setError(null);
		setLoading(false);
		setProbing(true);
		const signal = nextSignal();
		const result = await loadAsiQueryProbe(
			{
				url: snapshot.site.url,
				queries,
				audit: loadLatestAuditPayload(),
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
		void analyze(url, snapshot?.questionInputs);
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
						onGenerate={(input) => void analyze(snapshot.site.url, input, 'generate')}
						onProbe={(queries) => void probe(queries)}
						onCancel={cancelRun}
					/>
				) : null}
			</AsiPageChrome>
			<AsiErrorToast message={toast?.message ?? null} />
		</main>
	);
}
