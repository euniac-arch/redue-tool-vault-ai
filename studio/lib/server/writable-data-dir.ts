/**
 * Writable cache root for Node runtimes.
 * Vercel / Lambda `/var/task` is read-only — never mkdir under process.cwd().
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function isReadOnlyDeployRuntime(): boolean {
	return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
}

/** `.data` locally; `/tmp/redue-data` on Vercel. Override with REDUE_DATA_DIR. */
export function writableDataRoot(): string {
	const override = (process.env.REDUE_DATA_DIR || '').trim();
	if (override) return override;
	if (isReadOnlyDeployRuntime()) return path.join(tmpdir(), 'redue-data');
	return path.join(process.cwd(), '.data');
}

export function writableDataPath(...segments: string[]): string {
	return path.join(writableDataRoot(), ...segments);
}

export async function ensureWritableDir(dir: string): Promise<boolean> {
	try {
		await mkdir(dir, { recursive: true });
		return true;
	} catch (error) {
		console.warn('[writable-data-dir] mkdir skipped:', dir, error instanceof Error ? error.message : error);
		return false;
	}
}

export function ensureWritableDirSync(dir: string): boolean {
	try {
		mkdirSync(dir, { recursive: true });
		return true;
	} catch (error) {
		console.warn('[writable-data-dir] mkdir skipped:', dir, error instanceof Error ? error.message : error);
		return false;
	}
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<boolean> {
	try {
		if (!(await ensureWritableDir(path.dirname(filePath)))) return false;
		await writeFile(filePath, JSON.stringify(value, null, '\t'), 'utf8');
		return true;
	} catch (error) {
		console.warn('[writable-data-dir] write skipped:', filePath, error instanceof Error ? error.message : error);
		return false;
	}
}

export function writeJsonFileSync(filePath: string, value: unknown): boolean {
	try {
		if (!ensureWritableDirSync(path.dirname(filePath))) return false;
		writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
		return true;
	} catch (error) {
		console.warn('[writable-data-dir] write skipped:', filePath, error instanceof Error ? error.message : error);
		return false;
	}
}
