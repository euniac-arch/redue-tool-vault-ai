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
	// Audit-result pages skip the extra content→footer gap below because the Footer's
	// own inner top padding already provides breathing room there.
	const isAuditResult =
		pathname === '/audit/result' || pathname.startsWith('/audit/result/');
	const isHome = pathname === '/';
	const is960Content =
		pathname === '/audit/history' ||
		pathname.startsWith('/audit/history/') ||
		pathname === '/portfolio' ||
		pathname.startsWith('/portfolio/') ||
		pathname === '/contact' ||
		pathname.startsWith('/contact/');

	if (isAdmin || isPublicReport) {
		return <>{children}</>;
	}

	if (isHome) {
		return (
			<div className="landing-shell page-horizon--faint relative flex min-h-screen min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-[#080B11] dark:text-white">
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
		<div
			className="page-horizon--faint relative flex min-h-screen min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-[#0a0d12] dark:text-slate-100"
		>
			{/* Viewport-fixed horizon art. Lives outside overflow-x-hidden so `position:fixed` is not trapped. */}
			<div className="page-horizon print:hidden" aria-hidden="true" />
			<div className="relative z-[1] flex min-h-screen min-h-dvh flex-col overflow-x-hidden">
				<Header />
				{/* Sticky footer: this column stretches to fill remaining viewport height
				    (`flex-1`) so a short page's Footer still lands flush on the screen bottom.
				    Bottom padding lives on the content wrapper so the gap sits between content
				    and Footer — never below the Footer. Footer is a sibling so its background
				    can be full-bleed while its inner wrapper reuses this same `max-w-5xl px-6`. */}
				{/* No z-index here: a stacking context would trap `position:fixed` overlays
				    (guide modal, audit share bar, scrollspy) below the Footer sibling. */}
				<div
					className={`relative mx-auto flex w-full flex-1 flex-col px-6 pt-10 ${
						is960Content ? 'max-w-[960px]' : 'max-w-5xl'
					}`}
				>
					<div className={`flex-1 ${isAuditResult ? 'pb-0' : 'pb-16'}`}>{children}</div>
				</div>
				<Footer clearFloatingBar={!isAuditResult} />
			</div>
			{isAuditResult ? null : <StickyDiagnoseBar />}
		</div>
	);
}
