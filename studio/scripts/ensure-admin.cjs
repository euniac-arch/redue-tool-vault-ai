/**
 * Ensure local test admin: id `admin`, password `jooni1428`,
 * stable user id `admin-master-id`.
 * Usage: node scripts/ensure-admin.cjs
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const ID = process.env.MASTER_ADMIN_ID || 'admin-master-id';
const EMAIL = (process.env.MASTER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin').trim().toLowerCase();
const PASSWORD = process.env.MASTER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'jooni1428';
const NAME = process.env.MASTER_ADMIN_NAME || 'REDUE Admin';
const LEGACY_EMAILS = ['admin@redue.ai'];

async function main() {
	const prisma = new PrismaClient();
	try {
		const passwordHash = await bcrypt.hash(PASSWORD, 10);
		const byId = await prisma.user.findUnique({ where: { id: ID } });
		const byEmail = await prisma.user.findUnique({ where: { email: EMAIL } });
		let legacy = null;
		for (const legacyEmail of LEGACY_EMAILS) {
			if (legacyEmail === EMAIL) continue;
			legacy = await prisma.user.findUnique({ where: { email: legacyEmail } });
			if (legacy) break;
		}

		if (byId) {
			await prisma.user.update({
				where: { id: ID },
				data: { email: EMAIL, passwordHash, role: 'admin', name: byId.name || NAME },
			});
			console.log(`[ensure-admin] updated user id="${ID}" email="${EMAIL}" (role=admin, password reset)`);
			return;
		}

		const existing = byEmail || legacy;
		if (existing) {
			await prisma.user.update({
				where: { id: existing.id },
				data: { email: EMAIL, passwordHash, role: 'admin', name: existing.name || NAME },
			});
			console.log(`[ensure-admin] updated existing email to "${EMAIL}" id="${existing.id}" (role=admin, password reset)`);
			return;
		}

		await prisma.user.create({
			data: {
				id: ID,
				email: EMAIL,
				name: NAME,
				passwordHash,
				role: 'admin',
				planId: 'pro',
				creditsRemaining: 100,
			},
		});
		console.log(`[ensure-admin] created user "${EMAIL}" / password "${PASSWORD}" id="${ID}" (role=admin)`);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error('[ensure-admin] failed:', err);
	process.exit(1);
});
