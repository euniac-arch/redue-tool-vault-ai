'use client';

import type { ReactNode } from 'react';
import { GeoSubMetricGrid, type SubMetricItem } from '@/components/audit/GeoSubMetricGrid';
import type { GeoSubItem } from '@/lib/audit/geoScoreCalculator';

const UNREGISTERED_ITEM_IDS = new Set(['bing_places_signal']);
const MISSING_ITEM_IDS = new Set(['llms_txt_presence']);

function toSubMetricItem(item: GeoSubItem): SubMetricItem {
	const statusText: SubMetricItem['statusText'] =
		item.score === 0 && UNREGISTERED_ITEM_IDS.has(item.id)
			? '미등록'
			: item.score === 0 && MISSING_ITEM_IDS.has(item.id)
				? '미구비'
				: undefined;

	return {
		id: item.id,
		name: item.name,
		score: item.score,
		maxScore: item.maxScore,
		evidence: item.evidence ?? '',
		statusText,
	};
}

export function GeoPillarItemList({
	items,
	columns,
	evidenceWrap,
	trailing,
}: {
	items: readonly GeoSubItem[];
	columns?: 2 | 3;
	evidenceWrap?: boolean;
	trailing?: ReactNode;
}) {
	return (
		<GeoSubMetricGrid
			items={items.map(toSubMetricItem)}
			columns={columns}
			evidenceWrap={evidenceWrap}
			trailing={trailing}
		/>
	);
}
