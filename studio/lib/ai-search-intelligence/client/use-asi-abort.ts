'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AsiLoadError } from '@/lib/ai-search-intelligence/client/asi-client';

export function isAsiCancelled(error: AsiLoadError): boolean {
	return error === 'cancelled';
}

/** True only for the dashboard's current in-flight signal while the tree is mounted. */
export function isAsiResultLive(
	mounted: boolean,
	current: AbortSignal | null | undefined,
	signal: AbortSignal,
): boolean {
	return mounted && current === signal;
}

/** One in-flight ASI request per dashboard. Aborts on replace and on unmount. */
export function useAsiAbort() {
	const abortRef = useRef<AbortController | null>(null);
	const mountedRef = useRef(true);

	const nextSignal = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = new AbortController();
		return abortRef.current.signal;
	}, []);

	const cancel = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	const isLive = useCallback((signal: AbortSignal) => {
		return isAsiResultLive(mountedRef.current, abortRef.current?.signal, signal);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			abortRef.current?.abort();
		};
	}, []);

	return { nextSignal, cancel, isLive };
}
