/**
 * ASI API-key security audit (names and shapes only — never print secret values).
 * Run: npx tsx scripts/test-intelligence-security.ts
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GET } from '../app/api/intelligence/route';
import { redactAsiSecrets } from '../lib/ai-search-intelligence/api/log';
import { actorFromTier, publicAsiEntitlement, PUBLIC_ASI_ENTITLEMENT_KEYS } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { redactInsightsLogText } from '../lib/insights/insights-api-errors';

let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`);
}

const studioRoot = process.cwd();
const repoRoot = join(studioRoot, '..');

const ASI_KEY_NAMES = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'PERPLEXITY_API_KEY', 'ANTHROPIC_API_KEY'] as const;
const SECRET_SHAPE = /\b(sk-[a-zA-Z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|pplx-[a-zA-Z0-9_-]{12,})\b/;
const PUBLIC_KEY_ENV = /NEXT_PUBLIC_(OPENAI|GEMINI|PERPLEXITY|ANTHROPIC|ASI)_API_KEY/;
const CLIENT_PROVIDER_IMPORT =
	/from ['"]@\/lib\/ai-search-intelligence\/providers\/(openai-provider|gemini-provider|claude-provider|perplexity-provider|create-providers|live-query|http)['"]/;
const CLIENT_SDK_IMPORT = /from ['"](openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai)['"]/;

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
		const full = join(dir, name);
		const stat = statSync(full);
		if (stat.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(name)) out.push(full);
	}
	return out;
}

function read(path: string): string {
	return readFileSync(path, 'utf8');
}

function exampleKeyEmpty(example: string, name: string): boolean {
	const match = example.match(new RegExp(`^${name}=(.*)$`, 'm'));
	if (!match) return false;
	return match[1].replace(/^["']|["']$/g, '').trim() === '';
}

const example = read(join(studioRoot, '.env.example'));
for (const name of ASI_KEY_NAMES) {
	assert(`studio/.env.example has empty ${name}`, exampleKeyEmpty(example, name));
}
assert('studio/.env.example has no NEXT_PUBLIC LLM keys', !PUBLIC_KEY_ENV.test(example));

const gitignore = read(join(repoRoot, '.gitignore'));
assert('gitignore ignores root .env', /^\.env$/m.test(gitignore) || gitignore.includes('\n.env\n') || gitignore.startsWith('.env\n'));
assert('gitignore ignores .env.local', gitignore.includes('.env.local'));
assert('gitignore ignores .env.*.local', gitignore.includes('.env.*.local'));

let trackedEnv = '';
try {
	trackedEnv = execSync('git ls-files -- .env .env.local .env.production.local studio/.env studio/.env.local studio/.env.production.local', {
		cwd: repoRoot,
		encoding: 'utf8',
	}).trim();
} catch {
	trackedEnv = 'error';
}
assert('git does not track local env files', trackedEnv === '');

const clientFiles = walk(join(studioRoot, 'components', 'ai-search-intelligence'));
let clientProviderImport = false;
let clientSdkImport = false;
let clientPublicKey = false;
let clientLocalStorageKey = false;
for (const file of clientFiles) {
	const src = read(file);
	if (CLIENT_PROVIDER_IMPORT.test(src)) clientProviderImport = true;
	if (CLIENT_SDK_IMPORT.test(src)) clientSdkImport = true;
	if (PUBLIC_KEY_ENV.test(src) || ASI_KEY_NAMES.some((name) => src.includes(`process.env.${name}`))) {
		clientPublicKey = true;
	}
	if (/localStorage\.(get|set)Item/.test(src) && ASI_KEY_NAMES.some((name) => src.includes(name))) {
		clientLocalStorageKey = true;
	}
}
assert('client components do not import live providers', !clientProviderImport);
assert('client components do not import provider SDKs', !clientSdkImport);
assert('client components do not read LLM env keys', !clientPublicKey);
assert('client components do not store LLM keys in localStorage', !clientLocalStorageKey);

const fixtureRoots = [join(studioRoot, 'lib', 'ai-search-intelligence'), join(studioRoot, 'scripts')].flatMap((dir) =>
	walk(dir).filter((file) => /mock|fixture|test-intelligence/i.test(file)),
);
let fixtureHasSecretShape = false;
for (const file of fixtureRoots) {
	const src = read(file);
	if (SECRET_SHAPE.test(src) && !src.includes('[redacted]') && !/redactAsiSecrets|SECRET_SHAPE/.test(src)) {
		fixtureHasSecretShape = true;
	}
}
assert('ASI mocks/tests have no secret-shaped tokens', !fixtureHasSecretShape);

assert('redact openai-shaped token', redactAsiSecrets('Bearer sk-proj-PLACEHOLDERVALUE').includes('[redacted]'));
assert('redact gemini url key param', redactAsiSecrets('https://x?key=PLACEHOLDER').includes('key=[redacted]'));
assert('redact google-shaped token', redactAsiSecrets('AIzaSyPLACEHOLDERVALUE0000').includes('[redacted]'));

const insightsRoutes = walk(join(studioRoot, 'app', 'api', 'insights'));
let insightsLeaksRawDetail = false;
let insightsLeaksEnvName = false;
for (const file of insightsRoutes) {
	const src = read(file);
	if (/detail:\s*message\b|detail,\s*code:/.test(src)) insightsLeaksRawDetail = true;
	if (/error:\s*[`'"][^`'"]*(OPENAI_API_KEY|YOUTUBE_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|PERPLEXITY_API_KEY)/.test(src)) {
		insightsLeaksEnvName = true;
	}
}
assert('insights API does not return raw Error.message as detail', !insightsLeaksRawDetail);
assert('insights API does not name env keys in client errors', !insightsLeaksEnvName);

let publicNaverSecret = false;
let naverSecretFallback = false;
for (const file of walk(join(studioRoot, 'lib')).concat(walk(join(studioRoot, 'app')))) {
	const src = read(file);
	if (/process\.env\.NEXT_PUBLIC_NAVER_CLIENT_SECRET/.test(src)) publicNaverSecret = true;
	if (/process\.env\.NEXT_PUBLIC_NAVER_CLIENT_ID/.test(src)) naverSecretFallback = true;
}
assert('code does not read NEXT_PUBLIC_NAVER_CLIENT_SECRET', !publicNaverSecret);
assert('code does not read NEXT_PUBLIC_NAVER_CLIENT_ID as credential fallback', !naverSecretFallback);

assert(
	'insights log redacts env names',
	redactInsightsLogText('OPENAI_API_KEY missing Cookie: abc Authorization: Bearer x').includes('[env]') &&
		redactInsightsLogText('OPENAI_API_KEY missing Cookie: abc Authorization: Bearer x').includes('[redacted]'),
);

assert(
	'insights research engine does not log key prefixes',
	!read(join(studioRoot, 'lib', 'insights', 'insights-ai-research-engine.ts')).includes('keyPrefix'),
);

const rel = relative(repoRoot, join(studioRoot, 'lib', 'ai-search-intelligence', 'providers', 'resolve-mode.ts'));
assert('key reader path exists', existsSync(join(repoRoot, rel)));

const publicEntitlement = publicAsiEntitlement(actorFromTier('admin'));
assert(
	'public entitlement is only tier + planRole',
	Object.keys(publicEntitlement).sort().join() === [...PUBLIC_ASI_ENTITLEMENT_KEYS].sort().join(),
);
assert('public entitlement has no usageKey', !('usageKey' in publicEntitlement));
assert('public entitlement has no email', !('email' in publicEntitlement));
assert('public entitlement has no planId', !('planId' in publicEntitlement));

const CLIENT_SECRET_IMPORT =
	/from ['"]@\/lib\/(ai-search-intelligence\/entitlement\/actor['"]|master-admin|prisma)['"]/;
const CLIENT_SERVER_ENV = /process\.env\.(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|PERPLEXITY_API_KEY|NEXTAUTH_SECRET|STRIPE_SECRET|AGENT_CRON_SECRET|ASI_.*SECRET)/;
let clientSecretImport = false;
let clientServerEnv = false;
for (const file of clientFiles.concat([
	join(studioRoot, 'lib', 'ai-search-intelligence', 'entitlement', 'use-asi-actor.ts'),
	join(studioRoot, 'lib', 'ai-search-intelligence', 'entitlement', 'actor-model.ts'),
	join(studioRoot, 'lib', 'ai-search-intelligence', 'client', 'asi-client.ts'),
])) {
	const src = read(file);
	if (CLIENT_SECRET_IMPORT.test(src)) clientSecretImport = true;
	if (CLIENT_SERVER_ENV.test(src)) clientServerEnv = true;
}
assert('client does not import actor.ts / master-admin / prisma', !clientSecretImport);
assert('client does not read server credential env', !clientServerEnv);
assert(
	'client actor reads GET entitlement only',
	read(join(studioRoot, 'lib', 'ai-search-intelligence', 'entitlement', 'use-asi-actor.ts')).includes("fetch('/api/intelligence')"),
);

void (async () => {
	const getRes = await GET(new Request('http://localhost/api/intelligence'));
	const getBody = (await getRes.json()) as {
		data?: { entitlement?: Record<string, unknown>; accountUsage?: Record<string, unknown>; usage?: unknown };
	};
	const dumped = JSON.stringify(getBody);
	assert('GET entitlement keys are minimal', Object.keys(getBody.data?.entitlement ?? {}).sort().join() === 'planRole,tier');
	assert('GET accountUsage has no usageKey', !('usageKey' in (getBody.data?.accountUsage ?? {})));
	assert(
		'GET accountUsage keys are public quota only',
		Object.keys(getBody.data?.accountUsage ?? {}).sort().join() === 'estimated,queriesLimit,queriesUsed,remaining',
	);
	assert('GET has no global usage dump', getBody.data?.usage === undefined);
	assert('GET leaks no API_KEY name', !dumped.includes('API_KEY'));
	assert('GET leaks no SECRET name', !dumped.includes('SECRET') && !dumped.includes('NEXTAUTH'));
	assert('GET leaks no Bearer', !dumped.includes('Bearer '));
	assert('GET leaks no sk- token', !dumped.includes('sk-'));
	assert('GET leaks no usageKey', !dumped.includes('usageKey'));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
