'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import type { TrackingStatus } from '@/lib/audit/domain-tracking';

interface TrackingStatusBadgeProps {
	status?: TrackingStatus | null;
	daysUntilNext?: number | null;
	expectedScore?: number | null;
	compact?: boolean;
}

const STATUS_CLASS: Record<TrackingStatus, string> = {
	SYNCING:
		'bg-amber-50 text-amber-800 ring-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/35',
	PENDING_INDEX:
		'bg-sky-50 text-sky-800 ring-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/35',
	TRACKING:
		'bg-indigo-50 text-indigo-800 ring-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/35',
};

function TrackingStatusBadgeInner({
	status,
	daysUntilNext,
	expectedScore,
	compact = false,
}: TrackingStatusBadgeProps) {
	const t = useTranslations('audit.trackingStatus');
	if (!status) return null;

	return (
		<div className={`inline-flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mt-2'}`}>
			<span
				className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${STATUS_CLASS[status]}`}
			>
				{status === 'SYNCING' ? '⏳ ' : status === 'PENDING_INDEX' ? '📡 ' : '🔎 '}
				{t(status)}
			</span>
			{daysUntilNext != null ? (
				<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
					{daysUntilNext > 0 ? t('nextMeasurement', { days: daysUntilNext }) : t('nextMeasurementDue')}
				</span>
			) : null}
			{expectedScore != null && Number.isFinite(expectedScore) ? (
				<span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
					{t('expectedScore', { score: expectedScore })}
					{compact ? null : <span className="ml-1 font-medium text-slate-400">{t('expectedScoreHint')}</span>}
				</span>
			) : null}
		</div>
	);
}

export const TrackingStatusBadge = memo(TrackingStatusBadgeInner);
