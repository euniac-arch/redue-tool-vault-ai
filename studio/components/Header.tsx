'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HeaderAuth } from './HeaderAuth';
import { LocaleSwitcher } from './LocaleSwitcher';

const NAV_ITEMS = [
	{ href: '/audit', key: 'scanner' as const },
	{ href: '/audit/history', key: 'auditHistory' as const },
	{ href: '/geo-optimization', key: 'geoOptimization' as const },
	{ href: '/portfolio', key: 'portfolio' as const },
	{ href: '/contact', key: 'contact' as const },
] as const;

/** Desktop nav shows at this width and above; hamburger below it. */
const DESKTOP_NAV_MIN = 1100;

function isNavActive(pathname: string, href: string): boolean {
	if (href === '/audit') {
		// Scanner lives at `/` today; `/audit` redirects there. Exclude history/result siblings.
		return pathname === '/' || pathname === '/audit' || pathname.startsWith('/audit/result');
	}
	if (href === '/audit/history') {
		return pathname === '/audit/history' || pathname.startsWith('/audit/history/');
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean, variant: 'desktop' | 'mobile'): string {
	if (variant === 'desktop') {
		return active
			? 'text-accent-light border-b-2 border-accent pb-0.5 transition-colors hover:text-accent-light'
			: 'border-b-2 border-transparent pb-0.5 transition-colors hover:text-white';
	}
	return active
		? 'rounded-lg bg-accent/15 px-3 py-3 text-base font-semibold text-accent-light transition-colors duration-300'
		: 'rounded-lg px-3 py-3 text-base font-semibold text-slate-300 transition-colors duration-300 hover:bg-white/5 hover:text-white';
}

function AdminEntryLink({
	onNavigate,
	className,
}: {
	onNavigate?: () => void;
	className?: string;
}) {
	const t = useTranslations('nav');

	return (
		<a
			href="/admin"
			onClick={onNavigate}
			className={
				className ??
				'inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent-light transition-colors hover:bg-accent/20'
			}
			title={t('admin')}
		>
			<span aria-hidden>🚀</span>
			<span>{t('adminButton')}</span>
		</a>
	);
}

export function Header() {
	const t = useTranslations('nav');
	const pathname = usePathname() ?? '/';
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	useEffect(() => {
		if (!isMenuOpen) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsMenuOpen(false);
		};

		document.addEventListener('keydown', onKeyDown);

		const previousBodyOverflow = document.body.style.overflow;
		const previousHtmlOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	}, [isMenuOpen]);

	useEffect(() => {
		const media = window.matchMedia(`(min-width: ${DESKTOP_NAV_MIN}px)`);
		const onChange = () => {
			if (media.matches) setIsMenuOpen(false);
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

	const closeMenu = () => setIsMenuOpen(false);

	return (
		<header
			className={`print:hidden sticky top-0 w-full shrink-0 border-b border-white/[0.08] bg-[#0C0D0E]/95 backdrop-blur-md ${
				isMenuOpen ? 'z-[9999]' : 'z-30'
			}`}
		>
			{/* 3-column grid: left/right widths can change without shifting the center nav */}
			<div className="relative z-[10000] grid h-14 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-4">
				<Link
					href="/"
					className="relative z-10 col-start-1 flex min-w-0 justify-self-start items-center gap-2"
					onClick={closeMenu}
				>
					<span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">REDUE</span>
					<span className="hidden truncate text-sm font-semibold text-slate-300 min-[320px]:inline">
						{t('tagline')}
					</span>
				</Link>

				<nav
					className="col-start-2 hidden justify-self-center items-center gap-5 text-sm font-semibold text-slate-400 min-[1100px]:flex"
					aria-label="Primary"
				>
					{NAV_ITEMS.map((item) => {
						const active = isNavActive(pathname, item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? 'page' : undefined}
								className={navLinkClass(active, 'desktop')}
							>
								{t(item.key)}
							</Link>
						);
					})}
				</nav>

				<div className="relative z-10 col-start-3 flex min-w-0 justify-self-end items-center gap-1.5 sm:gap-2">
					<div className="hidden items-center gap-1.5 min-[1100px]:flex sm:gap-2">
						<AdminEntryLink />
						<LocaleSwitcher />
						<HeaderAuth />
					</div>

					<button
						type="button"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-slate-300 transition-colors duration-300 hover:bg-white/5 hover:text-white min-[1100px]:hidden"
						aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
						aria-expanded={isMenuOpen}
						aria-controls="mobile-nav"
						onClick={() => setIsMenuOpen((open) => !open)}
					>
						{isMenuOpen ? (
							<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
								<path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
							</svg>
						) : (
							<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
								<path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
							</svg>
						)}
					</button>
				</div>
			</div>

			{/* Full-viewport mobile menu overlay (100dvh) — above share bar / result cards */}
			<div
				id="mobile-nav"
				className={`mobile-menu-overlay min-[1100px]:hidden ${isMenuOpen ? 'is-open' : ''}`}
				aria-hidden={!isMenuOpen}
			>
				<div className="mobile-menu-overlay__inner">
					{/* Spacer matching sticky header so first link isn’t under the bar */}
					<div className="h-14 shrink-0" aria-hidden />

					<nav className="mobile-menu-overlay__nav" aria-label="Mobile">
						{NAV_ITEMS.map((item) => {
							const active = isNavActive(pathname, item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									onClick={closeMenu}
									aria-current={active ? 'page' : undefined}
									className={navLinkClass(active, 'mobile')}
								>
									{t(item.key)}
								</Link>
							);
						})}
					</nav>

					<div className="mobile-menu-overlay__footer">
						<div className="flex flex-wrap items-center gap-2">
							<AdminEntryLink onNavigate={closeMenu} />
							<LocaleSwitcher />
						</div>
						<HeaderAuth stacked onNavigate={closeMenu} />
					</div>
				</div>
			</div>
		</header>
	);
}
