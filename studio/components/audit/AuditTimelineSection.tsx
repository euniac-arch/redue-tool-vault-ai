'use client';

import { Component, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { AuditReport } from '@/lib/site-auditor';
import { ActualAuditHistoryTracker } from '@/components/audit/ActualAuditHistoryTracker';
import { TimelineRankForecastDashboard } from '@/components/audit/TimelineRankForecastDashboard';

class TimelinePanelBoundary extends Component<
	{ children: ReactNode; fallback: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };

	static getDerivedStateFromError(): { hasError: boolean } {
		return { hasError: true };
	}

	render() {
		return this.state.hasError ? this.props.fallback : this.props.children;
	}
}

type TimelineMode = 'history' | 'forecast';

interface AuditTimelineSectionProps {
	report: AuditReport;
	reportId?: string | null;
	publicView?: boolean;
}

export function AuditTimelineSection({
	report,
	reportId,
	publicView = false,
}: AuditTimelineSectionProps) {
	const t = useTranslations('audit.historyTracker');
	const [mode, setMode] = useState<TimelineMode>('history');

	return (
		<section
			id="ai-timeline-forecast"
			className="print:hidden pdf-screen-only scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/40"
			aria-labelledby={mode === 'history' ? 'audit-history-tracker-title' : 'ai-timeline-forecast-title'}
		>
			<nav
				className="mb-5 grid w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 dark:border-slate-800 dark:bg-slate-950/40"
				aria-label={t('modeNav')}
			>
				{(
					[
						{ id: 'history' as const, label: t('tabHistory') },
						{ id: 'forecast' as const, label: t('tabForecast') },
					] as const
				).map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setMode(item.id)}
						aria-pressed={mode === item.id}
						className={`w-full rounded-lg px-3.5 py-2 text-center text-sm font-bold transition ${
							mode === item.id
								? 'bg-slate-900 text-white shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-slate-200'
						}`}
					>
						{item.label}
					</button>
				))}
			</nav>

			{mode === 'history' ? (
				<TimelinePanelBoundary
					fallback={
						<p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
							{t('loadError')}
						</p>
					}
				>
					<ActualAuditHistoryTracker report={report} reportId={reportId} publicView={publicView} />
				</TimelinePanelBoundary>
			) : (
				<TimelineRankForecastDashboard embedded />
			)}
		</section>
	);
}
