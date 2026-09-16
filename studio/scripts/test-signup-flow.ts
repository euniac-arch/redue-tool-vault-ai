/**
 * 가상 사용자 자동 테스트 — 일반 회원가입(POST /api/auth/signup) 흐름 검증.
 *
 * 타임스탬프 + 난수를 조합해 DB 충돌 없는 고유한 테스트 페르소나를 동적으로 생성하고,
 * 로컬 개발 서버(Next.js)에 순차적으로 가입 요청을 보내 성공/실패 케이스를 검증한다.
 * 검증 후에는 이번 실행에서 생성한 테스트 계정을 모두 삭제해 DB를 깨끗하게 되돌린다.
 *
 * 사용법:
 *   1) 별도 터미널에서 `npm run dev` (Next.js 개발 서버, 기본 3000 포트)
 *   2) npx tsx scripts/test-signup-flow.ts
 *      AUTH_BASE_URL=http://localhost:3001 npx tsx scripts/test-signup-flow.ts   # 포트 강제 지정
 *
 * 절대 비밀값을 로그에 남기지 않는다 (비밀번호 원문은 표에 노출하지 않음).
 */
import { PrismaClient } from '@prisma/client';

type Expectation = 'success' | 'blocked_400' | 'blocked_409';

interface Persona {
	label: string;
	email: string;
	password: string;
	name: string;
	phone: string;
	expect: Expectation;
	note: string;
}

interface CaseResult {
	label: string;
	input: string;
	expect: Expectation;
	status: number;
	pass: boolean;
	message: string;
}

const stamp = Date.now();
const rand = (len = 5) => Math.random().toString(36).slice(2, 2 + len);

// 8자 이상 + 영문 + 숫자 + 특수문자 규칙(lib/auth-account.ts validatePasswordStrength)을 만족하는 강한 비밀번호.
const STRONG_PASSWORD = `ReDue!${rand(4)}9`;

// 이후 "동일 이메일 중복 가입" 케이스에서 재사용하기 위해 첫 정상 가입 이메일을 미리 고정해둔다.
const gmailNormalEmail = `user_${stamp}_1@gmail.com`;

const personas: Persona[] = [
	{
		label: '정상가입 (Gmail)',
		email: gmailNormalEmail,
		password: STRONG_PASSWORD,
		name: '정상유저1',
		phone: '01011112222',
		expect: 'success',
		note: '일반 이메일 도메인 정상 가입',
	},
	{
		label: '정상가입 (Naver)',
		email: `tester_${stamp}_2@naver.com`,
		password: STRONG_PASSWORD,
		name: '정상유저2',
		phone: '01022223333',
		expect: 'success',
		note: '일반 이메일 도메인 정상 가입',
	},
	{
		label: '정상가입 (사내 테스트 도메인)',
		email: `global_dev_${stamp}@redue.test`,
		password: STRONG_PASSWORD,
		name: '글로벌개발자',
		phone: '01033334444',
		expect: 'success',
		note: '사내 테스트 도메인 정상 가입',
	},
	{
		label: '엣지 · 대소문자 혼합 이메일',
		email: `Test.User_Edge_${stamp}@Example.COM`,
		password: STRONG_PASSWORD,
		name: '엣지유저',
		phone: '01044445555',
		expect: 'success',
		note: '서버가 trim+lowercase 정규화 후 정상 가입해야 함',
	},
	{
		label: '엣지 · 플러스기호 서브 이메일',
		email: `tester+sub${stamp}@gmail.com`,
		password: STRONG_PASSWORD,
		name: '서브유저',
		phone: '01055556666',
		expect: 'success',
		note: 'Gmail +태그 서브주소도 별도 계정으로 정상 가입해야 함',
	},
	{
		label: '엣지 · 잘못된 이메일 형식',
		email: 'invalid-user-format',
		password: STRONG_PASSWORD,
		name: '포맷에러유저',
		phone: '01066667777',
		expect: 'blocked_400',
		note: '@ 미포함 → 400으로 가입 차단되어야 함',
	},
	{
		label: '엣지 · 비밀번호 길이 미달',
		email: `pw_short_${stamp}@redue.test`,
		password: 'ab1!',
		name: '짧은비번유저',
		phone: '01077778888',
		expect: 'blocked_400',
		note: '8자 미만 → 400으로 가입 차단되어야 함',
	},
	{
		label: '엣지 · 비밀번호 특수문자 누락',
		email: `pw_nospecial_${stamp}@redue.test`,
		password: 'abcdef12',
		name: '특수문자누락유저',
		phone: '01088889999',
		expect: 'blocked_400',
		note: '특수문자 누락 → 400으로 가입 차단되어야 함',
	},
	{
		label: '엣지 · 동일 이메일 중복 가입',
		email: gmailNormalEmail,
		password: STRONG_PASSWORD,
		name: '중복시도유저',
		phone: '01099990000',
		expect: 'blocked_409',
		note: '이미 가입된 이메일 재시도 → 409로 차단되어야 함',
	},
];

async function probePort(port: number): Promise<boolean> {
	try {
		await fetch(`http://127.0.0.1:${port}`, { redirect: 'manual' });
		return true;
	} catch {
		return false;
	}
}

async function resolveBaseUrl(): Promise<string> {
	if (process.env.AUTH_BASE_URL) return process.env.AUTH_BASE_URL.replace(/\/$/, '');
	for (const port of [3000, 3001, 3002]) {
		if (await probePort(port)) return `http://localhost:${port}`;
	}
	return 'http://localhost:3000';
}

async function jsonOrText(res: Response): Promise<{ json: any; text: string }> {
	const text = await res.text();
	try {
		return { json: JSON.parse(text), text };
	} catch {
		return { json: null, text: text.slice(0, 300) };
	}
}

async function postSignup(baseUrl: string, persona: Persona) {
	const res = await fetch(`${baseUrl}/api/auth/signup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: persona.email,
			password: persona.password,
			name: persona.name,
			phone: persona.phone,
		}),
	});
	const { json, text } = await jsonOrText(res);
	return { status: res.status, json, text };
}

function evaluate(expect: Expectation, status: number): boolean {
	if (expect === 'success') return status === 200;
	if (expect === 'blocked_400') return status === 400;
	if (expect === 'blocked_409') return status === 409;
	return false;
}

function describeResponse(status: number, json: any, text: string): string {
	if (json?.error) return json.error;
	if (json?.ok) return `가입 성공 (email=${json.email})`;
	if (json) return JSON.stringify(json);
	return text || `(status ${status})`;
}

/** NextAuth credentials 콜백으로 실제 로그인 → 세션(JWT) 쿠키 발급 여부까지 검증한다. */
async function verifyCredentialsLogin(baseUrl: string, email: string, password: string) {
	const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
	const csrfJson = await csrfRes.json().catch(() => ({}));
	const csrfCookies = (csrfRes.headers as any).getSetCookie?.() ?? [];
	const cookie = csrfCookies.map((entry: string) => entry.split(';')[0]).join('; ');

	const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
		redirect: 'manual',
		body: new URLSearchParams({
			csrfToken: csrfJson.csrfToken ?? '',
			email,
			password,
			json: 'true',
		}),
	});
	const loginCookies = (loginRes.headers as any).getSetCookie?.() ?? [];
	const sessionCookie = loginCookies.find((entry: string) =>
		/next-auth\.session-token|__Secure-next-auth\.session-token/.test(entry),
	);
	const sessionCookieHeader = loginCookies.map((entry: string) => entry.split(';')[0]).join('; ');

	const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
		headers: { cookie: `${cookie}; ${sessionCookieHeader}` },
	});
	const sessionJson = await sessionRes.json().catch(() => null);

	return {
		status: loginRes.status,
		hasSessionCookie: Boolean(sessionCookie),
		sessionEmail: sessionJson?.user?.email ?? null,
	};
}

async function main() {
	const baseUrl = await resolveBaseUrl();
	console.log(`\n[signup-flow-test] 대상 서버: ${baseUrl}`);
	console.log(`[signup-flow-test] 테스트 스탬프: ${stamp}\n`);

	const prisma = new PrismaClient();
	const results: CaseResult[] = [];
	const createdEmails = new Set<string>();

	for (const persona of personas) {
		const { status, json, text } = await postSignup(baseUrl, persona);
		const pass = evaluate(persona.expect, status);
		results.push({
			label: persona.label,
			input: persona.email,
			expect: persona.expect,
			status,
			pass,
			message: describeResponse(status, json, text),
		});
		if (status === 200 && json?.ok) {
			createdEmails.add(persona.email.trim().toLowerCase());
		}
	}

	// --- 로그인 세션(JWT) 발급 검증: 첫 정상 가입 계정으로 NextAuth credentials 로그인 ---
	const loginTarget = personas.find((p) => p.expect === 'success');
	if (loginTarget) {
		const loginCheck = await verifyCredentialsLogin(baseUrl, loginTarget.email, loginTarget.password);
		const normalizedEmail = loginTarget.email.trim().toLowerCase();
		results.push({
			label: '로그인 세션(JWT) 발급 확인',
			input: loginTarget.email,
			expect: 'success',
			status: loginCheck.status,
			pass: loginCheck.hasSessionCookie && loginCheck.sessionEmail === normalizedEmail,
			message: loginCheck.hasSessionCookie
				? `세션 쿠키 발급 OK (session.user.email=${loginCheck.sessionEmail})`
				: '세션 쿠키가 발급되지 않음',
		});
	}

	// --- DB 사용자 프로필 기본값 검증 ---
	if (loginTarget) {
		const dbUser = await prisma.user.findUnique({
			where: { email: loginTarget.email.trim().toLowerCase() },
			select: { role: true, planId: true, creditsRemaining: true, passwordHash: true },
		});
		const ok = Boolean(
			dbUser &&
				dbUser.passwordHash &&
				dbUser.role === 'user' &&
				dbUser.planId === 'starter' &&
				dbUser.creditsRemaining === 5,
		);
		results.push({
			label: 'DB 프로필 기본값 확인',
			input: loginTarget.email,
			expect: 'success',
			status: dbUser ? 200 : 404,
			pass: ok,
			message: dbUser
				? `role=${dbUser.role}, planId=${dbUser.planId}, creditsRemaining=${dbUser.creditsRemaining}, passwordHash=${Boolean(dbUser.passwordHash)}`
				: 'DB에서 사용자를 찾지 못함',
		});
	}

	// --- 콘솔 테이블 출력 ---
	console.log('\n=== 회원가입 자동 테스트 결과 ===');
	console.table(
		results.map((r) => ({
			'테스트 케이스명': r.label,
			입력값: r.input,
			결과: r.pass ? 'PASS' : 'FAIL',
			'응답 메시지': `[${r.status}] ${r.message}`,
		})),
	);

	// --- 정리: 이번 실행에서 생성한 테스트 계정 전부 삭제 (DB 오염 방지) ---
	let cleanedUp = 0;
	for (const email of createdEmails) {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) continue;
		await prisma.creditTransaction.deleteMany({ where: { userId: user.id } }).catch(() => {});
		await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
		await prisma.account.deleteMany({ where: { userId: user.id } }).catch(() => {});
		await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
		cleanedUp += 1;
	}
	console.log(`\n[cleanup] 이번 실행에서 생성된 테스트 계정 ${cleanedUp}개 삭제 완료.`);

	await prisma.$disconnect();

	const failed = results.filter((r) => !r.pass);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	if (failed.length) {
		console.error('\n실패한 케이스:');
		for (const r of failed) {
			console.error(`  - ${r.label}: expected=${r.expect}, status=${r.status}, message=${r.message}`);
		}
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error('[signup-flow-test] 치명적 오류:', err);
	process.exitCode = 1;
});
