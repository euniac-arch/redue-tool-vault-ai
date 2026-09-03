import fs from 'node:fs';
import type { ScanBundle } from './types';
import { writeJsonFileSync, writableDataPath } from '@/lib/server/writable-data-dir';

const RESULT_FILE = writableDataPath('last-result.json');

export function saveResultBundle(bundle: ScanBundle): void {
	writeJsonFileSync(RESULT_FILE, bundle);
}

export function loadResultBundle(): ScanBundle | null {
	try {
		const raw = fs.readFileSync(RESULT_FILE, 'utf8');
		return JSON.parse(raw) as ScanBundle;
	} catch {
		return null;
	}
}
