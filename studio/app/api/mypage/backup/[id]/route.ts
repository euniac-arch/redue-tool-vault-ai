import fs from 'node:fs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/mypage/backup/[id] — streams the pre-injection backup zip for a
 * single InjectionHistory row, after verifying it belongs to the caller.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const record = await prisma.injectionHistory.findUnique({ where: { id: params.id } });
	if (!record || record.userId !== session.user.id) {
		return NextResponse.json({ error: '백업을 찾을 수 없습니다.' }, { status: 404 });
	}
	if (!record.backupZipPath || !fs.existsSync(record.backupZipPath)) {
		return NextResponse.json({ error: '백업 파일이 존재하지 않습니다.' }, { status: 404 });
	}

	const buffer = fs.readFileSync(record.backupZipPath);
	const fileName = `backup-${record.id}.zip`;

	return new NextResponse(buffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${fileName}"`,
		},
	});
}
