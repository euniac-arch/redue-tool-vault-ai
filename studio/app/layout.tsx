import type { Metadata } from 'next';
import Script from 'next/script';
import { getServerSession } from 'next-auth';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { HeaderAuth } from '@/components/HeaderAuth';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
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
	const [session, locale, messages, t] = await Promise.all([
		getServerSession(authOptions),
		getLocale(),
		getMessages(),
		getTranslations('nav'),
	]);

	return (
		<html lang={locale}>
			<body>
				<Script
        id="redue-schema-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(redueJsonLd) }}
      />
				
				<NextIntlClientProvider locale={locale} messages={messages}>
					<Providers session={session}>
						<div className="min-h-screen py-10">
							<header className="relative mx-auto mb-10 grid w-[90%] grid-cols-[1fr_auto_1fr] items-center gap-4">
								<a href="/" className="flex items-center gap-2 justify-self-start">
									<span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">REDUE</span>
									<span className="text-sm font-semibold text-slate-300">{t('tagline')}</span>
								</a>
								<nav className="flex items-center justify-center gap-5 text-sm font-semibold text-slate-400">
									<a href="/" className="hover:text-white">
										{t('scanner')}
									</a>
									<a href="/portfolio" className="hover:text-white">
										{t('portfolio')}
									</a>
									<a href="/enterprise" className="hover:text-white">
										{t('enterprise')}
									</a>
									<a href="/reseller" className="hover:text-white">
										{t('reseller')}
									</a>
									<a href="/builder/wp-plugin" className="hover:text-white">
										{t('wpPlugin')}
									</a>
								</nav>
								<div className="flex items-center justify-end gap-4 justify-self-end">
									<LocaleSwitcher />
									<HeaderAuth />
								</div>
							</header>
							<div className="mx-auto max-w-5xl px-6">{children}</div>
						</div>
					</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}