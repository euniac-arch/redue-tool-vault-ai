import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Vercel serverless FS is read-only except `/tmp`. SQLite `file:` URLs from
 * `.env` (`file:./prisma/dev.db`) cannot be written at runtime, so master-admin
 * upserts fail and `/api/me` looks like a logged-out session.
 */
function prepareSqliteOnVercel(): void {
	if (!process.env.VERCEL) return;
	const url = process.env.DATABASE_URL || '';
	if (!url.startsWith('file:')) return;

	const tmp = '/tmp/redue.db';
	const relative = url.replace(/^file:(\/\/)?/, '');
	const candidates = [
		path.isAbsolute(relative) ? relative : path.join(process.cwd(), relative),
		path.join(process.cwd(), 'prisma', 'dev.db'),
	];

	try {
		if (!fs.existsSync(tmp)) {
			for (const src of candidates) {
				if (src !== tmp && fs.existsSync(src)) {
					fs.copyFileSync(src, tmp);
					break;
				}
			}
		}
		process.env.DATABASE_URL = `file:${tmp}`;
	} catch (err) {
		console.error('[prisma] /tmp sqlite copy failed:', err);
	}
}

prepareSqliteOnVercel();

/**
 * Standard Next.js dev-mode singleton so hot-reload doesn't spawn a new
 * PrismaClient (and a new SQLite connection pool) on every file save.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		datasources: process.env.DATABASE_URL ? { db: { url: process.env.DATABASE_URL } } : undefined,
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
