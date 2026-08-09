/* REDUE SEO/GEO/Schema Universal Master — Next.js App Router */
import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: {
    default: 'REDUE AI SEO & GEO Studio',
    template: '%s | REDUE AI SEO & GEO Studio',
  },
  description: 'REDUE AI SEO & GEO Studio — redue-tool-vault-ai.vercel.app 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 한곳에서 확인하고, 검색·공유에 최적화된 콘텐츠를 지금 바로 만나보세요.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://redue-tool-vault-ai.vercel.app/' },
  openGraph: {
    type: 'website',
    title: 'REDUE AI SEO & GEO Studio',
    description: 'REDUE AI SEO & GEO Studio — redue-tool-vault-ai.vercel.app 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 한곳에서 확인하고, 검색·공유에 최적화된 콘텐츠를 지금 바로 만나보세요.',
    url: 'https://redue-tool-vault-ai.vercel.app/',
    siteName: 'REDUE AI SEO & GEO Studio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'REDUE AI SEO & GEO Studio',
    description: 'REDUE AI SEO & GEO Studio — redue-tool-vault-ai.vercel.app 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 한곳에서 확인하고, 검색·공유에 최적화된 콘텐츠를 지금 바로 만나보세요.',
  },
};

const redueJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://redue-tool-vault-ai.vercel.app//#website',
      url: 'https://redue-tool-vault-ai.vercel.app/',
      name: 'REDUE AI SEO & GEO Studio',
      description: 'REDUE AI SEO & GEO Studio — redue-tool-vault-ai.vercel.app 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 한곳에서 확인하고, 검색·공유에 최적화된 콘텐츠를 지금 바로 만나보세요.',
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'Organization',
      '@id': 'https://redue-tool-vault-ai.vercel.app//#organization',
      name: 'REDUE AI SEO & GEO Studio',
      url: 'https://redue-tool-vault-ai.vercel.app/',
    },
    {
      '@type': 'WebPage',
      '@id': 'https://redue-tool-vault-ai.vercel.app//#webpage',
      url: 'https://redue-tool-vault-ai.vercel.app/',
      name: 'REDUE AI SEO & GEO Studio',
      description: 'REDUE AI SEO & GEO Studio — redue-tool-vault-ai.vercel.app 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 한곳에서 확인하고, 검색·공유에 최적화된 콘텐츠를 지금 바로 만나보세요.',
      isPartOf: { '@id': 'https://redue-tool-vault-ai.vercel.app//#website' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://redue-tool-vault-ai.vercel.app/' },
      ],
    },
  ],
};

/** layout.tsx 본문에 <RedueJsonLd /> 를 포함하세요 — 하위 페이지 metadata generateMetadata 로 덮어쓰기 가능 */
export function RedueJsonLd() {
  return (
    <Script
      id="redue-schema-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(redueJsonLd) }}
    />
  );
}

// Next.js App Router — app/page.tsx
export default function Page() {
  return (
    <main>
      <h1>REDUE AI SEO & GEO Studio</h1>
    </main>
  );
}

이것은 TypeScript/Next.js의 `layout.tsx` 파일이며, HTML이 아닌 React 컴포넌트 코드입니다. 

파일 내용을 검토한 결과:
- HTML 구조는 완전합니다 (`<html>`, `<body>` 태그 모두 존재)
- JSX 마크업 문법이 올바릅니다
- 손상되거나 깨진 부분이 없습니다

따라서 복원이 필요 없으며, 원본 그대로 반환합니다:

```typescript
import type { Metadata } from 'next';
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
	};
}

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
```