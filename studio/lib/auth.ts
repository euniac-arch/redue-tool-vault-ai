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
import {
	describeKakaoErrorCode,
	extractKakaoErrorCode,
	getKakaoRedirectUri,
	logKakaoAuthEvent,
	sanitizeAuthMeta,
} from './auth-kakao-errors';
import { ensureMasterAdminUser } from './ensure-master-admin';
import { recordSecurityLog } from './logger';
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

/**
 * Registering an OAuth provider with a placeholder clientId (e.g.
 * "KAKAO_CLIENT_ID_NOT_SET") still sends that literal string to Kakao as
 * `client_id`, which Kakao rejects with KOE101 ("등록되지 않은 앱") — a
 * confusing error that looks like a config mismatch rather than a missing
 * env var. Only register a provider once both id/secret are present, and
 * warn loudly at boot so the real cause shows up in server logs instead of
 * surfacing as a cryptic Kakao error page.
 */
export function isKakaoOAuthConfigured(): boolean {
	return Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim());
}

export function isGoogleOAuthConfigured(): boolean {
	return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

if (!isKakaoOAuthConfigured()) {
	console.warn(
		'[auth] KAKAO_CLIENT_ID/KAKAO_CLIENT_SECRET missing or empty — Kakao login button is disabled. ' +
			'Set both in studio/.env.local (KAKAO_CLIENT_ID = Kakao "REST API 키", not the JavaScript key).',
	);
} else {
	console.info('[auth] Kakao provider enabled', {
		clientIdChars: process.env.KAKAO_CLIENT_ID!.trim().length,
		clientSecretChars: process.env.KAKAO_CLIENT_SECRET!.trim().length,
		redirectUri: getKakaoRedirectUri(),
	});
}
if (!isGoogleOAuthConfigured()) {
	console.warn('[auth] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing or empty — Google login button is disabled.');
}

export const authOptions: AuthOptions = {
	adapter: buildAdapter(),
	session: { strategy: 'jwt' },
	secret: resolveNextAuthSecret() || undefined,
	useSecureCookies: process.env.NODE_ENV === 'production',
	pages: {
		signIn: '/login',
	},
	providers: [
		...(isGoogleOAuthConfigured()
			? [
					GoogleProvider({
						clientId: process.env.GOOGLE_CLIENT_ID!,
						clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
					}),
				]
			: []),
		...(isKakaoOAuthConfigured()
			? [
					KakaoProvider({
						clientId: process.env.KAKAO_CLIENT_ID!,
						clientSecret: process.env.KAKAO_CLIENT_SECRET!,
						profile(profile) {
							const account = profile.kakao_account;
							logKakaoAuthEvent('info', 'profile received', {
								hasId: profile.id != null,
								hasEmail: Boolean(account?.email),
								emailNeedsAgreement: account?.email_needs_agreement ?? null,
							});
							return {
								id: String(profile.id),
								name: account?.profile?.nickname ?? null,
								email: account?.email ?? null,
								image: account?.profile?.profile_image_url ?? null,
							};
						},
					}),
				]
			: []),
		CredentialsProvider({
			id: 'credentials',
			name: '이메일',
			credentials: {
				email: { label: '이메일', type: 'text' },
				password: { label: '비밀번호', type: 'password' },
			},
			async authorize(credentials, req) {
				const fail = (email: string | null | undefined, reason: string) => {
					recordSecurityLog({
						eventType: 'LOGIN_FAIL',
						userEmail: email,
						status: 'FAIL',
						details: `이메일 로그인 실패: ${reason}`,
						headers: req?.headers,
					});
					return null;
				};

				if (!credentials?.email || !credentials?.password) {
					return fail(credentials?.email, '이메일 또는 비밀번호 누락');
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
					return fail(email, '계정을 찾을 수 없거나 비밀번호가 설정되지 않음');
				}
				const valid = await bcrypt.compare(password, user.passwordHash);
				if (!valid) {
					return fail(email, '비밀번호 불일치');
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
			if (user?.id) {
				token.uid = user.id;
			} else if (!token.uid && token.sub) {
				token.uid = String(token.sub);
			}

			const email = String(token.email || user?.email || '');
			const isMaster = isMasterAdminLoginId(email) || token.uid === MASTER_ADMIN_ID;
			if (isMaster) {
				token.uid = (token.uid as string) || MASTER_ADMIN_ID;
				token.role = MASTER_ADMIN_ROLE;
				token.isAdmin = true;
				return token;
			}

			if (user) {
				token.role = sessionRoleForUser(user.email, user.role);
			} else if (email && isAdminEmail(email)) {
				token.role = MASTER_ADMIN_ROLE;
			} else if (!token.role) {
				token.role = sessionRoleForUser(email, null);
			}

			// Allowlist wins on every refresh so ADMIN_EMAILS changes apply without re-login.
			if (email && isAdminEmail(email)) {
				token.role = MASTER_ADMIN_ROLE;
			}

			token.isAdmin = token.role === MASTER_ADMIN_ROLE || isDbAdminRole(String(token.role || ''));
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				const uid = (token.uid as string) || (token.sub as string) || '';
				if (uid) session.user.id = uid;

				const email = session.user.email || (token.email as string) || '';
				if (email && !session.user.email) session.user.email = email;

				const isMaster = isMasterAdminLoginId(email) || session.user.id === MASTER_ADMIN_ID;
				if (isMaster) {
					session.user.role = MASTER_ADMIN_ROLE;
					session.user.email = session.user.email || MASTER_ADMIN_EMAIL;
					if (!session.user.id) session.user.id = MASTER_ADMIN_ID;
				} else if (email && isAdminEmail(email)) {
					session.user.role = MASTER_ADMIN_ROLE;
				} else {
					session.user.role = (token.role as string) || sessionRoleForUser(email, null);
				}

				session.user.isAdmin =
					Boolean(token.isAdmin) ||
					session.user.role === MASTER_ADMIN_ROLE ||
					isDbAdminRole(session.user.role) ||
					Boolean(email && isAdminEmail(email));
			}
			return session;
		},
	},
	logger: {
		error(code, metadata) {
			const kakaoCode = extractKakaoErrorCode(metadata) || extractKakaoErrorCode(code);
			logKakaoAuthEvent('error', String(code), {
				kakaoCode,
				hint: describeKakaoErrorCode(kakaoCode),
				metadata: sanitizeAuthMeta(metadata),
			});
		},
		warn(code) {
			console.warn('[auth]', code);
		},
	},
	events: {
		// Bootstrap mechanism for Step 6's admin backoffice: no self-service "become
		// admin" UI exists on purpose, so listing an email in ADMIN_EMAILS is how the
		// operator grants themselves access on first sign-in (OAuth or credentials).
		async signIn({ user, account }) {
			if (account?.provider === 'kakao') {
				logKakaoAuthEvent('info', 'sign-in succeeded', {
					hasEmail: Boolean(user?.email),
					hasName: Boolean(user?.name),
				});
			}
			const providerLabel =
				account?.provider === 'google'
					? 'Google 소셜 로그인'
					: account?.provider === 'kakao'
						? '카카오 소셜 로그인'
						: '이메일 로그인';
			recordSecurityLog({
				eventType: 'LOGIN_SUCCESS',
				userEmail: user?.email,
				userId: user?.id,
				status: 'SUCCESS',
				details: `${providerLabel} 성공`,
				headers: await readIncomingHeaders(),
			});
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
		async signOut(message) {
			const token = 'token' in message ? message.token : null;
			recordSecurityLog({
				eventType: 'LOGOUT',
				userEmail: typeof token?.email === 'string' ? token.email : null,
				userId: typeof token?.uid === 'string' ? token.uid : typeof token?.sub === 'string' ? token.sub : null,
				status: 'SUCCESS',
				details: '로그아웃',
				headers: await readIncomingHeaders(),
			});
		},
	},
};

async function readIncomingHeaders() {
	try {
		const { headers } = await import('next/headers');
		return headers();
	} catch {
		return undefined;
	}
}
