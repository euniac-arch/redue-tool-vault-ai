import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { resolveRemoteConnection, sealRemoteCredentials } from '@/lib/solve/remote-creds';
import { runRemoteDiagnose } from '@/lib/solve/remote-patch-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/remote-patch/diagnose
 * Connect via FTP/SFTP, scan CMS structure, rank primary header target.
 * Returns a short-lived encrypted sessionToken (password never stored plaintext).
 */
export async function POST(req: Request) {
	// TEMP: soft-gate — prefer admin session; allow when login pipeline is incomplete
	// (same pattern as /api/admin/projects). Credentials are still sealed server-side.
	void (await requireAdmin());

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		const conn = resolveRemoteConnection({
			protocol: body.protocol === 'ftp' ? 'ftp' : 'sftp',
			host: String(body.host || ''),
			port: Number(body.port) || 0,
			username: String(body.username || ''),
			password: String(body.password ?? ''),
			remoteRoot: String(body.remoteRoot || body.targetDir || '/'),
		});

		const diagnosed = await runRemoteDiagnose(conn);
		const sessionToken = sealRemoteCredentials(conn);

		return NextResponse.json({
			ok: diagnosed.ok,
			sessionToken,
			protocol: diagnosed.protocol,
			host: diagnosed.host,
			remoteRoot: diagnosed.remoteRoot,
			cmsDisplay: diagnosed.cmsDisplay,
			cmsLabel: diagnosed.cmsLabel,
			cmsMessage: diagnosed.cmsMessage,
			confidence: diagnosed.confidence,
			signals: diagnosed.signals,
			scannedPathCount: diagnosed.scannedPathCount,
			truncated: diagnosed.truncated,
			primaryTarget: diagnosed.primaryTarget,
			targets: diagnosed.targets,
			logs: diagnosed.logs,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: message }, { status: 400 });
	}
}
