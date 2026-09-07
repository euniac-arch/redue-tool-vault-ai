import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveAsiRoute } from '@/lib/ai-search-intelligence/routes';
import { isAdminEmail, isDbAdminRole, resolveNextAuthSecret } from '@/lib/master-admin';
import { extractRequestMeta } from '@/lib/security-log-meta';

function redirectLegacyIntelligence(req: NextRequest): NextResponse | null {
	const { pathname } = req.nextUrl;
	if (pathname !== '/intelligence' && !pathname.startsWith('/intelligence/')) {
		return null;
	}
	const parts = pathname.replace(/^\/intelligence\/?/, '').split('/').filter(Boolean);
	if (parts.length < 2) return null;
	const route = resolveAsiRoute(parts);
	const target = route.redirectTo ?? route.href;
	if (!target || target === pathname) return null;
	const url = req.nextUrl.clone();
	url.pathname = target;
	return NextResponse.redirect(url);
}

function isAdminToken(token: {
	role?: string | null;
	email?: string | null;
	uid?: string | null;
	isAdmin?: boolean;
} | null): boolean {
	if (!token) return false;
	if (token.isAdmin === true) return true;
	if (token.email && isAdminEmail(token.email)) return true;
	return isDbAdminRole(token.role) || (token.role || '').toUpperCase() === 'ADMIN';
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
	const { pathname } = req.nextUrl;

	const intelligenceRedirect = redirectLegacyIntelligence(req);
	if (intelligenceRedirect) return intelligenceRedirect;

	if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
		return NextResponse.next();
	}

	const token = await getToken({
		req,
		secret: resolveNextAuthSecret(),
	});

	if (!token) {
		enqueueSecurityLog(req, event, {
			eventType: 'ADMIN_ACCESS_DENIED',
			userEmail: 'Guest',
			status: 'FAIL',
			details: `관리자 페이지 비로그인 접근: ${pathname}`,
		});
		const login = new URL('/login', req.url);
		login.searchParams.set('callbackUrl', pathname);
		return NextResponse.redirect(login);
	}

	if (!isAdminToken(token)) {
		enqueueSecurityLog(req, event, {
			eventType: 'ADMIN_ACCESS_DENIED',
			userEmail: typeof token.email === 'string' ? token.email : 'Guest',
			userId: typeof token.uid === 'string' ? token.uid : undefined,
			status: 'FAIL',
			details: `관리자 권한 없음: ${pathname}`,
		});
		return NextResponse.redirect(new URL('/', req.url));
	}

	enqueueSecurityLog(req, event, {
		eventType: 'ADMIN_ACCESS',
		userEmail: typeof token.email === 'string' ? token.email : 'Guest',
		userId: typeof token.uid === 'string' ? token.uid : undefined,
		status: 'SUCCESS',
		details: `관리자 페이지 접근: ${pathname}`,
	});
	return NextResponse.next();
}

function enqueueSecurityLog(
	req: NextRequest,
	event: NextFetchEvent,
	payload: {
		eventType: 'ADMIN_ACCESS' | 'ADMIN_ACCESS_DENIED';
		userEmail?: string;
		userId?: string;
		status: 'SUCCESS' | 'FAIL';
		details: string;
	},
) {
	const secret = resolveNextAuthSecret();
	if (!secret) return;
	const meta = extractRequestMeta(req.headers);
	const promise = fetch(new URL('/api/internal/security-logs', req.url), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-internal-log-secret': secret,
		},
		body: JSON.stringify({ ...payload, ...meta }),
	}).catch(() => undefined);

	try {
		event.waitUntil(promise);
	} catch {
		// fetch already started; do not block the admin page if the runtime
		// does not expose waitUntil on this request.
	}
}

export const config = {
	matcher: ['/admin', '/admin/:path*', '/intelligence/:path*'],
};
