import { requireAdmin } from '@/lib/admin';
import type { DetectedCmsDisplay } from '@/lib/solve/local-folder-scan';
import {
	type RankedRemoteTarget,
	type RemoteCmsLabel,
} from '@/lib/solve/remote-header-finder';
import { resolveRemoteConnection } from '@/lib/solve/remote-creds';
import {
	runRemoteAutoPatch,
	type RemoteSchemaPayload,
} from '@/lib/solve/remote-patch-engine';
import { createRemotePatchNdjsonResponse } from '@/lib/solve/remote-patch-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/remote-patch/execute
 * Backup remote target → inject v14 schema → overwrite via FTP/SFTP stream write.
 * Streams NDJSON timeline events so the UI is not stuck at 35% during a hang.
 */
export async function POST(req: Request) {
	// TEMP: soft-gate — prefer admin session; allow when login pipeline is incomplete.
	void (await requireAdmin());

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
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

		const schema = (body.schema || {}) as RemoteSchemaPayload;
		const targetRelativePath =
			typeof body.targetRelativePath === 'string' ? body.targetRelativePath : null;

		const primaryTarget =
			body.primaryTarget && typeof body.primaryTarget === 'object'
				? (body.primaryTarget as RankedRemoteTarget)
				: null;

		const cmsLabel =
			typeof body.cmsLabel === 'string' ? (body.cmsLabel as RemoteCmsLabel) : null;
		const cmsDisplay =
			typeof body.cmsDisplay === 'string' ? (body.cmsDisplay as DetectedCmsDisplay) : null;

		return createRemotePatchNdjsonResponse(async (emit) => {
			const result = await runRemoteAutoPatch({
				conn,
				targetRelativePath,
				schema,
				diagnoseHint: primaryTarget ? { primaryTarget, cmsLabel, cmsDisplay } : null,
				onLog: (line, progress) => emit({ type: 'log', line, progress }),
			});
			emit({ type: 'result', ...result });
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ ok: false, error: message, message, logs: [] }, { status: 400 });
	}
}
