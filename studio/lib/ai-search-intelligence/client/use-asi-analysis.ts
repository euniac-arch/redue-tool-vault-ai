'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import {
	asiLoadMessage,
	type AsiFailCopy,
	type AsiLoadResult,
} from '@/lib/ai-search-intelligence/client/asi-client';
import { inputFromCurrentSite } from '@/lib/ai-search-intelligence/client/current-site-input';
import { useElapsedSeconds } from '@/lib/ai-search-intelligence/client/use-elapsed-seconds';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { asiSitesMatch, normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import type { AsiIaEntryId } from '@/lib/ai-search-intelligence/routes';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';

export type AsiAnalysisSnapshot = {
	site: { url: string };
	source?: AsiSource;
	boundFromAudit?: boolean;
	auditBind?: unknown;
};

export function useAsiAnalysis<T extends AsiAnalysisSnapshot>(options: {
	cacheKey: string;
	entryId: AsiIaEntryId;
	isValid: (data: T) => boolean;
	loader: (input: AsiRunInput, signal?: AbortSignal) => Promise<AsiLoadResult<T>>;
	invalidUrlMessage: string;
	failCopy: AsiFailCopy;
	cacheReady?: (cached: T, seedUrl: string) => boolean;
	extraInput?: Partial<AsiRunInput> | (() => Partial<AsiRunInput>);
}) {
	const { targetUrl, currentSite, requireTargetUrl, analysisEpoch, reportModuleStatus, runSingleToolAnalysis } =
		useIntelligence();
	const [url, setUrl] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [snapshot, setSnapshot] = useState<T | null>(null);
	const { nextSignal, cancel, isLive } = useAsiAbort();
	const elapsedTime = useElapsedSeconds(loading);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		if (!toast) return;
		const id = window.setTimeout(() => setToast(null), 4200);
		return () => window.clearTimeout(id);
	}, [toast]);

	useEffect(() => {
		if (targetUrl) setUrl(targetUrl);
	}, [targetUrl]);

	const analyze = useCallback(
		async (_ignoredUrl?: string, extra?: Partial<AsiRunInput>) => {
			const current = optionsRef.current;
			const site = currentSite;
			if (!site) {
				requireTargetUrl();
				return;
			}
			setError(null);
			setLoading(true);
			reportModuleStatus(current.entryId, { isLoading: true, error: null });
			const signal = nextSignal();
			const extras = typeof current.extraInput === 'function' ? current.extraInput() : current.extraInput ?? {};
			try {
				const result = await current.loader(
					{
						...inputFromCurrentSite(site),
						...extras,
						...extra,
					},
					signal,
				);
				if (!isLive(signal)) return;
				if (result.snapshot) {
					setSnapshot(result.snapshot);
					writeAsiSessionSnapshot(current.cacheKey, result.snapshot);
					setUrl(result.snapshot.site.url);
					reportModuleStatus(current.entryId, {
						isLoading: false,
						data: result.snapshot,
						error: null,
						lastAnalyzedUrl: result.snapshot.site.url,
					});
				} else if (result.error && !isAsiCancelled(result.error)) {
					const message = asiLoadMessage(result.error, current.failCopy);
					setError(message);
					setToast(message);
					reportModuleStatus(current.entryId, { isLoading: false, error: message });
				} else {
					reportModuleStatus(current.entryId, { isLoading: false });
				}
			} catch {
				if (!isLive(signal)) return;
				const message = current.failCopy.unavailable;
				setError(message);
				setToast(message);
				reportModuleStatus(current.entryId, { isLoading: false, error: message });
			} finally {
				if (isLive(signal)) setLoading(false);
			}
		},
		[currentSite, isLive, nextSignal, reportModuleStatus, requireTargetUrl],
	);

	useEffect(() => {
		const currentOpts = optionsRef.current;
		const cached = readAsiSessionSnapshot<T>(currentOpts.cacheKey, currentOpts.isValid);
		const current = currentSite?.siteUrl || normalizeAsiSiteUrl(targetUrl);
		const ready =
			Boolean(cached) &&
			Boolean(current) &&
			asiSitesMatch(cached!.site.url, current) &&
			!asiCacheShouldRebuild(cached) &&
			(currentOpts.cacheReady ? currentOpts.cacheReady(cached as T, current as string) : true);
		if (ready && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
			reportModuleStatus(currentOpts.entryId, {
				isLoading: false,
				data: cached,
				error: null,
				lastAnalyzedUrl: cached.site.url,
			});
			return;
		}
		setSnapshot(null);
	}, [analysisEpoch, currentSite?.siteUrl, reportModuleStatus, targetUrl]);

	const analyzeRef = useRef(analyze);
	analyzeRef.current = analyze;
	useEffect(() => onAsiAnalyzeRequest(() => void analyzeRef.current()), []);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void runSingleToolAnalysis(optionsRef.current.entryId);
	}

	return {
		url,
		setUrl,
		error,
		toast,
		loading,
		elapsedTime,
		snapshot,
		analyze,
		cancel,
		onSubmit,
		targetUrl,
		requireTargetUrl,
	};
}
