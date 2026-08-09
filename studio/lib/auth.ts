import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { AuthOptions } from 'next-auth';
import type { Adapter, AdapterAccount } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import KakaoProvider from 'next-auth/providers/kakao';
import { prisma } from './prisma';
import { isAdminEmail } from './admin';

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

export const authOptions: AuthOptions = {
	adapter: buildAdapter(),
	session: { strategy: 'jwt' },
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
				email: { label: '이메일', type: 'email' },
				password: { label: '비밀번호', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}
				const user = await prisma.user.findUnique({ where: { email: credentials.email } });
				if (!user?.passwordHash) {
					return null;
				}
				const valid = await bcrypt.compare(credentials.password, user.passwordHash);
				if (!valid) {
					return null;
				}
				return { id: user.id, email: user.email, name: user.name, image: user.image };
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.uid = user.id;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user && token.uid) {
				session.user.id = token.uid as string;
			}
			return session;
		},
	},
	events: {
		// Bootstrap mechanism for Step 6's admin backoffice: no self-service "become
		// admin" UI exists on purpose, so listing an email in ADMIN_EMAILS is how the
		// operator grants themselves access on first sign-in (OAuth or credentials).
		async signIn({ user }) {
			if (user?.email && isAdminEmail(user.email)) {
				await prisma.user.updateMany({ where: { email: user.email, role: { not: 'admin' } }, data: { role: 'admin' } });
			}
		},
	},
};
