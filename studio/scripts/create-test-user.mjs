/**
 * Create/upsert a local test "일반 회원(USER)" account for 마이페이지 QA.
 *
 * Mirrors the password-hashing + role logic used by the credentials
 * provider in `lib/auth.ts` (bcrypt hash on `User.passwordHash`,
 * `role: "user"` — see schema.prisma comment on `User.role`).
 *
 * Usage:
 *   node scripts/create-test-user.mjs
 *
 * Overrides (optional):
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_NAME
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL = (process.env.TEST_USER_EMAIL || 'test@redue.ai').trim().toLowerCase();
const PASSWORD = process.env.TEST_USER_PASSWORD || 'test1234!';
const NAME = process.env.TEST_USER_NAME || '테스트 회원';

async function main() {
	const prisma = new PrismaClient();
	try {
		const passwordHash = await bcrypt.hash(PASSWORD, 10);
		const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

		if (existing) {
			await prisma.user.update({
				where: { id: existing.id },
				data: {
					passwordHash,
					role: 'user',
					name: existing.name || NAME,
				},
			});
			console.log(`[create-test-user] updated existing user email="${EMAIL}" id="${existing.id}" (role=user, password reset)`);
			return;
		}

		const user = await prisma.user.create({
			data: {
				email: EMAIL,
				name: NAME,
				passwordHash,
				role: 'user',
				planId: 'starter',
				creditsRemaining: 5,
			},
		});
		console.log(`[create-test-user] created user "${EMAIL}" / password "${PASSWORD}" id="${user.id}" (role=user)`);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error('[create-test-user] failed:', err);
	process.exit(1);
});
