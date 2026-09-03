import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASI_VISIBILITY_CONFIG } from '@/lib/ai-search-intelligence/visibility/config';
import type { AsiHistoryKind, AsiHistoryRecord } from '@/lib/ai-search-intelligence/persist/kinds';

const CAP: Record<AsiHistoryKind, number> = {
	observation: 800,
	evidence: 400,
	competitor: 400,
	opportunity: 200,
	action: 200,
	visibility: ASI_VISIBILITY_CONFIG.maxSnapshots,
	alert: 200,
};

export type AsiHistoryReadResult = {
	ok: boolean;
	rows: AsiHistoryRecord[];
};

export function asiHistoryRoot(): string {
	return (process.env.ASI_HISTORY_DIR || '').trim() || join(process.cwd(), '.data', 'asi');
}

function historyRoot(): string {
	return asiHistoryRoot();
}

export function listAsiHistoryDomains(): string[] {
	const root = historyRoot();
	if (!existsSync(root)) return [];
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name !== '_usage')
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

function domainKey(domain: string): string {
	return domain.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '_') || 'unknown';
}

function fileFor(domain: string, kind: AsiHistoryKind): string {
	return join(historyRoot(), domainKey(domain), `${kind}.json`);
}

export function atomicWriteJsonFile(path: string, contents: string) {
	const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, contents, 'utf8');
	try {
		copyFileSync(tmp, path);
	} finally {
		if (existsSync(tmp)) {
			try {
				unlinkSync(tmp);
			} catch {
				/* ignore tmp cleanup */
			}
		}
	}
}

function readJsonArray(path: string): AsiHistoryReadResult {
	if (!existsSync(path)) return { ok: true, rows: [] };
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
		if (!Array.isArray(parsed)) return { ok: false, rows: [] };
		return { ok: true, rows: parsed as AsiHistoryRecord[] };
	} catch {
		return { ok: false, rows: [] };
	}
}

function readList(domain: string, kind: AsiHistoryKind): AsiHistoryReadResult {
	const path = fileFor(domain, kind);
	const primary = readJsonArray(path);
	if (primary.ok) return primary;
	const backup = readJsonArray(`${path}.bak`);
	if (backup.ok && backup.rows.length) {
		try {
			atomicWriteJsonFile(path, JSON.stringify(backup.rows));
		} catch {
			/* restore is best-effort */
		}
		return backup;
	}
	return { ok: false, rows: [] };
}

function writeList(domain: string, kind: AsiHistoryKind, rows: AsiHistoryRecord[]) {
	const path = fileFor(domain, kind);
	try {
		mkdirSync(join(historyRoot(), domainKey(domain)), { recursive: true });
		if (existsSync(path)) {
			try {
				copyFileSync(path, `${path}.bak`);
			} catch {
				/* backup is best-effort */
			}
		}
		atomicWriteJsonFile(path, JSON.stringify(rows.slice(-CAP[kind])));
	} catch {
		/* persist is best-effort — caller keeps in-memory state */
	}
}

function recordKey(row: AsiHistoryRecord): string {
	if (row.kind === 'visibility') return row.timestamp;
	if (row.kind === 'observation') return `${row.provider || ''}::${(row.query || '').trim().toLowerCase()}`;
	if (row.kind === 'alert') return `${row.timestamp}::${row.query || ''}::${JSON.stringify(row.payload).slice(0, 80)}`;
	return `${row.kind}::${row.query || ''}::${row.timestamp}`;
}

export function tryReadAsiHistoryKind(domain: string, kind: AsiHistoryKind): AsiHistoryReadResult {
	return readList(domain, kind);
}

export function readAsiHistoryKind(domain: string, kind: AsiHistoryKind): AsiHistoryRecord[] {
	const result = readList(domain, kind);
	return result.ok ? result.rows : [];
}

export function writeAsiHistoryRecords(domain: string, rows: readonly AsiHistoryRecord[]) {
	const byKind = new Map<AsiHistoryKind, AsiHistoryRecord[]>();
	for (const row of rows) {
		const existing = tryReadAsiHistoryKind(domain, row.kind);
		const list = existing.ok ? existing.rows : [];
		const next = new Map(list.map((item) => [recordKey(item), item]));
		next.set(recordKey(row), row);
		byKind.set(row.kind, [...next.values()]);
	}
	for (const [kind, list] of byKind) {
		writeList(domain, kind, list.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
	}
}

export function clearAsiHistoryFiles(domain?: string) {
	const root = historyRoot();
	try {
		if (!domain) {
			if (existsSync(root)) rmSync(root, { recursive: true, force: true });
			return;
		}
		const dir = join(root, domainKey(domain));
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	} catch {
		/* clear is best-effort */
	}
}
