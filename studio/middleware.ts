import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveAsiRoute } from '@/lib/ai-search-intelligence/routes';
import { isAdminEmail, isDbAdminRole, resolveNextAuthSecret } from '@/lib/master-admin';

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

export async function middleware(req: NextRequest) {
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
		const login = new URL('/login', req.url);
		login.searchParams.set('callbackUrl', pathname);
		return NextResponse.redirect(login);
	}

	if (!isAdminToken(token)) {
		return NextResponse.redirect(new URL('/', req.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/admin', '/admin/:path*', '/intelligence/:path*'],
};
