'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HeaderAuth } from './HeaderAuth';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './theme/ThemeToggle';
import {
	PUBLIC_NAV,
	PUBLIC_NAV_CTA,
	isPublicNavChildActive,
	isPublicNavItemActive,
	type PublicNavItem,
	type PublicNavItemKey,
} from '@/lib/nav/public-nav';

/** Desktop nav shows at this width and above; hamburger below it. */
const DESKTOP_NAV_MIN = 1320;

function navLinkClass(active: boolean, variant: 'desktop' | 'mobile'): string {
	if (variant === 'desktop') {
		return active
			? 'whitespace-nowrap text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm'
			: 'whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';
	}
	return active
		? 'rounded-xl border border-border bg-secondary/40 px-3 py-3 text-base font-semibold text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
		: 'rounded-xl px-3 py-3 text-base font-semibold text-muted-foreground transition-colors duration-200 hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
}

function ctaClass(variant: 'desktop' | 'mobile'): string {
	const base =
		'inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
	return variant === 'desktop' ? `${base} px-4 py-2` : `${base} mt-2 w-full px-4 py-3 text-base`;
}

function HeaderNav({
	variant,
	isMenuOpen,
	openMenu,
	setOpenMenu,
	onNavigate,
}: {
	variant: 'desktop' | 'mobile';
	isMenuOpen: boolean;
	openMenu: PublicNavItemKey | null;
	setOpenMenu: (key: PublicNavItemKey | null) => void;
	onNavigate: () => void;
}) {
	const t = useTranslations('nav');
	const pathname = usePathname() ?? '/';
	const searchParams = useSearchParams();
	const search = `?${searchParams.toString()}`;

	useEffect(() => {
		if (variant !== 'mobile') return;
		setOpenMenu(null);
	}, [pathname, search, setOpenMenu, variant]);

	if (variant === 'desktop') {
		return (
			<nav
				className="hidden flex-nowrap items-center gap-x-8 whitespace-nowrap text-[13px] font-semibold min-[1320px]:flex"
				aria-label="Primary"
			>
				{PUBLIC_NAV.map((item) => (
					<DesktopNavItem
						key={item.key}
						item={item}
						pathname={pathname}
						search={search}
						onNavigate={onNavigate}
						t={t}
					/>
				))}
			</nav>
		);
	}

	if (!isMenuOpen) return null;

	return (
		<nav className="mobile-menu-overlay__nav" aria-label="Mobile">
			{PUBLIC_NAV.map((item) => (
				<MobileNavItem
					key={item.key}
					item={item}
					pathname={pathname}
					search={search}
					open={openMenu === item.key}
					onToggle={() => setOpenMenu(openMenu === item.key ? null : item.key)}
					onNavigate={onNavigate}
					t={t}
				/>
			))}
			<Link href={PUBLIC_NAV_CTA.href} onClick={onNavigate} className={ctaClass('mobile')}>
				{t(PUBLIC_NAV_CTA.key)}
			</Link>
		</nav>
	);
}

function DesktopNavItem({
	item,
	pathname,
	search,
	onNavigate,
	t,
}: {
	item: PublicNavItem;
	pathname: string;
	search: string;
	onNavigate: () => void;
	t: ReturnType<typeof useTranslations>;
}) {
	const [open, setOpen] = useState(false);
	const active = isPublicNavItemActive(pathname, item);
	const children = item.children;
	const menuId = `gnb-${item.key}`;

	useEffect(() => {
		setOpen(false);
	}, [pathname, search]);

	if (!children?.length) {
		return (
			<Link
				href={item.href}
				aria-current={active ? 'page' : undefined}
				onClick={onNavigate}
				className={navLinkClass(active, 'desktop')}
			>
				{t(item.key)}
			</Link>
		);
	}

	return (
		<div
			className={`gnb-item${open ? ' is-open' : ''}`}
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={(event) => {
				if (event.currentTarget.contains(document.activeElement)) return;
				setOpen(false);
			}}
			onFocus={() => setOpen(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setOpen(false);
				}
			}}
			onKeyDown={(event) => {
				if (event.key !== 'Escape') return;
				setOpen(false);
				(event.currentTarget.querySelector<HTMLElement>(':scope > a'))?.focus();
			}}
		>
			<Link
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-expanded={open}
				aria-haspopup="true"
				aria-controls={menuId}
				onClick={onNavigate}
				className={navLinkClass(active, 'desktop')}
			>
				{t(item.key)}
			</Link>
			<div id={menuId} className="gnb-dropdown">
				<div className="rounded-xl border border-cyan-200/80 bg-white/95 p-2 opacity-100 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl dark:border-cyan-800/40 dark:bg-[#0a1626]/95 dark:shadow-cyan-950/50">
					<div className="flex flex-col gap-y-1">
						{children.map((child) => {
							const childActive = isPublicNavChildActive(pathname, search, child);
							return (
								<Link
									key={child.key}
									href={child.href}
									aria-current={childActive ? 'page' : undefined}
									tabIndex={open ? 0 : -1}
									onClick={onNavigate}
									className={`block rounded-lg border px-3.5 py-2 text-[12.35px] font-semibold leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
										childActive
											? 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-600/40 dark:bg-[#13233a] dark:text-cyan-300'
											: 'border-transparent text-slate-600 hover:border-cyan-300/70 hover:bg-cyan-50 hover:text-cyan-700 dark:text-slate-300 dark:hover:border-cyan-700/30 dark:hover:bg-[#13233a] dark:hover:text-cyan-300'
									}`}
								>
									{t(child.key)}
								</Link>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

function MobileNavItem({
	item,
	pathname,
	search,
	open,
	onToggle,
	onNavigate,
	t,
}: {
	item: PublicNavItem;
	pathname: string;
	search: string;
	open: boolean;
	onToggle: () => void;
	onNavigate: () => void;
	t: ReturnType<typeof useTranslations>;
}) {
	const active = isPublicNavItemActive(pathname, item);
	const children = item.children;

	if (!children?.length) {
		return (
			<Link
				href={item.href}
				aria-current={active ? 'page' : undefined}
				onClick={onNavigate}
				className={navLinkClass(active, 'mobile')}
			>
				{t(item.key)}
			</Link>
		);
	}

	return (
		<div className="flex flex-col">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={`gnb-mobile-${item.key}`}
				onClick={onToggle}
				className={`${navLinkClass(active, 'mobile')} flex w-full items-center justify-between gap-2 text-left`}
			>
				<span>{t(item.key)}</span>
				<svg
					viewBox="0 0 24 24"
					className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.75"
					aria-hidden
				>
					<path strokeLinecap="round" d="M6 9l6 6 6-6" />
				</svg>
			</button>
			{open ? (
				<div id={`gnb-mobile-${item.key}`} className="mb-1 ml-3 flex flex-col gap-1 border-l border-border pl-3">
					{children.map((child) => {
						const childActive = isPublicNavChildActive(pathname, search, child);
						return (
							<Link
								key={child.key}
								href={child.href}
								aria-current={childActive ? 'page' : undefined}
								onClick={onNavigate}
								className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
									childActive
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
								}`}
							>
								{t(child.key)}
							</Link>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

export function Header() {
	const t = useTranslations('nav');
	const pathname = usePathname() ?? '/';
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [openMenu, setOpenMenu] = useState<PublicNavItemKey | null>(null);

	useEffect(() => {
		setIsMenuOpen(false);
		setOpenMenu(null);
	}, [pathname]);

	useEffect(() => {
		if (!isMenuOpen && !openMenu) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsMenuOpen(false);
				setOpenMenu(null);
			}
		};

		document.addEventListener('keydown', onKeyDown);

		if (!isMenuOpen) {
			return () => document.removeEventListener('keydown', onKeyDown);
		}

		const previousBodyOverflow = document.body.style.overflow;
		const previousHtmlOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	}, [isMenuOpen, openMenu]);

	useEffect(() => {
		const media = window.matchMedia(`(min-width: ${DESKTOP_NAV_MIN}px)`);
		const onChange = () => {
			if (media.matches) {
				setIsMenuOpen(false);
				setOpenMenu(null);
			}
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

	const closeAll = () => {
		setIsMenuOpen(false);
		setOpenMenu(null);
	};

	return (
		<header
			className={`print:hidden sticky top-0 w-full shrink-0 border-b-0 bg-background/80 backdrop-blur-md ${
				isMenuOpen ? 'z-[9999]' : 'z-50'
			}`}
		>
			<div className="relative z-[10000] flex h-14 w-full items-center justify-between gap-4 px-3 sm:px-4">
				<Link
					href="/"
					className="relative z-10 flex min-w-0 items-center gap-2"
					onClick={closeAll}
				>
					<span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-1 text-sm font-bold text-white">REDUE</span>
					<span className="hidden truncate text-sm font-semibold text-muted-foreground min-[320px]:inline">
						{t('tagline')}
					</span>
				</Link>

				<Suspense fallback={<nav className="hidden min-[1320px]:flex" aria-hidden />}>
					<div className="hidden min-[1320px]:block">
						<HeaderNav
							variant="desktop"
							isMenuOpen={false}
							openMenu={null}
							setOpenMenu={setOpenMenu}
							onNavigate={closeAll}
						/>
					</div>
				</Suspense>

				<div className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2">
					<div className="hidden items-center gap-1.5 min-[1320px]:flex sm:gap-2">
						<Link href={PUBLIC_NAV_CTA.href} className={ctaClass('desktop')}>
							{t(PUBLIC_NAV_CTA.key)}
						</Link>
						<ThemeToggle />
						<LocaleSwitcher />
						<HeaderAuth />
					</div>

					<button
						type="button"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors duration-200 hover:text-foreground min-[1320px]:hidden"
						aria-label={isMenuOpen ? t('closeMenu') : t('openMenu')}
						aria-expanded={isMenuOpen}
						aria-controls="mobile-nav"
						onClick={() => {
							setOpenMenu(null);
							setIsMenuOpen((open) => !open);
						}}
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

			<div
				id="mobile-nav"
				className={`mobile-menu-overlay min-[1320px]:hidden ${isMenuOpen ? 'is-open' : ''}`}
				aria-hidden={!isMenuOpen}
			>
				<div className="mobile-menu-overlay__inner">
					<div className="h-14 shrink-0" aria-hidden />
					<Suspense fallback={null}>
						<HeaderNav
							variant="mobile"
							isMenuOpen={isMenuOpen}
							openMenu={openMenu}
							setOpenMenu={setOpenMenu}
							onNavigate={closeAll}
						/>
					</Suspense>
					<div className="mobile-menu-overlay__footer">
						<div className="flex flex-wrap items-center gap-2">
							<ThemeToggle />
							<LocaleSwitcher />
						</div>
						<HeaderAuth stacked onNavigate={closeAll} />
					</div>
				</div>
			</div>
		</header>
	);
}
