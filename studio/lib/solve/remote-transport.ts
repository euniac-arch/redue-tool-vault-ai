/**
 * Unified FTP / SFTP transport for Universal Remote Auto-Patch Engine.
 */

import { Client as FtpClient, type FileInfo as FtpFileInfo } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { Writable } from 'stream';
import type { RemoteConnectionInput } from '@/lib/solve/remote-creds';
import { IGNORE_DIR_NAMES } from '@/lib/solve/local-folder-scan';

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
	close(): Promise<void>;
};

const CONNECT_TIMEOUT_MS = 25_000;
const MAX_SCAN_DEPTH = 6;
const MAX_SCAN_ENTRIES = 2500;
const DEFAULT_READ_MAX = 2_500_000; // 2.5MB

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

function shouldSkipDirName(name: string): boolean {
	if (!name || name === '.' || name === '..') return true;
	if (IGNORE_DIR_NAMES.has(name)) return true;
	if (/^_redue_backup_/i.test(name) || /^_redue_backups$/i.test(name)) return true;
	if (name === 'cache' || name === 'tmp' || name === 'temp' || name === 'uploads') return true;
	return false;
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
		const list = await this.client.list(dirAbsolute);
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
		await this.client.downloadTo(writable, absolutePath);
		return Buffer.concat(chunks).toString('utf8');
	}

	async writeText(absolutePath: string, content: string): Promise<void> {
		const { Readable } = await import('stream');
		const stream = Readable.from([Buffer.from(content, 'utf8')]);
		await this.client.uploadFrom(stream, absolutePath);
	}

	async ensureDir(absolutePath: string): Promise<void> {
		await this.client.ensureDir(absolutePath);
		// ensureDir may cwd into the dir — reset to root for subsequent ops
		await this.client.cd(this.root === '/' ? '/' : this.root);
	}

	async exists(absolutePath: string): Promise<boolean> {
		try {
			await this.client.size(absolutePath);
			return true;
		} catch {
			try {
				const parent = absolutePath.replace(/\/[^/]+$/, '') || '/';
				const name = absolutePath.split('/').filter(Boolean).pop() || '';
				const list = await this.client.list(parent);
				return list.some((e) => e.name === name);
			} catch {
				return false;
			}
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
		const list = await this.client.list(dirAbsolute);
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
		const buf = (await this.client.get(absolutePath)) as Buffer;
		if (buf.length > maxBytes) {
			throw new Error(`파일이 너무 큽니다 (${absolutePath}, >${maxBytes} bytes)`);
		}
		return buf.toString('utf8');
	}

	async writeText(absolutePath: string, content: string): Promise<void> {
		await this.client.put(Buffer.from(content, 'utf8'), absolutePath);
	}

	async ensureDir(absolutePath: string): Promise<void> {
		await this.client.mkdir(absolutePath, true);
	}

	async exists(absolutePath: string): Promise<boolean> {
		const exists = await this.client.exists(absolutePath);
		return Boolean(exists);
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
		try {
			await client.access({
				host: conn.host,
				port: conn.port,
				user: conn.username,
				password: conn.password,
				secure: false,
			});
			// Verify root is reachable
			await client.cd(root);
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
	const maxDepth = opts?.maxDepth ?? MAX_SCAN_DEPTH;
	const maxEntries = opts?.maxEntries ?? MAX_SCAN_ENTRIES;
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

		for (const entry of entries) {
			if (relativePaths.length >= maxEntries) {
				truncated = true;
				return { relativePaths, truncated };
			}

			if (entry.isDirectory) {
				if (shouldSkipDirName(entry.name)) continue;
				if (current.depth < maxDepth) {
					relativePaths.push(entry.relativePath.endsWith('/')
						? entry.relativePath
						: `${entry.relativePath}/`);
					queue.push({ abs: entry.path, depth: current.depth + 1 });
				}
				continue;
			}

			relativePaths.push(entry.relativePath);
		}
	}

	return { relativePaths, truncated };
}
