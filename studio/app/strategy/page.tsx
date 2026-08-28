import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { StrategyStudioPageClient } from '@/components/strategy/StrategyStudioPageClient';
import { PageListLoader } from '@/components/ui/PageListLoader';

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('strategyStudio');
	const title = `${t('pageTitle')} | REDUE`;
	return {
		title,
		description: t('pageDescription'),
		robots: { index: false, follow: false },
		openGraph: {
			title,
			description: t('pageDescription'),
		},
	};
}

export default async function StrategyStudioPage() {
	const t = await getTranslations('strategyStudio');
	return (
		<Suspense fallback={<PageListLoader label={t('pageTitle')} />}>
			<StrategyStudioPageClient />
		</Suspense>
	);
}
