import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AsiFeatureView } from '@/components/ai-search-intelligence/AsiFeatureView';
import { resolveAsiRoute } from '@/lib/ai-search-intelligence/routes';

const route = resolveAsiRoute([]);

export async function generateMetadata(): Promise<Metadata> {
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

export default function IntelligenceHomePage() {
	return <AsiFeatureView route={route} />;
}
