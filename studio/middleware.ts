import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminEmail, isDbAdminRole, resolveNextAuthSecret } from '@/lib/master-admin';

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
	matcher: ['/admin', '/admin/:path*'],
};
