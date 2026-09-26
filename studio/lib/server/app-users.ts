import 'server-only';

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';

/** Shared across Vercel instances. SQLite under /tmp is not. */
export const APP_USERS_COLLECTION = 'app_users';

export type DurableAuthProvider = 'email' | 'kakao' | 'google' | 'naver';

export type DurableAppUser = {
	id: string;
	email: string;
	name: string | null;
	phone: string | null;
	passwordHash: string | null;
	role: string;
	planId: string;
	creditsRemaining: number;
	status: string;
	memo: string;
	image: string | null;
	provider: DurableAuthProvider;
	createdAt: string;
	lastLoginAt: string | null;
};

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asProvider(value: unknown): DurableAuthProvider {
	if (value === 'kakao' || value === 'google' || value === 'naver' || value === 'email') return value;
	return 'email';
}

function fromDoc(id: string, data: Record<string, unknown>): DurableAppUser | null {
	const email = asString(data.email)?.toLowerCase();
	if (!email) return null;
	const createdAt = asString(data.createdAt) || new Date(0).toISOString();
	return {
		id: asString(data.id) || id,
		email,
		name: asString(data.name),
		phone: asString(data.phone),
		passwordHash: asString(data.passwordHash),
		role: asString(data.role) || 'user',
		planId: asString(data.planId) || 'starter',
		creditsRemaining: Number.isFinite(Number(data.creditsRemaining)) ? Number(data.creditsRemaining) : 0,
		status: asString(data.status) || 'active',
		memo: typeof data.memo === 'string' ? data.memo : '',
		image: asString(data.image),
		provider: asProvider(data.provider),
		createdAt,
		lastLoginAt: asString(data.lastLoginAt),
	};
}

function storedFields(user: DurableAppUser): Record<string, unknown> {
	return {
		id: user.id,
		email: user.email.toLowerCase(),
		name: user.name,
		phone: user.phone,
		passwordHash: user.passwordHash,
		role: user.role || 'user',
		planId: user.planId || 'starter',
		creditsRemaining: user.creditsRemaining,
		status: user.status || 'active',
		memo: user.memo || '',
		image: user.image,
		provider: user.provider || 'email',
		createdAt: user.createdAt,
		lastLoginAt: user.lastLoginAt,
		updatedAt: new Date().toISOString(),
	};
}

export async function findDurableUserByEmail(email: string): Promise<DurableAppUser | null> {
	if (!isFirebaseAdminConfigured()) return null;
	const normalized = email.trim().toLowerCase();
	if (!normalized) return null;
	try {
		const snap = await getAdminFirestore()
			.collection(APP_USERS_COLLECTION)
			.where('email', '==', normalized)
			.limit(1)
			.get();
		const doc = snap.docs[0];
		if (!doc) return null;
		return fromDoc(doc.id, doc.data() as Record<string, unknown>);
	} catch (error) {
		console.error('[app-users] firestore lookup by email failed', { email: normalized, error });
		return null;
	}
}

export async function findDurableUserById(id: string): Promise<DurableAppUser | null> {
	if (!isFirebaseAdminConfigured() || !id) return null;
	try {
		const doc = await getAdminFirestore().collection(APP_USERS_COLLECTION).doc(id).get();
		if (!doc.exists) return null;
		return fromDoc(doc.id, doc.data() as Record<string, unknown>);
	} catch (error) {
		console.error('[app-users] firestore lookup by id failed', { id, error });
		return null;
	}
}

export async function listDurableUsers(): Promise<DurableAppUser[]> {
	if (!isFirebaseAdminConfigured()) return [];
	try {
		const snap = await getAdminFirestore().collection(APP_USERS_COLLECTION).get();
		return snap.docs
			.map((doc) => fromDoc(doc.id, doc.data() as Record<string, unknown>))
			.filter((user): user is DurableAppUser => Boolean(user));
	} catch (error) {
		console.error('[app-users] firestore list failed', error);
		throw error;
	}
}

/** Admin SDK write. Fails loudly so signup cannot report success without a shared row. */
export async function upsertDurableUser(user: DurableAppUser): Promise<void> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase Admin is not configured');
	}
	await getAdminFirestore().collection(APP_USERS_COLLECTION).doc(user.id).set(storedFields(user), { merge: true });
}

export async function updateDurableUser(
	id: string,
	patch: Partial<Pick<DurableAppUser, 'status' | 'role' | 'memo' | 'planId' | 'creditsRemaining' | 'name' | 'phone' | 'lastLoginAt'>>,
): Promise<DurableAppUser | null> {
	if (!isFirebaseAdminConfigured()) return null;
	const ref = getAdminFirestore().collection(APP_USERS_COLLECTION).doc(id);
	const existing = await ref.get();
	if (!existing.exists) return null;
	await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
	const next = await ref.get();
	return fromDoc(next.id, (next.data() || {}) as Record<string, unknown>);
}

export async function deleteDurableUser(id: string): Promise<void> {
	if (!isFirebaseAdminConfigured() || !id) return;
	await getAdminFirestore().collection(APP_USERS_COLLECTION).doc(id).delete();
}

/** Copy a Prisma user into Firestore so other serverless instances can list and sign in. */
export async function mirrorPrismaUserByEmail(email: string | null | undefined): Promise<void> {
	const normalized = email?.trim().toLowerCase();
	if (!normalized || !isFirebaseAdminConfigured()) return;
	const user = await prisma.user.findUnique({
		where: { email: normalized },
		include: { accounts: { select: { provider: true } } },
	});
	if (!user?.id || !user.email) return;
	const providers = new Set(user.accounts.map((account) => account.provider.toLowerCase()));
	const provider: DurableAuthProvider = providers.has('kakao')
		? 'kakao'
		: providers.has('google')
			? 'google'
			: providers.has('naver')
				? 'naver'
				: 'email';
	await upsertDurableUser({
		id: user.id,
		email: user.email.toLowerCase(),
		name: user.name,
		phone: user.phone,
		passwordHash: user.passwordHash,
		role: user.role || 'user',
		planId: user.planId || 'starter',
		creditsRemaining: user.creditsRemaining,
		status: user.status || 'active',
		memo: user.memo || '',
		image: user.image,
		provider,
		createdAt: user.createdAt.toISOString(),
		lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
	});
}
