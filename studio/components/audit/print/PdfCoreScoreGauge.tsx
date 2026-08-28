'use client';

import { useTranslations } from 'next-intl';
import { CORE_SCORE_COLORS } from '@/components/audit/CoreScoreBarChart';

interface PdfCoreScoreGaugeProps {
	overallScore: number;
	track1Score: number;
	track2Score: number;
	track3Score: number;
}

type GaugeKey = 'overall' | 'track1' | 'track2' | 'track3';

function clampScore(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, Math.round(value)));
}

const GAUGE_ROWS: readonly GaugeKey[] = ['overall', 'track1', 'track2', 'track3'];

/**
 * PDF-only stand-in for `CoreScoreBarChart`'s Recharts bar/radar chart.
 * html2canvas has to rasterize every SVG node (defs, gradients, grid lines,
 * radar paths) in the live chart — profiling showed this was the single
 * heaviest per-page capture cost, sometimes stalling the whole export.
 * Plain `<div>` gauge bars carry the same four scores at near-zero
 * rasterization cost, so the export stays inside a 1–2s budget. Hidden on
 * screen (`pdf-print-only`) and revealed only during A4 capture/print —
 * see `forcePrintOnlyVisible` in `lib/audit/print-pdf.ts`.
 */
export function PdfCoreScoreGauge({
	overallScore,
	track1Score,
	track2Score,
	track3Score,
}: PdfCoreScoreGaugeProps) {
	const t = useTranslations('audit.scoreDistribution');
	const scoreByKey: Record<GaugeKey, number> = {
		overall: clampScore(overallScore),
		track1: clampScore(track1Score),
		track2: clampScore(track2Score),
		track3: clampScore(track3Score),
	};

	return (
		<div className="pdf-print-only pdf-card-box flex w-full flex-col justify-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
			{GAUGE_ROWS.map((key) => {
				const score = scoreByKey[key];
				const color = CORE_SCORE_COLORS[key].chip;
				return (
					<div key={key} className="flex items-center gap-2.5">
						<span className="w-14 shrink-0 text-[10px] font-bold leading-tight" style={{ color }}>
							{t(`chart.${key}.short`)}
						</span>
						<div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
							<div
								className="h-full rounded-full"
								style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
							/>
						</div>
						<span className="w-8 shrink-0 text-right text-[11px] font-extrabold tabular-nums text-slate-800">
							{score}
						</span>
					</div>
				);
			})}
		</div>
	);
}
