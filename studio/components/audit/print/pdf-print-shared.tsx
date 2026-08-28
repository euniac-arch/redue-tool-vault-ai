'use client';

import { Component, type ReactNode } from 'react';

/**
 * Shared visual primitives for the curated A4 print-only report sections
 * (stage 1–5 under `#pdf-print-area`). Every piece here is styled with a
 * hard-coded light palette — no `dark:` variants — so the sheet stays
 * high-contrast in print/PDF regardless of the dashboard's active theme.
 */

/** One crashed print/track section must not blank the rest of the A4 tree. */
export class PrintSectionBoundary extends Component<
	{ children: ReactNode; fallback?: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };

	static getDerivedStateFromError(): { hasError: boolean } {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<p className="px-5 py-4 text-xs leading-relaxed text-slate-500">
						이 섹션을 표시할 수 없습니다.
					</p>
				)
			);
		}
		return this.props.children;
	}
}

export type PdfCellStatus = 'pass' | 'warning' | 'fail' | 'neutral';

const STATUS_BADGE_CLASS: Record<PdfCellStatus, string> = {
	pass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	warning: 'border-amber-200 bg-amber-50 text-amber-800',
	fail: 'border-rose-200 bg-rose-50 text-rose-700',
	neutral: 'border-slate-200 bg-slate-100 text-slate-500',
};

const STATUS_DOT_CLASS: Record<PdfCellStatus, string> = {
	pass: 'bg-emerald-500',
	warning: 'bg-amber-500',
	fail: 'bg-rose-500',
	neutral: 'bg-slate-400',
};

export function PdfStatusBadge({
	status,
	children,
}: {
	status: PdfCellStatus;
	children: ReactNode;
}) {
	return (
		<span
			className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold leading-none whitespace-nowrap ${STATUS_BADGE_CLASS[status]}`}
		>
			<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[status]}`} aria-hidden />
			{children}
		</span>
	);
}

/** Stage-number chip (1~6) shared by every curated print section heading. */
export function PdfStageHeading({
	step,
	eyebrow,
	title,
	hint,
}: {
	step: number;
	eyebrow: string;
	title: string;
	hint?: string;
}) {
	return (
		<div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
			<span className="pdf-bg-gold-light pdf-text-gold flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold leading-none">
				{step}
			</span>
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-col gap-0.5">
					<p className="pdf-text-gold text-[11px] font-bold uppercase leading-none tracking-[0.18em]">{eyebrow}</p>
					<h2 className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">{title}</h2>
				</div>
				{hint ? <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
			</div>
		</div>
	);
}

export const PDF_TABLE_WRAP = 'overflow-hidden rounded-xl border border-slate-200';
export const PDF_TABLE = 'w-full border-collapse text-left text-[10.5px]';
export const PDF_TABLE_TH =
	'border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600';
export const PDF_TABLE_TD = 'border border-slate-200 px-2.5 py-2 align-top text-slate-800';
export const PDF_TABLE_ROW_BREAK = 'pdf-table-row';

export function PdfEmptyNote({ children }: { children: ReactNode }) {
	return <p className="px-5 py-4 text-xs leading-relaxed text-slate-500 sm:px-6">{children}</p>;
}
