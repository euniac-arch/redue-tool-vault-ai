import {
	isFirebaseStorageConfigured,
	uploadImageToFirebaseStorage,
} from '@/lib/firebase/storage';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
]);

export function assertUploadableImage(file: File | Blob, fileName?: string): void {
	const type = file.type || '';
	if (type && !ALLOWED_TYPES.has(type) && !type.startsWith('image/')) {
		throw new Error('이미지 파일만 업로드할 수 있습니다.');
	}
	if (!type && fileName && !/\.(jpe?g|png|gif|webp|avif)$/i.test(fileName)) {
		throw new Error('지원하지 않는 이미지 형식입니다.');
	}
	if (file.size > MAX_BYTES) {
		throw new Error('이미지 크기는 8MB 이하여야 합니다.');
	}
}

/**
 * Prefer Firebase Storage (client SDK). Fall back to admin upload API
 * (Firebase Admin Storage or local `/public/uploads`).
 */
export async function uploadNaverBlogImage(file: File | Blob, fileName?: string): Promise<string> {
	const name = fileName || (file instanceof File ? file.name : `paste-${Date.now()}.png`);
	assertUploadableImage(file, name);

	if (isFirebaseStorageConfigured()) {
		try {
			return await uploadImageToFirebaseStorage(file, {
				fileName: name,
				folder: 'naver-blog',
			});
		} catch {
			// Fall through to API when Storage rules / network block client upload.
		}
	}

	const form = new FormData();
	form.append('file', file, name);
	const res = await fetch('/api/admin/uploads/image', {
		method: 'POST',
		body: form,
	});
	const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
	if (!res.ok || !data?.url) {
		throw new Error(data?.error || `이미지 업로드에 실패했습니다. (${res.status})`);
	}
	return data.url;
}

export function toMarkdownImageTag(url: string, alt = '이미지'): string {
	const safeAlt = (alt || '이미지').replace(/[[\]]/g, '').trim() || '이미지';
	return `![${safeAlt}](${url})`;
}
