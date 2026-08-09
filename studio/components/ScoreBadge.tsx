import type { ScoreStatus } from '@/lib/types';

const STATUS_STYLES: Record<ScoreStatus, { ring: string; text: string; bg: string }> = {
	PASS: { ring: 'ring-emerald-400/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
	WARN: { ring: 'ring-amber-400/40', text: 'text-amber-400', bg: 'bg-amber-500/10' },
	FAIL: { ring: 'ring-rose-400/40', text: 'text-rose-400', bg: 'bg-rose-500/10' },
};

interface ScoreBadgeProps {
	score: number;
	maxScore: number;
	status: ScoreStatus;
	statusLabel: string;
}

export function ScoreBadge({ score, maxScore, status, statusLabel }: ScoreBadgeProps) {
	const styles = STATUS_STYLES[status];

	return (
		<div className={`flex items-center gap-5 rounded-2xl border border-white/10 ${styles.bg} px-6 py-5 ring-1 ${styles.ring}`}>
			<div className="flex flex-col items-center justify-center rounded-xl bg-black/20 px-4 py-3">
				<span className={`text-4xl font-extrabold tabular-nums ${styles.text}`}>{score}</span>
				<span className="text-[11px] uppercase tracking-wide text-slate-400">/ {maxScore}점</span>
			</div>
			<div>
				<p className={`text-lg font-bold ${styles.text}`}>{statusLabel}</p>
				<p className="text-sm text-slate-400">REDUE AI SEO &amp; GEO Studio 진단 점수 ({score}점)</p>
			</div>
		</div>
	);
}
