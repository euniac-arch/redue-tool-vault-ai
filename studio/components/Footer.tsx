'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const COLUMNS = [
	{
		titleKey: 'cols.solutions',
		links: [
			{ href: '/#audit-hero', key: 'solutions.audit' },
			{ href: '/geo-optimization', key: 'solutions.prescription' },
			{ href: '/geo-optimization', key: 'solutions.schema' },
			{ href: '/geo-optimization', key: 'solutions.faq' },
			{ href: '/llms.txt', key: 'solutions.llms' },
		],
	},
	{
		titleKey: 'cols.plans',
		links: [
			{ href: '/#pricing', key: 'plans.speed' },
			{ href: '/#pricing', key: 'plans.pro' },
			{ href: '/enterprise', key: 'plans.enterprise' },
			{ href: '/audit/history', key: 'plans.reaudit' },
			{ href: '/portfolio', key: 'plans.report' },
		],
	},
	{
		titleKey: 'cols.resources',
		links: [
			{ href: '/#faq', key: 'resources.faq' },
			{ href: '/geo-optimization', key: 'resources.guide' },
			{ href: '/geo-optimization', key: 'resources.eeat' },
			{ href: '/#pricing', key: 'resources.sim' },
			{ href: '/audit/history', key: 'resources.status' },
		],
	},
	{
		titleKey: 'cols.agents',
		links: [
			{ href: '/geo-optimization', key: 'agents.gpt' },
			{ href: '/geo-optimization', key: 'agents.perplexity' },
			{ href: '/geo-optimization', key: 'agents.claude' },
			{ href: '/geo-optimization', key: 'agents.google' },
			{ href: '/geo-optimization', key: 'agents.naver' },
		],
	},
] as const;

export function Footer({ clearFloatingBar = false }: { clearFloatingBar?: boolean }) {
	const t = useTranslations('landing.footer');

	return (
		<footer
			id="site-footer"
			className={`site-footer print:hidden mt-auto w-full border-t border-slate-200 bg-white pt-12 pb-28 text-xs leading-relaxed text-slate-600 sm:pt-16 sm:pb-36 sm:text-sm dark:border-slate-800/80 dark:bg-[#070B14] dark:text-slate-400${
				clearFloatingBar ? ' site-footer--clear-floating-bar' : ''
			}`}
			aria-label={t('ariaLabel')}
		>
			<div className="mx-auto max-w-[960px] px-4 sm:px-6">
				<div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-8 sm:flex-row sm:items-center dark:border-slate-800/70">
					<div>
						<p className="text-base font-black tracking-tight text-slate-900 sm:text-lg dark:text-white">{t('brandFull')}</p>
						<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('slogan')}</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Link
							href="/llms.txt"
							className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-700 transition-all hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/20"
						>
							{t('llmsCta')}
						</Link>
						<Link
							href="/#audit-hero"
							className="rounded-lg border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs text-white transition-all hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
						>
							{t('auditCta')}
						</Link>
					</div>
				</div>

				<nav className="grid grid-cols-2 gap-8 py-4 md:grid-cols-4" aria-label={t('sitemapAria')}>
					{COLUMNS.map((col) => (
						<div key={col.titleKey}>
							<p className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t(col.titleKey)}</p>
							<ul className="mt-3 space-y-1">
								{col.links.map((link) => (
									<li key={link.key}>
										<Link href={link.href} className="inline-block py-1 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
											{t(link.key)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div
					itemScope
					itemType="https://schema.org/Organization"
					className="mt-4 border-t border-slate-200 pt-8 text-xs leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-500"
				>
					<meta itemProp="url" content="https://redue.kr" />
					<p>
						<span className="text-slate-500 dark:text-slate-400">{t('legal.nameLabel')}</span>{' '}
						<strong itemProp="name" className="font-semibold text-slate-800 dark:text-slate-300">
							{t('legal.name')}
						</strong>
						<span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden>
							|
						</span>
						<span className="text-slate-500 dark:text-slate-400">{t('legal.ceoLabel')}</span>{' '}
						<span className="text-slate-800 dark:text-slate-300">{t('legal.ceo')}</span>
						<span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden>
							|
						</span>
						<span className="text-slate-500 dark:text-slate-400">{t('legal.bizNoLabel')}</span>{' '}
						<span className="text-slate-800 dark:text-slate-300">{t('legal.bizNo')}</span>
					</p>
					<p className="mt-1.5">
						<span className="text-slate-500 dark:text-slate-400">{t('legal.mailOrderLabel')}</span>{' '}
						<span className="text-slate-800 dark:text-slate-300">{t('legal.mailOrder')}</span>
						<span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden>
							|
						</span>
						<span className="text-slate-500 dark:text-slate-400">{t('legal.emailLabel')}</span>{' '}
						<a itemProp="email" href="mailto:contact@redue.kr" className="text-slate-800 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
							{t('legal.email')}
						</a>
					</p>
					<p className="mt-1.5">
						<span className="text-slate-500 dark:text-slate-400">{t('legal.phoneLabel')}</span>{' '}
						<a itemProp="telephone" href="tel:01032109801" className="text-slate-800 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
							{t('legal.phone')}
						</a>
						<span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden>
							|
						</span>
						<span className="text-slate-800 dark:text-slate-300">{t('legal.hours')}</span>
					</p>
					<p className="mt-1.5" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
						<span className="text-slate-500 dark:text-slate-400">{t('legal.addressLabel')}</span>{' '}
						<span itemProp="addressLocality" className="text-slate-800 dark:text-slate-300">
							{t('legal.address')}
						</span>
					</p>
					<p className="mt-1.5 text-slate-500 dark:text-slate-600">{t('legal.stack')}</p>
				</div>

				<div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-[11px] text-slate-500 sm:flex-row dark:border-slate-900 dark:text-slate-600">
					<div className="flex flex-col items-center gap-2 sm:items-start">
						<p>{t('copyright')}</p>
						<p className="mt-2 text-[10.5px] text-slate-500">{t('trademarkNotice')}</p>
						<nav className="flex flex-wrap items-center gap-x-2" aria-label={t('legalNavAria')}>
							<Link href="/terms" className="py-1 hover:text-slate-900 dark:hover:text-slate-300">
								{t('links.terms')}
							</Link>
							<span aria-hidden>·</span>
							<Link href="/privacy" className="py-1 hover:text-slate-900 dark:hover:text-slate-300">
								{t('links.privacy')}
							</Link>
							<span aria-hidden>·</span>
							<Link href="/terms" className="py-1 hover:text-slate-900 dark:hover:text-slate-300">
								{t('links.refund')}
							</Link>
						</nav>
					</div>
					<p className="max-w-md text-center sm:text-right">{t('disclaimer')}</p>
				</div>
			</div>
		</footer>
	);
}
