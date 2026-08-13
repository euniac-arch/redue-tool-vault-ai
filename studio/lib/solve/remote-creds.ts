/**
 * Short-lived encrypted credential tokens for Universal FTP/SFTP sessions.
 * Password never persists in plaintext on disk — only AES-256-GCM sealed blobs.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type RemoteProtocol = 'ftp' | 'sftp';

export type RemoteConnectionInput = {
	protocol: RemoteProtocol;
	host: string;
	port: number;
	username: string;
	password: string;
	/** Remote web root, e.g. `/www`, `/public_html`, `/` */
	remoteRoot: string;
};

type CredPayload = RemoteConnectionInput & {
	exp: number;
};

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ALGO = 'aes-256-gcm';

function secretKey(): Buffer {
	const raw =
		process.env.REMOTE_CRED_SECRET ||
		process.env.NEXTAUTH_SECRET ||
		'redue-dev-remote-cred-fallback-change-me';
	return createHash('sha256').update(raw).digest();
}

function normalizeRoot(root: string): string {
	const trimmed = String(root || '/').trim() || '/';
	if (trimmed === '/') return '/';
	return trimmed.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
}

export function normalizeRemoteConnection(input: RemoteConnectionInput): RemoteConnectionInput {
	const protocol = input.protocol === 'ftp' ? 'ftp' : 'sftp';
	const host = String(input.host || '').trim();
	const username = String(input.username || '').trim();
	const password = String(input.password ?? '');
	const portNum = Number(input.port);
	const port =
		Number.isFinite(portNum) && portNum > 0
			? Math.floor(portNum)
			: protocol === 'ftp'
				? 21
				: 22;

	if (!host) throw new Error('호스트(Host/IP)를 입력하세요.');
	if (!username) throw new Error('계정(Username)을 입력하세요.');

	return {
		protocol,
		host,
		port,
		username,
		password,
		remoteRoot: normalizeRoot(input.remoteRoot),
	};
}

/** Seal connection credentials into a short-lived opaque token. */
export function sealRemoteCredentials(input: RemoteConnectionInput): string {
	const conn = normalizeRemoteConnection(input);
	const payload: CredPayload = { ...conn, exp: Date.now() + TOKEN_TTL_MS };
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, secretKey(), iv);
	const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/** Open a sealed credential token (throws if expired/invalid). */
export function openRemoteCredentials(token: string): RemoteConnectionInput {
	if (!token || typeof token !== 'string') {
		throw new Error('원격 세션 토큰이 없습니다. 다시 진단해 주세요.');
	}
	try {
		const buf = Buffer.from(token, 'base64url');
		if (buf.length < 29) throw new Error('invalid');
		const iv = buf.subarray(0, 12);
		const tag = buf.subarray(12, 28);
		const data = buf.subarray(28);
		const decipher = createDecipheriv(ALGO, secretKey(), iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
		const parsed = JSON.parse(plaintext) as CredPayload;
		if (!parsed.exp || Date.now() > parsed.exp) {
			throw new Error('원격 세션이 만료되었습니다. 다시 진단해 주세요.');
		}
		return normalizeRemoteConnection(parsed);
	} catch (err) {
		if (err instanceof Error && /만료|세션/.test(err.message)) throw err;
		throw new Error('원격 세션 토큰이 유효하지 않습니다. 다시 진단해 주세요.');
	}
}

/** Resolve connection from either raw fields or a sealed session token. */
export function resolveRemoteConnection(body: {
	sessionToken?: string;
	protocol?: RemoteProtocol;
	host?: string;
	port?: number;
	username?: string;
	password?: string;
	remoteRoot?: string;
}): RemoteConnectionInput {
	if (body.sessionToken) {
		return openRemoteCredentials(body.sessionToken);
	}
	return normalizeRemoteConnection({
		protocol: body.protocol === 'ftp' ? 'ftp' : 'sftp',
		host: body.host || '',
		port: body.port || 0,
		username: body.username || '',
		password: body.password || '',
		remoteRoot: body.remoteRoot || '/',
	});
}
