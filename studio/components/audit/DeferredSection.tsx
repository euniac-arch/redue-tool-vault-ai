'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MOUNT_AUDIT_RESULT_TABS_EVENT } from '@/lib/audit/scroll-to-category';

interface DeferredSectionProps {
	children: ReactNode;
	/** Extra pixels before the box enters the viewport. */
	rootMargin?: string;
	/** Mount even if never intersecting (print / idle prefetch). */
	idleTimeoutMs?: number;
	minHeight?: number;
	className?: string;
	/** Skip deferral (public A4 / print stack). */
	force?: boolean;
}

/**
 * Keeps below-fold report blocks out of the first paint.
 * Mounts on intersection, idle timeout, or PDF/print request.
 */
export function DeferredSection({
	children,
	rootMargin = '280px 0px',
	idleTimeoutMs = 2600,
	minHeight = 8,
	className,
	force = false,
}: DeferredSectionProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [show, setShow] = useState(force);

	useEffect(() => {
		if (force) {
			setShow(true);
			return;
		}
		if (show) return;
		const el = ref.current;
		if (!el) return;

		let cancelled = false;
		const reveal = () => {
			if (!cancelled) setShow(true);
		};

		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) reveal();
			},
			{ rootMargin },
		);
		io.observe(el);

		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		const idleId =
			typeof win.requestIdleCallback === 'function'
				? win.requestIdleCallback(reveal, { timeout: idleTimeoutMs })
				: window.setTimeout(reveal, idleTimeoutMs);

		window.addEventListener('beforeprint', reveal);
		window.addEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, reveal);

		return () => {
			cancelled = true;
			io.disconnect();
			if (typeof win.cancelIdleCallback === 'function') {
				win.cancelIdleCallback(idleId);
			} else {
				window.clearTimeout(idleId);
			}
			window.removeEventListener('beforeprint', reveal);
			window.removeEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, reveal);
		};
	}, [force, show, rootMargin, idleTimeoutMs]);

	const style: CSSProperties | undefined = show ? undefined : { minHeight };

	return (
		<div ref={ref} className={className} style={style}>
			{show ? children : null}
		</div>
	);
}
