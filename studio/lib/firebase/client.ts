import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

let cachedApp: FirebaseApp | null = null;

export function isFirebaseClientConfigured(): boolean {
	return Boolean(
		process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
			process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
	);
}

export function getFirebaseClientApp(): FirebaseApp {
	if (cachedApp) return cachedApp;
	if (getApps().length > 0) {
		cachedApp = getApps()[0]!;
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

	cachedApp = initializeApp({
		apiKey,
		authDomain: authDomain || `${projectId}.firebaseapp.com`,
		projectId,
		storageBucket: storageBucket || `${projectId}.appspot.com`,
		messagingSenderId,
		appId,
	});
	return cachedApp;
}

export function getClientFirestore(): Firestore {
	return getFirestore(getFirebaseClientApp());
}
