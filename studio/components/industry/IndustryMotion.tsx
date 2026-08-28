'use client';

import { useEffect, useRef, type ReactNode } from 'react';

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One observer for the whole page — wrappers below are plain divs. */
export function IndustryMotionRoot({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = ref.current;
		if (!root) return;
		const targets = Array.from(root.querySelectorAll<HTMLElement>('.industry-reveal, .industry-stagger'));
		if (prefersReducedMotion()) {
			targets.forEach((el) => el.classList.add('is-in'));
			return;
		}
		targets.forEach((el) => el.classList.add('industry-armed'));
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add('is-in');
					observer.unobserve(entry.target);
				}
			},
			{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
		);
		targets.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, []);

	return <div ref={ref}>{children}</div>;
}
