import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InsightsHubPageClient } from '@/components/insights/InsightsHubPageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export const metadata: Metadata = {
	title: '인사이트 & AI 허브 | REDUE',
	description:
		'AEO · GEO 가이드, 글로벌 AI 도구, AI 프롬프트 허브, AI GEO & Schema 글로벌 뉴스를 한 화면에서 확인합니다.',
};

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
	return (
		<Suspense fallback={<PageListLoader label="인사이트 & AI 허브" />}>
			<InsightsHubPageClient />
		</Suspense>
	);
}
