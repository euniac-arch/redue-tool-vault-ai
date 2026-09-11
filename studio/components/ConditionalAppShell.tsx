'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StickyDiagnoseBar } from '@/components/landing/StickyDiagnoseBar';

/**
 * Site chrome for public pages. `/admin/*` uses its own AdminLayout
 * (top header + left sidebar) and must not inherit the marketing Header/Footer.
 * All other routes share this shell, so the global Footer is rendered once
 * here rather than per-page.
 */
export function ConditionalAppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
	const isPublicReport = pathname === '/report' || pathname.startsWith('/report/');
	const isPublicGuide = pathname === '/guide' || pathname.startsWith('/guide/');
	const isAuditResult =
		pathname === '/audit/result' || pathname.startsWith('/audit/result/');
	const isStrategyStudio = pathname === '/strategy' || pathname.startsWith('/strategy/');
	const isHome = pathname === '/';
	const isIntelligence = pathname === '/intelligence' || pathname.startsWith('/intelligence/');

	if (isAdmin || isPublicReport || isPublicGuide) {
		return <>{children}</>;
	}

	if (isHome) {
		return (
			<div className="landing-shell page-horizon--faint relative flex min-h-screen min-h-dvh flex-col bg-white text-slate-900 dark:bg-[#080B11] dark:text-white">
				<div className="page-horizon print:hidden" aria-hidden="true" />
				<div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-x-hidden">
					<Header />
					{children}
					<Footer clearFloatingBar />
				</div>
				<StickyDiagnoseBar />
			</div>
		);
	}

	return (
		<div className="subpage-shell relative isolate flex min-h-screen min-h-dvh flex-col overflow-x-clip bg-white text-slate-900 dark:bg-[#04101b] dark:text-slate-100">
			<div
				className="pointer-events-none absolute left-1/2 top-0 z-0 hidden h-[500px] w-[min(800px,140vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/25 via-sky-500/15 to-transparent blur-3xl print:hidden dark:block"
				aria-hidden
			/>
			<div className="relative z-[1] flex min-h-screen min-h-dvh flex-col">
				<Header />
				{/* Sticky footer: this column stretches to fill remaining viewport height
				    (`flex-1`) so a short page's Footer still lands flush on the screen bottom.
				    Bottom padding lives on the content wrapper so the gap sits between content
				    and Footer — never below the Footer. Footer is a sibling so its background
				    can be full-bleed while its inner wrapper reuses this same `max-w-5xl px-6`. */}
				{/* No z-index here: a stacking context would trap `position:fixed` overlays
				    (guide modal, audit share bar, scrollspy) below the Footer sibling. */}
				<div
					className={`relative mx-auto flex w-full min-w-0 flex-1 flex-col px-6 pt-10 ${
						isIntelligence ? 'max-w-7xl' : 'max-w-5xl'
					}`}
				>
					<div className={`flex-1 ${isAuditResult || isStrategyStudio ? 'pb-[50px]' : 'pb-16'}`}>{children}</div>
				</div>
				<Footer clearFloatingBar={!isAuditResult && !isStrategyStudio} />
			</div>
			{isAuditResult || isStrategyStudio ? null : <StickyDiagnoseBar />}
		</div>
	);
}
