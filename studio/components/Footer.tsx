'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * Global site footer (legal / business info).
 * Rendered once by `ConditionalAppShell` for all non-admin pages as a sibling
 * of the main `max-w-5xl px-6` column: the footer itself is full-bleed, while
 * the inner wrapper reuses that same container so content edges line up.
 */
export function Footer({ clearFloatingBar = false }: { clearFloatingBar?: boolean }) {
	const t = useTranslations('audit.reportFooter');

	return (
		<footer
			id="site-footer"
			className={`site-footer print:hidden mt-auto mb-0 w-full border-t border-slate-200 bg-white p-0 text-xs text-slate-600 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400${
				clearFloatingBar ? ' site-footer--clear-floating-bar' : ''
			}`}
			aria-label={t('ariaLabel')}
		>
			{/* Same container as ConditionalAppShell main column (`mx-auto max-w-5xl px-6`).
			    `pt-10` mirrors the Header→content top gap so the content→footer gap is
			    visually symmetric. */}
			<div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-10">
				<div className="flex flex-col gap-10">
					{/* Top — brand */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">
								REDUE
							</span>
							<span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('brandName')}</span>
						</div>
						<p className="text-slate-500">{t('tagline')}</p>
					</div>

					{/* Middle — business info */}
					<div className="footer-info-list flex flex-col gap-2 leading-relaxed">
						<p className="footer-info-row flex flex-wrap gap-x-3 gap-y-1">
							<span>
								<span className="text-slate-500">{t('ceoLabel')}</span>{' '}
								<span className="text-slate-800 dark:text-slate-300">{t('ceo')}</span>
							</span>
							<span className="footer-info-sep text-slate-300 dark:text-white/15" aria-hidden>
								|
							</span>
							<span>
								<span className="text-slate-500">{t('phoneLabel')}</span>{' '}
								<a
									href="tel:01032109801"
									className="text-slate-800 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
								>
									{t('phone')}
								</a>
							</span>
						</p>
						<p className="footer-info-row flex flex-wrap gap-x-3 gap-y-1">
							<span>
								<span className="text-slate-500">{t('bizNoLabel')}</span>{' '}
								<span className="text-slate-800 dark:text-slate-300">{t('bizNo')}</span>
							</span>
							<span className="footer-info-sep text-slate-300 dark:text-white/15" aria-hidden>
								|
							</span>
							<span>
								<span className="text-slate-500">{t('mailOrderLabel')}</span>{' '}
								<span className="text-slate-800 dark:text-slate-300">{t('mailOrder')}</span>
							</span>
						</p>
						<p className="footer-info-row">
							<span className="text-slate-500">{t('addressLabel')}</span>{' '}
							<span className="text-slate-800 dark:text-slate-300">{t('address')}</span>
						</p>
						<p className="footer-info-row">
							<span className="text-slate-500">{t('hoursLabel')}</span>{' '}
							<span className="text-slate-800 dark:text-slate-300">{t('hours')}</span>
						</p>
					</div>

					{/* Bottom — policies & copyright */}
					<div className="footer-bottom flex flex-col gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
						<nav
							className="footer-policy-nav flex flex-wrap items-center gap-x-2 gap-y-1"
							aria-label={t('policiesAria')}
						>
							<Link
								href="/privacy"
								className="font-semibold text-violet-700 transition-colors hover:text-slate-950 dark:text-violet-300 dark:hover:text-white"
							>
								{t('privacy')}
							</Link>
							<span className="text-slate-300 dark:text-white/20" aria-hidden>
								·
							</span>
							<Link
								href="/terms"
								className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
							>
								{t('terms')}
							</Link>
							<span className="text-slate-300 dark:text-white/20" aria-hidden>
								·
							</span>
							<Link
								href="/email-refusal"
								className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
							>
								{t('emailRefusal')}
							</Link>
						</nav>
						<p className="footer-copyright text-slate-500">{t('copyright')}</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
