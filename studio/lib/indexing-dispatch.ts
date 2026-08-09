import { pingIndexNow, writeIndexNowKeyFile } from './indexnow';
import { pingGoogleIndexing } from './google-indexing';
import crypto from 'node:crypto';

export interface IndexingPingSummary {
	attempted: boolean;
	siteUrl: string | null;
	indexNow: { success: boolean; message: string } | null;
	google: { success: boolean; message: string } | null;
}

function indexNowKey(): string {
	return process.env.INDEXNOW_KEY?.trim() || crypto.createHash('sha256').update('redue-ai-studio-indexnow').digest('hex').slice(0, 32);
}

/**
 * Fired right after a successful master-schema injection. Both pings run
 * concurrently and are always best-effort — a failed/unconfigured ping never
 * throws, so it can never fail the injection response itself.
 */
export async function dispatchIndexingPings(siteUrl: string | null, wpRootPath: string): Promise<IndexingPingSummary> {
	if (!siteUrl) {
		return { attempted: false, siteUrl: null, indexNow: null, google: null };
	}

	writeIndexNowKeyFile(wpRootPath, indexNowKey());

	const [indexNow, google] = await Promise.all([pingIndexNow(siteUrl), pingGoogleIndexing(siteUrl)]);

	return { attempted: true, siteUrl, indexNow, google };
}
