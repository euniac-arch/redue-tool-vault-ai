/**
 * LocalAndFtpDeployer — write injection plans to a local workspace or FTP/SFTP.
 * Always creates `filename.bak_redue` before mutating a live file, strips an
 * existing REDUE_AI_STUDIO block, then replaces it (no duplicate inject).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { stripRedueSchemaBlocks } from '@/lib/solve/dynamic-php-schema';
import type { RemoteTransport } from '@/lib/solve/remote-transport';
import { injectBeforeClosingHead } from '@/lib/solve/source-mapping';
import type { CmsWritePlan } from '@/lib/solve/adapters/types';

export const REDUE_SIBLING_BACKUP_SUFFIX = '.bak_redue';

export type DeployTarget = {
	relativePath: string;
	content: string;
	mode?: CmsWritePlan['mode'];
};

export type DeployFileResult = {
	relativePath: string;
	backupPath: string | null;
	written: boolean;
	replacedExisting: boolean;
	error?: string;
};

export type DeployReport = {
	ok: boolean;
	results: DeployFileResult[];
	errorMessage: string | null;
};

export function siblingBackupPath(relativePath: string): string {
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return `${normalized}${REDUE_SIBLING_BACKUP_SUFFIX}`;
}

export function hasRedueStudioMarker(source: string): boolean {
	return /REDUE_AI_STUDIO:(START|END)/i.test(source);
}

/** Strip prior markers then insert (create files write as-is). */
export function preparePatchedSource(original: string, plan: DeployTarget): { next: string; replacedExisting: boolean } {
	const replacedExisting = hasRedueStudioMarker(original);
	if (plan.mode === 'create') {
		return { next: plan.content, replacedExisting };
	}
	const cleaned = stripRedueSchemaBlocks(original);
	if (plan.mode === 'patch-render-only' || /<\?php/i.test(plan.content)) {
		const injected = injectBeforeClosingHead(cleaned, plan.content, { targetPath: plan.relativePath });
		if (injected.ok) return { next: injected.result, replacedExisting };
	}
	if (/<\/head>/i.test(cleaned)) {
		return {
			next: cleaned.replace(/<\/head>/i, `${plan.content}\n</head>`),
			replacedExisting,
		};
	}
	if (!cleaned.trim()) return { next: plan.content, replacedExisting };
	return { next: `${cleaned.trimEnd()}\n${plan.content}`, replacedExisting };
}

async function writeLocalFile(rootDir: string, relativePath: string, content: string): Promise<void> {
	const abs = path.join(rootDir, relativePath);
	await fs.mkdir(path.dirname(abs), { recursive: true });
	await fs.writeFile(abs, content, 'utf8');
}

async function readLocalFile(rootDir: string, relativePath: string): Promise<string | null> {
	try {
		return await fs.readFile(path.join(rootDir, relativePath), 'utf8');
	} catch {
		return null;
	}
}

export async function deployLocalWorkspace(opts: {
	rootDir: string;
	targets: DeployTarget[];
}): Promise<DeployReport> {
	const results: DeployFileResult[] = [];
	try {
		for (const target of opts.targets) {
			const backupRel = siblingBackupPath(target.relativePath);
			try {
				const existing = await readLocalFile(opts.rootDir, target.relativePath);
				if (existing != null) {
					await writeLocalFile(opts.rootDir, backupRel, existing);
				}
				const { next, replacedExisting } = preparePatchedSource(existing || '', target);
				await writeLocalFile(opts.rootDir, target.relativePath, next);
				results.push({
					relativePath: target.relativePath,
					backupPath: existing != null ? backupRel : null,
					written: true,
					replacedExisting,
				});
			} catch (error) {
				results.push({
					relativePath: target.relativePath,
					backupPath: null,
					written: false,
					replacedExisting: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		const failed = results.filter((row) => !row.written);
		return {
			ok: failed.length === 0,
			results,
			errorMessage: failed.length ? failed.map((row) => row.error).join('; ') : null,
		};
	} catch (error) {
		return {
			ok: false,
			results,
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function deployViaFtp(opts: {
	transport: RemoteTransport;
	remoteRoot: string;
	targets: DeployTarget[];
}): Promise<DeployReport> {
	const results: DeployFileResult[] = [];
	const joinRemote = (rel: string) =>
		`${opts.remoteRoot.replace(/\/+$/, '')}/${rel.replace(/^\/+/, '')}`;

	try {
		for (const target of opts.targets) {
			const liveAbs = joinRemote(target.relativePath);
			const backupRel = siblingBackupPath(target.relativePath);
			const backupAbs = joinRemote(backupRel);
			try {
				let existing = '';
				let hadFile = false;
				try {
					if (await opts.transport.exists(liveAbs)) {
						existing = await opts.transport.readText(liveAbs);
						hadFile = true;
					}
				} catch {
					hadFile = false;
				}
				if (hadFile) {
					await opts.transport.ensureDir(backupAbs.replace(/\/[^/]+$/, '') || opts.remoteRoot);
					await opts.transport.writeText(backupAbs, existing);
				}
				const { next, replacedExisting } = preparePatchedSource(existing, target);
				await opts.transport.ensureDir(liveAbs.replace(/\/[^/]+$/, '') || opts.remoteRoot);
				await opts.transport.writeText(liveAbs, next);
				results.push({
					relativePath: target.relativePath,
					backupPath: hadFile ? backupRel : null,
					written: true,
					replacedExisting,
				});
			} catch (error) {
				results.push({
					relativePath: target.relativePath,
					backupPath: null,
					written: false,
					replacedExisting: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		const failed = results.filter((row) => !row.written);
		return {
			ok: failed.length === 0,
			results,
			errorMessage: failed.length ? failed.map((row) => row.error).join('; ') : null,
		};
	} catch (error) {
		return {
			ok: false,
			results,
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	}
}

export function plansToDeployTargets(plans: CmsWritePlan[]): DeployTarget[] {
	return plans.map((plan) => ({
		relativePath: plan.relativePath,
		content: plan.content,
		mode: plan.mode,
	}));
}
