'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminSession } from '@/lib/admin/use-admin-session';

function GuardSplash() {
	return (
		<div className="flex min-h-[40vh] items-center justify-center">
			<div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
		</div>
	);
}

/**
 * Renders admin children only after a confirmed admin session.
 * Unauthenticated → /login. Signed-in but not admin → /.
 * Children unmount on logout so admin pollers cannot keep firing 403s.
 */
export function AdminAuthGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname() || '/admin';
	const { isReady, isAuthenticated, isAdmin, onPublicRoute } = useAdminSession();

	useEffect(() => {
		if (!isReady) return;
		if (!isAuthenticated) {
			router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
			return;
		}
		if (!isAdmin) {
			router.replace('/');
		}
	}, [isReady, isAuthenticated, isAdmin, pathname, router]);

	if (!isReady || !isAdmin || onPublicRoute) {
		return <GuardSplash />;
	}

	return <>{children}</>;
}
