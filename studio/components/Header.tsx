'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HeaderAuth } from './HeaderAuth';
import { LocaleSwitcher } from './LocaleSwitcher';

const NAV_ITEMS = [
	{ href: '/', key: 'scanner' as const },
	{ href: '/audit/history', key: 'auditHistory' as const },
	{ href: '/portfolio', key: 'portfolio' as const },
	{ href: '/enterprise', key: 'enterprise' as const },
	{ href: '/reseller', key: 'reseller' as const },
	{ href: '/builder/wp-plugin', key: 'wpPlugin' as const },
] as const;

/** Desktop nav shows at this width and above; hamburger below it. */
const DESKTOP_NAV_MIN = 1100;

export function Header() {
	const t = useTranslations('nav');
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	useEffect(() => {
		if (!isMenuOpen) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsMenuOpen(false);
		};

		document.addEventListener('keydown', onKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousOverflow;
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
		<header className="print:hidden relative z-50 mb-10 w-full">
			{/* Top bar — original brand styles (no grey/white chrome) */}
			<div className="relative mx-auto flex w-[90%] max-w-6xl items-center justify-between gap-4">
				<a href="/" className="relative z-10 flex shrink-0 items-center gap-2" onClick={closeMenu}>
					<span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">REDUE</span>
					<span className="hidden text-sm font-semibold text-slate-300 sm:inline">{t('tagline')}</span>
				</a>

				<nav
					className="hidden items-center gap-5 text-sm font-semibold text-slate-400 min-[1100px]:flex"
					aria-label="Primary"
				>
					{NAV_ITEMS.map((item) => (
						<a key={item.href} href={item.href} className="transition-colors hover:text-white">
							{t(item.key)}
						</a>
					))}
				</nav>

				<div className="hidden items-center gap-4 min-[1100px]:flex">
					<LocaleSwitcher />
					<HeaderAuth />
				</div>

				<button
					type="button"
					className="relative z-10 flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors duration-300 hover:bg-white/5 hover:text-white min-[1100px]:hidden"
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

			{/* Mobile overlay */}
			<div
				className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 min-[1100px]:hidden ${
					isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
				}`}
				aria-hidden={!isMenuOpen}
				onClick={closeMenu}
			/>

			{/* Mobile slide-in panel — dark page-matching surface */}
			<div
				id="mobile-nav"
				className={`fixed inset-y-0 right-0 z-50 flex w-[min(100%,20rem)] flex-col border-l border-white/[0.08] bg-[#0C0D0E]/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out min-[1100px]:hidden ${
					isMenuOpen ? 'translate-x-0' : 'translate-x-full'
				}`}
				aria-hidden={!isMenuOpen}
			>
				<div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-5">
					<span className="text-sm font-semibold text-slate-200">Menu</span>
					<button
						type="button"
						className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
						aria-label="Close menu"
						onClick={closeMenu}
					>
						<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
							<path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>

				<nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
					{NAV_ITEMS.map((item) => (
						<a
							key={item.href}
							href={item.href}
							onClick={closeMenu}
							className="rounded-lg px-3 py-3 text-base font-semibold text-slate-300 transition-colors duration-300 hover:bg-white/5 hover:text-white"
						>
							{t(item.key)}
						</a>
					))}
				</nav>

				<div className="flex flex-col gap-3 border-t border-white/[0.08] px-4 py-5">
					<div className="flex justify-start">
						<LocaleSwitcher />
					</div>
					<HeaderAuth stacked onNavigate={closeMenu} />
				</div>
			</div>
		</header>
	);
}
