'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import {
	asiCacheShouldRebuild,
	onAsiAnalyzeRequest,
	readAsiSessionSnapshot,
	seedAsiSiteUrl,
	writeAsiSessionSnapshot,
} from '@/lib/ai-search-intelligence/asi-bound-url';
import {
	asiLoadMessage,
	type AsiFailCopy,
	type AsiLoadResult,
} from '@/lib/ai-search-intelligence/client/asi-client';
import { useElapsedSeconds } from '@/lib/ai-search-intelligence/client/use-elapsed-seconds';
import { isAsiCancelled, useAsiAbort } from '@/lib/ai-search-intelligence/client/use-asi-abort';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';

export type AsiAnalysisSnapshot = {
	site: { url: string };
	source?: AsiSource;
	boundFromAudit?: boolean;
	auditBind?: unknown;
};

export function useAsiAnalysis<T extends AsiAnalysisSnapshot>(options: {
	cacheKey: string;
	isValid: (data: T) => boolean;
	loader: (input: AsiRunInput, signal?: AbortSignal) => Promise<AsiLoadResult<T>>;
	invalidUrlMessage: string;
	failCopy: AsiFailCopy;
	cacheReady?: (cached: T, seedUrl: string) => boolean;
	extraInput?: Partial<AsiRunInput> | (() => Partial<AsiRunInput>);
}) {
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

	const analyze = useCallback(
		async (nextUrl: string, extra?: Partial<AsiRunInput>) => {
			const current = optionsRef.current;
			const normalized = normalizeAsiSiteUrl(nextUrl);
			if (!normalized) {
				setError(current.invalidUrlMessage);
				setToast(current.invalidUrlMessage);
				return;
			}
			setError(null);
			setLoading(true);
			const signal = nextSignal();
			const extras = typeof current.extraInput === 'function' ? current.extraInput() : current.extraInput ?? {};
			try {
				const result = await current.loader(
					{
						url: normalized,
						audit: loadLatestAuditPayload(),
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
				} else if (result.error && !isAsiCancelled(result.error)) {
					const message = asiLoadMessage(result.error, current.failCopy);
					setError(message);
					setToast(message);
				}
			} catch {
				if (!isLive(signal)) return;
				const message = current.failCopy.unavailable;
				setError(message);
				setToast(message);
			} finally {
				if (isLive(signal)) setLoading(false);
			}
		},
		[isLive, nextSignal],
	);

	useEffect(() => {
		const cached = readAsiSessionSnapshot<T>(options.cacheKey, options.isValid);
		const seedUrl = seedAsiSiteUrl(cached?.site.url);
		const ready =
			cached &&
			(!seedUrl || cached.site.url === normalizeAsiSiteUrl(seedUrl)) &&
			!asiCacheShouldRebuild(cached) &&
			(options.cacheReady ? options.cacheReady(cached, seedUrl) : true);
		// A mount may ONLY ever restore an already-computed result (zero network
		// calls) — it must NEVER call `analyze()` on its own. Every fetch requires
		// the user to press this page's own submit button or the shared top bar's
		// [AI 인텔리전스 분석] button; there is no other path to a network call.
		if (ready && cached) {
			setSnapshot(cached);
			setUrl(cached.site.url);
		}
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
	};
}
