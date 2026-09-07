import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

let cachedApp: FirebaseApp | null = null;
let cachedFirestore: Firestore | null = null;

export function isFirebaseClientConfigured(): boolean {
	return Boolean(
		process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
			process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
	);
}

export function getFirebaseClientApp(): FirebaseApp {
	if (cachedApp) return cachedApp;
	if (getApps().length > 0) {
		cachedApp = getApp();
		return cachedApp;
	}

	const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
	const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
	const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
	const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
	const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
	const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

	if (!apiKey || !projectId) {
		throw new Error(
			'Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID.',
		);
	}

	try {
		cachedApp = initializeApp({
			apiKey,
			authDomain: authDomain || `${projectId}.firebaseapp.com`,
			projectId,
			storageBucket: storageBucket || `${projectId}.appspot.com`,
			messagingSenderId,
			appId,
		});
	} catch {
		if (getApps().length > 0) {
			cachedApp = getApp();
			return cachedApp;
		}
		throw new Error(
			'Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID.',
		);
	}
	return cachedApp;
}

export function tryGetFirebaseClientApp(): FirebaseApp | null {
	if (!isFirebaseClientConfigured()) return null;
	try {
		return getFirebaseClientApp();
	} catch {
		return null;
	}
}

export function getClientFirestore(): Firestore {
	if (cachedFirestore) return cachedFirestore;
	const app = getFirebaseClientApp();
	try {
		// Must run before any other Firestore call on this app instance (SDK
		// requirement) — drops `undefined` field values instead of throwing
		// ("Cannot use 'undefined' as a Firestore value"), matching JSON.stringify semantics.
		cachedFirestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
	} catch {
		// Firestore was already initialized elsewhere for this app (e.g. HMR
		// re-import) — fall back to the existing instance rather than throwing.
		cachedFirestore = getFirestore(app);
	}
	return cachedFirestore;
}
