/**
 * Post-login callback guards.
 * Run: npx tsx scripts/test-auth-callback.ts
 */
import { isAdminOnlyPath, sanitizeCallbackUrl } from '../lib/auth-callback';

let failed = 0;

function assert(condition: boolean, message: string) {
	if (!condition) {
		failed += 1;
		console.error('FAIL', message);
	}
}

assert(isAdminOnlyPath('/admin'), 'admin root');
assert(isAdminOnlyPath('/admin/analytics'), 'admin analytics');
assert(!isAdminOnlyPath('/mypage'), 'mypage is shared');

assert(
	sanitizeCallbackUrl('/admin/analytics', { isAdmin: false }) === '/mypage',
	'user callback leaves admin',
);
assert(
	sanitizeCallbackUrl('/admin/analytics', { isAdmin: true }) === '/admin/analytics',
	'admin callback keeps admin',
);
assert(sanitizeCallbackUrl('/mypage?tab=password') === '/mypage?tab=password', 'member page kept');
assert(sanitizeCallbackUrl('https://evil.example/admin') === '/', 'external origin dropped');
assert(
	sanitizeCallbackUrl('https://reduegeo.com/mypage?tab=inquiries') === '/mypage?tab=inquiries',
	'same-site absolute url becomes path',
);
assert(sanitizeCallbackUrl('//evil.example') === '/', 'protocol-relative dropped');
assert(sanitizeCallbackUrl('/login?callbackUrl=/admin') === '/', 'login loop dropped');

if (failed) {
	console.error(`${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('auth callback checks passed');
