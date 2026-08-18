'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface SafeResponsiveContainerProps {
	children: ReactElement;
	/** Reserved box height so tab/layout switches never measure 0/NaN. */
	minHeight?: number;
	className?: string;
}

function isUsableSize(width: number, height: number): boolean {
	return Number.isFinite(width) && Number.isFinite(height) && width >= 8 && height >= 8;
}

/**
 * Mounts Recharts only after the parent has a real box.
 * Percent-based ResponsiveContainer + height:0 parents can loop ResizeObserver
 * and freeze the tab; numeric width/height after measure avoids that.
 */
export function SafeResponsiveContainer({
	children,
	minHeight = 220,
	className,
}: SafeResponsiveContainerProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState<{ w: number; h: number } | null>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		let frame = 0;
		const apply = (width: number, height: number) => {
			if (!isUsableSize(width, height)) return;
			const w = Math.round(width);
			const h = Math.round(height);
			setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
		};

		const measure = () => {
			const rect = el.getBoundingClientRect();
			apply(rect.width, rect.height);
		};

		const ro = new ResizeObserver((entries) => {
			const cr = entries[0]?.contentRect;
			if (!cr) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => apply(cr.width, cr.height));
		});

		// Two rAFs: wait until the tab/panel layout has settled.
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(measure);
		});
		ro.observe(el);

		return () => {
			cancelAnimationFrame(frame);
			ro.disconnect();
		};
	}, []);

	return (
		<div
			ref={ref}
			className={className}
			style={{ width: '100%', minHeight, height: minHeight }}
		>
			{box ? (
				<ResponsiveContainer width={box.w} height={box.h} debounce={80}>
					{children}
				</ResponsiveContainer>
			) : null}
		</div>
	);
}
