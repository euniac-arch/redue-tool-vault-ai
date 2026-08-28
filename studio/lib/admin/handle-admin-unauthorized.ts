'use client';

/**
 * 401 cleanup. If NextAuth still has a user (Kakao/OAuth race, or a
 * non-admin hitting an admin route), do not sign them out — just stop.
 * Only clear the session when it is actually gone.
 */
let inflight: Promise<void> | null = null;

export function handleAdminUnauthorized(): Promise<void> {
	if (inflight) return inflight;

	inflight = (async () => {
		if (typeof window === 'undefined') return;

		const { getSession, signOut } = await import('next-auth/react');
		const session = await getSession();
		if (session?.user) {
			return;
		}

		const onLogin = window.location.pathname === '/login' || window.location.pathname.startsWith('/login/');
		if (onLogin) return;

		await signOut({ callbackUrl: '/login' });
	})().finally(() => {
		window.setTimeout(() => {
			inflight = null;
		}, 4000);
	});

	return inflight;
}
