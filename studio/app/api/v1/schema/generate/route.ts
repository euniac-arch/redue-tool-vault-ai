import { NextResponse } from 'next/server';
import { authenticateApiKey, checkRateLimit } from '@/lib/api-keys';
import { generateExternalSchema, type ExternalCmsType, type ExternalLang } from '@/lib/external-schema-generator';
import { prisma } from '@/lib/prisma';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';

interface GenerateBody {
	domain?: string;
	cms_type?: string;
	lang?: string;
}

const CREDIT_COST = 1;

function jsonError(status: number, code: string, message: string) {
	return NextResponse.json({ error: { code, message } }, { status });
}

async function logCall(apiKeyId: string, endpoint: string, domain: string, success: boolean, statusCode: number, creditsUsed: number, errorMessage?: string) {
	await prisma.apiCallLog.create({
		data: { apiKeyId, endpoint, domain, success, statusCode, creditsUsed, errorMessage: errorMessage ?? null },
	});
	await prisma.apiKey.update({ where: { id: apiKeyId }, data: { lastUsedAt: new Date() } });
}

/**
 * POST /api/v1/schema/generate — public PaaS endpoint for external agencies
 * (Step 8, section 3). Auth: `Authorization: Bearer redue_live_sk_...`.
 * Body: `{ domain, cms_type, lang }`. Deducts 1 credit from the key owner,
 * scans the target domain, and returns generated JSON-LD + meta tags (plus
 * a ready-to-paste `header.php` PHP block for `cms_type: "wordpress"`).
 */
export async function POST(request: Request) {
	const endpoint = '/api/v1/schema/generate';
	const authHeader = request.headers.get('authorization') ?? '';
	const rawKey = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

	const auth = await authenticateApiKey(rawKey);
	if (!auth.ok) {
		return jsonError(auth.status, auth.code, auth.message);
	}

	const body = (await request.json().catch(() => ({}))) as GenerateBody;
	const domain = body.domain?.trim();
	const cmsType: ExternalCmsType = body.cms_type === 'wordpress' ? 'wordpress' : 'generic';
	const lang: ExternalLang = body.lang === 'en' ? 'en' : 'ko';

	if (!domain) {
		return jsonError(400, 'invalid_request', '"domain" is required, e.g. "https://example.com".');
	}

	const rateLimit = await checkRateLimit(auth.apiKey.id, auth.apiKey.dailyLimit, auth.apiKey.monthlyLimit);
	if (!rateLimit.ok) {
		await logCall(auth.apiKey.id, endpoint, domain, false, 429, 0, 'rate_limited');
		return jsonError(
			429,
			'rate_limited',
			`Rate limit exceeded (daily ${rateLimit.dailyUsed}/${rateLimit.dailyLimit}, monthly ${rateLimit.monthlyUsed}/${rateLimit.monthlyLimit}).`
		);
	}

	const user = await prisma.user.findUnique({ where: { id: auth.apiKey.userId } });
	if (!user) {
		return jsonError(401, 'invalid_api_key', 'The user owning this API key no longer exists.');
	}
	if (user.creditsRemaining < CREDIT_COST) {
		await logCall(auth.apiKey.id, endpoint, domain, false, 402, 0, 'insufficient_credits');
		return jsonError(402, 'insufficient_credits', 'Not enough credits. Top up or upgrade your plan at /mypage.');
	}

	let result;
	try {
		result = await generateExternalSchema(domain, cmsType, lang);
	} catch (err) {
		const message = err instanceof UnsafeAuditUrlError ? err.message : 'Failed to scan the target domain.';
		await logCall(auth.apiKey.id, endpoint, domain, false, 400, 0, message);
		return jsonError(400, 'scan_failed', message);
	}

	await Promise.all([
		prisma.user.update({ where: { id: user.id }, data: { creditsRemaining: { decrement: CREDIT_COST } } }),
		prisma.creditTransaction.create({
			data: { userId: user.id, delta: -CREDIT_COST, reason: `api:${endpoint} (${result.domain})` },
		}),
	]);
	await logCall(auth.apiKey.id, endpoint, domain, true, 200, CREDIT_COST);

	return NextResponse.json({
		success: true,
		domain: result.domain,
		cms_type: cmsType,
		lang,
		scanned: result.scanned,
		json_ld: result.jsonLd,
		meta_tags: result.metaTags,
		php_snippet: result.phpSnippet,
		credits_remaining: user.creditsRemaining - CREDIT_COST,
	});
}
