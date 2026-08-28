/**
 * Reset today's free-audit quota (User.dailyAuditCount) for local QA.
 *
 * Usage (from studio/):
 *   node scripts/reset-quota.mjs
 *   node scripts/reset-quota.mjs --email=test@redue.ai
 *   node scripts/reset-quota.mjs --all
 *
 * Cookie / localStorage (`seo_audit_count`) are not visible to this script.
 * After a DB reset, POST /api/audit/quota/reset (or refresh the signed-in
 * browser) so leftover guest cookies cannot re-inflate the count.
 */
import { PrismaClient } from '@prisma/client';

const DEFAULT_EMAIL = (process.env.TEST_USER_EMAIL || 'test@redue.ai').trim().toLowerCase();
const args = process.argv.slice(2);
const resetAll = args.includes('--all');
const emailArg = args.find((arg) => arg.startsWith('--email='))?.slice('--email='.length);
const targetEmail = (emailArg || (!resetAll ? DEFAULT_EMAIL : '')).trim().toLowerCase();

if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = 'file:./prisma/dev.db';
}

function todayStamp(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

async function ensureColumns(prisma) {
	const cols = await prisma.$queryRawUnsafe('PRAGMA table_info(User)');
	const names = new Set(cols.map((col) => col.name));
	if (!names.has('dailyAuditCount')) {
		await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN dailyAuditCount INTEGER NOT NULL DEFAULT 0');
		console.log('[reset-quota] added User.dailyAuditCount');
	}
	if (!names.has('lastAuditResetDate')) {
		await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN lastAuditResetDate TEXT');
		console.log('[reset-quota] added User.lastAuditResetDate');
	}
	if (!names.has('freeAuditsUsed')) {
		await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN freeAuditsUsed INTEGER NOT NULL DEFAULT 0');
		console.log('[reset-quota] added User.freeAuditsUsed');
	}
}

async function loadUsers(prisma, { all, email }) {
	if (all) {
		return prisma.$queryRawUnsafe(
			'SELECT id, email, role, planId, dailyAuditCount, lastAuditResetDate FROM User',
		);
	}
	if (email) {
		return prisma.$queryRawUnsafe(
			'SELECT id, email, role, planId, dailyAuditCount, lastAuditResetDate FROM User WHERE lower(email) = ?',
			email,
		);
	}
	return [];
}

function printRow(prefix, user) {
	const email = user.email || '(no-email)';
	console.log(
		`${prefix} id=${user.id} email=${email} role=${user.role || ''} plan=${user.planId || ''} dailyAuditCount=${user.dailyAuditCount ?? 0} lastAuditResetDate=${user.lastAuditResetDate || '-'}`,
	);
}

async function main() {
	const prisma = new PrismaClient();
	const date = todayStamp();
	try {
		await ensureColumns(prisma);
		let before = await loadUsers(prisma, { all: resetAll, email: resetAll ? '' : targetEmail });
		if (!resetAll && targetEmail && before.length === 0) {
			console.log(`[reset-quota] no user with email=${targetEmail}; falling back to ALL users`);
			before = await loadUsers(prisma, { all: true, email: '' });
		}
		console.log(`[reset-quota] date=${date} target=${resetAll || before.length !== 1 ? 'ALL' : targetEmail || 'ALL'}`);
		if (before.length === 0) {
			console.log('[reset-quota] no User rows. Signed-in quota will read as used=0; leftover guest cookies are cleared by POST /api/audit/quota/reset.');
			return;
		}
		console.log('[reset-quota] before:');
		for (const user of before) printRow('  -', user);

		const ids = before.map((user) => user.id);
		for (const id of ids) {
			await prisma.$executeRawUnsafe(
				'UPDATE User SET dailyAuditCount = 0, lastAuditResetDate = ? WHERE id = ?',
				date,
				id,
			);
		}

		const after = await loadUsers(prisma, {
			all: resetAll || before.length !== 1,
			email: before.length === 1 ? (before[0].email || targetEmail) : '',
		});
		console.log('[reset-quota] after:');
		for (const user of after) printRow('  -', user);
		console.log(`[reset-quota] reset ${ids.length} user(s) to used=0 remaining=3 for ${date}`);
		console.log('[reset-quota] Browser leftover: POST /api/audit/quota/reset (dev) also clears the seo_audit_count cookie.');
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error('[reset-quota] failed:', err);
	process.exit(1);
});
