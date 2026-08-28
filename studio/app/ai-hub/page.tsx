import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InsightsHubPageClient } from '@/components/insights/InsightsHubPageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export const metadata: Metadata = {
	title: '글로벌 AI 도구 | REDUE',
	description:
		'ChatGPT, Claude, Midjourney, Runway 등 지금 가장 많이 쓰이는 글로벌 AI 도구를 카테고리별로 비교하고 요금제와 활용 가이드를 확인하세요.',
};

export const dynamic = 'force-dynamic';

export default function AiHubPage() {
	return (
		<Suspense fallback={<PageListLoader label="글로벌 AI 도구" />}>
			<InsightsHubPageClient />
		</Suspense>
	);
}
