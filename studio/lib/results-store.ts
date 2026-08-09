import fs from 'node:fs';
import path from 'node:path';
import type { ScanBundle } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const RESULT_FILE = path.join(DATA_DIR, 'last-result.json');

function ensureDataDir(): void {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

export function saveResultBundle(bundle: ScanBundle): void {
	ensureDataDir();
	fs.writeFileSync(RESULT_FILE, JSON.stringify(bundle, null, 2), 'utf8');
}

export function loadResultBundle(): ScanBundle | null {
	try {
		const raw = fs.readFileSync(RESULT_FILE, 'utf8');
		return JSON.parse(raw) as ScanBundle;
	} catch {
		return null;
	}
}
