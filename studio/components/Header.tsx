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
		const media = window.matchMedia('(min-width: 768px)');
		const onChange = () => {
			if (media.matches) setIsMenuOpen(false);
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

	const closeMenu = () => setIsMenuOpen(false);

	return (
		<header className="print:hidden sticky top-0 z-50 w-full border-b border-zinc-200/60 bg-white/90 backdrop-blur-sm">
			<div className="relative mx-auto flex h-14 w-[90%] max-w-6xl items-center justify-between gap-4 md:h-16">
				{/* Logo */}
				<a href="/" className="relative z-10 flex shrink-0 items-center gap-2.5" onClick={closeMenu}>
					<span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-sm font-bold tracking-tight text-white">
						REDUE
					</span>
					<span className="hidden text-sm font-medium text-zinc-500 sm:inline">{t('tagline')}</span>
				</a>

				{/* Desktop nav */}
				<nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
					{NAV_ITEMS.map((item) => (
						<a
							key={item.href}
							href={item.href}
							className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors duration-200 hover:text-black"
						>
							{t(item.key)}
						</a>
					))}
				</nav>

				{/* Desktop actions */}
				<div className="hidden items-center gap-3 md:flex">
					<LocaleSwitcher variant="light" />
					<HeaderAuth variant="light" />
				</div>

				{/* Mobile hamburger / close */}
				<button
					type="button"
					className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors duration-200 hover:bg-zinc-100 hover:text-black md:hidden"
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
				className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 md:hidden ${
					isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
				}`}
				aria-hidden={!isMenuOpen}
				onClick={closeMenu}
			/>

			{/* Mobile slide-in panel */}
			<div
				id="mobile-nav"
				className={`fixed inset-y-0 right-0 z-50 flex w-[min(100%,20rem)] flex-col bg-white/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${
					isMenuOpen ? 'translate-x-0' : 'translate-x-full'
				}`}
				aria-hidden={!isMenuOpen}
			>
				<div className="flex h-14 items-center justify-between border-b border-zinc-200/60 px-5">
					<span className="text-sm font-semibold text-zinc-900">Menu</span>
					<button
						type="button"
						className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors duration-200 hover:bg-zinc-100 hover:text-black"
						aria-label="Close menu"
						onClick={closeMenu}
					>
						<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
							<path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>

				<nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5" aria-label="Mobile">
					{NAV_ITEMS.map((item) => (
						<a
							key={item.href}
							href={item.href}
							onClick={closeMenu}
							className="rounded-xl px-3 py-3 text-base font-medium text-zinc-700 transition-colors duration-200 hover:bg-zinc-100 hover:text-black"
						>
							{t(item.key)}
						</a>
					))}
				</nav>

				<div className="flex flex-col gap-3 border-t border-zinc-200/60 px-4 py-5">
					<div className="flex justify-start">
						<LocaleSwitcher variant="light" />
					</div>
					<HeaderAuth variant="light" stacked onNavigate={closeMenu} />
				</div>
			</div>
		</header>
	);
}
