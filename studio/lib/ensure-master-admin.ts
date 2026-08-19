import bcrypt from 'bcryptjs';
import {
	MASTER_ADMIN_EMAIL,
	MASTER_ADMIN_ID,
	MASTER_ADMIN_NAME,
	MASTER_ADMIN_PASSWORD,
} from './master-admin';
import { prisma } from './prisma';

const LEGACY_ADMIN_EMAILS = ['admin@redue.ai'];

/**
 * Guarantee a single bootstrap admin row (`id: admin-master-id`, email/id `admin`).
 * Older seeds created a second user with email `admin` and a different id; that
 * unique-constraint clash made Credentials login throw and look like a bad password.
 */
export async function ensureMasterAdminUser(): Promise<{ id: string; email: string; name: string }> {
	const passwordHash = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 10);
	const reservedEmails = Array.from(new Set([MASTER_ADMIN_EMAIL, ...LEGACY_ADMIN_EMAILS]));

	const occupants = await prisma.user.findMany({
		where: {
			OR: [{ id: MASTER_ADMIN_ID }, { email: { in: reservedEmails } }],
		},
		select: { id: true, email: true, name: true },
	});

	const canonical = occupants.find((row) => row.id === MASTER_ADMIN_ID);
	const duplicates = occupants.filter((row) => row.id !== MASTER_ADMIN_ID);

	for (const dup of duplicates) {
		await prisma.auditReport.updateMany({
			where: { userId: dup.id },
			data: { userId: MASTER_ADMIN_ID },
		}).catch(() => undefined);
		await prisma.auditLead.updateMany({
			where: { userId: dup.id },
			data: { userId: MASTER_ADMIN_ID },
		}).catch(() => undefined);
		await prisma.user.update({
			where: { id: dup.id },
			data: { email: `legacy-${dup.id.slice(-8)}@redue.local` },
		});
	}

	if (canonical) {
		await prisma.user.update({
			where: { id: MASTER_ADMIN_ID },
			data: {
				email: MASTER_ADMIN_EMAIL,
				name: canonical.name || MASTER_ADMIN_NAME,
				passwordHash,
				role: 'admin',
				planId: 'pro',
			},
		});
		return {
			id: MASTER_ADMIN_ID,
			email: MASTER_ADMIN_EMAIL,
			name: canonical.name || MASTER_ADMIN_NAME,
		};
	}

	const created = await prisma.user.create({
		data: {
			id: MASTER_ADMIN_ID,
			email: MASTER_ADMIN_EMAIL,
			name: MASTER_ADMIN_NAME,
			passwordHash,
			role: 'admin',
			planId: 'pro',
			creditsRemaining: 100,
		},
	});
	return {
		id: created.id,
		email: created.email || MASTER_ADMIN_EMAIL,
		name: created.name || MASTER_ADMIN_NAME,
	};
}
