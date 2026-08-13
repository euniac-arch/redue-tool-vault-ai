'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * Site chrome for public pages. `/admin/*` uses its own AdminLayout
 * (top header + left sidebar) and must not inherit the marketing Header/Footer.
 * All other routes share this shell, so the global Footer is rendered once
 * here rather than per-page.
 */
export function ConditionalAppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
	// Audit-result pages skip the extra content→footer gap below because the Footer's
	// own inner top padding already provides breathing room there.
	const isAuditResult = pathname === '/audit/result' || pathname.startsWith('/audit/result/');

	if (isAdmin) {
		return <>{children}</>;
	}

	return (
		<div className="flex min-h-screen min-h-dvh flex-col overflow-x-hidden">
			<Header />
			{/* Sticky footer: this column stretches to fill remaining viewport height
			    (`flex-1`) so a short page's Footer still lands flush on the screen bottom.
			    Bottom padding lives on the content wrapper so the gap sits between content
			    and Footer — never below the Footer. Footer is a sibling so its background
			    can be full-bleed while its inner wrapper reuses this same `max-w-5xl px-6`. */}
			<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pt-10">
				<div className={`flex-1 ${isAuditResult ? 'pb-0' : 'pb-16'}`}>{children}</div>
			</div>
			<Footer clearFloatingBar={isAuditResult} />
		</div>
	);
}
