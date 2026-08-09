import { useTranslations } from 'next-intl';
import type { AuditOverallStatus } from '@/lib/site-auditor';

const STATUS_STYLES: Record<AuditOverallStatus, { text: string; bg: string; ring: string; badge: string }> = {
	CRITICAL: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-400/40', badge: 'bg-rose-500 text-white' },
	POOR: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-400/40', badge: 'bg-rose-500 text-white' },
	FAIR: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-400/40', badge: 'bg-amber-500 text-black' },
	GOOD: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/40', badge: 'bg-emerald-500 text-black' },
	EXCELLENT: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/40', badge: 'bg-emerald-500 text-black' },
};

interface AuditScoreHeaderProps {
	url: string;
	score: number;
	maxScore: number;
	status: AuditOverallStatus;
	statusLabel: string;
}

export function AuditScoreHeader({ url, score, maxScore, status, statusLabel }: AuditScoreHeaderProps) {
	const t = useTranslations('audit');
	const styles = STATUS_STYLES[status];
	const percent = Math.min(100, Math.max(0, (score / maxScore) * 100));

	return (
		<div className={`flex flex-col gap-5 rounded-2xl border border-white/[0.08] ${styles.bg} p-6 ring-1 ${styles.ring} sm:flex-row sm:items-center sm:justify-between`}>
			<div className="flex flex-col gap-1">
				<p className="text-xs uppercase tracking-wide text-slate-500">{t('scoreHeaderLabel')}</p>
				<p className="max-w-md truncate font-mono text-sm text-slate-300">{url}</p>
				<div className="mt-2 flex items-center gap-3">
					<span className={`text-5xl font-extrabold tabular-nums ${styles.text}`}>{score.toFixed(1)}</span>
					<span className="text-lg text-slate-400">/ {maxScore}점</span>
					<span className={`rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}>{statusLabel}</span>
				</div>
			</div>

			<div className="relative flex h-28 w-28 items-center justify-center">
				<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
					<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
					<circle
						cx="60"
						cy="60"
						r="52"
						fill="none"
						strokeWidth="12"
						strokeLinecap="round"
						className={styles.text}
						stroke="currentColor"
						strokeDasharray={`${(percent / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
					/>
				</svg>
				<p className="absolute text-xl font-bold text-white">{Math.round(percent)}%</p>
			</div>
		</div>
	);
}
