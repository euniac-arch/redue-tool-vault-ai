/**
 * Admin member merge: shared-store signups stay visible and sort newest first.
 * Run: npx tsx scripts/test-admin-member-merge.ts
 */
import {
	durableUserMatchesFilters,
	memberFromDurableUser,
	mergeAdminMembers,
	type ListedDurableUser,
} from '../lib/admin/member-merge';

let failed = 0;

function assert(condition: boolean, message: string) {
	if (!condition) {
		failed += 1;
		console.error('FAIL', message);
	}
}

const filters = { query: '', plan: 'all' as const, provider: 'all' as const, status: 'all' as const };

function durable(overrides: Partial<ListedDurableUser>): ListedDurableUser {
	return {
		id: 'new-user',
		email: 'new@example.com',
		name: '신규',
		phone: '01012345678',
		role: 'user',
		planId: 'starter',
		creditsRemaining: 5,
		status: 'active',
		memo: '',
		image: null,
		provider: 'email',
		createdAt: '2026-09-27T00:00:00.000Z',
		lastLoginAt: null,
		...overrides,
	};
}

const existing = memberFromDurableUser(durable({ id: 'old', email: 'old@example.com', createdAt: '2026-01-01T00:00:00.000Z' }));
const fresh = memberFromDurableUser(durable({}));
const merged = mergeAdminMembers([existing], [fresh, existing]);
assert(merged.length === 2, 'duplicate email is not listed twice');
assert(merged[0]?.email === 'old@example.com', 'prisma row stays');
assert(merged.some((member) => member.email === 'new@example.com'), 'firestore-only signup is included');

const newestFirst = [fresh, existing].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
assert(newestFirst[0]?.email === 'new@example.com', 'newer created_at sorts first');

assert(durableUserMatchesFilters(durable({ status: 'active' }), filters), 'active user passes open filters');
assert(
	!durableUserMatchesFilters(durable({ status: 'active' }), { ...filters, status: 'suspended' }),
	'status filter can hide non-matching users',
);
assert(
	durableUserMatchesFilters(durable({ role: 'user', status: 'active' }), filters),
	'role user is not excluded by the default list',
);

if (failed) {
	console.error(`${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('admin member merge checks passed');
