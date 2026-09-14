/**
 * Local auth diagnostic: env presence, Prisma, email signup, NextAuth providers.
 *
 *   node scripts/test-auth-local.mjs
 *   AUTH_BASE_URL=http://localhost:3000 node scripts/test-auth-local.mjs
 *
 * Never prints secret values — only set / empty / length / prefix.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILES = [resolve(ROOT, '.env.local'), resolve(ROOT, '.env')];

function parseEnvFile(path) {
	if (!existsSync(path)) return { path, exists: false, vars: {} };
	const vars = {};
	for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq < 1) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		vars[key] = value;
	}
	return { path, exists: true, vars };
}

function firstEnv(files, key) {
	for (const file of files) {
		if (file.vars[key] != null) return { value: file.vars[key], source: file.path };
	}
	if (process.env[key] != null) return { value: process.env[key], source: 'process.env' };
	return { value: '', source: null };
}

function summarizeSecret(value) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return { set: false, chars: 0, prefix: '' };
	return { set: true, chars: trimmed.length, prefix: `${trimmed.slice(0, 4)}…` };
}

async function probePort(port) {
	const url = `http://127.0.0.1:${port}`;
	try {
		const res = await fetch(url, { redirect: 'manual' });
		return { port, up: true, status: res.status };
	} catch {
		return { port, up: false, status: 0 };
	}
}

async function jsonOrText(res) {
	const text = await res.text();
	try {
		return { json: JSON.parse(text), text };
	} catch {
		return { json: null, text: text.slice(0, 400) };
	}
}

const envFiles = ENV_FILES.map(parseEnvFile);
const get = (key) => firstEnv(envFiles, key);

const nextAuthUrl = get('NEXTAUTH_URL');
const appUrl = get('NEXT_PUBLIC_APP_URL');
const dbUrl = get('DATABASE_URL');
const googleId = get('GOOGLE_CLIENT_ID');
const googleSecret = get('GOOGLE_CLIENT_SECRET');
const kakaoId = get('KAKAO_CLIENT_ID');
const kakaoSecret = get('KAKAO_CLIENT_SECRET');
const nextAuthSecret = get('NEXTAUTH_SECRET');

const ports = await Promise.all([3000, 3001, 3002].map(probePort));
const live = ports.filter((p) => p.up);
const configuredOrigin = (nextAuthUrl.value || appUrl.value || 'http://localhost:3000').replace(/\/$/, '');
const configuredPort = Number(new URL(configuredOrigin).port || 80);
const preferred = live.find((p) => p.port === configuredPort) || live[0];
const baseUrl = (process.env.AUTH_BASE_URL || (preferred ? `http://localhost:${preferred.port}` : configuredOrigin)).replace(
	/\/$/,
	'',
);

const stamp = Date.now();
const testEmail = `auth-diag-${stamp}@redue.test`;
const weakPassword = 'short';
const strongPassword = 'AuthTest1!';
const testName = '인증점검';
const testPhone = '01032109801';

const report = {
	baseUrl,
	ports,
	env: {
		files: envFiles.map((f) => ({ path: f.path, exists: f.exists, keys: Object.keys(f.vars).length })),
		NEXTAUTH_URL: { value: nextAuthUrl.value || '(empty)', source: nextAuthUrl.source },
		NEXT_PUBLIC_APP_URL: { value: appUrl.value || '(empty)', source: appUrl.source },
		DATABASE_URL: { value: dbUrl.value || '(empty)', source: dbUrl.source },
		NEXTAUTH_SECRET: { ...summarizeSecret(nextAuthSecret.value), source: nextAuthSecret.source },
		GOOGLE_CLIENT_ID: { ...summarizeSecret(googleId.value), source: googleId.source },
		GOOGLE_CLIENT_SECRET: { ...summarizeSecret(googleSecret.value), source: googleSecret.source },
		KAKAO_CLIENT_ID: { ...summarizeSecret(kakaoId.value), source: kakaoId.source },
		KAKAO_CLIENT_SECRET: { ...summarizeSecret(kakaoSecret.value), source: kakaoSecret.source },
		expectedGoogleRedirect: `${configuredOrigin}/api/auth/callback/google`,
		expectedKakaoRedirect: `${configuredOrigin}/api/auth/callback/kakao`,
	},
	db: {},
	http: {},
};

const prisma = new PrismaClient();
try {
	await prisma.$queryRaw`SELECT 1`;
	const userCount = await prisma.user.count();
	const accountCount = await prisma.account.count();
	const providers = await prisma.account.groupBy({
		by: ['provider'],
		_count: { provider: true },
	});
	report.db = {
		ok: true,
		userCount,
		accountCount,
		providers: Object.fromEntries(providers.map((row) => [row.provider, row._count.provider])),
	};
} catch (err) {
	report.db = { ok: false, error: err instanceof Error ? err.message : String(err) };
}

async function postJson(path, body) {
	const res = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const parsed = await jsonOrText(res);
	return { status: res.status, ...parsed };
}

async function getJson(path) {
	const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
	const parsed = await jsonOrText(res);
	return { status: res.status, location: res.headers.get('location'), ...parsed };
}

if (!preferred && !process.env.AUTH_BASE_URL) {
	report.http = { skipped: true, reason: 'no local Next.js server on 3000/3001/3002' };
} else {
	const invalidEmail = await postJson('/api/auth/signup', {
		email: 'not-an-email',
		password: strongPassword,
		name: testName,
		phone: testPhone,
	});
	const weakPw = await postJson('/api/auth/signup', {
		email: testEmail,
		password: weakPassword,
		name: testName,
		phone: testPhone,
	});
	const missingPhone = await postJson('/api/auth/signup', {
		email: testEmail,
		password: strongPassword,
		name: testName,
		phone: '123',
	});
	const created = await postJson('/api/auth/signup', {
		email: testEmail,
		password: strongPassword,
		name: testName,
		phone: testPhone,
	});
	const duplicate = await postJson('/api/auth/signup', {
		email: testEmail,
		password: strongPassword,
		name: testName,
		phone: testPhone,
	});

	const csrf = await getJson('/api/auth/csrf');
	const csrfToken = csrf.json?.csrfToken;
	const cookieHeader = ''; // CSRF for credentials needs cookie; fetch below uses csrf + cookie jar via two-step

	const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
	const csrfJson = await csrfRes.json();
	const setCookies = csrfRes.headers.getSetCookie?.() || [];
	const cookie = setCookies.map((entry) => entry.split(';')[0]).join('; ');

	const login = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			cookie,
		},
		redirect: 'manual',
		body: new URLSearchParams({
			csrfToken: csrfJson.csrfToken,
			email: testEmail,
			password: strongPassword,
			json: 'true',
		}),
	});
	const loginCookies = login.headers.getSetCookie?.() || [];
	const sessionCookie = loginCookies.find((entry) => /next-auth\.session-token|__Secure-next-auth\.session-token/.test(entry));
	const loginBody = await jsonOrText(login);

	const sessionCookieHeader = loginCookies.map((entry) => entry.split(';')[0]).join('; ');
	const session = await fetch(`${baseUrl}/api/auth/session`, {
		headers: { cookie: `${cookie}; ${sessionCookieHeader}` },
	});
	const sessionJson = await session.json();

	const providers = await getJson('/api/auth/providers');
	const googleSignin = await fetch(`${baseUrl}/api/auth/signin/google`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			cookie,
		},
		redirect: 'manual',
		body: new URLSearchParams({ csrfToken: csrfJson.csrfToken, callbackUrl: baseUrl }),
	});
	const kakaoSignin = await fetch(`${baseUrl}/api/auth/signin/kakao`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			cookie,
		},
		redirect: 'manual',
		body: new URLSearchParams({ csrfToken: csrfJson.csrfToken, callbackUrl: baseUrl }),
	});

	const googleLocation = googleSignin.headers.get('location') || '';
	const kakaoLocation = kakaoSignin.headers.get('location') || '';
	let googleRedirectUri = '';
	let kakaoRedirectUri = '';
	try {
		googleRedirectUri = new URL(googleLocation).searchParams.get('redirect_uri') || '';
	} catch {
		/* not a URL */
	}
	try {
		kakaoRedirectUri = new URL(kakaoLocation).searchParams.get('redirect_uri') || '';
	} catch {
		/* not a URL */
	}

	const dbUser = report.db.ok
		? await prisma.user.findUnique({
				where: { email: testEmail },
				select: { id: true, email: true, name: true, phone: true, passwordHash: true, role: true, creditsRemaining: true },
			})
		: null;

	report.http = {
		signupInvalidEmail: { status: invalidEmail.status, error: invalidEmail.json?.error },
		signupWeakPassword: { status: weakPw.status, error: weakPw.json?.error },
		signupMissingPhone: { status: missingPhone.status, error: missingPhone.json?.error },
		signupCreated: { status: created.status, body: created.json },
		signupDuplicate: { status: duplicate.status, error: duplicate.json?.error },
		csrf: { status: csrfRes.status, hasToken: Boolean(csrfToken || csrfJson.csrfToken) },
		credentialsLogin: {
			status: login.status,
			location: login.headers.get('location'),
			hasSessionCookie: Boolean(sessionCookie),
			body: loginBody.json || loginBody.text,
		},
		sessionAfterLogin: {
			status: session.status,
			email: sessionJson?.user?.email || null,
			id: sessionJson?.user?.id || null,
			role: sessionJson?.user?.role || null,
		},
		providers: {
			status: providers.status,
			keys: providers.json ? Object.keys(providers.json) : [],
			google: Boolean(providers.json?.google),
			kakao: Boolean(providers.json?.kakao),
			credentials: Boolean(providers.json?.credentials),
		},
		googleAuthorize: {
			status: googleSignin.status,
			locationHost: safeHost(googleLocation),
			redirectUri: googleRedirectUri,
		},
		kakaoAuthorize: {
			status: kakaoSignin.status,
			locationHost: safeHost(kakaoLocation),
			redirectUri: kakaoRedirectUri,
		},
		createdUser: dbUser
			? {
					id: dbUser.id,
					email: dbUser.email,
					name: dbUser.name,
					phone: dbUser.phone,
					hasPasswordHash: Boolean(dbUser.passwordHash),
					role: dbUser.role,
					creditsRemaining: dbUser.creditsRemaining,
				}
			: null,
	};

	if (dbUser?.id) {
		await prisma.creditTransaction.deleteMany({ where: { userId: dbUser.id } });
		await prisma.user.delete({ where: { id: dbUser.id } }).catch(() => {});
		report.http.cleanedUp = true;
	}
}

function safeHost(url) {
	try {
		return new URL(url).origin;
	} catch {
		return url.slice(0, 80) || '';
	}
}

await prisma.$disconnect();
console.log(JSON.stringify(report, null, 2));
