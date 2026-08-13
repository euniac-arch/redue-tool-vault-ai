'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

/** Below this width the sidebar auto-collapses to icons-only. */
const AUTO_COLLAPSE_MAX = 1023;

/** Data-heavy admin pages that should use the full main column (no max-width). */
const FULL_WIDTH_PATHS = ['/admin/crawling/list'] as const;

interface AdminShellProps {
	children: ReactNode;
	firebaseConfigured: boolean;
}

export function AdminShell({ children, firebaseConfigured }: AdminShellProps) {
	const pathname = usePathname();
	const [userCollapsed, setUserCollapsed] = useState(false);
	const [isNarrow, setIsNarrow] = useState(false);
	/** Temporary expand while viewport is still narrow (toggle override). */
	const [narrowExpanded, setNarrowExpanded] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(`(max-width: ${AUTO_COLLAPSE_MAX}px)`);
		const sync = () => {
			const narrow = media.matches;
			setIsNarrow(narrow);
			if (!narrow) setNarrowExpanded(false);
		};
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	}, []);

	const collapsed = isNarrow ? !narrowExpanded : userCollapsed;
	const fullWidth = FULL_WIDTH_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);

	function toggleSidebar() {
		if (isNarrow) {
			setNarrowExpanded((prev) => !prev);
			return;
		}
		setUserCollapsed((prev) => !prev);
	}

	return (
		<div className="admin-light-theme flex h-screen overflow-hidden bg-slate-50 text-slate-900">
			<AdminSidebar collapsed={collapsed} />
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<AdminHeader
					collapsed={collapsed}
					onToggleSidebar={toggleSidebar}
					firebaseConfigured={firebaseConfigured}
				/>
				<main className="h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
					<div
						className={
							fullWidth
								? 'w-full max-w-none px-4 py-6 sm:px-6 lg:px-8'
								: 'mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'
						}
					>
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
