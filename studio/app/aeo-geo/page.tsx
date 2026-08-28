import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InsightsHubPageClient } from '@/components/insights/InsightsHubPageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export const metadata: Metadata = {
	title: 'AEO · GEO 최적화 | REDUE',
	description:
		'ChatGPT · Perplexity · Gemini · Claude 등 주요 생성형 AI와 답변 엔진이 사이트를 정확히 식별하고 공식 정답 출처(Source)로 채택하도록 SEO · AEO · GEO · Schema 구조를 정밀 최적화합니다.',
};

export default function AeoGeoPage() {
	return (
		<Suspense fallback={<PageListLoader label="AEO · GEO" />}>
			<InsightsHubPageClient />
		</Suspense>
	);
}
