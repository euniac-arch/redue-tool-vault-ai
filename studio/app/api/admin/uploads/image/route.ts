import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminStorage, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
]);

function extensionFor(fileName: string, mime: string): string {
	const fromName = extname(fileName).toLowerCase();
	if (fromName && fromName.length <= 6) return fromName;
	if (mime === 'image/png') return '.png';
	if (mime === 'image/webp') return '.webp';
	if (mime === 'image/gif') return '.gif';
	if (mime === 'image/avif') return '.avif';
	return '.jpg';
}

async function uploadViaFirebaseAdmin(
	buffer: Buffer,
	objectPath: string,
	contentType: string,
): Promise<string> {
	const bucket = getAdminStorage().bucket();
	const file = bucket.file(objectPath);
	const token = crypto.randomUUID();
	await file.save(buffer, {
		metadata: {
			contentType,
			cacheControl: 'public,max-age=31536000',
			metadata: { firebaseStorageDownloadTokens: token },
		},
		resumable: false,
	});
	const encoded = encodeURIComponent(objectPath);
	return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
}

async function uploadLocally(buffer: Buffer, relativePosixPath: string): Promise<string> {
	const segments = relativePosixPath.split('/').filter(Boolean);
	const abs = join(process.cwd(), 'public', ...segments);
	await mkdir(dirname(abs), { recursive: true });
	await writeFile(abs, buffer);
	return `/${segments.join('/')}`;
}

/**
 * POST /api/admin/uploads/image
 * multipart form field: `file`
 */
export async function POST(req: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let form: FormData;
	try {
		form = await req.formData();
	} catch {
		return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
	}

	const entry = form.get('file');
	if (!(entry instanceof File)) {
		return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 });
	}

	const mime = entry.type || 'application/octet-stream';
	if (!ALLOWED.has(mime) && !mime.startsWith('image/')) {
		return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
	}
	if (entry.size > MAX_BYTES) {
		return NextResponse.json({ error: '이미지 크기는 8MB 이하여야 합니다.' }, { status: 400 });
	}

	const buffer = Buffer.from(await entry.arrayBuffer());
	const now = new Date();
	const yyyy = String(now.getFullYear());
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const ext = extensionFor(entry.name || 'image', mime);
	const base = (entry.name || 'image')
		.replace(extname(entry.name || ''), '')
		.replace(/[^\w.\-가-힣]+/g, '_')
		.slice(0, 60) || 'image';
	const fileName = `${crypto.randomUUID()}-${base}${ext}`;
	const objectPath = `naver-blog/${yyyy}/${mm}/${fileName}`;

	try {
		if (isFirebaseAdminConfigured()) {
			const url = await uploadViaFirebaseAdmin(buffer, objectPath, mime);
			return NextResponse.json({ url, provider: 'firebase-admin' });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Firebase Storage upload failed';
		// Fall through to local disk when Admin Storage is misconfigured.
		console.warn('[uploads/image] Firebase Admin upload failed:', message);
	}

	try {
		const url = await uploadLocally(buffer, `uploads/${objectPath}`);
		return NextResponse.json({ url, provider: 'local' });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Local upload failed';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
