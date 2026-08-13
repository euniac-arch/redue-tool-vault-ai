/**
 * Universal Remote Auto-Patch Engine:
 * diagnose CMS/header → hierarchical `_redue_backups/{stamp}_{domain}` backup
 * → inject v14 dynamic schema → overwrite → one-click restore.
 */

import {
	buildSchemaMappingJson,
	generateDynamicPhpSchema,
	prepareHeadSourceForInject,
	shouldUseDynamicPhpSchema,
	type AuditPageMeta,
	type SchemaNavItem,
} from '@/lib/solve/dynamic-php-schema';
import {
	domainFromTargetUrl,
	formatBackupFolderName,
} from '@/lib/solve/local-fs-patch';
import {
	buildDefaultInjectSnippet,
	injectBeforeClosingHead,
} from '@/lib/solve/source-mapping';
import type { RemoteConnectionInput } from '@/lib/solve/remote-creds';
import {
	diagnoseRemoteHeaderTargets,
	type RankedRemoteTarget,
	type RemoteDiagnoseResult,
} from '@/lib/solve/remote-header-finder';
import {
	connectRemoteTransport,
	toAbsoluteRemotePath,
	type RemoteTransport,
} from '@/lib/solve/remote-transport';

export type RemoteSchemaPayload = {
	siteName?: string;
	targetUrl?: string;
	pages?: AuditPageMeta[];
	industryType?: string;
	cmsType?: string;
	navItems?: SchemaNavItem[];
	footerText?: string;
	legalName?: string;
};

export type RemotePatchExecuteResult = {
	ok: boolean;
	backupFolderName: string | null;
	backupAbsolutePath: string | null;
	targetPath: string | null;
	targetAbsolutePath: string | null;
	cmsLabel: string | null;
	engine: 'php-dynamic' | 'html-static' | null;
	anchor: string | null;
	warning: string | null;
	message: string;
	logs: string[];
};

export type RemoteRestoreResult = {
	ok: boolean;
	backupFolderName: string | null;
	restoredCount: number;
	message: string;
	logs: string[];
};

function dirnameRemote(absolutePath: string): string {
	const p = absolutePath.replace(/\\/g, '/');
	const idx = p.lastIndexOf('/');
	if (idx <= 0) return '/';
	return p.slice(0, idx) || '/';
}

function basenameRemote(absolutePath: string): string {
	const parts = absolutePath.replace(/\\/g, '/').split('/').filter(Boolean);
	return parts[parts.length - 1] || '';
}

export function buildRemoteInjectSnippet(
	relativePath: string,
	payload: RemoteSchemaPayload,
): { snippet: string; engine: 'php-dynamic' | 'html-static' } {
	const cmsType = payload.cmsType || 'Custom HTML/PHP';
	const siteName = payload.siteName || 'Site';

	if (shouldUseDynamicPhpSchema(relativePath)) {
		const mapping = buildSchemaMappingJson({
			siteName,
			targetUrl: payload.targetUrl,
			pages: payload.pages || [],
			industryType: payload.industryType,
			cmsType,
			navItems: payload.navItems,
		});
		const snippet = generateDynamicPhpSchema(mapping, {
			siteName,
			targetUrl: payload.targetUrl,
			industryType: payload.industryType,
			cmsType,
			navItems: payload.navItems,
			footerText: payload.footerText,
			legalName: payload.legalName,
		});
		return { snippet, engine: 'php-dynamic' };
	}

	return {
		snippet: buildDefaultInjectSnippet({
			cmsType,
			targetUrl: payload.targetUrl,
			siteName,
		}),
		engine: 'html-static',
	};
}

export async function runRemoteDiagnose(
	conn: RemoteConnectionInput,
): Promise<RemoteDiagnoseResult & { protocol: string; host: string; remoteRoot: string }> {
	let transport: RemoteTransport | null = null;
	try {
		transport = await connectRemoteTransport(conn);
		const result = await diagnoseRemoteHeaderTargets(transport);
		return {
			...result,
			protocol: conn.protocol,
			host: conn.host,
			remoteRoot: conn.remoteRoot,
		};
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

export async function runRemoteAutoPatch(opts: {
	conn: RemoteConnectionInput;
	/** Prefer this relative path; otherwise use diagnosed primary. */
	targetRelativePath?: string | null;
	schema: RemoteSchemaPayload;
	/** Pre-diagnosed targets (optional — re-diagnoses when omitted). */
	diagnoseHint?: {
		primaryTarget: RankedRemoteTarget | null;
		cmsLabel?: string | null;
		cmsDisplay?: string | null;
	} | null;
}): Promise<RemotePatchExecuteResult> {
	const logs: string[] = [];
	let transport: RemoteTransport | null = null;

	try {
		logs.push(`${opts.conn.protocol.toUpperCase()} ${opts.conn.host}:${opts.conn.port} 접속…`);
		transport = await connectRemoteTransport(opts.conn);
		logs.push(`[✅ 원격 접속 성공] 루트=${opts.conn.remoteRoot}`);

		let primary: RankedRemoteTarget | null = opts.diagnoseHint?.primaryTarget || null;
		let cmsLabel: string | null = opts.diagnoseHint?.cmsLabel || null;
		let cmsDisplay: string =
			opts.diagnoseHint?.cmsDisplay || opts.schema.cmsType || 'Custom HTML/PHP';

		const hintedPath = opts.targetRelativePath?.trim() || primary?.relativePath || null;
		if (!hintedPath) {
			const diagnosed = await diagnoseRemoteHeaderTargets(transport);
			logs.push(...diagnosed.logs);
			primary = diagnosed.primaryTarget;
			cmsLabel = diagnosed.cmsLabel;
			cmsDisplay = diagnosed.cmsDisplay;
		}

		const relativePath = hintedPath || primary?.relativePath || null;

		if (!relativePath) {
			return {
				ok: false,
				backupFolderName: null,
				backupAbsolutePath: null,
				targetPath: null,
				targetAbsolutePath: null,
				cmsLabel,
				engine: null,
				anchor: null,
				warning: null,
				message: '원격 공통 헤더 타겟을 찾지 못했습니다.',
				logs,
			};
		}

		const targetAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, relativePath);
		logs.push(`타겟 파일 읽기: ${relativePath}`);

		const original = await transport.readText(targetAbs);
		const domain = domainFromTargetUrl(opts.schema.targetUrl);
		const backupFolderName = formatBackupFolderName(new Date(), domain);
		const backupDirAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, backupFolderName);
		const backupFileAbs = toAbsoluteRemotePath(
			opts.conn.remoteRoot,
			`${backupFolderName}/${relativePath.replace(/^\/+/, '')}`,
		);

		logs.push(`원격 계층형 백업 폴더 생성: ${backupFolderName}`);
		await transport.ensureDir(dirnameRemote(backupFileAbs));
		await transport.writeText(backupFileAbs, original);
		logs.push(`[✅ 원격 계층형 백업 성공] → ${backupFileAbs}`);

		const schemaCms = opts.schema.cmsType || String(cmsDisplay);
		const { snippet, engine } = buildRemoteInjectSnippet(relativePath, {
			...opts.schema,
			cmsType: schemaCms,
		});

		// Preserve all existing HTML/meta/verification — only strip prior REDUE, then top-inject
		const prepared = prepareHeadSourceForInject(original);
		const injected = injectBeforeClosingHead(prepared, snippet);
		if (!injected.ok) {
			return {
				ok: false,
				backupFolderName,
				backupAbsolutePath: backupDirAbs,
				targetPath: relativePath,
				targetAbsolutePath: targetAbs,
				cmsLabel,
				engine,
				anchor: injected.anchor,
				warning: injected.warning,
				message: `주입 앵커를 찾지 못했습니다 (${relativePath}). 백업만 완료되었으며 원본은 수정하지 않았습니다.`,
				logs: [
					...logs,
					`주입 실패: 첫 <?php / </head> / wp_head() 앵커 없음 — ${injected.warning || 'unknown'}`,
				],
			};
		}

		logs.push(
			`v30 Top-Priority 주입 완료 (${engine}, anchor=${injected.anchor}) — Precision Canonical & Full-Document Defer · 기존 meta 보존 · 원격 Overwrite 업로드…`,
		);
		await transport.writeText(targetAbs, injected.result);
		logs.push(`[🚀 원격 파일(${relativePath}) v30 Precision Canonical & Full-Document Defer Master Engine 주입 완료]`);

		return {
			ok: true,
			backupFolderName,
			backupAbsolutePath: backupDirAbs,
			targetPath: relativePath,
			targetAbsolutePath: targetAbs,
			cmsLabel,
			engine,
			anchor: injected.anchor,
			warning: injected.warning,
			message: `[✅ 원격 계층형 백업 성공] ➔ [🚀 원격 파일(${relativePath}) v30 Top-Priority Precision Canonical & Full-Document Defer 주입 완료 · 기존 meta 보존]`,
			logs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logs.push(`오류: ${message}`);
		return {
			ok: false,
			backupFolderName: null,
			backupAbsolutePath: null,
			targetPath: null,
			targetAbsolutePath: null,
			cmsLabel: null,
			engine: null,
			anchor: null,
			warning: null,
			message,
			logs,
		};
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

/**
 * One-click remote rollback from `_redue_backups/{stamp}_{domain}/…` (or legacy flat folder).
 */
export async function runRemoteRestore(opts: {
	conn: RemoteConnectionInput;
	backupFolderName: string;
	/** Relative paths under the backup session; when omitted, restore only `targetRelativePath`. */
	relativePaths?: string[];
	targetRelativePath?: string | null;
}): Promise<RemoteRestoreResult> {
	const logs: string[] = [];
	let transport: RemoteTransport | null = null;
	const backupFolderName = opts.backupFolderName.replace(/^\/+/, '').replace(/\\/g, '/');

	try {
		transport = await connectRemoteTransport(opts.conn);
		logs.push(`[✅ 원격 접속 성공] 복원 세션=${backupFolderName}`);

		const paths =
			opts.relativePaths?.map((p) => p.replace(/^\/+/, '')) ||
			(opts.targetRelativePath ? [opts.targetRelativePath.replace(/^\/+/, '')] : []);

		if (paths.length === 0) {
			return {
				ok: false,
				backupFolderName,
				restoredCount: 0,
				message: '복원 대상 파일 경로가 없습니다.',
				logs,
			};
		}

		let restoredCount = 0;
		for (const rel of paths) {
			const backupAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, `${backupFolderName}/${rel}`);
			const liveAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, rel);
			logs.push(`원클릭 복원: ${backupAbs} → ${liveAbs}`);
			const original = await transport.readText(backupAbs);
			await transport.ensureDir(dirnameRemote(liveAbs));
			await transport.writeText(liveAbs, original);
			restoredCount += 1;
		}

		return {
			ok: true,
			backupFolderName,
			restoredCount,
			message: `[✅ 원클릭 복원 완료] ${restoredCount}개 파일 롤백 (${backupFolderName})`,
			logs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logs.push(`복원 오류: ${message}`);
		return {
			ok: false,
			backupFolderName,
			restoredCount: 0,
			message,
			logs,
		};
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

/** Soft helper for UI — unused basename kept for future multi-file patch. */
export function remoteBackupSiblingName(targetAbsolutePath: string, backupFolder: string): string {
	return `${backupFolder}/${basenameRemote(targetAbsolutePath)}`;
}
