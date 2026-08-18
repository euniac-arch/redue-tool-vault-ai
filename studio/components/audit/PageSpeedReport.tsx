'use client';

import {
	PageSpeedPrecisionPanel,
	type PageSpeedStrategy,
} from '@/components/audit/PageSpeedPrecisionPanel';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';

export type { PageSpeedStrategy };

export interface PageSpeedReportProps {
	snapshot?: PageSpeedSnapshot | null;
	desktopData?: PageSpeedSnapshot | null;
	mobileData?: PageSpeedSnapshot | null;
	loading: boolean;
	error: string | null;
	strategy?: PageSpeedStrategy;
	onStrategyChange?: (strategy: PageSpeedStrategy) => void;
	targetUrl?: string;
}

/**
 * PageSpeed Insights panel with PC/Mobile snapshot isolation.
 * Desktop and mobile payloads never mix; empty metric cells stay hidden
 * instead of rendering an em dash.
 */
export function PageSpeedReport({
	snapshot,
	desktopData,
	mobileData,
	loading,
	error,
	strategy = 'desktop',
	onStrategyChange,
	targetUrl,
}: PageSpeedReportProps) {
	const isolatedDesktop = desktopData?.strategy === 'desktop' ? desktopData : null;
	const isolatedMobile = mobileData?.strategy === 'mobile' ? mobileData : null;
	const isolatedSnapshot = snapshot?.strategy === strategy ? snapshot : null;

	return (
		<PageSpeedPrecisionPanel
			snapshot={isolatedSnapshot}
			desktopData={isolatedDesktop}
			mobileData={isolatedMobile}
			loading={loading}
			error={error}
			strategy={strategy}
			onStrategyChange={onStrategyChange}
			targetUrl={targetUrl}
		/>
	);
}
