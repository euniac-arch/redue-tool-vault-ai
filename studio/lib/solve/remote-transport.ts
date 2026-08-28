/**
 * Unified FTP / SFTP transport for Universal Remote Auto-Patch Engine.
 */

import {
	Client as FtpClient,
	enterPassiveModeIPv4,
	type FileInfo as FtpFileInfo,
} from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { Readable, Writable } from 'stream';
import type { RemoteConnectionInput } from '@/lib/solve/remote-creds';
import { IGNORE_DIR_NAMES } from '@/lib/solve/local-folder-scan';
import { toUtf8WithoutBom } from '@/lib/solve/php-sanitize';

export type RemoteListEntry = {
	name: string;
	/** Absolute remote path */
	path: string;
	/** Path relative to remoteRoot (no leading slash) */
	relativePath: string;
	isDirectory: boolean;
	size: number;
};

export type RemoteTransport = {
	protocol: 'ftp' | 'sftp';
	root: string;
	list(dirAbsolute: string): Promise<RemoteListEntry[]>;
	readText(absolutePath: string, maxBytes?: number): Promise<string>;
	writeText(absolutePath: string, content: string): Promise<void>;
	ensureDir(absolutePath: string): Promise<void>;
	exists(absolutePath: string): Promise<boolean>;
	/** Lightweight existence/size probe — prefer this over list() on Cafe24. */
	size(absolutePath: string): Promise<number>;
	close(): Promise<void>;
};

/** Socket + per-command cap so Cafe24 PASV data sockets cannot hang forever. */
export const FTP_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = FTP_TIMEOUT_MS;
/** Fallback walk only — CMS pinpoint should finish within 1–2s. */
export const MAX_REMOTE_SCAN_DEPTH = 2;
export const MAX_REMOTE_SCAN_ENTRIES = 50;
const DEFAULT_READ_MAX = 2_500_000; // 2.5MB

/** Bulk/media folders never enter recursive LIST (Cafe24 session kill). */
export const REMOTE_SCAN_SKIP_DIR_NAMES = new Set([
	...IGNORE_DIR_NAMES,
	'data',
	'uploads',
	'upload',
	'files',
	'file',
	'images',
	'img',
	'image',
	'cache',
	'session',
	'sessions',
	'tmp',
	'temp',
	'thumb',
	'thumbnail',
	'logs',
	'log',
]);

export function shouldSkipRemoteScanDir(name: string): boolean {
	if (!name || name === '.' || name === '..') return true;
	const key = name.toLowerCase();
	if (REMOTE_SCAN_SKIP_DIR_NAMES.has(key) || REMOTE_SCAN_SKIP_DIR_NAMES.has(name)) return true;
	if (/^_redue_backup_/i.test(name) || /^_redue_backups$/i.test(name)) return true;
	if (name.startsWith('.')) return true;
	return false;
}

export async function withRemoteTimeout<T>(
	promise: Promise<T>,
	ms: number,
	label: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`원격 타임아웃 (${ms}ms): ${label}`)),
					ms,
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

function joinRemote(...parts: string[]): string {
	const cleaned = parts
		.map((p, i) => {
			const s = String(p || '').replace(/\\/g, '/');
			if (i === 0) return s.replace(/\/+$/, '') || '';
			return s.replace(/^\/+|\/+$/g, '');
		})
		.filter((p, i) => p !== '' || i === 0);
	let out = cleaned.join('/');
	if (!out.startsWith('/')) out = `/${out}`;
	return out.replace(/\/+/g, '/') || '/';
}

export function toAbsoluteRemotePath(remoteRoot: string, relativePath: string): string {
	const rel = String(relativePath || '')
		.replace(/\\/g, '/')
		.replace(/^\/+/, '');
	if (!rel) return remoteRoot === '/' ? '/' : remoteRoot.replace(/\/+$/, '');
	return joinRemote(remoteRoot, rel);
}

export function toRelativeRemotePath(remoteRoot: string, absolutePath: string): string {
	const abs = String(absolutePath || '').replace(/\\/g, '/');
	const root = remoteRoot === '/' ? '/' : remoteRoot.replace(/\/+$/, '');
	if (root === '/') return abs.replace(/^\/+/, '');
	if (abs === root) return '';
	if (abs.startsWith(`${root}/`)) return abs.slice(root.length + 1);
	return abs.replace(/^\/+/, '');
}

const PRIORITY_DIR_NAMES = new Set([
	'theme',
	'www',
	'html',
	'public_html',
	'public',
	'httpdocs',
	'skin',
	'wp-content',
	'app',
]);

function shouldSkipDirName(name: string): boolean {
	return shouldSkipRemoteScanDir(name);
}

function shouldSkipScanFile(name: string): boolean {
	return /\.(jpe?g|png|gif|webp|svg|ico|bmp|woff2?|ttf|eot|otf|mp4|mp3|wav|zip|rar|7z|pdf|gz|map)$/i.test(
		name,
	);
}

class FtpTransport implements RemoteTransport {
	protocol: 'ftp' = 'ftp';
	root: string;
	private client: FtpClient;

	constructor(client: FtpClient, root: string) {
		this.client = client;
		this.root = root;
	}

	async list(dirAbsolute: string): Promise<RemoteListEntry[]> {
		const list = await withRemoteTimeout(
			this.client.list(dirAbsolute),
			FTP_TIMEOUT_MS,
			`LIST ${dirAbsolute}`,
		);
		return list
			.filter((e) => e.name && e.name !== '.' && e.name !== '..')
			.map((e: FtpFileInfo) => {
				const path = joinRemote(dirAbsolute, e.name);
				return {
					name: e.name,
					path,
					relativePath: toRelativeRemotePath(this.root, path),
					isDirectory: e.isDirectory,
					size: Number(e.size) || 0,
				};
			});
	}

	async readText(absolutePath: string, maxBytes = DEFAULT_READ_MAX): Promise<string> {
		const chunks: Buffer[] = [];
		let total = 0;
		const writable = new Writable({
			write(chunk, _enc, cb) {
				const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				total += buf.length;
				if (total > maxBytes) {
					cb(new Error(`파일이 너무 큽니다 (${absolutePath}, >${maxBytes} bytes)`));
					return;
				}
				chunks.push(buf);
				cb();
			},
		});
		await withRemoteTimeout(
			this.client.downloadTo(writable, absolutePath),
			FTP_TIMEOUT_MS,
			`RETR ${absolutePath}`,
		);
		return Buffer.concat(chunks).toString('utf8');
	}

	async writeText(absolutePath: string, content: string): Promise<void> {
		const payload = Buffer.from(toUtf8WithoutBom(content), 'utf8');
		const stream = new Readable({
			read() {
				this.push(payload);
				this.push(null);
			},
		});
		await withRemoteTimeout(
			this.client.uploadFrom(stream, absolutePath),
			FTP_TIMEOUT_MS,
			`STOR ${absolutePath}`,
		);
	}

	async ensureDir(absolutePath: string): Promise<void> {
		await withRemoteTimeout(
			this.client.ensureDir(absolutePath),
			FTP_TIMEOUT_MS,
			`MKD ${absolutePath}`,
		);
		// ensureDir may cwd into the dir — reset to root for subsequent ops
		await withRemoteTimeout(
			this.client.cd(this.root === '/' ? '/' : this.root),
			FTP_TIMEOUT_MS,
			`CWD ${this.root}`,
		);
	}

	async size(absolutePath: string): Promise<number> {
		return withRemoteTimeout(
			this.client.size(absolutePath),
			FTP_TIMEOUT_MS,
			`SIZE ${absolutePath}`,
		);
	}

	async exists(absolutePath: string): Promise<boolean> {
		try {
			await this.size(absolutePath);
			return true;
		} catch {
			return false;
		}
	}

	async close(): Promise<void> {
		this.client.close();
	}
}

class SftpTransport implements RemoteTransport {
	protocol: 'sftp' = 'sftp';
	root: string;
	private client: SftpClient;

	constructor(client: SftpClient, root: string) {
		this.client = client;
		this.root = root;
	}

	async list(dirAbsolute: string): Promise<RemoteListEntry[]> {
		const list = await withRemoteTimeout(
			this.client.list(dirAbsolute),
			FTP_TIMEOUT_MS,
			`SFTP LIST ${dirAbsolute}`,
		);
		return list
			.filter((e) => e.name && e.name !== '.' && e.name !== '..')
			.map((e) => {
				const path = joinRemote(dirAbsolute, e.name);
				return {
					name: e.name,
					path,
					relativePath: toRelativeRemotePath(this.root, path),
					isDirectory: e.type === 'd',
					size: Number(e.size) || 0,
				};
			});
	}

	async readText(absolutePath: string, maxBytes = DEFAULT_READ_MAX): Promise<string> {
		const buf = (await withRemoteTimeout(
			this.client.get(absolutePath) as Promise<Buffer>,
			FTP_TIMEOUT_MS,
			`SFTP GET ${absolutePath}`,
		)) as Buffer;
		if (buf.length > maxBytes) {
			throw new Error(`파일이 너무 큽니다 (${absolutePath}, >${maxBytes} bytes)`);
		}
		return buf.toString('utf8');
	}

	async writeText(absolutePath: string, content: string): Promise<void> {
		await withRemoteTimeout(
			this.client.put(Buffer.from(toUtf8WithoutBom(content), 'utf8'), absolutePath),
			FTP_TIMEOUT_MS,
			`SFTP PUT ${absolutePath}`,
		);
	}

	async ensureDir(absolutePath: string): Promise<void> {
		await withRemoteTimeout(
			this.client.mkdir(absolutePath, true),
			FTP_TIMEOUT_MS,
			`SFTP MKDIR ${absolutePath}`,
		);
	}

	async size(absolutePath: string): Promise<number> {
		const stat = await withRemoteTimeout(
			this.client.stat(absolutePath),
			FTP_TIMEOUT_MS,
			`SFTP STAT ${absolutePath}`,
		);
		return Number(stat.size) || 0;
	}

	async exists(absolutePath: string): Promise<boolean> {
		try {
			const exists = await withRemoteTimeout(
				this.client.exists(absolutePath),
				FTP_TIMEOUT_MS,
				`SFTP EXISTS ${absolutePath}`,
			);
			return Boolean(exists);
		} catch {
			return false;
		}
	}

	async close(): Promise<void> {
		await this.client.end();
	}
}

export async function connectRemoteTransport(
	conn: RemoteConnectionInput,
): Promise<RemoteTransport> {
	const root = conn.remoteRoot === '/' ? '/' : conn.remoteRoot.replace(/\/+$/, '');

	if (conn.protocol === 'ftp') {
		const client = new FtpClient(CONNECT_TIMEOUT_MS);
		client.ftp.verbose = false;
		client.ftp.ipFamily = 4;
		// Cafe24 / hosting panels: force IPv4 PASV (never EPSV / active).
		client.prepareTransfer = enterPassiveModeIPv4;
		try {
			await withRemoteTimeout(
				client.access({
					host: conn.host,
					port: conn.port,
					user: conn.username,
					password: conn.password,
					secure: false,
					// basic-ftp is PASV-only; pasv/timeout are explicit for Cafe24 hardening.
					pasv: true,
					timeout: FTP_TIMEOUT_MS,
				} as Parameters<FtpClient['access']>[0] & { pasv: true; timeout: number }),
				FTP_TIMEOUT_MS,
				`FTP ACCESS ${conn.host}:${conn.port}`,
			);
			// Verify root is reachable
			await withRemoteTimeout(client.cd(root), FTP_TIMEOUT_MS, `CWD ${root}`);
			return new FtpTransport(client, root);
		} catch (err) {
			client.close();
			const msg = err instanceof Error ? err.message : String(err);
			throw new Error(`FTP 접속 실패: ${msg}`);
		}
	}

	const client = new SftpClient();
	try {
		await client.connect({
			host: conn.host,
			port: conn.port,
			username: conn.username,
			password: conn.password,
			readyTimeout: CONNECT_TIMEOUT_MS,
			timeout: FTP_TIMEOUT_MS,
			retries: 1,
		});
		const exists = await client.exists(root);
		if (!exists) {
			throw new Error(`원격 루트 경로를 찾을 수 없습니다: ${root}`);
		}
		return new SftpTransport(client, root);
	} catch (err) {
		try {
			await client.end();
		} catch {
			/* ignore */
		}
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`SFTP 접속 실패: ${msg}`);
	}
}

/** Breadth-first remote directory walk (structure paths for CMS detection). */
export async function walkRemoteTree(
	transport: RemoteTransport,
	opts?: { maxDepth?: number; maxEntries?: number },
): Promise<{ relativePaths: string[]; truncated: boolean }> {
	const maxDepth = opts?.maxDepth ?? MAX_REMOTE_SCAN_DEPTH;
	const maxEntries = opts?.maxEntries ?? MAX_REMOTE_SCAN_ENTRIES;
	const relativePaths: string[] = [];
	const queue: Array<{ abs: string; depth: number }> = [{ abs: transport.root, depth: 0 }];
	let truncated = false;

	while (queue.length > 0) {
		const current = queue.shift()!;
		let entries: RemoteListEntry[];
		try {
			entries = await transport.list(current.abs);
		} catch {
			continue;
		}

		const dirs: RemoteListEntry[] = [];
		for (const entry of entries) {
			if (relativePaths.length >= maxEntries) {
				truncated = true;
				return { relativePaths, truncated };
			}

			if (entry.isDirectory) {
				if (shouldSkipDirName(entry.name)) continue;
				if (current.depth < maxDepth) {
					relativePaths.push(
						entry.relativePath.endsWith('/') ? entry.relativePath : `${entry.relativePath}/`,
					);
					dirs.push(entry);
				}
				continue;
			}

			if (shouldSkipScanFile(entry.name)) continue;
			relativePaths.push(entry.relativePath);
		}

		// Walk theme / www / html before sibling folders so Gnuboard headers are found first.
		dirs.sort((a, b) => {
			const ap = PRIORITY_DIR_NAMES.has(a.name.toLowerCase()) ? 0 : 1;
			const bp = PRIORITY_DIR_NAMES.has(b.name.toLowerCase()) ? 0 : 1;
			return ap - bp;
		});
		const priorityDirs = dirs.filter((d) => PRIORITY_DIR_NAMES.has(d.name.toLowerCase()));
		const otherDirs = dirs.filter((d) => !PRIORITY_DIR_NAMES.has(d.name.toLowerCase()));
		queue.unshift(
			...priorityDirs.map((entry) => ({ abs: entry.path, depth: current.depth + 1 })),
		);
		queue.push(...otherDirs.map((entry) => ({ abs: entry.path, depth: current.depth + 1 })));
	}

	return { relativePaths, truncated };
}
