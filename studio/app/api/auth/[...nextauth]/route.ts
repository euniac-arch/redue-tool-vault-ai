import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyRuntimeAuthEnv } from '@/lib/master-admin';

applyRuntimeAuthEnv();

/**
 * On Vercel, `.env` often still has `NEXTAUTH_URL=http://localhost:3000`.
 * CSRF then fails because the page origin is https://*.vercel.app.
 * Always align the URL with the incoming host for this request.
 */
function bindAuthUrlToRequest(req: NextRequest): void {
	applyRuntimeAuthEnv();
	if (!process.env.VERCEL) return;
	const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
		.split(',')[0]
		.trim();
	const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
	if (host) {
		process.env.NEXTAUTH_URL = `${proto}://${host}`;
	}
}

async function handler(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
	bindAuthUrlToRequest(req);
	return NextAuth(req, ctx, authOptions);
}

export { handler as GET, handler as POST };
