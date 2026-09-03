import type { Metadata } from 'next';
import { GuideViewerClient } from '@/components/guide/GuideViewerClient';
import { NINEONE_GUIDE_SAMPLE } from '@/lib/guide/sample';

type GuidePageProps = {
	params: { slug: string };
};

export function generateMetadata({ params }: GuidePageProps): Metadata {
	const slug = params.slug?.trim().toLowerCase() || '';
	const sample = slug === NINEONE_GUIDE_SAMPLE.slug ? NINEONE_GUIDE_SAMPLE : null;
	const brand = sample?.brandName || slug || '브랜드';
	return {
		title: `${brand} AI/SEO 실행 가이드 | REDUE`,
		description: `${brand} 맞춤형 AI(GEO)·검색엔진·유튜브 & SNS 통합 상위노출 가이드`,
		robots: { index: false, follow: false },
	};
}

export default function PublicGuidePage({ params }: GuidePageProps) {
	const slug = params.slug?.trim().toLowerCase() || '';
	return <GuideViewerClient slug={slug} />;
}
