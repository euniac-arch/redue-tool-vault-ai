'use client';

import { useCallback } from 'react';
import { doneTopProgress, startTopProgress } from '@/components/common/top-progress';

/**
 * Start / complete the global top progress bar from data-fetching code.
 * Route changes (menu clicks, back/forward) are handled automatically.
 */
export function useTopProgress() {
	const start = useCallback(() => {
		startTopProgress();
	}, []);

	const done = useCallback(() => {
		doneTopProgress();
	}, []);

	return { start, done };
}
