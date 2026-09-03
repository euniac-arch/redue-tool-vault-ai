import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { ensureWritableDirSync, writableDataPath } from '@/lib/server/writable-data-dir';

const BACKUP_ROOT = writableDataPath('backups');

/**
 * Zips the pre-injection file content so users on paid plans can restore
 * the original file. Returns the absolute path stored on the
 * `InjectionHistory` row and streamed back by `/api/mypage/backup/[id]`.
 */
export async function createBackupZip(userId: string, originalFilePath: string, originalContent: string): Promise<string> {
	const zip = new JSZip();
	const fileName = path.basename(originalFilePath);
	zip.file(fileName, originalContent);

	const buffer = await zip.generateAsync({ type: 'nodebuffer' });

	const userDir = path.join(BACKUP_ROOT, userId);
	if (!ensureWritableDirSync(userDir)) {
		throw new Error('백업 디렉터리를 만들 수 없습니다.');
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const zipPath = path.join(userDir, `${timestamp}-${fileName}.zip`);
	try {
		fs.writeFileSync(zipPath, buffer);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : '백업 파일 저장에 실패했습니다.');
	}

	return zipPath;
}
