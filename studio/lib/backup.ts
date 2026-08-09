import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BACKUP_ROOT = path.resolve(process.cwd(), '.data', 'backups');

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
	fs.mkdirSync(userDir, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const zipPath = path.join(userDir, `${timestamp}-${fileName}.zip`);
	fs.writeFileSync(zipPath, buffer);

	return zipPath;
}
