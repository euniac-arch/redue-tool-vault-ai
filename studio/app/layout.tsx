import type { Metadata } from 'next';
import Script from 'next/script';
import { getServerSession } from 'next-auth';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { ConditionalAppShell } from '@/components/ConditionalAppShell';
import { TopProgressBar } from '@/components/common/TopProgressBar';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { IntlErrorHandlingProvider } from '@/components/IntlErrorHandlingProvider';
import { SchemaJsonLd } from '@/components/SchemaJsonLd';
import {
	REDUE_META_DESCRIPTION_EN,
	REDUE_META_DESCRIPTION_KO,
	REDUE_META_TITLE,
	REDUE_OG_DESCRIPTION_EN,
	REDUE_OG_DESCRIPTION_KO,
	REDUE_OG_IMAGE_ALT,
	REDUE_OG_IMAGE_HEIGHT,
	REDUE_OG_IMAGE_PATH,
	REDUE_OG_IMAGE_WIDTH,
	REDUE_SITE_CANONICAL,
	REDUE_SITE_ORIGIN,
	REDUE_SITE_SCHEMA,
} from '@/lib/schema';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const isEnglish = locale.toLowerCase().startsWith('en');
	const description = isEnglish ? REDUE_META_DESCRIPTION_EN : REDUE_META_DESCRIPTION_KO;
	const cardDescription = isEnglish ? REDUE_OG_DESCRIPTION_EN : REDUE_OG_DESCRIPTION_KO;
	const ogImage = {
		url: REDUE_OG_IMAGE_PATH,
		width: REDUE_OG_IMAGE_WIDTH,
		height: REDUE_OG_IMAGE_HEIGHT,
		alt: REDUE_OG_IMAGE_ALT,
	};

	return {
		metadataBase: new URL(REDUE_SITE_ORIGIN),
		title: REDUE_META_TITLE,
		description,
		alternates: {
			canonical: REDUE_SITE_CANONICAL,
			types: {
				'application/rss+xml': [{ url: '/rss.xml', title: 'REDUE AI SEO & GEO Studio RSS Feed' }],
				'text/plain': [{ url: `${REDUE_SITE_ORIGIN}/llms.txt`, title: 'LLMs Text' }],
			},
		},
		openGraph: {
			type: 'website',
			title: REDUE_META_TITLE,
			description: cardDescription,
			url: REDUE_SITE_CANONICAL,
			siteName: 'RedueGEO',
			locale: isEnglish ? 'en_US' : 'ko_KR',
			images: [ogImage],
		},
		twitter: {
			card: 'summary_large_image',
			title: REDUE_META_TITLE,
			description: cardDescription,
			images: [REDUE_OG_IMAGE_PATH],
		},
		verification: {
			other: {
				'naver-site-verification': 'e6dd5565624e877488bda4ad081771f1e08bd639',
			},
		},
	};
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const [session, locale, messages] = await Promise.all([
		getServerSession(authOptions),
		getLocale(),
		getMessages(),
	]);

	return (
		<html lang={locale} className="dark font-sans antialiased" suppressHydrationWarning>
			<body className="bg-white text-slate-900 antialiased dark:bg-[#0a0d12] dark:text-slate-100">
				<Script
					id="redue-theme-init"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
				/>
				<SchemaJsonLd id="redue-schema-jsonld" config={REDUE_SITE_SCHEMA} />
				
				<NextIntlClientProvider locale={locale} messages={messages}>
					<IntlErrorHandlingProvider>
						<Providers session={session}>
							<ConditionalAppShell>{children}</ConditionalAppShell>
							<TopProgressBar />
							<AnalyticsTracker />
						</Providers>
					</IntlErrorHandlingProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}