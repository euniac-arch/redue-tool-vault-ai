/**
 * Phone normalization for account recovery.
 * Run: npx tsx scripts/test-account-lookup.ts
 */
import { buildPasswordResetUrl, maskEmail, normalizeName, normalizePhone, phoneLookupVariants, phonesMatch, resolvePasswordResetBaseUrl } from '../lib/auth-account';

let failed = 0;
function assert(condition: boolean, message: string) {
	if (!condition) {
		failed += 1;
		console.error('FAIL', message);
	}
}

assert(normalizePhone('010-3210-9801') === '01032109801', 'hyphen phone becomes digits');
assert(normalizePhone('01032109801') === '01032109801', 'digits stay digits');
assert(phonesMatch('010-3210-9801', '01032109801'), 'stored hyphen matches digit query');
assert(phonesMatch('01032109801', '010-3210-9801'), 'stored digits match hyphen query');
assert(phoneLookupVariants('01032109801').includes('010-3210-9801'), 'variant includes hyphen form');
assert(normalizeName('  박성준  ') === '박성준', 'name trim');
assert(maskEmail('euniac@gmail.com') === 'eun***@gmail.com', 'email mask');

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousAuthUrl = process.env.NEXTAUTH_URL;
const previousNodeEnv = process.env.NODE_ENV;
const previousVercel = process.env.VERCEL;
process.env.NEXT_PUBLIC_APP_URL = '';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.VERCEL = '1';
assert(resolvePasswordResetBaseUrl() === 'https://reduegeo.com', 'production ignores localhost auth url');
process.env.VERCEL = '';
process.env.NODE_ENV = 'development';
assert(resolvePasswordResetBaseUrl() === 'http://localhost:3000', 'local dev keeps localhost');
process.env.NEXT_PUBLIC_APP_URL = 'https://reduegeo.com/';
assert(resolvePasswordResetBaseUrl() === 'https://reduegeo.com', 'public app url wins');
const resetUrl = buildPasswordResetUrl('euniac@gmail.com', 'abc');
assert(
	resetUrl === 'https://reduegeo.com/reset-password?token=abc&email=euniac%40gmail.com',
	'reset link uses public origin',
);
process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
process.env.NEXTAUTH_URL = previousAuthUrl;
process.env.NODE_ENV = previousNodeEnv;
process.env.VERCEL = previousVercel;

if (failed) {
	console.error(`${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('account lookup checks passed');
