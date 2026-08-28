/**
 * Client-side data layer for `POST /api/seo/fact-check`.
 *
 * A module-level in-flight cache dedupes concurrent calls for the same URL —
 * the Hero scoreboard (Step 2) and the schema-tab issue report (Step 3) both
 * mount on the same result page and would otherwise fire two identical LLM
 * requests. `useFactCheck` wraps this in a small React hook with loading /
 * ready / error states and a `refresh(forceRefresh)` action for the
 * "AI 재검증 실행" button.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FactCheckResponse } from '@/lib/audit/fact-check';

const inflight = new Map<string, Promise<FactCheckResponse>>();
const lastResult = new Map<string, FactCheckResponse>();

async function requestFactCheck(url: string, forceRefresh: boolean): Promise<FactCheckResponse> {
	const res = await fetch('/api/seo/fact-check', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url, forceRefresh }),
	});
	const data = (await res.json().catch(() => null)) as (FactCheckResponse & { error?: string }) | null;
	if (!res.ok || !data || typeof data.integrity_score !== 'number') {
		throw new Error(data?.error || 'AI 팩트체크를 불러오지 못했습니다.');
	}
	return data;
}

/** Dedupe concurrent, non-forced calls for the same URL across mounted components. */
export function fetchFactCheck(url: string, opts?: { forceRefresh?: boolean }): Promise<FactCheckResponse> {
	const forceRefresh = opts?.forceRefresh === true;
	if (!forceRefresh) {
		const pending = inflight.get(url);
		if (pending) return pending;
	}

	const promise = requestFactCheck(url, forceRefresh)
		.then((data) => {
			lastResult.set(url, data);
			return data;
		})
		.finally(() => {
			if (inflight.get(url) === promise) inflight.delete(url);
		});

	inflight.set(url, promise);
	return promise;
}

export type FactCheckHookState =
	| { kind: 'loading' }
	| { kind: 'ready'; data: FactCheckResponse }
	| { kind: 'error'; message: string };

export interface UseFactCheckResult {
	state: FactCheckHookState;
	/** Re-runs the check. Pass `true` to bypass the 10-minute server cache ("AI 재검증 실행"). */
	refresh: (forceRefresh?: boolean) => void;
}

export function useFactCheck(url: string | undefined | null): UseFactCheckResult {
	const cached = url ? lastResult.get(url) : undefined;
	const [state, setState] = useState<FactCheckHookState>(cached ? { kind: 'ready', data: cached } : { kind: 'loading' });
	const requestId = useRef(0);

	const run = useCallback(
		(forceRefresh = false) => {
			if (!url) return;
			const id = ++requestId.current;
			setState({ kind: 'loading' });
			fetchFactCheck(url, { forceRefresh })
				.then((data) => {
					if (requestId.current !== id) return;
					setState({ kind: 'ready', data });
				})
				.catch((err: unknown) => {
					if (requestId.current !== id) return;
					setState({ kind: 'error', message: err instanceof Error ? err.message : 'AI 팩트체크를 불러오지 못했습니다.' });
				});
		},
		[url],
	);

	useEffect(() => {
		if (!url) return;
		run(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url]);

	return { state, refresh: run };
}
