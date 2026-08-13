import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { resolveRemoteConnection } from '@/lib/solve/remote-creds';
import { runRemoteRestore } from '@/lib/solve/remote-patch-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/remote-patch/restore
 * One-click rollback from `_redue_backups/{TIMESTAMP}_{DOMAIN}/…` on remote FTP/SFTP.
 */
export async function POST(req: Request) {
	void (await requireAdmin());

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		const backupFolderName =
			typeof body.backupFolderName === 'string' ? body.backupFolderName.trim() : '';
		if (!backupFolderName) {
			return NextResponse.json(
				{ ok: false, error: 'backupFolderName is required', message: 'backupFolderName is required' },
				{ status: 400 },
			);
		}

		const conn = resolveRemoteConnection({
			sessionToken: typeof body.sessionToken === 'string' ? body.sessionToken : undefined,
			protocol: body.protocol === 'ftp' ? 'ftp' : 'sftp',
			host: typeof body.host === 'string' ? body.host : undefined,
			port: typeof body.port === 'number' ? body.port : Number(body.port) || undefined,
			username: typeof body.username === 'string' ? body.username : undefined,
			password: typeof body.password === 'string' ? body.password : undefined,
			remoteRoot:
				typeof body.remoteRoot === 'string'
					? body.remoteRoot
					: typeof body.targetDir === 'string'
						? body.targetDir
						: undefined,
		});

		const relativePaths = Array.isArray(body.relativePaths)
			? body.relativePaths.filter((p): p is string => typeof p === 'string')
			: undefined;
		const targetRelativePath =
			typeof body.targetRelativePath === 'string' ? body.targetRelativePath : null;

		const result = await runRemoteRestore({
			conn,
			backupFolderName,
			relativePaths,
			targetRelativePath,
		});

		return NextResponse.json(result, { status: result.ok ? 200 : 422 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: message, message, logs: [] }, { status: 400 });
	}
}
