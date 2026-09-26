import 'server-only';

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { normalizeEmail, normalizeName, phonesMatch } from '@/lib/auth-account';
import { prisma } from '@/lib/prisma';
import { findDurableUserByEmail, listDurableUsers, type DurableAppUser } from '@/lib/server/app-users';

export const PASSWORD_RESET_COLLECTION = 'password_reset_tokens';

export type AccountMatch = {
	id: string;
	email: string;
	name: string | null;
	phone: string | null;
	passwordHash: string | null;
};

function remember(matches: Map<string, AccountMatch>, row: AccountMatch) {
	const email = row.email.trim().toLowerCase();
	if (!email) return;
	const current = matches.get(email);
	matches.set(email, {
		id: row.id || current?.id || email,
		email,
		name: row.name ?? current?.name ?? null,
		phone: row.phone ?? current?.phone ?? null,
		passwordHash: row.passwordHash || current?.passwordHash || null,
	});
}

export async function findAccountsByNameAndPhone(name: string, phone: string): Promise<AccountMatch[]> {
	const normalizedName = normalizeName(name);
	const matches = new Map<string, AccountMatch>();

	try {
		const rows = await prisma.user.findMany({
			where: { phone: { not: null } },
			select: { id: true, email: true, name: true, phone: true, passwordHash: true },
		});
		for (const row of rows) {
			if (!row.email) continue;
			if (normalizeName(row.name || '') !== normalizedName) continue;
			if (!phonesMatch(row.phone, phone)) continue;
			remember(matches, {
				id: row.id,
				email: row.email,
				name: row.name,
				phone: row.phone,
				passwordHash: row.passwordHash,
			});
		}
	} catch (error) {
		console.error('[account-lookup] prisma name/phone query failed', error);
	}

	let durable: DurableAppUser[] = [];
	try {
		durable = await listDurableUsers();
	} catch (error) {
		console.error('[account-lookup] shared name/phone query failed', error);
	}
	for (const row of durable) {
		if (normalizeName(row.name || '') !== normalizedName) continue;
		if (!phonesMatch(row.phone, phone)) continue;
		remember(matches, {
			id: row.id,
			email: row.email,
			name: row.name,
			phone: row.phone,
			passwordHash: row.passwordHash,
		});
	}

	return [...matches.values()];
}

export async function findAccountByEmail(email: string): Promise<AccountMatch | null> {
	const normalized = normalizeEmail(email);
	if (!normalized) return null;

	let prismaUser: AccountMatch | null = null;
	try {
		const row = await prisma.user.findUnique({
			where: { email: normalized },
			select: { id: true, email: true, name: true, phone: true, passwordHash: true },
		});
		if (row?.email) {
			prismaUser = {
				id: row.id,
				email: row.email.toLowerCase(),
				name: row.name,
				phone: row.phone,
				passwordHash: row.passwordHash,
			};
		}
	} catch (error) {
		console.error('[account-lookup] prisma email query failed', error);
	}

	const durable = await findDurableUserByEmail(normalized);
	if (!prismaUser && !durable) return null;
	return {
		id: prismaUser?.id || durable?.id || normalized,
		email: normalized,
		name: prismaUser?.name ?? durable?.name ?? null,
		phone: prismaUser?.phone ?? durable?.phone ?? null,
		passwordHash: prismaUser?.passwordHash || durable?.passwordHash || null,
	};
}

export async function saveSharedResetToken(email: string, tokenHash: string, expires: Date): Promise<boolean> {
	if (!isFirebaseAdminConfigured()) return false;
	const normalized = normalizeEmail(email);
	await getAdminFirestore().collection(PASSWORD_RESET_COLLECTION).doc(normalized).set({
		email: normalized,
		tokenHash,
		expires: expires.toISOString(),
		updatedAt: new Date().toISOString(),
	});
	return true;
}

export async function readSharedResetToken(email: string): Promise<{ tokenHash: string; expires: string } | null> {
	if (!isFirebaseAdminConfigured()) return null;
	const normalized = normalizeEmail(email);
	try {
		const doc = await getAdminFirestore().collection(PASSWORD_RESET_COLLECTION).doc(normalized).get();
		if (!doc.exists) return null;
		const data = doc.data() as { tokenHash?: string; expires?: string } | undefined;
		if (!data?.tokenHash || !data.expires) return null;
		return { tokenHash: data.tokenHash, expires: data.expires };
	} catch (error) {
		console.error('[account-lookup] shared reset token read failed', error);
		return null;
	}
}

export async function deleteSharedResetToken(email: string): Promise<void> {
	if (!isFirebaseAdminConfigured()) return;
	const normalized = normalizeEmail(email);
	await getAdminFirestore().collection(PASSWORD_RESET_COLLECTION).doc(normalized).delete().catch((error) => {
		console.error('[account-lookup] shared reset token delete failed', error);
	});
}
