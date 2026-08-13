import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

let cachedApp: App | null = null;

function readPrivateKey(): string | null {
	const raw = process.env.FIREBASE_PRIVATE_KEY?.trim();
	if (!raw) return null;
	return raw.replace(/\\n/g, '\n');
}

function resolveServiceAccountPath(): string | null {
	const raw =
		process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
		process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
		'';
	if (!raw) return null;
	const full = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
	return existsSync(full) ? full : null;
}

function loadServiceAccountFromFile(): ServiceAccount | null {
	const path = resolveServiceAccountPath();
	if (!path) return null;
	const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
		project_id?: string;
		client_email?: string;
		private_key?: string;
	};
	if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
		throw new Error(`Invalid Firebase service account JSON at ${path}`);
	}
	return {
		projectId: parsed.project_id,
		clientEmail: parsed.client_email,
		privateKey: parsed.private_key.replace(/\\n/g, '\n'),
	};
}

function loadServiceAccountFromEnv(): ServiceAccount | null {
	const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
	const privateKey = readPrivateKey();
	if (!projectId || !clientEmail || !privateKey) return null;
	if (!privateKey.includes('BEGIN PRIVATE KEY')) return null;
	return { projectId, clientEmail, privateKey };
}

/** True when a JSON key file or valid Admin env credentials are available. */
export function isFirebaseAdminConfigured(): boolean {
	if (resolveServiceAccountPath()) return true;
	return Boolean(loadServiceAccountFromEnv());
}

export function getFirebaseAdminApp(): App {
	if (cachedApp) return cachedApp;
	if (getApps().length > 0) {
		cachedApp = getApps()[0]!;
		return cachedApp;
	}

	const fromFile = loadServiceAccountFromFile();
	const fromEnv = fromFile ? null : loadServiceAccountFromEnv();
	const account = fromFile || fromEnv;

	if (!account) {
		throw new Error(
			'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY_PATH (JSON) or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.',
		);
	}

	const storageBucket =
		process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
		process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
		`${account.projectId}.appspot.com`;

	cachedApp = initializeApp({
		credential: cert(account),
		projectId: account.projectId,
		storageBucket,
	});
	return cachedApp;
}

export function getAdminFirestore(): Firestore {
	return getFirestore(getFirebaseAdminApp());
}

export function getAdminStorage(): Storage {
	return getStorage(getFirebaseAdminApp());
}
