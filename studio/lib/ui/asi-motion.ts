'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

export function useAsiMotion() {
	const reduce = Boolean(useReducedMotion());
	return {
		reduce,
		page: reduce
			? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
			: {
					hidden: { opacity: 0, y: 12 },
					show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } },
				},
		item: reduce
			? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
			: {
					hidden: { opacity: 0, y: 8 },
					show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
				},
		list: {
			hidden: {},
			show: { transition: { staggerChildren: reduce ? 0 : 0.045 } },
		},
		chartMs: reduce ? 0 : 700,
	};
}

/** Count from 0 on first paint. Respects prefers-reduced-motion. */
export function useAsiCountUp(value: number, durationMs = 700): number {
	const [display, setDisplay] = useState(0);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		const reduce =
			typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		if (reduce) {
			setDisplay(value);
			return;
		}
		const from = 0;
		const to = value;
		const startedAt = performance.now();
		function tick() {
			const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
			const eased = 1 - (1 - progress) ** 3;
			setDisplay(Math.round(from + (to - from) * eased));
			if (progress < 1) rafRef.current = window.requestAnimationFrame(tick);
			else rafRef.current = null;
		}
		if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
		rafRef.current = window.requestAnimationFrame(tick);
		return () => {
			if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
		};
	}, [value, durationMs]);

	return display;
}
