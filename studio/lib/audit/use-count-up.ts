'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a numeric headline score from its previous value up to `value` whenever
 * `value` changes — used for the moment Track 3 (PageSpeed/Lighthouse) lands and the
 * composite/CWV scores flip from a loading skeleton to their final number, so they fill
 * in with a brief count-up instead of popping in instantly.
 *
 * Skips the animation entirely on the very first render (nothing to count up *from* yet)
 * and for reduced-motion users, both of which just show the target value immediately.
 */
export function useCountUp(value: number, opts?: { durationMs?: number }): number {
	const durationMs = opts?.durationMs ?? 700;
	const [display, setDisplay] = useState(value);
	const prevValueRef = useRef(value);
	const isFirstRenderRef = useRef(true);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		const from = prevValueRef.current;
		const to = value;
		prevValueRef.current = value;

		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			setDisplay(to);
			return;
		}
		if (from === to) {
			setDisplay(to);
			return;
		}
		if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			setDisplay(to);
			return;
		}

		const startedAt = performance.now();
		function tick() {
			const elapsed = performance.now() - startedAt;
			const progress = Math.min(1, elapsed / durationMs);
			// Ease-out cubic — fast start, gentle settle, matches the fade-ins around it.
			const eased = 1 - (1 - progress) ** 3;
			setDisplay(Math.round(from + (to - from) * eased));
			if (progress < 1) {
				rafRef.current = window.requestAnimationFrame(tick);
			} else {
				rafRef.current = null;
			}
		}

		if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
		rafRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `from` is the ref snapshot at animation start, not a dep
	}, [value, durationMs]);

	return display;
}
