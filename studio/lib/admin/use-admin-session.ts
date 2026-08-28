'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { isDbAdminRole } from '@/lib/master-admin';

export function isClientAdminRole(role: string | null | undefined): boolean {
	return isDbAdminRole(role) || (role || '').trim().toUpperCase() === 'ADMIN';
}

export function isAdminSessionUser(user: {
	isAdmin?: boolean;
	role?: string | null;
} | null | undefined): boolean {
	if (!user) return false;
	return user.isAdmin === true;
}

const PUBLIC_AUTH_PREFIXES = ['/login', '/auth'] as const;

/**
 * Public/auth routes where admin pollers must never run — even if a stale
 * JWT still makes `useSession()` look authenticated after a server reset.
 */
export function isPublicOrAuthPath(pathname: string | null | undefined): boolean {
	if (!pathname) return true;
	if (pathname === '/') return true;
	return PUBLIC_AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminAppPath(pathname: string | null | undefined): boolean {
	if (!pathname) return false;
	return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function hasStrictAdminFetchGrant(
	status: string,
	session: Session | null | undefined,
	pathname: string | null | undefined,
): boolean {
	if (status !== 'authenticated') return false;
	if (!session?.user) return false;
	if (session.user.isAdmin !== true) return false;
	if (!isAdminAppPath(pathname)) return false;
	if (isPublicOrAuthPath(pathname)) return false;
	return true;
}

/**
 * Client-side admin gate. Admin-only fetches must wait for `canFetchAdmin`.
 * `status === 'loading' | 'unauthenticated'` never enables fetching.
 */
export function useAdminSession() {
	const pathname = usePathname();
	const { data: session, status } = useSession();
	const isReady = status !== 'loading';
	const isAuthenticated = status === 'authenticated' && Boolean(session?.user);
	const isAdmin = isAuthenticated && session?.user?.isAdmin === true;
	const onPublicRoute = isPublicOrAuthPath(pathname);
	const onAdminRoute = isAdminAppPath(pathname);
	const canFetchAdmin = hasStrictAdminFetchGrant(status, session, pathname);

	return {
		session,
		status,
		isReady,
		isAuthenticated,
		isAdmin,
		canFetchAdmin,
		pathname,
		onPublicRoute,
		onAdminRoute,
	};
}
