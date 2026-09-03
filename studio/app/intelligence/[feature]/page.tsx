import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AsiFeatureView } from '@/components/ai-search-intelligence/AsiFeatureView';
import { ASI_FEATURES, isAsiFeatureSlug, resolveAsiRoute } from '@/lib/ai-search-intelligence/routes';

type FeaturePageProps = {
	params: { feature: string };
};

export function generateStaticParams() {
	return ASI_FEATURES.map((tool) => ({ feature: tool.slug }));
}

export async function generateMetadata({ params }: FeaturePageProps): Promise<Metadata> {
	const route = resolveAsiRoute([params.feature]);
	const t = await getTranslations('intelligence');
	const tool = t(route.tool.titleKey);
	const product = t('productName');
	const title = `${tool} | ${product} | REDUE`;
	return {
		title,
		description: t(route.tool.summaryKey),
		robots: { index: false, follow: false },
		openGraph: { title, description: t(route.tool.summaryKey) },
	};
}

export default function IntelligenceFeaturePage({ params }: FeaturePageProps) {
	const route = resolveAsiRoute([params.feature]);
	if (route.redirectTo) {
		redirect(route.redirectTo);
	}
	if (!isAsiFeatureSlug(params.feature)) {
		notFound();
	}
	return <AsiFeatureView route={route} />;
}
