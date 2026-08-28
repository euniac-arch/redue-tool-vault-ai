import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuditEnginePageClient } from '@/components/audit/AuditEnginePageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export const metadata: Metadata = {
	title: '진단 엔진 | REDUE',
	description: '실시간 SEO · GEO · AEO 진단과 진단 내역을 한 화면에서 확인합니다.',
};

export default function AuditEnginePage() {
	return (
		<Suspense fallback={<PageListLoader label="진단 엔진" />}>
			<AuditEnginePageClient />
		</Suspense>
	);
}
