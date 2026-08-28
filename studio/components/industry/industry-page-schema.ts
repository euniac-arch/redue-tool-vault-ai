import { REDUE_SITE_ORIGIN } from '@/lib/schema';
import { INDUSTRY_FAQS, PAGE_COPY, tx, type IndustryPageLang } from './industry-page-data';

export const INDUSTRY_PAGE_PATH = '/industry';

export function industryPageUrl(): string {
	return `${REDUE_SITE_ORIGIN}${INDUSTRY_PAGE_PATH}`;
}

export function buildIndustryPageJsonLd(lang: IndustryPageLang) {
	const pageUrl = industryPageUrl();
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${pageUrl}#webpage`,
				url: pageUrl,
				name: tx(lang, PAGE_COPY.metaTitle),
				description: tx(lang, PAGE_COPY.metaDescription),
				inLanguage: lang === 'en' ? 'en-US' : 'ko-KR',
				isPartOf: { '@id': `${REDUE_SITE_ORIGIN}/#website` },
				about: [
					{ '@type': 'Thing', name: 'REDUE' },
					{ '@type': 'Thing', name: 'SEO' },
					{ '@type': 'Thing', name: 'GEO' },
					{ '@type': 'Thing', name: 'AEO' },
					{ '@type': 'Thing', name: 'Industry Strategy' },
				],
				mentions: [
					{ '@type': 'Thing', name: 'Industry Profile' },
					{ '@type': 'Thing', name: 'Entity' },
					{ '@type': 'Thing', name: 'Search Intent' },
					{ '@type': 'Thing', name: 'Local' },
					{ '@type': 'Thing', name: 'Trust' },
					{ '@type': 'Thing', name: 'Content' },
				],
				breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${pageUrl}#breadcrumb`,
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: tx(lang, PAGE_COPY.breadcrumbHome),
						item: `${REDUE_SITE_ORIGIN}/`,
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: tx(lang, PAGE_COPY.breadcrumbCurrent),
						item: pageUrl,
					},
				],
			},
			{
				'@type': 'FAQPage',
				'@id': `${pageUrl}#faq`,
				mainEntity: INDUSTRY_FAQS.map((item) => ({
					'@type': 'Question',
					name: tx(lang, item.q),
					acceptedAnswer: {
						'@type': 'Answer',
						text: tx(lang, item.a),
					},
				})),
			},
		],
	};
}
