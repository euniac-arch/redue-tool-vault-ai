import 'server-only';

import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

/**
 * Process-wide singleton slots. Next.js HMR and multi-chunk imports reset
 * module-level `let` caches while the Admin SDK app (and its Firestore
 * settings) stay alive on `globalThis` — calling `settings()` again then
 * throws "Firestore has already been initialized".
 */
type FirebaseAdminGlobals = {
	__redueFirebaseAdminApp?: App;
	__redueFirebaseAdminFirestore?: Firestore;
};

function adminGlobals(): FirebaseAdminGlobals {
	return globalThis as typeof globalThis & FirebaseAdminGlobals;
}

let cachedApp: App | null = null;
let cachedFirestore: Firestore | null = null;

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
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
			project_id?: string;
			client_email?: string;
			private_key?: string;
		};
		if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
		return {
			projectId: parsed.project_id,
			clientEmail: parsed.client_email,
			privateKey: parsed.private_key.replace(/\\n/g, '\n'),
		};
	} catch {
		return null;
	}
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
	return Boolean(loadServiceAccountFromFile() || loadServiceAccountFromEnv());
}

export function describeFirebaseAdminSetup(): {
	configured: boolean;
	missing: string[];
	hint: string;
} {
	const configured = isFirebaseAdminConfigured();
	if (configured) return { configured: true, missing: [], hint: '' };

	const missing: string[] = [];
	if (!resolveServiceAccountPath()) missing.push('FIREBASE_SERVICE_ACCOUNT_KEY_PATH');
	if (!process.env.FIREBASE_PROJECT_ID?.trim()) missing.push('FIREBASE_PROJECT_ID');
	if (!process.env.FIREBASE_CLIENT_EMAIL?.trim()) missing.push('FIREBASE_CLIENT_EMAIL');
	if (!process.env.FIREBASE_PRIVATE_KEY?.trim()) missing.push('FIREBASE_PRIVATE_KEY');

	return {
		configured: false,
		missing,
		hint: `Firestore 연동을 쓰려면 .env.local에 FIREBASE_SERVICE_ACCOUNT_KEY_PATH(서비스 계정 JSON) 또는 FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY 를 등록하세요.`,
	};
}

export function getFirebaseAdminApp(): App {
	if (cachedApp) return cachedApp;

	const g = adminGlobals();
	if (g.__redueFirebaseAdminApp) {
		cachedApp = g.__redueFirebaseAdminApp;
		return cachedApp;
	}

	if (getApps().length > 0) {
		cachedApp = getApp();
		g.__redueFirebaseAdminApp = cachedApp;
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

	try {
		cachedApp = initializeApp({
			credential: cert(account),
			projectId: account.projectId,
			storageBucket,
		});
	} catch (error) {
		if (getApps().length > 0) {
			cachedApp = getApp();
		} else {
			throw error;
		}
	}
	g.__redueFirebaseAdminApp = cachedApp;
	return cachedApp;
}

export function tryGetFirebaseAdminApp(): App | null {
	try {
		return getFirebaseAdminApp();
	} catch {
		return null;
	}
}

/**
 * Process-wide Firestore singleton. Callers (including API routes) must use
 * this helper — never `initializeApp()` / `settings()` / `initializeFirestore()`
 * inside a request handler.
 */
export function getAdminFirestore(): Firestore {
	if (cachedFirestore) return cachedFirestore;

	const g = adminGlobals();
	if (g.__redueFirebaseAdminFirestore) {
		cachedFirestore = g.__redueFirebaseAdminFirestore;
		return cachedFirestore;
	}

	const firestore = getFirestore(getFirebaseAdminApp());

	try {
		// First init only. `settings()` may run once per app, and only before
		// any other Firestore method — a second call throws
		// "Firestore has already been initialized".
		firestore.settings({ ignoreUndefinedProperties: true });
	} catch {
		// HMR / another chunk already applied settings on this instance.
	}

	cachedFirestore = firestore;
	g.__redueFirebaseAdminFirestore = firestore;
	return cachedFirestore;
}

export function getAdminStorage(): Storage {
	return getStorage(getFirebaseAdminApp());
}
