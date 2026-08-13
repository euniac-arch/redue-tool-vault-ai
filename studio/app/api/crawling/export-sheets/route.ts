import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
	exportRowsToGoogleSheet,
	GoogleSheetsApiError,
	GoogleSheetsConfigError,
	type SheetExportRow,
} from '@/lib/google/sheets-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Ensure monorepo-root `.env` / `.env.local` keys are visible in studio. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

type ExportBody = {
	items?: unknown;
	rows?: unknown;
	title?: unknown;
	spreadsheetId?: unknown;
};

function asTrimmedString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeItems(raw: unknown): SheetExportRow[] {
	if (!Array.isArray(raw)) return [];
	const out: SheetExportRow[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const siteName =
			asTrimmedString(row.siteName) ||
			asTrimmedString(row.name) ||
			asTrimmedString(row.업체명);
		const website =
			asTrimmedString(row.website) ||
			asTrimmedString(row.url) ||
			asTrimmedString(row.웹사이트);
		const category =
			asTrimmedString(row.category) ||
			asTrimmedString(row.categoryLabel) ||
			asTrimmedString(row.카테고리);
		const telephone =
			asTrimmedString(row.telephone) ||
			asTrimmedString(row.phone) ||
			asTrimmedString(row.전화번호);
		const address =
			asTrimmedString(row.address) ||
			asTrimmedString(row.region) ||
			asTrimmedString(row.주소);
		const crawledAt =
			asTrimmedString(row.crawledAt) ||
			asTrimmedString(row.collectedAt) ||
			asTrimmedString(row.수집일시);

		if (!siteName && !website) continue;
		out.push({
			siteName: siteName || website || '(이름 없음)',
			category,
			telephone: telephone || undefined,
			address: address || undefined,
			website,
			crawledAt,
		});
	}
	return out;
}

/**
 * POST /api/crawling/export-sheets
 *
 * Creates a Google Spreadsheet (or appends to spreadsheetId) with selected crawl rows.
 * Body: { items: SheetExportRow[], title?, spreadsheetId? }
 */
export async function POST(req: NextRequest) {
	let body: ExportBody;
	try {
		body = (await req.json()) as ExportBody;
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const items = normalizeItems(body.items ?? body.rows);
	if (items.length === 0) {
		return NextResponse.json(
			{ error: '내보낼 업체 데이터가 없습니다. 항목을 선택한 뒤 다시 시도해 주세요.' },
			{ status: 400 },
		);
	}

	const title = asTrimmedString(body.title) || undefined;
	const spreadsheetId = asTrimmedString(body.spreadsheetId) || undefined;

	try {
		const result = await exportRowsToGoogleSheet({
			rows: items,
			title,
			spreadsheetId,
		});

		return NextResponse.json({
			success: true,
			spreadsheetId: result.spreadsheetId,
			spreadsheetUrl: result.spreadsheetUrl,
			fileId: result.spreadsheetId,
			rowCount: result.rowCount,
			mode: result.mode,
		});
	} catch (error: unknown) {
		if (error instanceof GoogleSheetsConfigError) {
			console.error('[crawling/export-sheets] config:', error.message);
			return NextResponse.json(
				{
					error: error.message,
					code: 'CONFIG',
				},
				{ status: 503 },
			);
		}
		if (error instanceof GoogleSheetsApiError) {
			console.error('[crawling/export-sheets] api:', {
				message: error.message,
				status: error.status,
				code: error.code,
			});
			return NextResponse.json(
				{
					error: error.message,
					code: error.code || 'GOOGLE_API',
					details: error.message,
				},
				{ status: error.status && error.status >= 400 && error.status < 600 ? error.status : 502 },
			);
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('[crawling/export-sheets] unexpected:', error);
		return NextResponse.json(
			{
				error: '구글 시트 내보내기 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
				details: message,
			},
			{ status: 500 },
		);
	}
}
