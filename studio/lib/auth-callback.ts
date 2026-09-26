/** Paths a signed-in non-admin must not be sent to after login. */
export function isAdminOnlyPath(pathname: string): boolean {
	const path = pathname.split('?')[0]?.split('#')[0] || '/';
	return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/intelligence');
}

/**
 * Keep post-login redirects on this site.
 * A regular member with `callbackUrl=/admin/...` goes to `/mypage`.
 */
export function sanitizeCallbackUrl(
	raw: string | null | undefined,
	options?: { isAdmin?: boolean; fallback?: string },
): string {
	const fallback = options?.fallback || '/';
	const value = (raw || '').trim();
	if (!value) return fallback;

	let path = value;
	if (value.startsWith('http://') || value.startsWith('https://')) {
		try {
			const url = new URL(value);
			const allowedHosts = new Set(['reduegeo.com', 'www.reduegeo.com', 'localhost', '127.0.0.1']);
			if (!allowedHosts.has(url.hostname)) return fallback;
			path = `${url.pathname}${url.search}`;
		} catch {
			return fallback;
		}
	}

	if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
	if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/api/')) return fallback;

	if (isAdminOnlyPath(path) && !options?.isAdmin) return '/mypage';
	return path;
}
