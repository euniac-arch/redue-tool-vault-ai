import type { Metadata } from 'next';
import Script from 'next/script';
import { getServerSession } from 'next-auth';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { ConditionalAppShell } from '@/components/ConditionalAppShell';
import { IntlErrorHandlingProvider } from '@/components/IntlErrorHandlingProvider';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('nav');
	return {
		title: 'REDUE AI SEO & GEO Studio',
		description: t('tagline'),
			alternates: { canonical: 'https://redue-tool-vault-ai.vercel.app' },
		openGraph: {
			type: 'website',
			title: 'REDUE AI SEO & GEO Studio',
			description: 'AI 기반 SEO & GEO 자동 주입',
			url: 'https://redue-tool-vault-ai.vercel.app',
			siteName: 'REDUE AI SEO & GEO Studio',
		},
		twitter: {
			card: 'summary_large_image',
			title: 'REDUE AI SEO & GEO Studio',
			description: 'AI 기반 SEO & GEO 자동 주입',
		},
	};
}

const redueJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://redue-tool-vault-ai.vercel.app/#website",
      "url": "https://redue-tool-vault-ai.vercel.app",
      "name": "REDUE AI SEO & GEO Studio",
      "description": "AI 기반 SEO & GEO 자동 주입",
      "inLanguage": "ko-KR"
    },
    {
      "@type": "Organization",
      "@id": "https://redue-tool-vault-ai.vercel.app/#organization",
      "name": "REDUE AI SEO & GEO Studio",
      "url": "https://redue-tool-vault-ai.vercel.app",
      "logo": "https://redue-tool-vault-ai.vercel.app/web/upload/logo.png"
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://redue-tool-vault-ai.vercel.app/#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "홈",
          "item": "https://redue-tool-vault-ai.vercel.app"
        }
      ]
    }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const [session, locale, messages] = await Promise.all([
		getServerSession(authOptions),
		getLocale(),
		getMessages(),
	]);

	return (
		<html lang={locale} className="font-sans antialiased" suppressHydrationWarning>
			<body className="bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-[#0a0d12] dark:text-slate-100">
				<Script
					id="redue-theme-init"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
				/>
				<Script
        id="redue-schema-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(redueJsonLd) }}
      />
				
				<NextIntlClientProvider locale={locale} messages={messages}>
					<IntlErrorHandlingProvider>
						<Providers session={session}>
							<ConditionalAppShell>{children}</ConditionalAppShell>
						</Providers>
					</IntlErrorHandlingProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}