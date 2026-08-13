/**
 * Ensure local test admin: email/id `admin`, password `admin1234`.
 * Usage: node scripts/ensure-admin.cjs
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const EMAIL = 'admin';
const PASSWORD = 'admin1234';
const NAME = 'Admin';

async function main() {
	const prisma = new PrismaClient();
	try {
		const passwordHash = await bcrypt.hash(PASSWORD, 10);
		const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

		if (existing) {
			await prisma.user.update({
				where: { email: EMAIL },
				data: { passwordHash, role: 'admin', name: existing.name || NAME },
			});
			console.log(`[ensure-admin] updated existing user "${EMAIL}" (role=admin, password reset)`);
		} else {
			await prisma.user.create({
				data: {
					email: EMAIL,
					name: NAME,
					passwordHash,
					role: 'admin',
					planId: 'pro',
					creditsRemaining: 100,
				},
			});
			console.log(`[ensure-admin] created user "${EMAIL}" / password "${PASSWORD}" (role=admin)`);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error('[ensure-admin] failed:', err);
	process.exit(1);
});
