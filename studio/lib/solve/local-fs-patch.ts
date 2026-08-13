/**
 * Browser File System Access API helpers:
 * pick project folder → hierarchical `_redue_backups/{TIMESTAMP}_{DOMAIN}/…` backup
 * → inject before </head> → write via createWritable() → one-click restore.
 */

import {
	IGNORE_DIR_NAMES,
	isIgnoredPath,
	isSourceFilePath,
	scanLocalFolderFiles,
	type LocalScannedFile,
} from '@/lib/solve/local-folder-scan';
import { REDUE_V14_SCHEMA_PATCH_SUCCESS } from '@/lib/solve/dynamic-php-schema';
import { injectBeforeClosingHead } from '@/lib/solve/source-mapping';

export type LocalFsCapability = {
	supported: boolean;
	reason?: string;
};

export type BackupPatchFileResult = {
	relativePath: string;
	backedUp: boolean;
	injected: boolean;
	anchor?: string;
	warning?: string | null;
	error?: string;
};

export type BackupPatchReport = {
	ok: boolean;
	aborted: boolean;
	/** Relative session folder, e.g. `_redue_backups/20260812_012300_example.com` */
	backupFolderName: string | null;
	injectedCount: number;
	backedUpCount: number;
	results: BackupPatchFileResult[];
	errorMessage: string | null;
	successLines: string[];
};

export type DirectPatchTarget = {
	relativePath: string;
	/** Final file contents to write after successful backup. */
	patchedContent: string;
	/** Original contents used for backup (optional — read from disk if omitted). */
	originalContent?: string;
};

export type RestoreBackupReport = {
	ok: boolean;
	backupFolderName: string;
	restoredCount: number;
	results: Array<{ relativePath: string; ok: boolean; error?: string }>;
	errorMessage: string | null;
};

/** Parent directory that holds timestamped backup sessions. */
export const REDUE_BACKUPS_ROOT = '_redue_backups';

function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function isBackupDirName(name: string): boolean {
	return /^_redue_backup_/i.test(name) || /^_redue_backups$/i.test(name);
}

function sanitizeDomainToken(domain?: string | null): string {
	const raw = String(domain || 'site')
		.replace(/^https?:\/\//i, '')
		.replace(/^www\./i, '')
		.split('/')[0]
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return (raw || 'site').slice(0, 64);
}

/**
 * Hierarchical backup session path:
 * `_redue_backups/{YYYYMMDD_HHMMSS}_{domain}`
 * Legacy flat `_redue_backup_{stamp}` still recognized by walk skips.
 */
export function formatBackupFolderName(date = new Date(), domain?: string | null): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	return `${REDUE_BACKUPS_ROOT}/${stamp}_${sanitizeDomainToken(domain)}`;
}

/** Extract hostname from URL for backup folder naming. */
export function domainFromTargetUrl(targetUrl?: string | null): string {
	if (!targetUrl) return 'site';
	try {
		return sanitizeDomainToken(new URL(targetUrl).hostname);
	} catch {
		return sanitizeDomainToken(targetUrl);
	}
}

export function getLocalFsCapability(): LocalFsCapability {
	if (typeof window === 'undefined') {
		return { supported: false, reason: '브라우저 환경에서만 사용할 수 있습니다.' };
	}
	if (typeof window.showDirectoryPicker !== 'function') {
		return {
			supported: false,
			reason:
				'이 브라우저는 File System Access API를 지원하지 않습니다. Chrome / Edge 최신 버전을 사용하세요.',
		};
	}
	return { supported: true };
}

export async function ensureDirectoryPermission(
	root: FileSystemDirectoryHandle,
	mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
	const opts: FileSystemHandlePermissionDescriptor = { mode };
	try {
		if (typeof root.queryPermission === 'function') {
			const current = await root.queryPermission(opts);
			if (current === 'granted') return true;
		}
		if (typeof root.requestPermission === 'function') {
			const next = await root.requestPermission(opts);
			return next === 'granted';
		}
		// Some Chromium builds grant permission via the picker itself.
		return true;
	} catch {
		return false;
	}
}

/** Opens the native folder picker with read/write intent. */
export async function pickProjectDirectory(): Promise<FileSystemDirectoryHandle | null> {
	const cap = getLocalFsCapability();
	if (!cap.supported) {
		throw new Error(cap.reason || 'File System Access API unavailable');
	}
	try {
		const handle = await window.showDirectoryPicker({
			id: 'redue-local-source-patch',
			mode: 'readwrite',
		});
		const granted = await ensureDirectoryPermission(handle, 'readwrite');
		if (!granted) {
			throw new Error('폴더 읽기/쓰기 권한이 거부되었습니다. 브라우저 권한 팝업에서 허용해 주세요.');
		}
		return handle;
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return null;
		throw err;
	}
}

async function getNestedDirectory(
	root: FileSystemDirectoryHandle,
	relativeDir: string,
	create: boolean,
): Promise<FileSystemDirectoryHandle> {
	const parts = normalizePath(relativeDir).split('/').filter(Boolean);
	let dir = root;
	for (const part of parts) {
		dir = await dir.getDirectoryHandle(part, { create });
	}
	return dir;
}

export async function getFileHandleByPath(
	root: FileSystemDirectoryHandle,
	relativePath: string,
	create = false,
): Promise<FileSystemFileHandle> {
	const normalized = normalizePath(relativePath);
	const parts = normalized.split('/').filter(Boolean);
	if (parts.length === 0) throw new Error('빈 파일 경로입니다.');
	const fileName = parts[parts.length - 1];
	const parent =
		parts.length > 1 ? await getNestedDirectory(root, parts.slice(0, -1).join('/'), create) : root;
	return parent.getFileHandle(fileName, { create });
}

export async function readTextFile(
	root: FileSystemDirectoryHandle,
	relativePath: string,
): Promise<string> {
	const handle = await getFileHandleByPath(root, relativePath, false);
	const file = await handle.getFile();
	return file.text();
}

export async function writeTextFile(
	root: FileSystemDirectoryHandle,
	relativePath: string,
	content: string,
): Promise<void> {
	const handle = await getFileHandleByPath(root, relativePath, true);
	const writable = await handle.createWritable();
	try {
		await writable.write(content);
	} finally {
		await writable.close();
	}
}

export type DirectoryWalkResult = {
	sourceFiles: LocalScannedFile[];
	/** All non-ignored relative paths (for CMS structure signals). */
	structurePaths: string[];
};

/** Recursively collect source files + structure paths (skip ignore + prior backups). */
export async function collectSourceFilesFromDirectory(
	root: FileSystemDirectoryHandle,
): Promise<DirectoryWalkResult> {
	const sourceFiles: LocalScannedFile[] = [];
	const structurePaths: string[] = [];

	async function walk(dir: FileSystemDirectoryHandle, prefix: string): Promise<void> {
		for await (const [name, handle] of dir.entries()) {
			const relativePath = normalizePath(prefix ? `${prefix}/${name}` : name);
			if (handle.kind === 'directory') {
				if (IGNORE_DIR_NAMES.has(name) || isBackupDirName(name)) continue;
				structurePaths.push(relativePath + '/');
				await walk(handle as FileSystemDirectoryHandle, relativePath);
				continue;
			}
			structurePaths.push(relativePath);
			if (!isSourceFilePath(relativePath) || isIgnoredPath(relativePath)) continue;
			const fileHandle = handle as FileSystemFileHandle;
			const file = await fileHandle.getFile();
			sourceFiles.push({ relativePath, file });
		}
	}

	await walk(root, '');
	sourceFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'ko'));
	return { sourceFiles, structurePaths };
}

/** Scan directory handle into the same result shape as webkitdirectory FileList scan. */
export async function scanDirectoryHandle(root: FileSystemDirectoryHandle) {
	const { sourceFiles, structurePaths } = await collectSourceFilesFromDirectory(root);
	// Synthesize FileList-like entries so CMS detection sees structure + sources.
	const pathSet = new Set(structurePaths.map((p) => p.replace(/\/$/, '')));
	for (const s of sourceFiles) pathSet.add(s.relativePath);

	const fauxFiles: File[] = [];
	for (const relativePath of pathSet) {
		const source = sourceFiles.find((s) => s.relativePath === relativePath);
		const file =
			source?.file ||
			new File([''], relativePath.split('/').pop() || relativePath, {
				type: 'application/octet-stream',
			});
		try {
			Object.defineProperty(file, 'webkitRelativePath', {
				value: relativePath,
				configurable: true,
			});
		} catch {
			/* ignore */
		}
		fauxFiles.push(file);
	}
	return scanLocalFolderFiles(fauxFiles);
}

async function collectFilesUnderDirectory(
	dir: FileSystemDirectoryHandle,
	prefix = '',
): Promise<string[]> {
	const out: string[] = [];
	for await (const [name, handle] of dir.entries()) {
		const rel = normalizePath(prefix ? `${prefix}/${name}` : name);
		if (handle.kind === 'directory') {
			out.push(...(await collectFilesUnderDirectory(handle as FileSystemDirectoryHandle, rel)));
		} else {
			out.push(rel);
		}
	}
	return out;
}

/** List backup session folders: `_redue_backups/{stamp}_{domain}` (+ legacy `_redue_backup_*`). */
export async function listLocalBackupSessions(
	root: FileSystemDirectoryHandle,
): Promise<string[]> {
	const sessions: string[] = [];
	try {
		const backupsRoot = await root.getDirectoryHandle(REDUE_BACKUPS_ROOT, { create: false });
		for await (const [name, handle] of backupsRoot.entries()) {
			if (handle.kind === 'directory') {
				sessions.push(`${REDUE_BACKUPS_ROOT}/${name}`);
			}
		}
	} catch {
		/* no _redue_backups yet */
	}
	for await (const [name, handle] of root.entries()) {
		if (handle.kind === 'directory' && /^_redue_backup_\d/i.test(name)) {
			sessions.push(name);
		}
	}
	return sessions.sort((a, b) => b.localeCompare(a));
}

/**
 * Phase 1: create `_redue_backups/{TIMESTAMP}_{DOMAIN}/` and copy originals
 * with the same directory hierarchy (1:1).
 * Phase 2: only after full backup success, overwrite sources with patched content.
 * Any backup failure aborts before any source mutation.
 */
export async function backupAndDirectPatch(opts: {
	root: FileSystemDirectoryHandle;
	targets: DirectPatchTarget[];
	/** Hostname / URL used in `_redue_backups/{stamp}_{domain}` */
	domain?: string | null;
	onProgress?: (message: string, percent: number) => void;
}): Promise<BackupPatchReport> {
	const { root, targets, onProgress } = opts;
	const results: BackupPatchFileResult[] = [];

	if (targets.length === 0) {
		return {
			ok: false,
			aborted: true,
			backupFolderName: null,
			injectedCount: 0,
			backedUpCount: 0,
			results,
			errorMessage: '패치 대상 파일이 없습니다.',
			successLines: [],
		};
	}

	const granted = await ensureDirectoryPermission(root, 'readwrite');
	if (!granted) {
		return {
			ok: false,
			aborted: true,
			backupFolderName: null,
			injectedCount: 0,
			backedUpCount: 0,
			results,
			errorMessage: '폴더 읽기/쓰기 권한이 필요합니다. 권한 팝업에서 허용한 뒤 다시 시도하세요.',
			successLines: [],
		};
	}

	const backupFolderName = formatBackupFolderName(new Date(), opts.domain);
	onProgress?.(`백업 폴더 생성: ${backupFolderName}`, 8);

	let backupRoot: FileSystemDirectoryHandle;
	try {
		backupRoot = await getNestedDirectory(root, backupFolderName, true);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			aborted: true,
			backupFolderName: null,
			injectedCount: 0,
			backedUpCount: 0,
			results,
			errorMessage: `백업 폴더 생성 실패 — 소스 수정을 중단했습니다. (${message})`,
			successLines: [],
		};
	}

	const originals = new Map<string, string>();
	let backedUpCount = 0;

	// ── Pre-patch backup (all or nothing before any inject) ──
	for (let i = 0; i < targets.length; i++) {
		const target = targets[i];
		const rel = normalizePath(target.relativePath);
		const pct = 10 + Math.round(((i + 1) / targets.length) * 35);
		onProgress?.(`원본 계층 백업 중: ${backupFolderName}/${rel}`, pct);

		try {
			const original =
				target.originalContent !== undefined
					? target.originalContent
					: await readTextFile(root, rel);
			originals.set(rel, original);
			await writeTextFile(backupRoot, rel, original);
			backedUpCount += 1;
			results.push({ relativePath: rel, backedUp: true, injected: false });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			results.push({
				relativePath: rel,
				backedUp: false,
				injected: false,
				error: message,
			});
			return {
				ok: false,
				aborted: true,
				backupFolderName,
				injectedCount: 0,
				backedUpCount,
				results,
				errorMessage: `백업 실패 (${rel}) — 소스 파일 수정을 즉시 중단했습니다. ${message}`,
				successLines: [],
			};
		}
	}

	const backupOkLine = `[✅ 계층형 안전 백업 완료: ${backupFolderName}/… 원본 디렉터리 1:1 유지]`;
	onProgress?.(backupOkLine, 50);

	// ── Direct source injection ──
	let injectedCount = 0;
	for (let i = 0; i < targets.length; i++) {
		const target = targets[i];
		const rel = normalizePath(target.relativePath);
		const pct = 55 + Math.round(((i + 1) / targets.length) * 40);
		onProgress?.(`로컬 소스 주입 중: ${rel}`, pct);

		const row = results.find((r) => r.relativePath === rel);
		try {
			await writeTextFile(root, rel, target.patchedContent);
			injectedCount += 1;
			if (row) {
				row.injected = true;
			} else {
				results.push({ relativePath: rel, backedUp: true, injected: true });
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (row) {
				row.injected = false;
				row.error = message;
			}
			return {
				ok: false,
				aborted: true,
				backupFolderName,
				injectedCount,
				backedUpCount,
				results,
				errorMessage: `소스 주입 실패 (${rel}) — 백업은 ${backupFolderName}에 보관되어 있습니다. ${message}`,
				successLines: [backupOkLine],
			};
		}
	}

	const patchOkLine =
		injectedCount === 1
			? REDUE_V14_SCHEMA_PATCH_SUCCESS
			: `[🚀 로컬 소스 패치 완료: 총 ${injectedCount}개 파일 주입 적용됨]`;
	onProgress?.(patchOkLine, 100);

	return {
		ok: true,
		aborted: false,
		backupFolderName,
		injectedCount,
		backedUpCount,
		results,
		errorMessage: null,
		successLines:
			injectedCount === 1
				? [backupOkLine, `[✅ 원본 백업 완료] ➔ [${REDUE_V14_SCHEMA_PATCH_SUCCESS}]`]
				: [backupOkLine, patchOkLine],
	};
}

/**
 * One-click rollback: copy files from a backup session folder back to live sources
 * preserving the same relative hierarchy.
 */
export async function restoreFromBackup(opts: {
	root: FileSystemDirectoryHandle;
	backupFolderName: string;
	/** When omitted, restore every file under the backup session. */
	relativePaths?: string[];
	onProgress?: (message: string, percent: number) => void;
}): Promise<RestoreBackupReport> {
	const backupFolderName = normalizePath(opts.backupFolderName);
	const results: RestoreBackupReport['results'] = [];

	const granted = await ensureDirectoryPermission(opts.root, 'readwrite');
	if (!granted) {
		return {
			ok: false,
			backupFolderName,
			restoredCount: 0,
			results,
			errorMessage: '폴더 읽기/쓰기 권한이 필요합니다.',
		};
	}

	let backupRoot: FileSystemDirectoryHandle;
	try {
		backupRoot = await getNestedDirectory(opts.root, backupFolderName, false);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			backupFolderName,
			restoredCount: 0,
			results,
			errorMessage: `백업 폴더를 열 수 없습니다: ${backupFolderName} (${message})`,
		};
	}

	let paths = opts.relativePaths?.map(normalizePath) || [];
	if (paths.length === 0) {
		paths = await collectFilesUnderDirectory(backupRoot);
	}
	if (paths.length === 0) {
		return {
			ok: false,
			backupFolderName,
			restoredCount: 0,
			results,
			errorMessage: '백업 폴더에 복원할 파일이 없습니다.',
		};
	}

	let restoredCount = 0;
	for (let i = 0; i < paths.length; i++) {
		const rel = paths[i];
		opts.onProgress?.(
			`원클릭 복원 중: ${rel}`,
			Math.round(((i + 1) / paths.length) * 100),
		);
		try {
			const original = await readTextFile(backupRoot, rel);
			await writeTextFile(opts.root, rel, original);
			restoredCount += 1;
			results.push({ relativePath: rel, ok: true });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			results.push({ relativePath: rel, ok: false, error: message });
			return {
				ok: false,
				backupFolderName,
				restoredCount,
				results,
				errorMessage: `복원 실패 (${rel}): ${message}`,
			};
		}
	}

	return {
		ok: true,
		backupFolderName,
		restoredCount,
		results,
		errorMessage: null,
	};
}

/** Build patched content for a source string (search/replace or </head> inject). */
export function buildPatchedContent(
	original: string,
	snippet: string,
	searchText?: string,
	replaceText?: string,
): { ok: boolean; result: string; anchor?: string; warning?: string | null } {
	if (searchText && original.includes(searchText)) {
		return {
			ok: true,
			result: original.split(searchText).join(replaceText ?? ''),
			anchor: 'search-replace',
			warning: null,
		};
	}
	const injected = injectBeforeClosingHead(original, snippet);
	return {
		ok: injected.ok,
		result: injected.result,
		anchor: injected.anchor,
		warning: injected.warning,
	};
}
