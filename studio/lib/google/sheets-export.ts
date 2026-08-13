import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { google, type drive_v3, type sheets_v4 } from 'googleapis';
import type { JWTInput } from 'google-auth-library';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export const SHEET_HEADER_COLUMNS = [
	'업체명',
	'카테고리',
	'전화번호',
	'주소',
	'웹사이트',
	'수집일시',
] as const;

export type SheetExportRow = {
	siteName: string;
	category: string;
	telephone?: string;
	address?: string;
	website: string;
	crawledAt: string;
};

export type SheetExportResult = {
	spreadsheetId: string;
	spreadsheetUrl: string;
	rowCount: number;
	mode: 'create' | 'append';
};

export class GoogleSheetsConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GoogleSheetsConfigError';
	}
}

export class GoogleSheetsApiError extends Error {
	status?: number;
	code?: string;

	constructor(message: string, opts?: { status?: number; code?: string }) {
		super(message);
		this.name = 'GoogleSheetsApiError';
		this.status = opts?.status;
		this.code = opts?.code;
	}
}

function stripQuotes(raw: string): string {
	const v = raw.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v.slice(1, -1);
	}
	return v;
}

function resolvePathMaybe(raw: string): string {
	return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

function tryParseServiceAccountJson(raw: string): JWTInput | null {
	try {
		const parsed = JSON.parse(raw) as JWTInput;
		if (
			parsed &&
			typeof parsed === 'object' &&
			typeof (parsed as { client_email?: string }).client_email === 'string' &&
			typeof (parsed as { private_key?: string }).private_key === 'string'
		) {
			return parsed;
		}
	} catch {
		/* ignore */
	}
	return null;
}

function loadServiceAccountCredentials(): JWTInput | null {
	const inlineCandidates = [
		process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON,
		process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
		process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON,
	];
	for (const candidate of inlineCandidates) {
		const raw = candidate?.trim();
		if (!raw) continue;
		const parsed = tryParseServiceAccountJson(stripQuotes(raw));
		if (parsed) return parsed;
	}

	const pathCandidates = [
		process.env.GOOGLE_APPLICATION_CREDENTIALS,
		process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH,
		process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH,
	];
	for (const candidate of pathCandidates) {
		const raw = candidate?.trim();
		if (!raw) continue;
		const full = resolvePathMaybe(stripQuotes(raw));
		if (!existsSync(full)) continue;
		try {
			const parsed = tryParseServiceAccountJson(readFileSync(full, 'utf8'));
			if (parsed) return parsed;
		} catch (err) {
			console.error('[google-sheets] Failed to read service account file:', full, err);
		}
	}

	const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
	const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n');
	if (projectId && clientEmail && privateKey?.includes('BEGIN PRIVATE KEY')) {
		return {
			type: 'service_account',
			project_id: projectId,
			client_email: clientEmail,
			private_key: privateKey,
		};
	}

	return null;
}

function resolveApiKey(): string | null {
	const sheetsKey = process.env.GOOGLE_SHEETS_API?.trim();
	const driveKey = process.env.GOOGLE_DRIVE_API?.trim();
	const key = sheetsKey || driveKey;
	return key ? stripQuotes(key) : null;
}

type GoogleClients = {
	sheets: sheets_v4.Sheets;
	drive: drive_v3.Drive;
	authMode: 'service_account' | 'api_key';
};

let cachedClients: GoogleClients | null = null;

/**
 * Initialize Sheets + Drive clients.
 * Prefer service account (create/append requires it). API keys from
 * GOOGLE_SHEETS_API / GOOGLE_DRIVE_API are attached when present.
 */
export function getGoogleSheetsClients(): GoogleClients {
	if (cachedClients) return cachedClients;

	const apiKey = resolveApiKey();
	const credentials = loadServiceAccountCredentials();

	if (credentials) {
		const auth = new google.auth.GoogleAuth({
			credentials,
			scopes: [SHEETS_SCOPE, DRIVE_FILE_SCOPE, DRIVE_SCOPE],
		});
		const sheets = google.sheets({ version: 'v4', auth });
		const drive = google.drive({ version: 'v3', auth });
		cachedClients = { sheets, drive, authMode: 'service_account' };
		return cachedClients;
	}

	if (apiKey) {
		// API key alone cannot create/write private sheets — callers must check authMode.
		cachedClients = {
			sheets: google.sheets({ version: 'v4', auth: apiKey as unknown as string }),
			drive: google.drive({ version: 'v3', auth: apiKey as unknown as string }),
			authMode: 'api_key',
		};
		return cachedClients;
	}

	throw new GoogleSheetsConfigError(
		'Google Sheets/Drive 인증 정보가 없습니다. GOOGLE_SHEETS_API·GOOGLE_DRIVE_API와 함께 서비스 계정(JSON)을 설정해 주세요.',
	);
}

export function isGoogleSheetsWriteConfigured(): boolean {
	try {
		return getGoogleSheetsClients().authMode === 'service_account';
	} catch {
		return false;
	}
}

function toValueRows(rows: SheetExportRow[]): string[][] {
	return rows.map((row) => [
		row.siteName || '',
		row.category || '',
		row.telephone || '',
		row.address || '',
		row.website || '',
		row.crawledAt || '',
	]);
}

function extractGaxiosError(err: unknown): { status?: number; code?: string; message: string } {
	if (!err || typeof err !== 'object') {
		return { message: err instanceof Error ? err.message : String(err) };
	}
	const anyErr = err as {
		message?: string;
		code?: string | number;
		status?: number;
		response?: { status?: number; data?: { error?: { message?: string; status?: string; code?: number } } };
	};
	const status = anyErr.response?.status ?? anyErr.status;
	const code =
		typeof anyErr.code === 'string'
			? anyErr.code
			: anyErr.response?.data?.error?.status ||
				(typeof anyErr.response?.data?.error?.code === 'number'
					? String(anyErr.response.data.error.code)
					: undefined);
	const apiMessage = anyErr.response?.data?.error?.message;
	return {
		status,
		code,
		message: apiMessage || anyErr.message || 'Unknown Google API error',
	};
}

function mapGoogleError(err: unknown, context: string): GoogleSheetsApiError {
	const parsed = extractGaxiosError(err);
	console.error(`[google-sheets] ${context}`, {
		status: parsed.status,
		code: parsed.code,
		message: parsed.message,
		raw: err,
	});

	if (parsed.status === 401 || parsed.status === 403 || parsed.code === 'PERMISSION_DENIED') {
		return new GoogleSheetsApiError(
			'Google Sheets/Drive API 권한이 없습니다. 서비스 계정에 Sheets·Drive API를 활성화하고, 필요 시 대상 폴더/시트를 공유해 주세요.',
			{ status: parsed.status ?? 403, code: parsed.code },
		);
	}
	if (parsed.status === 404) {
		return new GoogleSheetsApiError('지정한 스프레드시트를 찾을 수 없습니다.', {
			status: 404,
			code: parsed.code,
		});
	}
	if (
		parsed.code === 'ENOTFOUND' ||
		parsed.code === 'ECONNRESET' ||
		parsed.code === 'ETIMEDOUT' ||
		parsed.message.toLowerCase().includes('network')
	) {
		return new GoogleSheetsApiError(
			'Google API 네트워크 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
			{ status: 503, code: parsed.code },
		);
	}

	return new GoogleSheetsApiError(`구글 시트 내보내기에 실패했습니다: ${parsed.message}`, {
		status: parsed.status ?? 502,
		code: parsed.code,
	});
}

async function shareAnyoneWithLink(drive: drive_v3.Drive, fileId: string) {
	try {
		await drive.permissions.create({
			fileId,
			requestBody: {
				role: 'writer',
				type: 'anyone',
			},
			supportsAllDrives: true,
		});
	} catch (err) {
		// Non-fatal: sheet may still open for the service-account owner / shared users.
		console.warn('[google-sheets] Failed to set anyone-with-link permission:', extractGaxiosError(err));
	}
}

export async function exportRowsToGoogleSheet(input: {
	rows: SheetExportRow[];
	title?: string;
	spreadsheetId?: string;
}): Promise<SheetExportResult> {
	const { rows, title, spreadsheetId } = input;
	if (rows.length === 0) {
		throw new GoogleSheetsApiError('내보낼 데이터가 없습니다.', { status: 400 });
	}

	const clients = getGoogleSheetsClients();
	if (clients.authMode !== 'service_account') {
		throw new GoogleSheetsConfigError(
			'스프레드시트 생성/쓰기는 API 키만으로는 불가능합니다. GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON 또는 FIREBASE/GOOGLE_APPLICATION_CREDENTIALS 서비스 계정을 설정해 주세요. (GOOGLE_SHEETS_API·GOOGLE_DRIVE_API는 API 활성화 확인용으로 함께 사용됩니다.)',
		);
	}

	const { sheets, drive } = clients;
	const values = toValueRows(rows);

	try {
		if (spreadsheetId?.trim()) {
			const id = spreadsheetId.trim();
			await sheets.spreadsheets.values.append({
				spreadsheetId: id,
				range: 'A1',
				valueInputOption: 'USER_ENTERED',
				insertDataOption: 'INSERT_ROWS',
				requestBody: { values },
			});
			const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
			return {
				spreadsheetId: id,
				spreadsheetUrl,
				rowCount: rows.length,
				mode: 'append',
			};
		}

		const stamp = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const defaultTitle =
			title?.trim() ||
			`REDUE 수집목록_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;

		const created = await sheets.spreadsheets.create({
			requestBody: {
				properties: { title: defaultTitle },
				sheets: [
					{
						properties: {
							title: '수집목록',
							gridProperties: {
								frozenRowCount: 1,
							},
						},
					},
				],
			},
			fields: 'spreadsheetId,spreadsheetUrl',
		});

		const id = created.data.spreadsheetId;
		const spreadsheetUrl =
			created.data.spreadsheetUrl ||
			(id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : '');

		if (!id || !spreadsheetUrl) {
			throw new GoogleSheetsApiError('스프레드시트 생성 응답에 ID가 없습니다.', { status: 502 });
		}

		await sheets.spreadsheets.values.update({
			spreadsheetId: id,
			range: '수집목록!A1',
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [[...SHEET_HEADER_COLUMNS], ...values],
			},
		});

		await shareAnyoneWithLink(drive, id);

		return {
			spreadsheetId: id,
			spreadsheetUrl,
			rowCount: rows.length,
			mode: 'create',
		};
	} catch (err) {
		if (err instanceof GoogleSheetsApiError || err instanceof GoogleSheetsConfigError) {
			throw err;
		}
		throw mapGoogleError(err, spreadsheetId ? 'append' : 'create');
	}
}
