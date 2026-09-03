'use client';

import { useEffect, useState } from 'react';
import { useAsiCountUp, useAsiMotion } from '@/lib/ui/asi-motion';

const RADIUS = 58;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AgentReadinessRing({ value }: { value: number }) {
	const { reduce } = useAsiMotion();
	const shown = useAsiCountUp(value);
	const clamped = Math.max(0, Math.min(100, Math.round(value)));
	const targetOffset = CIRCUMFERENCE * (1 - clamped / 100);
	const [offset, setOffset] = useState(reduce ? targetOffset : CIRCUMFERENCE);
	const tone = clamped >= 70 ? '#059669' : clamped >= 42 ? '#d97706' : '#e11d48';

	useEffect(() => {
		if (reduce) {
			setOffset(targetOffset);
			return;
		}
		const id = window.requestAnimationFrame(() => setOffset(targetOffset));
		return () => window.cancelAnimationFrame(id);
	}, [reduce, targetOffset]);

	return (
		<svg viewBox="0 0 140 140" className="h-28 w-28 shrink-0 sm:h-36 sm:w-36" aria-hidden>
			<circle
				cx="70"
				cy="70"
				r={RADIUS}
				fill="none"
				stroke="currentColor"
				strokeWidth="10"
				className="text-slate-200 dark:text-slate-800"
			/>
			<circle
				cx="70"
				cy="70"
				r={RADIUS}
				fill="none"
				stroke={tone}
				strokeWidth="10"
				strokeLinecap="round"
				strokeDasharray={CIRCUMFERENCE}
				strokeDashoffset={offset}
				transform="rotate(-90 70 70)"
				style={{
					transition: reduce ? undefined : 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)',
				}}
			/>
			<text
				x="70"
				y="66"
				textAnchor="middle"
				className="fill-slate-900 dark:fill-white"
				style={{ fontSize: '28px', fontWeight: 800 }}
			>
				{shown}
			</text>
			<text
				x="70"
				y="86"
				textAnchor="middle"
				className="fill-slate-400"
				style={{ fontSize: '11px', fontWeight: 700 }}
			>
				/ 100
			</text>
		</svg>
	);
}
