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
