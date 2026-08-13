import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseClientApp, isFirebaseClientConfigured } from '@/lib/firebase/client';

export function isFirebaseStorageConfigured(): boolean {
	return isFirebaseClientConfigured();
}

/**
 * Upload an image via the Firebase client SDK.
 * Path: `naver-blog/{yyyy}/{mm}/{uuid}-{safeName}`
 */
export async function uploadImageToFirebaseStorage(
	file: File | Blob,
	options?: { fileName?: string; folder?: string },
): Promise<string> {
	if (!isFirebaseClientConfigured()) {
		throw new Error('Firebase client is not configured.');
	}

	const folder = (options?.folder || 'naver-blog').replace(/^\/+|\/+$/g, '');
	const now = new Date();
	const yyyy = String(now.getFullYear());
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const rawName = options?.fileName || (file instanceof File ? file.name : 'image.png');
	const safeName = rawName.replace(/[^\w.\-가-힣]+/g, '_').slice(0, 80) || 'image.png';
	const objectPath = `${folder}/${yyyy}/${mm}/${crypto.randomUUID()}-${safeName}`;

	const storage = getStorage(getFirebaseClientApp());
	const objectRef = ref(storage, objectPath);
	const contentType =
		file.type ||
		(safeName.toLowerCase().endsWith('.png')
			? 'image/png'
			: safeName.toLowerCase().endsWith('.webp')
				? 'image/webp'
				: safeName.toLowerCase().endsWith('.gif')
					? 'image/gif'
					: 'image/jpeg');

	await uploadBytes(objectRef, file, { contentType });
	return getDownloadURL(objectRef);
}
