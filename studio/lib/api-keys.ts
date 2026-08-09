import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { PLANS, type PlanId } from './plans';

export const API_KEY_PREFIX = 'redue_live_sk_';
/** How much of the raw secret is safe to persist/display unmasked (prefix + first 8 secret chars). */
const VISIBLE_SECRET_CHARS = 8;

export interface GeneratedApiKey {
	/** The full secret — only ever returned once, at creation time. Never persisted in plaintext. */
	rawKey: string;
	keyPrefix: string;
}

/** Mints a new cryptographically random `redue_live_sk_...` secret key. */
export function generateApiKeySecret(): GeneratedApiKey {
	const secret = randomBytes(24).toString('base64url');
	const rawKey = `${API_KEY_PREFIX}${secret}`;
	const keyPrefix = rawKey.slice(0, API_KEY_PREFIX.length + VISIBLE_SECRET_CHARS);
	return { rawKey, keyPrefix };
}

export async function hashApiKey(rawKey: string): Promise<string> {
	return bcrypt.hash(rawKey, 10);
}

/** Rate limits granted to a freshly-minted key, based on the owning user's current plan. */
export function apiLimitsForPlan(planId: string): { dailyLimit: number; monthlyLimit: number } {
	const plan = PLANS[planId as PlanId] ?? PLANS.starter;
	return { dailyLimit: plan.apiDailyLimit, monthlyLimit: plan.apiMonthlyLimit };
}

export interface ApiKeyAuthResult {
	ok: true;
	apiKey: { id: string; userId: string; dailyLimit: number; monthlyLimit: number };
}
export interface ApiKeyAuthError {
	ok: false;
	status: number;
	code: string;
	message: string;
}

/**
 * Verifies a raw `Authorization: Bearer redue_live_sk_...` token against
 * stored key hashes. Bcrypt can't be looked up by hash directly, so we
 * narrow candidates by `keyPrefix` first (cheap, indexed-by-scan at this
 * scale) then bcrypt-compare the exact match.
 */
export async function authenticateApiKey(rawKey: string | undefined): Promise<ApiKeyAuthResult | ApiKeyAuthError> {
	if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
		return { ok: false, status: 401, code: 'invalid_api_key', message: 'Missing or malformed Authorization: Bearer redue_live_sk_... header.' };
	}

	const prefix = rawKey.slice(0, API_KEY_PREFIX.length + VISIBLE_SECRET_CHARS);
	const candidates = await prisma.apiKey.findMany({ where: { keyPrefix: prefix, revokedAt: null } });

	for (const candidate of candidates) {
		const matches = await bcrypt.compare(rawKey, candidate.keyHash);
		if (matches) {
			return {
				ok: true,
				apiKey: { id: candidate.id, userId: candidate.userId, dailyLimit: candidate.dailyLimit, monthlyLimit: candidate.monthlyLimit },
			};
		}
	}

	return { ok: false, status: 401, code: 'invalid_api_key', message: 'API key not recognized or has been revoked.' };
}

export interface RateLimitCheck {
	ok: boolean;
	dailyUsed: number;
	monthlyUsed: number;
	dailyLimit: number;
	monthlyLimit: number;
}

/** Counts successful+failed calls in the current UTC day/month windows and compares against the key's caps. */
export async function checkRateLimit(apiKeyId: string, dailyLimit: number, monthlyLimit: number): Promise<RateLimitCheck> {
	const now = new Date();
	const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

	const [dailyUsed, monthlyUsed] = await Promise.all([
		prisma.apiCallLog.count({ where: { apiKeyId, createdAt: { gte: startOfDay } } }),
		prisma.apiCallLog.count({ where: { apiKeyId, createdAt: { gte: startOfMonth } } }),
	]);

	return { ok: dailyUsed < dailyLimit && monthlyUsed < monthlyLimit, dailyUsed, monthlyUsed, dailyLimit, monthlyLimit };
}
