import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InsightsHubPageClient } from '@/components/insights/InsightsHubPageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export const metadata: Metadata = {
	title: 'AI 프롬프트 허브 | REDUE',
	description:
		'SEO · GEO · AEO · Entity · Schema · Local 작업에 바로 사용할 수 있는 실전 AI 프롬프트 모음. AI에게 무엇을 시킬지 공개 템플릿으로 제공합니다.',
};

export const dynamic = 'force-dynamic';

export default function PromptHubPage() {
	return (
		<Suspense fallback={<PageListLoader label="AI 프롬프트 허브" />}>
			<InsightsHubPageClient />
		</Suspense>
	);
}
