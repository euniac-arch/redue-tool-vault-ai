'use client';

import { useEffect, useState, type RefObject } from 'react';

const XL_MQ = '(min-width: 1280px)';

/**
 * Tracks the content shell's right edge so floating rails can sit
 * `gapPx` from the main column's right edge (xl+) instead of the viewport edge.
 * Positive = outside; negative = overlap inward (e.g. -34 ≈ flush to content).
 * Falls back when the viewport gutter is too narrow for `minRailWidth`.
 */
export function useContentSideRailLeft(
	containerRef: RefObject<HTMLElement | null> | null | undefined,
	gapPx = 16,
	minRailWidth = 48,
) {
	const [left, setLeft] = useState<number | null>(null);
	const [isXl, setIsXl] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia(XL_MQ);
		const syncMq = () => setIsXl(mq.matches);
		syncMq();
		mq.addEventListener('change', syncMq);
		return () => mq.removeEventListener('change', syncMq);
	}, []);

	useEffect(() => {
		if (!isXl) {
			setLeft(null);
			return;
		}

		const node = containerRef?.current;
		if (!node) return;

		const sync = () => {
			const rect = node.getBoundingClientRect();
			const candidate = Math.round(rect.right + gapPx);
			const fits = candidate + minRailWidth + 16 <= window.innerWidth;
			setLeft(fits ? candidate : null);
		};

		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(node);
		window.addEventListener('resize', sync);
		window.addEventListener('scroll', sync, { passive: true });

		return () => {
			ro.disconnect();
			window.removeEventListener('resize', sync);
			window.removeEventListener('scroll', sync);
		};
	}, [containerRef, gapPx, isXl, minRailWidth]);

	return { left, isXl };
}
