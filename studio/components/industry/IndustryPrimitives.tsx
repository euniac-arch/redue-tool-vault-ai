import type { CSSProperties, ReactNode } from 'react';
import { CARD, GRADIENT_TEXT, KICKER } from './industry-ui';

export function staggerStyle(index: number): CSSProperties {
	return { '--ind-i': index } as CSSProperties;
}

export function IndustryReveal({
	children,
	className = '',
	delayMs = 0,
}: {
	children: ReactNode;
	className?: string;
	delayMs?: number;
}) {
	return (
		<div className={`industry-reveal ${className}`.trim()} style={{ '--ind-delay': `${delayMs}ms` } as CSSProperties}>
			{children}
		</div>
	);
}

export function IndustryStagger({
	children,
	className = '',
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={`industry-stagger ${className}`.trim()}>{children}</div>;
}

export function SectionKicker({ children }: { children: ReactNode }) {
	return (
		<span className={KICKER}>
			<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
			{children}
		</span>
	);
}

export function SectionHeader({
	kicker,
	title,
	title2,
	subtitle,
}: {
	kicker: string;
	title: string;
	title2?: string;
	subtitle?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-3 text-center">
			<SectionKicker>{kicker}</SectionKicker>
			<h2 className="max-w-3xl break-keep text-balance text-[1.45rem] font-extrabold leading-snug text-slate-900 sm:text-3xl dark:text-white">
				<span className="block">{title}</span>
				{title2 ? <span className="mt-1 block">{title2}</span> : null}
			</h2>
			{subtitle ? (
				<p className="max-w-2xl break-keep text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
					{subtitle}
				</p>
			) : null}
		</div>
	);
}

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
	return (
		<span className="inline-flex tracking-tight text-[#0C9AA7]" aria-label={`${value} / ${max}`}>
			{Array.from({ length: max }, (_, index) => (
				<span key={index} className={index < value ? 'opacity-100' : 'opacity-25'}>
					★
				</span>
			))}
		</span>
	);
}

export function FlowArrow({ index = 0 }: { index?: number }) {
	return (
		<div className="industry-connector" style={staggerStyle(index)} aria-hidden>
			<svg width="16" height="36" viewBox="0 0 16 36" className="overflow-visible">
				<line className="industry-connector-line" x1="8" y1="2" x2="8" y2="22" />
			</svg>
			<span className={`-mt-2 text-sm font-black ${GRADIENT_TEXT}`}>↓</span>
		</div>
	);
}

export function NodeChip({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
	return (
		<span
			className={
				accent
					? 'inline-flex items-center rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:border-[rgba(12,154,167,0.4)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]'
					: 'inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-[#1f3a5a] dark:bg-[#04101b] dark:text-slate-200'
			}
		>
			{children}
		</span>
	);
}

export function EntityFlow({ nodes, startIndex = 0 }: { nodes: string[]; startIndex?: number }) {
	return (
		<div className="industry-entity-flow">
			{nodes.map((node, index) => (
				<div key={`${node}-${index}`} className="industry-entity-node industry-stagger-item" style={staggerStyle(startIndex + index)}>
					<NodeChip accent={index === 0}>{node}</NodeChip>
					{index < nodes.length - 1 ? (
						<span className="industry-entity-arrow" aria-hidden>
							→
						</span>
					) : null}
				</div>
			))}
		</div>
	);
}

export function FrameworkNote({ children }: { children: ReactNode }) {
	return (
		<div className={`${CARD} px-5 py-4 text-center`}>
			<p className="break-keep text-pretty text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">{children}</p>
		</div>
	);
}
