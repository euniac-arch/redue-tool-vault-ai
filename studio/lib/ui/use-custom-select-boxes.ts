'use client';

import { useEffect } from 'react';
import { observeCustomSelectBoxes } from '@/lib/ui/custom-select-boxes';

/**
 * Re-run custom-select enhancement after async diagnosis UI mounts.
 * `deps` should include whatever causes new <select> nodes to appear.
 */
export function useCustomSelectBoxes(
	containerSelector: string,
	deps: readonly unknown[] = [],
) {
	useEffect(() => {
		return observeCustomSelectBoxes(containerSelector);
		// Caller controls freshness via `deps` (container is typically a stable id).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [containerSelector, ...deps]);
}
