import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { AuthOptions } from 'next-auth';
import type { Adapter, AdapterAccount } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import KakaoProvider from 'next-auth/providers/kakao';
import {
	isAdminEmail,
	isDbAdminRole,
	isMasterAdminLoginId,
	isMasterAdminPassword,
	MASTER_ADMIN_EMAIL,
	MASTER_ADMIN_ID,
	MASTER_ADMIN_NAME,
	MASTER_ADMIN_ROLE,
	applyRuntimeAuthEnv,
	normalizeLoginIdentifier,
	resolveNextAuthSecret,
} from './master-admin';
import { ensureMasterAdminUser } from './ensure-master-admin';
import { prisma } from './prisma';

applyRuntimeAuthEnv();

/**
 * Kakao's OAuth token response includes `refresh_token_expires_in`, a field
 * the Prisma `Account` model doesn't define — Prisma's `account.create()`
 * rejects unknown keys and login fails on `linkAccount`. This wraps the
 * default adapter to drop unsupported fields before delegating.
 * See https://github.com/nextauthjs/next-auth/issues/6708
 */
function buildAdapter(): Adapter {
	const base = PrismaAdapter(prisma);
	return {
		...base,
		linkAccount: (account: AdapterAccount) => {
			const cleaned: Record<string, unknown> = { ...account };
			delete cleaned.refresh_token_expires_in;
			delete cleaned.id_token; // Kakao id_token can exceed typical column expectations; not needed post-login.
			return base.linkAccount!(cleaned as AdapterAccount);
		},
	};
}

function sessionRoleForUser(email: string | null | undefined, dbRole?: string | null): 'ADMIN' | 'USER' {
	if (isDbAdminRole(dbRole) || (email && isAdminEmail(email))) return MASTER_ADMIN_ROLE;
	return 'USER';
}

export { ensureMasterAdminUser } from './ensure-master-admin';

export const authOptions: AuthOptions = {
	adapter: buildAdapter(),
	session: { strategy: 'jwt' },
	secret: resolveNextAuthSecret() || undefined,
	useSecureCookies: process.env.NODE_ENV === 'production',
	pages: {
		signIn: '/login',
	},
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_NOT_SET',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_NOT_SET',
		}),
		KakaoProvider({
			clientId: process.env.KAKAO_CLIENT_ID || 'KAKAO_CLIENT_ID_NOT_SET',
			clientSecret: process.env.KAKAO_CLIENT_SECRET || 'KAKAO_CLIENT_SECRET_NOT_SET',
		}),
		CredentialsProvider({
			id: 'credentials',
			name: '이메일',
			credentials: {
				email: { label: '이메일', type: 'text' },
				password: { label: '비밀번호', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				const loginId = credentials.email.trim();
				const password = credentials.password;

				if (isMasterAdminLoginId(loginId) && isMasterAdminPassword(password)) {
					// Never block login on SQLite/Postgres writes (Vercel FS is read-only).
					void ensureMasterAdminUser().catch((err) => {
						console.error('[auth] ensureMasterAdminUser failed; JWT bootstrap continues:', err);
					});
					return {
						id: MASTER_ADMIN_ID,
						email: MASTER_ADMIN_EMAIL,
						name: MASTER_ADMIN_NAME,
						role: MASTER_ADMIN_ROLE,
					};
				}

				const email = normalizeLoginIdentifier(loginId);
				const user = await prisma.user.findUnique({ where: { email } });
				if (!user?.passwordHash) {
					return null;
				}
				const valid = await bcrypt.compare(password, user.passwordHash);
				if (!valid) {
					return null;
				}

				const role = sessionRoleForUser(user.email, user.role);
				if (role === MASTER_ADMIN_ROLE && user.role !== 'admin') {
					await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
				}

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
					role,
				};
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.uid = user.id;
				token.role = user.role || sessionRoleForUser(user.email, null);
			}
			if (!token.role && token.email) {
				token.role = sessionRoleForUser(String(token.email), null);
			}
			if (isMasterAdminLoginId(String(token.email || '')) || token.uid === MASTER_ADMIN_ID) {
				token.uid = (token.uid as string) || MASTER_ADMIN_ID;
				token.role = MASTER_ADMIN_ROLE;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = (token.uid as string) || MASTER_ADMIN_ID;
				session.user.role = (token.role as string) || sessionRoleForUser(session.user.email, null);
				if (isMasterAdminLoginId(session.user.email || '') || session.user.id === MASTER_ADMIN_ID) {
					session.user.role = MASTER_ADMIN_ROLE;
					session.user.email = session.user.email || MASTER_ADMIN_EMAIL;
				}
			}
			return session;
		},
	},
	events: {
		// Bootstrap mechanism for Step 6's admin backoffice: no self-service "become
		// admin" UI exists on purpose, so listing an email in ADMIN_EMAILS is how the
		// operator grants themselves access on first sign-in (OAuth or credentials).
		async signIn({ user }) {
			try {
				if (user?.email && isAdminEmail(user.email)) {
					await prisma.user.updateMany({
						where: { email: user.email, role: { not: 'admin' } },
						data: { role: 'admin' },
					});
				}
			} catch (err) {
				console.error('[auth] signIn admin role bootstrap failed:', err);
			}
		},
	},
};
