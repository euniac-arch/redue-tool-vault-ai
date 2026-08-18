'use client';

import type { ReactNode } from 'react';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import { GeoPillarItemList } from '@/components/audit/GeoPillarItemList';
import { GeoPillarScoreBadge } from '@/components/audit/GeoPillarScoreBadge';
import type { GeoPillarId } from '@/lib/audit/geoScoreCalculator';

export function GeoMeasuredCardHeader({
	pillarId,
	title,
	subtitle,
	extra,
	showItems = true,
	showAxisLabel = true,
	className,
	columns,
	evidenceWrap,
	trailingItem,
}: {
	pillarId: GeoPillarId;
	title: ReactNode;
	subtitle?: ReactNode;
	extra?: ReactNode;
	showItems?: boolean;
	showAxisLabel?: boolean;
	className?: string;
	columns?: 2 | 3;
	evidenceWrap?: boolean;
	trailingItem?: ReactNode;
}) {
	const pillar = useOptionalAuditData()?.snapshot.geoComprehensive.pillars[pillarId];

	return (
		<div className={`flex flex-col gap-3 ${className ?? ''}`}>
			<div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
				<div className="min-w-0 space-y-1">
					{title}
					{subtitle}
				</div>
				<div className="flex shrink-0 self-start items-center justify-end gap-2">
					{pillar && <GeoPillarScoreBadge pillar={pillar} showAxisLabel={showAxisLabel} />}
					{extra}
				</div>
			</div>
			{showItems && pillar && (
				<GeoPillarItemList
					items={pillar.items}
					columns={columns}
					evidenceWrap={evidenceWrap}
					trailing={trailingItem}
				/>
			)}
		</div>
	);
}
