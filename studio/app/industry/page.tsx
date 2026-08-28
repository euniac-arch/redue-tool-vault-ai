import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { IndustryStrategyPage } from '@/components/industry/IndustryStrategyPage';
import { PAGE_COPY, tx, type IndustryPageLang } from '@/components/industry/industry-page-data';
import { industryPageUrl } from '@/components/industry/industry-page-schema';

function resolveLang(locale: string): IndustryPageLang {
	return locale === 'en' ? 'en' : 'ko';
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const lang = resolveLang(locale);
	const title = tx(lang, PAGE_COPY.metaTitle);
	const description = tx(lang, PAGE_COPY.metaDescription);
	const url = industryPageUrl();

	return {
		title,
		description,
		alternates: { canonical: url },
		robots: { index: true, follow: true },
		openGraph: {
			type: 'website',
			title,
			description,
			url,
			siteName: 'REDUE AI SEO GEO STUDIO',
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
		},
	};
}

export default async function IndustryPage() {
	const locale = await getLocale();
	return <IndustryStrategyPage lang={resolveLang(locale)} />;
}
