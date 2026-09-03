import { getServerSession } from 'next-auth';
import { getToken, type JWT } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { actorFromTier, isAsiTier, type AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
import { resolveAsiTier, type AsiActorInput, type AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';
import { resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { isStudioAdminIdentity, resolveNextAuthSecret } from '@/lib/master-admin';
import { prisma } from '@/lib/prisma';

export type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
export { actorFromTier, publicAsiEntitlement, asiUsageKeyFor } from '@/lib/ai-search-intelligence/entitlement/actor-model';

const SESSION_COOKIE_NAMES = [
	'next-auth.session-token',
	'__Secure-next-auth.session-token',
	'__Host-next-auth.session-token',
] as const;

/** Mock-only test override. Never honored in live/hybrid. */
export function mockTestTierFromRequest(req: Request): AsiTier | null {
	if (resolveAsiMode() !== 'mock') return null;
	const raw = (req.headers.get('x-asi-test-tier') || '').trim().toLowerCase();
	return isAsiTier(raw) ? raw : null;
}

type SessionIdentity = {
	id?: string;
	email?: string | null;
	role?: string | null;
	isAdmin?: boolean;
};

function identityFromJwt(token: JWT | null): SessionIdentity | null {
	if (!token) return null;
	const id = String(token.uid || token.sub || '').trim();
	const email = typeof token.email === 'string' ? token.email : null;
	if (!id && !email) return null;
	return {
		id: id || undefined,
		email,
		role: typeof token.role === 'string' ? token.role : null,
		isAdmin: token.isAdmin === true,
	};
}

/**
 * Same cookie/JWT fallback as `lib/admin.ts`.
 * After OAuth, getServerSession can be empty while the session cookie is already set.
 */
async function readIdentityFromRequest(req: Request): Promise<SessionIdentity | null> {
	const session = await getServerSession(authOptions).catch(() => null);
	const user = session?.user as SessionIdentity | undefined;
	if (user?.id) return user;

	const secret = resolveNextAuthSecret();
	try {
		const token = await getToken({ req: req as never, secret });
		const fromDefault = identityFromJwt(token);
		if (fromDefault?.id || fromDefault?.email) return fromDefault;
	} catch {
		// try named cookies
	}

	for (const cookieName of SESSION_COOKIE_NAMES) {
		try {
			const token = await getToken({
				req: req as never,
				secret,
				cookieName,
				secureCookie: cookieName.startsWith('__Secure') || cookieName.startsWith('__Host'),
			});
			const fromNamed = identityFromJwt(token);
			if (fromNamed?.id || fromNamed?.email) return fromNamed;
		} catch {
			// next cookie
		}
	}

	return user?.email ? user : null;
}

function actorInputFromIdentity(identity: SessionIdentity, planId?: string | null, role?: string | null): AsiActorInput {
	return {
		isLoggedIn: Boolean(identity.id || identity.email),
		planId,
		role: role || identity.role,
		isAdmin: identity.isAdmin,
		email: identity.email,
		userId: identity.id,
	};
}

/**
 * Login → session/JWT → Prisma plan/role → ASI tier.
 * Reuses NextAuth + User.planId + existing admin allowlists. No second auth system.
 */
export async function resolveAsiActorFromRequest(req: Request): Promise<AsiActor> {
	const testTier = mockTestTierFromRequest(req);
	if (testTier) return actorFromTier(testTier);

	const identity = await readIdentityFromRequest(req);
	if (!identity?.id && !identity?.email) return actorFromTier('guest');

	const usageKey = identity.id ? `user:${identity.id}` : identity.email ? `user:${identity.email}` : undefined;

	try {
		const row = identity.id
			? await prisma.user.findUnique({
					where: { id: identity.id },
					select: { id: true, planId: true, role: true, email: true },
				})
			: identity.email
				? await prisma.user.findUnique({
						where: { email: identity.email },
						select: { id: true, planId: true, role: true, email: true },
					})
				: null;

		if (row) {
			const merged = { ...identity, id: row.id, email: row.email || identity.email, role: row.role || identity.role };
			const input = actorInputFromIdentity(merged, row.planId, merged.role);
			if (isStudioAdminIdentity(merged)) {
				return actorFromTier('admin', `user:${row.id}`);
			}
			return actorFromTier(resolveAsiTier(input), `user:${row.id}`);
		}
	} catch {
		// SQLite can be missing on serverless — fall through to JWT/session flags
	}

	if (isStudioAdminIdentity({ id: identity.id, email: identity.email, role: identity.role, isAdmin: identity.isAdmin })) {
		return actorFromTier('admin', usageKey);
	}

	return actorFromTier(resolveAsiTier(actorInputFromIdentity(identity, null, identity.role)), usageKey);
}
